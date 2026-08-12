import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../addons/cyberpunk-theme/index.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../addons/cyberpunk-theme/manifest.json", import.meta.url), "utf8"));

test("Codex 2077 applies globally, skins BetterCodex, and cleans up completely", () => {
  assert.equal(manifest.name, "Codex 2077");
  const dom = new JSDOM("<!doctype html><html style='--codex-base-contrast:60'><head></head><body><div id='bettercodex-client-root'></div></body></html>", {
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

  assert.equal(dom.window.__BETTERCODEX_CYBERPUNK_THEME_ACTIVE__, true);
  assert.equal(dom.window.document.documentElement.hasAttribute("data-bettercodex-cyberpunk-theme"), true);
  assert.equal(dom.window.document.documentElement.hasAttribute("data-bettercodex-cyberpunk-low-contrast"), true);
  assert.equal(dom.window.document.querySelectorAll("style[data-bettercodex-cyberpunk-theme-style]").length, 1);
  assert.equal(host.hasAttribute("data-bettercodex-cyberpunk-theme-host"), true);
  assert.equal(host.shadowRoot.querySelectorAll("style[data-bettercodex-cyberpunk-theme-manager-style]").length, 1);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-codex-composer/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /prefers-reduced-transparency/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /thread-summary-panel-item-button/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /--color-token-dropdown-background/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /sidebar-section-heading="Projects"/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /button\[aria-label="Send"\]/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /aria-label="Application menu"/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /border-radius: 2px !important;\s+overflow: hidden/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /circle at 100% 0%/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /circle at 0% 100%/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /transparent 44rem/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /transparent 52rem/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /inset: 0 auto 0 0;\s+z-index: 21;\s+width: 2px/);
  assert.match(host.shadowRoot.querySelector("style[data-bettercodex-cyberpunk-theme-manager-style]").textContent, /#32e6ff/);
  assert.match(host.shadowRoot.querySelector("style[data-bettercodex-cyberpunk-theme-manager-style]").textContent, /\.track::after \{ border-radius: 2px/);
  assert.match(host.shadowRoot.querySelector("style[data-bettercodex-cyberpunk-theme-manager-style]").textContent, /background: #1688e8/);

  implementation.stop();

  assert.equal(dom.window.__BETTERCODEX_CYBERPUNK_THEME_ACTIVE__, undefined);
  assert.equal(dom.window.document.documentElement.hasAttribute("data-bettercodex-cyberpunk-theme"), false);
  assert.equal(dom.window.document.documentElement.hasAttribute("data-bettercodex-cyberpunk-low-contrast"), false);
  assert.equal(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]"), null);
  assert.equal(host.hasAttribute("data-bettercodex-cyberpunk-theme-host"), false);
  assert.equal(host.shadowRoot.querySelector("style[data-bettercodex-cyberpunk-theme-manager-style]"), null);
});
