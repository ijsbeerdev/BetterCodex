Blackbox.register({
  id: "cozy-glow",
  start() {
    const host = document.getElementById("blackbox-client-root");
    if (!host || host.shadowRoot.getElementById("blackbox-addon-cozy-glow")) return;
    const style = document.createElement("style");
    style.id = "blackbox-addon-cozy-glow";
    style.textContent = ".launcher { box-shadow: 0 0 18px rgba(139, 92, 246, .2); }";
    host.shadowRoot.append(style);
  },
  stop() {
    document.getElementById("blackbox-client-root")?.shadowRoot
      ?.getElementById("blackbox-addon-cozy-glow")?.remove();
  }
});
