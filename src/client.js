(() => {
  const ROOT_ID = "blackbox-client-root";
  const STORAGE_KEY = "blackbox:addons:v1";

  function install(payload) {
    globalThis.Blackbox?.destroy?.();
    document.getElementById(ROOT_ID)?.remove();

    const catalog = new Map(payload.addons.map((addon) => [addon.manifest.id, addon]));
    const implementations = new Map();
    const active = new Set();
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch {}

    const isEnabled = (id) => stored[id] ?? Boolean(catalog.get(id)?.manifest.enabledByDefault);
    const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const start = (id) => {
      if (active.has(id)) return;
      const implementation = implementations.get(id);
      if (!implementation) return;
      try {
        implementation.start?.();
        active.add(id);
      } catch (error) {
        console.error(`[Blackbox] Could not start ${id}`, error);
        stored[id] = false;
        save();
      }
    };

    const stop = (id) => {
      if (!active.has(id)) return;
      try { implementations.get(id)?.stop?.(); }
      catch (error) { console.error(`[Blackbox] Could not stop ${id}`, error); }
      active.delete(id);
    };

    const api = {
      version: payload.version,
      repository: payload.repository,
      register(implementation) {
        if (!catalog.has(implementation?.id)) throw new Error(`Unknown Blackbox add-on: ${implementation?.id}`);
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
      destroy() {
        for (const id of [...active]) stop(id);
        document.getElementById(ROOT_ID)?.remove();
        if (globalThis.Blackbox === api) delete globalThis.Blackbox;
      }
    };
    globalThis.Blackbox = api;

    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; color-scheme: dark; }
        * { box-sizing: border-box; }
        button, a { font: inherit; }
        .launcher { pointer-events:auto; position:fixed; left:8px; bottom:55px; width:239px; height:36px;
          display:flex; align-items:center; gap:9px; padding:0 10px; border:0; border-radius:8px;
          color:#eee; background:transparent; cursor:pointer; font:13px/1 system-ui,-apple-system,"Segoe UI",sans-serif; text-align:left; }
        .launcher:hover { background:#1d1d1d; }
        .mark { width:20px; height:20px; display:grid; place-items:center; border-radius:6px;
          color:white; font-size:11px; font-weight:750; background:linear-gradient(145deg,#8b5cf6,#5b21b6); }
        .backdrop { pointer-events:auto; position:fixed; inset:0; display:none; align-items:flex-end; justify-content:flex-start;
          padding:0 0 99px 8px; background:rgba(0,0,0,.16); }
        .backdrop.open { display:flex; }
        .panel { width:310px; max-height:calc(100vh - 130px); overflow:auto; color:#ececec; background:#171717;
          border:1px solid #333; border-radius:12px; box-shadow:0 18px 55px rgba(0,0,0,.55);
          font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 16px 13px; }
        h2 { margin:0 0 3px; font-size:15px; font-weight:650; }
        .version { color:#929292; font-size:12px; }
        .close { width:28px; height:28px; border:0; border-radius:7px; color:#aaa; background:transparent; cursor:pointer; }
        .close:hover { color:white; background:#292929; }
        .repo { display:block; margin:0 16px 14px; color:#b6a7ff; text-decoration:none; }
        .repo:hover { text-decoration:underline; }
        .section-title { padding:11px 16px 7px; border-top:1px solid #2b2b2b; color:#8f8f8f; font-size:11px;
          font-weight:650; letter-spacing:.08em; text-transform:uppercase; }
        .addon { display:flex; gap:12px; align-items:center; padding:10px 16px; }
        .addon-copy { min-width:0; flex:1; }
        .addon-name { color:#eee; font-weight:600; }
        .addon-description { margin-top:2px; color:#979797; font-size:12px; }
        .switch { position:relative; width:34px; height:20px; flex:0 0 auto; }
        .switch input { position:absolute; opacity:0; }
        .track { position:absolute; inset:0; border-radius:99px; background:#444; cursor:pointer; transition:.15s; }
        .track::after { content:""; position:absolute; left:3px; top:3px; width:14px; height:14px; border-radius:50%;
          background:white; transition:.15s; }
        input:checked + .track { background:#7c3aed; }
        input:checked + .track::after { transform:translateX(14px); }
        .empty { padding:2px 16px 16px; color:#888; }
      </style>
      <button class="launcher" type="button" aria-label="Open Blackbox"><span class="mark">B</span><span>Blackbox</span></button>
      <div class="backdrop" role="presentation">
        <section class="panel" role="dialog" aria-modal="true" aria-labelledby="blackbox-title">
          <div class="head"><div><h2 id="blackbox-title">Blackbox</h2><div class="version">Version ${escapeHtml(payload.version)}</div></div>
            <button class="close" type="button" aria-label="Close">✕</button></div>
          <a class="repo" href="${escapeAttribute(payload.repository)}" target="_blank" rel="noreferrer">View source repository ↗</a>
          <div class="section-title">Add-ons</div>
          <div class="addons"></div>
        </section>
      </div>`;

    const addonList = shadow.querySelector(".addons");
    if (!payload.addons.length) addonList.innerHTML = '<div class="empty">No add-ons installed.</div>';
    for (const addon of payload.addons) {
      const row = document.createElement("div");
      row.className = "addon";
      row.innerHTML = `<div class="addon-copy"><div class="addon-name">${escapeHtml(addon.manifest.name)}</div>
        <div class="addon-description">${escapeHtml(addon.manifest.description)}</div></div>
        <label class="switch" title="Enable ${escapeAttribute(addon.manifest.name)}"><input type="checkbox" data-addon="${escapeAttribute(addon.manifest.id)}">
        <span class="track"></span></label>`;
      const input = row.querySelector("input");
      input.checked = isEnabled(addon.manifest.id);
      input.addEventListener("change", () => { input.checked = api.setEnabled(addon.manifest.id, input.checked); });
      addonList.append(row);
    }

    const backdrop = shadow.querySelector(".backdrop");
    const close = () => backdrop.classList.remove("open");
    shadow.querySelector(".launcher").addEventListener("click", () => backdrop.classList.add("open"));
    shadow.querySelector(".close").addEventListener("click", close);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); }, { signal: abortSignal(api) });
    (document.body || document.documentElement).append(host);

    for (const addon of payload.addons) {
      try { (0, eval)(addon.source); }
      catch (error) { console.error(`[Blackbox] Could not load ${addon.manifest.id}`, error); }
    }
    return true;
  }

  function abortSignal(api) {
    const controller = new AbortController();
    const destroy = api.destroy;
    api.destroy = () => { controller.abort(); destroy(); };
    return controller.signal;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function escapeAttribute(value) { return escapeHtml(value); }
  globalThis.__BLACKBOX_INJECT__ = install;
})();
