(() => {
  const ROOT_ID = "bettercodex-client-root";
  const LAUNCHER_ID = "bettercodex-native-launcher";
  const LAUNCHER_STYLE_ID = "bettercodex-native-launcher-style";
  const STORAGE_KEY = "bettercodex:addons:v1";
  const AUTO_UPDATE_STORAGE_KEY = "bettercodex:autoupdate:v1";
  const PREFERENCES_BINDING = "__BETTERCODEX_SAVE_PREFERENCES__";
  const STORAGE_KEY_PATTERN = /^bettercodex(?:[.:_-]|$)/i;
  const removeNativeLaunchers = (keep = null) => {
    document.querySelectorAll(`#${LAUNCHER_ID}`).forEach((candidate) => {
      if (candidate !== keep) candidate.remove();
    });
  };
  const BETTERCODEX_ICON = `<svg data-bettercodex-icon aria-hidden="true" class="icon-sm" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M8 4V2.5m-1.25 0h2.5M4.25 5.25h7.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5ZM1.5 8v1.5m13-1.5v1.5M6 8.5h.01m3.99 0h.01"></path></svg>`;
  const REFRESH_ICON = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.681 3H2V2h3.5l.5.5V6H5V4a5 5 0 1 0 4.53-.761l.302-.954A6 6 0 1 1 4.681 3z"></path></svg>`;
  const BACK_ICON = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.8011 3.611C9.05912 3.44087 9.40989 3.46898 9.63703 3.69596C9.89673 3.95566 9.89673 4.37767 9.63703 4.63737L4.93977 9.33463H16.6663L16.8011 9.34831C17.1038 9.41043 17.3312 9.67859 17.3314 9.99967C17.3314 10.3209 17.1039 10.5888 16.8011 10.651L16.6663 10.6647H4.93879L9.63703 15.363L9.722 15.4674C9.89241 15.7255 9.86413 16.0761 9.63703 16.3034C9.40981 16.5306 9.05921 16.5587 8.8011 16.3883L8.69661 16.3034L2.86262 10.4704C2.60319 10.2108 2.6033 9.78962 2.86262 9.52995L8.69661 3.69596L8.8011 3.611Z" fill="currentColor"></path></svg>`;
  const COG_ICON = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const PLUG_ICON = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 8V2"></path><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"></path></svg>`;
  const TWEAK_ICON = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 21v-7"></path><path d="M4 10V3"></path><path d="M12 21v-9"></path><path d="M12 8V3"></path><path d="M20 21v-5"></path><path d="M20 12V3"></path><path d="M1 14h6"></path><path d="M9 8h6"></path><path d="M17 16h6"></path></svg>`;
  const BRUSH_ICON = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"></path><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"></path></svg>`;
  const SEARCH_ICON = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" xmlns="http://www.w3.org/2000/svg"><circle cx="7" cy="7" r="4.25"></circle><path d="m10.25 10.25 3 3"></path></svg>`;

  function install(payload) {
    globalThis.BetterCodex?.destroy?.();
    document.getElementById(ROOT_ID)?.remove();
    removeNativeLaunchers();
    document.getElementById(LAUNCHER_STYLE_ID)?.remove();

    const catalog = new Map(payload.addons.map((addon) => [addon.manifest.id, addon]));
    const implementations = new Map();
    const active = new Set();
    const controller = new AbortController();
    let launcher;
    let previousOverflow = "";
    const durableStorage = payload.preferences?.persisted && payload.preferences.storage && typeof payload.preferences.storage === "object"
      ? payload.preferences.storage
      : {};
    for (const [key, value] of Object.entries(durableStorage)) {
      if (STORAGE_KEY_PATTERN.test(key) && typeof value === "string") localStorage.setItem(key, value);
    }
    const snapshotStorage = () => {
      const storage = {};
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && STORAGE_KEY_PATTERN.test(key)) storage[key] = localStorage.getItem(key);
      }
      return storage;
    };
    const persistStorage = () => {
      const binding = globalThis[PREFERENCES_BINDING];
      if (typeof binding === "function") binding(JSON.stringify({ version: 1, storage: snapshotStorage() }));
    };
    const preferenceStorage = {
      getItem(key) {
        if (!STORAGE_KEY_PATTERN.test(String(key))) return null;
        return localStorage.getItem(key);
      },
      setItem(key, value) {
        if (!STORAGE_KEY_PATTERN.test(String(key))) throw new Error("BetterCodex preference keys must start with bettercodex");
        localStorage.setItem(key, String(value));
        persistStorage();
      },
      removeItem(key) {
        if (!STORAGE_KEY_PATTERN.test(String(key))) return;
        localStorage.removeItem(key);
        persistStorage();
      }
    };
    let stored = {};
    try { stored = JSON.parse(preferenceStorage.getItem(STORAGE_KEY) || "{}"); } catch {}

    const isEnabled = (id) => stored[id] ?? Boolean(catalog.get(id)?.manifest.enabledByDefault);
    const save = () => preferenceStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const restoredStorage = snapshotStorage();
    if (!payload.preferences?.persisted || JSON.stringify(restoredStorage) !== JSON.stringify(durableStorage)) {
      queueMicrotask(persistStorage);
    }

    const start = (id) => {
      if (active.has(id)) return;
      const implementation = implementations.get(id);
      if (!implementation) return;
      try {
        implementation.start?.();
        active.add(id);
      } catch (error) {
        console.error(`[BetterCodex] Could not start ${id}`, error);
        stored[id] = false;
        save();
      }
    };

    const stop = (id) => {
      if (!active.has(id)) return;
      try { implementations.get(id)?.stop?.(); }
      catch (error) { console.error(`[BetterCodex] Could not stop ${id}`, error); }
      active.delete(id);
    };

    const launcherStyle = document.createElement("style");
    launcherStyle.id = LAUNCHER_STYLE_ID;
    launcherStyle.textContent = `
      #${LAUNCHER_ID} {
        position:relative;
        isolation:isolate;
        overflow:hidden;
        transition:color 180ms ease,background 180ms ease,box-shadow 220ms ease,transform 180ms ease;
        animation:bettercodex-launcher-intro-shell 1100ms ease 180ms;
      }
      #${LAUNCHER_ID}::after {
        content:"";
        position:absolute;
        inset:1px;
        border-radius:inherit;
        pointer-events:none;
        opacity:0;
        background:linear-gradient(110deg,transparent 16%,rgba(186,230,253,.5) 48%,transparent 80%);
        transform:translateX(-75%);
        transition:transform 480ms ease,opacity 180ms ease;
        animation:bettercodex-launcher-intro-sweep 1100ms ease 180ms;
      }
      #${LAUNCHER_ID} [data-bettercodex-icon] {
        position:relative;
        z-index:1;
        transition:color 180ms ease,filter 220ms ease,transform 220ms cubic-bezier(.2,.8,.2,1);
        animation:bettercodex-launcher-intro-icon 1100ms cubic-bezier(.2,.8,.2,1) 180ms;
      }
      @keyframes bettercodex-launcher-intro-shell {
        28%,72% {
          color:#7dd3fc;
          background:linear-gradient(135deg,rgba(14,165,233,.2),rgba(37,99,235,.24));
          box-shadow:0 0 0 1px rgba(96,165,250,.5),0 0 18px rgba(59,130,246,.45),inset 0 0 12px rgba(56,189,248,.12);
        }
      }
      @keyframes bettercodex-launcher-intro-sweep {
        0%,20% { opacity:0; transform:translateX(-75%); }
        32%,65% { opacity:1; }
        78%,100% { opacity:0; transform:translateX(75%); }
      }
      @keyframes bettercodex-launcher-intro-icon {
        28%,72% {
          color:#7dd3fc;
          filter:drop-shadow(0 0 5px rgba(56,189,248,.95));
          transform:scale(1.1) rotate(-4deg);
        }
      }
      #${LAUNCHER_ID}:is(:hover,:focus-visible) {
        color:#7dd3fc !important;
        background:linear-gradient(135deg,rgba(14,165,233,.2),rgba(37,99,235,.24)) !important;
        box-shadow:0 0 0 1px rgba(96,165,250,.5),0 0 18px rgba(59,130,246,.45),inset 0 0 12px rgba(56,189,248,.12);
      }
      #${LAUNCHER_ID}:is(:hover,:focus-visible)::after {
        opacity:1;
        transform:translateX(75%);
      }
      #${LAUNCHER_ID}:is(:hover,:focus-visible) [data-bettercodex-icon] {
        color:#7dd3fc !important;
        filter:drop-shadow(0 0 5px rgba(56,189,248,.95));
        transform:scale(1.1) rotate(-4deg);
      }
      #${LAUNCHER_ID}:active { transform:translateY(0) scale(.96); }
      @media (prefers-reduced-motion:reduce) {
        #${LAUNCHER_ID},#${LAUNCHER_ID}::after,#${LAUNCHER_ID} [data-bettercodex-icon] { animation:none; transition:none; }
        #${LAUNCHER_ID}:is(:hover,:focus-visible) { transform:none; }
        #${LAUNCHER_ID}::after { display:none; }
      }
    `;
    (document.head || document.documentElement).append(launcherStyle);

    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.style.cssText = "display:none;position:fixed;inset:0 0 0 0;z-index:2147483647";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all:initial; --bb-bg:var(--color-token-main-surface-primary,var(--vscode-editor-background,#fff));
          --bb-side:var(--color-token-sidebar-surface-primary,var(--vscode-sideBar-background,var(--bb-bg)));
          --bb-text:var(--color-token-text-primary,var(--color-token-foreground,var(--vscode-foreground,#161616)));
          --bb-surface:var(--color-token-main-surface-secondary,color-mix(in srgb,var(--bb-bg) 94%,var(--bb-text)));
          --bb-hover:var(--color-token-list-hover-background,var(--vscode-list-hoverBackground,color-mix(in srgb,var(--bb-text) 7%,transparent)));
          --bb-border:var(--color-token-border-light,var(--color-token-border-default,color-mix(in srgb,var(--bb-text) 13%,transparent)));
          --bb-muted:var(--color-token-text-tertiary,var(--color-token-description-foreground,color-mix(in srgb,var(--bb-text) 62%,var(--bb-bg))));
          --bb-icon:var(--color-token-icon-foreground,currentColor); color-scheme:light; }
        :host([data-theme="dark"]) { color-scheme:dark; }
        * { box-sizing:border-box; }
        button, a, input { font:inherit; }
        .view { width:100%; height:100%; min-height:0; display:flex; color:var(--bb-text); background:var(--bb-bg);
          font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size:13px; line-height:18.5714px; font-weight:445; }
        .sidebar { width:var(--codex-sidebar-preferred-width,275px); min-width:240px; max-width:min(520px,calc(100vw - 320px));
          flex:0 0 auto; padding:8px; overflow:hidden; border-right:1px solid var(--bb-border); background:var(--bb-side); }
        .back { width:100%; height:29px; display:flex; align-items:center; gap:8px; margin:0 0 8px; padding:5px 8px;
          color:var(--bb-muted); background:transparent; border:0; border-radius:12.5px; text-align:left; cursor:pointer; }
        .back svg { width:20px; height:20px; flex:none; }
        .back:hover { color:var(--bb-text); background:var(--bb-hover); }
        .nav-group { display:flex; flex-direction:column; gap:1px; }
        .nav-heading { min-height:27px; display:flex; align-items:center; padding:0 8px; color:var(--bb-muted); font-size:13px; font-weight:500; }
        .nav { width:100%; height:29px; display:flex; align-items:center; gap:8px; padding:5px 8px; color:var(--bb-text);
          background:transparent; border:0; border-radius:12.5px; text-align:left; cursor:pointer; }
        .nav:hover, .nav.active { background:var(--bb-hover); }
        .nav-icon { width:16px; height:20px; flex:none; display:flex; align-items:center; justify-content:center; color:var(--bb-icon); }
        .nav-icon svg { display:block; width:20px; height:20px; }
        .nav-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .main { min-width:0; flex:1 1 0; overflow:auto; background:var(--bb-bg); }
        .content { width:min(768px,calc(100% - 64px)); margin:0 auto; padding:112px 0 100px; }
        h1 { margin:0; padding:0 0 32px; display:flex; align-items:center; gap:10px; font-size:24px; line-height:28.8px; font-weight:400; }
        h1 [data-bettercodex-icon] { width:26px; height:26px; flex:none; }
        .section { margin-bottom:36px; scroll-margin-top:30px; }
        .card { overflow:hidden; border:1px solid var(--bb-border); border-radius:12px; background:var(--bb-surface); }
        .row { min-height:58px; display:flex; align-items:center; gap:16px; padding:11px 14px; }
        .row + .row { border-top:1px solid var(--bb-border); }
        .copy { min-width:0; flex:1; }
        .name { font-weight:600; }
        .description { margin-top:2px; color:var(--bb-muted); font-size:12px; line-height:17px; }
        .version { flex:none; color:var(--bb-muted); font-variant-numeric:tabular-nums; }
        .repo { flex:none; padding:5px 9px; border:1px solid var(--bb-border); border-radius:7px; color:var(--bb-text);
          background:var(--bb-hover); text-decoration:none; }
        .repo:hover { border-color:var(--bb-muted); }
        .repo:disabled { opacity:.62; cursor:default; }
        .update-actions { flex:none; display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; }
        .update-check { display:flex; align-items:center; gap:6px; }
        .update-check svg { width:16px; height:16px; flex:none; }
        .update-check.checking svg { animation:update-spin .8s linear infinite; }
        @keyframes update-spin { to { transform:rotate(360deg); } }
        .catalog-tools { display:flex; flex-direction:column; gap:9px; margin-bottom:14px; }
        .catalog-search-row { display:flex; align-items:center; gap:8px; }
        .search-field { position:relative; min-width:0; flex:1; display:block; }
        .search-field svg { position:absolute; left:11px; top:50%; width:16px; height:16px; color:var(--bb-muted); transform:translateY(-50%); pointer-events:none; }
        .catalog-search { width:100%; height:36px; padding:7px 12px 7px 35px; border:1px solid var(--bb-border); border-radius:10px;
          outline:none; color:var(--bb-text); background:var(--bb-surface); }
        .catalog-search::placeholder { color:var(--bb-muted); }
        .catalog-search:focus { border-color:#1688e8; box-shadow:0 0 0 2px rgba(22,136,232,.16); }
        .generate-action { height:36px; flex:none; display:flex; align-items:center; gap:6px; padding:7px 11px; border:1px solid var(--bb-border);
          border-radius:10px; color:var(--bb-text); background:var(--bb-surface); cursor:pointer; font-weight:600; white-space:nowrap; }
        .generate-action:hover { border-color:var(--bb-muted); background:var(--bb-hover); }
        .generate-action:focus-visible { outline:2px solid rgba(22,136,232,.55); outline-offset:2px; }
        .generate-plus { font-size:18px; line-height:16px; font-weight:350; }
        .filter-row { min-height:26px; display:flex; flex-wrap:wrap; align-items:center; gap:7px 14px; }
        .filter-set { display:flex; align-items:center; gap:6px; }
        .filter-label, .result-count { color:var(--bb-muted); font-size:12px; }
        .filter-options { display:flex; flex-wrap:wrap; gap:5px; }
        .filter-chip { min-height:26px; padding:3px 9px; border:1px solid var(--bb-border); border-radius:999px; color:var(--bb-muted);
          background:transparent; cursor:pointer; font-size:12px; line-height:17px; }
        .filter-chip:hover { color:var(--bb-text); background:var(--bb-hover); }
        .filter-chip.active { border-color:rgba(22,136,232,.5); color:var(--bb-text); background:rgba(22,136,232,.13); }
        .result-count { margin-left:auto; white-space:nowrap; }
        .plugins { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
        .plugin-card { min-width:0; overflow:hidden; border:1px solid var(--bb-border); border-radius:14px;
          color:var(--bb-text); background:var(--bb-surface); }
        .plugin-card[hidden], .empty-results[hidden] { display:none; }
        .plugin-preview { position:relative; width:100%; aspect-ratio:16/7; display:block; object-fit:cover;
          border-bottom:1px solid var(--bb-border); background:linear-gradient(135deg,#171717,#292929); }
        .plugin-preview-fallback { display:flex; align-items:center; justify-content:center; color:#fff; }
        .plugin-preview-fallback svg { width:32px; height:32px; }
        .plugin-body { padding:12px 13px 13px; }
        .plugin-heading { display:flex; align-items:baseline; gap:10px; }
        .plugin-heading .name { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .plugin-body .description { min-height:34px; }
        .plugin-creator { margin-top:4px; color:var(--bb-muted); font-size:11px; line-height:16px; }
        .plugin-meta { min-height:24px; display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:10px; }
        .plugin-tags { min-width:0; display:flex; flex-wrap:wrap; gap:5px; }
        .plugin-tag { padding:2px 7px; border:1px solid var(--bb-border); border-radius:999px; color:var(--bb-muted);
          background:var(--bb-hover); font-size:11px; line-height:16px; }
        .plugin-actions { flex:none; display:flex; align-items:center; gap:8px; }
        .switch { position:relative; width:36px; height:20px; flex:0 0 auto; }
        .switch input { position:absolute; opacity:0; pointer-events:none; }
        .track { position:absolute; inset:0; border-radius:99px; background:#555; cursor:pointer; transition:.15s; }
        .track::after { content:""; position:absolute; left:3px; top:3px; width:14px; height:14px; border-radius:50%;
          background:#fff; transition:.15s; }
        input:checked + .track { background:#1688e8; }
        input:checked + .track::after { transform:translateX(16px); }
        .empty { padding:18px 14px; color:var(--bb-muted); }
        .empty-results { grid-column:1/-1; padding:24px 14px; border:1px dashed var(--bb-border); border-radius:12px;
          color:var(--bb-muted); text-align:center; }
        @media (max-width:700px) { .sidebar { width:210px; min-width:180px; } .content { width:calc(100% - 32px); padding-top:64px; }
          .plugins { grid-template-columns:1fr; } .result-count { width:100%; margin-left:0; } .generate-action span:last-child { display:none; } }
      </style>
      <div class="view" role="dialog" aria-modal="true" aria-labelledby="bettercodex-title">
        <aside class="sidebar">
          <button class="back" type="button" aria-label="Back to app">${BACK_ICON}<span>Back to app</span></button>
          <nav class="nav-group" aria-label="BetterCodex settings">
            <div class="nav-heading">BetterCodex settings</div>
            <button class="nav active" type="button" aria-current="page" data-target="bettercodex">
              <span class="nav-icon">${COG_ICON}</span><span class="nav-label">BetterCodex</span>
            </button>
            <button class="nav" type="button" data-target="addons">
              <span class="nav-icon">${PLUG_ICON}</span><span class="nav-label">Add-ons</span>
            </button>
            <button class="nav" type="button" data-target="tweaks">
              <span class="nav-icon">${TWEAK_ICON}</span><span class="nav-label">Tweaks</span>
            </button>
            <button class="nav" type="button" data-target="themes">
              <span class="nav-icon">${BRUSH_ICON}</span><span class="nav-label">Themes</span>
            </button>
          </nav>
        </aside>
        <main class="main">
          <div class="content">
            <h1 id="bettercodex-title">${BETTERCODEX_ICON}<span>BetterCodex</span></h1>
            <section class="section" id="bettercodex"><div class="card">
              <div class="row"><div class="copy"><div class="name">Version</div><div class="description update-status" aria-live="polite">Installed BetterCodex runtime</div></div>
                <div class="update-actions"><div class="version">${escapeHtml(payload.version)}</div><button class="repo update-check" type="button">${REFRESH_ICON}<span>Check for updates</span></button>
                  <a class="repo update-download" href="#" target="_blank" rel="noreferrer" hidden>View release ↗</a></div></div>
              <div class="row"><div class="copy"><div class="name">Automatic updates</div><div class="description">Download and install new releases when BetterCodex starts</div></div>
                <label class="switch" title="Automatically update BetterCodex"><input class="autoupdate-toggle" type="checkbox" ${preferenceStorage.getItem(AUTO_UPDATE_STORAGE_KEY) === "true" ? "checked" : ""} aria-label="Automatically update BetterCodex"><span class="track"></span></label></div>
              <div class="row"><div class="copy"><div class="name">Source code</div><div class="description">View BetterCodex on GitHub</div></div>
                <a class="repo source-link" href="${escapeAttribute(payload.repository)}" target="_blank" rel="noreferrer">Open ↗</a></div>
            </div></section>
            <section class="section" id="addons" hidden><div class="plugins addons-list"></div></section>
            <section class="section" id="tweaks" hidden><div class="plugins tweaks-list"></div></section>
            <section class="section" id="themes" hidden><div class="plugins themes-list"></div></section>
          </div>
        </main>
      </div>`;

    const addonList = shadow.querySelector(".addons-list");
    const tweakList = shadow.querySelector(".tweaks-list");
    const themeList = shadow.querySelector(".themes-list");
    const refreshFilters = new Map();
    const getCreator = (manifest) => typeof manifest.creator === "string" && manifest.creator.trim()
      ? manifest.creator.trim()
      : "Unknown creator";
    for (const addon of payload.addons) {
      const card = document.createElement("article");
      card.className = "plugin-card";
      card.dataset.catalogItem = addon.manifest.id;
      const tags = Array.isArray(addon.manifest.tags) ? addon.manifest.tags.map((tag) => tag.trim()).filter(Boolean) : [];
      const creator = getCreator(addon.manifest);
      card.dataset.tags = tags.map((tag) => tag.toLocaleLowerCase()).join("|");
      card.dataset.search = [addon.manifest.id, addon.manifest.name, addon.manifest.description, creator, ...tags].join(" ").toLocaleLowerCase();
      const preview = addon.screenshot
        ? `<img class="plugin-preview" src="${escapeAttribute(addon.screenshot)}" alt="${escapeAttribute(addon.manifest.name)} screenshot">`
        : `<div class="plugin-preview plugin-preview-fallback">${BETTERCODEX_ICON}</div>`;
      card.innerHTML = `${preview}<div class="plugin-body"><div class="plugin-heading">
        <div class="name">${escapeHtml(addon.manifest.name)}</div><div class="version">v${escapeHtml(addon.manifest.version)}</div></div>
        <div class="description">${escapeHtml(addon.manifest.description)}</div>
        <div class="plugin-creator">By ${escapeHtml(creator)}</div>
        <div class="plugin-meta"><div class="plugin-tags" aria-label="Tags">${tags.map((tag) => `<span class="plugin-tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="plugin-actions"><label class="switch" title="Enable ${escapeAttribute(addon.manifest.name)}"><input type="checkbox" data-addon="${escapeAttribute(addon.manifest.id)}">
            <span class="track"></span></label></div></div></div>`;
      const input = card.querySelector("input");
      input.checked = isEnabled(addon.manifest.id);
      const list = addon.manifest.category === "theme" ? themeList : addon.manifest.category === "tweak" ? tweakList : addonList;
      input.addEventListener("change", () => {
        input.checked = api.setEnabled(addon.manifest.id, input.checked);
        refreshFilters.get(list)?.();
      });
      list.append(card);
    }

    const setupCatalogFilters = (sectionId, list, label, singular, category) => {
      const section = shadow.getElementById(sectionId);
      const cards = [...list.querySelectorAll(".plugin-card[data-catalog-item]")];
      const tagLabels = new Map();
      for (const card of cards) {
        for (const tag of card.querySelectorAll(".plugin-tag")) tagLabels.set(tag.textContent.toLocaleLowerCase(), tag.textContent);
      }
      const tags = [...tagLabels].sort((left, right) => left[1].localeCompare(right[1]));
      const tools = document.createElement("div");
      tools.className = "catalog-tools";
      tools.innerHTML = `<div class="catalog-search-row"><label class="search-field">${SEARCH_ICON}<input class="catalog-search" type="search" placeholder="Search ${escapeAttribute(label.toLocaleLowerCase())}" aria-label="Search ${escapeAttribute(label.toLocaleLowerCase())}"></label>
        <button class="generate-action" type="button" data-category="${escapeAttribute(category)}" aria-label="Generate ${escapeAttribute(singular)}"><span class="generate-plus" aria-hidden="true">+</span><span>Generate ${escapeHtml(singular)}</span></button></div>
        <div class="filter-row"><div class="filter-set"><span class="filter-label">Show</span><div class="filter-options status-options" role="group" aria-label="Filter ${escapeAttribute(label.toLocaleLowerCase())} by status">
          <button class="filter-chip active" type="button" data-status="all" aria-pressed="true">All</button>
          <button class="filter-chip" type="button" data-status="enabled" aria-pressed="false">Enabled</button>
          <button class="filter-chip" type="button" data-status="disabled" aria-pressed="false">Disabled</button></div></div>
          <div class="filter-set"><span class="filter-label">Tags</span><div class="filter-options tag-options" role="group" aria-label="Filter ${escapeAttribute(label.toLocaleLowerCase())} by tag"></div></div>
          <span class="result-count" aria-live="polite"></span></div>`;
      const tagOptions = tools.querySelector(".tag-options");
      for (const [tag, tagLabel] of tags) {
        const button = document.createElement("button");
        button.className = "filter-chip";
        button.type = "button";
        button.dataset.tag = tag;
        button.setAttribute("aria-pressed", "false");
        button.textContent = tagLabel;
        tagOptions.append(button);
      }
      section.insertBefore(tools, list);
      const empty = document.createElement("div");
      empty.className = "empty-results";
      empty.hidden = true;
      empty.textContent = `No ${label.toLocaleLowerCase()} match these filters.`;
      list.append(empty);
      const search = tools.querySelector(".catalog-search");
      tools.querySelector(".generate-action").addEventListener("click", () => openAddonGenerator(category), { signal: controller.signal });
      const resultCount = tools.querySelector(".result-count");
      const selectedTags = new Set();
      let status = "all";
      const apply = () => {
        const query = search.value.trim().toLocaleLowerCase();
        let visible = 0;
        for (const card of cards) {
          const input = card.querySelector("input[data-addon]");
          const cardTags = card.dataset.tags.split("|").filter(Boolean);
          const matchesSearch = !query || card.dataset.search.includes(query);
          const matchesStatus = status === "all" || status === "enabled" && input.checked || status === "disabled" && !input.checked;
          const matchesTags = [...selectedTags].every((tag) => cardTags.includes(tag));
          card.hidden = !(matchesSearch && matchesStatus && matchesTags);
          if (!card.hidden) visible += 1;
        }
        empty.hidden = visible !== 0;
        resultCount.textContent = `${visible} ${visible === 1 ? singular : label.toLocaleLowerCase()}`;
      };
      search.addEventListener("input", apply, { signal: controller.signal });
      for (const button of tools.querySelectorAll("[data-status]")) {
        button.addEventListener("click", () => {
          status = button.dataset.status;
          tools.querySelectorAll("[data-status]").forEach((item) => {
            const active = item === button;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
          });
          apply();
        }, { signal: controller.signal });
      }
      for (const button of tools.querySelectorAll("[data-tag]")) {
        button.addEventListener("click", () => {
          if (selectedTags.has(button.dataset.tag)) selectedTags.delete(button.dataset.tag); else selectedTags.add(button.dataset.tag);
          const active = selectedTags.has(button.dataset.tag);
          button.classList.toggle("active", active);
          button.setAttribute("aria-pressed", String(active));
          apply();
        }, { signal: controller.signal });
      }
      refreshFilters.set(list, apply);
      apply();
    };
    setupCatalogFilters("addons", addonList, "Add-ons", "add-on", "addon");
    setupCatalogFilters("tweaks", tweakList, "Tweaks", "tweak", "tweak");
    setupCatalogFilters("themes", themeList, "Themes", "theme", "theme");

    const updateCheck = shadow.querySelector(".update-check");
    const updateStatus = shadow.querySelector(".update-status");
    const updateDownload = shadow.querySelector(".update-download");
    const automaticUpdateToggle = shadow.querySelector(".autoupdate-toggle");
    automaticUpdateToggle.addEventListener("change", () => {
      preferenceStorage.setItem(AUTO_UPDATE_STORAGE_KEY, automaticUpdateToggle.checked ? "true" : "false");
    }, { signal: controller.signal });
    const requestLatestRelease = () => new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => finish(new Error("Update check timed out")), 10_000);
      const receive = (event) => {
        if (event.detail?.requestId !== requestId) return;
        finish(event.detail.error ? new Error(event.detail.error) : null, event.detail.release);
      };
      const abort = () => finish(new DOMException("Update check aborted", "AbortError"));
      const finish = (error, release) => {
        clearTimeout(timeout);
        globalThis.removeEventListener("bettercodex:update-result", receive);
        controller.signal.removeEventListener("abort", abort);
        if (error) reject(error); else resolve(release);
      };
      globalThis.addEventListener("bettercodex:update-result", receive);
      controller.signal.addEventListener("abort", abort, { once: true });
      const bridge = globalThis.__BETTERCODEX_CHECK_FOR_UPDATES__;
      if (typeof bridge === "function") bridge(requestId);
      else finish(new Error("Update bridge is unavailable"));
    });
    const checkForUpdates = async () => {
      updateCheck.disabled = true;
      updateCheck.classList.add("checking");
      updateCheck.setAttribute("aria-label", "Checking for updates");
      updateStatus.textContent = "Looking for the latest release";
      updateDownload.hidden = true;
      try {
        const release = await requestLatestRelease();
        if (!release) {
          updateStatus.textContent = "No published updates yet";
          return;
        }
        const latestVersion = String(release.tag_name || "").replace(/^v/i, "");
        if (!latestVersion) throw new Error("Latest release has no version");
        if (compareVersions(latestVersion, payload.version) > 0) {
          updateStatus.textContent = `BetterCodex v${latestVersion} is available`;
          updateDownload.href = release.html_url;
          updateDownload.textContent = `Get v${latestVersion} ↗`;
          updateDownload.hidden = false;
          updateCheck.hidden = true;
        } else {
          updateStatus.textContent = "You’re on the latest version";
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[BetterCodex] Could not check for updates", error);
        updateStatus.textContent = "Couldn’t check for updates right now";
      } finally {
        if (!controller.signal.aborted) {
          updateCheck.disabled = false;
          updateCheck.classList.remove("checking");
          updateCheck.setAttribute("aria-label", "Check for updates");
        }
      }
    };
    updateCheck.addEventListener("click", checkForUpdates, { signal: controller.signal });

    const syncHostBounds = () => {
      const applicationMenu = document.querySelector('[aria-label="Application menu"]');
      const titlebar = applicationMenu?.parentElement;
      const top = titlebar ? Math.max(0, titlebar.getBoundingClientRect().bottom) : 0;
      host.style.top = `${top}px`;
    };
    const updateTheme = () => {
      const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
      const roots = [document.documentElement, document.body].filter(Boolean);
      const hasClass = (name) => roots.some((root) => root.classList.contains(name));
      const declaredTheme = roots.map((root) => [
        root.getAttribute("data-theme"),
        root.getAttribute("data-color-theme"),
        root.getAttribute("data-color-mode")
      ].filter(Boolean).join(" ")).join(" ").toLowerCase();
      const explicitlyDark = hasClass("electron-dark") || hasClass("vscode-dark") || hasClass("dark") || /\bdark\b/.test(declaredTheme);
      const explicitlyLight = hasClass("electron-light") || hasClass("vscode-light") || hasClass("light") || /\blight\b/.test(declaredTheme);
      const dark = explicitlyDark || (!explicitlyLight && prefersDark);
      host.dataset.theme = dark ? "dark" : "light";
      launcher?.querySelector("[data-bettercodex-icon]")?.style.setProperty("color", dark ? "#fff" : "#000");
    };
    const open = () => {
      syncHostBounds();
      previousOverflow = document.body?.style.overflow || "";
      if (document.body) document.body.style.overflow = "hidden";
      host.style.display = "block";
      shadow.querySelector(".back").focus();
    };
    const close = () => {
      host.style.display = "none";
      if (document.body) document.body.style.overflow = previousOverflow;
      launcher?.focus();
    };
    const waitForComposer = async (previousEditor = null, transition = null) => {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const editor = document.querySelector("[data-codex-composer]");
        if (editor && (editor !== previousEditor || transition?.changed || attempt >= 8)) return editor;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return null;
    };
    const writeComposerText = (editor, value) => {
      editor.focus({ preventScroll: true });
      const selection = document.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection?.removeAllRanges();
      selection?.addRange(range);
      let inserted = false;
      try { inserted = Boolean(document.execCommand?.("insertText", false, value)); } catch {}
      if (!inserted) {
        editor.textContent = value;
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      }
    };
    const generatorKinds = {
      addon: { noun: "add-on", section: "Add-ons", examplePrompt: "Add an add-on that copies the latest assistant response." },
      tweak: { noun: "tweak", section: "Tweaks", examplePrompt: "Add a tweak that keeps useful task activity expanded." },
      theme: { noun: "theme", section: "Themes", examplePrompt: "Add a warm, low-contrast theme for Codex." }
    };
    const buildAddonRequirements = (category) => {
      const kind = generatorKinds[category] || generatorKinds.addon;
      const target = payload.catalogPaths?.[category] || `the ${category === "addon" ? "addons" : `${category}s`} directory inside this BetterCodex installation`;
      return `# BetterCodex ${kind.noun} requirements\n\n` +
        `Create and install the ${kind.noun} in this target directory: ${target}\n\n` +
        `Use the user's message as the requested ${kind.noun} behavior. This attachment is the implementation contract; the user should not need to repeat any of it.\n\n` +
        `## Product boundaries\n\n` +
        `BetterCodex is a runtime patcher for the official ChatGPT Codex Windows app. Work only inside the target category directory. Do not create a standalone app, Codex marketplace plugin, skill, MCP server, or browser extension. Do not modify Codex executables, signed MSIX files, app.asar, update settings, launcher behavior, or BetterCodex core unless the user explicitly asks for a core change. Never copy or redistribute Codex source bundles.\n\n` +
        `## ${kind.section} contract and structure\n\n` +
        `This entry belongs in BetterCodex ${kind.section}; set manifest category to \"${category}\" exactly. An add-on is a distinct feature or workflow, a tweak is one focused improvement to existing behavior, and a theme is an app-wide visual treatment that does not replace product behavior. Inspect the current sibling entries in this category first, then read every file and focused test for the closest similar entry. Follow those current conventions. Create exactly one <kebab-case-id> directory directly under the target category directory. It must contain manifest.json, index.js, and screenshot.svg. Do not add dependencies or a build step unless the requested feature cannot reasonably work without them. Keep the entry self-contained.\n\n` +
        `manifest.json must contain id, name, version, description, creator, category, tags, screenshot, and enabledByDefault. Category must remain \"${category}\". Set creator to the creator's concise public display name when the user provides one; otherwise use \"Local creator\" without guessing their identity. If the entry already has a public HTTP or HTTPS page, include it as shareUrl; otherwise omit shareUrl. Add 1 to 3 short, useful tags that match terminology used by related BetterCodex entries and help people search and filter the catalog. The id must exactly match the directory name and the id passed to BetterCodex.register. Start at version 0.1.0. Set screenshot to screenshot.svg. Write short, friendly copy suitable for the BetterCodex ${kind.section} page. Themes are opt-in and must set enabledByDefault to false unless the user explicitly requires otherwise; tweaks and add-ons should use the safest sensible first-run state.\n\n` +
        `index.js runs as classic browser JavaScript inside the Codex renderer. It has no imports, require(), module system, package dependencies, or Node.js APIs. Register it with BetterCodex.register({ id, start, stop }). start() must be idempotent even if BetterCodex hot-reloads it repeatedly. stop() must fully reverse the add-on: disconnect MutationObservers, clear timers, remove event listeners and injected DOM/style nodes, and restore every native node or attribute it changed. Keep state private to the add-on and use stable data attributes for anything injected. Store persistent add-on preferences with BetterCodex.storage using a key that begins with bettercodex so they survive Codex updates and BetterCodex reinstallations.\n\n` +
        `Treat Codex's DOM as private and updateable. Prefer semantic attributes, accessible labels, and narrow structural checks over generated class names. Observe the smallest practical root, debounce or batch repeated scans, avoid polling when a MutationObserver works, and fail quietly if the expected UI is absent. Preserve native keyboard, focus, scrolling, approval, composer, and navigation behavior. Reuse Codex's visual language and CSS variables where available; support both light and dark themes.\n\n` +
        `Treat Codex's existing UI as the component library. Before creating a button, menu, input, dialog, panel, row, badge, tooltip, or navigation item, inspect the nearby native equivalent and reuse the native element or existing surface when feasible. Prefer inserting into a native container, exposing an existing control, or adapting the same semantic structure over building a parallel custom component. Do not introduce a component framework, custom design system, custom modal shell, or web-component layer. When a new control is essential, match the neighboring native component's element type, accessible name, icon sizing, focus behavior, disabled state, hover and pressed states, spacing, and theme variables. A theme must style native Codex and BetterCodex components in place; a tweak should usually alter a native behavior or component; an add-on may compose native components into a larger workflow only when the requested feature needs it.\n\n` +
        `screenshot.svg must be a polished 640x280 preview of the feature as its card header. It should be valid standalone SVG, legible in BetterCodex's dark settings UI, and contain no external assets, scripts, or remote fonts.\n\n` +
        `## Implementation approach\n\n` +
        `Read every existing file in the closest sibling add-on that solves a similar kind of renderer problem before writing code. Reuse its lifecycle and defensive DOM patterns, but do not make one add-on depend on another. Keep constants and selectors near the top of index.js, keep start() and stop() easy to audit, and use small named helpers instead of one long mutation callback. Do not expose globals other than the required BetterCodex registration. Avoid innerHTML for user-controlled data, avoid overriding native prototypes, and do not intercept broad click or keyboard events when a scoped listener will work.\n\n` +
        `If the feature injects a control, give it an accessible name, an obvious focus state, and behavior that works with keyboard as well as pointer input. Insert it only after the native anchor exists, never flash it over Codex's loading UI, and prevent duplicates during navigation or hot reload. If the feature moves or wraps native UI, record its original parent, sibling, styles, attributes, and state so stop() can put it back exactly. If it changes content automatically, handle both already-mounted content and content added later without fighting the user's own actions.\n\n` +
        `Use a single owned style element when CSS is necessary and remove it during stop(). Scope every rule beneath a unique data-bettercodex-* marker so it cannot leak into the rest of Codex. Prefer inherited fonts and currentColor. Avoid hard-coded page widths, theme backgrounds, and generated class names. Match Codex's compact spacing, borders, corner radii, hover states, and muted text rather than inventing a separate visual system. Do not show a custom toast, dialog, or settings surface unless it is essential to the requested behavior.\n\n` +
        `Mutation work must stay cheap on long conversations. Filter MutationObserver records before scanning, query only the affected subtree where possible, and mark processed nodes. Do not run unbounded intervals, repeatedly rewrite unchanged DOM, or observe document attributes broadly. Any timeout, animation frame, observer, abort controller, and listener created by start() belongs to the add-on and must be cancelled by stop(). start(); start(); stop(); stop(); must be safe. Disabling the add-on in BetterCodex settings must visibly restore Codex without requiring a reload.\n\n` +
        `Do not silently broaden the requested feature. If a detail is ambiguous, choose the smallest behavior consistent with the user's prompt and existing Codex conventions. Ask a concise follow-up only when the missing choice would materially change the result. Do not replace native UI merely to restyle it; prefer moving, revealing, or augmenting the existing element. Never auto-send messages, approve commands, change permissions, select a project, or perform external actions unless that exact behavior is the requested add-on.\n\n` +
        `## Acceptance checklist\n\n` +
        `Before finishing, confirm: the ${kind.noun} appears under BetterCodex ${kind.section} with a working enable/disable toggle; category is \"${category}\"; tags describe it accurately; native components were reused wherever practical; enabledByDefault matches the category guidance; repeated start() calls create no duplicates; stop() leaves no owned DOM, styles, observers, listeners, or timers; navigation and newly mounted Codex UI are handled; absent or changed native UI causes no uncaught errors; light and dark themes remain readable; the screenshot accurately represents the feature; manifest and registration ids match; and no file outside the one entry directory was changed unless a focused repository test truly required it.\n\n` +
        `## Verification\n\n` +
        `Validate the manifest JSON and parse index.js. If this target is a BetterCodex source checkout, add focused tests for behavior and cleanup when practical, then run the repository's available test and build commands. Do not weaken existing tests. Briefly report the files created, what the add-on does, and verification results. Do not commit, push, package, publish, or create a release.`;
    };
    const findProjectlessOption = () => [...document.querySelectorAll("button, [role='option'], [role='menuitem']")]
      .find((element) => {
        const text = element.textContent?.replace(/\s+/g, " ").trim() || "";
        return /don't work in a project/i.test(text) || /^none$/i.test(text);
      });
    const clearProject = async (editor) => {
      const projectSelector = [...document.querySelectorAll("button")]
        .find((button) => /^(change project:|choose project$)/i.test(button.getAttribute("aria-label") || ""));
      if (projectSelector) projectSelector.click();
      else writeComposerText(editor, "/project");

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const option = findProjectlessOption();
        if (option) {
          option.click();
          return await waitForComposer(editor) || document.querySelector("[data-codex-composer]") || editor;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return document.querySelector("[data-codex-composer]") || editor;
    };
    const createClipboardTransfer = (value) => {
      if (typeof DataTransfer === "function") {
        const transfer = new DataTransfer();
        transfer.setData("text/plain", value);
        return transfer;
      }
      return {
        types: ["text/plain"],
        getData: (type) => type === "text/plain" ? value : ""
      };
    };
    const attachAddonRequirements = (editor, category) => {
      const clipboardData = createClipboardTransfer(buildAddonRequirements(category));
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: clipboardData });
      editor.dispatchEvent(event);
    };
    const openAddonGenerator = async (category = "addon") => {
      const kind = generatorKinds[category] || generatorKinds.addon;
      close();
      const previousEditor = document.querySelector("[data-codex-composer]");
      const transition = { changed: previousEditor == null };
      const transitionObserver = new MutationObserver((records) => {
        if (!previousEditor) return;
        for (const record of records) {
          for (const node of record.removedNodes) {
            if (node === previousEditor || node.nodeType === 1 && node.contains(previousEditor)) transition.changed = true;
          }
        }
      });
      transitionObserver.observe(document.documentElement, { childList: true, subtree: true });
      const newChat = [...document.querySelectorAll("button, a")]
        .find((element) => /^new chat$/i.test(element.textContent?.trim() || ""));
      newChat?.click();
      let editor = await waitForComposer(previousEditor, transition);
      transitionObserver.disconnect();
      if (!editor) return;
      editor = await clearProject(editor);
      if (!editor) return;
      attachAddonRequirements(editor, category);
      writeComposerText(editor, kind.examplePrompt);
    };

    const api = {
      version: payload.version,
      repository: payload.repository,
      register(implementation) {
        if (!catalog.has(implementation?.id)) throw new Error(`Unknown BetterCodex add-on: ${implementation?.id}`);
        implementations.set(implementation.id, implementation);
        if (isEnabled(implementation.id)) start(implementation.id);
      },
      setEnabled(id, enabled) {
        if (!catalog.has(id)) return false;
        stored[id] = Boolean(enabled);
        save();
        if (enabled) start(id); else stop(id);
        return active.has(id);
      },
      isEnabled,
      storage: preferenceStorage,
      open,
      close,
      destroy() {
        const ownsGlobal = globalThis.BetterCodex === api;
        controller.abort();
        for (const id of [...active]) stop(id);
        if (document.body) document.body.style.overflow = previousOverflow;
        if (ownsGlobal) removeNativeLaunchers(); else launcher?.remove();
        launcherStyle.remove();
        host.remove();
        if (ownsGlobal) delete globalThis.BetterCodex;
      }
    };
    globalThis.BetterCodex = api;

    const findHelpButton = () => [...document.querySelectorAll("button")].find((element) => {
      const rect = element.getBoundingClientRect();
      const hiddenByTweak = element.hasAttribute("data-bettercodex-hide-sidebar-help");
      return /open help menu/i.test(element.getAttribute("aria-label") || "") && (hiddenByTweak || rect.bottom > innerHeight - 100);
    });
    const mountLauncher = () => {
      if (launcher?.isConnected) {
        removeNativeLaunchers(launcher);
        return;
      }
      removeNativeLaunchers();
      const help = findHelpButton();
      if (!help?.parentElement) return;
      launcher = help.cloneNode(false);
      launcher.id = LAUNCHER_ID;
      launcher.removeAttribute("data-bettercodex-hide-sidebar-help");
      for (const attribute of ["aria-haspopup", "aria-expanded", "data-state", "data-disabled"]) launcher.removeAttribute(attribute);
      launcher.removeAttribute("disabled");
      launcher.setAttribute("aria-label", "Open BetterCodex");
      launcher.title = "BetterCodex";
      launcher.innerHTML = BETTERCODEX_ICON;
      launcher.addEventListener("click", open, { signal: controller.signal });
      help.after(launcher);
      updateTheme();
    };

    let mountScheduled = false;
    const scheduleMount = () => {
      if (mountScheduled) return;
      mountScheduled = true;
      setTimeout(() => { mountScheduled = false; syncHostBounds(); mountLauncher(); updateTheme(); }, 0);
    };
    const observer = new MutationObserver(scheduleMount);
    const beginObserving = () => observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-color-theme", "data-color-mode"]
    });
    if (document.documentElement) beginObserving();
    else document.addEventListener("DOMContentLoaded", beginObserving, { once: true, signal: controller.signal });
    controller.signal.addEventListener("abort", () => observer.disconnect(), { once: true });
    window.addEventListener("resize", syncHostBounds, { signal: controller.signal });

    shadow.querySelector(".back").addEventListener("click", close, { signal: controller.signal });
    for (const nav of shadow.querySelectorAll(".nav")) {
      nav.addEventListener("click", () => {
        shadow.querySelectorAll(".nav").forEach((item) => {
          const selected = item === nav;
          item.classList.toggle("active", selected);
          if (selected) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
        });
        shadow.querySelectorAll(".section").forEach((section) => { section.hidden = section.id !== nav.dataset.target; });
        const label = nav.querySelector(".nav-label").textContent.trim();
        const title = shadow.getElementById("bettercodex-title");
        if (nav.dataset.target === "bettercodex") title.innerHTML = `${BETTERCODEX_ICON}<span>${escapeHtml(label)}</span>`;
        else title.textContent = label;
        shadow.querySelector(".main").scrollTop = 0;
      }, { signal: controller.signal });
    }
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && host.style.display !== "none") close(); }, { signal: controller.signal });

    const mount = () => {
      if (!host.isConnected) document.body.append(host);
      syncHostBounds();
      updateTheme();
      mountLauncher();
    };
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true, signal: controller.signal });

    for (const addon of payload.addons) {
      try { (0, eval)(addon.source); }
      catch (error) { console.error(`[BetterCodex] Could not load ${addon.manifest.id}`, error); }
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function escapeAttribute(value) { return escapeHtml(value); }
  function compareVersions(left, right) {
    const parts = (value) => String(value).replace(/^v/i, "").split(".").slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
    const leftParts = parts(left);
    const rightParts = parts(right);
    for (let index = 0; index < 3; index += 1) {
      if ((leftParts[index] || 0) !== (rightParts[index] || 0)) return (leftParts[index] || 0) > (rightParts[index] || 0) ? 1 : -1;
    }
    return 0;
  }
  globalThis.__BETTERCODEX_INJECT__ = install;
})();
