import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const clientSource = await readFile(new URL("../src/client.js", import.meta.url), "utf8");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function setup() {
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
  const payload = {
    version: "1.0.0",
    repository: "https://github.com/ijsbeerdev/blackbox",
    addonsPath: "C:\\Users\\test\\AppData\\Local\\Blackbox\\addons",
    addons: [{
      manifest: { id: "test-addon", name: "Test add-on", version: "1.0.0", description: "Tests toggles.", enabledByDefault: true },
      screenshot: "data:image/svg+xml;base64,PHN2Zy8+",
      source: `Blackbox.register({ id: "test-addon", start() { document.body.dataset.addon = "on"; }, stop() { delete document.body.dataset.addon; } });`
    }]
  };
  dom.window.__BLACKBOX_INJECT__(payload);
  return { dom, payload };
}

test("mounts a themed native button beside Help and opens a full-page view", () => {
  const { dom } = setup();
  const document = dom.window.document;
  const host = document.getElementById("blackbox-client-root");
  const shadow = host.shadowRoot;
  const launcher = document.getElementById("blackbox-native-launcher");
  const help = document.querySelector("[aria-label='Open help menu']");
  assert.equal(host.style.top, "36px");
  assert.equal(launcher.nextElementSibling, help);
  assert.equal(launcher.className, help.className);
  assert.equal(launcher.textContent.trim(), "");
  assert.equal(launcher.querySelector("[data-blackbox-box]").tagName, "svg");
  assert.equal(launcher.querySelectorAll("[data-blackbox-box] path").length, 3);
  assert.equal(launcher.querySelector("[data-blackbox-box]").style.color, "rgb(255, 255, 255)");
  assert.equal(host.style.display, "none");
  launcher.click();
  assert.equal(host.style.display, "block");
  assert.equal(shadow.querySelector(".nav-heading").textContent, "Blackbox settings");
  assert.deepEqual([...shadow.querySelectorAll(".nav-label")].map((item) => item.textContent), ["Blackbox", "Plugins", "Themes"]);
  assert.deepEqual([...shadow.querySelectorAll(".nav-icon svg")].map((icon) => icon.getAttribute("viewBox")), ["0 0 24 24", "0 0 24 24", "0 0 24 24"]);
  assert.match(shadow.querySelector(".version").textContent, /1\.0\.0/);
  assert.equal(shadow.querySelector(".repo").href, "https://github.com/ijsbeerdev/blackbox");
  shadow.querySelector(".nav[data-target='plugins']").click();
  assert.equal(shadow.getElementById("blackbox").hidden, true);
  assert.equal(shadow.getElementById("plugins").hidden, false);
  assert.equal(shadow.getElementById("blackbox-title").textContent, "Plugins");
  assert.equal(shadow.querySelector(".nav[data-target='plugins']").getAttribute("aria-current"), "page");
  assert.equal(shadow.querySelector(".generate-addon").textContent.replace(/\s+/g, " ").trim(), "+Generate addon");
  assert.equal(shadow.querySelector(".plugin-preview").getAttribute("src"), "data:image/svg+xml;base64,PHN2Zy8+");
  shadow.querySelector(".nav[data-target='themes']").click();
  assert.equal(shadow.getElementById("plugins").hidden, true);
  assert.equal(shadow.getElementById("themes").hidden, false);
  assert.equal(shadow.getElementById("blackbox-title").textContent, "Themes");
  shadow.querySelector(".nav[data-target='blackbox']").click();
  assert.equal(shadow.getElementById("blackbox").hidden, false);
  assert.equal(shadow.getElementById("themes").hidden, true);
  shadow.querySelector(".back").click();
  assert.equal(host.style.display, "none");
  dom.window.Blackbox.destroy();
});

test("enables, disables, persists, and cleans up add-ons", () => {
  const { dom } = setup();
  assert.equal(dom.window.document.body.dataset.addon, "on");
  const input = dom.window.document.getElementById("blackbox-client-root").shadowRoot.querySelector("input[data-addon='test-addon']");
  input.checked = false;
  input.dispatchEvent(new dom.window.Event("change"));
  assert.equal(dom.window.document.body.dataset.addon, undefined);
  assert.equal(JSON.parse(dom.window.localStorage.getItem("blackbox:addons:v1"))["test-addon"], false);
  dom.window.Blackbox.destroy();
});

test("Generate addon prepares an unsent projectless task with requirements attached", async () => {
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
      projectSelector.setAttribute("aria-label", "Change project: blackbox");
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

  const host = document.getElementById("blackbox-client-root");
  document.getElementById("blackbox-native-launcher").click();
  host.shadowRoot.querySelector(".generate-addon").click();
  await delay(350);

  assert.equal(host.style.display, "none");
  assert.equal(newChatClicks, 1);
  assert.equal(projectCleared, true);
  assert.equal(submitClicks, 0);
  assert.equal(document.querySelector("[data-codex-composer]").textContent, "Add an add-on that copies the latest assistant response.");
  assert.match(attachedRequirements, /^# Blackbox add-on requirements/);
  assert.match(attachedRequirements, /C:\\Users\\test\\AppData\\Local\\Blackbox\\addons/);
  assert.match(attachedRequirements, /Blackbox\.register/);
  assert.match(attachedRequirements, /classic browser JavaScript/i);
  assert.match(attachedRequirements, /screenshot\.svg/);
  assert.match(attachedRequirements, /do not commit, push, package, publish, or create a release/i);
  assert.ok(attachedRequirements.length > 5_000);
  dom.window.Blackbox.destroy();
});

test("reinjection is idempotent", () => {
  const { dom, payload } = setup();
  dom.window.__BLACKBOX_INJECT__(payload);
  assert.equal(dom.window.document.querySelectorAll("#blackbox-client-root").length, 1);
  assert.equal(dom.window.document.querySelectorAll("#blackbox-native-launcher").length, 1);
  dom.window.Blackbox.destroy();
});

test("waits for the native toolbar before showing its launcher", async () => {
  const dom = new JSDOM("<!doctype html><body></body>", {
    url: "https://codex.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.eval(clientSource);
  dom.window.__BLACKBOX_INJECT__({ version: "1.2.0", repository: "https://example.test", addons: [] });
  assert.equal(dom.window.document.getElementById("blackbox-native-launcher"), null);

  const help = dom.window.document.createElement("button");
  help.setAttribute("aria-label", "Open help menu");
  help.getBoundingClientRect = () => ({ left: 235, top: 735, right: 267, bottom: 767, width: 32, height: 32 });
  dom.window.document.body.append(help);
  await delay(15);
  assert.equal(dom.window.document.getElementById("blackbox-native-launcher")?.nextElementSibling, help);
  dom.window.Blackbox.destroy();
});
