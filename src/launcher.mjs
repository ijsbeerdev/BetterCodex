import { execFile, execFileSync, spawn } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { injectTarget } from "./cdp.mjs";
import { loadAddons } from "./catalog.mjs";

const runtimeRoot = dirname(fileURLToPath(import.meta.url));
const packageInfo = JSON.parse(await readFile(join(runtimeRoot, "package.json"), "utf8"));
const clientSource = await readFile(join(runtimeRoot, "client.js"), "utf8");
const addons = await loadAddons(join(runtimeRoot, "addons"));
const port = Number(process.env.BLACKBOX_DEBUG_PORT || 11983);
const payload = { version: packageInfo.version, repository: packageInfo.repository.url, addons };
const expression = `${clientSource}\n;globalThis.__BLACKBOX_INJECT__(${JSON.stringify(payload)});`;

async function log(message) {
  const line = `${new Date().toISOString()} [launcher] ${message}\n`;
  try { await appendFile(join(runtimeRoot, "blackbox.log"), line); } catch {}
}

function powershell(script) {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" }).trim();
}

function resolveCodexExecutable() {
  if (process.env.BLACKBOX_CODEX_EXE) return process.env.BLACKBOX_CODEX_EXE;
  const installLocation = powershell("(Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation");
  if (!installLocation) throw new Error("The official Codex Windows app is not installed.");
  return join(installLocation, "app", "ChatGPT.exe");
}

function codexIsRunning() {
  try { return powershell("[bool](Get-Process ChatGPT -ErrorAction SilentlyContinue)") === "True"; }
  catch { return false; }
}

function showMessage(message, title = "Blackbox") {
  const encoded = Buffer.from(message, "utf16le").toString("base64");
  const script = `Add-Type -AssemblyName PresentationFramework; $m=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}')); [System.Windows.MessageBox]::Show($m,'${title}') | Out-Null`;
  execFile("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script], () => {});
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
  await log(`Starting Blackbox ${packageInfo.version}.`);
  let targets;
  let child;
  try { targets = await getTargets(); }
  catch {
    if (codexIsRunning()) {
      showMessage("Quit Codex completely, then open Blackbox for Codex again. Blackbox can only attach when Codex starts through its launcher.");
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
    targets = await waitForDebugger();
  }

  const sessions = new Map();
  let failures = 0;
  while (failures < 20 && !child?.killed) {
    try {
      targets = await getTargets();
      failures = 0;
      for (const target of targets) {
        if (!target.webSocketDebuggerUrl || !["page", "webview"].includes(target.type) || target.url?.startsWith("devtools://")) continue;
        if (sessions.has(target.id)) continue;
        try {
          sessions.set(target.id, await injectTarget(target, expression));
          await log(`Injected renderer ${target.id} (${target.type}, ${target.url || "no URL"}).`);
        } catch (error) {
          await log(`Skipped renderer ${target.id}: ${error.message}`);
        }
      }
      for (const [id, session] of sessions) {
        if (!targets.some((target) => target.id === id)) { session.close(); sessions.delete(id); }
      }
    } catch { failures += 1; }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  for (const session of sessions.values()) session.close();
}

main().catch((error) => {
  console.error(error);
  log(`Fatal error: ${error.stack || error.message}`);
  showMessage(`Blackbox could not start:\n\n${error.message}`);
  process.exitCode = 1;
});
