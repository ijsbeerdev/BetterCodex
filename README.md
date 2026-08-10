# Blackbox

Blackbox is a Vencord-style client mod for the official Codex Windows app. Patch once, keep receiving Codex updates, and launch Codex normally to get a Blackbox button in the bottom-left sidebar.

Blackbox does not rewrite Codex's signed MSIX package or `app.asar`. A per-user launch watcher detects a normal Codex launch, immediately relaunches that fresh process with a loopback-only debugging endpoint, then injects the Blackbox UI at runtime. Its launcher resolves the newest installed Codex version each time.

## Install

Download `blackbox-0.2.0-windows-x64.zip` from the latest GitHub release, extract the entire ZIP, then double-click **Install Blackbox.cmd**. The package includes its own verified portable runtime, so Node.js and npm are not required.

Quit Codex completely, then launch it through the normal Start menu or taskbar entry. The first window may briefly disappear while the watcher relaunches it with Blackbox. A separate **Blackbox for Codex** shortcut remains available as a fallback.

For development installs from source:

```powershell
npm install
npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\patch.ps1
```

The bottom-left Blackbox button is inserted into Codex's native account toolbar beside Help. It uses Codex's own package icon and follows the active light or dark theme. It opens a full-window settings-style Blackbox view containing:

- the installed Blackbox version;
- a link to the source repository;
- screenshot cards and enable/disable switches for every installed Blackbox add-on;
- a **Generate addon** action that opens a fresh Codex task with the exact installation path and self-contained Blackbox scaffold requirements; Codex asks what to build inside that new task.

## Hot Reload

Hot Reload is enabled by default. While Codex is open, changes to the injected client or anything inside this repository's `addons/` directory are debounced and reinjected into every Blackbox renderer. Add, edit, or remove an add-on—or refine the Blackbox UI—without restarting Codex. Turn **Hot Reload** off in the Blackbox view to pause updates for the renderer.

## Approval Shelf

Approval Shelf preserves Codex's actual composer beneath approval prompts instead of replacing it with custom UI. The same native editor, controls, theme, and draft remain visible, and Codex reuses that editor when the approval resolves. It is enabled by default and can be toggled from **Blackbox settings → Plugins**.

## Auto Expand Activity

Auto Expand Activity automatically opens collapsed command and file-edit groups in the chat transcript. Newly added activity is expanded as it appears, and the behavior can be toggled from **Blackbox settings → Plugins**.

## Add-ons

Each add-on lives in `addons/<id>/` and contains a `manifest.json`, `index.js`, and screenshot asset referenced by the manifest. Add-on code registers itself with `Blackbox.register({ id, start, stop })`. Disabled state is persisted in Codex's local storage and `stop()` is called immediately when an add-on is turned off.

## Unpatch

Release installs include **Uninstall Blackbox.cmd**. Double-click it to remove Blackbox. For source installs, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unpatch.ps1
```

Unpatching stops and removes the launch watcher, then removes the Blackbox runtime and shortcuts. It never modifies or removes the official Codex app.

## Develop

```powershell
npm test
npm run build
npm run package
```

This is an unofficial client modification. The injection layer may need an update when Codex changes its renderer.
