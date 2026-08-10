# Blackbox

Blackbox is a Vencord-style client mod for the official Codex Windows app. Patch once, keep receiving Codex updates, and launch **Blackbox for Codex** to get a Blackbox button in the bottom-left sidebar.

Blackbox does not rewrite Codex's signed MSIX package or `app.asar`. Its launcher finds the newest installed Codex version, starts the official executable with a loopback-only debugging endpoint, then injects the Blackbox UI at runtime.

## Patch

```powershell
npm install
npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\patch.ps1
```

Quit Codex completely, then open **Blackbox for Codex** from the Desktop or Start menu. The original Codex shortcut remains untouched.

The bottom-left Blackbox button opens a compact panel containing:

- the installed Blackbox version;
- a link to the source repository;
- enable/disable switches for every installed Blackbox add-on.

## Add-ons

Each add-on lives in `addons/<id>/` and contains a `manifest.json` plus `index.js`. Add-on code registers itself with `Blackbox.register({ id, start, stop })`. Disabled state is persisted in Codex's local storage and `stop()` is called immediately when an add-on is turned off.

## Unpatch

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unpatch.ps1
```

Unpatching removes the Blackbox runtime and shortcuts only. It never modifies or removes the official Codex app.

## Develop

```powershell
npm test
npm run build
```

This is an unofficial client modification. The injection layer may need an update when Codex changes its renderer.
