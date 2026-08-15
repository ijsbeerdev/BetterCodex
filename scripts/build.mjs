import { spawnSync } from "node:child_process";
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
for (const file of ["catalog.mjs", "cdp.mjs", "client.js", "hot-reload.mjs", "launcher.mjs", "preferences.mjs", "updates.mjs", "start.ps1", "watcher.ps1"]) {
  await cp(join(repoRoot, "src", file), join(outputRoot, file));
}
await cp(join(repoRoot, "addons"), join(outputRoot, "addons"), { recursive: true });
const managerVersion = `${packageInfo.version.replace(/-.+$/, "")}.0`.split(".").slice(0, 4).join(".");
const managerVersionSource = join(outputRoot, "BetterCodex.Manager.Version.cs");
await writeFile(managerVersionSource, [
  "using System.Reflection;",
  `[assembly: AssemblyVersion(\"${managerVersion}\")]`,
  `[assembly: AssemblyFileVersion(\"${managerVersion}\")]`,
  `[assembly: AssemblyInformationalVersion(\"${packageInfo.version}\")]`,
  ""
].join("\n"));
const frameworkRoot = join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319");
const compiler = join(frameworkRoot, "csc.exe");
const managerResult = spawnSync(compiler, [
  "/nologo",
  "/target:winexe",
  "/optimize+",
  "/debug-",
  "/platform:x64",
  `/out:${join(outputRoot, "BetterCodex.Manager.exe")}`,
  `/reference:${join(frameworkRoot, "System.dll")}`,
  `/reference:${join(frameworkRoot, "System.Core.dll")}`,
  `/reference:${join(frameworkRoot, "System.Drawing.dll")}`,
  `/reference:${join(frameworkRoot, "System.Web.Extensions.dll")}`,
  `/reference:${join(frameworkRoot, "System.Windows.Forms.dll")}`,
  join(repoRoot, "src", "watcher-app", "Program.cs"),
  managerVersionSource
], { encoding: "utf8", windowsHide: true });
await rm(managerVersionSource, { force: true });
if (managerResult.status !== 0) {
  throw new Error(`Could not build BetterCodex.Manager.exe:\n${managerResult.stdout || ""}${managerResult.stderr || ""}`);
}
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
