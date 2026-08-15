(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "project-workspace",
    start() {
      cleanup();

      const ROOT_ATTRIBUTE = "data-bettercodex-project-workspace-root";
      const LAUNCHER_ATTRIBUTE = "data-bettercodex-project-workspace-launcher";
      const LAUNCHER_ROW_ATTRIBUTE = "data-bettercodex-project-workspace-launcher-row";
      const SUPPRESSED_NAV_ATTRIBUTE = "data-bettercodex-project-workspace-suppressed-nav";
      const STYLE_ATTRIBUTE = "data-bettercodex-project-workspace-style";
      const STORAGE_KEY = "bettercodex.project-workspace.v1";
      const MAX_STORAGE_LENGTH = 3.75 * 1024 * 1024;
      const KANBAN_STORAGE_KEY = "bettercodex.project-kanban.v1";
      const API_EVENT = "bettercodex:project-workspace-api";
      const COMMAND_EVENT = "bettercodex:project-workspace-command";
      const KANBAN_CREATE_EVENT = "bettercodex:project-kanban-create-cards";
      const preferenceStorage = BetterCodex.storage || localStorage;
      const INLINE_TAGS = new Set(["A", "B", "BR", "CODE", "DEL", "EM", "I", "S", "STRIKE", "STRONG", "U"]);
      const BLOCK_TYPES = new Set([
        "text", "h1", "h2", "h3", "bullet", "numbered", "checklist", "quote", "divider",
        "code", "table", "callout", "toggle", "image", "mermaid"
      ]);
      const COMMANDS = [
        { group: "Basic blocks", type: "text", label: "Text", hint: "Plain text" },
        { group: "Basic blocks", type: "h1", label: "Heading 1", hint: "Large section heading" },
        { group: "Basic blocks", type: "h2", label: "Heading 2", hint: "Medium section heading" },
        { group: "Basic blocks", type: "h3", label: "Heading 3", hint: "Small section heading" },
        { group: "Basic blocks", type: "bullet", label: "Bullet List", hint: "Simple bulleted item" },
        { group: "Basic blocks", type: "numbered", label: "Numbered List", hint: "Ordered item" },
        { group: "Basic blocks", type: "checklist", label: "Checklist", hint: "Track a task" },
        { group: "Basic blocks", type: "quote", label: "Quote", hint: "Capture a quotation" },
        { group: "Basic blocks", type: "divider", label: "Divider", hint: "Separate sections" },
        { group: "Developer", type: "code", label: "Code Block", hint: "Syntax-highlighted code" },
        { group: "Developer", type: "mermaid", label: "Mermaid Diagram", hint: "Render a flowchart" },
        { group: "Developer", type: "file", label: "File Reference", hint: "Link a project file" },
        { group: "Advanced", type: "table", label: "Table", hint: "Two-column table" },
        { group: "Advanced", type: "callout", label: "Callout", hint: "Highlight information" },
        { group: "Advanced", type: "toggle", label: "Toggle", hint: "Collapsible details" },
        { group: "Advanced", type: "image", label: "Image", hint: "Embed an image URL" }
      ];
      const state = {
        stopped: false,
        scheduled: false,
        root: null,
        launcher: null,
        launcherRow: null,
        style: null,
        mainSurface: null,
        mainRestore: null,
        observer: null,
        abortController: new AbortController(),
        timers: new Set(),
        store: { version: 1, projects: {} },
        project: null,
        data: null,
        saveTimer: null,
        saveStatus: "saved",
        restoreFocusTo: null,
        popup: null,
        commandContext: null,
        selectedText: "",
        selectedBlockId: null,
        selectedRange: null,
        draggedPageId: null,
        draggedBlockId: null,
        history: new Map(),
        typingHistoryAt: 0,
        composerRestore: null,
        commandDisposer: null
      };

      const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      const clone = (value) => JSON.parse(JSON.stringify(value));
      const element = (tag, options = {}) => {
        const node = document.createElement(tag);
        if (options.className) node.className = options.className;
        if (options.text !== undefined) node.textContent = options.text;
        if (options.attributes) {
          for (const [name, value] of Object.entries(options.attributes)) node.setAttribute(name, String(value));
        }
        return node;
      };
      const iconButton = (label, icon, attributes = {}) => element("button", {
        className: "bbpw-icon-button",
        text: icon,
        attributes: { type: "button", "aria-label": label, title: label, ...attributes }
      });
      const ownedTimeout = (callback, delay) => {
        const id = setTimeout(() => {
          state.timers.delete(id);
          if (!state.stopped) callback();
        }, delay);
        state.timers.add(id);
        return id;
      };
      const cssEscape = (value) => globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-z0-9_-]/gi, "\\$&");
      const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

      const sanitizeInline = (html) => {
        const template = document.createElement("template");
        template.innerHTML = String(html || "");
        const clean = (parent) => {
          for (const node of [...parent.childNodes]) {
            if (node.nodeType === Node.TEXT_NODE) continue;
            if (node.nodeType !== Node.ELEMENT_NODE) {
              node.remove();
              continue;
            }
            clean(node);
            if (!INLINE_TAGS.has(node.tagName)) {
              node.replaceWith(...node.childNodes);
              continue;
            }
            const keep = {};
            if (node.tagName === "A") {
              const href = node.getAttribute("href") || "";
              if (/^(https?:|mailto:|#)/i.test(href)) keep.href = href;
              for (const name of ["data-workspace-ref", "data-ref-value", "title"]) {
                const value = node.getAttribute(name);
                if (value) keep[name] = value.slice(0, 1000);
              }
            }
            for (const attribute of [...node.attributes]) node.removeAttribute(attribute.name);
            for (const [name, value] of Object.entries(keep)) node.setAttribute(name, value);
          }
        };
        clean(template.content);
        return template.innerHTML;
      };
      const inlineText = (html) => {
        const template = document.createElement("template");
        template.innerHTML = sanitizeInline(html);
        return normalizeText(template.content.textContent);
      };
      const setInline = (node, html) => { node.innerHTML = sanitizeInline(html); };

      const newBlock = (type = "text", value = "") => {
        const base = { id: uid("block"), type: BLOCK_TYPES.has(type) ? type : "text", html: escapeHtml(value) };
        if (type === "checklist") base.checked = false;
        if (type === "code") Object.assign(base, { code: value, language: "typescript" });
        if (type === "mermaid") Object.assign(base, { source: value || "flowchart TD\n  A[Start] --> B[Done]" });
        if (type === "table") Object.assign(base, { cells: [["", ""], ["", ""]] });
        if (type === "callout") Object.assign(base, { icon: "💡" });
        if (type === "toggle") Object.assign(base, { summary: "Toggle", body: "", open: true });
        if (type === "image") Object.assign(base, { src: "", caption: "" });
        return base;
      };
      const normalizeBlock = (block) => {
        const type = BLOCK_TYPES.has(block?.type) ? block.type : "text";
        const next = { id: typeof block?.id === "string" ? block.id : uid("block"), type, html: sanitizeInline(block?.html || "") };
        if (type === "checklist") next.checked = Boolean(block?.checked);
        if (type === "code") Object.assign(next, { code: String(block?.code || "").slice(0, 200000), language: normalizeText(block?.language || "text").slice(0, 32) });
        if (type === "mermaid") next.source = String(block?.source || "").slice(0, 100000);
        if (type === "table") next.cells = Array.isArray(block?.cells)
          ? block.cells.slice(0, 40).map((row) => Array.isArray(row) ? row.slice(0, 12).map((cell) => String(cell || "").slice(0, 10000)) : [])
          : [["", ""], ["", ""]];
        if (type === "callout") next.icon = String(block?.icon || "💡").slice(0, 8);
        if (type === "toggle") Object.assign(next, {
          summary: String(block?.summary || "Toggle").slice(0, 10000),
          body: String(block?.body || "").slice(0, 100000),
          open: block?.open !== false
        });
        if (type === "image") Object.assign(next, {
          src: String(block?.src || "").slice(0, 1500000),
          caption: String(block?.caption || "").slice(0, 10000)
        });
        return next;
      };
      const normalizePage = (page) => ({
        id: typeof page?.id === "string" ? page.id : uid("page"),
        parentId: typeof page?.parentId === "string" ? page.parentId : null,
        title: String(page?.title || "Untitled").slice(0, 240),
        icon: String(page?.icon || "📄").slice(0, 8),
        favorite: Boolean(page?.favorite),
        contextEnabled: Boolean(page?.contextEnabled),
        contextSnippets: Array.isArray(page?.contextSnippets) ? page.contextSnippets.slice(-20).map((item) => String(item || "").slice(0, 20000)) : [],
        position: Number.isFinite(Number(page?.position)) ? Number(page.position) : Date.now(),
        createdAt: Number(page?.createdAt) || Date.now(),
        updatedAt: Number(page?.updatedAt) || Date.now(),
        lastOpenedAt: Number(page?.lastOpenedAt) || 0,
        blocks: Array.isArray(page?.blocks) ? page.blocks.slice(0, 1000).map(normalizeBlock) : [newBlock()]
      });
      const emptyProjectData = () => ({
        version: 1,
        pages: [],
        deleted: [],
        lastOpenedId: null,
        expanded: [],
        recent: [],
        ui: { sidebarCollapsed: false }
      });
      const normalizeProjectData = (value) => {
        const data = emptyProjectData();
        data.pages = Array.isArray(value?.pages) ? value.pages.slice(0, 500).map(normalizePage) : [];
        const ids = new Set(data.pages.map((page) => page.id));
        for (const page of data.pages) if (page.parentId && !ids.has(page.parentId)) page.parentId = null;
        data.deleted = Array.isArray(value?.deleted) ? value.deleted.slice(-10).map((entry) => ({
          deletedAt: Number(entry?.deletedAt) || Date.now(),
          pages: Array.isArray(entry?.pages) ? entry.pages.slice(0, 500).map(normalizePage) : []
        })) : [];
        data.lastOpenedId = ids.has(value?.lastOpenedId) ? value.lastOpenedId : null;
        data.expanded = Array.isArray(value?.expanded) ? value.expanded.filter((id) => ids.has(id)).slice(0, 500) : [];
        data.recent = Array.isArray(value?.recent) ? value.recent.filter((id) => ids.has(id)).slice(0, 12) : [];
        data.ui.sidebarCollapsed = Boolean(value?.ui?.sidebarCollapsed);
        return data;
      };

      const readStore = () => {
        try {
          const stored = JSON.parse(preferenceStorage.getItem(STORAGE_KEY) || "{}");
          if (stored.version === 1 && stored.projects && typeof stored.projects === "object") state.store = stored;
        } catch (_) {
          state.store = { version: 1, projects: {} };
        }
      };
      const projectLabel = (node) => normalizeText(node?.getAttribute?.("data-app-action-sidebar-project-label")
        || node?.getAttribute?.("data-project-name") || node?.getAttribute?.("data-project-label")
        || node?.getAttribute?.("aria-label") || node?.textContent).slice(0, 100);
      const findProjectNavigation = () => {
        const row = document.querySelector("[data-app-action-sidebar-project-row]");
        return row?.closest("nav, [role='navigation'], aside") || null;
      };
      const findProjectIdentity = () => {
        const navigation = findProjectNavigation();
        if (!navigation) return null;
        const activeThread = navigation.querySelector([
          "[data-app-action-sidebar-thread-active='true']", "[data-app-action-sidebar-thread-selected='true']",
          "[data-app-action-sidebar-thread-row][aria-current='page']"
        ].join(", "));
        const list = activeThread?.closest("[data-app-action-sidebar-project-list-id]");
        let id = list?.getAttribute("data-app-action-sidebar-project-list-id") || "";
        let row = id ? [...navigation.querySelectorAll("[data-app-action-sidebar-project-row]")].find((candidate) =>
          candidate.getAttribute("data-app-action-sidebar-project-id") === id || candidate.getAttribute("data-project-id") === id) : null;
        row ||= navigation.querySelector([
          "[data-app-action-sidebar-project-row][aria-current='page']", "[data-app-action-sidebar-project-row][aria-selected='true']",
          "[data-app-action-sidebar-project-row][data-state='active']", "[data-app-action-sidebar-project-row][data-active='true']"
        ].join(", "));
        row ||= navigation.querySelector("[data-app-action-sidebar-project-row]");
        if (!row) return null;
        id ||= row.getAttribute("data-app-action-sidebar-project-id") || row.getAttribute("data-project-id") || projectLabel(row);
        const label = projectLabel(row) || "Current project";
        return { id: String(id).slice(0, 200), label, key: `project:${String(id).slice(0, 200)}` };
      };
      const saveNow = () => {
        if (!state.project || !state.data) return false;
        if (state.saveTimer) {
          clearTimeout(state.saveTimer);
          state.timers.delete(state.saveTimer);
          state.saveTimer = null;
        }
        state.store.projects[state.project.key] = state.data;
        try {
          const serialized = JSON.stringify(state.store);
          if (serialized.length > MAX_STORAGE_LENGTH) throw new Error("Workspace storage is full");
          preferenceStorage.setItem(STORAGE_KEY, serialized);
          state.saveStatus = "saved";
          updateSaveStatus();
          return true;
        } catch (_) {
          state.saveStatus = "unsaved";
          updateSaveStatus();
          return false;
        }
      };
      const scheduleSave = () => {
        state.saveStatus = "saving";
        updateSaveStatus();
        if (state.saveTimer) {
          clearTimeout(state.saveTimer);
          state.timers.delete(state.saveTimer);
        }
        state.saveTimer = ownedTimeout(() => {
          state.saveTimer = null;
          saveNow();
        }, 350);
      };
      const switchProject = (project) => {
        if (state.project?.key === project?.key) return false;
        saveNow();
        state.project = project;
        state.data = project ? normalizeProjectData(state.store.projects[project.key]) : null;
        state.popup?.remove();
        state.popup = null;
        state.commandContext = null;
        return true;
      };
      const pageById = (id) => state.data?.pages.find((page) => page.id === id) || null;
      const currentPage = () => pageById(state.data?.lastOpenedId);
      const childPages = (parentId) => (state.data?.pages || [])
        .filter((page) => page.parentId === parentId)
        .sort((left, right) => left.position - right.position || left.title.localeCompare(right.title));
      const pageDescendants = (id) => {
        const result = [];
        const visit = (parentId) => childPages(parentId).forEach((page) => { result.push(page); visit(page.id); });
        visit(id);
        return result;
      };
      const touchPage = (page) => {
        if (!page) return;
        page.updatedAt = Date.now();
        scheduleSave();
      };
      const openPage = (id, options = {}) => {
        const page = pageById(id);
        if (!page) return false;
        page.lastOpenedAt = Date.now();
        state.data.lastOpenedId = page.id;
        state.data.recent = [page.id, ...state.data.recent.filter((recentId) => recentId !== page.id)].slice(0, 8);
        for (let parent = pageById(page.parentId); parent; parent = pageById(parent.parentId)) {
          if (!state.data.expanded.includes(parent.id)) state.data.expanded.push(parent.id);
        }
        scheduleSave();
        renderWorkspace();
        if (options.focusTitle) ownedTimeout(() => {
          const title = state.root?.querySelector("[data-bbpw-page-title]");
          title?.focus();
          title?.select?.();
        }, 0);
        return true;
      };

      const installStyles = () => {
        if (state.style?.isConnected) return;
        const style = element("style", { attributes: { [STYLE_ATTRIBUTE]: "" } });
        style.textContent = `
          [${LAUNCHER_ATTRIBUTE}]:focus-visible { outline:2px solid Highlight; outline-offset:2px; }
          [${LAUNCHER_ROW_ATTRIBUTE}][data-active='true'] { background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 9%,transparent)); }
          [${SUPPRESSED_NAV_ATTRIBUTE}], [${SUPPRESSED_NAV_ATTRIBUTE}] > button, [${SUPPRESSED_NAV_ATTRIBUTE}] > a { background:transparent !important; }
          [${ROOT_ATTRIBUTE}] { position:relative; display:block; min-width:0; flex:1 1 auto; overflow:hidden; color:var(--color-token-text-primary,var(--color-foreground,CanvasText)); background:var(--color-token-main-surface-primary,Canvas); font:inherit; }
          [${ROOT_ATTRIBUTE}][hidden] { display:none; }
          [${ROOT_ATTRIBUTE}] * { box-sizing:border-box; }
          [${ROOT_ATTRIBUTE}] button, [${ROOT_ATTRIBUTE}] input, [${ROOT_ATTRIBUTE}] textarea, [${ROOT_ATTRIBUTE}] select { color:inherit; font:inherit; }
          [${ROOT_ATTRIBUTE}] button:focus-visible, [${ROOT_ATTRIBUTE}] input:focus-visible, [${ROOT_ATTRIBUTE}] textarea:focus-visible, [${ROOT_ATTRIBUTE}] [contenteditable='true']:focus-visible { outline:2px solid Highlight; outline-offset:1px; }
          [${ROOT_ATTRIBUTE}] .bbpw-shell { display:grid; grid-template-columns:248px minmax(0,1fr); width:100%; height:100%; min-height:0; }
          [${ROOT_ATTRIBUTE}] .bbpw-shell[data-sidebar-collapsed='true'] { grid-template-columns:48px minmax(0,1fr); }
          [${ROOT_ATTRIBUTE}] .bbpw-sidebar { display:flex; min-height:0; flex-direction:column; border-right:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 10%,transparent)); background:var(--color-token-sidebar-surface-primary,var(--color-token-main-surface-secondary,color-mix(in srgb,currentColor 3%,transparent))); overflow:hidden; }
          [${ROOT_ATTRIBUTE}] .bbpw-sidebar-header { display:flex; min-height:58px; padding:12px 10px 8px 14px; align-items:center; gap:8px; }
          [${ROOT_ATTRIBUTE}] .bbpw-sidebar-title { min-width:0; flex:1; }
          [${ROOT_ATTRIBUTE}] .bbpw-sidebar-title strong, [${ROOT_ATTRIBUTE}] .bbpw-sidebar-title span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          [${ROOT_ATTRIBUTE}] .bbpw-sidebar-title strong { font-size:13px; font-weight:650; }
          [${ROOT_ATTRIBUTE}] .bbpw-sidebar-title span { margin-top:2px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 50%,transparent)); font-size:11px; }
          [${ROOT_ATTRIBUTE}] .bbpw-icon-button { appearance:none; display:grid; width:28px; height:28px; flex:none; padding:0; place-items:center; border:0; border-radius:7px; color:var(--color-token-text-secondary,color-mix(in srgb,currentColor 68%,transparent)); background:transparent; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpw-icon-button:hover { color:inherit; background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 9%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-search { display:flex; min-height:32px; margin:0 10px 8px; padding:0 9px; align-items:center; gap:7px; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 10%,transparent)); border-radius:8px; background:var(--color-token-main-surface-primary,color-mix(in srgb,currentColor 3%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-search span { color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 50%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; font-size:12px; }
          [${ROOT_ATTRIBUTE}] .bbpw-sidebar-scroll { min-height:0; flex:1; overflow:auto; padding:0 6px 10px; scrollbar-width:thin; }
          [${ROOT_ATTRIBUTE}] .bbpw-section-heading { display:flex; min-height:27px; padding:10px 8px 4px; align-items:center; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 48%,transparent)); font-size:10px; font-weight:650; letter-spacing:.055em; text-transform:uppercase; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-row { position:relative; display:flex; min-height:30px; align-items:center; border-radius:7px; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-row:hover, [${ROOT_ATTRIBUTE}] .bbpw-page-row[data-active='true'] { background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 8%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-page-row[data-drop='before'] { box-shadow:inset 0 2px Highlight; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-row[data-drop='after'] { box-shadow:inset 0 -2px Highlight; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-row[data-drop='inside'] { outline:1px solid Highlight; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-open { appearance:none; display:flex; min-width:0; min-height:30px; flex:1; padding:0 4px; align-items:center; gap:6px; border:0; color:inherit; background:transparent; text-align:left; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-open span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-chevron { appearance:none; display:grid; width:20px; height:24px; flex:none; padding:0; place-items:center; border:0; border-radius:5px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 50%,transparent)); background:transparent; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-chevron:hover { background:color-mix(in srgb,currentColor 8%,transparent); }
          [${ROOT_ATTRIBUTE}] .bbpw-page-more { opacity:0; pointer-events:none; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-row:hover .bbpw-page-more, [${ROOT_ATTRIBUTE}] .bbpw-page-row:focus-within .bbpw-page-more { opacity:1; pointer-events:auto; }
          [${ROOT_ATTRIBUTE}] .bbpw-new-page { appearance:none; display:flex; width:100%; min-height:31px; margin-top:4px; padding:0 9px; align-items:center; gap:8px; border:0; border-radius:7px; color:var(--color-token-text-secondary,color-mix(in srgb,currentColor 68%,transparent)); background:transparent; text-align:left; cursor:pointer; font-size:12px; }
          [${ROOT_ATTRIBUTE}] .bbpw-new-page:hover { color:inherit; background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 8%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-search-results mark { color:inherit; background:color-mix(in srgb,#d9a441 38%,transparent); border-radius:2px; }
          [${ROOT_ATTRIBUTE}] .bbpw-search-result { appearance:none; display:block; width:100%; padding:8px; border:0; border-radius:7px; color:inherit; background:transparent; text-align:left; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpw-search-result:hover { background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 8%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-search-result strong, [${ROOT_ATTRIBUTE}] .bbpw-search-result span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          [${ROOT_ATTRIBUTE}] .bbpw-search-result strong { font-size:12px; }
          [${ROOT_ATTRIBUTE}] .bbpw-search-result span { margin-top:3px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 52%,transparent)); font-size:10px; }
          [${ROOT_ATTRIBUTE}] .bbpw-editor-pane { position:relative; min-width:0; min-height:0; overflow:auto; scrollbar-width:thin; }
          [${ROOT_ATTRIBUTE}] .bbpw-editor-header { position:sticky; z-index:8; top:0; display:flex; min-height:48px; padding:8px 18px; align-items:center; gap:8px; border-bottom:1px solid transparent; background:color-mix(in srgb,var(--color-token-main-surface-primary,Canvas) 94%,transparent); backdrop-filter:blur(10px); }
          [${ROOT_ATTRIBUTE}] .bbpw-breadcrumbs { display:flex; min-width:0; flex:1; align-items:center; gap:5px; overflow:hidden; }
          [${ROOT_ATTRIBUTE}] .bbpw-crumb { appearance:none; max-width:180px; padding:4px 5px; overflow:hidden; border:0; border-radius:5px; color:var(--color-token-text-secondary,color-mix(in srgb,currentColor 66%,transparent)); background:transparent; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; font-size:11px; }
          [${ROOT_ATTRIBUTE}] .bbpw-crumb:hover { color:inherit; background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 8%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-save-status { min-width:48px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 48%,transparent)); text-align:right; font-size:10px; }
          [${ROOT_ATTRIBUTE}] .bbpw-action { appearance:none; display:flex; min-height:28px; padding:0 9px; align-items:center; gap:5px; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 11%,transparent)); border-radius:7px; color:inherit; background:var(--color-token-main-surface-secondary,color-mix(in srgb,currentColor 4%,transparent)); cursor:pointer; font-size:11px; white-space:nowrap; }
          [${ROOT_ATTRIBUTE}] .bbpw-action:hover { background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 9%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-action[aria-pressed='true'] { border-color:color-mix(in srgb,Highlight 45%,transparent); background:color-mix(in srgb,Highlight 13%,transparent); }
          [${ROOT_ATTRIBUTE}] .bbpw-document { width:min(820px,calc(100% - 56px)); margin:0 auto; padding:52px 0 120px; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-icon { appearance:none; min-width:50px; height:50px; padding:0; border:0; border-radius:10px; background:transparent; text-align:left; cursor:pointer; font-size:36px; line-height:1; }
          [${ROOT_ATTRIBUTE}] .bbpw-page-icon:hover { background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 7%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-title { display:block; width:100%; margin:16px 0 24px; padding:0; border:0; outline:0; color:inherit; background:transparent; font-size:36px; font-weight:720; line-height:1.18; letter-spacing:-.025em; }
          [${ROOT_ATTRIBUTE}] .bbpw-title::placeholder { color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 38%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-blocks { position:relative; }
          [${ROOT_ATTRIBUTE}] .bbpw-block { position:relative; display:flex; min-height:30px; margin:2px 0; align-items:flex-start; border-radius:5px; }
          [${ROOT_ATTRIBUTE}] .bbpw-block:hover { background:color-mix(in srgb,currentColor 2.5%,transparent); }
          [${ROOT_ATTRIBUTE}] .bbpw-block-tools { position:absolute; right:100%; top:1px; display:flex; opacity:0; padding-right:5px; pointer-events:none; }
          [${ROOT_ATTRIBUTE}] .bbpw-block:hover .bbpw-block-tools, [${ROOT_ATTRIBUTE}] .bbpw-block:focus-within .bbpw-block-tools { opacity:1; pointer-events:auto; }
          [${ROOT_ATTRIBUTE}] .bbpw-block-tool { appearance:none; display:grid; width:24px; height:26px; padding:0; place-items:center; border:0; border-radius:6px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 48%,transparent)); background:transparent; cursor:pointer; font-size:14px; }
          [${ROOT_ATTRIBUTE}] .bbpw-block-tool:hover { color:inherit; background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 9%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-editable { min-width:0; width:100%; padding:3px 2px; outline:0; line-height:1.62; overflow-wrap:anywhere; }
          [${ROOT_ATTRIBUTE}] .bbpw-editable:empty::before { content:attr(data-placeholder); color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 36%,transparent)); pointer-events:none; }
          [${ROOT_ATTRIBUTE}] .bbpw-editable a[data-workspace-ref] { display:inline; padding:1px 4px; border-radius:4px; color:var(--color-token-text-link,#6b9ed6); background:color-mix(in srgb,var(--color-token-text-link,#6b9ed6) 12%,transparent); text-decoration:none; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpw-editable code { padding:1px 4px; border-radius:4px; background:var(--color-token-main-surface-secondary,color-mix(in srgb,currentColor 7%,transparent)); font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.9em; }
          [${ROOT_ATTRIBUTE}] .bbpw-h1 { padding-top:18px; font-size:28px; font-weight:700; line-height:1.25; }
          [${ROOT_ATTRIBUTE}] .bbpw-h2 { padding-top:14px; font-size:22px; font-weight:680; line-height:1.3; }
          [${ROOT_ATTRIBUTE}] .bbpw-h3 { padding-top:10px; font-size:17px; font-weight:650; line-height:1.4; }
          [${ROOT_ATTRIBUTE}] .bbpw-list-marker { display:grid; width:24px; min-height:30px; flex:none; padding-top:7px; place-items:start center; color:var(--color-token-text-secondary,color-mix(in srgb,currentColor 68%,transparent)); font-size:12px; }
          [${ROOT_ATTRIBUTE}] .bbpw-check { margin:8px 8px 0 4px; accent-color:Highlight; }
          [${ROOT_ATTRIBUTE}] .bbpw-block[data-checked='true'] .bbpw-editable { color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 48%,transparent)); text-decoration:line-through; }
          [${ROOT_ATTRIBUTE}] .bbpw-quote { margin-left:1px; padding-left:14px; border-left:3px solid var(--color-token-border-medium,color-mix(in srgb,currentColor 30%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-divider { width:100%; margin:13px 0; border:0; border-top:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 12%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-code, [${ROOT_ATTRIBUTE}] .bbpw-mermaid, [${ROOT_ATTRIBUTE}] .bbpw-table-wrap, [${ROOT_ATTRIBUTE}] .bbpw-callout, [${ROOT_ATTRIBUTE}] .bbpw-toggle, [${ROOT_ATTRIBUTE}] .bbpw-image { width:100%; margin:5px 0; }
          [${ROOT_ATTRIBUTE}] .bbpw-code { overflow:hidden; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 11%,transparent)); border-radius:9px; background:var(--color-token-code-surface,var(--color-token-main-surface-secondary,color-mix(in srgb,currentColor 4%,transparent))); }
          [${ROOT_ATTRIBUTE}] .bbpw-code-header { display:flex; min-height:32px; padding:0 10px; align-items:center; justify-content:space-between; border-bottom:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 9%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-code-language { width:120px; padding:3px 0; border:0; outline:0; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 55%,transparent)); background:transparent; font-size:10px; text-transform:uppercase; }
          [${ROOT_ATTRIBUTE}] .bbpw-code-editor { min-height:72px; margin:0; padding:14px; outline:0; overflow:auto; color:var(--color-token-text-primary,currentColor); white-space:pre; tab-size:2; font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace; }
          [${ROOT_ATTRIBUTE}] .bbpw-token-keyword { color:#c792ea; } [${ROOT_ATTRIBUTE}] .bbpw-token-string { color:#a7c080; } [${ROOT_ATTRIBUTE}] .bbpw-token-number { color:#f78c6c; } [${ROOT_ATTRIBUTE}] .bbpw-token-comment { color:#7f8490; font-style:italic; }
          [${ROOT_ATTRIBUTE}] .bbpw-table { width:100%; border-collapse:collapse; table-layout:fixed; }
          [${ROOT_ATTRIBUTE}] .bbpw-table td { min-width:90px; padding:7px 9px; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 13%,transparent)); vertical-align:top; }
          [${ROOT_ATTRIBUTE}] .bbpw-table td[contenteditable='true']:focus { outline:2px solid Highlight; outline-offset:-2px; }
          [${ROOT_ATTRIBUTE}] .bbpw-table-actions { display:flex; gap:5px; margin-top:6px; }
          [${ROOT_ATTRIBUTE}] .bbpw-callout { display:flex; padding:12px 14px; gap:10px; border-radius:9px; background:var(--color-token-main-surface-secondary,color-mix(in srgb,currentColor 5%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-callout-icon { width:32px; border:0; outline:0; background:transparent; font-size:20px; }
          [${ROOT_ATTRIBUTE}] .bbpw-toggle { padding:3px 0; } [${ROOT_ATTRIBUTE}] .bbpw-toggle summary { cursor:pointer; font-weight:600; } [${ROOT_ATTRIBUTE}] .bbpw-toggle-body { margin:7px 0 0 20px; }
          [${ROOT_ATTRIBUTE}] .bbpw-image img { display:block; max-width:100%; max-height:620px; border-radius:9px; object-fit:contain; }
          [${ROOT_ATTRIBUTE}] .bbpw-image-input { width:100%; min-height:34px; padding:0 9px; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 12%,transparent)); border-radius:7px; background:transparent; }
          [${ROOT_ATTRIBUTE}] .bbpw-image-caption { margin-top:5px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 52%,transparent)); text-align:center; font-size:11px; }
          [${ROOT_ATTRIBUTE}] .bbpw-mermaid { display:grid; grid-template-columns:minmax(220px,.85fr) minmax(260px,1.15fr); overflow:hidden; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 11%,transparent)); border-radius:9px; }
          [${ROOT_ATTRIBUTE}] .bbpw-mermaid textarea { min-height:190px; padding:14px; resize:vertical; border:0; border-right:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 10%,transparent)); outline:0; background:var(--color-token-code-surface,var(--color-token-main-surface-secondary,color-mix(in srgb,currentColor 4%,transparent))); font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace; }
          [${ROOT_ATTRIBUTE}] .bbpw-mermaid-preview { display:grid; min-height:190px; padding:14px; place-items:center; overflow:auto; background:var(--color-token-main-surface-primary,Canvas); }
          [${ROOT_ATTRIBUTE}] .bbpw-mermaid-preview svg { max-width:100%; height:auto; }
          [${ROOT_ATTRIBUTE}] .bbpw-empty { display:grid; min-height:calc(100vh - 80px); padding:40px; place-items:center; text-align:center; }
          [${ROOT_ATTRIBUTE}] .bbpw-empty strong { display:block; margin-bottom:7px; font-size:18px; } [${ROOT_ATTRIBUTE}] .bbpw-empty p { max-width:390px; margin:0 0 16px; color:var(--color-token-text-secondary,color-mix(in srgb,currentColor 66%,transparent)); font-size:12px; line-height:1.55; }
          [${ROOT_ATTRIBUTE}] .bbpw-popup { position:absolute; z-index:30; width:280px; max-height:360px; overflow:auto; padding:5px; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 12%,transparent)); border-radius:10px; background:var(--color-token-main-surface-primary,Canvas); box-shadow:0 12px 35px rgba(0,0,0,.22); }
          [${ROOT_ATTRIBUTE}] .bbpw-popup-heading { padding:8px 8px 4px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 52%,transparent)); font-size:10px; font-weight:650; }
          [${ROOT_ATTRIBUTE}] .bbpw-menu-item { appearance:none; display:flex; width:100%; min-height:34px; padding:6px 8px; align-items:center; gap:9px; border:0; border-radius:7px; color:inherit; background:transparent; text-align:left; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpw-menu-item:hover, [${ROOT_ATTRIBUTE}] .bbpw-menu-item[data-selected='true'] { background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 9%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-menu-item-copy { min-width:0; } [${ROOT_ATTRIBUTE}] .bbpw-menu-item strong, [${ROOT_ATTRIBUTE}] .bbpw-menu-item span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          [${ROOT_ATTRIBUTE}] .bbpw-menu-item strong { font-size:12px; } [${ROOT_ATTRIBUTE}] .bbpw-menu-item span { margin-top:2px; color:var(--color-token-text-tertiary,color-mix(in srgb,currentColor 50%,transparent)); font-size:10px; }
          [${ROOT_ATTRIBUTE}] .bbpw-reference-form { display:flex; padding:7px; gap:6px; }
          [${ROOT_ATTRIBUTE}] .bbpw-reference-form input { min-width:0; height:32px; flex:1; padding:0 9px; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 12%,transparent)); border-radius:7px; outline:0; background:var(--color-token-main-surface-secondary,color-mix(in srgb,currentColor 3%,transparent)); font-size:12px; }
          [${ROOT_ATTRIBUTE}] .bbpw-reference-path { padding:7px 8px 4px; overflow:hidden; color:var(--color-token-text-secondary,color-mix(in srgb,currentColor 68%,transparent)); text-overflow:ellipsis; white-space:nowrap; font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; }
          [${ROOT_ATTRIBUTE}] .bbpw-selection-toolbar { position:absolute; z-index:35; display:flex; padding:4px; gap:2px; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 12%,transparent)); border-radius:9px; background:var(--color-token-main-surface-primary,Canvas); box-shadow:0 8px 28px rgba(0,0,0,.2); }
          [${ROOT_ATTRIBUTE}] .bbpw-selection-toolbar button { appearance:none; min-width:27px; height:27px; padding:0 7px; border:0; border-radius:6px; color:inherit; background:transparent; cursor:pointer; font-size:11px; white-space:nowrap; }
          [${ROOT_ATTRIBUTE}] .bbpw-selection-toolbar button:hover { background:var(--color-token-list-hover-background,color-mix(in srgb,currentColor 9%,transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpw-quick-search { position:absolute; z-index:50; inset:0; display:flex; padding-top:min(16vh,130px); justify-content:center; align-items:flex-start; background:rgba(0,0,0,.25); backdrop-filter:blur(2px); }
          [${ROOT_ATTRIBUTE}] .bbpw-quick-card { width:min(580px,calc(100% - 32px)); overflow:hidden; border:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 12%,transparent)); border-radius:12px; background:var(--color-token-main-surface-primary,Canvas); box-shadow:0 20px 60px rgba(0,0,0,.3); }
          [${ROOT_ATTRIBUTE}] .bbpw-quick-card input { width:100%; height:48px; padding:0 15px; border:0; border-bottom:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 10%,transparent)); outline:0; background:transparent; font-size:14px; }
          [${ROOT_ATTRIBUTE}] .bbpw-quick-results { max-height:380px; overflow:auto; padding:6px; }
          [${ROOT_ATTRIBUTE}] .bbpw-collapsed-launch { display:grid; width:100%; padding-top:14px; gap:10px; place-items:center; }
          @media (max-width:850px) { [${ROOT_ATTRIBUTE}] .bbpw-shell { grid-template-columns:210px minmax(0,1fr); } [${ROOT_ATTRIBUTE}] .bbpw-document { width:calc(100% - 36px); } [${ROOT_ATTRIBUTE}] .bbpw-mermaid { grid-template-columns:1fr; } [${ROOT_ATTRIBUTE}] .bbpw-mermaid textarea { border-right:0; border-bottom:1px solid var(--color-token-border-light,color-mix(in srgb,currentColor 10%,transparent)); } }
        `;
        document.head.append(style);
        state.style = style;
      };

      const blockText = (block) => {
        if (!block) return "";
        if (block.type === "code") return block.code || "";
        if (block.type === "mermaid") return block.source || "";
        if (block.type === "table") return (block.cells || []).flat().join(" ");
        if (block.type === "toggle") return `${block.summary || ""} ${block.body || ""}`;
        if (block.type === "image") return `${block.src || ""} ${block.caption || ""}`;
        return inlineText(block.html);
      };
      const pageText = (page) => [page?.title || "", ...(page?.blocks || []).map(blockText)].join("\n");
      const pageToMarkdown = (page) => {
        if (!page) return "";
        const lines = [`# ${page.icon || ""} ${page.title}`.trim(), ""];
        for (const block of page.blocks) {
          const text = blockText(block);
          if (block.type === "h1") lines.push(`# ${text}`);
          else if (block.type === "h2") lines.push(`## ${text}`);
          else if (block.type === "h3") lines.push(`### ${text}`);
          else if (block.type === "bullet") lines.push(`- ${text}`);
          else if (block.type === "numbered") lines.push(`1. ${text}`);
          else if (block.type === "checklist") lines.push(`- [${block.checked ? "x" : " "}] ${text}`);
          else if (block.type === "quote") lines.push(`> ${text}`);
          else if (block.type === "divider") lines.push("---");
          else if (block.type === "code") lines.push(`\`\`\`${block.language || ""}`, block.code || "", "\`\`\`");
          else if (block.type === "mermaid") lines.push("```mermaid", block.source || "", "```");
          else if (block.type === "table") {
            const cells = block.cells?.length ? block.cells : [["", ""]];
            lines.push(`| ${cells[0].join(" | ")} |`, `| ${cells[0].map(() => "---").join(" | ")} |`);
            for (const row of cells.slice(1)) lines.push(`| ${row.join(" | ")} |`);
          } else if (block.type === "callout") lines.push(`> ${block.icon || "💡"} ${text}`);
          else if (block.type === "toggle") lines.push(`<details><summary>${block.summary || "Toggle"}</summary>`, "", block.body || "", "", "</details>");
          else if (block.type === "image") lines.push(block.src ? `![${block.caption || "Image"}](${block.src})` : "");
          else lines.push(text);
          lines.push("");
        }
        return lines.join("\n").trim();
      };
      const markdownToBlocks = (markdown) => {
        const lines = String(markdown || "").replace(/\r/g, "").split("\n");
        const blocks = [];
        let code = null;
        let language = "text";
        for (const line of lines) {
          const fence = line.match(/^```\s*([\w-]*)/);
          if (fence) {
            if (code) {
              const type = language.toLowerCase() === "mermaid" ? "mermaid" : "code";
              const block = newBlock(type);
              if (type === "mermaid") block.source = code.join("\n");
              else Object.assign(block, { code: code.join("\n"), language: language || "text" });
              blocks.push(block);
              code = null;
            } else {
              code = [];
              language = fence[1] || "text";
            }
            continue;
          }
          if (code) {
            code.push(line);
            continue;
          }
          let match;
          if ((match = line.match(/^###\s+(.+)/))) blocks.push(newBlock("h3", match[1]));
          else if ((match = line.match(/^##\s+(.+)/))) blocks.push(newBlock("h2", match[1]));
          else if ((match = line.match(/^#\s+(.+)/))) blocks.push(newBlock("h1", match[1]));
          else if ((match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)/))) {
            const block = newBlock("checklist", match[2]); block.checked = match[1].toLowerCase() === "x"; blocks.push(block);
          } else if ((match = line.match(/^[-*]\s+(.+)/))) blocks.push(newBlock("bullet", match[1]));
          else if ((match = line.match(/^\d+[.)]\s+(.+)/))) blocks.push(newBlock("numbered", match[1]));
          else if ((match = line.match(/^>\s+(.+)/))) blocks.push(newBlock("quote", match[1]));
          else if (/^\s*(---|\*\*\*)\s*$/.test(line)) blocks.push(newBlock("divider"));
          else if ((match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/))) {
            const block = newBlock("image"); block.caption = match[1]; block.src = match[2]; blocks.push(block);
          } else if (line.trim()) blocks.push(newBlock("text", line));
          else if (blocks.length && blocks.at(-1).type !== "text") blocks.push(newBlock());
        }
        if (code) {
          const block = newBlock(language.toLowerCase() === "mermaid" ? "mermaid" : "code");
          if (block.type === "mermaid") block.source = code.join("\n");
          else Object.assign(block, { code: code.join("\n"), language });
          blocks.push(block);
        }
        return blocks.length ? blocks : [newBlock()];
      };
      const searchPages = (query) => {
        const needle = normalizeText(query).toLocaleLowerCase();
        const pages = state.data?.pages || [];
        if (!needle) return [...pages].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt || a.title.localeCompare(b.title)).slice(0, 12)
          .map((page) => ({ page, score: 0, excerpt: blockText(page.blocks[0]) || "No content yet" }));
        return pages.map((page) => {
          const title = page.title.toLocaleLowerCase();
          const body = pageText(page).toLocaleLowerCase();
          const index = body.indexOf(needle);
          if (!title.includes(needle) && index < 0) return null;
          const original = pageText(page);
          const start = Math.max(0, index - 42);
          return {
            page,
            score: title === needle ? 4 : title.startsWith(needle) ? 3 : title.includes(needle) ? 2 : 1,
            excerpt: normalizeText(original.slice(start, start + 120)) || "Matching page"
          };
        }).filter(Boolean).sort((a, b) => b.score - a.score || b.page.updatedAt - a.page.updatedAt).slice(0, 30);
      };
      const appendHighlighted = (node, value, query) => {
        const text = String(value || "");
        const needle = normalizeText(query);
        if (!needle) { node.textContent = text; return; }
        const index = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
        if (index < 0) { node.textContent = text; return; }
        node.append(document.createTextNode(text.slice(0, index)));
        node.append(element("mark", { text: text.slice(index, index + needle.length) }));
        node.append(document.createTextNode(text.slice(index + needle.length)));
      };

      const pageSnapshot = (page) => JSON.stringify({ title: page.title, icon: page.icon, blocks: page.blocks });
      const recordHistory = (page, options = {}) => {
        if (!page) return;
        if (options.typing && Date.now() - state.typingHistoryAt < 700) return;
        if (options.typing) state.typingHistoryAt = Date.now();
        const history = state.history.get(page.id) || { undo: [], redo: [] };
        const snapshot = pageSnapshot(page);
        if (history.undo.at(-1) !== snapshot) history.undo.push(snapshot);
        if (history.undo.length > 80) history.undo.shift();
        history.redo = [];
        state.history.set(page.id, history);
      };
      const applySnapshot = (page, serialized) => {
        try {
          const value = JSON.parse(serialized);
          page.title = String(value.title || "Untitled");
          page.icon = String(value.icon || "📄");
          page.blocks = Array.isArray(value.blocks) ? value.blocks.map(normalizeBlock) : [newBlock()];
          touchPage(page);
          renderWorkspace();
        } catch (_) {}
      };
      const undoPage = (redo = false) => {
        const page = currentPage();
        const history = page && state.history.get(page.id);
        if (!page || !history) return false;
        const source = redo ? history.redo : history.undo;
        const target = source.pop();
        if (!target) return false;
        const destination = redo ? history.undo : history.redo;
        destination.push(pageSnapshot(page));
        applySnapshot(page, target);
        return true;
      };

      const createPage = (parentId = null, options = {}) => {
        if (!state.data) return null;
        const siblings = childPages(parentId);
        const page = normalizePage({
          id: uid("page"), parentId: pageById(parentId) ? parentId : null,
          title: options.title || "Untitled", icon: options.icon || "📄",
          position: siblings.length ? siblings.at(-1).position + 1 : 1,
          blocks: options.blocks || [newBlock()]
        });
        state.data.pages.push(page);
        if (page.parentId && !state.data.expanded.includes(page.parentId)) state.data.expanded.push(page.parentId);
        scheduleSave();
        openPage(page.id, { focusTitle: options.focusTitle !== false });
        return page;
      };
      const duplicatePage = (sourceId) => {
        const source = pageById(sourceId);
        if (!source) return null;
        recordHistory(currentPage());
        const originals = [source, ...pageDescendants(source.id)];
        const mapping = new Map(originals.map((page) => [page.id, uid("page")]));
        let rootCopy = null;
        for (const original of originals) {
          const copy = normalizePage(clone(original));
          copy.id = mapping.get(original.id);
          copy.parentId = original.id === source.id ? source.parentId : mapping.get(original.parentId);
          copy.title = original.id === source.id ? `${original.title} copy` : original.title;
          copy.position = original.id === source.id ? source.position + 0.5 : original.position;
          copy.createdAt = copy.updatedAt = Date.now();
          copy.blocks.forEach((block) => { block.id = uid("block"); });
          state.data.pages.push(copy);
          if (!rootCopy) rootCopy = copy;
        }
        scheduleSave();
        if (rootCopy) openPage(rootCopy.id);
        return rootCopy;
      };
      const deletePage = (id, options = {}) => {
        const page = pageById(id);
        if (!page) return false;
        if (!options.skipConfirm && typeof confirm === "function" && !confirm(`Delete “${page.title}” and its nested pages?`)) return false;
        const ids = new Set([id, ...pageDescendants(id).map((child) => child.id)]);
        const removed = state.data.pages.filter((candidate) => ids.has(candidate.id));
        state.data.pages = state.data.pages.filter((candidate) => !ids.has(candidate.id));
        state.data.deleted.push({ deletedAt: Date.now(), pages: removed });
        state.data.deleted = state.data.deleted.slice(-10);
        state.data.recent = state.data.recent.filter((recentId) => !ids.has(recentId));
        if (ids.has(state.data.lastOpenedId)) state.data.lastOpenedId = state.data.recent.find((recentId) => pageById(recentId)) || state.data.pages[0]?.id || null;
        scheduleSave();
        renderWorkspace();
        return true;
      };
      const restoreLastDeleted = () => {
        const entry = state.data?.deleted.pop();
        if (!entry) return false;
        const currentIds = new Set(state.data.pages.map((page) => page.id));
        const mapping = new Map();
        for (const page of entry.pages) if (currentIds.has(page.id)) mapping.set(page.id, uid("page"));
        for (const original of entry.pages) {
          const page = normalizePage(original);
          page.id = mapping.get(original.id) || original.id;
          page.parentId = mapping.get(original.parentId) || (currentIds.has(original.parentId) ? null : original.parentId);
          page.blocks.forEach((block) => { if (!block.id) block.id = uid("block"); });
          state.data.pages.push(page);
        }
        scheduleSave();
        renderWorkspace();
        return true;
      };
      const reorderPage = (sourceId, targetId, mode) => {
        const source = pageById(sourceId);
        const target = pageById(targetId);
        if (!source || !target || source === target || pageDescendants(source.id).some((page) => page.id === target.id)) return false;
        const parentId = mode === "inside" ? target.id : target.parentId;
        const siblings = childPages(parentId).filter((page) => page.id !== source.id);
        let index = mode === "inside" ? siblings.length : siblings.findIndex((page) => page.id === target.id) + (mode === "after" ? 1 : 0);
        if (index < 0) index = siblings.length;
        siblings.splice(index, 0, source);
        source.parentId = parentId;
        siblings.forEach((page, position) => { page.position = position + 1; });
        if (mode === "inside" && !state.data.expanded.includes(target.id)) state.data.expanded.push(target.id);
        scheduleSave();
        renderSidebar();
        return true;
      };

      const copyText = async (value) => {
        try {
          if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; }
        } catch (_) {}
        const input = element("textarea", { attributes: { "aria-hidden": "true" } });
        input.value = value;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.append(input);
        input.select();
        let copied = false;
        try { copied = Boolean(document.execCommand?.("copy")); } catch (_) {}
        input.remove();
        return copied;
      };
      const pageLink = (page) => `workspace://${encodeURIComponent(state.project?.id || "project")}/${page?.id || ""}`;
      const closePopup = () => {
        state.popup?.remove();
        state.popup = null;
        state.commandContext = null;
      };
      const placePopup = (popup, anchor, options = {}) => {
        closePopup();
        state.root?.append(popup);
        const rootRect = state.root.getBoundingClientRect();
        const rect = anchor?.getBoundingClientRect?.() || { left: rootRect.left + 40, bottom: rootRect.top + 80, top: rootRect.top + 80 };
        popup.style.left = `${Math.max(8, Math.min(rootRect.width - (options.width || 288), rect.left - rootRect.left))}px`;
        popup.style.top = `${Math.max(8, Math.min(rootRect.height - 80, (options.above ? rect.top - 220 : rect.bottom) - rootRect.top + 5))}px`;
        state.popup = popup;
      };
      const showIconMenu = (page, anchor) => {
        const popup = element("div", { className: "bbpw-popup", attributes: { role: "menu", "aria-label": "Page icons" } });
        const icons = ["📄", "📁", "📚", "🏗️", "💡", "✅", "📋", "🧭", "🔐", "⚙️", "🗃️", "🚀", "🧪", "🔗", "📝"];
        const grid = element("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(5,1fr)";
        for (const icon of icons) {
          const button = element("button", { className: "bbpw-menu-item", text: icon, attributes: { type: "button", role: "menuitem", "data-icon": icon, "aria-label": `Use ${icon}` } });
          button.style.justifyContent = "center";
          button.style.fontSize = "20px";
          grid.append(button);
        }
        popup.append(grid);
        placePopup(popup, anchor, { width: 230 });
      };
      const showPageMenu = (page, anchor) => {
        const popup = element("div", { className: "bbpw-popup", attributes: { role: "menu", "aria-label": `Actions for ${page.title}` } });
        const actions = [
          ["subpage", "New subpage", "Create a nested page"],
          ["rename", "Rename", "Edit the page title"],
          ["duplicate", "Duplicate", "Copy this page and nested pages"],
          ["favorite", page.favorite ? "Remove from favorites" : "Add to favorites", "Keep this page close"],
          ["context", page.contextEnabled ? "Remove from Codex context" : "Add to Codex context", "Include with Workspace prompts"],
          ["copy-link", "Copy page link", pageLink(page)],
          ["todos", "Create tasks from TODOs", "Send unchecked items to Kanban"],
          ["delete", "Delete page", "Move page and nested pages to trash"]
        ];
        for (const [action, label, hint] of actions) {
          const button = element("button", { className: "bbpw-menu-item", attributes: { type: "button", role: "menuitem", "data-page-action": action, "data-page-id": page.id } });
          const copyNode = element("span", { className: "bbpw-menu-item-copy" });
          copyNode.append(element("strong", { text: label }), element("span", { text: hint }));
          button.append(copyNode);
          popup.append(button);
        }
        placePopup(popup, anchor, { width: 290 });
      };

      const renderPageRow = (page, level = 0, compact = false) => {
        const children = childPages(page.id);
        const expanded = state.data.expanded.includes(page.id);
        const row = element("div", {
          className: "bbpw-page-row", attributes: {
            draggable: compact ? "false" : "true", "data-page-row": page.id,
            "data-active": String(page.id === state.data.lastOpenedId), style: `padding-left:${compact ? 5 : level * 14 + 3}px`
          }
        });
        if (!compact) {
          const chevron = element("button", {
            className: "bbpw-page-chevron", text: children.length ? (expanded ? "⌄" : "›") : "",
            attributes: { type: "button", "aria-label": expanded ? `Collapse ${page.title}` : `Expand ${page.title}`, "data-page-toggle": page.id, disabled: children.length ? "" : "disabled" }
          });
          if (!children.length) chevron.style.visibility = "hidden";
          row.append(chevron);
        }
        const open = element("button", { className: "bbpw-page-open", attributes: { type: "button", "data-page-open": page.id, title: page.title } });
        open.append(element("span", { text: page.icon || "📄", attributes: { "aria-hidden": "true" } }), element("span", { text: page.title || "Untitled" }));
        row.append(open);
        if (!compact) {
          const more = iconButton(`More options for ${page.title}`, "•••", { "data-page-menu": page.id });
          more.classList.add("bbpw-page-more");
          row.append(more);
        }
        const fragment = document.createDocumentFragment();
        fragment.append(row);
        if (!compact && expanded) for (const child of children) fragment.append(renderPageRow(child, level + 1));
        return fragment;
      };

      const renderSearchResults = (query, container) => {
        if (!container) return;
        const results = searchPages(query);
        container.replaceChildren();
        if (!results.length) {
          container.append(element("div", { className: "bbpw-section-heading", text: "No matching pages" }));
          return;
        }
        for (const result of results) {
          const button = element("button", { className: "bbpw-search-result", attributes: { type: "button", "data-page-open": result.page.id } });
          const title = element("strong");
          appendHighlighted(title, `${result.page.icon || "📄"} ${result.page.title}`, query);
          const excerpt = element("span");
          appendHighlighted(excerpt, result.excerpt, query);
          button.append(title, excerpt);
          container.append(button);
        }
      };
      const renderSidebar = () => {
        const sidebar = state.root?.querySelector("[data-bbpw-sidebar]");
        if (!sidebar || !state.data) return;
        const collapsed = state.data.ui.sidebarCollapsed;
        state.root.querySelector(".bbpw-shell")?.setAttribute("data-sidebar-collapsed", String(collapsed));
        sidebar.replaceChildren();
        if (collapsed) {
          const compact = element("div", { className: "bbpw-collapsed-launch" });
          compact.append(iconButton("Expand Workspace sidebar", "›", { "data-sidebar-toggle": "" }), iconButton("Search Workspace", "⌕", { "data-quick-search": "" }), iconButton("New page", "+", { "data-new-page": "" }));
          sidebar.append(compact);
          return;
        }
        const header = element("div", { className: "bbpw-sidebar-header" });
        const title = element("div", { className: "bbpw-sidebar-title" });
        title.append(element("strong", { text: "Workspace" }), element("span", { text: state.project?.label || "Project" }));
        header.append(title, iconButton("Collapse Workspace sidebar", "‹", { "data-sidebar-toggle": "" }));
        const search = element("label", { className: "bbpw-search" });
        search.append(element("span", { text: "⌕", attributes: { "aria-hidden": "true" } }), element("input", { attributes: { type: "search", placeholder: "Search pages", "aria-label": "Search Workspace", "data-sidebar-search": "" } }));
        const scroll = element("div", { className: "bbpw-sidebar-scroll" });
        const results = element("div", { className: "bbpw-search-results", attributes: { "data-sidebar-search-results": "", hidden: "" } });
        const navigation = element("div", { attributes: { "data-sidebar-navigation": "" } });
        const favorites = state.data.pages.filter((page) => page.favorite).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
        if (favorites.length) {
          navigation.append(element("div", { className: "bbpw-section-heading", text: "Favorites" }));
          favorites.slice(0, 8).forEach((page) => navigation.append(renderPageRow(page, 0, true)));
        }
        const recent = state.data.recent.map(pageById).filter(Boolean).slice(0, 5);
        if (recent.length) {
          navigation.append(element("div", { className: "bbpw-section-heading", text: "Recent" }));
          recent.forEach((page) => navigation.append(renderPageRow(page, 0, true)));
        }
        navigation.append(element("div", { className: "bbpw-section-heading", text: "Pages" }));
        childPages(null).forEach((page) => navigation.append(renderPageRow(page)));
        navigation.append(element("button", { className: "bbpw-new-page", text: "+  New page", attributes: { type: "button", "data-new-page": "" } }));
        if (state.data.deleted.length) navigation.append(element("button", { className: "bbpw-new-page", text: "↶  Restore recently deleted", attributes: { type: "button", "data-restore-page": "" } }));
        scroll.append(navigation, results);
        sidebar.append(header, search, scroll);
      };

      const appendHighlightedCode = (node, code) => {
        const pattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b|\b\d+(?:\.\d+)?\b)/g;
        let last = 0;
        for (const match of String(code || "").matchAll(pattern)) {
          if (match.index > last) node.append(document.createTextNode(code.slice(last, match.index)));
          const value = match[0];
          let kind = "keyword";
          if (/^\/\//.test(value) || /^\/\*/.test(value)) kind = "comment";
          else if (/^['"`]/.test(value)) kind = "string";
          else if (/^\d/.test(value)) kind = "number";
          node.append(element("span", { className: `bbpw-token-${kind}`, text: value }));
          last = match.index + value.length;
        }
        if (last < code.length) node.append(document.createTextNode(code.slice(last)));
      };
      const renderMermaidPreview = (container, source) => {
        container.replaceChildren();
        const lines = String(source || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const edges = [];
        const nodes = new Map();
        const labelFor = (token) => {
          const match = token.trim().match(/^([\w.-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?/);
          if (!match) return null;
          const id = match[1];
          const label = match[2] || match[3] || match[4] || id;
          if (!nodes.has(id)) nodes.set(id, { id, label });
          return id;
        };
        for (const line of lines.slice(1)) {
          const match = line.match(/^(.+?)\s*(-->|---|==>)\s*(?:\|([^|]+)\|\s*)?(.+)$/);
          if (!match) { labelFor(line); continue; }
          const from = labelFor(match[1]);
          const to = labelFor(match[4]);
          if (from && to) edges.push({ from, to, label: match[3] || "" });
        }
        if (!nodes.size) {
          container.append(element("span", { text: "Add Mermaid flowchart syntax to preview it." }));
          return;
        }
        const namespace = "http://www.w3.org/2000/svg";
        const width = 360;
        const height = Math.max(130, nodes.size * 78);
        const svg = document.createElementNS(namespace, "svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Mermaid diagram preview");
        const defs = document.createElementNS(namespace, "defs");
        const marker = document.createElementNS(namespace, "marker");
        marker.setAttribute("id", `arrow-${nodes.size}-${Math.random().toString(36).slice(2, 6)}`);
        marker.setAttribute("viewBox", "0 0 10 10");
        marker.setAttribute("refX", "8"); marker.setAttribute("refY", "5"); marker.setAttribute("markerWidth", "6"); marker.setAttribute("markerHeight", "6"); marker.setAttribute("orient", "auto-start-reverse");
        const arrow = document.createElementNS(namespace, "path");
        arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z"); arrow.setAttribute("fill", "currentColor");
        marker.append(arrow); defs.append(marker); svg.append(defs);
        const positions = new Map([...nodes.values()].map((node, index) => [node.id, { x: 180, y: 38 + index * 78 }]));
        for (const edge of edges) {
          const from = positions.get(edge.from); const to = positions.get(edge.to);
          if (!from || !to) continue;
          const line = document.createElementNS(namespace, "line");
          line.setAttribute("x1", String(from.x)); line.setAttribute("y1", String(from.y + 22));
          line.setAttribute("x2", String(to.x)); line.setAttribute("y2", String(to.y - 22));
          line.setAttribute("stroke", "currentColor"); line.setAttribute("stroke-opacity", ".55"); line.setAttribute("stroke-width", "1.4");
          line.setAttribute("marker-end", `url(#${marker.id})`); svg.append(line);
          if (edge.label) {
            const text = document.createElementNS(namespace, "text");
            text.setAttribute("x", String((from.x + to.x) / 2 + 8)); text.setAttribute("y", String((from.y + to.y) / 2));
            text.setAttribute("fill", "currentColor"); text.setAttribute("fill-opacity", ".65"); text.setAttribute("font-size", "10"); text.textContent = edge.label; svg.append(text);
          }
        }
        for (const node of nodes.values()) {
          const position = positions.get(node.id);
          const group = document.createElementNS(namespace, "g");
          const rect = document.createElementNS(namespace, "rect");
          rect.setAttribute("x", String(position.x - 86)); rect.setAttribute("y", String(position.y - 22)); rect.setAttribute("width", "172"); rect.setAttribute("height", "44"); rect.setAttribute("rx", "8");
          rect.setAttribute("fill", "currentColor"); rect.setAttribute("fill-opacity", ".055"); rect.setAttribute("stroke", "currentColor"); rect.setAttribute("stroke-opacity", ".22");
          const text = document.createElementNS(namespace, "text");
          text.setAttribute("x", String(position.x)); text.setAttribute("y", String(position.y + 4)); text.setAttribute("text-anchor", "middle"); text.setAttribute("fill", "currentColor"); text.setAttribute("font-size", "11"); text.textContent = node.label.slice(0, 42);
          group.append(rect, text); svg.append(group);
        }
        container.append(svg);
      };
      const editable = (tag, block, className = "") => {
        const node = element(tag, {
          className: `bbpw-editable ${className}`.trim(), attributes: {
            contenteditable: "true", spellcheck: "true", "data-block-editable": block.id,
            "data-placeholder": block.type === "text" ? "Type '/' for commands…" : "Type something…"
          }
        });
        setInline(node, block.html);
        return node;
      };
      const blockTools = (block) => {
        const tools = element("span", { className: "bbpw-block-tools" });
        tools.append(
          element("button", { className: "bbpw-block-tool", text: "+", attributes: { type: "button", title: "Insert block", "aria-label": "Insert block", "data-block-add": block.id } }),
          element("button", { className: "bbpw-block-tool", text: "⠿", attributes: { type: "button", title: "Drag or open block actions", "aria-label": "Block actions", draggable: "true", "data-block-menu": block.id } })
        );
        return tools;
      };
      const renderBlock = (block, index) => {
        const wrapper = element("div", {
          className: "bbpw-block", attributes: { "data-block-id": block.id, "data-block-type": block.type, "data-block-index": index, draggable: "false" }
        });
        wrapper.append(blockTools(block));
        if (["text", "h1", "h2", "h3", "quote"].includes(block.type)) {
          wrapper.append(editable("div", block, block.type === "quote" ? "bbpw-quote" : `bbpw-${block.type}`));
        } else if (block.type === "bullet" || block.type === "numbered") {
          wrapper.append(element("span", { className: "bbpw-list-marker", text: block.type === "bullet" ? "•" : `${index + 1}.`, attributes: { "aria-hidden": "true" } }), editable("div", block));
        } else if (block.type === "checklist") {
          wrapper.setAttribute("data-checked", String(block.checked));
          const checkbox = element("input", { className: "bbpw-check", attributes: { type: "checkbox", "aria-label": "Mark task complete", "data-check-block": block.id } });
          checkbox.checked = block.checked;
          wrapper.append(checkbox, editable("div", block));
        } else if (block.type === "divider") {
          wrapper.append(element("hr", { className: "bbpw-divider" }));
        } else if (block.type === "code") {
          const code = element("div", { className: "bbpw-code" });
          const header = element("div", { className: "bbpw-code-header" });
          const language = element("input", { className: "bbpw-code-language", attributes: { value: block.language || "text", "aria-label": "Code language", "data-code-language": block.id, list: "bbpw-code-languages" } });
          header.append(language, element("span", { text: "Code", attributes: { "aria-hidden": "true" } }));
          const editor = element("pre", { className: "bbpw-code-editor", attributes: { contenteditable: "true", spellcheck: "false", "data-code-editor": block.id, tabindex: "0" } });
          appendHighlightedCode(editor, block.code || "");
          code.append(header, editor); wrapper.append(code);
        } else if (block.type === "table") {
          const wrap = element("div", { className: "bbpw-table-wrap" });
          const table = element("table", { className: "bbpw-table" });
          const body = element("tbody");
          const cells = block.cells?.length ? block.cells : [["", ""], ["", ""]];
          cells.forEach((row, rowIndex) => {
            const tr = element("tr");
            row.forEach((cell, columnIndex) => tr.append(element("td", { text: cell, attributes: { contenteditable: "true", "data-table-block": block.id, "data-table-row": rowIndex, "data-table-column": columnIndex } })));
            body.append(tr);
          });
          table.append(body);
          const actions = element("div", { className: "bbpw-table-actions" });
          actions.append(
            element("button", { className: "bbpw-action", text: "+ Row", attributes: { type: "button", "data-table-row-add": block.id } }),
            element("button", { className: "bbpw-action", text: "+ Column", attributes: { type: "button", "data-table-column-add": block.id } })
          );
          wrap.append(table, actions); wrapper.append(wrap);
        } else if (block.type === "callout") {
          const callout = element("div", { className: "bbpw-callout" });
          callout.append(element("input", { className: "bbpw-callout-icon", attributes: { value: block.icon || "💡", maxlength: "4", "aria-label": "Callout icon", "data-callout-icon": block.id } }), editable("div", block));
          wrapper.append(callout);
        } else if (block.type === "toggle") {
          const details = element("details", { className: "bbpw-toggle", attributes: { "data-toggle-block": block.id } });
          details.open = block.open !== false;
          details.append(
            element("summary", { text: block.summary || "Toggle", attributes: { contenteditable: "true", "data-toggle-summary": block.id } }),
            element("div", { className: "bbpw-toggle-body bbpw-editable", text: block.body || "", attributes: { contenteditable: "true", "data-toggle-body": block.id, "data-placeholder": "Hidden details…" } })
          );
          wrapper.append(details);
        } else if (block.type === "image") {
          const image = element("figure", { className: "bbpw-image" });
          if (block.src) image.append(element("img", { attributes: { src: block.src, alt: block.caption || "Workspace image", loading: "lazy" } }));
          image.append(
            element("input", { className: "bbpw-image-input", attributes: { type: "url", value: block.src || "", placeholder: "Paste an image URL", "aria-label": "Image URL", "data-image-src": block.id } }),
            element("div", { className: "bbpw-image-caption", text: block.caption || "", attributes: { contenteditable: "true", "data-image-caption": block.id, "data-placeholder": "Add a caption" } })
          );
          wrapper.append(image);
        } else if (block.type === "mermaid") {
          const mermaid = element("div", { className: "bbpw-mermaid" });
          const source = element("textarea", { attributes: { "aria-label": "Mermaid source", spellcheck: "false", "data-mermaid-source": block.id } });
          source.value = block.source || "";
          const preview = element("div", { className: "bbpw-mermaid-preview", attributes: { "data-mermaid-preview": block.id } });
          renderMermaidPreview(preview, source.value);
          mermaid.append(source, preview); wrapper.append(mermaid);
        }
        return wrapper;
      };

      const renderBreadcrumbs = (page, container) => {
        const chain = [];
        for (let item = page; item; item = pageById(item.parentId)) chain.unshift(item);
        chain.forEach((item, index) => {
          if (index) container.append(element("span", { text: "/", attributes: { "aria-hidden": "true" } }));
          container.append(element("button", { className: "bbpw-crumb", text: `${item.icon || "📄"} ${item.title}`, attributes: { type: "button", "data-page-open": item.id, title: item.title } }));
        });
      };
      const updateSaveStatus = () => {
        const label = state.root?.querySelector("[data-save-status]");
        if (!label) return;
        label.textContent = state.saveStatus === "saving" ? "Saving…" : state.saveStatus === "unsaved" ? "Not saved" : "Saved";
        label.setAttribute("data-status", state.saveStatus);
      };
      const renderEditor = () => {
        const pane = state.root?.querySelector("[data-bbpw-editor-pane]");
        if (!pane || !state.data) return;
        pane.replaceChildren();
        const page = currentPage();
        if (!page) {
          const empty = element("section", { className: "bbpw-empty" });
          const content = element("div");
          content.append(
            element("strong", { text: "Build your project knowledge base" }),
            element("p", { text: "Create architecture notes, decisions, API documentation, and TODOs beside the Codex tasks that use them." }),
            element("button", { className: "bbpw-action", text: "+ New Workspace page", attributes: { type: "button", "data-new-page": "" } })
          );
          empty.append(content); pane.append(empty); return;
        }
        if (!page.blocks.length) page.blocks.push(newBlock());
        const header = element("header", { className: "bbpw-editor-header" });
        const breadcrumbs = element("nav", { className: "bbpw-breadcrumbs", attributes: { "aria-label": "Page breadcrumbs" } });
        renderBreadcrumbs(page, breadcrumbs);
        header.append(
          breadcrumbs,
          element("span", { className: "bbpw-save-status", text: "Saved", attributes: { role: "status", "aria-live": "polite", "data-save-status": "" } }),
          element("button", { className: "bbpw-action", text: page.contextEnabled ? "✓ In context" : "+ Add to context", attributes: { type: "button", "aria-pressed": String(page.contextEnabled), "data-toggle-context": page.id, title: "Include this page when using Workspace Codex actions" } }),
          element("button", { className: "bbpw-action", text: "Ask Codex", attributes: { type: "button", "data-codex-page-action": "ask" } }),
          iconButton(`More actions for ${page.title}`, "•••", { "data-page-menu": page.id })
        );
        const documentNode = element("article", { className: "bbpw-document", attributes: { "data-page-document": page.id } });
        documentNode.append(
          element("button", { className: "bbpw-page-icon", text: page.icon || "📄", attributes: { type: "button", "aria-label": "Change page icon", "data-page-icon": page.id } }),
          element("input", { className: "bbpw-title", attributes: { type: "text", value: page.title, placeholder: "Untitled", "aria-label": "Page title", "data-bbpw-page-title": page.id, maxlength: "240" } })
        );
        const blocks = element("div", { className: "bbpw-blocks", attributes: { "data-blocks": page.id } });
        page.blocks.forEach((block, index) => blocks.append(renderBlock(block, index)));
        documentNode.append(blocks);
        pane.append(header, documentNode);
        updateSaveStatus();
      };
      const renderWorkspace = () => {
        if (!state.root?.isConnected || !state.data) return;
        renderSidebar();
        renderEditor();
      };

      const findBlock = (id) => currentPage()?.blocks.find((block) => block.id === id) || null;
      const blockIndex = (id) => currentPage()?.blocks.findIndex((block) => block.id === id) ?? -1;
      const focusBlock = (id, end = true) => ownedTimeout(() => {
        const target = state.root?.querySelector(`[data-block-editable='${cssEscape(id)}'], [data-code-editor='${cssEscape(id)}'], [data-mermaid-source='${cssEscape(id)}']`);
        target?.focus();
        if (end && target?.isContentEditable) {
          const range = document.createRange();
          range.selectNodeContents(target); range.collapse(false);
          const selection = document.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
        }
      }, 0);
      const insertBlockAfter = (afterId, type = "text", options = {}) => {
        const page = currentPage();
        if (!page) return null;
        recordHistory(page);
        const index = Math.max(-1, blockIndex(afterId));
        const block = newBlock(type, options.value || "");
        page.blocks.splice(index + 1, 0, block);
        touchPage(page);
        renderEditor();
        focusBlock(block.id);
        return block;
      };
      const changeBlockType = (id, type) => {
        const page = currentPage(); const block = findBlock(id);
        if (!page || !block) return false;
        if (type === "file") {
          showPathReferencePopup("file", { blockId: id, replaceBlock: true });
          return true;
        } else {
          const value = inlineText(block.html).replace(/^\/[^\s]*\s*/, "");
          const replacement = newBlock(type, value);
          replacement.id = block.id;
          Object.assign(block, replacement);
        }
        touchPage(page); closePopup(); renderEditor(); focusBlock(block.id); return true;
      };
      const removeBlock = (id) => {
        const page = currentPage(); const index = blockIndex(id);
        if (!page || index < 0) return false;
        recordHistory(page);
        if (page.blocks.length === 1) page.blocks[0] = newBlock();
        else page.blocks.splice(index, 1);
        touchPage(page); renderEditor(); focusBlock(page.blocks[Math.max(0, index - 1)].id); return true;
      };
      const reorderBlock = (sourceId, targetId, after) => {
        const page = currentPage();
        const sourceIndex = blockIndex(sourceId); let targetIndex = blockIndex(targetId);
        if (!page || sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
        recordHistory(page);
        const [block] = page.blocks.splice(sourceIndex, 1);
        targetIndex = blockIndex(targetId) + (after ? 1 : 0);
        page.blocks.splice(targetIndex, 0, block);
        touchPage(page); renderEditor(); return true;
      };

      const caretOffset = (editableNode) => {
        const selection = document.getSelection();
        if (!selection?.rangeCount || !editableNode.contains(selection.anchorNode)) return editableNode.textContent.length;
        const range = selection.getRangeAt(0).cloneRange();
        range.selectNodeContents(editableNode);
        range.setEnd(selection.anchorNode, selection.anchorOffset);
        return range.toString().length;
      };
      const textRange = (root, start, end) => {
        const range = document.createRange();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let offset = 0; let startNode = root; let startOffset = 0; let endNode = root; let endOffset = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const next = offset + node.data.length;
          if (start >= offset && start <= next) { startNode = node; startOffset = start - offset; }
          if (end >= offset && end <= next) { endNode = node; endOffset = end - offset; break; }
          offset = next;
        }
        try { range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset); } catch { range.selectNodeContents(root); range.collapse(false); }
        return range;
      };
      const syncInlineEditable = (editableNode) => {
        const page = currentPage(); const block = findBlock(editableNode?.getAttribute("data-block-editable"));
        if (!page || !block || !editableNode) return;
        block.html = sanitizeInline(editableNode.innerHTML);
        touchPage(page);
      };
      const commandMatches = (query) => {
        const needle = normalizeText(query).toLocaleLowerCase();
        return COMMANDS.filter((command) => !needle || `${command.label} ${command.type} ${command.group}`.toLocaleLowerCase().includes(needle));
      };
      const renderCommandPopup = () => {
        const context = state.commandContext;
        if (!context || context.kind !== "slash") return;
        const matches = commandMatches(context.query);
        context.index = Math.max(0, Math.min(context.index || 0, Math.max(0, matches.length - 1)));
        const popup = element("div", { className: "bbpw-popup", attributes: { role: "listbox", "aria-label": "Insert a block" } });
        let group = "";
        matches.forEach((command, index) => {
          if (command.group !== group) { group = command.group; popup.append(element("div", { className: "bbpw-popup-heading", text: group })); }
          const button = element("button", { className: "bbpw-menu-item", attributes: { type: "button", role: "option", "data-command-type": command.type, "data-selected": String(index === context.index), "aria-selected": String(index === context.index) } });
          const icon = element("span", { text: command.type === "code" ? "</>" : command.type === "mermaid" ? "◇" : command.type === "checklist" ? "☑" : command.type === "table" ? "▦" : command.type === "image" ? "▧" : "¶" });
          const copyNode = element("span", { className: "bbpw-menu-item-copy" });
          copyNode.append(element("strong", { text: command.label }), element("span", { text: command.hint }));
          button.append(icon, copyNode); popup.append(button);
        });
        if (!matches.length) popup.append(element("div", { className: "bbpw-popup-heading", text: "No matching blocks" }));
        const anchor = state.root?.querySelector(`[data-block-id='${cssEscape(context.blockId)}']`);
        placePopup(popup, anchor, { width: 300 });
        state.commandContext = context;
      };
      const openSlashMenu = (blockId, query = "") => {
        state.commandContext = { kind: "slash", blockId, query, index: 0 };
        renderCommandPopup();
      };

      const kanbanCards = () => {
        try {
          const stored = JSON.parse(preferenceStorage.getItem(KANBAN_STORAGE_KEY) || "{}");
          return Array.isArray(stored.cards) ? stored.cards.filter((card) => !card.hidden) : [];
        } catch (_) { return []; }
      };
      const referenceOptions = (query) => {
        const needle = normalizeText(query).toLocaleLowerCase();
        const base = [
          { kind: "file", value: "", label: "File", hint: "Reference a project file", icon: "📄" },
          { kind: "folder", value: "", label: "Folder", hint: "Reference a project folder", icon: "📁" }
        ];
        const pages = (state.data?.pages || []).map((page) => ({ kind: "page", value: page.id, label: page.title, hint: "Workspace page", icon: page.icon || "📄" }));
        const cards = kanbanCards().map((card) => ({ kind: "kanban", value: card.id, label: card.title || card.id, hint: "Kanban card", icon: "▥" }));
        return [...base, ...pages, ...cards].filter((option) => !needle || `${option.kind} ${option.label} ${option.hint}`.toLocaleLowerCase().includes(needle)).slice(0, 24);
      };
      const renderReferencePopup = () => {
        const context = state.commandContext;
        if (!context || context.kind !== "reference") return;
        const options = referenceOptions(context.query);
        context.options = options;
        context.index = Math.max(0, Math.min(context.index || 0, Math.max(0, options.length - 1)));
        const popup = element("div", { className: "bbpw-popup", attributes: { role: "listbox", "aria-label": "Insert a project reference" } });
        popup.append(element("div", { className: "bbpw-popup-heading", text: "Project references" }));
        options.forEach((option, index) => {
          const button = element("button", { className: "bbpw-menu-item", attributes: { type: "button", role: "option", "data-reference-index": index, "data-selected": String(index === context.index), "aria-selected": String(index === context.index) } });
          const copyNode = element("span", { className: "bbpw-menu-item-copy" });
          copyNode.append(element("strong", { text: `${option.icon} ${option.label}` }), element("span", { text: option.hint }));
          button.append(copyNode); popup.append(button);
        });
        if (!options.length) popup.append(element("div", { className: "bbpw-popup-heading", text: "No matching references" }));
        const anchor = state.root?.querySelector(`[data-block-id='${cssEscape(context.blockId)}']`);
        placePopup(popup, anchor, { width: 310 });
        state.commandContext = context;
      };
      const openReferenceMenu = (blockId, editableNode, query, triggerStart, caret) => {
        state.commandContext = { kind: "reference", blockId, editableNode, query, triggerStart, caret, index: 0, options: [] };
        renderReferencePopup();
      };
      const referenceHtml = (kind, value, label = value) => `<a href="#" data-workspace-ref="${escapeHtml(kind)}" data-ref-value="${escapeHtml(value)}" title="Open ${escapeHtml(kind)} reference">@${escapeHtml(kind)} ${escapeHtml(label)}</a>&nbsp;`;
      const showPathReferencePopup = (kind, options = {}) => {
        const previousContext = options.referenceContext || state.commandContext;
        const popup = element("div", { className: "bbpw-popup", attributes: { role: "dialog", "aria-label": `Insert project ${kind}` } });
        popup.append(element("div", { className: "bbpw-popup-heading", text: kind === "file" ? "Project file path" : "Project folder path" }));
        const form = element("div", { className: "bbpw-reference-form" });
        const input = element("input", { attributes: {
          type: "text", value: options.value || (kind === "file" ? "src/" : "src"),
          placeholder: kind === "file" ? "src/auth.ts" : "src/components", "aria-label": `Project ${kind} path`, "data-reference-path-input": ""
        } });
        form.append(input, element("button", { className: "bbpw-action", text: "Insert", attributes: { type: "button", "data-reference-path-confirm": "" } }));
        popup.append(form);
        const anchor = state.root?.querySelector(`[data-block-id='${cssEscape(options.blockId || previousContext?.blockId || "")}']`);
        placePopup(popup, anchor, { width: 360 });
        state.commandContext = {
          kind: "path", referenceKind: kind, blockId: options.blockId || previousContext?.blockId,
          replaceBlock: Boolean(options.replaceBlock), referenceContext: previousContext
        };
        ownedTimeout(() => { input.focus(); input.select(); }, 0);
      };
      const confirmPathReference = () => {
        const context = state.commandContext;
        const input = state.popup?.querySelector("[data-reference-path-input]");
        const value = String(input?.value || "").trim();
        if (!context || context.kind !== "path" || !value) return false;
        if (context.replaceBlock) {
          const page = currentPage(); const block = findBlock(context.blockId);
          if (!page || !block) return false;
          recordHistory(page); block.html = referenceHtml(context.referenceKind, value); touchPage(page);
          closePopup(); renderEditor(); focusBlock(block.id); return true;
        }
        const referenceContext = context.referenceContext;
        state.commandContext = referenceContext;
        return insertReference({ kind: context.referenceKind, value, label: value });
      };
      const insertReference = (option) => {
        const context = state.commandContext;
        const editableNode = context?.editableNode;
        if (!context || context.kind !== "reference" || !editableNode?.isConnected || !option) return false;
        let value = option.value; let label = option.label;
        if ((option.kind === "file" || option.kind === "folder") && !value) {
          showPathReferencePopup(option.kind, { blockId: context.blockId, referenceContext: context });
          return true;
        }
        const range = textRange(editableNode, context.triggerStart, context.caret);
        const selection = document.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
        const html = referenceHtml(option.kind, value, label);
        let inserted = false;
        try { inserted = Boolean(document.execCommand?.("insertHTML", false, html)); } catch (_) {}
        if (!inserted) {
          range.deleteContents();
          const template = document.createElement("template"); template.innerHTML = html; range.insertNode(template.content);
        }
        syncInlineEditable(editableNode); closePopup(); return true;
      };
      const detectInlineMenu = (editableNode) => {
        const blockId = editableNode.getAttribute("data-block-editable");
        const text = editableNode.textContent || ""; const caret = caretOffset(editableNode);
        const before = text.slice(0, caret);
        const slash = before.match(/^\/([^\s]*)$/);
        if (slash) { openSlashMenu(blockId, slash[1]); return; }
        const reference = before.match(/(?:^|\s)@([^\s]*)$/);
        if (reference) {
          const triggerStart = caret - reference[0].trimStart().length;
          openReferenceMenu(blockId, editableNode, reference[1], triggerStart, caret); return;
        }
        if (state.commandContext?.blockId === blockId) closePopup();
      };

      const showBlockMenu = (block, anchor) => {
        const popup = element("div", { className: "bbpw-popup", attributes: { role: "menu", "aria-label": "Block actions" } });
        const types = ["text", "h1", "h2", "h3", "bullet", "numbered", "checklist", "quote", "callout", "code"];
        popup.append(element("div", { className: "bbpw-popup-heading", text: "Turn into" }));
        for (const type of types) {
          const command = COMMANDS.find((item) => item.type === type);
          popup.append(element("button", { className: "bbpw-menu-item", text: command?.label || type, attributes: { type: "button", role: "menuitem", "data-turn-block": type, "data-block-id": block.id } }));
        }
        popup.append(element("div", { className: "bbpw-popup-heading", text: "Actions" }));
        if (block.type === "checklist") popup.append(element("button", { className: "bbpw-menu-item", text: "Create Kanban task", attributes: { type: "button", role: "menuitem", "data-kanban-block": block.id } }));
        popup.append(
          element("button", { className: "bbpw-menu-item", text: "Ask Codex about this", attributes: { type: "button", role: "menuitem", "data-codex-block": block.id } }),
          element("button", { className: "bbpw-menu-item", text: "Delete block", attributes: { type: "button", role: "menuitem", "data-delete-block": block.id } })
        );
        placePopup(popup, anchor, { width: 240 });
      };
      const showQuickSearch = (initial = "") => {
        if (!state.root || state.root.hidden) openWorkspace();
        closePopup();
        const overlay = element("div", { className: "bbpw-quick-search", attributes: { "data-quick-overlay": "", role: "dialog", "aria-modal": "true", "aria-label": "Search Workspace" } });
        const card = element("div", { className: "bbpw-quick-card" });
        const input = element("input", { attributes: { type: "search", value: initial, placeholder: "Search pages, headings, code, and references…", "aria-label": "Quick page search", "data-quick-input": "" } });
        const results = element("div", { className: "bbpw-quick-results", attributes: { "data-quick-results": "" } });
        card.append(input, results); overlay.append(card); state.root.append(overlay);
        renderSearchResults(initial, results);
        ownedTimeout(() => input.focus(), 0);
      };

      const contextMarkdown = (includePage = null) => {
        const pages = (state.data?.pages || []).filter((page) => page.contextEnabled || page === includePage);
        const chunks = pages.map((page) => `## Workspace: ${page.title}\n\n${pageToMarkdown(page)}`);
        for (const page of state.data?.pages || []) if (page.contextSnippets?.length) chunks.push(`## Saved context from ${page.title}\n\n${page.contextSnippets.join("\n\n")}`);
        return chunks.join("\n\n---\n\n").slice(0, 60000);
      };
      const findComposer = () => document.querySelector([
        "[data-codex-composer][contenteditable='true']", "[data-codex-composer] textarea",
        "[data-codex-composer] [contenteditable='true']", "textarea[aria-label*='message' i]",
        "[contenteditable='true'][aria-label*='message' i]"
      ].join(", "));
      const setComposerValue = (composer, value) => {
        const isTextControl = composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement;
        const previous = isTextControl ? composer.value : composer.textContent;
        const next = previous?.trim() ? `${previous.trimEnd()}\n\n${value}` : value;
        state.composerRestore = { composer, previous, value: next, isTextControl };
        composer.focus({ preventScroll: true });
        if (isTextControl) {
          const prototype = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
          if (setter) setter.call(composer, next); else composer.value = next;
        } else {
          const selection = document.getSelection(); const range = document.createRange();
          range.selectNodeContents(composer); selection?.removeAllRanges(); selection?.addRange(range);
          let inserted = false;
          try { inserted = Boolean(document.execCommand?.("insertText", false, next)); } catch (_) {}
          if (!inserted) composer.textContent = next;
        }
        composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: next }));
        composer.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const findNewChatControl = () => {
        const navigation = findProjectNavigation();
        return navigation && [...navigation.querySelectorAll("button, a[href]")].find((node) => /new\s+(task|chat|thread)/i.test(`${node.getAttribute("aria-label") || ""} ${node.textContent || ""}`));
      };
      const writeToComposer = (value, attempt = 0) => {
        const composer = findComposer();
        if (composer) { setComposerValue(composer, value); return true; }
        if (attempt === 0) findNewChatControl()?.click();
        if (attempt < 24) ownedTimeout(() => writeToComposer(value, attempt + 1), 125);
        return false;
      };
      const runCodexAction = (action, textValue = "", options = {}) => {
        const page = currentPage();
        const selected = normalizeText(textValue) || (options.pageOnly ? pageToMarkdown(page) : "");
        const prompts = {
          ask: selected ? `Use the following Workspace material to help with my next request:\n\n${selected}` : `Use the current Workspace page “${page?.title || "Untitled"}” as context for my next request.`,
          explain: `Explain this clearly in the context of the current repository:\n\n${selected}`,
          improve: `Improve the writing below while preserving its technical meaning. Return a polished replacement:\n\n${selected}`,
          implement: `Implement the following Workspace selection in the current repository. Inspect the relevant code first and verify the result:\n\n${selected}`,
          tasks: `Turn the following items into a concise implementation plan with separate actionable tasks:\n\n${selected}`
        };
        const workspaceContext = contextMarkdown(page?.contextEnabled ? null : undefined);
        const promptValue = [prompts[action] || prompts.ask, workspaceContext ? `\n\nWorkspace context:\n\n${workspaceContext}` : ""].join("").slice(0, 70000);
        closeWorkspace({ restoreFocus: false });
        ownedTimeout(() => writeToComposer(promptValue), 0);
      };
      const addSelectionToContext = (textValue) => {
        const page = currentPage(); const value = normalizeText(textValue);
        if (!page || !value) return false;
        page.contextEnabled = true;
        page.contextSnippets = [...(page.contextSnippets || []), value].slice(-20);
        touchPage(page); closePopup(); renderEditor(); return true;
      };
      const createKanbanTasks = (titles) => {
        const cleanTitles = [...new Set((titles || []).map((title) => normalizeText(title).replace(/^[-*]\s*(?:\[[ xX]\]\s*)?/, "")).filter(Boolean))].slice(0, 30);
        if (!cleanTitles.length) return [];
        let created = [];
        const detail = {
          project: state.project?.label || "Current project", titles: cleanTitles,
          respond(cards) { if (Array.isArray(cards)) created = cards; }
        };
        document.dispatchEvent(new CustomEvent(KANBAN_CREATE_EVENT, { detail }));
        if (created.length) {
          state.saveStatus = "saved"; updateSaveStatus(); closePopup(); return created;
        }
        const promptValue = `Create separate project tasks for these Workspace TODOs so they appear in Kanban:\n\n${cleanTitles.map((title) => `- ${title}`).join("\n")}`;
        closeWorkspace({ restoreFocus: false }); ownedTimeout(() => writeToComposer(promptValue), 0); return [];
      };
      const openKanbanReference = (value) => {
        const card = kanbanCards().find((candidate) => candidate.id === value || normalizeText(candidate.title).includes(normalizeText(value)));
        if (card?.href) {
          const threadId = card.href.startsWith("thread:") ? card.href.slice(7) : "";
          const native = threadId && document.querySelector(`[data-app-action-sidebar-thread-id='${cssEscape(threadId)}']`);
          if (native) { closeWorkspace({ restoreFocus: false }); native.click(); return true; }
        }
        const launcher = document.querySelector("[data-bettercodex-project-kanban-launcher]");
        if (launcher) {
          closeWorkspace({ restoreFocus: false }); launcher.click();
          ownedTimeout(() => document.querySelector(`[data-card-id='${cssEscape(card?.id || value)}']`)?.click(), 0);
          return true;
        }
        return false;
      };
      const openReference = (anchor) => {
        const kind = anchor.getAttribute("data-workspace-ref"); const value = anchor.getAttribute("data-ref-value") || "";
        if (kind === "page") return openPage(value);
        if (kind === "kanban") return openKanbanReference(value);
        const detail = {
          project: state.project ? { id: state.project.id, label: state.project.label } : null,
          kind, path: value, handled: false,
          respond(result) { this.handled = result !== false; }
        };
        document.dispatchEvent(new CustomEvent("bettercodex:project-resource-open", { detail }));
        if (detail.handled) return true;
        const native = [...document.querySelectorAll("a[href], button[title]")].find((node) => !node.closest(`[${ROOT_ATTRIBUTE}]`) && normalizeText(`${node.getAttribute("href") || ""} ${node.getAttribute("title") || ""} ${node.textContent || ""}`).includes(normalizeText(value)));
        if (native) { closeWorkspace({ restoreFocus: false }); native.click(); return true; }
        const popup = element("div", { className: "bbpw-popup", attributes: { role: "menu", "aria-label": `Open project ${kind}` } });
        popup.append(
          element("div", { className: "bbpw-popup-heading", text: kind === "file" ? "Project file" : "Project folder" }),
          element("div", { className: "bbpw-reference-path", text: value, attributes: { title: value } }),
          element("button", { className: "bbpw-menu-item", text: "Open with Codex", attributes: { type: "button", role: "menuitem", "data-resource-action": "codex", "data-resource-kind": kind, "data-resource-value": value } }),
          element("button", { className: "bbpw-menu-item", text: "Copy path", attributes: { type: "button", role: "menuitem", "data-resource-action": "copy", "data-resource-kind": kind, "data-resource-value": value } })
        );
        placePopup(popup, anchor, { width: 300 });
        state.commandContext = { kind: "resource", resourceKind: kind, value };
        return true;
      };

      const captureSelection = () => {
        const selection = document.getSelection();
        const textValue = String(selection?.toString() || "").trim();
        if (!normalizeText(textValue) || !selection.rangeCount) return false;
        const range = selection.getRangeAt(0);
        const editableNode = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
        const blockNode = editableNode?.closest?.("[data-block-id]");
        if (!blockNode?.closest(`[${ROOT_ATTRIBUTE}]`)) return false;
        state.selectedText = textValue;
        state.selectedBlockId = blockNode.getAttribute("data-block-id");
        state.selectedRange = range.cloneRange();
        return true;
      };
      const restoreSelection = () => {
        if (!state.selectedRange) return false;
        const selection = document.getSelection();
        try { selection.removeAllRanges(); selection.addRange(state.selectedRange.cloneRange()); return true; }
        catch (_) { return false; }
      };
      const showSelectionToolbar = () => {
        state.root?.querySelector(".bbpw-selection-toolbar")?.remove();
        if (!state.selectedRange || !normalizeText(state.selectedText)) return;
        const blockNode = state.root?.querySelector(`[data-block-id='${cssEscape(state.selectedBlockId)}']`);
        if (!blockNode) return;
        const toolbar = element("div", { className: "bbpw-selection-toolbar", attributes: { role: "toolbar", "aria-label": "Text and Codex actions" } });
        const actions = [
          ["bold", "B", "Bold"], ["italic", "I", "Italic"], ["strikeThrough", "S", "Strikethrough"], ["code", "</>", "Inline code"], ["link", "Link", "Add link"],
          ["ask", "Ask Codex", "Ask Codex"], ["explain", "Explain", "Explain"], ["improve", "Improve", "Improve writing"], ["implement", "Implement", "Implement this"], ["tasks", "Tasks", "Create tasks"], ["context", "+ Context", "Add to context"]
        ];
        for (const [action, label, title] of actions) toolbar.append(element("button", { text: label, attributes: { type: "button", title, "aria-label": title, "data-selection-action": action } }));
        state.root.append(toolbar);
        const rootRect = state.root.getBoundingClientRect();
        const rect = typeof state.selectedRange.getBoundingClientRect === "function" ? state.selectedRange.getBoundingClientRect() : blockNode.getBoundingClientRect();
        toolbar.style.left = `${Math.max(8, Math.min(rootRect.width - 500, rect.left - rootRect.left))}px`;
        toolbar.style.top = `${Math.max(8, rect.top - rootRect.top - 42)}px`;
      };

      const handlePageAction = (action, page) => {
        if (!page) return;
        if (action === "subpage") { closePopup(); createPage(page.id); }
        else if (action === "rename") { closePopup(); openPage(page.id, { focusTitle: true }); }
        else if (action === "duplicate") duplicatePage(page.id);
        else if (action === "favorite") { page.favorite = !page.favorite; touchPage(page); closePopup(); renderWorkspace(); }
        else if (action === "context") { page.contextEnabled = !page.contextEnabled; touchPage(page); closePopup(); renderWorkspace(); }
        else if (action === "copy-link") { copyText(pageLink(page)); closePopup(); }
        else if (action === "todos") createKanbanTasks(page.blocks.filter((block) => block.type === "checklist" && !block.checked).map(blockText));
        else if (action === "delete") { closePopup(); deletePage(page.id); }
      };
      const applyMarkdownShortcut = (block, editableNode) => {
        if (block.type !== "text") return false;
        const text = editableNode.textContent || "";
        const shortcuts = [
          [/^###\s/, "h3"], [/^##\s/, "h2"], [/^#\s/, "h1"], [/^(?:-|\*)\s/, "bullet"],
          [/^1\.\s/, "numbered"], [/^(?:\[\]|\[ \])\s/, "checklist"], [/^>\s/, "quote"], [/^```$/, "code"]
        ];
        const shortcut = shortcuts.find(([pattern]) => pattern.test(text));
        if (!shortcut) return false;
        recordHistory(currentPage());
        const value = text.replace(shortcut[0], "");
        const replacement = newBlock(shortcut[1], value); replacement.id = block.id; Object.assign(block, replacement);
        touchPage(currentPage()); renderEditor(); focusBlock(block.id); return true;
      };
      const splitBlock = (editableNode) => {
        const page = currentPage(); const block = findBlock(editableNode.getAttribute("data-block-editable"));
        if (!page || !block) return false;
        recordHistory(page);
        const text = editableNode.textContent || ""; const offset = caretOffset(editableNode);
        block.html = escapeHtml(text.slice(0, offset));
        const nextType = ["bullet", "numbered", "checklist"].includes(block.type) ? block.type : "text";
        const next = newBlock(nextType, text.slice(offset));
        page.blocks.splice(blockIndex(block.id) + 1, 0, next);
        touchPage(page); renderEditor(); focusBlock(next.id, false); return true;
      };
      const selectionAction = (action) => {
        const editableNode = state.root?.querySelector(`[data-block-editable='${cssEscape(state.selectedBlockId)}']`);
        restoreSelection();
        const wrapSelection = (tag) => {
          if (!editableNode) return false;
          const plainText = editableNode.textContent || "";
          const start = plainText.indexOf(state.selectedText);
          let range = state.selectedRange?.cloneRange() || null;
          if (!range || !editableNode.contains(range.commonAncestorContainer)) range = start >= 0 ? textRange(editableNode, start, start + state.selectedText.length) : null;
          if (!range) return false;
          const wrapper = element(tag);
          try {
            wrapper.append(range.extractContents()); range.insertNode(wrapper);
            if (!editableNode.querySelector(tag) && start >= 0) {
              range = textRange(editableNode, start, start + state.selectedText.length);
              wrapper.replaceChildren(range.extractContents()); range.insertNode(wrapper);
            }
            if (!editableNode.querySelector(tag) && normalizeText(plainText) === normalizeText(state.selectedText)) editableNode.innerHTML = `<${tag}>${escapeHtml(state.selectedText)}</${tag}>`;
            const selection = document.getSelection(); selection?.removeAllRanges(); const next = document.createRange(); next.selectNodeContents(editableNode.querySelector(tag) || editableNode); selection?.addRange(next);
            return Boolean(editableNode.querySelector(tag));
          } catch (_) {
            if (normalizeText(plainText) !== normalizeText(state.selectedText)) return false;
            editableNode.innerHTML = `<${tag}>${escapeHtml(state.selectedText)}</${tag}>`;
            return true;
          }
        };
        if (["bold", "italic", "strikeThrough"].includes(action)) {
          let applied = false;
          try { applied = Boolean(document.execCommand?.(action, false)); } catch (_) {}
          const tag = action === "bold" ? "strong" : action === "italic" ? "em" : "del";
          if (!applied || !editableNode?.querySelector(tag)) { restoreSelection(); wrapSelection(tag); }
          syncInlineEditable(editableNode); showSelectionToolbar(); return;
        }
        if (action === "code") {
          let applied = false;
          try { applied = Boolean(document.execCommand?.("insertHTML", false, `<code>${escapeHtml(state.selectedText)}</code>`)); } catch (_) {}
          if (!applied || !editableNode?.querySelector("code")) { restoreSelection(); wrapSelection("code"); }
          syncInlineEditable(editableNode); return;
        }
        if (action === "link") {
          const range = state.selectedRange?.cloneRange() || null;
          if (!editableNode || !range) return;
          const popup = element("div", { className: "bbpw-popup", attributes: { role: "dialog", "aria-label": "Add link" } });
          popup.append(element("div", { className: "bbpw-popup-heading", text: "Link URL" }));
          const form = element("div", { className: "bbpw-reference-form" });
          const input = element("input", { attributes: { type: "url", value: "https://", placeholder: "https://example.com", "aria-label": "Link URL", "data-link-url-input": "" } });
          form.append(input, element("button", { className: "bbpw-action", text: "Add link", attributes: { type: "button", "data-link-url-confirm": "" } }));
          popup.append(form);
          const anchor = state.root?.querySelector(`[data-block-id='${cssEscape(state.selectedBlockId)}']`);
          placePopup(popup, anchor, { width: 360 });
          state.commandContext = { kind: "link", editableNode, range };
          ownedTimeout(() => { input.focus(); input.select(); }, 0);
          return;
        }
        if (action === "context") addSelectionToContext(state.selectedText);
        else if (action === "tasks") createKanbanTasks(state.selectedText.split(/\n+/));
        else runCodexAction(action, state.selectedText);
      };
      const confirmLink = () => {
        const context = state.commandContext;
        const url = String(state.popup?.querySelector("[data-link-url-input]")?.value || "").trim();
        if (!context || context.kind !== "link" || !context.editableNode?.isConnected || !/^(https?:|mailto:)/i.test(url)) return false;
        const selection = document.getSelection(); selection?.removeAllRanges(); selection?.addRange(context.range);
        let inserted = false;
        try { inserted = Boolean(document.execCommand?.("createLink", false, url)); } catch (_) {}
        if (!inserted) {
          const link = element("a", { attributes: { href: url } });
          try { link.append(context.range.extractContents()); context.range.insertNode(link); } catch (_) { return false; }
        }
        syncInlineEditable(context.editableNode); closePopup(); return true;
      };

      const bindRootEvents = () => {
        const root = state.root;
        if (!root) return;
        root.addEventListener("click", (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          const reference = target.closest("a[data-workspace-ref]");
          if (reference) { event.preventDefault(); event.stopPropagation(); openReference(reference); return; }
          if (target.matches("[data-quick-overlay]")) { target.remove(); return; }
          const open = target.closest("[data-page-open]");
          if (open) { openPage(open.getAttribute("data-page-open")); root.querySelector("[data-quick-overlay]")?.remove(); return; }
          const pageMenu = target.closest("[data-page-menu]");
          if (pageMenu) { showPageMenu(pageById(pageMenu.getAttribute("data-page-menu")), pageMenu); return; }
          const toggle = target.closest("[data-page-toggle]");
          if (toggle) {
            const id = toggle.getAttribute("data-page-toggle");
            state.data.expanded = state.data.expanded.includes(id) ? state.data.expanded.filter((value) => value !== id) : [...state.data.expanded, id];
            scheduleSave(); renderSidebar(); return;
          }
          if (target.closest("[data-new-page]")) { createPage(null); return; }
          if (target.closest("[data-restore-page]")) { restoreLastDeleted(); return; }
          if (target.closest("[data-sidebar-toggle]")) { state.data.ui.sidebarCollapsed = !state.data.ui.sidebarCollapsed; scheduleSave(); renderSidebar(); return; }
          if (target.closest("[data-quick-search]")) { showQuickSearch(); return; }
          const pageIcon = target.closest("[data-page-icon]");
          if (pageIcon) { showIconMenu(pageById(pageIcon.getAttribute("data-page-icon")), pageIcon); return; }
          const icon = target.closest("[data-icon]");
          if (icon) {
            const page = currentPage(); if (page) { recordHistory(page); page.icon = icon.getAttribute("data-icon"); touchPage(page); closePopup(); renderWorkspace(); }
            return;
          }
          const pageAction = target.closest("[data-page-action]");
          if (pageAction) { handlePageAction(pageAction.getAttribute("data-page-action"), pageById(pageAction.getAttribute("data-page-id"))); return; }
          const context = target.closest("[data-toggle-context]");
          if (context) { const page = pageById(context.getAttribute("data-toggle-context")); page.contextEnabled = !page.contextEnabled; touchPage(page); renderWorkspace(); return; }
          const pageCodex = target.closest("[data-codex-page-action]");
          if (pageCodex) { runCodexAction(pageCodex.getAttribute("data-codex-page-action"), pageToMarkdown(currentPage()), { pageOnly: true }); return; }
          const add = target.closest("[data-block-add]");
          if (add) { const block = insertBlockAfter(add.getAttribute("data-block-add")); if (block) ownedTimeout(() => openSlashMenu(block.id), 0); return; }
          const blockMenu = target.closest("[data-block-menu]");
          if (blockMenu) { showBlockMenu(findBlock(blockMenu.getAttribute("data-block-menu")), blockMenu); return; }
          const command = target.closest("[data-command-type]");
          if (command) { changeBlockType(state.commandContext?.blockId, command.getAttribute("data-command-type")); return; }
          const referenceOption = target.closest("[data-reference-index]");
          if (referenceOption) { insertReference(state.commandContext?.options?.[Number(referenceOption.getAttribute("data-reference-index"))]); return; }
          if (target.closest("[data-reference-path-confirm]")) { confirmPathReference(); return; }
          if (target.closest("[data-link-url-confirm]")) { confirmLink(); return; }
          const resourceAction = target.closest("[data-resource-action]");
          if (resourceAction) {
            const action = resourceAction.getAttribute("data-resource-action");
            const kind = resourceAction.getAttribute("data-resource-kind") || "file";
            const value = resourceAction.getAttribute("data-resource-value") || "";
            if (action === "copy") { copyText(value); closePopup(); }
            else { closePopup(); closeWorkspace({ restoreFocus: false }); ownedTimeout(() => writeToComposer(`Open and inspect the project ${kind} @${kind} ${value}`), 0); }
            return;
          }
          const turn = target.closest("[data-turn-block]");
          if (turn) { changeBlockType(turn.getAttribute("data-block-id"), turn.getAttribute("data-turn-block")); return; }
          const deleteBlockButton = target.closest("[data-delete-block]");
          if (deleteBlockButton) { closePopup(); removeBlock(deleteBlockButton.getAttribute("data-delete-block")); return; }
          const codexBlock = target.closest("[data-codex-block]");
          if (codexBlock) { runCodexAction("ask", blockText(findBlock(codexBlock.getAttribute("data-codex-block")))); return; }
          const kanbanBlock = target.closest("[data-kanban-block]");
          if (kanbanBlock) { createKanbanTasks([blockText(findBlock(kanbanBlock.getAttribute("data-kanban-block")))]); return; }
          const rowAdd = target.closest("[data-table-row-add]");
          if (rowAdd) {
            const block = findBlock(rowAdd.getAttribute("data-table-row-add")); recordHistory(currentPage());
            block.cells.push(Array.from({ length: block.cells[0]?.length || 2 }, () => "")); touchPage(currentPage()); renderEditor(); return;
          }
          const columnAdd = target.closest("[data-table-column-add]");
          if (columnAdd) {
            const block = findBlock(columnAdd.getAttribute("data-table-column-add")); recordHistory(currentPage());
            block.cells.forEach((row) => row.push("")); touchPage(currentPage()); renderEditor(); return;
          }
          const selected = target.closest("[data-selection-action]");
          if (selected) { event.preventDefault(); selectionAction(selected.getAttribute("data-selection-action")); return; }
          if (!target.closest(".bbpw-popup, .bbpw-selection-toolbar")) closePopup();
        }, { signal: state.abortController.signal });

        root.addEventListener("input", (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          if (target.matches("[data-sidebar-search]")) {
            const navigation = root.querySelector("[data-sidebar-navigation]"); const results = root.querySelector("[data-sidebar-search-results]");
            const query = target.value; navigation.hidden = Boolean(query); results.hidden = !query; renderSearchResults(query, results); return;
          }
          if (target.matches("[data-quick-input]")) { renderSearchResults(target.value, root.querySelector("[data-quick-results]")); return; }
          const page = currentPage(); if (!page) return;
          if (target.matches("[data-bbpw-page-title]")) { recordHistory(page, { typing: true }); page.title = target.value.slice(0, 240) || "Untitled"; touchPage(page); renderSidebar(); return; }
          if (target.matches("[data-block-editable]")) {
            const block = findBlock(target.getAttribute("data-block-editable")); if (!block) return;
            recordHistory(page, { typing: true }); block.html = sanitizeInline(target.innerHTML); touchPage(page);
            if (!applyMarkdownShortcut(block, target)) detectInlineMenu(target); return;
          }
          if (target.matches("[data-code-editor]")) { const block = findBlock(target.getAttribute("data-code-editor")); recordHistory(page, { typing: true }); block.code = target.textContent || ""; touchPage(page); return; }
          if (target.matches("[data-code-language]")) { findBlock(target.getAttribute("data-code-language")).language = target.value.slice(0, 32); touchPage(page); return; }
          if (target.matches("[data-table-block]")) { const block = findBlock(target.getAttribute("data-table-block")); recordHistory(page, { typing: true }); block.cells[Number(target.getAttribute("data-table-row"))][Number(target.getAttribute("data-table-column"))] = target.textContent || ""; touchPage(page); return; }
          if (target.matches("[data-callout-icon]")) { findBlock(target.getAttribute("data-callout-icon")).icon = target.value.slice(0, 8); touchPage(page); return; }
          if (target.matches("[data-toggle-summary]")) { findBlock(target.getAttribute("data-toggle-summary")).summary = target.textContent || ""; touchPage(page); return; }
          if (target.matches("[data-toggle-body]")) { findBlock(target.getAttribute("data-toggle-body")).body = target.textContent || ""; touchPage(page); return; }
          if (target.matches("[data-image-src]")) { findBlock(target.getAttribute("data-image-src")).src = target.value.slice(0, 1500000); touchPage(page); return; }
          if (target.matches("[data-image-caption]")) { findBlock(target.getAttribute("data-image-caption")).caption = target.textContent || ""; touchPage(page); return; }
          if (target.matches("[data-mermaid-source]")) {
            const block = findBlock(target.getAttribute("data-mermaid-source")); recordHistory(page, { typing: true }); block.source = target.value; touchPage(page);
            renderMermaidPreview(root.querySelector(`[data-mermaid-preview='${cssEscape(block.id)}']`), block.source); return;
          }
        }, { signal: state.abortController.signal });

        root.addEventListener("change", (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.matches("[data-check-block]")) { const block = findBlock(target.getAttribute("data-check-block")); recordHistory(currentPage()); block.checked = target.checked; touchPage(currentPage()); target.closest("[data-block-id]")?.setAttribute("data-checked", String(block.checked)); }
          if (target?.matches("[data-image-src]")) renderEditor();
        }, { signal: state.abortController.signal });

        root.addEventListener("toggle", (event) => {
          const details = event.target instanceof Element ? event.target.closest("[data-toggle-block]") : null;
          if (details) { const block = findBlock(details.getAttribute("data-toggle-block")); if (block) { block.open = details.open; touchPage(currentPage()); } }
        }, { capture: true, signal: state.abortController.signal });

        root.addEventListener("focusin", (event) => {
          const code = event.target instanceof Element ? event.target.closest("[data-code-editor]") : null;
          if (code && code.querySelector("span")) { const value = code.textContent || ""; code.replaceChildren(document.createTextNode(value)); }
        }, { signal: state.abortController.signal });
        root.addEventListener("focusout", (event) => {
          const code = event.target instanceof Element ? event.target.closest("[data-code-editor]") : null;
          if (code) { const value = code.textContent || ""; code.replaceChildren(); appendHighlightedCode(code, value); }
        }, { signal: state.abortController.signal });

        root.addEventListener("keydown", (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { if (undoPage(event.shiftKey)) event.preventDefault(); return; }
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { if (undoPage(true)) event.preventDefault(); return; }
          if (event.key === "Escape") {
            if (root.querySelector("[data-quick-overlay]")) root.querySelector("[data-quick-overlay]").remove();
            else closePopup();
            root.querySelector(".bbpw-selection-toolbar")?.remove(); return;
          }
          if (event.target?.matches?.("[data-reference-path-input]") && event.key === "Enter") {
            event.preventDefault(); confirmPathReference(); return;
          }
          if (event.target?.matches?.("[data-link-url-input]") && event.key === "Enter") {
            event.preventDefault(); confirmLink(); return;
          }
          if (state.commandContext && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
            const options = state.commandContext.kind === "slash" ? commandMatches(state.commandContext.query) : state.commandContext.options || [];
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); state.commandContext.index = (state.commandContext.index + (event.key === "ArrowDown" ? 1 : -1) + Math.max(1, options.length)) % Math.max(1, options.length);
              if (state.commandContext.kind === "slash") renderCommandPopup(); else renderReferencePopup(); return;
            }
            if (event.key === "Enter" && options.length) {
              event.preventDefault();
              if (state.commandContext.kind === "slash") changeBlockType(state.commandContext.blockId, options[state.commandContext.index].type);
              else insertReference(options[state.commandContext.index]);
              return;
            }
          }
          const editableNode = event.target instanceof Element ? event.target.closest("[data-block-editable]") : null;
          if (editableNode && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); splitBlock(editableNode); return; }
          if (editableNode && event.key === "Backspace" && !(editableNode.textContent || "") && currentPage()?.blocks.length > 1) { event.preventDefault(); removeBlock(editableNode.getAttribute("data-block-editable")); }
          if (event.target?.matches?.("[data-quick-input]") && event.key === "Enter") {
            const first = root.querySelector("[data-quick-results] [data-page-open]"); if (first) { event.preventDefault(); openPage(first.getAttribute("data-page-open")); root.querySelector("[data-quick-overlay]")?.remove(); }
          }
        }, { signal: state.abortController.signal });

        root.addEventListener("paste", (event) => {
          const target = event.target instanceof Element ? event.target.closest("[data-block-editable]") : null;
          if (!target) return;
          const image = [...(event.clipboardData?.files || [])].find((file) => file.type.startsWith("image/") && file.size < 1000000);
          if (image && typeof FileReader === "function") {
            event.preventDefault(); const reader = new FileReader();
            reader.addEventListener("load", () => { const block = insertBlockAfter(target.getAttribute("data-block-editable"), "image"); block.src = String(reader.result || ""); touchPage(currentPage()); renderEditor(); }, { once: true }); reader.readAsDataURL(image); return;
          }
          const value = event.clipboardData?.getData("text/plain");
          if (typeof value !== "string") return;
          event.preventDefault();
          if (/\n/.test(value) && /^(?:#{1,3}\s|[-*]\s|\d+[.)]\s|```|>\s)/m.test(value)) {
            const page = currentPage(); recordHistory(page); const index = blockIndex(target.getAttribute("data-block-editable")); page.blocks.splice(index, 1, ...markdownToBlocks(value)); touchPage(page); renderEditor(); return;
          }
          let inserted = false; try { inserted = Boolean(document.execCommand?.("insertText", false, value)); } catch (_) {}
          if (!inserted) { const selection = document.getSelection(); if (selection?.rangeCount) { selection.deleteFromDocument(); selection.getRangeAt(0).insertNode(document.createTextNode(value)); } }
          syncInlineEditable(target);
        }, { signal: state.abortController.signal });

        root.addEventListener("mouseup", () => { if (captureSelection()) ownedTimeout(showSelectionToolbar, 0); }, { signal: state.abortController.signal });
        root.addEventListener("keyup", (event) => { if ((event.shiftKey || ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) && captureSelection()) ownedTimeout(showSelectionToolbar, 0); }, { signal: state.abortController.signal });
        root.addEventListener("mousedown", (event) => {
          if (event.target instanceof Element && event.target.closest("[data-selection-action]")) event.preventDefault();
        }, { signal: state.abortController.signal });
        root.addEventListener("contextmenu", (event) => {
          const row = event.target instanceof Element ? event.target.closest("[data-page-row]") : null;
          if (row) { event.preventDefault(); showPageMenu(pageById(row.getAttribute("data-page-row")), row); }
        }, { signal: state.abortController.signal });

        root.addEventListener("dragstart", (event) => {
          const target = event.target instanceof Element ? event.target : null;
          const pageRow = target?.closest("[data-page-row]"); const blockHandle = target?.closest("[data-block-menu]");
          if (pageRow) { state.draggedPageId = pageRow.getAttribute("data-page-row"); event.dataTransfer?.setData("text/plain", state.draggedPageId); event.dataTransfer && (event.dataTransfer.effectAllowed = "move"); }
          else if (blockHandle) { state.draggedBlockId = blockHandle.getAttribute("data-block-menu"); event.dataTransfer?.setData("text/plain", state.draggedBlockId); event.dataTransfer && (event.dataTransfer.effectAllowed = "move"); }
        }, { signal: state.abortController.signal });
        root.addEventListener("dragover", (event) => {
          const target = event.target instanceof Element ? event.target : null;
          root.querySelectorAll("[data-drop]").forEach((node) => node.removeAttribute("data-drop"));
          const pageRow = target?.closest("[data-page-row]"); const blockNode = target?.closest("[data-block-id]");
          if (state.draggedPageId && pageRow) {
            event.preventDefault(); const rect = pageRow.getBoundingClientRect();
            const mode = event.clientX > rect.left + 44 ? "inside" : event.clientY < rect.top + rect.height / 2 ? "before" : "after";
            pageRow.setAttribute("data-drop", mode);
          } else if (state.draggedBlockId && blockNode) { event.preventDefault(); const rect = blockNode.getBoundingClientRect(); blockNode.setAttribute("data-drop", event.clientY < rect.top + rect.height / 2 ? "before" : "after"); }
        }, { signal: state.abortController.signal });
        root.addEventListener("drop", (event) => {
          const target = event.target instanceof Element ? event.target : null;
          const pageRow = target?.closest("[data-page-row]"); const blockNode = target?.closest("[data-block-id]");
          if (state.draggedPageId && pageRow) { event.preventDefault(); reorderPage(state.draggedPageId, pageRow.getAttribute("data-page-row"), pageRow.getAttribute("data-drop") || "after"); }
          else if (state.draggedBlockId && blockNode) { event.preventDefault(); reorderBlock(state.draggedBlockId, blockNode.getAttribute("data-block-id"), blockNode.getAttribute("data-drop") === "after"); }
          state.draggedPageId = null; state.draggedBlockId = null; root.querySelectorAll("[data-drop]").forEach((node) => node.removeAttribute("data-drop"));
        }, { signal: state.abortController.signal });
        root.addEventListener("dragend", () => { state.draggedPageId = null; state.draggedBlockId = null; root.querySelectorAll("[data-drop]").forEach((node) => node.removeAttribute("data-drop")); }, { signal: state.abortController.signal });
      };

      const findMainSurface = () => [...document.querySelectorAll("main")].find((node) => !node.hasAttribute(ROOT_ATTRIBUTE) && !node.closest("#bettercodex-client-root")) || null;
      const restoreMainSurface = () => {
        const restore = state.mainRestore; if (!restore) return;
        restore.node.hidden = restore.hidden;
        if (restore.ariaHidden === null) restore.node.removeAttribute("aria-hidden"); else restore.node.setAttribute("aria-hidden", restore.ariaHidden);
        state.mainRestore = null;
      };
      const clearSuppressedNavigation = () => document.querySelectorAll(`[${SUPPRESSED_NAV_ATTRIBUTE}]`).forEach((row) => row.removeAttribute(SUPPRESSED_NAV_ATTRIBUTE));
      const suppressNativeNavigation = () => {
        const aside = state.launcherRow?.closest("aside") || document.querySelector("aside"); if (!aside) return;
        const selectedRows = new Set([...aside.querySelectorAll("[aria-current='page'],[aria-selected='true'],[data-state='active'],[data-active='true'],.sidebar-item.active,.sidebar-item[class*='selected']")]
          .map((node) => node.closest(".sidebar-item") || node).filter((row) => row !== state.launcherRow));
        for (const row of selectedRows) row.setAttribute(SUPPRESSED_NAV_ATTRIBUTE, "");
      };
      const suspendMainSurface = () => {
        const main = findMainSurface(); if (!main || state.mainRestore?.node === main) return;
        restoreMainSurface(); state.mainSurface = main;
        state.mainRestore = { node: main, hidden: main.hidden, ariaHidden: main.getAttribute("aria-hidden") };
        if (state.root?.parentElement !== main.parentElement) main.insertAdjacentElement("afterend", state.root);
        main.hidden = true; main.setAttribute("aria-hidden", "true");
      };
      function closeWorkspace(options = {}) {
        if (!state.root) return;
        closePopup(); state.root.querySelector("[data-quick-overlay]")?.remove(); state.root.querySelector(".bbpw-selection-toolbar")?.remove();
        state.root.hidden = true; state.root.setAttribute("aria-hidden", "true");
        state.launcher?.removeAttribute("aria-current"); state.launcherRow?.removeAttribute("data-active"); clearSuppressedNavigation(); restoreMainSurface();
        if (options.restoreFocus !== false && state.restoreFocusTo?.isConnected) state.restoreFocusTo.focus(); state.restoreFocusTo = null;
      }
      function openWorkspace(options = {}) {
        const project = findProjectIdentity(); if (!project || !state.root) return;
        switchProject(project); if (!state.data) return;
        document.dispatchEvent(new CustomEvent("bettercodex:full-tab-open", { detail: { owner: "project-workspace" } }));
        state.restoreFocusTo = document.activeElement; renderWorkspace(); suspendMainSurface();
        state.root.hidden = false; state.root.setAttribute("aria-hidden", "false"); state.launcher?.setAttribute("aria-current", "page"); state.launcherRow?.setAttribute("data-active", "true"); suppressNativeNavigation();
        if (options.search) showQuickSearch(); else state.root.querySelector("[data-bbpw-page-title], [data-new-page]")?.focus?.({ preventScroll: true });
      }
      const buildWorkspace = () => {
        if (state.root?.isConnected) return;
        const main = findMainSurface(); if (!main?.parentElement) return;
        const root = main.cloneNode(false); root.removeAttribute("id"); root.removeAttribute("inert"); root.setAttribute(ROOT_ATTRIBUTE, ""); root.setAttribute("aria-label", "Workspace"); root.setAttribute("aria-hidden", "true"); root.hidden = true;
        const shell = element("section", { className: "bbpw-shell", attributes: { "data-sidebar-collapsed": "false" } });
        shell.append(element("aside", { className: "bbpw-sidebar", attributes: { "data-bbpw-sidebar": "", "aria-label": "Workspace pages" } }), element("section", { className: "bbpw-editor-pane", attributes: { "data-bbpw-editor-pane": "", "aria-label": "Workspace editor" } }));
        root.append(shell); main.insertAdjacentElement("afterend", root); state.root = root; state.mainSurface = main; bindRootEvents();
      };
      const createWorkspaceIcon = () => {
        const namespace = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(namespace, "svg");
        svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("fill", "none"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "icon-xs");
        const path = document.createElementNS(namespace, "path"); path.setAttribute("d", "M3 2.25h8.25A1.75 1.75 0 0 1 13 4v9.75H4.75A1.75 1.75 0 0 1 3 12V2.25Zm1 1v7.54c.23-.1.48-.16.75-.16H12V4a.75.75 0 0 0-.75-.75H4Zm.75 8.38a.75.75 0 0 0 0 1.5H12v-1.5H4.75ZM6 5.25h4v1H6v-1Zm0 2h4v1H6v-1Z"); path.setAttribute("fill", "currentColor"); svg.append(path); return svg;
      };
      const ensureLauncher = () => {
        document.querySelectorAll(`[${LAUNCHER_ROW_ATTRIBUTE}]`).forEach((row) => { if (row !== state.launcherRow) row.remove(); });
        const navigation = findProjectNavigation(); const newChat = findNewChatControl(); const newChatRow = newChat?.closest(".sidebar-item") || newChat?.parentElement;
        if (!navigation || !newChatRow?.parentElement || !findProjectIdentity()) { closeWorkspace({ restoreFocus: false }); state.launcherRow?.remove(); state.launcher = null; state.launcherRow = null; return false; }
        if (state.launcher?.isConnected && state.launcherRow?.isConnected) return true;
        const launcherRow = newChatRow.cloneNode(true); launcherRow.setAttribute(LAUNCHER_ROW_ATTRIBUTE, "");
        const launcher = launcherRow.querySelector("button, a"); if (!launcher) return false;
        [...launcherRow.children].filter((child) => child !== launcher).forEach((child) => child.remove());
        launcher.removeAttribute("href"); launcher.setAttribute("type", "button"); launcher.setAttribute(LAUNCHER_ATTRIBUTE, ""); launcher.setAttribute("aria-label", "Open Workspace"); launcher.removeAttribute("aria-current");
        const content = launcher.firstElementChild; const iconSlot = content?.querySelector("span:first-child"); const label = content?.querySelector(".text-fade-truncate");
        if (iconSlot) iconSlot.replaceChildren(createWorkspaceIcon()); if (label) label.textContent = "Workspace"; else launcher.replaceChildren(createWorkspaceIcon(), document.createTextNode("Workspace"));
        launcher.addEventListener("click", () => openWorkspace(), { signal: state.abortController.signal });
        const kanbanRow = newChatRow.parentElement.querySelector("[data-bettercodex-project-kanban-launcher-row]"); (kanbanRow || newChatRow).insertAdjacentElement("afterend", launcherRow);
        state.launcher = launcher; state.launcherRow = launcherRow; return true;
      };

      const handleApiRequest = (event) => {
        const detail = event.detail || {}; let result = null; let error = null;
        try {
          const action = detail.action;
          if (action === "listPages") result = state.data.pages.map((page) => ({ id: page.id, parentId: page.parentId, title: page.title, icon: page.icon, favorite: page.favorite, contextEnabled: page.contextEnabled, updatedAt: page.updatedAt }));
          else if (action === "getPage") result = clone(pageById(detail.pageId));
          else if (action === "createPage") result = clone(createPage(detail.parentId || null, { title: detail.title, icon: detail.icon, blocks: detail.markdown ? markdownToBlocks(detail.markdown) : detail.blocks, focusTitle: false }));
          else if (action === "updatePage") {
            const page = pageById(detail.pageId); if (!page) throw new Error("Workspace page not found"); recordHistory(page);
            if (detail.patch?.title !== undefined) page.title = String(detail.patch.title || "Untitled").slice(0, 240);
            if (detail.patch?.icon !== undefined) page.icon = String(detail.patch.icon || "📄").slice(0, 8);
            if (detail.patch?.parentId !== undefined) page.parentId = pageById(detail.patch.parentId) ? detail.patch.parentId : null;
            if (detail.patch?.favorite !== undefined) page.favorite = Boolean(detail.patch.favorite);
            if (detail.patch?.contextEnabled !== undefined) page.contextEnabled = Boolean(detail.patch.contextEnabled);
            if (detail.patch?.blocks) page.blocks = detail.patch.blocks.map(normalizeBlock);
            if (detail.patch?.markdown !== undefined) page.blocks = markdownToBlocks(detail.patch.markdown);
            touchPage(page); renderWorkspace(); result = clone(page);
          } else if (action === "appendMarkdown") {
            const page = pageById(detail.pageId); if (!page) throw new Error("Workspace page not found"); recordHistory(page); page.blocks.push(...markdownToBlocks(detail.markdown)); touchPage(page); renderWorkspace(); result = clone(page);
          } else if (action === "deletePage") result = deletePage(detail.pageId, { skipConfirm: true });
          else if (action === "search") result = searchPages(detail.query).map(({ page, excerpt }) => ({ id: page.id, title: page.title, excerpt }));
          else if (action === "getContext") result = contextMarkdown();
          else if (action === "openPage") result = openPage(detail.pageId);
          else throw new Error(`Unknown Workspace action: ${action}`);
        } catch (caught) { error = caught?.message || String(caught); }
        detail.respond?.(error ? { error } : result);
        if (detail.requestId) document.dispatchEvent(new CustomEvent(`${API_EVENT}:response`, { detail: { requestId: detail.requestId, result, error } }));
      };
      const runWorkspaceCommand = (action) => {
        if (action === "create-page") { openWorkspace(); createPage(null); }
        else if (action === "search") { openWorkspace(); showQuickSearch(); }
        else if (action === "open-recent") { openWorkspace(); const recent = state.data?.recent.map(pageById).find(Boolean); if (recent) openPage(recent.id); }
        else if (action === "add-context") { openWorkspace(); const page = currentPage(); if (page) { page.contextEnabled = true; touchPage(page); renderEditor(); } }
        else if (action === "copy-link") { const page = currentPage(); if (page) copyText(pageLink(page)); }
      };
      const registerCommands = () => {
        const commands = [
          { id: "workspace.create-page", label: "Create Workspace Page", run: () => runWorkspaceCommand("create-page") },
          { id: "workspace.search", label: "Search Workspace", shortcut: "Ctrl+P", run: () => runWorkspaceCommand("search") },
          { id: "workspace.open-recent", label: "Open Recent Page", run: () => runWorkspaceCommand("open-recent") },
          { id: "workspace.add-context", label: "Add Current Page to Codex Context", run: () => runWorkspaceCommand("add-context") },
          { id: "workspace.copy-link", label: "Copy Page Link", run: () => runWorkspaceCommand("copy-link") }
        ];
        if (BetterCodex.commands?.register) {
          const disposers = commands.map((command) => BetterCodex.commands.register(command)).filter((value) => typeof value === "function");
          state.commandDisposer = () => disposers.forEach((dispose) => dispose());
        }
        document.dispatchEvent(new CustomEvent("bettercodex:commands-register", { detail: { owner: "project-workspace", commands } }));
      };

      const syncAll = () => {
        state.scheduled = false; if (state.stopped || !ensureLauncher()) return;
        installStyles(); buildWorkspace(); switchProject(findProjectIdentity());
        if (!currentPage() && state.data?.pages.length) state.data.lastOpenedId = state.data.recent.find((id) => pageById(id)) || state.data.pages[0].id;
        renderWorkspace();
        if (state.root && !state.root.hidden) { suspendMainSurface(); suppressNativeNavigation(); }
      };
      const scheduleSync = () => { if (state.scheduled || state.stopped) return; state.scheduled = true; queueMicrotask(syncAll); };

      readStore();
      document.addEventListener(API_EVENT, handleApiRequest, { signal: state.abortController.signal });
      document.addEventListener(COMMAND_EVENT, (event) => runWorkspaceCommand(event.detail?.action), { signal: state.abortController.signal });
      document.addEventListener("bettercodex:full-tab-open", (event) => {
        if (event.detail?.owner !== "project-workspace") closeWorkspace({ restoreFocus: false });
      }, { signal: state.abortController.signal });
      document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p" && state.launcher?.isConnected && !event.altKey) { event.preventDefault(); event.stopPropagation(); openWorkspace({ search: true }); }
      }, { capture: true, signal: state.abortController.signal });
      window.addEventListener("popstate", () => closeWorkspace({ restoreFocus: false }), { signal: state.abortController.signal });
      document.addEventListener("click", (event) => {
        if (state.root?.hidden || !(event.target instanceof Element)) return;
        const sidebarRow = event.target.closest("aside .sidebar-item");
        if (sidebarRow && !sidebarRow.hasAttribute(LAUNCHER_ROW_ATTRIBUTE)) queueMicrotask(() => closeWorkspace({ restoreFocus: false }));
      }, { capture: true, signal: state.abortController.signal });
      state.observer = new MutationObserver((records) => {
        if (records.some((record) => {
          if (record.target instanceof Element && record.target.closest(`[${ROOT_ATTRIBUTE}], [${LAUNCHER_ATTRIBUTE}], [data-bettercodex-project-kanban-root]`)) return false;
          if (record.type === "attributes") return true;
          return [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE);
        })) scheduleSync();
      });
      state.observer.observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [
        "aria-current", "aria-selected", "data-state", "data-active", "data-app-action-sidebar-thread-active", "data-app-action-sidebar-thread-selected",
        "data-app-action-sidebar-project-id", "data-app-action-sidebar-project-label", "data-app-action-sidebar-project-list-id", "href"
      ] });
      registerCommands(); syncAll();

      cleanup = () => {
        if (state.stopped) return;
        saveNow(); state.stopped = true; closeWorkspace({ restoreFocus: false }); state.observer?.disconnect(); state.abortController.abort(); state.commandDisposer?.();
        document.dispatchEvent(new CustomEvent("bettercodex:commands-unregister", { detail: { owner: "project-workspace" } }));
        for (const timer of state.timers) clearTimeout(timer); state.timers.clear();
        if (state.composerRestore?.composer?.isConnected) {
          const { composer, previous, value, isTextControl } = state.composerRestore; const current = isTextControl ? composer.value : composer.textContent;
          if (current === value) { if (isTextControl) composer.value = previous; else composer.textContent = previous; composer.dispatchEvent(new Event("input", { bubbles: true })); }
        }
        state.popup?.remove(); state.root?.remove(); state.launcherRow?.remove(); state.style?.remove();
        state.root = null; state.launcher = null; state.launcherRow = null; state.style = null; state.mainSurface = null;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
