# Blackbox agent guidance

Blackbox is a Codex-native plugin marketplace. Do not recreate a standalone web app and do not patch Codex executables, `app.asar`, signed Windows package files, or update settings.

Keep user-visible metadata in `plugins/blackbox/.codex-plugin/plugin.json`. Keep the marketplace entry in `.agents/plugins/marketplace.json`. Every capability must be installable, disableable, and removable through Codex's native Plugins UI.

Keep copy and presentation cozy and compact. Before handing off changes, run `npm test`, `npm run build`, the skill validator, and the plugin validator.
