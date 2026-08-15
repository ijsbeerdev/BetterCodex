(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "thinking-mode-colors",
    start() {
      cleanup();

      const ATTRIBUTE = "data-bettercodex-thinking-mode";
      const STYLE_ATTRIBUTE = "data-bettercodex-thinking-mode-colors-style";
      const COMPOSER_SELECTOR = "[data-composer-radius-variant][data-composer-surface-variant]";
      const PICKER_SELECTOR = [
        '[role="menu"]',
        '[role="listbox"]',
        '[role="dialog"]',
        "[data-radix-menu-content]",
        "[data-radix-select-content]",
        "[data-radix-popper-content-wrapper]"
      ].join(", ");
      const MODE_BY_LABEL = new Map([
        ["none", "none"],
        ["minimal", "minimal"],
        ["low", "low"],
        ["medium", "medium"],
        ["high", "high"],
        ["xhigh", "xhigh"],
        ["x-high", "xhigh"],
        ["x high", "xhigh"],
        ["extra high", "xhigh"],
        ["max", "max"],
        ["ultra", "ultra"]
      ]);
      const touched = new Map();
      let stopped = false;
      let scheduled = false;

      document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`).forEach((node) => node.remove());
      const style = document.createElement("style");
      style.setAttribute(STYLE_ATTRIBUTE, "");
      style.textContent = `
        [${ATTRIBUTE}] {
          color: var(--bettercodex-thinking-mode-color) !important;
          transition: color 140ms ease;
        }

        [${ATTRIBUTE}="none"],
        [${ATTRIBUTE}="minimal"] { --bettercodex-thinking-mode-color: light-dark(#64748b, #a8b1c0); }
        [${ATTRIBUTE}="low"] { --bettercodex-thinking-mode-color: light-dark(#0284c7, #56c7ff); }
        [${ATTRIBUTE}="medium"] { --bettercodex-thinking-mode-color: light-dark(#059669, #4adea4); }
        [${ATTRIBUTE}="high"] { --bettercodex-thinking-mode-color: light-dark(#ca8a04, #facc4b); }
        [${ATTRIBUTE}="xhigh"] { --bettercodex-thinking-mode-color: light-dark(#ea580c, #fb923c); }
        [${ATTRIBUTE}="max"] { --bettercodex-thinking-mode-color: light-dark(#db2777, #f472b6); }
        [${ATTRIBUTE}="ultra"] { --bettercodex-thinking-mode-color: light-dark(#7c3aed, #b58cff); }
      `;
      (document.head || document.documentElement).append(style);

      const modeFor = (element) => {
        const label = element.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
        return MODE_BY_LABEL.get(label) ?? null;
      };

      const modeLabelsWithin = (root) => {
        const labels = [];
        for (const element of [root, ...root.querySelectorAll("*")]) {
          if (element.closest("#bettercodex-client-root")) continue;
          if (element.closest('[data-codex-composer], textarea, input, [contenteditable="true"]')) continue;
          const mode = modeFor(element);
          if (!mode) continue;
          const hasMoreSpecificLabel = [...element.children].some((child) => modeFor(child));
          if (!hasMoreSpecificLabel) labels.push([element, mode]);
        }
        return labels;
      };

      const rememberAndMark = (element, mode) => {
        if (!touched.has(element)) {
          touched.set(element, {
            hadAttribute: element.hasAttribute(ATTRIBUTE),
            value: element.getAttribute(ATTRIBUTE)
          });
        }
        if (element.getAttribute(ATTRIBUTE) !== mode) element.setAttribute(ATTRIBUTE, mode);
      };

      const restore = (element) => {
        const previous = touched.get(element);
        if (!previous) return;
        if (previous.hadAttribute) element.setAttribute(ATTRIBUTE, previous.value ?? "");
        else element.removeAttribute(ATTRIBUTE);
        touched.delete(element);
      };

      const sync = () => {
        scheduled = false;
        if (stopped) return;

        const matched = new Map();
        document.querySelectorAll(COMPOSER_SELECTOR).forEach((composer) => {
          modeLabelsWithin(composer).forEach(([element, mode]) => matched.set(element, mode));
        });
        document.querySelectorAll(PICKER_SELECTOR).forEach((picker) => {
          const labels = modeLabelsWithin(picker);
          if (new Set(labels.map(([, mode]) => mode)).size < 2) return;
          labels.forEach(([element, mode]) => matched.set(element, mode));
        });

        for (const element of touched.keys()) {
          if (!matched.has(element)) restore(element);
        }
        matched.forEach((mode, element) => rememberAndMark(element, mode));
      };

      const scheduleSync = () => {
        if (scheduled || stopped) return;
        scheduled = true;
        queueMicrotask(sync);
      };

      const observer = new MutationObserver(scheduleSync);
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      sync();
      globalThis.__BETTERCODEX_THINKING_MODE_COLORS_ACTIVE__ = true;

      cleanup = () => {
        if (stopped) return;
        stopped = true;
        observer.disconnect();
        style.remove();
        for (const element of [...touched.keys()]) restore(element);
        delete globalThis.__BETTERCODEX_THINKING_MODE_COLORS_ACTIVE__;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
