Blackbox.register({
  id: "hot-reload",
  start() {
    globalThis.__BLACKBOX_HOT_RELOAD_ACTIVE__ = true;
  },
  stop() {
    delete globalThis.__BLACKBOX_HOT_RELOAD_ACTIVE__;
  }
});
