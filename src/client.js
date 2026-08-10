(() => {
  const ROOT_ID = "blackbox-client-root";
  const LAUNCHER_ID = "blackbox-native-launcher";
  const STORAGE_KEY = "blackbox:addons:v1";

  function install(payload) {
    globalThis.Blackbox?.destroy?.();
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(LAUNCHER_ID)?.remove();

    const catalog = new Map(payload.addons.map((addon) => [addon.manifest.id, addon]));
    const implementations = new Map();
    const active = new Set();
    const controller = new AbortController();
    let launcher;
    let previousOverflow = "";
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

    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.style.cssText = "display:none;position:fixed;inset:0;z-index:2147483647";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all:initial; --bg:#fff; --side:#f7f7f7; --surface:#f3f3f3; --surface-hover:#e9e9e9; --border:#dedede;
          --text:#161616; --muted:#666; --accent:#111; color-scheme:light; }
        :host([data-theme="dark"]) { --bg:#0a0a0a; --side:#0d0d0d; --surface:#171717; --surface-hover:#202020;
          --border:#292929; --text:#f2f2f2; --muted:#9a9a9a; --accent:#fff; color-scheme:dark; }
        * { box-sizing:border-box; }
        button, a, input { font:inherit; }
        .view { width:100vw; height:100vh; display:grid; grid-template-rows:44px minmax(0,1fr); color:var(--text);
          background:var(--bg); font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif; }
        .topbar { grid-column:1/-1; display:flex; align-items:center; padding:0 12px; border-bottom:1px solid var(--border); }
        .back { display:flex; align-items:center; gap:7px; height:30px; padding:0 8px; color:var(--muted); background:transparent;
          border:0; border-radius:7px; cursor:pointer; }
        .back:hover { color:var(--text); background:var(--surface-hover); }
        .shell { min-height:0; display:grid; grid-template-columns:256px minmax(0,1fr); }
        .sidebar { padding:22px 10px; border-right:1px solid var(--border); background:var(--side); }
        .brand { display:flex; align-items:center; gap:9px; padding:0 9px 18px; font-size:14px; font-weight:650; }
        .box { width:14px; height:14px; border-radius:3px; background:var(--accent); }
        .caption { padding:8px 9px 6px; color:var(--muted); font-size:11px; font-weight:650; }
        .nav { width:100%; height:32px; display:flex; align-items:center; padding:0 9px; color:var(--text); background:transparent;
          border:0; border-radius:7px; text-align:left; cursor:pointer; }
        .nav:hover, .nav.active { background:var(--surface-hover); }
        .main { min-width:0; overflow:auto; }
        .content { width:min(760px,calc(100% - 64px)); margin:0 auto; padding:58px 0 100px; }
        h1 { margin:0 0 34px; font-size:22px; line-height:1.2; font-weight:650; }
        h2 { margin:0 0 10px; font-size:13px; font-weight:650; }
        .section { margin-bottom:36px; scroll-margin-top:30px; }
        .card { overflow:hidden; border:1px solid var(--border); border-radius:12px; background:var(--surface); }
        .row { min-height:58px; display:flex; align-items:center; gap:16px; padding:11px 14px; }
        .row + .row { border-top:1px solid var(--border); }
        .copy { min-width:0; flex:1; }
        .name { font-weight:600; }
        .description { margin-top:2px; color:var(--muted); font-size:12px; }
        .version { flex:none; color:var(--muted); font-variant-numeric:tabular-nums; }
        .repo { flex:none; padding:5px 9px; border:1px solid var(--border); border-radius:7px; color:var(--text);
          background:var(--surface-hover); text-decoration:none; }
        .repo:hover { border-color:var(--muted); }
        .switch { position:relative; width:36px; height:20px; flex:0 0 auto; }
        .switch input { position:absolute; opacity:0; pointer-events:none; }
        .track { position:absolute; inset:0; border-radius:99px; background:#555; cursor:pointer; transition:.15s; }
        .track::after { content:""; position:absolute; left:3px; top:3px; width:14px; height:14px; border-radius:50%;
          background:#fff; transition:.15s; }
        input:checked + .track { background:#1688e8; }
        input:checked + .track::after { transform:translateX(16px); }
        .empty { padding:18px 14px; color:var(--muted); }
        @media (max-width:700px) { .shell { grid-template-columns:190px minmax(0,1fr); } .content { width:calc(100% - 32px); } }
      </style>
      <div class="view" role="dialog" aria-modal="true" aria-labelledby="blackbox-title">
        <header class="topbar"><button class="back" type="button" aria-label="Back to app"><span>←</span><span>Back to app</span></button></header>
        <div class="shell">
          <aside class="sidebar">
            <div class="brand"><span class="box"></span><span>Blackbox</span></div>
            <div class="caption">Blackbox</div>
            <button class="nav active" type="button" data-target="general">General</button>
            <button class="nav" type="button" data-target="addons">Add-ons</button>
          </aside>
          <main class="main">
            <div class="content">
              <h1 id="blackbox-title">Blackbox</h1>
              <section class="section" id="general"><h2>General</h2><div class="card">
                <div class="row"><div class="copy"><div class="name">Version</div><div class="description">Installed Blackbox runtime</div></div><div class="version">${escapeHtml(payload.version)}</div></div>
                <div class="row"><div class="copy"><div class="name">Source code</div><div class="description">View Blackbox on GitHub</div></div>
                  <a class="repo" href="${escapeAttribute(payload.repository)}" target="_blank" rel="noreferrer">Open ↗</a></div>
              </div></section>
              <section class="section" id="addons" hidden><h2>Add-ons</h2><div class="card addons"></div></section>
            </div>
          </main>
        </div>
      </div>`;

    const addonList = shadow.querySelector(".addons");
    if (!payload.addons.length) addonList.innerHTML = '<div class="empty">No add-ons installed.</div>';
    for (const addon of payload.addons) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<div class="copy"><div class="name">${escapeHtml(addon.manifest.name)}</div>
        <div class="description">${escapeHtml(addon.manifest.description)}</div></div>
        <label class="switch" title="Enable ${escapeAttribute(addon.manifest.name)}"><input type="checkbox" data-addon="${escapeAttribute(addon.manifest.id)}">
        <span class="track"></span></label>`;
      const input = row.querySelector("input");
      input.checked = isEnabled(addon.manifest.id);
      input.addEventListener("change", () => { input.checked = api.setEnabled(addon.manifest.id, input.checked); });
      addonList.append(row);
    }

    const updateTheme = () => {
      const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = document.documentElement.classList.contains("electron-dark") ||
        (!document.documentElement.classList.contains("electron-light") && prefersDark);
      host.dataset.theme = dark ? "dark" : "light";
      launcher?.querySelector("[data-blackbox-box]")?.style.setProperty("background-color", dark ? "#fff" : "#000");
    };
    const open = () => {
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
      open,
      close,
      destroy() {
        controller.abort();
        for (const id of [...active]) stop(id);
        if (document.body) document.body.style.overflow = previousOverflow;
        launcher?.remove();
        host.remove();
        if (globalThis.Blackbox === api) delete globalThis.Blackbox;
      }
    };
    globalThis.Blackbox = api;

    const findHelpButton = () => [...document.querySelectorAll("button")].find((element) => {
      const rect = element.getBoundingClientRect();
      return /open help menu/i.test(element.getAttribute("aria-label") || "") && rect.bottom > innerHeight - 100;
    });
    const mountLauncher = () => {
      if (launcher?.isConnected) return;
      const help = findHelpButton();
      if (!help?.parentElement) return;
      launcher = help.cloneNode(false);
      launcher.id = LAUNCHER_ID;
      for (const attribute of ["aria-haspopup", "aria-expanded", "data-state", "data-disabled"]) launcher.removeAttribute(attribute);
      launcher.removeAttribute("disabled");
      launcher.setAttribute("aria-label", "Open Blackbox");
      launcher.title = "Blackbox";
      launcher.innerHTML = '<span data-blackbox-box aria-hidden="true" style="display:block;width:14px;height:14px;border-radius:3px"></span>';
      launcher.addEventListener("click", open, { signal: controller.signal });
      help.before(launcher);
      updateTheme();
    };

    let mountScheduled = false;
    const scheduleMount = () => {
      if (mountScheduled) return;
      mountScheduled = true;
      setTimeout(() => { mountScheduled = false; mountLauncher(); updateTheme(); }, 0);
    };
    const observer = new MutationObserver(scheduleMount);
    const beginObserving = () => observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    if (document.documentElement) beginObserving();
    else document.addEventListener("DOMContentLoaded", beginObserving, { once: true, signal: controller.signal });
    controller.signal.addEventListener("abort", () => observer.disconnect(), { once: true });

    shadow.querySelector(".back").addEventListener("click", close, { signal: controller.signal });
    for (const nav of shadow.querySelectorAll(".nav")) {
      nav.addEventListener("click", () => {
        shadow.querySelectorAll(".nav").forEach((item) => item.classList.toggle("active", item === nav));
        shadow.querySelectorAll(".section").forEach((section) => { section.hidden = section.id !== nav.dataset.target; });
        shadow.getElementById("blackbox-title").textContent = nav.textContent.trim();
        shadow.querySelector(".main").scrollTop = 0;
      }, { signal: controller.signal });
    }
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && host.style.display !== "none") close(); }, { signal: controller.signal });

    const mount = () => {
      if (!host.isConnected) document.body.append(host);
      updateTheme();
      mountLauncher();
    };
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true, signal: controller.signal });

    for (const addon of payload.addons) {
      try { (0, eval)(addon.source); }
      catch (error) { console.error(`[Blackbox] Could not load ${addon.manifest.id}`, error); }
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function escapeAttribute(value) { return escapeHtml(value); }
  globalThis.__BLACKBOX_INJECT__ = install;
})();
