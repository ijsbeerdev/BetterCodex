import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  automaticUpdatesEnabled,
  downloadAutomaticUpdate,
  fetchLatestRelease,
  installAutomaticUpdate,
  installUpdateBridge
} from "../src/updates.mjs";

test("fetches and validates the latest GitHub release", async () => {
  let request = null;
  const release = await fetchLatestRelease("https://github.com/ijsbeerdev/BetterCodex.git", {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ tag_name: "v1.2.0", html_url: "https://github.com/ijsbeerdev/BetterCodex/releases/tag/v1.2.0" })
      };
    }
  });
  assert.equal(request.url, "https://api.github.com/repos/ijsbeerdev/BetterCodex/releases/latest");
  assert.equal(request.options.headers["User-Agent"], "BetterCodex");
  assert.deepEqual(release, { tag_name: "v1.2.0", html_url: "https://github.com/ijsbeerdev/BetterCodex/releases/tag/v1.2.0", assets: [] });
});

test("reads the opt-in automatic update preference", () => {
  assert.equal(automaticUpdatesEnabled({ storage: { "bettercodex:autoupdate:v1": "true" } }), true);
  assert.equal(automaticUpdatesEnabled({ storage: { "bettercodex:autoupdate:v1": "false" } }), false);
  assert.equal(automaticUpdatesEnabled({}), false);
});

test("downloads, verifies, and launches the matching release installer", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bettercodex-update-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installerName = "bettercodex-1.2.0-windows-x64-setup.exe";
  const installerBytes = Buffer.from("verified installer fixture");
  const checksum = createHash("sha256").update(installerBytes).digest("hex");
  const assets = [{
    name: installerName,
    browser_download_url: `https://github.com/ijsbeerdev/BetterCodex/releases/download/v1.2.0/${installerName}`,
    size: installerBytes.length
  }, {
    name: `${installerName}.sha256`,
    browser_download_url: `https://github.com/ijsbeerdev/BetterCodex/releases/download/v1.2.0/${installerName}.sha256`,
    size: 100
  }];
  const launches = [];
  const response = (bytes) => ({
    ok: true,
    status: 200,
    headers: { get: () => String(bytes.length) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  });
  const result = await installAutomaticUpdate({
    repositoryUrl: "https://github.com/ijsbeerdev/BetterCodex",
    currentVersion: "1.0.0",
    destinationRoot: root,
    fetchImpl: async (url) => {
      if (url.includes("api.github.com")) return {
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: "v1.2.0",
          html_url: "https://github.com/ijsbeerdev/BetterCodex/releases/tag/v1.2.0",
          assets
        })
      };
      return url.endsWith(".sha256")
        ? response(Buffer.from(`${checksum} *${installerName}\n`))
        : response(installerBytes);
    },
    spawnImpl(path, args, options) {
      launches.push({ path, args, options });
      return { unref() {} };
    }
  });

  assert.equal(result.status, "installing");
  assert.equal(result.version, "1.2.0");
  assert.deepEqual(await readFile(result.installerPath), installerBytes);
  assert.equal(launches[0].path, result.installerPath);
  assert.deepEqual(launches[0].args, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS", "/AUTOMATICUPDATE=1"]);
  assert.equal(launches[0].options.detached, true);
});

test("refuses an automatic update with a mismatched checksum", async () => {
  const installerName = "bettercodex-1.2.0-windows-x64-setup.exe";
  const installerBytes = Buffer.from("installer");
  const response = (bytes) => ({
    ok: true,
    status: 200,
    headers: { get: () => String(bytes.length) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  });
  await assert.rejects(downloadAutomaticUpdate({
    tag_name: "v1.2.0",
    assets: [{ name: installerName, browser_download_url: `https://github.com/example/release/${installerName}` },
      { name: `${installerName}.sha256`, browser_download_url: `https://github.com/example/release/${installerName}.sha256` }]
  }, tmpdir(), {
    fetchImpl: async (url) => url.endsWith(".sha256")
      ? response(Buffer.from(`${"0".repeat(64)} *${installerName}\n`))
      : response(installerBytes)
  }), /failed SHA-256 verification/);
});

test("treats a repository without public releases as up to date", async () => {
  const release = await fetchLatestRelease("https://github.com/ijsbeerdev/BetterCodex", {
    fetchImpl: async () => ({ ok: false, status: 404 })
  });
  assert.equal(release, null);
});

test("bridges a renderer update request through the launcher", async () => {
  let bindingHandler;
  const calls = [];
  const connection = {
    send: async (method, params) => { calls.push({ method, params }); },
    on: (method, handler) => { assert.equal(method, "Runtime.bindingCalled"); bindingHandler = handler; }
  };
  await installUpdateBridge(connection, "https://github.com/ijsbeerdev/BetterCodex", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ tag_name: "v1.2.0", html_url: "https://github.com/ijsbeerdev/BetterCodex/releases/tag/v1.2.0" })
    })
  });
  assert.deepEqual(calls.shift(), { method: "Runtime.addBinding", params: { name: "__BETTERCODEX_CHECK_FOR_UPDATES__" } });

  bindingHandler({ name: "__BETTERCODEX_CHECK_FOR_UPDATES__", payload: "request-1", executionContextId: 7 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls[0].method, "Runtime.evaluate");
  assert.equal(calls[0].params.contextId, 7);
  assert.match(calls[0].params.expression, /bettercodex:update-result/);
  assert.match(calls[0].params.expression, /request-1/);
  assert.match(calls[0].params.expression, /v1\.2\.0/);
});
