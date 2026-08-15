import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../tweaks/thinking-mode-colors/index.js", import.meta.url), "utf8");
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

test("colors thinking modes in the composer and picker and cleans up when disabled", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <div data-composer-radius-variant="compact" data-composer-surface-variant="default">
      <button><span>5.6 Sol</span><span id="active-mode">High</span></button>
      <div data-codex-composer contenteditable="true"><p id="draft-mode">Low</p></div>
    </div>
    <button id="unrelated">Low</button>
    <div role="listbox">
      <div role="option"><span id="low-option">Low</span><span>Quick replies</span></div>
      <div role="option"><span id="ultra-option">Ultra</span><span>Deepest reasoning</span></div>
    </div>
    <div role="menu"><span id="single-mode">Medium</span></div>
  </body></html>`, {
    url: "https://codex.local/",
    runScripts: "dangerously"
  });
  let implementation;
  dom.window.BetterCodex = { register(value) { implementation = value; } };
  dom.window.eval(addonSource);

  implementation.start();
  const { document } = dom.window;
  assert.equal(document.getElementById("active-mode").getAttribute("data-bettercodex-thinking-mode"), "high");
  assert.equal(document.getElementById("low-option").getAttribute("data-bettercodex-thinking-mode"), "low");
  assert.equal(document.getElementById("ultra-option").getAttribute("data-bettercodex-thinking-mode"), "ultra");
  assert.equal(document.getElementById("unrelated").hasAttribute("data-bettercodex-thinking-mode"), false);
  assert.equal(document.getElementById("draft-mode").hasAttribute("data-bettercodex-thinking-mode"), false);
  assert.equal(document.getElementById("single-mode").hasAttribute("data-bettercodex-thinking-mode"), false);
  assert.equal(dom.window.__BETTERCODEX_THINKING_MODE_COLORS_ACTIVE__, true);
  assert.match(document.querySelector("style[data-bettercodex-thinking-mode-colors-style]").textContent, /light-dark\(#7c3aed, #b58cff\)/);

  document.getElementById("active-mode").textContent = "XHigh";
  await delay();
  assert.equal(document.getElementById("active-mode").getAttribute("data-bettercodex-thinking-mode"), "xhigh");

  const newMode = document.createElement("span");
  newMode.textContent = "Max";
  document.querySelector("[data-composer-surface-variant]").append(newMode);
  await delay();
  assert.equal(newMode.getAttribute("data-bettercodex-thinking-mode"), "max");

  implementation.stop();
  assert.equal(document.querySelector("style[data-bettercodex-thinking-mode-colors-style]"), null);
  assert.equal(document.querySelector(`[data-bettercodex-thinking-mode]`), null);
  assert.equal(dom.window.__BETTERCODEX_THINKING_MODE_COLORS_ACTIVE__, undefined);

  const afterStop = document.createElement("span");
  afterStop.textContent = "Minimal";
  document.querySelector("[data-composer-surface-variant]").append(afterStop);
  await delay();
  assert.equal(afterStop.hasAttribute("data-bettercodex-thinking-mode"), false);
});
