import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../addons/cli-theme/index.js", import.meta.url), "utf8");

test("CLI theme applies globally, skins BetterCodex, and cleans up completely", () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body><div id='bettercodex-client-root'></div></body></html>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  const host = dom.window.document.getElementById("bettercodex-client-root");
  host.attachShadow({ mode: "open" }).innerHTML = "<div class='view'><aside class='sidebar'></aside></div>";

  let implementation;
  dom.window.BetterCodex = { register(value) { implementation = value; } };
  dom.window.eval(addonSource);

  implementation.start();
  implementation.start();

  assert.equal(dom.window.__BETTERCODEX_CLI_THEME_ACTIVE__, true);
  assert.equal(dom.window.document.documentElement.hasAttribute("data-bettercodex-cli-theme"), true);
  assert.equal(dom.window.document.querySelectorAll("style[data-bettercodex-cli-theme-style]").length, 1);
  assert.equal(host.hasAttribute("data-bettercodex-cli-theme-host"), true);
  assert.equal(host.shadowRoot.querySelectorAll("style[data-bettercodex-cli-theme-manager-style]").length, 1);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cli-theme-style]").textContent, /data-codex-composer/);
  assert.match(host.shadowRoot.querySelector("style[data-bettercodex-cli-theme-manager-style]").textContent, /Cascadia Code/);

  implementation.stop();

  assert.equal(dom.window.__BETTERCODEX_CLI_THEME_ACTIVE__, undefined);
  assert.equal(dom.window.document.documentElement.hasAttribute("data-bettercodex-cli-theme"), false);
  assert.equal(dom.window.document.querySelector("style[data-bettercodex-cli-theme-style]"), null);
  assert.equal(host.hasAttribute("data-bettercodex-cli-theme-host"), false);
  assert.equal(host.shadowRoot.querySelector("style[data-bettercodex-cli-theme-manager-style]"), null);
});
