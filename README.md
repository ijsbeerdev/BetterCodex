# BetterCodex

<p align="center">
  <strong>A cozy, extensible mod loader for the official ChatGPT Codex Windows app.</strong>
</p>

<p align="center">
  <a href="https://github.com/ijsbeerdev/BetterCodex/releases/tag/v0.3.0"><img alt="Latest release: v0.3.0" src="https://img.shields.io/badge/release-v0.3.0-2ea44f?style=flat-square"></a>
  <img alt="Windows x64" src="https://img.shields.io/badge/Windows-x64-0078D4?style=flat-square&logo=windows11&logoColor=white">
</p>

BetterCodex adds a native-feeling add-on layer to ChatGPT Codex without rewriting the signed app package or `app.asar`. Install it once, keep receiving normal ChatGPT Codex updates, and open its compact settings hub from the robot icon beside **Help**.

> [!NOTE]
> BetterCodex is an unofficial community project and is not affiliated with or endorsed by OpenAI.

## ✨ What makes it better

- **Launch Codex normally** — the per-user watcher handles injection from your existing Start menu or taskbar shortcut.
- **Safe runtime patching** — the signed MSIX package, Codex executables, `app.asar`, and update settings stay untouched.
- **One-click controls** — every add-on has a visible enable/disable switch in a settings view that follows Codex's light and dark themes.
- **Update checks** — check the latest GitHub release from BetterCodex settings and jump straight to it when an update is available.
- **Instant development** — edit the client or an add-on and Hot Reload reinjects the change without restarting Codex.
- **Built-in add-on generation** — start a focused Codex task with the exact scaffold, lifecycle, and installation requirements already attached.
- **Clean removal** — uninstalling removes the watcher, shortcuts, and BetterCodex runtime while leaving Codex alone.

## 🧩 Included add-ons, tweaks, and themes

| Category | Feature | What it does |
| --- | --- | --- |
| Add-on | **Kanban** | Groups Codex tasks by live activity, approval state, completion, and code-change totals. |
| Theme | **CLI** | Turns Codex into a phosphor terminal with monospace type, scanlines, and command-line color. |
| Tweak | **Approval Shelf** | Keeps Codex's real composer and draft visible beneath approval prompts. |
| Tweak | **Auto Expand Activity** | Automatically opens collapsed command and file-edit activity in conversations. |
| Tweak | **Hot Reload** | Watches the client and add-on files, then refreshes every active renderer as you build. |

Included add-ons and tweaks are enabled by default. Themes are opt-in, and every feature can be toggled independently from **BetterCodex settings**.

<table>
  <tr>
    <td width="50%"><img src="addons/project-kanban/screenshot.svg" alt="Kanban add-on preview"><br><strong>Kanban</strong></td>
    <td width="50%"><img src="addons/approval-shelf/screenshot.svg" alt="Approval Shelf add-on preview"><br><strong>Approval Shelf</strong></td>
  </tr>
  <tr>
    <td width="50%"><img src="addons/auto-expand-activity/screenshot.svg" alt="Auto Expand Activity add-on preview"><br><strong>Auto Expand Activity</strong></td>
    <td width="50%"><img src="addons/hot-reload/screenshot.svg" alt="Hot Reload add-on preview"><br><strong>Hot Reload</strong></td>
  </tr>
  <tr>
    <td colspan="2"><img src="addons/cli-theme/screenshot.svg" alt="CLI theme preview" width="50%"><br><strong>CLI</strong></td>
  </tr>
</table>

## 📦 Install

1. Go to the [latest BetterCodex release](https://github.com/ijsbeerdev/BetterCodex/releases/latest).
2. Download the Windows x64 ZIP attached to that release.
3. Extract the **entire** ZIP.
4. Double-click **Install BetterCodex.cmd**.
5. Quit ChatGPT Codex completely, then launch it normally.

The release includes its own verified portable runtime, so users do not need Node.js or npm. On first launch, the ChatGPT Codex window may briefly close while the watcher relaunches the fresh process with BetterCodex attached. A separate **BetterCodex for ChatGPT Codex** shortcut is also installed as a fallback.

> [!TIP]
> After installation, look for the robot icon beside **Help** in the bottom-left account toolbar.

## 🛠️ Build from source

Source development requires Node.js 22 or newer.

```powershell
git clone https://github.com/ijsbeerdev/BetterCodex.git
cd BetterCodex
npm install
npm run build
npm run patch
```

Useful commands:

```powershell
npm test        # Run the test suite
npm run build   # Build the injectable runtime into dist/
npm run package # Create a self-contained Windows release ZIP
npm run unpatch # Remove a source installation
```

## 🧪 Build your own add-on

Each add-on lives in `addons/<id>/` and contains:

```text
addons/my-addon/
├── manifest.json
├── index.js
└── screenshot.svg
```

Add-ons register with `BetterCodex.register({ id, start, stop })`. `start()` activates the feature; cleanup-capable `stop()` reverses every DOM change, observer, listener, style, and timer when the add-on is disabled or hot-reloaded. The manifest supplies the metadata, default state, screenshot, and an `addon`, `tweak`, or `theme` category shown in BetterCodex settings.

The built-in **Generate addon** action can open a fresh Codex task with the target directory and complete implementation requirements attached—just describe the feature you want.

## 🔎 How it works

```text
Normal Codex launch
        ↓
Per-user watcher detects the fresh process
        ↓
Codex relaunches with a loopback-only debugging endpoint
        ↓
BetterCodex injects the client and enabled add-ons at runtime
```

The launcher resolves the newest installed Codex version every time, which lets regular Codex updates continue normally. The debugging endpoint remains loopback-only.

## 🧹 Uninstall

Release packages include **Uninstall BetterCodex.cmd**. Run it to stop and remove the watcher, runtime, and BetterCodex shortcuts. For a source install, run `npm run unpatch`.

The official ChatGPT Codex installation is never removed or modified.

## 🤝 Contributing

Issues and pull requests are welcome. Keep the UI cozy and compact, give every add-on a manifest and visible toggle, and make every `stop()` implementation fully reversible. Before opening a pull request, run:

```powershell
npm test
npm run build
```

The injection layer depends on Codex's renderer and may occasionally need an update when the app changes.
