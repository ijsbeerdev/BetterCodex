import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../addons/auto-expand-activity/index.js", import.meta.url), "utf8");
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

function activityButton(document) {
  const button = document.createElement("button");
  button.className = "group/activity-header inline-flex";
  button.setAttribute("aria-expanded", "false");
  button.textContent = "Edited files, ran commands";
  let clicks = 0;
  button.addEventListener("click", () => {
    clicks += 1;
    button.setAttribute("aria-expanded", "true");
  });
  return { button, clicks: () => clicks };
}

test("expands existing and newly collapsed activity groups until disabled", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://codex.local/",
    runScripts: "dangerously"
  });
  let implementation;
  dom.window.BetterCodex = { register(value) { implementation = value; } };
  dom.window.eval(addonSource);

  const existing = activityButton(dom.window.document);
  dom.window.document.body.append(existing.button);
  implementation.start();
  assert.equal(existing.button.getAttribute("aria-expanded"), "true");
  assert.equal(existing.clicks(), 1);
  assert.equal(dom.window.__BETTERCODEX_AUTO_EXPAND_ACTIVITY_ACTIVE__, true);

  const added = activityButton(dom.window.document);
  dom.window.document.body.append(added.button);
  await delay();
  assert.equal(added.button.getAttribute("aria-expanded"), "true");
  assert.equal(added.clicks(), 1);

  added.button.setAttribute("aria-expanded", "false");
  await delay();
  assert.equal(added.button.getAttribute("aria-expanded"), "true");
  assert.equal(added.clicks(), 2);

  implementation.stop();
  assert.equal(dom.window.__BETTERCODEX_AUTO_EXPAND_ACTIVITY_ACTIVE__, undefined);
  const afterStop = activityButton(dom.window.document);
  dom.window.document.body.append(afterStop.button);
  await delay();
  assert.equal(afterStop.button.getAttribute("aria-expanded"), "false");
  assert.equal(afterStop.clicks(), 0);
});
