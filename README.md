# Blackbox

Blackbox is a Vencord-style client mod for the official Codex Windows app. Patch once, keep receiving Codex updates, and launch Codex normally to get a Blackbox button in the bottom-left sidebar.

Blackbox does not rewrite Codex's signed MSIX package or `app.asar`. A per-user launch watcher detects a normal Codex launch, immediately relaunches that fresh process with a loopback-only debugging endpoint, then injects the Blackbox UI at runtime. Its launcher resolves the newest installed Codex version each time.

## Patch

```powershell
npm install
npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\patch.ps1
```

Quit Codex completely, then launch it through the normal Start menu or taskbar entry. The first window may briefly disappear while the watcher relaunches it with Blackbox. A separate **Blackbox for Codex** shortcut remains available as a fallback.

The bottom-left Blackbox button opens a compact panel containing:

- the installed Blackbox version;
- a link to the source repository;
- enable/disable switches for every installed Blackbox add-on.

## Hot Reload

Hot Reload is Blackbox's first bundled add-on and is enabled by default. While Codex is open, changes inside this repository's `addons/` directory are debounced and reinjected into every Blackbox renderer. Add, edit, or remove an add-on without restarting Codex. Turn **Hot Reload** off in the Blackbox panel to pause file watching for the renderer.

## Add-ons

Each add-on lives in `addons/<id>/` and contains a `manifest.json` plus `index.js`. Add-on code registers itself with `Blackbox.register({ id, start, stop })`. Disabled state is persisted in Codex's local storage and `stop()` is called immediately when an add-on is turned off.

## Unpatch

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unpatch.ps1
```

Unpatching stops and removes the launch watcher, then removes the Blackbox runtime and shortcuts. It never modifies or removes the official Codex app.

## Develop

```powershell
npm test
npm run build
```

This is an unofficial client modification. The injection layer may need an update when Codex changes its renderer.
