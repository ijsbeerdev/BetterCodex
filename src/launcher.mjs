import { execFileSync, spawn } from "node:child_process";
import { access, appendFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { injectTarget, replaceInjection, updatePersistentInjection } from "./cdp.mjs";
import { loadAddons } from "./catalog.mjs";
import { reloadRenderers, watchAddons } from "./hot-reload.mjs";
import { createPreferencesStore, installPreferencesBridge } from "./preferences.mjs";
import { installUpdateBridge } from "./updates.mjs";

const runtimeRoot = dirname(fileURLToPath(import.meta.url));
const packageInfo = JSON.parse(await readFile(join(runtimeRoot, "package.json"), "utf8"));
const port = Number(process.env.BETTERCODEX_DEBUG_PORT || 11983);
const profileRoot = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
const preferencesStore = createPreferencesStore(join(profileRoot, "BetterCodex", "preferences.json"));
async function resolveAddonsRoot() {
  const developmentRoot = packageInfo.developmentAddonsPath;
  if (developmentRoot) {
    try { await access(developmentRoot); return developmentRoot; } catch {}
  }
  return join(runtimeRoot, "addons");
}

const addonsRoot = await resolveAddonsRoot();

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
  const addons = await loadAddons(addonsRoot);
  const preferences = await preferencesStore.load();
  const payload = { version: packageInfo.version, repository: packageInfo.repository.url, addonsPath: addonsRoot, addons, preferences };
  return `${clientSource}\n;globalThis.__BETTERCODEX_INJECT__(${JSON.stringify(payload)});`;
}

let currentExpression = await createExpression();

async function log(message) {
  const line = `${new Date().toISOString()} [launcher] ${message}\n`;
  try { await appendFile(join(runtimeRoot, "bettercodex.log"), line); } catch {}
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

function codexIsRunning() {
  try { return powershell("[bool](Get-Process ChatGPT -ErrorAction SilentlyContinue)") === "True"; }
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
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1_000) });
  if (!response.ok) throw new Error(`Debugger returned ${response.status}`);
  return response.json();
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { return await getTargets(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Codex did not expose its renderer in time.");
}

async function main() {
  await log(`Starting BetterCodex ${packageInfo.version}; watching ${addonsRoot} and ${clientPath}.`);
  let targets;
  let child;
  let childExited = false;
  try { targets = await getTargets(); }
  catch {
    if (codexIsRunning()) {
      showMessage("Quit ChatGPT Codex completely, then open BetterCodex for ChatGPT Codex again. BetterCodex can only attach when the app starts through its launcher.");
      process.exitCode = 2;
      return;
    }
    const executable = resolveCodexExecutable();
    await log(`Launching ${executable} with debugger port ${port}.`);
    child = spawn(executable, [
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      "--remote-allow-origins=http://127.0.0.1"
    ], { detached: false, stdio: "ignore" });
    child.once("exit", () => { childExited = true; });
    targets = await waitForDebugger();
  }

  const sessions = new Map();
  let reloadQueue = Promise.resolve();
  let preferencesQueue = Promise.resolve();
  let addonWatcher;
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
    addonWatcher = watchAddons(addonsRoot, queueReload);
    clientWatcher = watchAddons(clientPath, queueReload, { recursive: false });
  } catch (error) {
    await log(`Could not watch add-ons: ${error.message}`);
  }

  let failures = 0;
  while (failures < 20 && !childExited) {
    try {
      targets = await getTargets();
      failures = 0;
      for (const target of targets) {
        if (!target.webSocketDebuggerUrl || !["page", "webview"].includes(target.type) || target.url?.startsWith("devtools://")) continue;
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
  addonWatcher?.close();
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
