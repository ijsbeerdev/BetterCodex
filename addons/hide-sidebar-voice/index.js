(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "hide-sidebar-voice",
    start() {
      cleanup();

      const HIDDEN_ATTRIBUTE = "data-bettercodex-hide-sidebar-voice";
      const STYLE_ATTRIBUTE = "data-bettercodex-hide-sidebar-voice-style";
      const CONTROL_SELECTOR = "button, a[href], [role='button']";
      const VOICE_PATTERN = /^(?:voice|(?:open|start|launch) (?:a )?voice(?: mode| chat| conversation)?|voice (?:mode| chat| conversation))$/i;
      const marked = new Set();
      let scheduled = false;
      let stopped = false;

      document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`).forEach((node) => node.remove());
      document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach((node) => node.removeAttribute(HIDDEN_ATTRIBUTE));

      const style = document.createElement("style");
      style.setAttribute(STYLE_ATTRIBUTE, "");
      style.textContent = `[${HIDDEN_ATTRIBUTE}] { display: none !important; }`;
      (document.head || document.documentElement).append(style);

      const labelsFor = (control) => [
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.textContent
      ].filter(Boolean).map((value) => value.replace(/\s+/g, " ").trim());

      const isHelpControl = (control) => /\bhelp\b/i.test([
        control.getAttribute("aria-label"),
        control.getAttribute("title")
      ].filter(Boolean).join(" "));

      const sync = () => {
        scheduled = false;
        if (stopped) return;

        const matches = new Set();
        const helpControls = [...document.querySelectorAll(CONTROL_SELECTOR)].filter(isHelpControl);
        for (const help of helpControls) {
          const toolbar = help.parentElement;
          if (!toolbar || toolbar.closest("#bettercodex-client-root, [data-composer-radius-variant], [data-codex-composer]")) continue;
          for (const control of toolbar.querySelectorAll(CONTROL_SELECTOR)) {
            if (control === help || control.id === "bettercodex-native-launcher") continue;
            if (labelsFor(control).some((label) => VOICE_PATTERN.test(label))) matches.add(control);
          }
        }

        for (const control of marked) {
          if (matches.has(control) && control.isConnected) continue;
          control.removeAttribute(HIDDEN_ATTRIBUTE);
          marked.delete(control);
        }
        for (const control of matches) {
          control.setAttribute(HIDDEN_ATTRIBUTE, "");
          marked.add(control);
        }
      };

      const scheduleSync = () => {
        if (scheduled || stopped) return;
        scheduled = true;
        queueMicrotask(sync);
      };

      const observer = new MutationObserver(scheduleSync);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["aria-label", "title"]
      });
      sync();
      globalThis.__BETTERCODEX_HIDE_SIDEBAR_VOICE_ACTIVE__ = true;

      cleanup = () => {
        if (stopped) return;
        stopped = true;
        observer.disconnect();
        for (const control of marked) control.removeAttribute(HIDDEN_ATTRIBUTE);
        marked.clear();
        style.remove();
        delete globalThis.__BETTERCODEX_HIDE_SIDEBAR_VOICE_ACTIVE__;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
