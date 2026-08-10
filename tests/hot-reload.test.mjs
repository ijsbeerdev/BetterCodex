import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadAddons } from "../src/catalog.mjs";
import { replaceInjection } from "../src/cdp.mjs";
import { watchAddons } from "../src/hot-reload.mjs";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("Hot Reload is the only bundled add-on and cleans up when disabled", async () => {
  const addonsRoot = fileURLToPath(new URL("../addons", import.meta.url));
  const addons = await loadAddons(addonsRoot);
  assert.deepEqual(addons.map(({ manifest }) => manifest.id), ["hot-reload"]);

  const clientSource = await readFile(new URL("../src/client.js", import.meta.url), "utf8");
  const dom = new JSDOM("<!doctype html><body><button aria-label='Open help menu'></button></body>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  dom.window.document.querySelector("button").getBoundingClientRect = () => ({
    left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32
  });
  dom.window.eval(clientSource);
  dom.window.__BLACKBOX_INJECT__({ version: "1.1.0", repository: "https://example.test", addons });
  await delay(25);
  assert.equal(dom.window.__BLACKBOX_HOT_RELOAD_ACTIVE__, true);
  const shadow = dom.window.document.getElementById("blackbox-client-root").shadowRoot;
  const launcher = shadow.querySelector(".launcher");
  assert.equal(launcher.style.left, "197px");
  assert.equal(launcher.style.top, "735px");
  assert.ok(shadow.getElementById("blackbox-addon-hot-reload-layout"));
  dom.window.Blackbox.setEnabled("hot-reload", false);
  assert.equal(dom.window.__BLACKBOX_HOT_RELOAD_ACTIVE__, undefined);
  assert.equal(launcher.style.left, "");
  assert.equal(shadow.getElementById("blackbox-addon-hot-reload-layout"), null);
  dom.window.Blackbox.destroy();
});

test("add-on file events are debounced", async () => {
  let listener;
  let closed = false;
  const changes = [];
  const watcher = watchAddons("C:\\addons", (change) => changes.push(change), {
    debounceMs: 5,
    watchImpl(root, options, callback) {
      assert.equal(root, "C:\\addons");
      assert.equal(options.recursive, true);
      listener = callback;
      return { close() { closed = true; } };
    }
  });
  listener("change", "one.js");
  listener("rename", "two.js");
  await delay(20);
  assert.deepEqual(changes, [{ eventType: "rename", filename: "two.js" }]);
  watcher.close();
  assert.equal(closed, true);
});

test("replaces the persistent injection script after evaluating the update", async () => {
  const calls = [];
  const connection = {
    blackboxScriptIdentifier: "old-script",
    async send(method, params) {
      calls.push({ method, params });
      if (method === "Page.addScriptToEvaluateOnNewDocument") return { identifier: "new-script" };
      if (method === "Runtime.evaluate") return { result: { value: true } };
      return {};
    }
  };
  await replaceInjection(connection, "new expression");
  assert.equal(connection.blackboxScriptIdentifier, "new-script");
  assert.deepEqual(calls.map(({ method }) => method), [
    "Page.addScriptToEvaluateOnNewDocument",
    "Runtime.evaluate",
    "Page.removeScriptToEvaluateOnNewDocument"
  ]);
  assert.equal(calls[2].params.identifier, "old-script");
});
