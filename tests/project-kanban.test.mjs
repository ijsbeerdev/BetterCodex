import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("renders a native task Kanban, tracks activity and change totals, completes stopped tasks, and cleans up", async (t) => {
  const source = await readFile(new URL("../addons/project-kanban/index.js", import.meta.url), "utf8");
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <aside>
      <nav aria-label="Projects">
        <div class="rows">
          <div class="sidebar-item"><button type="button"><div><span><svg></svg></span><span class="text-fade-truncate">New chat</span></div></button><button aria-label="Quick chat"></button></div>
          <div class="sidebar-item selected"><button type="button" aria-current="page">Pull requests</button></div>
        </div>
        <div class="sidebar-item" role="button" tabindex="0" data-app-action-sidebar-project-row data-app-action-sidebar-project-id="project-1" data-app-action-sidebar-project-label="bettercodex">bettercodex</div>
        <div data-app-action-sidebar-project-list-id="project-1">
          <div class="sidebar-item" role="button" tabindex="0" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:auth" data-app-action-sidebar-thread-title="Build authentication" data-app-action-sidebar-thread-active="true">
            <span>Build authentication</span><span role="status">Working</span><time datetime="2026-08-10T09:58:00Z">2m</time><button type="button" aria-label="More options for Build authentication"><svg></svg></button>
          </div>
          <div class="sidebar-item" role="button" tabindex="0" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:review" data-app-action-sidebar-thread-title="Review access policy">
            <span>Review access policy</span><span role="status">Awaiting approval</span>
          </div>
          <div class="sidebar-item" role="button" tabindex="0" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:old" data-app-action-sidebar-thread-title="Explain gateway logic">
            <span>Explain gateway logic</span>
          </div>
          <div class="sidebar-item" role="button" tabindex="0" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:done" data-app-action-sidebar-thread-title="Update README">
            <span>Update README</span><span role="status">Complete</span>
          </div>
        </div>
        <div class="sidebar-item" role="button" tabindex="0" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:ghost" data-app-action-sidebar-thread-title="Unlinked ChatGPT conversation"><span>Unlinked ChatGPT conversation</span></div>
        <div class="sidebar-item" role="button" tabindex="0" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:render" data-app-action-sidebar-thread-title="Render graph" data-project-name="ComfyUI"><span>Render graph</span></div>
      </nav>
    </aside>
    <main class="native-main-surface">
      <div data-native-content>Native task<div>src/auth.js +1,400 -900</div><div>tests/auth.test.js +64 -16</div></div>
      <section data-thread-summary>
        <button data-slot="thread-summary-panel-item-button"><span data-slot="thread-summary-panel-item-label">Changes</span></button>
        <button title="Switch branch" data-slot="thread-summary-panel-item-button"><span data-slot="thread-summary-panel-item-label">main</span></button>
        <button data-commit-or-push data-slot="thread-summary-panel-item-button"><span data-slot="thread-summary-panel-item-label">Commit or push</span></button>
        <span data-slot="thread-summary-panel-item-label">Local</span>
      </section>
    </main>
  </body></html>`, {
    url: "https://codex.local/tasks/current",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });

  let registration;
  dom.window.BetterCodex = { register(value) { registration = value; } };
  dom.window.eval(source);
  assert.equal(registration.id, "project-kanban");
  t.after(() => registration?.stop());
  dom.window.localStorage.setItem("bettercodex.project-kanban.v1", JSON.stringify({
    version: 3,
    cards: [
      { id: "plan-old", title: "Original plan title", project: "bettercodex", status: "in-progress", progress: "Running", href: "thread:local:old", native: true, updatedAt: 1 },
      { id: "chat:thread:missing", title: "No longer running", project: "bettercodex", status: "in-progress", progress: "Running", href: "thread:missing", native: true, projectLinked: true, updatedAt: 1 }
    ]
  }));

  registration.start();
  await delay(10);
  const newChat = [...dom.window.document.querySelectorAll("button")].find((button) => button.textContent.trim() === "New chat");
  const launcher = dom.window.document.querySelector("[data-bettercodex-project-kanban-launcher]");
  assert.ok(launcher);
  assert.match(launcher.textContent, /^Kanban$/);
  assert.notEqual(launcher.closest(".sidebar-item"), newChat.closest(".sidebar-item"));
  assert.equal(newChat.closest(".sidebar-item").nextElementSibling, launcher.closest(".sidebar-item"));
  assert.equal(launcher.closest(".sidebar-item").querySelectorAll("button").length, 1);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-kanban-launcher-row]").length, 1);

  launcher.click();
  const root = dom.window.document.querySelector("[data-bettercodex-project-kanban-root]");
  assert.equal(root.hidden, false);
  assert.equal(root.tagName, "MAIN");
  assert.equal(root.className, "native-main-surface");
  assert.equal(root.previousElementSibling, dom.window.document.querySelector("main:not([data-bettercodex-project-kanban-root])"));
  assert.equal(root.getAttribute("aria-label"), "Kanban");
  assert.equal(root.querySelector("form"), null);
  assert.equal(root.querySelector("button[aria-label*='Sync' i]"), null);
  assert.equal(dom.window.document.querySelector("main:not([data-bettercodex-project-kanban-root])").hidden, true);
  assert.equal(dom.window.document.querySelector("aside").getAttribute("aria-hidden"), null);
  const pullRequests = [...dom.window.document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Pull requests");
  assert.equal(pullRequests.getAttribute("aria-current"), "page");
  assert.equal(pullRequests.closest(".sidebar-item").hasAttribute("data-bettercodex-project-kanban-suppressed-nav"), true);

  assert.deepEqual(
    [...root.querySelectorAll(".bbpk-column-header > span:nth-child(2)")].map((node) => node.textContent),
    ["Old", "In Progress", "Waiting", "Done"]
  );
  const runningList = root.querySelector("[data-bbpk-list='in-progress']");
  const runningCard = runningList.querySelector("button[data-card-id='chat:thread:local:auth']");
  assert.ok(runningCard instanceof dom.window.HTMLButtonElement);
  assert.equal(runningCard.type, "button");
  assert.match(runningCard.textContent, /Build authentication/);
  assert.match(runningCard.textContent, /bettercodex/);
  assert.match(root.textContent, /ComfyUI/);
  assert.doesNotMatch(root.textContent, /Unlinked ChatGPT conversation/);
  assert.doesNotMatch(root.textContent, /Current project/);
  assert.match(runningCard.textContent, /2m/);
  assert.match(runningCard.textContent, /2 files/);
  assert.match(runningCard.textContent, /\+1,464/);
  assert.match(runningCard.textContent, /−916/);
  assert.equal(runningCard.querySelector("[role='status'][aria-label='Running']")?.className, "bbpk-spinner");
  const nativeMenuTrigger = dom.window.document.querySelector("[data-app-action-sidebar-thread-id='local:auth'] button[aria-label^='More options']");
  nativeMenuTrigger.addEventListener("click", () => {
    const menu = dom.window.document.createElement("div");
    menu.setAttribute("role", "menu");
    for (const label of ["Rename chat", "Archive chat", "Mark as unread", "Open in Explorer", "Copy working directory", "Copy session ID", "Copy deeplink", "Continue in new chat", "Continue in new worktree", "Open in new window"]) {
      const item = dom.window.document.createElement("button");
      item.setAttribute("role", "menuitem");
      item.textContent = label;
      menu.append(item);
    }
    dom.window.document.body.append(menu);
  }, { once: true });
  const cardMenuTrigger = runningList.querySelector("button[aria-label='More options for Build authentication']");
  assert.ok(cardMenuTrigger instanceof dom.window.HTMLButtonElement);
  assert.equal(cardMenuTrigger.getAttribute("aria-haspopup"), "menu");
  cardMenuTrigger.click();
  await delay(0);
  assert.equal(root.hidden, false);
  const nativeMenu = dom.window.document.querySelector("[role='menu']");
  for (const label of ["Rename chat", "Archive chat", "Mark as unread", "Open in Explorer", "Copy working directory", "Copy session ID", "Copy deeplink", "Continue in new chat", "Continue in new worktree", "Open in new window"]) {
    assert.match(nativeMenu.textContent, new RegExp(label));
  }
  assert.match(root.querySelector("[data-bbpk-list='waiting']").textContent, /Review access policy/);
  assert.doesNotMatch(root.querySelector("[data-bbpk-list='in-progress']").textContent, /No longer running/);
  assert.match(root.querySelector("[data-bbpk-list='done']").textContent, /Update README/);
  assert.match(root.querySelector("[data-bbpk-list='old']").textContent, /Explain gateway logic/);
  assert.doesNotMatch(root.querySelector("[data-bbpk-list='done']").textContent, /No longer running/);
  assert.equal(root.querySelectorAll("button[data-card-id='plan-old']").length, 0);
  const savedCards = JSON.parse(dom.window.localStorage.getItem("bettercodex.project-kanban.v1"));
  assert.equal(savedCards.version, 3);
  assert.equal(savedCards.cards.some((card) => /ghost|missing|plan-old/i.test(`${card.id} ${card.title}`)), false);

  const nativeChat = dom.window.document.querySelector("[data-app-action-sidebar-thread-id='local:auth']");
  nativeChat.querySelector("[role='status']").remove();
  await delay(10);
  assert.doesNotMatch(root.querySelector("[data-bbpk-list='in-progress']").textContent, /Build authentication/);
  const waitingToPush = root.querySelector("[data-bbpk-list='waiting'] button[data-card-id='chat:thread:local:auth']");
  assert.ok(waitingToPush);
  assert.match(waitingToPush.textContent, /Build authentication/);

  nativeChat.setAttribute("data-app-action-sidebar-thread-active", "false");
  const completedStatus = dom.window.document.createElement("span");
  completedStatus.setAttribute("role", "status");
  completedStatus.textContent = "Complete";
  nativeChat.append(completedStatus);
  await delay(10);
  assert.match(root.querySelector("[data-bbpk-list='waiting']").textContent, /Build authentication/);

  nativeChat.setAttribute("data-app-action-sidebar-thread-active", "true");
  dom.window.document.querySelector("[data-commit-or-push]").remove();
  await delay(10);
  const completedCard = root.querySelector("[data-bbpk-list='done'] button[data-card-id='chat:thread:local:auth']");
  assert.ok(completedCard);
  assert.equal(completedCard.querySelector(".bbpk-spinner"), null);
  nativeChat.setAttribute("data-app-action-sidebar-thread-active", "false");

  nativeChat.setAttribute("data-app-action-sidebar-thread-title", "Authentication shipped");
  await delay(10);
  assert.match(root.querySelector("[data-bbpk-list='done']").textContent, /Authentication shipped/);

  const projectRow = dom.window.document.querySelector("[data-app-action-sidebar-project-row]");
  projectRow.click();
  await delay(0);
  assert.equal(root.hidden, true);
  assert.equal(dom.window.document.querySelector("main:not([data-bettercodex-project-kanban-root])").hidden, false);
  assert.equal(pullRequests.closest(".sidebar-item").hasAttribute("data-bettercodex-project-kanban-suppressed-nav"), false);

  registration.start();
  await delay(10);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-kanban-launcher]").length, 1);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-kanban-root]").length, 1);
  assert.equal(dom.window.document.querySelectorAll("[data-bettercodex-project-kanban-style]").length, 1);

  registration.stop();
  registration.stop();
  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-kanban-launcher]"), null);
  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-kanban-launcher-row]"), null);
  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-kanban-root]"), null);
  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-kanban-style]"), null);
});

test("hides Kanban in ChatGPT mode and ignores chats without explicit project linkage", async (t) => {
  const source = await readFile(new URL("../addons/project-kanban/index.js", import.meta.url), "utf8");
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <aside><nav aria-label="Projects">
      <div class="sidebar-item"><button type="button"><span>New chat</span></button></div>
      <div class="sidebar-item" data-app-action-sidebar-project-row data-app-action-sidebar-project-id="project-1" data-app-action-sidebar-project-label="bettercodex">bettercodex</div>
      <div data-app-action-sidebar-project-list-id="project-1">
        <div class="sidebar-item" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:project" data-app-action-sidebar-thread-title="Project task"><span>Project task</span><button aria-label="More options for Project task"></button></div>
      </div>
    </nav></aside>
    <main class="native-main-surface">Codex</main>
  </body></html>`, {
    url: "https://codex.local/tasks/current",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });

  let registration;
  dom.window.BetterCodex = { register(value) { registration = value; } };
  dom.window.eval(source);
  t.after(() => registration?.stop());
  registration.start();
  await delay(10);

  const nav = dom.window.document.querySelector("nav");
  const codexNewChatRow = [...nav.querySelectorAll(".sidebar-item")].find((row) => /new chat/i.test(row.textContent));
  assert.equal(codexNewChatRow.nextElementSibling?.hasAttribute("data-bettercodex-project-kanban-launcher-row"), true);

  nav.innerHTML = `
    <div class="sidebar-item"><button type="button">Unlinked recent chat</button></div>
    <div class="sidebar-item" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:ghost" data-app-action-sidebar-thread-title="Unlinked recent chat"><span>Unlinked recent chat</span></div>
    <div class="sidebar-item"><button type="button">New chat</button></div>
    <div class="sidebar-item"><button type="button">Projects</button></div>
  `;
  await delay(10);

  assert.equal(dom.window.document.querySelector("[data-bettercodex-project-kanban-launcher]"), null);
  const stored = JSON.parse(dom.window.localStorage.getItem("bettercodex.project-kanban.v1") || "{}");
  assert.equal((stored.cards || []).some((card) => card.href === "thread:local:ghost"), false);
});
