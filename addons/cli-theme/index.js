(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "cli-theme",
    start() {
      cleanup();

      const ROOT_ATTRIBUTE = "data-bettercodex-cli-theme";
      const HOST_ATTRIBUTE = "data-bettercodex-cli-theme-host";
      const STYLE_ATTRIBUTE = "data-bettercodex-cli-theme-style";
      const MANAGER_STYLE_ATTRIBUTE = "data-bettercodex-cli-theme-manager-style";
      const root = document.documentElement;
      const previousRootMarker = root.getAttribute(ROOT_ATTRIBUTE);
      const rootHadMarker = root.hasAttribute(ROOT_ATTRIBUTE);
      let managerHost = null;
      let managerStyle = null;
      let managerHostHadMarker = false;
      let previousManagerHostMarker = null;
      let stopped = false;

      document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`).forEach((node) => node.remove());
      root.setAttribute(ROOT_ATTRIBUTE, "");

      const style = document.createElement("style");
      style.setAttribute(STYLE_ATTRIBUTE, "");
      style.textContent = `
        html[${ROOT_ATTRIBUTE}] {
          color-scheme: dark;
          --bc-cli-bg: #050806;
          --bc-cli-panel: #09100b;
          --bc-cli-raised: #0d1710;
          --bc-cli-hover: #122219;
          --bc-cli-border: #24452e;
          --bc-cli-border-hot: #56d977;
          --bc-cli-green: #79f69d;
          --bc-cli-green-bright: #c2ffd1;
          --bc-cli-dim: #7d9f86;
          --bc-cli-cyan: #63dcff;
          --bc-cli-amber: #ffc766;
          --bc-cli-red: #ff6f7d;
          --bc-cli-font: "Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          --font-sans: var(--bc-cli-font);
          --font-mono: var(--bc-cli-font);
          --color-token-main-surface-primary: var(--bc-cli-bg);
          --color-token-main-surface-secondary: var(--bc-cli-panel);
          --color-token-input-background: var(--bc-cli-raised);
          --color-token-foreground: var(--bc-cli-green-bright);
          --color-token-description-foreground: var(--bc-cli-dim);
          --color-token-icon-foreground: var(--bc-cli-green);
          --color-token-border-default: var(--bc-cli-border);
          --color-token-list-hover-background: var(--bc-cli-hover);
          --vscode-foreground: var(--bc-cli-green-bright);
          --vscode-editor-background: var(--bc-cli-bg);
          --vscode-sideBar-background: var(--bc-cli-panel);
          --vscode-sideBar-foreground: var(--bc-cli-green-bright);
          --vscode-input-background: var(--bc-cli-raised);
          --vscode-input-foreground: var(--bc-cli-green-bright);
          --vscode-input-border: var(--bc-cli-border);
          --vscode-focusBorder: var(--bc-cli-green);
          --vscode-list-hoverBackground: var(--bc-cli-hover);
          --vscode-list-activeSelectionBackground: #173321;
          --vscode-list-activeSelectionForeground: var(--bc-cli-green-bright);
          background: var(--bc-cli-bg) !important;
        }

        html[${ROOT_ATTRIBUTE}],
        html[${ROOT_ATTRIBUTE}] body,
        html[${ROOT_ATTRIBUTE}] #root {
          background: var(--bc-cli-bg) !important;
          color: var(--bc-cli-green-bright) !important;
        }

        html[${ROOT_ATTRIBUTE}] body,
        html[${ROOT_ATTRIBUTE}] button,
        html[${ROOT_ATTRIBUTE}] input,
        html[${ROOT_ATTRIBUTE}] textarea,
        html[${ROOT_ATTRIBUTE}] select,
        html[${ROOT_ATTRIBUTE}] [contenteditable="true"] {
          font-family: var(--bc-cli-font) !important;
          font-feature-settings: "liga" 1, "calt" 1, "zero" 1;
          letter-spacing: .005em;
        }

        html[${ROOT_ATTRIBUTE}] body::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          pointer-events: none;
          background: repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(121, 246, 157, .035) 4px);
          box-shadow: inset 0 0 110px rgba(0, 0, 0, .72), inset 0 1px 0 rgba(121, 246, 157, .22);
        }

        html[${ROOT_ATTRIBUTE}] ::selection {
          color: var(--bc-cli-bg);
          background: var(--bc-cli-green);
        }

        html[${ROOT_ATTRIBUTE}] * {
          scrollbar-color: var(--bc-cli-border-hot) var(--bc-cli-bg);
        }

        html[${ROOT_ATTRIBUTE}] *::-webkit-scrollbar { width: 10px; height: 10px; }
        html[${ROOT_ATTRIBUTE}] *::-webkit-scrollbar-track { background: var(--bc-cli-bg); }
        html[${ROOT_ATTRIBUTE}] *::-webkit-scrollbar-thumb {
          border: 2px solid var(--bc-cli-bg);
          border-radius: 0;
          background: var(--bc-cli-border-hot);
        }

        html[${ROOT_ATTRIBUTE}] :where(main, [role="main"]) {
          background:
            linear-gradient(rgba(121, 246, 157, .018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(121, 246, 157, .018) 1px, transparent 1px),
            var(--bc-cli-bg) !important;
          background-size: 24px 24px !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(aside, [role="navigation"]) {
          border-color: var(--bc-cli-border) !important;
          background-color: var(--bc-cli-panel) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(#app-titlebar, #toolbar, header) {
          border-color: var(--bc-cli-border) !important;
          background-color: var(--bc-cli-bg) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(h1, h2, h3, h4) {
          color: var(--bc-cli-green-bright) !important;
          font-family: var(--bc-cli-font) !important;
          font-weight: 650 !important;
          letter-spacing: .055em;
        }

        html[${ROOT_ATTRIBUTE}] :where(a[href]) {
          color: var(--bc-cli-cyan);
          text-decoration-color: rgba(99, 220, 255, .45);
          text-underline-offset: 3px;
        }

        html[${ROOT_ATTRIBUTE}] :where(button, input, textarea, select, [role="button"]) {
          border-color: var(--bc-cli-border) !important;
          border-radius: 2px !important;
          color: var(--bc-cli-green-bright);
        }

        html[${ROOT_ATTRIBUTE}] :where(button, [role="button"]):hover {
          border-color: var(--bc-cli-border-hot) !important;
          background-color: var(--bc-cli-hover) !important;
          color: var(--bc-cli-green-bright) !important;
          box-shadow: inset 2px 0 0 var(--bc-cli-green);
        }

        html[${ROOT_ATTRIBUTE}] :where(button, a, input, textarea, select, [contenteditable="true"]):focus-visible {
          outline: 1px solid var(--bc-cli-green) !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 3px rgba(121, 246, 157, .12) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(input, textarea, select) {
          background: var(--bc-cli-raised) !important;
          caret-color: var(--bc-cli-green);
        }

        html[${ROOT_ATTRIBUTE}] :where(input, textarea)::placeholder {
          color: var(--bc-cli-dim) !important;
          opacity: .75;
        }

        html[${ROOT_ATTRIBUTE}] :where([role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [data-radix-popper-content-wrapper] > *) {
          border-color: var(--bc-cli-border) !important;
          border-radius: 2px !important;
          background-color: var(--bc-cli-panel) !important;
          color: var(--bc-cli-green-bright) !important;
          box-shadow: 0 14px 42px rgba(0, 0, 0, .68), 0 0 0 1px rgba(121, 246, 157, .08) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where([role="menuitem"], [role="option"]):hover,
        html[${ROOT_ATTRIBUTE}] :where([aria-selected="true"], [aria-current="page"]) {
          background: var(--bc-cli-hover) !important;
          color: var(--bc-cli-green-bright) !important;
          box-shadow: inset 2px 0 0 var(--bc-cli-green);
        }

        html[${ROOT_ATTRIBUTE}] :where([aria-disabled="true"], :disabled) {
          color: var(--bc-cli-dim) !important;
          opacity: .55;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-app-action-sidebar-thread-row], [data-app-action-sidebar-project-row]) {
          border-radius: 2px !important;
          border-left: 2px solid transparent;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-app-action-sidebar-thread-active="true"], [data-app-action-sidebar-thread-selected="true"], [data-app-action-sidebar-project-row][aria-expanded="true"]) {
          border-left-color: var(--bc-cli-green) !important;
          background: var(--bc-cli-hover) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant] {
          border: 1px solid var(--bc-cli-border-hot) !important;
          border-radius: 2px !important;
          background: linear-gradient(180deg, rgba(121, 246, 157, .035), transparent 48%), var(--bc-cli-raised) !important;
          box-shadow: 0 0 0 1px rgba(121, 246, 157, .08), 0 12px 36px rgba(0, 0, 0, .58), inset 3px 0 0 var(--bc-cli-green) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-codex-composer] {
          color: var(--bc-cli-green-bright) !important;
          caret-color: var(--bc-cli-green) !important;
          font-family: var(--bc-cli-font) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-codex-approval-surface] {
          border: 1px solid rgba(255, 199, 102, .65) !important;
          border-radius: 2px !important;
          background: rgba(47, 35, 14, .86) !important;
          box-shadow: inset 3px 0 0 var(--bc-cli-amber) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-message-author-role="assistant"], [data-testid="assistant-message"]) {
          border-left: 2px solid var(--bc-cli-green);
          padding-left: 14px;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-message-author-role="user"], [data-testid="user-message"]) {
          border-right: 2px solid var(--bc-cli-cyan);
          border-radius: 2px !important;
          background: rgba(99, 220, 255, .045) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(pre, code, kbd, samp) {
          font-family: var(--bc-cli-font) !important;
          font-variant-ligatures: contextual;
        }

        html[${ROOT_ATTRIBUTE}] pre {
          border: 1px solid var(--bc-cli-border) !important;
          border-left: 3px solid var(--bc-cli-green) !important;
          border-radius: 2px !important;
          background: #020403 !important;
          color: var(--bc-cli-green-bright) !important;
          box-shadow: 0 10px 28px rgba(0, 0, 0, .42) !important;
        }

        html[${ROOT_ATTRIBUTE}] :not(pre) > code,
        html[${ROOT_ATTRIBUTE}] kbd {
          border: 1px solid var(--bc-cli-border);
          border-radius: 1px !important;
          background: var(--bc-cli-raised) !important;
          color: var(--bc-cli-green) !important;
        }

        html[${ROOT_ATTRIBUTE}] blockquote {
          border-left: 2px solid var(--bc-cli-cyan) !important;
          color: #a9ced5 !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(hr, table, th, td) { border-color: var(--bc-cli-border) !important; }
        html[${ROOT_ATTRIBUTE}] th { color: var(--bc-cli-green); text-transform: uppercase; letter-spacing: .06em; }
        html[${ROOT_ATTRIBUTE}] ins { color: var(--bc-cli-green) !important; background: rgba(121, 246, 157, .09) !important; }
        html[${ROOT_ATTRIBUTE}] del { color: var(--bc-cli-red) !important; background: rgba(255, 111, 125, .08) !important; }

        html[${ROOT_ATTRIBUTE}] :where([class*="text-muted"], [class*="text-tertiary"], [class*="text-secondary"]) {
          color: var(--bc-cli-dim) !important;
        }

        @media (prefers-reduced-transparency: reduce) {
          html[${ROOT_ATTRIBUTE}] body::before { background: none; box-shadow: inset 0 1px 0 rgba(121, 246, 157, .22); }
        }
      `;
      (document.head || document.documentElement).append(style);

      const installManagerTheme = () => {
        const host = document.getElementById("bettercodex-client-root");
        if (!host?.shadowRoot || host === managerHost) return;
        managerStyle?.remove();
        if (managerHost) {
          if (managerHostHadMarker) managerHost.setAttribute(HOST_ATTRIBUTE, previousManagerHostMarker ?? "");
          else managerHost.removeAttribute(HOST_ATTRIBUTE);
        }

        managerHost = host;
        managerHostHadMarker = host.hasAttribute(HOST_ATTRIBUTE);
        previousManagerHostMarker = host.getAttribute(HOST_ATTRIBUTE);
        host.setAttribute(HOST_ATTRIBUTE, "");
        host.shadowRoot.querySelectorAll(`style[${MANAGER_STYLE_ATTRIBUTE}]`).forEach((node) => node.remove());
        managerStyle = document.createElement("style");
        managerStyle.setAttribute(MANAGER_STYLE_ATTRIBUTE, "");
        managerStyle.textContent = `
          :host([${HOST_ATTRIBUTE}]) {
            --bb-bg: #050806;
            --bb-side: #09100b;
            --bb-surface: #0d1710;
            --bb-hover: #122219;
            --bb-border: #24452e;
            --bb-text: #c2ffd1;
            --bb-muted: #7d9f86;
            --bb-icon: #79f69d;
          }
          :host([${HOST_ATTRIBUTE}]) .view {
            background: #050806;
            font-family: "Cascadia Code", "JetBrains Mono", Consolas, monospace;
            letter-spacing: .005em;
          }
          :host([${HOST_ATTRIBUTE}]) :is(.sidebar, .main) { background: #050806; }
          :host([${HOST_ATTRIBUTE}]) .sidebar { background: #09100b; border-color: #24452e; }
          :host([${HOST_ATTRIBUTE}]) :is(.back, .nav, .card, .plugin-card, .repo, .generate-plus, .track) { border-radius: 2px; }
          :host([${HOST_ATTRIBUTE}]) :is(.nav-heading, h1, h2, .name) { letter-spacing: .055em; text-transform: uppercase; }
          :host([${HOST_ATTRIBUTE}]) :is(.back, .nav, .repo, .generate-addon):hover { color: #c2ffd1; border-color: #56d977; background: #122219; }
          :host([${HOST_ATTRIBUTE}]) .nav.active { color: #c2ffd1; background: #122219; box-shadow: inset 2px 0 0 #79f69d; }
          :host([${HOST_ATTRIBUTE}]) :is(.card, .plugin-card) { border-color: #24452e; background: #0d1710; box-shadow: 0 12px 30px rgba(0, 0, 0, .34); }
          :host([${HOST_ATTRIBUTE}]) .plugin-preview { border-color: #24452e; }
          :host([${HOST_ATTRIBUTE}]) .track { background: #26352a; }
          :host([${HOST_ATTRIBUTE}]) input:checked + .track { background: #2b8750; box-shadow: 0 0 12px rgba(121, 246, 157, .24); }
          :host([${HOST_ATTRIBUTE}]) input:focus-visible + .track { outline: 1px solid #79f69d; outline-offset: 2px; }
        `;
        host.shadowRoot.append(managerStyle);
      };

      installManagerTheme();
      const observer = new MutationObserver(installManagerTheme);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      globalThis.__BETTERCODEX_CLI_THEME_ACTIVE__ = true;

      cleanup = () => {
        if (stopped) return;
        stopped = true;
        observer.disconnect();
        style.remove();
        managerStyle?.remove();
        if (managerHost) {
          if (managerHostHadMarker) managerHost.setAttribute(HOST_ATTRIBUTE, previousManagerHostMarker ?? "");
          else managerHost.removeAttribute(HOST_ATTRIBUTE);
        }
        if (rootHadMarker) root.setAttribute(ROOT_ATTRIBUTE, previousRootMarker ?? "");
        else root.removeAttribute(ROOT_ATTRIBUTE);
        delete globalThis.__BETTERCODEX_CLI_THEME_ACTIVE__;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
