import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../addons/hide-sidebar-help/index.js", import.meta.url), "utf8");
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <aside>
      <div data-sidebar-footer>
        <button type="button">ijsbeer</button>
        <button type="button" aria-label="Open help menu">?</button>
        <button id="bettercodex-native-launcher" type="button" aria-label="Open BetterCodex">Robot</button>
      </div>
    </aside>
    <main><button type="button" aria-label="Help">Page help</button></main>
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

test("hides only the sidebar Help control and restores it on stop", () => {
  const { dom, implementation } = setup();
  const document = dom.window.document;
  const sidebarHelp = document.querySelector("[data-sidebar-footer] [aria-label='Open help menu']");
  const pageHelp = document.querySelector("main [aria-label='Help']");
  const betterCodex = document.getElementById("bettercodex-native-launcher");

  implementation.start();

  assert.equal(sidebarHelp.hasAttribute("data-bettercodex-hide-sidebar-help"), true);
  assert.equal(dom.window.getComputedStyle(sidebarHelp).display, "none");
  assert.equal(pageHelp.hasAttribute("data-bettercodex-hide-sidebar-help"), false);
  assert.equal(betterCodex.hasAttribute("data-bettercodex-hide-sidebar-help"), false);
  assert.equal(document.querySelectorAll("style[data-bettercodex-hide-sidebar-help-style]").length, 1);
  assert.equal(dom.window.__BETTERCODEX_HIDE_SIDEBAR_HELP_ACTIVE__, true);

  implementation.stop();
  implementation.stop();

  assert.equal(sidebarHelp.hasAttribute("data-bettercodex-hide-sidebar-help"), false);
  assert.equal(document.querySelector("style[data-bettercodex-hide-sidebar-help-style]"), null);
  assert.equal(dom.window.__BETTERCODEX_HIDE_SIDEBAR_HELP_ACTIVE__, undefined);
  dom.window.close();
});

test("handles a Help control mounted after startup without duplicate state", async () => {
  const { dom, implementation } = setup();
  const document = dom.window.document;
  document.querySelector("[data-sidebar-footer] [aria-label='Open help menu']").remove();

  implementation.start();
  const replacement = document.createElement("button");
  replacement.title = "Help center";
  replacement.textContent = "?";
  document.querySelector("[data-sidebar-footer]").prepend(replacement);
  await delay();

  assert.equal(replacement.hasAttribute("data-bettercodex-hide-sidebar-help"), true);

  implementation.start();
  assert.equal(document.querySelectorAll("style[data-bettercodex-hide-sidebar-help-style]").length, 1);
  assert.equal(replacement.hasAttribute("data-bettercodex-hide-sidebar-help"), true);

  implementation.stop();
  assert.equal(replacement.hasAttribute("data-bettercodex-hide-sidebar-help"), false);
  dom.window.close();
});
