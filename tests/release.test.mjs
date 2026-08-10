import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("uses a fresh 0.x release version", async () => {
  const packageInfo = JSON.parse(await read("package.json"));
  const addon = JSON.parse(await read("addons/hot-reload/manifest.json"));
  assert.equal(packageInfo.version, "0.4.0");
  assert.equal(addon.version, "0.2.0");
});

test("release installer is self-contained and reversible", async () => {
  const [install, uninstall, start, packaging] = await Promise.all([
    read("installer/Install-BetterCodex.ps1"),
    read("installer/Uninstall-BetterCodex.ps1"),
    read("src/start.ps1"),
    read("scripts/package-release.ps1")
  ]);
  assert.match(install, /nodeSource/);
  assert.match(install, /SupportsShouldProcess/);
  assert.match(install, /BetterCodex ChatGPT Codex Watcher\.lnk/);
  assert.match(uninstall, /Remove the BetterCodex runtime/);
  assert.match(start, /node\\node\.exe/);
  assert.match(packaging, /fba577c4bb87df04d54dd87bbdaa5a2272f1f99a2acbf9152e1a91b8b5f0b279/);
  assert.match(packaging, /--release/);
});
