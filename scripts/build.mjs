import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRepository } from "./validate.mjs";

const scriptsRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptsRoot);
const outputRoot = join(repoRoot, "dist");
const { plugin } = validateRepository(repoRoot);

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(join(outputRoot, ".agents", "plugins"), { recursive: true });
mkdirSync(join(outputRoot, "plugins"), { recursive: true });
cpSync(join(repoRoot, ".agents", "plugins", "marketplace.json"), join(outputRoot, ".agents", "plugins", "marketplace.json"));
cpSync(join(repoRoot, "plugins", "blackbox"), join(outputRoot, "plugins", "blackbox"), { recursive: true });
writeFileSync(
  join(outputRoot, "build.json"),
  `${JSON.stringify({ name: plugin.name, version: plugin.version, repository: plugin.repository }, null, 2)}\n`
);

console.log(`Built ${plugin.name}@${plugin.version} in ${outputRoot}`);
