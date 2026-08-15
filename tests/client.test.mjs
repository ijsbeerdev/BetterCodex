import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const clientSource = await readFile(new URL("../src/client.js", import.meta.url), "utf8");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function setup(options = {}) {
  const dom = new JSDOM("<!doctype html><html class='electron-dark'><body><div id='app-titlebar'><div aria-label='Application menu'></div></div><div id='toolbar'><button class='native-help size-8' aria-label='Open help menu'></button></div></body></html>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  const help = dom.window.document.querySelector("[aria-label='Open help menu']");
  dom.window.document.getElementById("app-titlebar").getBoundingClientRect = () => ({ left: 0, top: 0, right: 1200, bottom: 36, width: 1200, height: 36 });
  help.getBoundingClientRect = () => ({ left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32 });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.requestAnimationFrame = (callback) => { callback(); return 1; };
  dom.window.eval(clientSource);
  options.prepare?.(dom);
  const payload = {
    version: "1.0.0",
    repository: "https://github.com/ijsbeerdev/bettercodex",
    addonsPath: "C:\\Users\\test\\AppData\\Local\\BetterCodex\\addons",
    preferences: options.preferences,
    addons: [{
      manifest: { id: "test-addon", name: "Test add-on", version: "1.0.0", description: "Tests toggles.", creator: "Test Creator", shareUrl: "https://github.com/ijsbeerdev/bettercodex/tree/main/addons/test-addon", category: "addon", tags: ["Productivity", "Projects"], enabledByDefault: true },
      screenshot: "data:image/svg+xml;base64,PHN2Zy8+",
      source: `BetterCodex.register({ id: "test-addon", start() { document.body.dataset.addon = "on"; }, stop() { delete document.body.dataset.addon; } });`
    }, {
      manifest: { id: "test-tweak", name: "Test tweak", version: "1.0.0", description: "Tests tweak grouping.", creator: "Tweak Maker", shareUrl: "https://github.com/ijsbeerdev/bettercodex/tree/main/addons/test-tweak", category: "tweak", tags: ["Workflow"], enabledByDefault: true },
      screenshot: null,
      source: `BetterCodex.register({ id: "test-tweak", start() { document.body.dataset.tweak = "on"; }, stop() { delete document.body.dataset.tweak; } });`
    }, {
      manifest: { id: "test-theme", name: "Test theme", version: "1.0.0", description: "Tests theme grouping.", category: "theme", tags: ["Dark"], enabledByDefault: false },
      screenshot: null,
      source: `BetterCodex.register({ id: "test-theme", start() { document.body.dataset.theme = "on"; }, stop() { delete document.body.dataset.theme; } });`
    }]
  };
  dom.window.__BETTERCODEX_INJECT__(payload);
  return { dom, payload };
}

test("mounts a themed native button after Help and opens a full-page view", () => {
  const { dom } = setup();
  const document = dom.window.document;
  const host = document.getElementById("bettercodex-client-root");
  const shadow = host.shadowRoot;
  const launcher = document.getElementById("bettercodex-native-launcher");
  const launcherStyle = document.getElementById("bettercodex-native-launcher-style");
  const help = document.querySelector("[aria-label='Open help menu']");
  assert.equal(host.style.top, "36px");
  assert.equal(launcher.previousElementSibling, help);
  assert.equal(launcher.className, help.className);
  assert.equal(launcher.textContent.trim(), "");
  assert.equal(launcher.querySelector("[data-bettercodex-icon]").tagName, "svg");
  assert.equal(launcher.querySelector("[data-bettercodex-icon]").getAttribute("viewBox"), "0 0 16 16");
  assert.equal(launcher.querySelectorAll("[data-bettercodex-icon] path").length, 1);
  assert.equal(launcher.querySelector("[data-bettercodex-icon]").style.color, "rgb(255, 255, 255)");
  assert.match(launcherStyle.textContent, /rgba\(59,130,246,\.45\)/);
  assert.match(launcherStyle.textContent, /prefers-reduced-motion:reduce/);
  assert.match(launcherStyle.textContent, /:focus-visible/);
  assert.match(launcherStyle.textContent, /@keyframes bettercodex-launcher-intro-shell/);
  assert.match(launcherStyle.textContent, /@keyframes bettercodex-launcher-intro-sweep/);
  assert.match(launcherStyle.textContent, /animation:none; transition:none/);
  assert.equal(host.style.display, "none");
  launcher.click();
  assert.equal(host.style.display, "block");
  assert.equal(shadow.querySelector(".nav-heading").textContent, "BetterCodex settings");
  assert.equal(shadow.querySelector("#bettercodex-title [data-bettercodex-icon]").getAttribute("viewBox"), "0 0 16 16");
  assert.deepEqual([...shadow.querySelectorAll(".nav-label")].map((item) => item.textContent), ["BetterCodex", "Add-ons", "Tweaks", "Themes"]);
  assert.deepEqual([...shadow.querySelectorAll(".nav-icon svg")].map((icon) => icon.getAttribute("viewBox")), ["0 0 24 24", "0 0 24 24", "0 0 24 24", "0 0 24 24"]);
  assert.match(shadow.querySelector(".version").textContent, /1\.0\.0/);
  assert.equal(shadow.querySelector(".update-check").textContent.trim(), "Check for updates");
  assert.equal(shadow.querySelector(".update-check").previousElementSibling?.className, "version");
  assert.equal(shadow.querySelector(".update-check").closest(".row").querySelector(".name")?.textContent, "Version");
  assert.equal(shadow.querySelector(".update-check svg").getAttribute("viewBox"), "0 0 16 16");
  assert.equal(shadow.querySelector(".source-link").href, "https://github.com/ijsbeerdev/bettercodex");
  assert.equal(shadow.querySelectorAll(".section h2").length, 0);
  assert.deepEqual([...shadow.querySelectorAll(".catalog-search")].map((input) => input.placeholder), ["Search add-ons", "Search tweaks", "Search themes"]);
  assert.deepEqual([...shadow.querySelectorAll(".generate-action")].map((button) => button.textContent.replace(/\s+/g, " ").trim()), ["+Generate add-on", "+Generate tweak", "+Generate theme"]);
  assert.deepEqual([...shadow.querySelectorAll(".generate-action")].map((button) => button.dataset.category), ["addon", "tweak", "theme"]);
  shadow.querySelector(".nav[data-target='addons']").click();
  assert.equal(shadow.getElementById("bettercodex").hidden, true);
  assert.equal(shadow.getElementById("addons").hidden, false);
  assert.equal(shadow.getElementById("bettercodex-title").textContent, "Add-ons");
  assert.equal(shadow.querySelector(".nav[data-target='addons']").getAttribute("aria-current"), "page");
  assert.equal(shadow.querySelector("#addons .catalog-search").closest(".catalog-search-row").querySelector(".generate-action")?.dataset.category, "addon");
  assert.equal(shadow.querySelector(".addons-list .plugin-preview").getAttribute("src"), "data:image/svg+xml;base64,PHN2Zy8+");
  assert.equal(shadow.querySelector("#addons .catalog-search").placeholder, "Search add-ons");
  assert.deepEqual([...shadow.querySelectorAll("#addons .plugin-tag")].map((tag) => tag.textContent), ["Productivity", "Projects"]);
  assert.equal(shadow.querySelector("#addons .plugin-creator").textContent, "By Test Creator");
  assert.equal(shadow.querySelector("#addons .plugin-share"), null);
  assert.equal(shadow.querySelector("#addons .result-count").textContent, "1 add-on");
  assert.equal(shadow.querySelector(".addons-list input[data-addon='test-tweak']"), null);
  shadow.querySelector(".nav[data-target='tweaks']").click();
  assert.equal(shadow.getElementById("addons").hidden, true);
  assert.equal(shadow.getElementById("tweaks").hidden, false);
  assert.equal(shadow.querySelector(".tweaks-list input[data-addon='test-tweak']")?.dataset.addon, "test-tweak");
  assert.equal(shadow.querySelector("#tweaks .plugin-creator").textContent, "By Tweak Maker");
  assert.equal(shadow.querySelector("#tweaks .plugin-share"), null);
  shadow.querySelector(".nav[data-target='themes']").click();
  assert.equal(shadow.getElementById("tweaks").hidden, true);
  assert.equal(shadow.getElementById("themes").hidden, false);
  assert.equal(shadow.getElementById("bettercodex-title").textContent, "Themes");
  assert.equal(shadow.querySelector(".themes-list input[data-addon='test-theme']")?.checked, false);
  assert.equal(shadow.querySelector("#themes .plugin-creator").textContent, "By Unknown creator");
  assert.equal(shadow.querySelector("#themes .plugin-share"), null);
  assert.equal(shadow.querySelector(".themes-list input[data-addon='test-addon']"), null);
  shadow.querySelector(".nav[data-target='bettercodex']").click();
  assert.equal(shadow.getElementById("bettercodex").hidden, false);
  assert.equal(shadow.getElementById("themes").hidden, true);
  assert.equal(shadow.querySelector("#bettercodex-title [data-bettercodex-icon]").getAttribute("viewBox"), "0 0 16 16");
  shadow.querySelector(".back").click();
  assert.equal(host.style.display, "none");
  dom.window.BetterCodex.destroy();
  assert.equal(document.getElementById("bettercodex-native-launcher-style"), null);
});

test("uses dark Codex surface tokens for the BetterCodex shadow UI", async () => {
  const { dom } = setup({
    prepare({ window }) {
      window.document.documentElement.className = "dark";
    }
  });
  const document = dom.window.document;
  const host = document.getElementById("bettercodex-client-root");
  const stylesheet = host.shadowRoot.querySelector("style").textContent;

  assert.equal(host.dataset.theme, "dark");
  assert.match(stylesheet, /--bb-surface:var\(--color-token-main-surface-secondary/);
  assert.match(stylesheet, /:host\(\[data-theme="dark"\]\) \{ color-scheme:dark; \}/);
  assert.doesNotMatch(stylesheet, /--bb-surface:var\(--color-token-input-background/);

  document.documentElement.className = "electron-light";
  await delay(5);
  assert.equal(host.dataset.theme, "light");

  document.documentElement.className = "";
  document.documentElement.dataset.theme = "dark";
  await delay(5);
  assert.equal(host.dataset.theme, "dark");
  dom.window.BetterCodex.destroy();
});

test("searches and filters catalog cards by state and tags", () => {
  const { dom } = setup();
  const shadow = dom.window.document.getElementById("bettercodex-client-root").shadowRoot;
  const addonCard = shadow.querySelector(".addons-list [data-catalog-item='test-addon']");
  const generateAddon = shadow.querySelector("#addons .generate-action");
  const search = shadow.querySelector("#addons .catalog-search");

  search.value = "projects";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.equal(addonCard.hidden, false);
  assert.equal(generateAddon.hidden, false);
  assert.equal(shadow.querySelector("#addons .result-count").textContent, "1 add-on");

  search.value = "missing";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.equal(addonCard.hidden, true);
  assert.equal(shadow.querySelector("#addons .empty-results").hidden, false);

  search.value = "";
  search.dispatchEvent(new dom.window.Event("input"));
  shadow.querySelector("#addons [data-status='disabled']").click();
  assert.equal(addonCard.hidden, true);
  assert.equal(shadow.querySelector("#addons .empty-results").hidden, false);

  const toggle = addonCard.querySelector("input");
  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event("change"));
  assert.equal(addonCard.hidden, false);

  shadow.querySelector("#addons [data-status='all']").click();
  shadow.querySelector("#addons [data-tag='projects']").click();
  assert.equal(addonCard.hidden, false);
  assert.equal(shadow.querySelector("#addons [data-tag='projects']").getAttribute("aria-pressed"), "true");
  dom.window.BetterCodex.destroy();
});

test("checks GitHub for a newer release and offers its release page", async () => {
  const { dom } = setup();
  const shadow = dom.window.document.getElementById("bettercodex-client-root").shadowRoot;
  let requested = false;
  dom.window.__BETTERCODEX_CHECK_FOR_UPDATES__ = (requestId) => {
    requested = true;
    queueMicrotask(() => dom.window.dispatchEvent(new dom.window.CustomEvent("bettercodex:update-result", {
      detail: {
        requestId,
        release: {
        tag_name: "v1.1.0",
        html_url: "https://github.com/ijsbeerdev/BetterCodex/releases/tag/v1.1.0"
        }
      }
    })));
  };

  shadow.querySelector(".update-check").click();
  await delay(0);

  assert.equal(requested, true);
  assert.equal(shadow.querySelector(".update-status").textContent, "BetterCodex v1.1.0 is available");
  assert.equal(shadow.querySelector(".update-check").hidden, true);
  assert.equal(shadow.querySelector(".update-check").textContent.trim(), "Check for updates");
  assert.equal(shadow.querySelector(".update-download").hidden, false);
  assert.equal(shadow.querySelector(".update-download").href, "https://github.com/ijsbeerdev/BetterCodex/releases/tag/v1.1.0");
  dom.window.BetterCodex.destroy();
});

test("enables, disables, persists, and cleans up add-ons", () => {
  const { dom } = setup();
  assert.equal(dom.window.document.body.dataset.addon, "on");
  const input = dom.window.document.getElementById("bettercodex-client-root").shadowRoot.querySelector("input[data-addon='test-addon']");
  input.checked = false;
  input.dispatchEvent(new dom.window.Event("change"));
  assert.equal(dom.window.document.body.dataset.addon, undefined);
  assert.equal(JSON.parse(dom.window.localStorage.getItem("bettercodex:addons:v1"))["test-addon"], false);
  dom.window.BetterCodex.destroy();
});

test("restores durable preferences and backs up every BetterCodex storage key", () => {
  const saved = [];
  const addonStorage = JSON.stringify({ "test-addon": false, "test-tweak": true, "test-theme": true });
  const kanbanStorage = JSON.stringify({ version: 2, cards: [] });
  const { dom } = setup({
    preferences: {
      persisted: true,
      storage: {
        "bettercodex:addons:v1": addonStorage,
        "bettercodex.project-kanban.v1": kanbanStorage
      }
    },
    prepare(windowDom) {
      windowDom.window.localStorage.setItem("bettercodex:addons:v1", JSON.stringify({ "test-addon": true }));
      windowDom.window.__BETTERCODEX_SAVE_PREFERENCES__ = (payload) => saved.push(JSON.parse(payload));
    }
  });
  assert.equal(dom.window.document.body.dataset.addon, undefined);
  assert.equal(dom.window.document.body.dataset.theme, "on");
  assert.equal(dom.window.localStorage.getItem("bettercodex.project-kanban.v1"), kanbanStorage);

  const toggle = dom.window.document.getElementById("bettercodex-client-root").shadowRoot.querySelector("input[data-addon='test-addon']");
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event("change"));
  assert.equal(JSON.parse(saved.at(-1).storage["bettercodex:addons:v1"])["test-addon"], true);
  assert.equal(saved.at(-1).storage["bettercodex.project-kanban.v1"], kanbanStorage);
  dom.window.BetterCodex.destroy();
});

test("Generate theme prepares an unsent projectless task with category-specific requirements", async () => {
  const { dom } = setup();
  const document = dom.window.document;
  let newChatClicks = 0;
  let submitClicks = 0;
  let projectCleared = false;
  let attachedRequirements = null;
  const newChat = document.createElement("button");
  newChat.textContent = "New chat";
  const oldSurface = document.createElement("div");
  oldSurface.setAttribute("data-composer-radius-variant", "default");
  const oldEditor = document.createElement("div");
  oldEditor.setAttribute("data-codex-composer", "true");
  oldSurface.append(oldEditor);
  newChat.addEventListener("click", () => {
    newChatClicks += 1;
    setTimeout(() => {
      oldSurface.remove();
      const newSurface = document.createElement("div");
      newSurface.setAttribute("data-composer-radius-variant", "default");
      const newEditor = document.createElement("div");
      newEditor.contentEditable = "true";
      newEditor.setAttribute("data-codex-composer", "true");
      const projectSelector = document.createElement("button");
      projectSelector.setAttribute("aria-label", "Change project: bettercodex");
      projectSelector.addEventListener("click", () => {
        const option = document.createElement("button");
        option.setAttribute("role", "option");
        option.innerHTML = "<strong>None</strong><span>Don't work in a project</span>";
        option.addEventListener("click", () => {
          projectCleared = true;
          projectSelector.setAttribute("aria-label", "Choose project");
          option.remove();
        });
        document.body.append(option);
      });
      const submit = document.createElement("button");
      submit.setAttribute("aria-label", "Queue");
      submit.addEventListener("click", () => { submitClicks += 1; });
      newEditor.addEventListener("paste", (event) => {
        event.preventDefault();
        attachedRequirements = event.clipboardData.getData("text/plain");
      });
      newSurface.append(newEditor, submit);
      document.body.append(projectSelector, newSurface);
    }, 0);
  });

  document.body.append(newChat, oldSurface);
  document.execCommand = (command, _showUi, value) => {
    if (command !== "insertText") return false;
    document.querySelector("[data-codex-composer]").textContent = value;
    return true;
  };

  const host = document.getElementById("bettercodex-client-root");
  document.getElementById("bettercodex-native-launcher").click();
  host.shadowRoot.querySelector(".generate-action[data-category='theme']").click();
  await delay(350);

  assert.equal(host.style.display, "none");
  assert.equal(newChatClicks, 1);
  assert.equal(projectCleared, true);
  assert.equal(submitClicks, 0);
  assert.equal(document.querySelector("[data-codex-composer]").textContent, "Add a warm, low-contrast theme for Codex.");
  assert.match(attachedRequirements, /^# BetterCodex theme requirements/);
  assert.match(attachedRequirements, /manifest category to "theme" exactly/i);
  assert.match(attachedRequirements, /description, creator, category/);
  assert.match(attachedRequirements, /include it as shareUrl/);
  assert.match(attachedRequirements, /Codex's existing UI as the component library/i);
  assert.match(attachedRequirements, /style native Codex and BetterCodex components in place/i);
  assert.match(attachedRequirements, /C:\\Users\\test\\AppData\\Local\\BetterCodex\\addons/);
  assert.match(attachedRequirements, /BetterCodex\.register/);
  assert.match(attachedRequirements, /classic browser JavaScript/i);
  assert.match(attachedRequirements, /screenshot\.svg/);
  assert.match(attachedRequirements, /do not commit, push, package, publish, or create a release/i);
  assert.ok(attachedRequirements.length > 5_000);
  dom.window.BetterCodex.destroy();
});

test("reinjection is idempotent", () => {
  const { dom, payload } = setup();
  dom.window.__BETTERCODEX_INJECT__(payload);
  assert.equal(dom.window.document.querySelectorAll("#bettercodex-client-root").length, 1);
  assert.equal(dom.window.document.querySelectorAll("#bettercodex-native-launcher").length, 1);
  assert.equal(dom.window.document.querySelectorAll("#bettercodex-native-launcher-style").length, 1);
  dom.window.BetterCodex.destroy();
});

test("waits for the native toolbar before showing its launcher", async () => {
  const dom = new JSDOM("<!doctype html><body></body>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.eval(clientSource);
  dom.window.__BETTERCODEX_INJECT__({ version: "1.2.0", repository: "https://example.test", addons: [] });
  assert.equal(dom.window.document.getElementById("bettercodex-native-launcher"), null);

  const help = dom.window.document.createElement("button");
  help.setAttribute("aria-label", "Open help menu");
  help.getBoundingClientRect = () => ({ left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32 });
  dom.window.document.body.append(help);
  await delay(15);
  assert.equal(dom.window.document.getElementById("bettercodex-native-launcher")?.previousElementSibling, help);
  dom.window.BetterCodex.destroy();
});
