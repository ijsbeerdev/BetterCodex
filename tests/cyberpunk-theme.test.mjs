import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../themes/cyberpunk-theme/index.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../themes/cyberpunk-theme/manifest.json", import.meta.url), "utf8"));

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
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /sidebar-section-heading="Pinned"/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /button\[aria-label="Send"\]/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /aria-label="Application menu"/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /header\[data-app-shell-application-menu-bar="true"\]/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /background: transparent !important;\s+box-shadow: none !important/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-app-shell-tab-controller/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-composer-home-utility-bar-position="above"/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-composer-placement="home"/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /--bc-cyber-composer-surface: var\(--bc-cyber-raised\)/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /--bc-cyber-composer-gradient: linear-gradient\(100deg, #17192d 0%, #16172b 11%, #161124 35%, #181126 50%, #1c1227 80%, #1f1229 100%\)/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /> \[data-composer-layout\] \{\s+border: 0 none !important;\s+background: var\(--bc-cyber-composer-gradient\) !important/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-composer-placement="home"\][^{]+\{\s+gap: 0 !important;\s+border: 0 !important;\s+overflow: hidden !important;\s+background: var\(--bc-cyber-composer-surface\) !important/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-composer-surface-variant\]:focus-within \{\s+border-color: var\(--bc-cyber-border-hot\) !important;\s+box-shadow: 0 0 0 1px rgba\(50, 230, 255, \.05\)/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /\[data-codex-composer\]:focus-visible \{\s+outline: none !important;\s+box-shadow: none !important/);
  assert.doesNotMatch(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-composer-placement="home"\][^{]+> \[data-composer-layout\][^{]+background: transparent/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /data-composer-surface-variant\]::before/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /z-index: 20;\s+display: block;\s+pointer-events: none/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /:has\(\[data-codex-composer-root\]\[data-composer-placement="home"\]\)/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /background-size: 30px 30px, 30px 30px, auto !important/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /\.sidebar-item:hover/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /:focus-within \{\s+border-color: var\(--bc-cyber-border-hot\) !important/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /border-radius: 2px !important;\s+overflow: hidden/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /linear-gradient\(90deg, rgba\(50, 230, 255, \.17\)/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /linear-gradient\(270deg, rgba\(255, 60, 172, \.12\)/);
  assert.match(dom.window.document.querySelector("style[data-bettercodex-cyberpunk-theme-style]").textContent, /transparent 34rem/);
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
