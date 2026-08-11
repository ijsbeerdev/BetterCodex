import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAddons } from "../src/catalog.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(repoRoot, "dist");
const releaseBuild = process.argv.includes("--release");
const packageInfo = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
const addons = await loadAddons(join(repoRoot, "addons"));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const file of ["catalog.mjs", "cdp.mjs", "client.js", "hot-reload.mjs", "launcher.mjs", "preferences.mjs", "updates.mjs", "notify.ps1", "start.ps1", "watcher.ps1"]) {
  await cp(join(repoRoot, "src", file), join(outputRoot, file));
}
await cp(join(repoRoot, "addons"), join(outputRoot, "addons"), { recursive: true });
await writeFile(join(outputRoot, "package.json"), `${JSON.stringify({
  name: packageInfo.name,
  version: packageInfo.version,
  repository: packageInfo.repository,
  type: "module",
  ...(releaseBuild ? {} : {
    developmentAddonsPath: join(repoRoot, "addons"),
    developmentClientPath: join(repoRoot, "src", "client.js")
  }),
  addons: addons.map(({ manifest }) => manifest)
}, null, 2)}\n`);

console.log(`Built BetterCodex ${packageInfo.version}${releaseBuild ? " release" : ""} with ${addons.length} add-on(s) in ${outputRoot}`);
