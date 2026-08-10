import test from "node:test";
import assert from "node:assert/strict";
import { fetchLatestRelease, installUpdateBridge } from "../src/updates.mjs";

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
  assert.deepEqual(release, { tag_name: "v1.2.0", html_url: "https://github.com/ijsbeerdev/BetterCodex/releases/tag/v1.2.0" });
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
