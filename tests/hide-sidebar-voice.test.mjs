import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../tweaks/hide-sidebar-voice/index.js", import.meta.url), "utf8");
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <aside>
      <div data-sidebar-footer>
        <button type="button">ijsbeer</button>
        <button type="button" aria-label="Voice"><span>Voice</span></button>
        <button type="button" aria-label="Open help menu">?</button>
      </div>
    </aside>
    <div data-composer-radius-variant="default">
      <button type="button" aria-label="Start voice input">Mic</button>
    </div>
  </body></html>`, {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  let implementation;
  dom.window.BetterCodex = { register(value) { implementation = value; } };
  dom.window.eval(addonSource);
  return { dom, implementation };
}

test("hides only the sidebar Voice control and restores it on stop", () => {
  const { dom, implementation } = setup();
  const document = dom.window.document;
  const sidebarVoice = document.querySelector("[data-sidebar-footer] [aria-label='Voice']");
  const composerVoice = document.querySelector("[aria-label='Start voice input']");

  implementation.start();

  assert.equal(sidebarVoice.hasAttribute("data-bettercodex-hide-sidebar-voice"), true);
  assert.equal(dom.window.getComputedStyle(sidebarVoice).display, "none");
  assert.equal(composerVoice.hasAttribute("data-bettercodex-hide-sidebar-voice"), false);
  assert.equal(document.querySelectorAll("style[data-bettercodex-hide-sidebar-voice-style]").length, 1);
  assert.equal(dom.window.__BETTERCODEX_HIDE_SIDEBAR_VOICE_ACTIVE__, true);

  implementation.stop();
  implementation.stop();

  assert.equal(sidebarVoice.hasAttribute("data-bettercodex-hide-sidebar-voice"), false);
  assert.equal(document.querySelector("style[data-bettercodex-hide-sidebar-voice-style]"), null);
  assert.equal(dom.window.__BETTERCODEX_HIDE_SIDEBAR_VOICE_ACTIVE__, undefined);
  dom.window.close();
});

test("handles a Voice control mounted after startup without duplicating state", async () => {
  const { dom, implementation } = setup();
  const document = dom.window.document;
  document.querySelector("[data-sidebar-footer] [aria-label='Voice']").remove();

  implementation.start();
  const replacement = document.createElement("button");
  replacement.title = "Open voice conversation";
  replacement.textContent = "Voice";
  document.querySelector("[data-sidebar-footer]").prepend(replacement);
  await delay();

  assert.equal(replacement.hasAttribute("data-bettercodex-hide-sidebar-voice"), true);

  implementation.start();
  assert.equal(document.querySelectorAll("style[data-bettercodex-hide-sidebar-voice-style]").length, 1);
  assert.equal(replacement.hasAttribute("data-bettercodex-hide-sidebar-voice"), true);

  implementation.stop();
  assert.equal(replacement.hasAttribute("data-bettercodex-hide-sidebar-voice"), false);
  dom.window.close();
});
