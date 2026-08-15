(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "hide-sidebar-help",
    start() {
      cleanup();

      const HIDDEN_ATTRIBUTE = "data-bettercodex-hide-sidebar-help";
      const STYLE_ATTRIBUTE = "data-bettercodex-hide-sidebar-help-style";
      const CONTROL_SELECTOR = "button, a[href], [role='button']";
      const HELP_PATTERN = /^(?:open )?help(?: menu| center)?$/i;
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

      const isSidebarHelp = (control) => {
        if (control.id === "bettercodex-native-launcher") return false;
        if (control.closest("#bettercodex-client-root, [data-composer-radius-variant], [data-codex-composer]")) return false;
        if (!labelsFor(control).some((label) => HELP_PATTERN.test(label))) return false;
        if (control.closest("aside, nav, [role='navigation']")) return true;
        const rect = control.getBoundingClientRect();
        return rect.bottom > innerHeight - 120;
      };

      const sync = () => {
        scheduled = false;
        if (stopped) return;

        const matches = new Set([...document.querySelectorAll(CONTROL_SELECTOR)].filter(isSidebarHelp));
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
      globalThis.__BETTERCODEX_HIDE_SIDEBAR_HELP_ACTIVE__ = true;

      cleanup = () => {
        if (stopped) return;
        stopped = true;
        observer.disconnect();
        for (const control of marked) control.removeAttribute(HIDDEN_ATTRIBUTE);
        marked.clear();
        style.remove();
        delete globalThis.__BETTERCODEX_HIDE_SIDEBAR_HELP_ACTIVE__;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
