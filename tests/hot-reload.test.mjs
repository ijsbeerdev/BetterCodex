import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadCatalog } from "../src/catalog.mjs";
import { replaceInjection, updatePersistentInjection } from "../src/cdp.mjs";
import { reloadRenderers, watchFiles } from "../src/hot-reload.mjs";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("bundled catalog items load from their category directories", async () => {
  const addons = await loadCatalog({
    addon: fileURLToPath(new URL("../addons", import.meta.url)),
    tweak: fileURLToPath(new URL("../tweaks", import.meta.url)),
    theme: fileURLToPath(new URL("../themes", import.meta.url))
  });
  assert.deepEqual(addons.map(({ manifest }) => manifest.id), ["approval-shelf", "auto-expand-activity", "cyberpunk-theme", "hide-sidebar-help", "hide-sidebar-voice", "project-kanban", "project-workspace", "thinking-mode-colors", "weekly-limit"]);

  const clientSource = await readFile(new URL("../src/client.js", import.meta.url), "utf8");
  const dom = new JSDOM("<!doctype html><body><button aria-label='Open help menu'></button></body>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  dom.window.document.querySelector("button").getBoundingClientRect = () => ({
    left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32
  });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.requestAnimationFrame = (callback) => { callback(); return 1; };
  dom.window.eval(clientSource);
  dom.window.__BETTERCODEX_INJECT__({ version: "1.1.0", repository: "https://example.test", addons });
  await delay(25);
  const firstHelp = dom.window.document.querySelector("button[aria-label='Open help menu']");
  assert.equal(firstHelp.hasAttribute("data-bettercodex-hide-sidebar-help"), true);
  assert.ok(dom.window.document.getElementById("bettercodex-native-launcher"));

  firstHelp.remove();
  dom.window.document.getElementById("bettercodex-native-launcher").remove();
  const replacementHelp = dom.window.document.createElement("button");
  replacementHelp.setAttribute("aria-label", "Open help menu");
  replacementHelp.getBoundingClientRect = () => ({
    left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32
  });
  dom.window.document.body.append(replacementHelp);
  await delay(25);

  const replacementLauncher = dom.window.document.getElementById("bettercodex-native-launcher");
  assert.ok(replacementLauncher);
  assert.equal(replacementHelp.hasAttribute("data-bettercodex-hide-sidebar-help"), true);
  assert.equal(replacementLauncher.hasAttribute("data-bettercodex-hide-sidebar-help"), false);
  dom.window.BetterCodex.destroy();
});

test("core hot reload refreshes every renderer without an add-on gate", async () => {
  const sessions = [{ id: "one" }, { id: "two" }];
  const calls = [];
  const result = await reloadRenderers(sessions, "new expression", async (session, expression) => {
    calls.push({ session, expression });
  });
  assert.deepEqual(calls, sessions.map((session) => ({ session, expression: "new expression" })));
  assert.deepEqual(result, { reloaded: 2, errors: [] });
});

test("add-on file events are debounced", async () => {
  let listener;
  let closed = false;
  const changes = [];
  const watcher = watchFiles("C:\\addons", (change) => changes.push(change), {
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

test("file watching can disable recursive mode for the client bundle", () => {
  let observedOptions;
  const watcher = watchFiles("C:\\client.js", () => {}, {
    recursive: false,
    watchImpl(root, options) {
      observedOptions = options;
      return { close() {} };
    }
  });
  assert.equal(observedOptions.recursive, false);
  watcher.close();
});

test("replaces the persistent injection script after evaluating the update", async () => {
  const calls = [];
  const connection = {
    bettercodexScriptIdentifier: "old-script",
    async send(method, params) {
      calls.push({ method, params });
      if (method === "Page.addScriptToEvaluateOnNewDocument") return { identifier: "new-script" };
      if (method === "Runtime.evaluate") return { result: { value: true } };
      return {};
    }
  };
  await replaceInjection(connection, "new expression");
  assert.equal(connection.bettercodexScriptIdentifier, "new-script");
  assert.deepEqual(calls.map(({ method }) => method), [
    "Page.addScriptToEvaluateOnNewDocument",
    "Runtime.evaluate",
    "Page.removeScriptToEvaluateOnNewDocument"
  ]);
  assert.equal(calls[2].params.identifier, "old-script");
});

test("updates future-navigation injection without reloading the active renderer", async () => {
  const calls = [];
  const connection = {
    bettercodexScriptIdentifier: "old-script",
    async send(method, params) {
      calls.push({ method, params });
      if (method === "Page.addScriptToEvaluateOnNewDocument") return { identifier: "new-script" };
      return {};
    }
  };
  await updatePersistentInjection(connection, "new expression");
  assert.equal(connection.bettercodexScriptIdentifier, "new-script");
  assert.deepEqual(calls.map(({ method }) => method), [
    "Page.addScriptToEvaluateOnNewDocument",
    "Page.removeScriptToEvaluateOnNewDocument"
  ]);
});
