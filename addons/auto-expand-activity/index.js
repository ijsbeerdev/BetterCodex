let autoExpandActivityCleanup = () => {};

Blackbox.register({
  id: "auto-expand-activity",
  start() {
    autoExpandActivityCleanup();

    const SELECTOR = 'button[aria-expanded="false"][class~="group/activity-header"]';
    let scheduled = false;
    let stopped = false;

    const expand = () => {
      scheduled = false;
      if (stopped) return;
      for (const button of document.querySelectorAll(SELECTOR)) button.click();
    };
    const scheduleExpand = () => {
      if (scheduled || stopped) return;
      scheduled = true;
      queueMicrotask(expand);
    };

    const observer = new MutationObserver(scheduleExpand);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded"]
    });
    expand();
    globalThis.__BLACKBOX_AUTO_EXPAND_ACTIVITY_ACTIVE__ = true;

    autoExpandActivityCleanup = () => {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
      delete globalThis.__BLACKBOX_AUTO_EXPAND_ACTIVITY_ACTIVE__;
    };
  },
  stop() {
    autoExpandActivityCleanup();
    autoExpandActivityCleanup = () => {};
  }
});
