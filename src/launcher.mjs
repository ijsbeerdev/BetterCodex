import { execFileSync, spawn } from "node:child_process";
import { access, appendFile, mkdir, readFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDebuggerTargets, injectTarget, isCodexAppTarget, replaceInjection, scopeExpressionToCodexApp, updatePersistentInjection } from "./cdp.mjs";
import { CATEGORY_DIRECTORIES, loadCatalog } from "./catalog.mjs";
import { reloadRenderers, watchFiles } from "./hot-reload.mjs";
import { createPreferencesStore, installPreferencesBridge } from "./preferences.mjs";
import { automaticUpdatesEnabled, installAutomaticUpdate, installUpdateBridge } from "./updates.mjs";

const runtimeRoot = dirname(fileURLToPath(import.meta.url));
const packageInfo = JSON.parse(await readFile(join(runtimeRoot, "package.json"), "utf8"));
const port = Number(process.env.BETTERCODEX_DEBUG_PORT || 11983);
const profileRoot = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
const localProfileRoot = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
const dataRoot = join(localProfileRoot, "BetterCodex");
const logRoot = join(dataRoot, "Logs");
const logPath = join(logRoot, "bettercodex.log");
const launchRequestPath = join(dataRoot, "launch-request.json");
const updateRoot = join(dataRoot, "Updates");
const preferencesStore = createPreferencesStore(join(profileRoot, "BetterCodex", "preferences.json"));
async function resolveCatalogRoots() {
  const roots = {};
  for (const [category, directory] of Object.entries(CATEGORY_DIRECTORIES)) {
    const developmentRoot = packageInfo.developmentCatalogPaths?.[category];
    if (developmentRoot) {
      try { await access(developmentRoot); roots[category] = developmentRoot; continue; } catch {}
    }
    roots[category] = join(runtimeRoot, directory);
  }
  return roots;
}

const catalogRoots = await resolveCatalogRoots();

async function resolveClientPath() {
  const developmentPath = packageInfo.developmentClientPath;
  if (developmentPath) {
    try { await access(developmentPath); return developmentPath; } catch {}
  }
  return join(runtimeRoot, "client.js");
}

const clientPath = await resolveClientPath();

async function createExpression() {
  const clientSource = await readFile(clientPath, "utf8");
  const addons = await loadCatalog(catalogRoots);
  const preferences = await preferencesStore.load();
  const payload = { version: packageInfo.version, repository: packageInfo.repository.url, catalogPaths: catalogRoots, addons, preferences };
  return scopeExpressionToCodexApp(`${clientSource}\n;globalThis.__BETTERCODEX_INJECT__(${JSON.stringify(payload)});`);
}

let currentExpression = await createExpression();

async function log(message) {
  const line = `${new Date().toISOString()} [launcher] ${message}\n`;
  try {
    await mkdir(logRoot, { recursive: true });
    await appendFile(logPath, line);
  } catch {}
}

async function takeLaunchArguments() {
  try {
    const request = JSON.parse(await readFile(launchRequestPath, "utf8"));
    await unlink(launchRequestPath).catch(() => {});
    const age = Date.now() - Date.parse(request.createdAt);
    if (!Number.isFinite(age) || age < -5_000 || age > 30_000 || !Array.isArray(request.arguments)) return [];
    const safe = [];
    let skipNext = false;
    for (const value of request.arguments) {
      if (skipNext) { skipNext = false; continue; }
      if (typeof value !== "string" || value.includes("\0")) continue;
      if (/^--remote-debugging-(?:port|address)$/.test(value)) { skipNext = true; continue; }
      if (/^--remote-(?:debugging-port|debugging-address|allow-origins)=/.test(value)) continue;
      if (/^--type(?:=|$)/.test(value)) continue;
      safe.push(value);
    }
    return safe;
  } catch { return []; }
}

function powershell(script) {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" }).trim();
}

function resolveCodexExecutable() {
  if (process.env.BETTERCODEX_CODEX_EXE) return process.env.BETTERCODEX_CODEX_EXE;
  const installLocation = powershell("(Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation");
  if (!installLocation) throw new Error("The official ChatGPT Codex Windows app is not installed.");
  return join(installLocation, "app", "ChatGPT.exe");
}

function codexIsRunning(executable) {
  const encoded = Buffer.from(executable, "utf16le").toString("base64");
  try {
    return powershell(`$p=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}')); [bool](Get-CimInstance Win32_Process -Filter \"Name = 'ChatGPT.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -eq $p -and $_.CommandLine -notmatch '--type=' } | Select-Object -First 1)`) === "True";
  }
  catch { return false; }
}

function showMessage(message, title = "BetterCodex") {
  const encoded = Buffer.from(message, "utf16le").toString("base64");
  const script = `Add-Type -AssemblyName PresentationFramework; $m=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}')); [System.Windows.MessageBox]::Show($m,'${title}') | Out-Null`;
  const notification = spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  notification.unref();
}

async function getTargets() {
  return getDebuggerTargets(port);
}

async function waitForDebugger() {
  let endpointOccupied = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await getTargets();
      if (targets.some(isCodexAppTarget)) return targets;
      endpointOccupied = true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (endpointOccupied) throw new Error(`Debugger port ${port} is already in use by another application.`);
  throw new Error("Codex did not expose its renderer in time.");
}

async function main() {
  await log(`Starting BetterCodex ${packageInfo.version}; watching ${Object.values(catalogRoots).join(", ")} and ${clientPath}.`);
  try {
    const preferences = await preferencesStore.load();
    if (automaticUpdatesEnabled(preferences)) {
      await log("Checking for automatic BetterCodex updates.");
      const update = await installAutomaticUpdate({
        repositoryUrl: packageInfo.repository.url,
        currentVersion: packageInfo.version,
        destinationRoot: updateRoot
      });
      if (update.status === "installing") {
        await log(`Started checksum-verified BetterCodex ${update.version} installer.`);
        return;
      }
      await log("No automatic BetterCodex update is available.");
    }
  } catch (error) {
    await log(`Automatic BetterCodex update failed: ${error.message}`);
  }
  let targets;
  let child;
  let childExited = false;
  try {
    targets = await getTargets();
    if (!targets.some(isCodexAppTarget)) throw new Error("The debugger endpoint does not belong to Codex.");
  }
  catch {
    const executable = resolveCodexExecutable();
    if (codexIsRunning(executable)) {
      showMessage("Quit ChatGPT Codex completely, then open BetterCodex for ChatGPT Codex again. BetterCodex can only attach when the app starts through its launcher.");
      process.exitCode = 2;
      return;
    }
    const launchArguments = await takeLaunchArguments();
    await log(`Launching ${executable} with debugger port ${port}.`);
    child = spawn(executable, [
      ...launchArguments,
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      "--remote-allow-origins=http://127.0.0.1,http://localhost"
    ], { detached: false, stdio: "ignore" });
    child.once("exit", () => { childExited = true; });
    child.unref();
    targets = await waitForDebugger();
  }

  const sessions = new Map();
  let reloadQueue = Promise.resolve();
  let preferencesQueue = Promise.resolve();
  const catalogWatchers = [];
  let clientWatcher;
  const queuePreferencesRefresh = () => {
    preferencesQueue = preferencesQueue.then(async () => {
      const nextExpression = await createExpression();
      currentExpression = nextExpression;
      const results = await Promise.allSettled(
        [...sessions.values()].map((session) => updatePersistentInjection(session, nextExpression))
      );
      const failures = results.filter(({ status }) => status === "rejected");
      await log(`Saved preferences to ${preferencesStore.path}; refreshed ${results.length - failures.length} persistent renderer script(s), ${failures.length} failed.`);
    }).catch((error) => log(`Could not refresh saved preferences: ${error.message}`));
  };
  const queueReload = ({ eventType, filename }) => {
    reloadQueue = reloadQueue.then(async () => {
      const nextExpression = await createExpression();
      currentExpression = nextExpression;
      const result = await reloadRenderers(sessions.values(), nextExpression, replaceInjection);
      await log(`Hot reload ${eventType} ${filename}: refreshed ${result.reloaded} renderer(s), ${result.errors.length} failed.`);
      for (const error of result.errors) await log(`Hot reload renderer failed: ${error.message || error}`);
    }).catch((error) => log(`Hot reload failed: ${error.message}`));
  };
  try {
    for (const root of Object.values(catalogRoots)) catalogWatchers.push(watchFiles(root, queueReload));
    clientWatcher = watchFiles(clientPath, queueReload, { recursive: false });
  } catch (error) {
    await log(`Could not watch catalog files: ${error.message}`);
  }

  let failures = 0;
  while (failures < 20 && !childExited) {
    try {
      targets = await getTargets();
      failures = 0;
      for (const target of targets) {
        if (!isCodexAppTarget(target)) continue;
        if (!sessions.has(target.id)) {
          try {
            sessions.set(target.id, await injectTarget(target, currentExpression, async (connection) => {
              await installUpdateBridge(connection, packageInfo.repository.url);
              await installPreferencesBridge(connection, preferencesStore, {
                onSaved: queuePreferencesRefresh,
                onError: (error) => log(`Could not save preferences: ${error.message}`)
              });
            }));
            await log(`Injected renderer ${target.id} (${target.type}, ${target.url || "no URL"}).`);
          } catch (error) {
            await log(`Skipped renderer ${target.id}: ${error.message}`);
          }
          continue;
        }
        const session = sessions.get(target.id);
        const now = Date.now();
        if (now - (session.bettercodexLastHealthCheck || 0) < 1_500) continue;
        session.bettercodexLastHealthCheck = now;
        try {
          const state = await session.send("Runtime.evaluate", {
            expression: "globalThis.BetterCodex?.version || null",
            returnByValue: true
          });
          if (state.result?.value !== packageInfo.version) {
            await replaceInjection(session, currentExpression);
            await log(`Recovered renderer ${target.id} from ${state.result?.value || "missing"} to ${packageInfo.version}.`);
          }
        } catch (error) {
          await log(`Renderer health check failed for ${target.id}: ${error.message}`);
        }
      }
      for (const [id, session] of sessions) {
        if (!targets.some((target) => target.id === id)) { session.close(); sessions.delete(id); }
      }
    } catch { failures += 1; }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  for (const watcher of catalogWatchers) watcher.close();
  clientWatcher?.close();
  await reloadQueue;
  await preferencesQueue;
  for (const session of sessions.values()) session.close();
}

main().catch((error) => {
  console.error(error);
  log(`Fatal error: ${error.stack || error.message}`);
  showMessage(`BetterCodex could not start:\n\n${error.message}`);
  process.exitCode = 1;
});
