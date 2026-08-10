BetterCodex.register({
  id: "hot-reload",
  start() {
    globalThis.__BETTERCODEX_HOT_RELOAD_ACTIVE__ = true;
  },
  stop() {
    delete globalThis.__BETTERCODEX_HOT_RELOAD_ACTIVE__;
  }
});
