import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { getDebuggerTargets, isCodexAppTarget, isCodexAppUrl, scopeExpressionToCodexApp } from "../src/cdp.mjs";

const target = (overrides = {}) => ({
  type: "page",
  url: "app://-/index.html",
  webSocketDebuggerUrl: "ws://127.0.0.1:11983/devtools/page/codex",
  ...overrides
});

test("recognizes only the trusted Codex application URL", () => {
  assert.equal(isCodexAppUrl("app://-/index.html"), true);
  assert.equal(isCodexAppUrl("app://-/index.html?initialRoute=%2Favatar-overlay"), true);
  assert.equal(isCodexAppUrl("https://example.com/"), false);
  assert.equal(isCodexAppUrl("app://example.com/index.html"), false);
  assert.equal(isCodexAppUrl("app://-/other.html"), false);
  assert.equal(isCodexAppUrl("not a URL"), false);
});

test("selects Codex renderers but rejects embedded browser targets", () => {
  assert.equal(isCodexAppTarget(target()), true);
  assert.equal(isCodexAppTarget(target({ url: "app://-/index.html?initialRoute=%2Favatar-overlay" })), true);
  assert.equal(isCodexAppTarget(target({ url: "https://example.com/" })), false);
  assert.equal(isCodexAppTarget(target({ type: "webview", url: "https://example.com/" })), false);
  assert.equal(isCodexAppTarget(target({ type: "webview" })), false);
  assert.equal(isCodexAppTarget(target({ webSocketDebuggerUrl: "" })), false);
});

test("runs injected code only in Codex app frames", () => {
  const expression = scopeExpressionToCodexApp("globalThis.betterCodexRan = true;");
  const appFrame = { location: new URL("app://-/index.html") };
  const browserFrame = { location: new URL("https://example.com/") };

  vm.runInNewContext(expression, appFrame);
  vm.runInNewContext(expression, browserFrame);

  assert.equal(appFrame.betterCodexRan, true);
  assert.equal(browserFrame.betterCodexRan, undefined);
});

test("discovers the debugger on either IPv6 or IPv4 loopback", async () => {
  const requested = [];
  const targets = [{ id: "codex" }];
  const result = await getDebuggerTargets(11983, async (url) => {
    requested.push(url);
    if (url.startsWith("http://[::1]")) throw new Error("IPv6 unavailable");
    return { ok: true, async json() { return targets; } };
  });

  assert.deepEqual(result, targets);
  assert.deepEqual(requested.sort(), [
    "http://127.0.0.1:11983/json/list",
    "http://[::1]:11983/json/list"
  ]);
});
