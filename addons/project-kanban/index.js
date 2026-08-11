(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "project-kanban",
    start() {
      cleanup();

      const ROOT_ATTRIBUTE = "data-bettercodex-project-kanban-root";
      const LAUNCHER_ATTRIBUTE = "data-bettercodex-project-kanban-launcher";
      const LAUNCHER_ROW_ATTRIBUTE = "data-bettercodex-project-kanban-launcher-row";
      const SUPPRESSED_NAV_ATTRIBUTE = "data-bettercodex-project-kanban-suppressed-nav";
      const STYLE_ATTRIBUTE = "data-bettercodex-project-kanban-style";
      const STORAGE_KEY = "bettercodex.project-kanban.v1";
      const preferenceStorage = BetterCodex.storage || localStorage;
      const CHAT_PATH = /\/(?:tasks?|threads?|chats?|t)\/[^/?#]+/i;
      const STATUSES = ["old", "in-progress", "waiting", "done"];
      const STATUS_LABELS = {
        old: "Old",
        "in-progress": "In Progress",
        waiting: "Waiting",
        done: "Done"
      };
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
        cards: new Map(),
        nativeLinks: new Map(),
        timers: new Set(),
        abortController: new AbortController(),
        pendingLaunchCardId: null,
        restoreFocusTo: null,
        composerRestore: null,
        forwardingNativeMenuClick: false
      };

      const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const parseCount = (value) => {
        const parsed = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const ownedTimeout = (callback, delay) => {
        const id = setTimeout(() => {
          state.timers.delete(id);
          if (!state.stopped) callback();
        }, delay);
        state.timers.add(id);
        return id;
      };
      const element = (tag, options = {}) => {
        const node = document.createElement(tag);
        if (options.className) node.className = options.className;
        if (options.text !== undefined) node.textContent = options.text;
        if (options.attributes) {
          for (const [name, value] of Object.entries(options.attributes)) node.setAttribute(name, value);
        }
        return node;
      };

      const migrateStatus = (status, progress) => {
        if (status === "done") return "done";
        if (status === "in-progress") return /need|wait|approval|attention/i.test(progress) ? "waiting" : "in-progress";
        return "old";
      };

      const loadCards = () => {
        try {
          const stored = JSON.parse(preferenceStorage.getItem(STORAGE_KEY) || "{}");
          if (stored.version !== 3 || !Array.isArray(stored.cards)) return;
          for (const item of stored.cards) {
            if (!item || typeof item.id !== "string" || typeof item.title !== "string" || !item.native || !item.projectLinked) continue;
            const progress = normalizeText(item.progress);
            const storedProject = normalizeText(item.project);
            if (!storedProject || typeof item.href !== "string" || !item.href) continue;
            state.cards.set(item.id, {
              id: item.id,
              title: normalizeText(item.title).slice(0, 240),
              project: storedProject === "Current project" ? "" : storedProject,
              status: STATUSES.includes(item.status) ? item.status : migrateStatus(item.status, progress),
              progress,
              href: typeof item.href === "string" ? item.href : "",
              native: Boolean(item.native),
              projectLinked: true,
              hidden: Boolean(item.hidden),
              filesChanged: parseCount(item.filesChanged),
              additions: parseCount(item.additions),
              deletions: parseCount(item.deletions),
              activityLabel: normalizeText(item.activityLabel).slice(0, 24),
              updatedAt: Number(item.updatedAt) || Date.now()
            });
          }
        } catch (_) {
          // Corrupt or unavailable storage should never break the Codex renderer.
        }
      };

      const saveCards = () => {
        try {
          preferenceStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 3,
            cards: [...state.cards.values()].map((card) => ({
              id: card.id,
              title: card.title,
              project: card.project,
              status: card.status,
              progress: card.progress,
              href: card.href,
              native: card.native,
              projectLinked: card.projectLinked,
              hidden: card.hidden,
              filesChanged: card.filesChanged,
              additions: card.additions,
              deletions: card.deletions,
              activityLabel: card.activityLabel,
              updatedAt: card.updatedAt
            }))
          }));
        } catch (_) {
          // The board remains usable for this session when storage is unavailable.
        }
      };

      const findProjectNavigation = () => {
        const projectRow = document.querySelector("[data-app-action-sidebar-project-row]");
        return projectRow?.closest("nav, [role='navigation'], aside") || null;
      };

      const findNewChatControl = (scope = findProjectNavigation()) => scope && [...scope.querySelectorAll("button, a[href]")].find((node) => {
        if (node.closest(`[${ROOT_ATTRIBUTE}], [${LAUNCHER_ATTRIBUTE}], #bettercodex-client-root`)) return false;
        const visibleText = normalizeText(node.textContent).slice(0, 80);
        const label = `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""} ${visibleText}`;
        return /new\s+(task|chat|thread)|start\s+(task|chat|thread)/i.test(label);
      }) || null;

      const chatKey = (control) => {
        const threadId = control.getAttribute?.("data-app-action-sidebar-thread-id");
        if (threadId) return `thread:${threadId}`;
        try {
          const url = new URL(control.href, location.href);
          return `${url.pathname}${url.search}`;
        } catch (_) {
          return "";
        }
      };

      const isChatControl = (control) => {
        if (!(control instanceof Element) || control.closest(`[${ROOT_ATTRIBUTE}], #bettercodex-client-root`)) return false;
        if (control.hasAttribute("data-app-action-sidebar-thread-row")) return true;
        if (!(control instanceof HTMLAnchorElement)) return false;
        const key = chatKey(control);
        if (!key) return false;
        if (CHAT_PATH.test(key)) return true;
        const label = `${control.getAttribute("aria-label") || ""} ${control.getAttribute("title") || ""}`;
        return Boolean(control.closest("nav, [role='navigation']") && /(task|chat|thread)/i.test(label));
      };

      const chatRow = (control) => control.closest("[data-app-action-sidebar-thread-row], li, [role='listitem']") || control;

      const projectLabel = (node) => {
        if (!(node instanceof Element)) return "";
        const explicit = [
          "data-app-action-sidebar-project-label", "data-project-name", "data-project-label",
          "data-project-title", "data-workspace-name"
        ].map((attribute) => normalizeText(node.getAttribute(attribute))).find(Boolean);
        if (explicit) return explicit.slice(0, 80);
        if (node.hasAttribute("data-app-action-sidebar-project-row")) {
          return normalizeText(node.getAttribute("aria-label") || node.textContent).slice(0, 80);
        }
        return "";
      };

      const inferProject = (control) => {
        const projectList = control.closest("[data-app-action-sidebar-project-list-id]");
        const ancestor = control.closest("[data-app-action-sidebar-project-label], [data-project-name], [data-project-label], [data-project-title], [data-workspace-name]");
        const ancestorLabel = projectLabel(ancestor);
        if (ancestorLabel) return ancestorLabel;

        const projectId = control.getAttribute("data-app-action-sidebar-project-id")
          || control.getAttribute("data-project-id")
          || projectList?.getAttribute("data-app-action-sidebar-project-list-id");
        if (projectId) {
          const projectRow = [...document.querySelectorAll("[data-app-action-sidebar-project-id], [data-project-id]")]
            .find((row) => row.getAttribute("data-app-action-sidebar-project-id") === projectId || row.getAttribute("data-project-id") === projectId);
          const label = projectLabel(projectRow);
          if (label) return label;
        }
        return "";
      };

      const extractTitle = (control) => {
        const labelledBy = control.getAttribute("aria-labelledby");
        const labelled = labelledBy ? document.getElementById(labelledBy) : null;
        const title = normalizeText(control.getAttribute("data-app-action-sidebar-thread-title") || labelled?.textContent || control.getAttribute("aria-label") || control.getAttribute("title") || control.textContent);
        return title.replace(/^(open|view)\s+(task|chat|thread)\s*/i, "").slice(0, 240) || "Untitled chat";
      };

      const parseChangeSummary = (source) => {
        const text = normalizeText(source);
        const compact = text.match(/(\d[\d,]*)\s+files?(?:\s+changed)?[^+]{0,80}\+\s*([\d,]+)\s+[−-]\s*([\d,]+)/i);
        if (compact) {
          return { filesChanged: parseCount(compact[1]), additions: parseCount(compact[2]), deletions: parseCount(compact[3]) };
        }
        const git = text.match(/(\d[\d,]*)\s+files?\s+changed[^\d]{0,40}(\d[\d,]*)\s+insertions?\(\+\)[^\d]{0,40}(\d[\d,]*)\s+deletions?\(-\)/i);
        if (git) {
          return { filesChanged: parseCount(git[1]), additions: parseCount(git[2]), deletions: parseCount(git[3]) };
        }
        return null;
      };

      const parseFileChangeRows = (source) => {
        const text = normalizeText(source);
        const matches = [...text.matchAll(/(?:^|\s)([\w@./\\-]+\.[a-z0-9]{1,10})[^+−]{0,120}\+\s*([\d,]+)\s+[−-]\s*([\d,]+)/gi)];
        if (!matches.length) return null;
        const files = new Map();
        for (const match of matches) files.set(match[1], { additions: parseCount(match[2]), deletions: parseCount(match[3]) });
        return {
          filesChanged: files.size,
          additions: [...files.values()].reduce((total, file) => total + file.additions, 0),
          deletions: [...files.values()].reduce((total, file) => total + file.deletions, 0)
        };
      };

      const readChangeSummary = (control, active) => {
        const row = chatRow(control);
        const explicit = row.querySelector("[data-task-change-summary], [data-diff-summary], [data-files-changed]") || row;
        const explicitFiles = explicit.getAttribute("data-files-changed");
        const explicitAdditions = explicit.getAttribute("data-additions");
        const explicitDeletions = explicit.getAttribute("data-deletions");
        if (explicitFiles !== null || explicitAdditions !== null || explicitDeletions !== null) {
          return {
            filesChanged: parseCount(explicitFiles),
            additions: parseCount(explicitAdditions),
            deletions: parseCount(explicitDeletions)
          };
        }

        const rowSummary = parseChangeSummary([
          row.getAttribute("data-task-change-summary"),
          row.getAttribute("data-diff-summary"),
          explicit.getAttribute("aria-label"),
          row.textContent
        ].join(" "));
        if (rowSummary || !active) return rowSummary;

        const main = [...document.querySelectorAll("main")]
          .find((node) => !node.hasAttribute(ROOT_ATTRIBUTE) && !node.closest("#bettercodex-client-root"));
        const summaryNode = main?.querySelector("[data-task-change-summary], [data-diff-summary], [data-files-changed], [aria-label*='files changed' i]");
        if (summaryNode) {
          const files = summaryNode.getAttribute("data-files-changed");
          const additions = summaryNode.getAttribute("data-additions");
          const deletions = summaryNode.getAttribute("data-deletions");
          if (files !== null || additions !== null || deletions !== null) {
            return { filesChanged: parseCount(files), additions: parseCount(additions), deletions: parseCount(deletions) };
          }
          const parsedNode = parseChangeSummary(`${summaryNode.getAttribute("aria-label") || ""} ${summaryNode.textContent || ""}`);
          if (parsedNode) return parsedNode;
        }
        const boundedText = main
          ? [...main.querySelectorAll("*")].filter((node) => node.childElementCount === 0).map((node) => node.textContent).join(" ")
          : "";
        return parseChangeSummary(boundedText) || parseFileChangeRows(boundedText)
          || parseChangeSummary(main?.textContent) || parseFileChangeRows(main?.textContent);
      };

      const readActivityTime = (control) => {
        const row = chatRow(control);
        const time = row.querySelector("time, [data-relative-time], [data-updated-at]");
        if (!time) return null;
        const label = normalizeText(time.getAttribute("data-relative-time") || time.textContent).slice(0, 24);
        const timestamp = Date.parse(time.getAttribute("datetime") || time.getAttribute("data-updated-at") || "");
        return { label, timestamp: Number.isFinite(timestamp) ? timestamp : null };
      };

      const readNativeActivity = (control) => {
        const row = chatRow(control);
        const statusNodes = [...row.querySelectorAll("[role='status'], [aria-live], [data-state], [data-status], [aria-label*='progress' i], [aria-label*='status' i], [class*='status'], [class*='badge']")];
        const source = normalizeText([
          row.getAttribute("data-state"), row.getAttribute("data-status"),
          control.getAttribute("data-state"), control.getAttribute("data-status"),
          ...statusNodes.flatMap((node) => [node.getAttribute("aria-label"), node.getAttribute("data-state"), node.getAttribute("data-status"), node.textContent])
        ].join(" ")).toLowerCase();
        if (/need(s)? (input|approval)|waiting for (you|approval)|awaiting approval|blocked|approval required/.test(source)) {
          return { progress: "Waiting", status: "waiting" };
        }
        if (/failed|error|needs attention/.test(source)) return { progress: "Needs attention", status: "waiting" };
        if (/running|working|executing|in progress|generating|thinking/.test(source)) return { progress: "Running", status: "in-progress" };
        if (/complete(d)?|finished|\bdone\b|succeeded/.test(source)) return { progress: "Complete", status: "done" };
        const busySelector = "[aria-busy='true'], [data-state='loading'], [data-state='running'], [data-status='running'], [class*='animate-spin'], [class*='spinner']";
        const busy = row.matches(busySelector) || Boolean(row.querySelector(busySelector));
        return busy ? { progress: "Running", status: "in-progress" } : { progress: "", status: null };
      };

      const readPushState = (active) => {
        if (!active) return null;
        const main = [...document.querySelectorAll("main")]
          .find((node) => !node.hasAttribute(ROOT_ATTRIBUTE) && !node.closest("#bettercodex-client-root"));
        if (!main) return null;
        const labels = [...main.querySelectorAll("[data-slot='thread-summary-panel-item-label']")];
        const commitOrPush = labels.find((label) => /^commit or push$/i.test(normalizeText(label.textContent)))
          ?.closest("button, [role='button']");
        if (commitOrPush) return !commitOrPush.hasAttribute("disabled") && commitOrPush.getAttribute("aria-disabled") !== "true";
        const hasGitSummary = labels.some((label) => /^changes$/i.test(normalizeText(label.textContent)))
          && (labels.some((label) => /^local$/i.test(normalizeText(label.textContent)))
            || Boolean(main.querySelector("button[title*='branch' i]")));
        return hasGitSummary ? false : null;
      };

      const isActiveChatRunning = (key, control) => {
        const row = chatRow(control);
        const busySelector = "[aria-busy='true'], [data-state='loading'], [data-state='running'], [data-status='running'], [class*='animate-spin'], [class*='spinner']";
        if (row.matches(busySelector) || row.querySelector(busySelector)) return true;
        const nativeActive = control.getAttribute("data-app-action-sidebar-thread-active") === "true" || control.getAttribute("aria-current") === "page";
        if (!nativeActive && key !== `${location.pathname}${location.search}`) return false;
        return [...document.querySelectorAll("button[aria-label], button[title]")].some((button) => {
          if (button.closest(`[${ROOT_ATTRIBUTE}], #bettercodex-client-root`)) return false;
          const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
          return /stop (generating|task|response)|cancel (generation|task)/i.test(label);
        });
      };

      const scanNativeChats = () => {
        let changed = false;
        const discovered = new Map();
        const projectNavigation = findProjectNavigation();
        if (!projectNavigation) return false;
        for (const control of projectNavigation.querySelectorAll("[data-app-action-sidebar-thread-row], a[href]")) {
          if (!isChatControl(control)) continue;
          const key = chatKey(control);
          if (!key || discovered.has(key)) continue;
          const project = inferProject(control);
          if (!project) continue;
          discovered.set(key, control);
          state.nativeLinks.set(key, control);

          const id = `chat:${key}`;
          const canonicalCard = state.cards.get(id);
          const hrefCard = [...state.cards.values()].find((card) => card.native && card.href === key);
          const existing = canonicalCard || hrefCard;
          if (canonicalCard && hrefCard && canonicalCard !== hrefCard) {
            state.cards.delete(hrefCard.id);
            changed = true;
          }
          const card = existing || {
            id,
            title: extractTitle(control),
            project,
            status: "old",
            progress: "",
            href: key,
            native: true,
            projectLinked: true,
            hidden: false,
            filesChanged: 0,
            additions: 0,
            deletions: 0,
            activityLabel: "",
            updatedAt: Date.now()
          };
          const previous = JSON.stringify(card);
          const activity = readNativeActivity(control);
          const running = activity.status === "in-progress" || isActiveChatRunning(key, control);
          const wasUnfinished = card.status === "in-progress" || card.status === "waiting";
          const wasWaitingToPush = card.status === "waiting" && card.progress === "Commit or push";

          card.title = extractTitle(control);
          card.project = project;
          card.href = key;
          card.native = true;
          card.projectLinked = true;
          const active = control.getAttribute("data-app-action-sidebar-thread-active") === "true" || control.getAttribute("aria-current") === "page" || key === `${location.pathname}${location.search}`;
          const pushPending = readPushState(active);
          if (running) {
            card.status = "in-progress";
            card.progress = "Running";
          } else if (activity.status === "waiting") {
            card.status = activity.status;
            card.progress = activity.progress;
          } else if (pushPending === true) {
            card.status = "waiting";
            card.progress = "Commit or push";
          } else if (pushPending === false && wasWaitingToPush) {
            card.status = "done";
            card.progress = "Complete";
          } else if (wasWaitingToPush) {
            card.status = "waiting";
            card.progress = "Commit or push";
          } else if (activity.status) {
            card.status = activity.status;
            card.progress = activity.progress;
          } else if (wasUnfinished) {
            card.status = "done";
            card.progress = "Complete";
          }

          const changes = readChangeSummary(control, active);
          if (!running && pushPending === false) {
            card.filesChanged = 0;
            card.additions = 0;
            card.deletions = 0;
          } else if (changes) {
            Object.assign(card, changes);
          }
          const activityTime = readActivityTime(control);
          if (activityTime?.label) card.activityLabel = activityTime.label;
          if (activityTime?.timestamp) card.updatedAt = activityTime.timestamp;

          if (!existing || previous !== JSON.stringify(card)) {
            if (!activityTime?.timestamp) card.updatedAt = Date.now();
            changed = true;
          }
          state.cards.set(card.id, card);
        }

        for (const card of [...state.cards.values()]) {
          if (card.native && card.projectLinked && card.href && discovered.has(card.href)) continue;
          state.cards.delete(card.id);
          if (card.href) state.nativeLinks.delete(card.href);
          changed = true;
        }

        if (state.pendingLaunchCardId) {
          const active = [...discovered.entries()].find(([, control]) => control.getAttribute("data-app-action-sidebar-thread-active") === "true" || control.getAttribute("aria-current") === "page")
            || [...discovered.entries()].find(([key]) => key === `${location.pathname}${location.search}`);
          const pending = state.cards.get(state.pendingLaunchCardId);
          if (active && pending) {
            const discoveredCard = state.cards.get(`chat:${active[0]}`);
            if (discoveredCard && discoveredCard !== pending) {
              pending.filesChanged = discoveredCard.filesChanged;
              pending.additions = discoveredCard.additions;
              pending.deletions = discoveredCard.deletions;
              state.cards.delete(discoveredCard.id);
            }
            pending.href = active[0];
            pending.native = true;
            pending.progress = "Running";
            pending.status = "in-progress";
            pending.updatedAt = Date.now();
            state.nativeLinks.set(active[0], active[1]);
            state.pendingLaunchCardId = null;
            changed = true;
          }
        }
        if (changed) saveCards();
        return changed;
      };

      const installStyles = () => {
        if (state.style?.isConnected) return;
        const style = element("style", { attributes: { [STYLE_ATTRIBUTE]: "" } });
        style.textContent = `
          [${LAUNCHER_ATTRIBUTE}]:focus-visible { outline:2px solid Highlight; outline-offset:2px; }
          [${LAUNCHER_ROW_ATTRIBUTE}][data-active='true'] { background:var(--color-token-list-hover-background, color-mix(in srgb, currentColor 9%, transparent)); }
          [${SUPPRESSED_NAV_ATTRIBUTE}], [${SUPPRESSED_NAV_ATTRIBUTE}] > button, [${SUPPRESSED_NAV_ATTRIBUTE}] > a { background:transparent !important; }
          [${ROOT_ATTRIBUTE}] { position:relative; display:block; min-width:0; flex:1 1 auto; overflow:hidden; color:var(--color-token-text-primary, var(--color-foreground, CanvasText)); background:var(--color-token-main-surface-primary, Canvas); font:inherit; }
          [${ROOT_ATTRIBUTE}][hidden] { display:none; }
          [${ROOT_ATTRIBUTE}] .bbpk-shell { width:100%; height:100%; min-height:0; padding:28px 22px 24px; box-sizing:border-box; }
          [${ROOT_ATTRIBUTE}] .bbpk-board { display:grid; grid-template-columns:repeat(4, minmax(220px, 1fr)); gap:24px; height:100%; min-height:0; overflow-x:auto; }
          [${ROOT_ATTRIBUTE}] .bbpk-column { display:flex; min-width:220px; min-height:0; flex-direction:column; }
          [${ROOT_ATTRIBUTE}] .bbpk-column-header { display:flex; align-items:center; gap:8px; min-height:28px; padding:0 4px 14px; font-size:13px; font-weight:650; letter-spacing:.005em; }
          [${ROOT_ATTRIBUTE}] .bbpk-column-icon { display:grid; place-items:center; width:16px; height:16px; color:var(--color-token-text-secondary, color-mix(in srgb, currentColor 65%, transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpk-column-icon svg { width:16px; height:16px; }
          [${ROOT_ATTRIBUTE}] .bbpk-count { color:var(--color-token-text-tertiary, color-mix(in srgb, currentColor 42%, transparent)); font-weight:500; }
          [${ROOT_ATTRIBUTE}] .bbpk-list { display:flex; min-height:0; flex:1; flex-direction:column; gap:10px; overflow-y:auto; padding:0 4px 24px; scrollbar-width:thin; }
          [${ROOT_ATTRIBUTE}] .bbpk-card { position:relative; width:100%; margin:0; border:1px solid transparent; border-radius:11px; color:inherit; background:var(--color-token-main-surface-secondary, color-mix(in srgb, currentColor 5%, transparent)); box-shadow:0 1px 2px rgba(0,0,0,.08); }
          [${ROOT_ATTRIBUTE}] .bbpk-card:hover { background:var(--color-token-list-hover-background, color-mix(in srgb, currentColor 8%, transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpk-card-main { appearance:none; display:block; width:100%; margin:0; padding:14px 38px 14px 15px; border:0; border-radius:inherit; color:inherit; background:transparent; font:inherit; text-align:left; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpk-card-main:focus-visible, [${ROOT_ATTRIBUTE}] .bbpk-menu-button:focus-visible, [${ROOT_ATTRIBUTE}] .bbpk-change-action:focus-visible { outline:2px solid Highlight; outline-offset:2px; }
          [${ROOT_ATTRIBUTE}] .bbpk-menu-button { appearance:none; position:absolute; top:7px; right:7px; display:grid; width:27px; height:27px; padding:0; place-items:center; border:0; border-radius:7px; color:var(--color-token-text-secondary, color-mix(in srgb, currentColor 65%, transparent)); background:transparent; cursor:pointer; opacity:0; pointer-events:none; }
          [${ROOT_ATTRIBUTE}] .bbpk-menu-button:hover { color:inherit; background:color-mix(in srgb, currentColor 9%, transparent); }
          [${ROOT_ATTRIBUTE}] .bbpk-card:hover .bbpk-menu-button, [${ROOT_ATTRIBUTE}] .bbpk-card:focus-within .bbpk-menu-button { opacity:1; pointer-events:auto; }
          [${ROOT_ATTRIBUTE}] .bbpk-menu-button svg { width:16px; height:16px; }
          [${ROOT_ATTRIBUTE}] .bbpk-card-title-row { display:flex; align-items:flex-start; gap:9px; min-width:0; }
          [${ROOT_ATTRIBUTE}] .bbpk-card-title { min-width:0; margin:0; font-size:13px; font-weight:600; line-height:1.38; overflow-wrap:anywhere; }
          [${ROOT_ATTRIBUTE}] .bbpk-spinner { width:13px; height:13px; margin-top:2px; flex:none; box-sizing:border-box; border:2px solid color-mix(in srgb, currentColor 25%, transparent); border-top-color:currentColor; border-radius:50%; animation:bbpk-spin .75s linear infinite; }
          [${ROOT_ATTRIBUTE}] .bbpk-meta { display:flex; align-items:center; justify-content:space-between; gap:10px; min-width:0; margin-top:11px; color:var(--color-token-text-tertiary, color-mix(in srgb, currentColor 50%, transparent)); font-size:11px; line-height:1.25; }
          [${ROOT_ATTRIBUTE}] .bbpk-meta[data-has-project='false'] { justify-content:flex-end; }
          [${ROOT_ATTRIBUTE}] .bbpk-project { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          [${ROOT_ATTRIBUTE}] .bbpk-time { flex:none; }
          [${ROOT_ATTRIBUTE}] .bbpk-change-footer { display:flex; align-items:center; gap:10px; min-width:0; padding:10px 10px 10px 12px; border-top:1px solid var(--color-token-border-light, color-mix(in srgb, currentColor 10%, transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpk-change-icon { display:grid; width:25px; height:25px; flex:none; place-items:center; border-radius:7px; color:var(--color-token-text-secondary, color-mix(in srgb, currentColor 65%, transparent)); background:var(--color-token-main-surface-primary, color-mix(in srgb, currentColor 5%, transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpk-change-icon svg { width:14px; height:14px; }
          [${ROOT_ATTRIBUTE}] .bbpk-change-copy { min-width:0; flex:1; }
          [${ROOT_ATTRIBUTE}] .bbpk-change-title { display:block; overflow:hidden; font-size:11px; font-weight:600; line-height:1.25; text-overflow:ellipsis; white-space:nowrap; }
          [${ROOT_ATTRIBUTE}] .bbpk-changes { display:flex; align-items:center; gap:7px; margin-top:3px; font-size:10px; line-height:1.2; }
          [${ROOT_ATTRIBUTE}] .bbpk-files { color:var(--color-token-text-tertiary, color-mix(in srgb, currentColor 50%, transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpk-additions { color:var(--color-token-text-success, #3fb950); }
          [${ROOT_ATTRIBUTE}] .bbpk-deletions { color:var(--color-token-text-danger, #e05262); }
          [${ROOT_ATTRIBUTE}] .bbpk-change-actions { display:flex; align-items:center; gap:3px; flex:none; }
          [${ROOT_ATTRIBUTE}] .bbpk-change-action { appearance:none; display:flex; min-height:25px; margin:0; padding:0 7px; align-items:center; gap:3px; border:1px solid transparent; border-radius:7px; color:inherit; background:transparent; font:inherit; font-size:10px; line-height:1; cursor:pointer; }
          [${ROOT_ATTRIBUTE}] .bbpk-change-action svg { width:11px; height:11px; flex:none; }
          [${ROOT_ATTRIBUTE}] .bbpk-change-action:hover { background:var(--color-token-list-hover-background, color-mix(in srgb, currentColor 9%, transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpk-change-action-review { border-color:var(--color-token-border-medium, color-mix(in srgb, currentColor 15%, transparent)); background:var(--color-token-main-surface-primary, color-mix(in srgb, currentColor 4%, transparent)); }
          [${ROOT_ATTRIBUTE}] .bbpk-empty { min-height:48px; }
          @keyframes bbpk-spin { to { transform:rotate(360deg); } }
          @media (max-width:900px) { [${ROOT_ATTRIBUTE}] .bbpk-shell { padding-inline:16px; } [${ROOT_ATTRIBUTE}] .bbpk-board { gap:16px; } }
          @media (prefers-reduced-motion:reduce) { [${ROOT_ATTRIBUTE}] .bbpk-spinner { animation-duration:1.5s; } }
        `;
        document.head.append(style);
        state.style = style;
      };

      const createIcon = (status) => {
        const paths = {
          old: "M8 3a5 5 0 1 1-4.33 2.5M3.67 5.5H1.75V3.58M8 5v3.25l2.1 1.25",
          "in-progress": "M3 4.25 6.25 8 3 11.75M7.75 12h5.25",
          waiting: "M8 13.25A5.25 5.25 0 1 0 8 2.75a5.25 5.25 0 0 0 0 10.5ZM5.5 8h.01M8 8h.01M10.5 8h.01",
          done: "M13.25 8A5.25 5.25 0 1 1 2.75 8a5.25 5.25 0 0 1 10.5 0ZM5.5 8.1l1.55 1.55 3.45-3.5"
        };
        const namespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(namespace, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("fill", "none");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(namespace, "path");
        path.setAttribute("d", paths[status]);
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.35");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.append(path);
        return svg;
      };

      const formatRelativeTime = (card) => {
        if (card.activityLabel) return card.activityLabel;
        const elapsed = Math.max(0, Date.now() - card.updatedAt);
        if (elapsed < 60_000) return "now";
        if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
        if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`;
        return `${Math.floor(elapsed / 86_400_000)}d`;
      };

      const findNativeChatControl = (card) => {
        const linked = state.nativeLinks.get(card.href);
        if (linked?.isConnected && inferProject(linked)) return linked;
        const projectNavigation = findProjectNavigation();
        if (!projectNavigation) return null;
        return [...projectNavigation.querySelectorAll("[data-app-action-sidebar-thread-row], a[href]")]
          .find((candidate) => isChatControl(candidate) && inferProject(candidate) && chatKey(candidate) === card.href) || null;
      };

      const openNativeChat = (card) => {
        const control = findNativeChatControl(card);
        if (!control) return;
        closeBoard();
        control.click();
      };

      const findNativeMenuTrigger = (control) => {
        const row = chatRow(control);
        const candidates = [...row.querySelectorAll("button, [role='button']")].filter((candidate) => candidate !== control);
        return candidates.find((candidate) => {
          const label = `${candidate.getAttribute("aria-label") || ""} ${candidate.getAttribute("title") || ""}`;
          return /(more|options|actions|menu|overflow)/i.test(label);
        }) || candidates.find((candidate) => !normalizeText(candidate.textContent) && candidate.querySelector("svg")) || null;
      };

      const openNativeContextMenu = (card, anchor) => {
        const control = findNativeChatControl(card);
        if (!control) return;
        const row = chatRow(control);
        const bounds = anchor.getBoundingClientRect();
        const contextEvent = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          buttons: 2,
          clientX: Math.round(bounds.right),
          clientY: Math.round(bounds.bottom)
        });
        const handled = !row.dispatchEvent(contextEvent) || contextEvent.defaultPrevented;
        if (handled) return;
        const trigger = findNativeMenuTrigger(control);
        if (!trigger) return;
        state.forwardingNativeMenuClick = true;
        trigger.click();
        queueMicrotask(() => { state.forwardingNativeMenuClick = false; });
      };

      const createMenuIcon = () => {
        const namespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(namespace, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("aria-hidden", "true");
        for (const x of [3, 8, 13]) {
          const circle = document.createElementNS(namespace, "circle");
          circle.setAttribute("cx", String(x));
          circle.setAttribute("cy", "8");
          circle.setAttribute("r", "1.15");
          svg.append(circle);
        }
        return svg;
      };

      const createChangeIcon = () => {
        const namespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(namespace, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("fill", "none");
        svg.setAttribute("aria-hidden", "true");
        const rect = document.createElementNS(namespace, "rect");
        rect.setAttribute("x", "2.25");
        rect.setAttribute("y", "2.25");
        rect.setAttribute("width", "11.5");
        rect.setAttribute("height", "11.5");
        rect.setAttribute("rx", "2.25");
        rect.setAttribute("stroke", "currentColor");
        rect.setAttribute("stroke-width", "1.25");
        const horizontal = document.createElementNS(namespace, "path");
        horizontal.setAttribute("d", "M5.25 8h5.5M8 5.25v5.5");
        horizontal.setAttribute("stroke", "currentColor");
        horizontal.setAttribute("stroke-width", "1.25");
        horizontal.setAttribute("stroke-linecap", "round");
        svg.append(rect, horizontal);
        return svg;
      };

      const createUndoIcon = () => {
        const namespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(namespace, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("fill", "none");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(namespace, "path");
        path.setAttribute("d", "M6.25 4.25 3.5 7l2.75 2.75M3.75 7H9a3.5 3.5 0 1 1 0 7h-1");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.35");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.append(path);
        return svg;
      };

      const isActiveChat = (card, control = findNativeChatControl(card)) => Boolean(control && (
        control.getAttribute("data-app-action-sidebar-thread-active") === "true"
        || control.getAttribute("aria-current") === "page"
        || card.href === `${location.pathname}${location.search}`
      ));

      const findNativeChangeAction = (action) => {
        const main = [...document.querySelectorAll("main")]
          .find((node) => !node.hasAttribute(ROOT_ATTRIBUTE) && !node.closest("#bettercodex-client-root"));
        const overlays = [...(main?.querySelectorAll("button[aria-label='Review changed files']") || [])];
        const overlay = overlays.at(-1);
        if (!overlay) return null;
        const header = overlay.parentElement;
        if (action === "review") {
          return [...header.querySelectorAll("button")]
            .find((button) => normalizeText(button.textContent) === "Review") || overlay;
        }
        return [...header.querySelectorAll("button")]
          .find((button) => normalizeText(button.textContent) === "Undo") || null;
      };

      const runNativeChangeAction = (card, action, attempt = 0) => {
        const control = findNativeChatControl(card);
        if (!control) return;
        if (!isActiveChat(card, control)) {
          if (attempt === 0) {
            closeBoard({ restoreFocus: false });
            control.click();
          }
          if (attempt < 24) ownedTimeout(() => runNativeChangeAction(card, action, attempt + 1), 125);
          return;
        }
        const nativeAction = findNativeChangeAction(action);
        if (!nativeAction) {
          if (attempt < 24) ownedTimeout(() => runNativeChangeAction(card, action, attempt + 1), 125);
          return;
        }
        closeBoard({ restoreFocus: false });
        nativeAction.click();
      };

      const setComposerValue = (composer, value) => {
        const isTextControl = composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement;
        const previous = isTextControl ? composer.value : composer.textContent;
        state.composerRestore = { composer, previous, value, isTextControl };
        composer.focus();
        if (isTextControl) {
          const prototype = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
          if (setter) setter.call(composer, value);
          else composer.value = value;
        } else {
          composer.textContent = value;
        }
        composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        composer.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const findComposer = () => document.querySelector([
        "[data-codex-composer][contenteditable='true']",
        "[data-codex-composer] textarea",
        "[data-codex-composer] [contenteditable='true']",
        "textarea[aria-label*='message' i]",
        "[contenteditable='true'][aria-label*='message' i]"
      ].join(", "));

      const findSendButton = (composer) => {
        const surface = composer.closest("form, [data-codex-composer]") || composer.parentElement;
        return [...(surface?.querySelectorAll("button[aria-label], button[title]") || [])].find((button) => {
          const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
          return /send|submit|run task/i.test(label) && !button.disabled;
        }) || null;
      };

      const prepareAndSend = (card, attempt = 0) => {
        const composer = findComposer();
        if (!composer) {
          if (attempt < 20) ownedTimeout(() => prepareAndSend(card, attempt + 1), 150);
          return;
        }
        const prompt = `Execute this project plan as a Codex task:\n\n${card.title}\n\nReport meaningful progress in the chat and clearly state when the work is done.`;
        setComposerValue(composer, prompt);
        ownedTimeout(() => {
          const send = findSendButton(composer);
          if (send) {
            send.click();
            state.composerRestore = null;
            card.progress = "Running";
            card.status = "in-progress";
            card.updatedAt = Date.now();
            saveCards();
            scheduleSync();
          }
          renderBoard();
        }, 120);
      };

      const runAsChat = (card) => {
        if (card.href) return openNativeChat(card);
        const newChat = findNewChatControl();
        if (!newChat) return;
        card.status = "in-progress";
        card.progress = "Launching";
        card.updatedAt = Date.now();
        state.pendingLaunchCardId = card.id;
        saveCards();
        closeBoard();
        newChat.click();
        ownedTimeout(() => prepareAndSend(card), 100);
      };

      const renderCard = (card) => {
        const label = `${card.native ? "Open" : "Run"} ${card.title}`;
        const cardItem = element("div", {
          className: "bbpk-card",
          attributes: { role: "listitem", "data-card-id": card.id, "data-card-state": card.status }
        });
        const cardNode = element("button", {
          className: "bbpk-card-main",
          attributes: { type: "button", "aria-label": label, "data-card-id": card.id, "data-card-state": card.status }
        });
        const titleRow = element("span", { className: "bbpk-card-title-row" });
        if (card.status === "in-progress") {
          titleRow.append(element("span", { className: "bbpk-spinner", attributes: { role: "status", "aria-label": "Running" } }));
        }
        titleRow.append(element("span", { className: "bbpk-card-title", text: card.title }));

        const meta = element("span", { className: "bbpk-meta" });
        if (card.project) meta.append(element("span", { className: "bbpk-project", text: card.project, attributes: { title: card.project } }));
        meta.append(element("span", { className: "bbpk-time", text: formatRelativeTime(card) }));
        meta.setAttribute("data-has-project", String(Boolean(card.project)));
        cardNode.append(titleRow, meta);

        const hasChanges = Boolean(card.filesChanged || card.additions || card.deletions);
        let changeFooter = null;
        if (hasChanges) {
          changeFooter = element("div", {
            className: "bbpk-change-footer",
            attributes: { role: "group", "aria-label": `Changes for ${card.title}` }
          });
          const changeIcon = element("span", { className: "bbpk-change-icon" });
          changeIcon.append(createChangeIcon());
          const changeCopy = element("span", { className: "bbpk-change-copy" });
          changeCopy.append(element("span", {
            className: "bbpk-change-title",
            text: `Edited ${card.filesChanged} ${card.filesChanged === 1 ? "file" : "files"}`
          }));
          const changes = element("span", { className: "bbpk-changes", attributes: { "aria-label": `${card.filesChanged} files changed, ${card.additions} additions, ${card.deletions} deletions` } });
          changes.append(
            element("span", { className: "bbpk-additions", text: `+${card.additions.toLocaleString()}` }),
            element("span", { className: "bbpk-deletions", text: `−${card.deletions.toLocaleString()}` })
          );
          changeCopy.append(changes);
          const actions = element("span", { className: "bbpk-change-actions" });
          for (const action of ["undo", "review"]) {
            const actionButton = element("button", {
              className: `bbpk-change-action${action === "review" ? " bbpk-change-action-review" : ""}`,
              text: action === "review" ? "Review" : "Undo",
              attributes: { type: "button", "data-bbpk-change-action": action, "aria-label": `${action === "review" ? "Review" : "Undo"} changes for ${card.title}` }
            });
            if (action === "undo") actionButton.append(createUndoIcon());
            actionButton.addEventListener("click", (event) => {
              event.stopPropagation();
              runNativeChangeAction(card, action);
            }, { signal: state.abortController.signal });
            actions.append(actionButton);
          }
          changeFooter.append(changeIcon, changeCopy, actions);
        }
        cardNode.addEventListener("click", () => card.href ? openNativeChat(card) : runAsChat(card), { signal: state.abortController.signal });
        cardItem.append(cardNode);
        if (changeFooter) cardItem.append(changeFooter);
        if (card.native && findNativeChatControl(card)) {
          const menu = element("button", {
            className: "bbpk-menu-button",
            attributes: { type: "button", "aria-label": `More options for ${card.title}`, "aria-haspopup": "menu" }
          });
          menu.append(createMenuIcon());
          menu.addEventListener("click", (event) => {
            event.stopPropagation();
            openNativeContextMenu(card, menu);
          }, { signal: state.abortController.signal });
          cardItem.append(menu);
        }
        return cardItem;
      };

      function renderBoard() {
        if (!state.root?.isConnected) return;
        for (const status of STATUSES) {
          const list = state.root.querySelector(`[data-bbpk-list='${status}']`);
          const count = state.root.querySelector(`[data-bbpk-count='${status}']`);
          const cards = [...state.cards.values()]
            .filter((card) => !card.hidden && card.native && card.projectLinked && card.project && card.status === status && findNativeChatControl(card))
            .sort((a, b) => b.updatedAt - a.updatedAt);
          list.replaceChildren();
          for (const card of cards) list.append(renderCard(card));
          if (!cards.length) list.append(element("div", { className: "bbpk-empty", attributes: { "aria-hidden": "true" } }));
          count.textContent = String(cards.length);
          count.setAttribute("aria-label", `${cards.length} ${cards.length === 1 ? "task" : "tasks"}`);
        }
      }

      const findMainSurface = () => [...document.querySelectorAll("main")]
        .find((node) => !node.hasAttribute(ROOT_ATTRIBUTE) && !node.closest("#bettercodex-client-root")) || null;

      const restoreMainSurface = () => {
        const restore = state.mainRestore;
        if (!restore) return;
        restore.node.hidden = restore.hidden;
        if (restore.ariaHidden === null) restore.node.removeAttribute("aria-hidden");
        else restore.node.setAttribute("aria-hidden", restore.ariaHidden);
        state.mainRestore = null;
      };

      const clearSuppressedNavigation = () => {
        document.querySelectorAll(`[${SUPPRESSED_NAV_ATTRIBUTE}]`).forEach((row) => row.removeAttribute(SUPPRESSED_NAV_ATTRIBUTE));
      };

      const suppressNativeNavigation = () => {
        const aside = state.launcherRow?.closest("aside") || document.querySelector("aside");
        if (!aside) return;
        const selectedRows = new Set([...aside.querySelectorAll([
          "[aria-current='page']", "[aria-selected='true']", "[data-state='active']",
          "[data-active='true']", ".sidebar-item.active", ".sidebar-item[class*='selected']"
        ].join(", "))]
          .map((node) => node.closest(".sidebar-item") || node)
          .filter((row) => row !== state.launcherRow));
        for (const row of aside.querySelectorAll(`[${SUPPRESSED_NAV_ATTRIBUTE}]`)) {
          if (!selectedRows.has(row)) row.removeAttribute(SUPPRESSED_NAV_ATTRIBUTE);
        }
        for (const row of selectedRows) row.setAttribute(SUPPRESSED_NAV_ATTRIBUTE, "");
      };

      const suspendMainSurface = () => {
        const main = findMainSurface();
        if (!main || state.mainRestore?.node === main) return;
        restoreMainSurface();
        state.mainSurface = main;
        state.mainRestore = { node: main, hidden: main.hidden, ariaHidden: main.getAttribute("aria-hidden") };
        if (state.root?.parentElement !== main.parentElement) main.insertAdjacentElement("afterend", state.root);
        main.hidden = true;
        main.setAttribute("aria-hidden", "true");
      };

      function closeBoard(options = {}) {
        if (!state.root) return;
        state.root.hidden = true;
        state.root.setAttribute("aria-hidden", "true");
        state.launcher?.removeAttribute("aria-current");
        state.launcherRow?.removeAttribute("data-active");
        clearSuppressedNavigation();
        restoreMainSurface();
        if (options.restoreFocus !== false && state.restoreFocusTo?.isConnected) state.restoreFocusTo.focus();
        state.restoreFocusTo = null;
      }

      const openBoard = () => {
        if (!state.root) return;
        state.restoreFocusTo = document.activeElement;
        scanNativeChats();
        renderBoard();
        suspendMainSurface();
        state.root.hidden = false;
        state.root.setAttribute("aria-hidden", "false");
        state.launcher?.setAttribute("aria-current", "page");
        state.launcherRow?.setAttribute("data-active", "true");
        suppressNativeNavigation();
        state.root.querySelector(".bbpk-card, .bbpk-column-header")?.focus?.({ preventScroll: true });
      };

      const buildBoard = () => {
        if (state.root?.isConnected) return;
        const main = findMainSurface();
        if (!main?.parentElement) return;
        const root = main.cloneNode(false);
        root.removeAttribute("id");
        root.removeAttribute("aria-hidden");
        root.removeAttribute("inert");
        root.setAttribute(ROOT_ATTRIBUTE, "");
        root.setAttribute("aria-label", "Kanban");
        root.setAttribute("aria-hidden", "true");
        root.hidden = true;

        const shell = element("section", { className: "bbpk-shell" });
        const board = element("div", { className: "bbpk-board", attributes: { "aria-label": "Task activity by status" } });
        for (const status of STATUSES) {
          const headingId = `bbpk-${status}`;
          const column = element("section", { className: "bbpk-column", attributes: { "data-status": status, "aria-labelledby": headingId } });
          const header = element("div", { className: "bbpk-column-header", attributes: { id: headingId, tabindex: "-1" } });
          const icon = element("span", { className: "bbpk-column-icon" });
          icon.append(createIcon(status));
          header.append(
            icon,
            element("span", { text: STATUS_LABELS[status] }),
            element("span", { className: "bbpk-count", text: "0", attributes: { "data-bbpk-count": status, "aria-label": "0 tasks" } })
          );
          const list = element("div", { className: "bbpk-list", attributes: { role: "list", "data-bbpk-list": status } });
          column.append(header, list);
          board.append(column);
        }
        shell.append(board);
        root.append(shell);
        main.insertAdjacentElement("afterend", root);
        state.root = root;
        state.mainSurface = main;
      };

      const createKanbanIcon = () => {
        const namespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(namespace, "svg");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("fill", "none");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("class", "icon-xs");
        const path = document.createElementNS(namespace, "path");
        path.setAttribute("d", "M2.25 2.25h3.5v11.5h-3.5V2.25Zm4.875 0h3.5v7h-3.5v-7Zm4.875 0h1.75v9.25H12V2.25ZM3.25 3.25v9.5h1.5v-9.5h-1.5Zm4.875 0v5h1.5v-5h-1.5ZM13 3.25v7.25h-.25V3.25H13Z");
        path.setAttribute("fill", "currentColor");
        svg.append(path);
        return svg;
      };

      const ensureLauncher = () => {
        document.querySelectorAll(`[${LAUNCHER_ROW_ATTRIBUTE}]`).forEach((row) => {
          if (row !== state.launcherRow) row.remove();
        });
        const projectNavigation = findProjectNavigation();
        const anchor = findNewChatControl(projectNavigation);
        const anchorRow = anchor?.closest(".sidebar-item") || anchor?.parentElement;
        if (!projectNavigation || !anchorRow?.parentElement || !document.body.contains(anchorRow)) {
          closeBoard({ restoreFocus: false });
          state.launcherRow?.remove();
          state.launcher = null;
          state.launcherRow = null;
          return false;
        }
        if (state.launcher?.isConnected && state.launcherRow?.isConnected) {
          if (state.launcherRow.previousElementSibling !== anchorRow) anchorRow.insertAdjacentElement("afterend", state.launcherRow);
          return true;
        }
        const launcherRow = anchorRow.cloneNode(true);
        launcherRow.setAttribute(LAUNCHER_ROW_ATTRIBUTE, "");
        launcherRow.querySelectorAll(`[${LAUNCHER_ATTRIBUTE}]`).forEach((node) => node.remove());
        const launcher = launcherRow.querySelector("button, a");
        if (!launcher) return false;
        [...launcherRow.children].filter((child) => child !== launcher).forEach((child) => child.remove());
        launcher.removeAttribute("href");
        launcher.setAttribute("type", "button");
        launcher.setAttribute(LAUNCHER_ATTRIBUTE, "");
        launcher.setAttribute("aria-label", "Open Kanban");
        launcher.removeAttribute("aria-current");
        const content = launcher.firstElementChild;
        const iconSlot = content?.querySelector("span:first-child");
        const label = content?.querySelector(".text-fade-truncate");
        if (iconSlot) iconSlot.replaceChildren(createKanbanIcon());
        if (label) label.textContent = "Kanban";
        else launcher.replaceChildren(createKanbanIcon(), document.createTextNode("Kanban"));
        launcher.addEventListener("click", openBoard, { signal: state.abortController.signal });
        anchorRow.insertAdjacentElement("afterend", launcherRow);
        state.launcher = launcher;
        state.launcherRow = launcherRow;
        return true;
      };

      const syncAll = () => {
        state.scheduled = false;
        if (state.stopped || !ensureLauncher()) return;
        installStyles();
        buildBoard();
        scanNativeChats();
        renderBoard();
        if (state.root && !state.root.hidden) {
          suspendMainSurface();
          suppressNativeNavigation();
        }
      };

      const scheduleSync = () => {
        if (state.scheduled || state.stopped) return;
        state.scheduled = true;
        queueMicrotask(syncAll);
      };

      loadCards();
      window.addEventListener("popstate", () => closeBoard({ restoreFocus: false }), { signal: state.abortController.signal });
      document.addEventListener("click", (event) => {
        if (state.forwardingNativeMenuClick) return;
        if (state.root?.hidden || !(event.target instanceof Element)) return;
        const sidebarRow = event.target.closest("aside .sidebar-item");
        if (sidebarRow && !sidebarRow.hasAttribute(LAUNCHER_ROW_ATTRIBUTE)) queueMicrotask(() => closeBoard({ restoreFocus: false }));
      }, { capture: true, signal: state.abortController.signal });
      state.observer = new MutationObserver((records) => {
        if (records.some((record) => {
          if (record.target instanceof Element && record.target.closest(`[${ROOT_ATTRIBUTE}], [${LAUNCHER_ATTRIBUTE}]`)) return false;
          if (record.type === "attributes") return record.target instanceof Element;
          return [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE);
        })) scheduleSync();
      });
      state.observer.observe(document.body || document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "aria-busy", "aria-current", "aria-label", "data-state", "data-status", "href",
          "data-app-action-sidebar-thread-active", "data-app-action-sidebar-thread-selected",
          "data-app-action-sidebar-thread-title", "data-app-action-sidebar-project-label",
          "data-task-change-summary", "data-diff-summary", "data-files-changed", "data-additions", "data-deletions",
          "data-relative-time", "data-updated-at", "datetime", "aria-expanded", "disabled", "aria-disabled"
        ]
      });
      syncAll();
      const continuousSync = () => {
        if (state.stopped) return;
        const changed = scanNativeChats();
        if (changed && state.root && !state.root.hidden) renderBoard();
        ownedTimeout(continuousSync, 1_500);
      };
      ownedTimeout(continuousSync, 1_500);

      cleanup = () => {
        if (state.stopped) return;
        state.stopped = true;
        closeBoard({ restoreFocus: false });
        state.observer?.disconnect();
        state.abortController.abort();
        for (const timer of state.timers) clearTimeout(timer);
        state.timers.clear();
        if (state.composerRestore?.composer?.isConnected) {
          const { composer, previous, value, isTextControl } = state.composerRestore;
          const current = isTextControl ? composer.value : composer.textContent;
          if (current === value) {
            if (isTextControl) composer.value = previous;
            else composer.textContent = previous;
            composer.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        state.root?.remove();
        state.launcherRow?.remove();
        state.style?.remove();
        state.root = null;
        state.launcher = null;
        state.launcherRow = null;
        state.style = null;
        state.mainSurface = null;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
