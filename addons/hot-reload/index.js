Blackbox.register({
  id: "hot-reload",
  start() {
    globalThis.__BLACKBOX_HOT_RELOAD_ACTIVE__ = true;
    const host = document.getElementById("blackbox-client-root");
    const shadow = host?.shadowRoot;
    const launcher = shadow?.querySelector(".launcher");
    if (!shadow || !launcher) return;

    const style = document.createElement("style");
    style.id = "blackbox-addon-hot-reload-layout";
    style.textContent = `
      .launcher {
        width: 32px !important;
        height: 32px !important;
        padding: 0 !important;
        justify-content: center !important;
        border-radius: 8px !important;
      }
      .launcher > span:not(.mark) { display: none !important; }
      .launcher .mark { width: 22px; height: 22px; }
    `;
    shadow.append(style);

    let scheduled = false;
    const positionNextToHelp = () => {
      scheduled = false;
      const help = [...document.querySelectorAll("button,[role='button']")].find((element) => {
        const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`;
        const rect = element.getBoundingClientRect();
        return /help/i.test(label) && rect.left < 350 && rect.bottom > innerHeight - 100;
      });
      if (!help) {
        launcher.style.left = "197px";
        launcher.style.top = "auto";
        launcher.style.bottom = "7px";
        return;
      }
      const rect = help.getBoundingClientRect();
      launcher.style.left = `${Math.round(rect.left - 38)}px`;
      launcher.style.top = `${Math.round(rect.top)}px`;
      launcher.style.bottom = "auto";
    };
    const schedulePosition = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(positionNextToHelp);
    };

    const observer = new MutationObserver(schedulePosition);
    observer.observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", schedulePosition);
    schedulePosition();
    globalThis.__BLACKBOX_HOT_RELOAD_LAYOUT__ = { observer, schedulePosition, launcher, style };
  },
  stop() {
    delete globalThis.__BLACKBOX_HOT_RELOAD_ACTIVE__;
    const layout = globalThis.__BLACKBOX_HOT_RELOAD_LAYOUT__;
    if (layout) {
      layout.observer.disconnect();
      removeEventListener("resize", layout.schedulePosition);
      layout.style.remove();
      layout.launcher.style.removeProperty("left");
      layout.launcher.style.removeProperty("top");
      layout.launcher.style.removeProperty("bottom");
    }
    delete globalThis.__BLACKBOX_HOT_RELOAD_LAYOUT__;
  }
});
