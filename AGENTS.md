# BetterCodex agent guidance

BetterCodex is a runtime patcher for the official ChatGPT Codex Windows app. Do not recreate a standalone web app and do not rewrite Codex executables, signed MSIX files, `app.asar`, or update settings.

Keep the injected UI in `src/client.js`, the launcher and CDP transport in `src/launcher.mjs` and `src/cdp.mjs`, the normal-launch watcher in `src/watcher.ps1`, and add-ons under `addons/<id>/`. Machine-level installation changes belong in `scripts/patch.ps1` and `scripts/unpatch.ps1` and must remain reversible.

Every add-on needs a manifest, a visible enable/disable control, and a cleanup-capable `stop()` implementation. Keep copy and presentation cozy and compact.

Before handing off changes, run `npm test` and `npm run build`.
