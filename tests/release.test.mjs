import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("uses a fresh 0.x release version", async () => {
  const packageInfo = JSON.parse(await read("package.json"));
  assert.equal(packageInfo.version, "0.4.0");
});

test("release installer is self-contained, quiet, immediate, and reversible", async () => {
  const [install, uninstall, start, watcher, launcher, patch, unpatch, build, packaging] = await Promise.all([
    read("installer/Install-BetterCodex.ps1"),
    read("installer/Uninstall-BetterCodex.ps1"),
    read("src/start.ps1"),
    read("src/watcher.ps1"),
    read("src/launcher.mjs"),
    read("scripts/patch.ps1"),
    read("scripts/unpatch.ps1"),
    read("scripts/build.mjs"),
    read("scripts/package-release.ps1")
  ]);
  assert.match(install, /nodeSource/);
  assert.match(install, /SupportsShouldProcess/);
  assert.match(install, /Register-ScheduledTask/);
  assert.match(install, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(install, /StartWhenAvailable/);
  assert.match(install, /MultipleInstances IgnoreNew/);
  assert.doesNotMatch(install, /New-ScheduledTaskSettingsSet -Hidden/);
  assert.match(install, /RestartCount 3/);
  assert.match(uninstall, /Remove the BetterCodex runtime/);
  assert.match(start, /node\\node\.exe/);
  assert.doesNotMatch(install, /IgnoreExisting/);
  assert.doesNotMatch(watcher, /IgnoreExisting/);
  assert.match(watcher, /Attaching the refreshed BetterCodex runtime/);
  assert.match(watcher, /Watcher scan failed and will retry/);
  assert.doesNotMatch(watcher, /Notification|NotifyIcon/);
  assert.doesNotMatch(launcher, /Notification|NotifyIcon|patch-notification-pending/);
  assert.doesNotMatch(install, /patch-notification-pending/);
  assert.doesNotMatch(patch, /patch-notification-pending/);
  assert.doesNotMatch(install, /wscript|\.vbs/i);
  assert.doesNotMatch(patch, /wscript|\.vbs/i);
  assert.match(uninstall, /Unregister-ScheduledTask/);
  assert.match(unpatch, /Unregister-ScheduledTask/);
  assert.match(build, /preferences\.mjs/);
  assert.doesNotMatch(build, /\.vbs/);
  assert.doesNotMatch(build, /notify\.ps1/);
  assert.match(uninstall, /preferences remain saved/);
  assert.match(packaging, /fba577c4bb87df04d54dd87bbdaa5a2272f1f99a2acbf9152e1a91b8b5f0b279/);
  assert.match(packaging, /--release/);
});
