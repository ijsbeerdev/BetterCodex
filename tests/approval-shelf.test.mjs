import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const addonSource = await readFile(new URL("../tweaks/approval-shelf/index.js", import.meta.url), "utf8");
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

function nativeComposer(document, editor = null) {
  const surface = document.createElement("div");
  surface.setAttribute("data-composer-layout", "multiline");
  surface.setAttribute("data-composer-radius-variant", "default");
  surface.setAttribute("data-composer-surface-variant", "default");
  const editorParent = document.createElement("div");
  const nativeEditor = editor || document.createElement("div");
  nativeEditor.contentEditable = "true";
  nativeEditor.setAttribute("data-codex-composer", "true");
  const toolbar = document.createElement("div");
  toolbar.append(document.createElement("button"), document.createElement("button"));
  editorParent.append(nativeEditor);
  surface.append(editorParent, toolbar);
  return { surface, editor: nativeEditor, editorParent, toolbar };
}

test("keeps Codex's native composer surface mounted beneath approvals", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  let implementation;
  dom.window.BetterCodex = { register(value) { implementation = value; } };
  dom.window.eval(addonSource);

  const original = nativeComposer(dom.window.document);
  original.editor.textContent = "Yaba yaba";
  dom.window.document.body.append(original.surface);
  implementation.start();
  assert.equal(dom.window.__BETTERCODEX_APPROVAL_SHELF_ACTIVE__, true);

  original.editor.remove();
  original.surface.remove();
  const approval = dom.window.document.createElement("div");
  approval.setAttribute("data-codex-approval-surface", "true");
  dom.window.document.body.append(approval);
  await delay();

  assert.equal(approval.nextElementSibling, original.surface);
  assert.equal(original.surface.hasAttribute("data-bettercodex-preserved-composer"), true);
  assert.equal(original.editor.parentElement, original.editorParent);
  assert.equal(original.editor.textContent, "Yaba yaba");
  assert.equal(original.toolbar.querySelectorAll("button").length, 2);
  assert.equal(dom.window.document.querySelector("[data-bettercodex-approval-draft]"), null);
  assert.equal(dom.window.document.body.textContent.includes("Your draft is safe"), false);

  original.editor.textContent = "Yaba yaba :p";
  approval.remove();
  const returned = nativeComposer(dom.window.document, original.editor);
  dom.window.document.body.append(returned.surface);
  await delay();

  assert.equal(returned.editor, original.editor);
  assert.equal(returned.editor.textContent, "Yaba yaba :p");
  assert.equal(original.surface.isConnected, false);

  implementation.stop();
  assert.equal(dom.window.__BETTERCODEX_APPROVAL_SHELF_ACTIVE__, undefined);
});
