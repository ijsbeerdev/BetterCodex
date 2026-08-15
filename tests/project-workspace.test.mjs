import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function setCaretToEnd(dom, node) {
  node.focus();
  const range = dom.window.document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  dom.window.getSelection().removeAllRanges();
  dom.window.getSelection().addRange(range);
}

function setSelection(dom, node) {
  node.focus();
  const range = dom.window.document.createRange();
  range.selectNodeContents(node);
  dom.window.getSelection().removeAllRanges();
  dom.window.getSelection().addRange(range);
}

function inputContent(dom, node, value) {
  node.textContent = value;
  setCaretToEnd(dom, node);
  node.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}

function dispatchWorkspaceApi(dom, detail) {
  let response;
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("bettercodex:project-workspace-api", {
    detail: { ...detail, respond(value) { response = value; } }
  }));
  return response;
}

function createDom() {
  return new JSDOM(`<!doctype html><html><head></head><body>
    <aside><nav aria-label="Projects">
      <div class="rows">
        <div class="sidebar-item"><button type="button" class="sidebar-item"><div><span><svg></svg></span><span class="text-fade-truncate">New chat</span></div></button><button aria-label="Quick chat"></button></div>
        <div class="sidebar-item selected"><button type="button" aria-current="page">Pull requests</button></div>
      </div>
      <div class="sidebar-item" data-app-action-sidebar-project-row data-app-action-sidebar-project-id="project-1" data-app-action-sidebar-project-label="bettercodex">bettercodex</div>
      <div data-app-action-sidebar-project-list-id="project-1">
        <div class="sidebar-item" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:docs" data-app-action-sidebar-thread-title="Document workspace" data-app-action-sidebar-thread-active="true"><span>Document workspace</span></div>
      </div>
    </nav></aside>
    <div aria-hidden="true" style="visibility: hidden"><main class="hidden-overlay">Back to ChatGPT</main></div>
    <main class="native-main-surface">
      <div data-native-content>Native task</div>
      <div data-codex-composer contenteditable="true" aria-label="Message"></div>
    </main>
  </body></html>`, {
    url: "https://codex.local/tasks/current",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
}

test("creates a project-scoped Workspace tab with nested pages, rich blocks, search, context, persistence, and cleanup", async (t) => {
  const source = await readFile(new URL("../addons/project-workspace/index.js", import.meta.url), "utf8");
  const dom = createDom();
  let registration;
  dom.window.BetterCodex = {
    register(value) { registration = value; },
    storage: dom.window.localStorage,
    isEnabled() { return true; }
  };
  dom.window.confirm = () => true;
  dom.window.prompt = (_label, fallback) => fallback;
  dom.window.eval(source);
  t.after(() => registration?.stop());
  assert.equal(registration.id, "project-workspace");

  registration.start();
  await delay(10);
  const launcher = dom.window.document.querySelector("[data-bettercodex-project-workspace-launcher]");
  assert.ok(launcher);
  assert.equal(launcher.textContent.trim(), "Workspace");
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-workspace-launcher-row]").length, 1);

  launcher.click();
  const root = dom.window.document.querySelector("[data-bettercodex-project-workspace-root]");
  const nativeMain = dom.window.document.querySelector("main.native-main-surface:not([data-bettercodex-project-workspace-root])");
  assert.equal(root.tagName, "MAIN");
  assert.equal(root.className, "native-main-surface");
  assert.equal(root.hidden, false);
  assert.equal(nativeMain.hidden, true);
  assert.match(root.textContent, /Build your project knowledge base/);

  root.querySelector(".bbpw-empty [data-new-page]").click();
  await delay(0);
  const title = root.querySelector("[data-bbpw-page-title]");
  assert.ok(title instanceof dom.window.HTMLInputElement);
  title.value = "Project Architecture";
  title.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "Project Architecture" }));
  assert.match(root.querySelector("[data-bbpw-sidebar]").textContent, /Project Architecture/);

  let editable = root.querySelector("[data-block-editable]");
  editable.textContent = "# Architecture";
  editable.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "# Architecture" }));
  await delay(0);
  assert.equal(root.querySelector("[data-block-type='h1']")?.textContent.trim().endsWith("Architecture"), true);

  const addBlock = root.querySelector("[data-block-add]");
  addBlock.click();
  await delay(0);
  editable = [...root.querySelectorAll("[data-block-editable]")].at(-1);
  editable.textContent = "/code";
  editable.focus();
  const slashRange = dom.window.document.createRange();
  slashRange.selectNodeContents(editable);
  slashRange.collapse(false);
  dom.window.getSelection().removeAllRanges();
  dom.window.getSelection().addRange(slashRange);
  editable.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "/code" }));
  assert.match(root.querySelector("[role='listbox']").textContent, /Code Block/);
  editable.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await delay(0);
  assert.ok(root.querySelector("[data-code-editor]"));

  let listed;
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("bettercodex:project-workspace-api", {
    detail: { action: "listPages", respond(value) { listed = value; } }
  }));
  assert.equal(listed.length, 1);
  const parentId = listed[0].id;
  let created;
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("bettercodex:project-workspace-api", {
    detail: {
      action: "createPage",
      parentId,
      title: "Authentication API",
      icon: "🔐",
      markdown: "## Endpoints\n\n- [ ] Document refresh tokens\n\n```typescript\nexport const auth = true;\n```",
      respond(value) { created = value; }
    }
  }));
  assert.equal(created.parentId, parentId);
  assert.match(root.querySelector("[data-bbpw-sidebar]").textContent, /Authentication API/);
  assert.ok(root.querySelector("[data-block-type='checklist']"));
  assert.ok(root.querySelector("[data-block-type='code']"));

  root.querySelector("[data-toggle-context]").click();
  assert.equal(root.querySelector("[data-toggle-context]").getAttribute("aria-pressed"), "true");
  await delay(400);
  const stored = JSON.parse(dom.window.localStorage.getItem("bettercodex.project-workspace.v1"));
  assert.equal(stored.version, 1);
  assert.deepEqual(Object.keys(stored.projects), ["project:project-1"]);
  assert.equal(stored.projects["project:project-1"].pages.length, 2);
  assert.equal(stored.projects["project:project-1"].pages.find((page) => page.id === created.id).contextEnabled, true);

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "p", ctrlKey: true, bubbles: true, cancelable: true }));
  const quick = root.querySelector("[data-quick-input]");
  assert.ok(quick);
  quick.value = "refresh tokens";
  quick.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "refresh tokens" }));
  assert.match(root.querySelector("[data-quick-results]").textContent, /Authentication API/);
  root.querySelector("[data-quick-overlay]").remove();

  root.querySelector("[data-codex-page-action='ask']").click();
  await delay(10);
  assert.equal(root.hidden, true);
  assert.equal(nativeMain.hidden, false);
  assert.match(nativeMain.querySelector("[data-codex-composer]").textContent, /Authentication API/);
  assert.match(nativeMain.querySelector("[data-codex-composer]").textContent, /refresh tokens/i);

  registration.start();
  await delay(10);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-workspace-launcher]").length, 1);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-workspace-root]").length, 1);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-workspace-style]").length, 1);

  registration.stop();
  registration.stop();
  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-workspace-launcher]"), null);
  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-workspace-root]"), null);
  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-workspace-style]"), null);
  assert.equal(nativeMain.hidden, false);
});

test("inserts, edits, and persists every Workspace document block", async (t) => {
  const source = await readFile(new URL("../addons/project-workspace/index.js", import.meta.url), "utf8");
  const dom = createDom();
  let registration;
  dom.window.BetterCodex = { register(value) { registration = value; }, storage: dom.window.localStorage, isEnabled() { return true; } };
  dom.window.eval(source);
  t.after(() => registration?.stop());
  registration.start();
  await delay(10);
  dom.window.document.querySelector("[data-bettercodex-project-workspace-launcher]").click();
  const root = dom.window.document.querySelector("[data-bettercodex-project-workspace-root]");
  const page = dispatchWorkspaceApi(dom, { action: "createPage", title: "Every block" });
  assert.ok(page);

  const commands = [
    ["text", "text", "[data-block-editable]"],
    ["h1", "h1", ".bbpw-h1"],
    ["h2", "h2", ".bbpw-h2"],
    ["h3", "h3", ".bbpw-h3"],
    ["bullet", "bullet", ".bbpw-list-marker"],
    ["numbered", "numbered", ".bbpw-list-marker"],
    ["checklist", "checklist", "[data-check-block]"],
    ["quote", "quote", ".bbpw-quote"],
    ["divider", "divider", ".bbpw-divider"],
    ["code", "code", "[data-code-editor]"],
    ["mermaid", "mermaid", "[data-mermaid-source]"],
    ["file", "file", "a[data-workspace-ref='file']"],
    ["table", "table", ".bbpw-table"],
    ["callout", "callout", "[data-callout-icon]"],
    ["toggle", "toggle", "[data-toggle-block]"],
    ["image", "image", "[data-image-src]"]
  ];

  for (let index = 0; index < commands.length; index += 1) {
    const [type, query, selector] = commands[index];
    if (index > 0) {
      const last = [...root.querySelectorAll("[data-block-id]")].at(-1);
      last.querySelector("[data-block-add]").click();
      await delay(0);
    }
    const editable = [...root.querySelectorAll("[data-block-editable]")].at(-1);
    inputContent(dom, editable, `/${query}`);
    const command = root.querySelector(`[data-command-type='${type}']`);
    assert.ok(command, `slash command ${type} should be available`);
    command.click();
    if (type === "file") {
      const pathInput = root.querySelector("[data-reference-path-input]");
      assert.ok(pathInput, "file reference uses the in-app path picker");
      pathInput.value = "src/auth.ts";
      root.querySelector("[data-reference-path-confirm]").click();
    }
    await delay(0);
    const block = [...root.querySelectorAll("[data-block-id]")].at(-1);
    assert.ok(block.querySelector(selector), `${type} block should render ${selector}`);
  }

  let code = root.querySelector("[data-code-editor]");
  code.focus();
  code.textContent = "const answer = 42; // verified";
  code.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: code.textContent }));
  const language = root.querySelector("[data-code-language]");
  language.value = "javascript";
  language.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "javascript" }));
  code.blur();
  assert.match(code.textContent, /answer = 42/);
  assert.ok(code.querySelector(".bbpw-token-keyword"));

  const mermaid = root.querySelector("[data-mermaid-source]");
  mermaid.value = "flowchart TD\n  Start[Start] --> Done[Done]";
  mermaid.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: mermaid.value }));
  assert.ok(root.querySelector("[data-mermaid-preview] svg"));
  assert.match(root.querySelector("[data-mermaid-preview]").textContent, /Start/);

  let table = root.querySelector(".bbpw-table");
  let firstCell = table.querySelector("td");
  firstCell.textContent = "Endpoint";
  firstCell.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "Endpoint" }));
  root.querySelector("[data-table-row-add]").click();
  root.querySelector("[data-table-column-add]").click();
  table = root.querySelector(".bbpw-table");
  assert.equal(table.querySelectorAll("tr").length, 3);
  assert.equal(table.querySelectorAll("tr:first-child td").length, 3);
  assert.equal(table.querySelector("td").textContent, "Endpoint");

  const check = root.querySelector("[data-check-block]");
  check.checked = true;
  check.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(check.closest("[data-block-id]").getAttribute("data-checked"), "true");
  const calloutIcon = root.querySelector("[data-callout-icon]");
  calloutIcon.value = "⚠️";
  calloutIcon.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "⚠️" }));
  const toggleSummary = root.querySelector("[data-toggle-summary]");
  toggleSummary.textContent = "Implementation details";
  toggleSummary.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "Implementation details" }));
  const toggleBody = root.querySelector("[data-toggle-body]");
  toggleBody.textContent = "Hidden documentation";
  toggleBody.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "Hidden documentation" }));

  let imageInput = root.querySelector("[data-image-src]");
  imageInput.value = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  imageInput.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: imageInput.value }));
  imageInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  const caption = root.querySelector("[data-image-caption]");
  caption.textContent = "Architecture diagram";
  caption.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: "Architecture diagram" }));
  assert.ok(root.querySelector(".bbpw-image img"));

  const current = dispatchWorkspaceApi(dom, { action: "getPage", pageId: page.id });
  assert.equal(current.blocks.length, commands.length);
  assert.deepEqual(Array.from(current.blocks, (block) => block.type), ["text", "h1", "h2", "h3", "bullet", "numbered", "checklist", "quote", "divider", "code", "mermaid", "text", "table", "callout", "toggle", "image"]);
  assert.match(current.blocks.find((block) => block.type === "code").code, /answer = 42/);
  assert.equal(current.blocks.find((block) => block.type === "table").cells[0][0], "Endpoint");
  assert.match(current.blocks.find((block) => /data-workspace-ref="file"/.test(block.html || "")).html, /src\/auth\.ts/);
  assert.equal(current.blocks.find((block) => block.type === "image").caption, "Architecture diagram");
  await delay(400);
  const stored = JSON.parse(dom.window.localStorage.getItem("bettercodex.project-workspace.v1"));
  assert.equal(stored.projects["project:project-1"].pages.find((candidate) => candidate.id === page.id).blocks.length, commands.length);
});

test("supports inline formatting and file, folder, page, and Kanban references", async (t) => {
  const source = await readFile(new URL("../addons/project-workspace/index.js", import.meta.url), "utf8");
  const dom = createDom();
  let registration;
  dom.window.BetterCodex = { register(value) { registration = value; }, storage: dom.window.localStorage, isEnabled() { return true; } };
  dom.window.localStorage.setItem("bettercodex.project-kanban.v1", JSON.stringify({
    version: 3,
    cards: [{ id: "AUTH-12", title: "Implement authentication", project: "bettercodex", status: "old", progress: "", href: "", native: false, projectLinked: true, hidden: false, updatedAt: 1 }]
  }));
  dom.window.eval(source);
  t.after(() => registration?.stop());
  registration.start();
  await delay(10);
  dom.window.document.querySelector("[data-bettercodex-project-workspace-launcher]").click();
  const root = dom.window.document.querySelector("[data-bettercodex-project-workspace-root]");
  const sourcePage = dispatchWorkspaceApi(dom, { action: "createPage", title: "References" });
  const linkedPage = dispatchWorkspaceApi(dom, { action: "createPage", title: "Linked Architecture" });
  dispatchWorkspaceApi(dom, { action: "openPage", pageId: sourcePage.id });

  const addTextBlock = async () => {
    const last = [...root.querySelectorAll("[data-block-id]")].at(-1);
    last.querySelector("[data-block-add]").click();
    await delay(0);
    return [...root.querySelectorAll("[data-block-editable]")].at(-1);
  };
  const insertReference = async (query, kind, path = "") => {
    const editable = await addTextBlock();
    inputContent(dom, editable, `@${query}`);
    const option = [...root.querySelectorAll("[data-reference-index]")].find((node) => node.textContent.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    assert.ok(option, `${kind} reference option should appear`);
    option.click();
    if (path) {
      const input = root.querySelector("[data-reference-path-input]");
      assert.ok(input, `${kind} uses the in-app path picker`);
      input.value = path;
      input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    }
    await delay(0);
    const anchor = [...root.querySelectorAll(`a[data-workspace-ref='${kind}']`)].at(-1);
    assert.ok(anchor, `${kind} reference should be inserted`);
    return anchor;
  };

  await insertReference("file", "file", "src/auth.ts");
  await insertReference("folder", "folder", "src/components");
  await insertReference("Linked", "page");
  await insertReference("authentication", "kanban");
  const fileReference = root.querySelector("a[data-workspace-ref='file']");
  const folderReference = root.querySelector("a[data-workspace-ref='folder']");
  const pageReference = root.querySelector("a[data-workspace-ref='page']");
  const kanbanReference = root.querySelector("a[data-workspace-ref='kanban']");
  assert.equal(fileReference.getAttribute("data-ref-value"), "src/auth.ts");
  assert.equal(folderReference.getAttribute("data-ref-value"), "src/components");
  assert.equal(pageReference.getAttribute("data-ref-value"), linkedPage.id);
  assert.equal(kanbanReference.getAttribute("data-ref-value"), "AUTH-12");

  let openedResource;
  const openHandler = (event) => { openedResource = event.detail; event.detail.respond(true); };
  dom.window.document.addEventListener("bettercodex:project-resource-open", openHandler);
  fileReference.click();
  assert.equal(openedResource.path, "src/auth.ts");
  assert.equal(openedResource.kind, "file");
  assert.equal(root.hidden, false);
  dom.window.document.removeEventListener("bettercodex:project-resource-open", openHandler);
  fileReference.click();
  assert.match(root.querySelector("[role='menu'][aria-label='Open project file']").textContent, /Open with Codex/);
  assert.match(root.querySelector("[role='menu'][aria-label='Open project file']").textContent, /Copy path/);
  root.querySelector("[role='menu'][aria-label='Open project file']").remove();

  pageReference.click();
  assert.equal(root.querySelector("[data-bbpw-page-title]").value, "Linked Architecture");
  dispatchWorkspaceApi(dom, { action: "openPage", pageId: sourcePage.id });
  let formatted = root.querySelector("[data-block-editable]");
  const formattedBlockId = formatted.getAttribute("data-block-editable");
  for (const [action, selector] of [["bold", "strong"], ["italic", "em"], ["strikeThrough", "del"], ["code", "code"]]) {
    formatted = root.querySelector(`[data-block-editable='${formattedBlockId}']`);
    inputContent(dom, formatted, `Format ${action}`);
    assert.equal(formatted.isConnected, true);
    assert.equal(formatted.textContent, `Format ${action}`);
    setSelection(dom, formatted);
    assert.equal(dom.window.getSelection().toString(), `Format ${action}`);
    formatted.dispatchEvent(new dom.window.Event("mouseup", { bubbles: true }));
    await delay(0);
    const formatAction = root.querySelector(`[data-selection-action='${action}']`);
    assert.ok(formatAction, `${action} action should appear; selection=${dom.window.getSelection().toString()} toolbar=${root.querySelector(".bbpw-selection-toolbar")?.textContent || "missing"}`);
    formatAction.click();
    formatted = root.querySelector(`[data-block-editable='${formattedBlockId}']`);
    assert.ok(formatted.querySelector(selector), `${action} formatting should insert ${selector}; html=${formatted.outerHTML}; stored=${JSON.stringify(dispatchWorkspaceApi(dom, { action: "getPage", pageId: sourcePage.id }).blocks[0])}`);
  }
  formatted = root.querySelector(`[data-block-editable='${formattedBlockId}']`);
  inputContent(dom, formatted, "Open documentation");
  setSelection(dom, formatted);
  formatted.dispatchEvent(new dom.window.Event("mouseup", { bubbles: true }));
  await delay(0);
  root.querySelector("[data-selection-action='link']").click();
  const linkInput = root.querySelector("[data-link-url-input]");
  assert.ok(linkInput, "links use the in-app URL picker");
  linkInput.value = "https://example.com/docs";
  root.querySelector("[data-link-url-confirm]").click();
  assert.equal(formatted.querySelector("a")?.getAttribute("href"), "https://example.com/docs");

  const savedPage = dispatchWorkspaceApi(dom, { action: "getPage", pageId: sourcePage.id });
  const allHtml = savedPage.blocks.map((block) => block.html || "").join("\n");
  for (const value of ["src/auth.ts", "src/components", linkedPage.id, "AUTH-12", "https://example.com/docs"]) assert.match(allHtml, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("applies every supported Markdown block shortcut", async (t) => {
  const source = await readFile(new URL("../addons/project-workspace/index.js", import.meta.url), "utf8");
  const dom = createDom();
  let registration;
  dom.window.BetterCodex = { register(value) { registration = value; }, storage: dom.window.localStorage, isEnabled() { return true; } };
  dom.window.eval(source);
  t.after(() => registration?.stop());
  registration.start();
  await delay(10);
  dom.window.document.querySelector("[data-bettercodex-project-workspace-launcher]").click();
  const root = dom.window.document.querySelector("[data-bettercodex-project-workspace-root]");
  const page = dispatchWorkspaceApi(dom, { action: "createPage", title: "Markdown shortcuts" });
  const shortcuts = [
    ["# Heading one", "h1"],
    ["## Heading two", "h2"],
    ["### Heading three", "h3"],
    ["- Bullet item", "bullet"],
    ["1. Numbered item", "numbered"],
    ["[] Checklist item", "checklist"],
    ["> Quoted item", "quote"],
    ["```", "code"]
  ];
  for (let index = 0; index < shortcuts.length; index += 1) {
    if (index > 0) {
      [...root.querySelectorAll("[data-block-id]")].at(-1).querySelector("[data-block-add]").click();
      await delay(0);
    }
    const editable = [...root.querySelectorAll("[data-block-editable]")].at(-1);
    inputContent(dom, editable, shortcuts[index][0]);
    await delay(0);
    assert.equal([...root.querySelectorAll("[data-block-id]")].at(-1).getAttribute("data-block-type"), shortcuts[index][1]);
  }
  const saved = dispatchWorkspaceApi(dom, { action: "getPage", pageId: page.id });
  assert.deepEqual(Array.from(saved.blocks, (block) => block.type), shortcuts.map(([, type]) => type));
});

test("converts Workspace checklists into optional runnable Kanban cards", async (t) => {
  const [workspaceSource, kanbanSource] = await Promise.all([
    readFile(new URL("../addons/project-workspace/index.js", import.meta.url), "utf8"),
    readFile(new URL("../addons/project-kanban/index.js", import.meta.url), "utf8")
  ]);
  const dom = createDom();
  const registrations = new Map();
  dom.window.BetterCodex = {
    register(value) { registrations.set(value.id, value); },
    storage: dom.window.localStorage,
    isEnabled() { return true; }
  };
  dom.window.prompt = (_label, fallback) => fallback;
  dom.window.eval(kanbanSource);
  dom.window.eval(workspaceSource);
  t.after(() => [...registrations.values()].forEach((registration) => registration.stop()));
  registrations.get("project-kanban").start();
  registrations.get("project-workspace").start();
  await delay(10);

  dom.window.document.querySelector("[data-bettercodex-project-workspace-launcher]").click();
  let page;
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("bettercodex:project-workspace-api", {
    detail: { action: "createPage", title: "Roadmap", markdown: "- [ ] Ship Workspace documentation", respond(value) { page = value; } }
  }));
  assert.ok(page);
  const checklist = dom.window.document.querySelector("[data-bettercodex-project-workspace-root] [data-block-type='checklist']");
  checklist.querySelector("[data-block-menu]").click();
  dom.window.document.querySelector("[data-kanban-block]").click();
  await delay(0);

  const stored = JSON.parse(dom.window.localStorage.getItem("bettercodex.project-kanban.v1"));
  const card = stored.cards.find((candidate) => candidate.title === "Ship Workspace documentation");
  assert.ok(card);
  assert.equal(card.native, false);
  assert.equal(card.status, "old");
  assert.equal(card.project, "bettercodex");

  dom.window.document.querySelector("[data-bettercodex-project-kanban-launcher]").click();
  const kanbanRoot = dom.window.document.querySelector("[data-bettercodex-project-kanban-root]");
  const workspaceRoot = dom.window.document.querySelector("[data-bettercodex-project-workspace-root]");
  const nativeMain = dom.window.document.querySelector("main.native-main-surface:not([data-bettercodex-project-kanban-root]):not([data-bettercodex-project-workspace-root])");
  assert.match(kanbanRoot.querySelector("[data-bbpk-list='old']").textContent, /Ship Workspace documentation/);
  assert.equal(kanbanRoot.hidden, false);
  assert.equal(workspaceRoot.hidden, true);
  assert.equal(nativeMain.hidden, true);

  dom.window.document.querySelector("[data-bettercodex-project-workspace-launcher]").click();
  assert.equal(kanbanRoot.hidden, true);
  assert.equal(workspaceRoot.hidden, false);
  assert.equal(nativeMain.hidden, true);
  dom.window.document.querySelector("[data-app-action-sidebar-project-row]").click();
  await delay(0);
  assert.equal(workspaceRoot.hidden, true);
  assert.equal(nativeMain.hidden, false);
});
