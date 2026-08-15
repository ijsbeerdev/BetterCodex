import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("uses a fresh 0.x release version", async () => {
  const packageInfo = JSON.parse(await read("package.json"));
  assert.equal(packageInfo.version, "0.5.0");
});

test("watcher validates process identity and debugger ownership", async () => {
  const powershell = `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
  const watcher = new URL("../src/watcher.ps1", import.meta.url);
  const { stdout } = await execFileAsync(powershell, [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", watcher.pathname.slice(1), "-SelfTest"
  ]);
  assert.match(stdout, /watcher self-test passed/i);
});

test("release uses an event-driven tray manager and a registered Windows installer", async () => {
  const [watcher, launcher, manager, installer, actions, patch, unpatch, build, packaging] = await Promise.all([
    read("src/watcher.ps1"),
    read("src/launcher.mjs"),
    read("src/watcher-app/Program.cs"),
    read("installer/BetterCodex.iss"),
    read("installer/Install-Actions.ps1"),
    read("scripts/patch.ps1"),
    read("scripts/unpatch.ps1"),
    read("scripts/build.mjs"),
    read("scripts/package-release.ps1")
  ]);

  assert.match(watcher, /Win32_ProcessStartTrace/);
  assert.match(watcher, /ExecutablePath/);
  assert.match(watcher, /StringComparison\]::OrdinalIgnoreCase/);
  assert.match(watcher, /Test-BetterCodexPatched/);
  assert.match(watcher, /CloseMainWindow/);
  assert.match(watcher, /launch-request\.json/);
  assert.match(watcher, /compatibility-mode process detection/);
  assert.doesNotMatch(watcher, /Start-Sleep -Milliseconds 250/);
  assert.match(launcher, /takeLaunchArguments/);
  assert.match(launcher, /endpointOccupied/);
  assert.match(launcher, /ExecutablePath -eq \$p/);
  assert.match(launcher, /installAutomaticUpdate/);
  assert.match(launcher, /automaticUpdatesEnabled/);

  assert.match(manager, /NotifyIcon/);
  assert.match(manager, /Pause automatic enhancement/);
  assert.match(manager, /Restart BetterCodex runtime/);
  assert.match(manager, /Start with Windows/);
  assert.match(manager, /--shutdown/);
  assert.match(manager, /--resume-update/);
  assert.match(build, /BetterCodex\.Manager\.exe/);

  assert.match(installer, /AppId=/);
  assert.match(installer, /PrivilegesRequired=lowest/);
  assert.match(installer, /DefaultDirName=\{localappdata\}\\Programs\\BetterCodex/);
  assert.match(installer, /UninstallDisplayName=BetterCodex/);
  assert.match(installer, /CurrentVersion\\Run/);
  assert.match(installer, /PrepareToInstall/);
  assert.match(installer, /AUTOMATICUPDATE/);
  assert.match(installer, /Parameters: "--resume-update"/);
  assert.match(actions, /PrepareInstall/);
  assert.match(actions, /CompleteInstall/);
  assert.match(actions, /Get-AppxPackage -Name OpenAI\.Codex/);
  assert.match(actions, /Unregister-ScheduledTask/);

  assert.match(patch, /BetterCodex\.installing/);
  assert.match(patch, /BetterCodex\.previous/);
  assert.match(unpatch, /preferences remain saved/);
  assert.match(packaging, /ISCC\.exe/);
  assert.match(packaging, /windows-x64-setup\.exe/);
  assert.match(packaging, /\.sha256/);
  assert.match(packaging, /fba577c4bb87df04d54dd87bbdaa5a2272f1f99a2acbf9152e1a91b8b5f0b279/);
});
