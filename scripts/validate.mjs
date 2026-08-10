import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXPECTED_REPOSITORY = "https://github.com/ijsbeerdev/blackbox";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function validateRepository(root) {
  const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");
  const pluginRoot = join(root, "plugins", "blackbox");
  const pluginPath = join(pluginRoot, ".codex-plugin", "plugin.json");
  const skillPath = join(pluginRoot, "skills", "show-blackbox-info", "SKILL.md");

  const marketplace = readJson(marketplacePath);
  const plugin = readJson(pluginPath);

  if (marketplace.name !== "blackbox") throw new Error("Marketplace name must be blackbox.");
  if (marketplace.plugins?.length !== 1) throw new Error("Marketplace must contain exactly one plugin.");
  if (marketplace.plugins[0].name !== "blackbox") throw new Error("Marketplace plugin must be blackbox.");
  if (marketplace.plugins[0].source?.path !== "./plugins/blackbox") throw new Error("Marketplace source path is invalid.");
  if (plugin.name !== "blackbox") throw new Error("Plugin name must be blackbox.");
  if (!/^1\.0\.0(?:\+codex\.(?:local-\d{8}-\d{6}|\d{14}))?$/.test(plugin.version)) {
    throw new Error("Plugin version must use the 1.0.0 release and an optional Codex cachebuster.");
  }
  if (plugin.repository !== EXPECTED_REPOSITORY) throw new Error("Plugin repository URL is invalid.");
  if (plugin.interface?.websiteURL !== EXPECTED_REPOSITORY) throw new Error("Plugin website URL is invalid.");
  if (!existsSync(skillPath)) throw new Error("Blackbox info skill is missing.");

  const retiredAppPaths = [
    join(root, "astro.config.mjs"),
    join(root, "src", "components", "Workspace.tsx"),
    join(root, "server", "gateway.ts")
  ];
  if (retiredAppPaths.some(existsSync)) throw new Error("Standalone app files are still present.");

  return { marketplace, plugin, marketplacePath, pluginRoot };
}
