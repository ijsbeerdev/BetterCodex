import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const clientSource = await readFile(new URL("../src/client.js", import.meta.url), "utf8");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function setup() {
  const dom = new JSDOM("<!doctype html><html class='electron-dark'><body><div id='toolbar'><button class='native-help size-8' aria-label='Open help menu'></button></div></body></html>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  const help = dom.window.document.querySelector("[aria-label='Open help menu']");
  help.getBoundingClientRect = () => ({ left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32 });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.requestAnimationFrame = (callback) => { callback(); return 1; };
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

test("mounts a themed native button beside Help and opens a full-page view", () => {
  const { dom } = setup();
  const document = dom.window.document;
  const host = document.getElementById("blackbox-client-root");
  const shadow = host.shadowRoot;
  const launcher = document.getElementById("blackbox-native-launcher");
  const help = document.querySelector("[aria-label='Open help menu']");
  assert.equal(launcher.nextElementSibling, help);
  assert.equal(launcher.className, help.className);
  assert.equal(launcher.textContent, "");
  assert.equal(launcher.querySelector("[data-blackbox-box]").style.backgroundColor, "rgb(255, 255, 255)");
  assert.equal(host.style.display, "none");
  launcher.click();
  assert.equal(host.style.display, "block");
  assert.match(shadow.querySelector(".version").textContent, /1\.0\.0/);
  assert.equal(shadow.querySelector(".repo").href, "https://github.com/ijsbeerdev/blackbox");
  shadow.querySelector(".nav[data-target='addons']").click();
  assert.equal(shadow.getElementById("general").hidden, true);
  assert.equal(shadow.getElementById("addons").hidden, false);
  assert.equal(shadow.getElementById("blackbox-title").textContent, "Add-ons");
  shadow.querySelector(".nav[data-target='general']").click();
  assert.equal(shadow.getElementById("general").hidden, false);
  assert.equal(shadow.getElementById("addons").hidden, true);
  shadow.querySelector(".back").click();
  assert.equal(host.style.display, "none");
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
  assert.equal(dom.window.document.querySelectorAll("#blackbox-native-launcher").length, 1);
  dom.window.Blackbox.destroy();
});

test("waits for the native toolbar before showing its launcher", async () => {
  const dom = new JSDOM("<!doctype html><body></body>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.eval(clientSource);
  dom.window.__BLACKBOX_INJECT__({ version: "1.2.0", repository: "https://example.test", addons: [] });
  assert.equal(dom.window.document.getElementById("blackbox-native-launcher"), null);

  const help = dom.window.document.createElement("button");
  help.setAttribute("aria-label", "Open help menu");
  help.getBoundingClientRect = () => ({ left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32 });
  dom.window.document.body.append(help);
  await delay(15);
  assert.equal(dom.window.document.getElementById("blackbox-native-launcher")?.nextElementSibling, help);
  dom.window.Blackbox.destroy();
});
