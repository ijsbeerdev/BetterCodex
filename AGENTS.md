# Blackbox agent guidance

Blackbox is a Vencord-style runtime patcher for the official Codex Windows app. Do not recreate a standalone web app and do not rewrite Codex executables, signed MSIX files, `app.asar`, or update settings.

Keep the injected UI in `src/client.js`, the launcher and CDP transport in `src/launcher.mjs` and `src/cdp.mjs`, and add-ons under `addons/<id>/`. Machine-level installation changes belong in `scripts/patch.ps1` and `scripts/unpatch.ps1` and must remain reversible.

Every add-on needs a manifest, a visible enable/disable control, and a cleanup-capable `stop()` implementation. Keep copy and presentation cozy and compact.

Before handing off changes, run `npm test` and `npm run build`.
