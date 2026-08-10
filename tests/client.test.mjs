import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const clientSource = await readFile(new URL("../src/client.js", import.meta.url), "utf8");

function setup() {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://codex.local/", runScripts: "dangerously" });
  dom.window.eval(clientSource);
  const payload = {
    version: "1.0.0",
    repository: "https://github.com/ijsbeerdev/blackbox",
    addons: [{
      manifest: { id: "test-addon", name: "Test add-on", version: "1.0.0", description: "Tests toggles.", enabledByDefault: true },
      source: `Blackbox.register({ id: "test-addon", start() { document.body.dataset.addon = "on"; }, stop() { delete document.body.dataset.addon; } });`
    }]
  };
  dom.window.__BLACKBOX_INJECT__(payload);
  return { dom, payload };
}

test("renders a bottom-left button and version panel", () => {
  const { dom } = setup();
  const shadow = dom.window.document.getElementById("blackbox-client-root").shadowRoot;
  assert.match(shadow.querySelector(".launcher").textContent, /Blackbox/);
  shadow.querySelector(".launcher").click();
  assert.equal(shadow.querySelector(".backdrop").classList.contains("open"), true);
  assert.match(shadow.querySelector(".version").textContent, /1\.0\.0/);
  assert.equal(shadow.querySelector(".repo").href, "https://github.com/ijsbeerdev/blackbox");
  dom.window.Blackbox.destroy();
});

test("enables, disables, persists, and cleans up add-ons", () => {
  const { dom } = setup();
  assert.equal(dom.window.document.body.dataset.addon, "on");
  const input = dom.window.document.getElementById("blackbox-client-root").shadowRoot.querySelector("input[data-addon='test-addon']");
  input.checked = false;
  input.dispatchEvent(new dom.window.Event("change"));
  assert.equal(dom.window.document.body.dataset.addon, undefined);
  assert.equal(JSON.parse(dom.window.localStorage.getItem("blackbox:addons:v1"))["test-addon"], false);
  dom.window.Blackbox.destroy();
});

test("reinjection is idempotent", () => {
  const { dom, payload } = setup();
  dom.window.__BLACKBOX_INJECT__(payload);
  assert.equal(dom.window.document.querySelectorAll("#blackbox-client-root").length, 1);
  dom.window.Blackbox.destroy();
});
