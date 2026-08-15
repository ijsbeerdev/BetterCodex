import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../addons/weekly-limit/index.js", import.meta.url), "utf8");
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

function composer(document, micLabel = "Start voice input") {
  const surface = document.createElement("div");
  surface.setAttribute("data-composer-radius-variant", "default");
  surface.setAttribute("data-composer-surface-variant", "default");
  const editor = document.createElement("div");
  editor.setAttribute("data-codex-composer", "true");
  editor.contentEditable = "true";
  const toolbar = document.createElement("div");
  const attach = document.createElement("button");
  attach.type = "button";
  attach.setAttribute("aria-label", "Attach files");
  const mic = document.createElement("button");
  mic.type = "button";
  mic.setAttribute("aria-label", micLabel);
  const send = document.createElement("button");
  send.type = "button";
  send.setAttribute("aria-label", "Send message");
  toolbar.append(attach, mic, send);
  surface.append(editor, toolbar);
  return { surface, editor, toolbar, mic, send };
}

test("shows the authenticated weekly usage before the composer microphone and cleans up", async () => {
  const dom = new JSDOM("<!doctype html><html lang=\"en\"><head></head><body></body></html>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  const requests = [];
  const respond = (request) => {
    const usage = {
      rate_limit: {
        primary_window: {
          used_percent: 9,
          limit_window_seconds: 5 * 60 * 60,
          reset_at: 1_786_550_400
        },
        secondary_window: {
          used_percent: 27.6,
          limit_window_seconds: 7 * 24 * 60 * 60,
          reset_at: 1_786_896_000
        }
      }
    };
    dom.window.queueMicrotask(() => {
      dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
        data: {
          type: "fetch-response",
          requestId: request.requestId,
          responseType: "success",
          status: 200,
          headers: {},
          bodyJsonString: JSON.stringify(usage)
        }
      }));
    });
  };
  dom.window.electronBridge = {
    getSentryInitOptions() { return { appVersion: "26.803.10989" }; },
    async sendMessageFromView(request) {
      requests.push(request);
      respond(request);
    }
  };
  let implementation;
  dom.window.BetterCodex = { register(value) { implementation = value; } };
  dom.window.eval(addonSource);

  const first = composer(dom.window.document);
  dom.window.document.body.append(first.surface);
  implementation.start();
  await delay();

  const indicator = dom.window.document.querySelector("[data-bettercodex-weekly-limit]");
  assert.ok(indicator);
  assert.equal(indicator.textContent, "Weekly 72%");
  assert.equal(indicator.dataset.state, "healthy");
  assert.equal(indicator.getAttribute("aria-label"), "Weekly usage: 72% remaining");
  assert.equal(indicator.nextElementSibling, first.mic);
  assert.match(indicator.title, /^Weekly limit: 72% remaining · Resets /);
  assert.equal(dom.window.__BETTERCODEX_WEEKLY_LIMIT_ACTIVE__, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, "fetch");
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].url, "/wham/usage");
  assert.equal(requests[0].headers["X-OpenAI-Attach-Auth"], "1");
  assert.equal(requests[0].headers["X-OpenAI-Attach-Integrity-State"], "1");
  assert.equal(requests[0].headers["X-OpenAI-Codex-Client-Version"], "26.803.10989");

  const replacement = composer(dom.window.document, "Record audio");
  first.surface.replaceWith(replacement.surface);
  await delay();
  assert.equal(replacement.toolbar.querySelector("[data-bettercodex-weekly-limit]"), indicator);
  assert.equal(indicator.nextElementSibling, replacement.mic);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-weekly-limit]").length, 1);

  implementation.start();
  await delay();
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-weekly-limit]").length, 1);
  assert.equal(dom.window.document.querySelectorAll("style[data-bettercodex-weekly-limit-style]").length, 1);

  implementation.stop();
  implementation.stop();
  assert.equal(dom.window.document.querySelector("[data-bettercodex-weekly-limit]"), null);
  assert.equal(dom.window.document.querySelector("style[data-bettercodex-weekly-limit-style]"), null);
  assert.equal(dom.window.__BETTERCODEX_WEEKLY_LIMIT_ACTIVE__, undefined);
});
