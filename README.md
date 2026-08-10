# Blackbox

Blackbox is now a native Codex plugin. The standalone Astro/React app was retired in commit `421df55` and remains recoverable from Git history.

## Install

```powershell
.\scripts\install.ps1 -Replace
```

Fully restart the ChatGPT desktop app, open **Plugins**, choose **Blackbox**, and install or enable it. The native plugin details view shows Blackbox `1.0.0` and links to this repository. In a conversation, invoke `$show-blackbox-info` for the same compact information card.

To unregister Blackbox without deleting the repository:

```powershell
.\scripts\uninstall.ps1
```

## Why there is no renderer patch

The official Codex plugin contract supports skills, hooks, MCP servers, and MCP-backed UI. It does not expose a persistent bottom-left navigation slot. Blackbox therefore uses the native Plugins surface and does not modify `app.asar`, the signed Microsoft Store package, or Codex update settings. Codex continues to update normally.

## Develop

```powershell
npm test
npm run build
```

The distributable marketplace is written to `dist/`.
