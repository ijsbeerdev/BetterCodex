(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "cyberpunk-theme",
    start() {
      cleanup();

      const ROOT_ATTRIBUTE = "data-bettercodex-cyberpunk-theme";
      const LOW_CONTRAST_ATTRIBUTE = "data-bettercodex-cyberpunk-low-contrast";
      const HOST_ATTRIBUTE = "data-bettercodex-cyberpunk-theme-host";
      const STYLE_ATTRIBUTE = "data-bettercodex-cyberpunk-theme-style";
      const MANAGER_STYLE_ATTRIBUTE = "data-bettercodex-cyberpunk-theme-manager-style";
      const root = document.documentElement;
      const rootHadMarker = root.hasAttribute(ROOT_ATTRIBUTE);
      const previousRootMarker = root.getAttribute(ROOT_ATTRIBUTE);
      const rootHadLowContrastMarker = root.hasAttribute(LOW_CONTRAST_ATTRIBUTE);
      const previousLowContrastMarker = root.getAttribute(LOW_CONTRAST_ATTRIBUTE);
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
          --bc-cyber-void: #06030b;
          --bc-cyber-night: #0b0612;
          --bc-cyber-panel: #10091b;
          --bc-cyber-raised: #171026;
          --bc-cyber-hover: #211333;
          --bc-cyber-border: #3d2759;
          --bc-cyber-border-hot: #8656ad;
          --bc-cyber-text: #f4edff;
          --bc-cyber-muted: #a990bd;
          --bc-cyber-cyan: #32e6ff;
          --bc-cyber-cyan-soft: #9af4ff;
          --bc-cyber-magenta: #ff3cac;
          --bc-cyber-yellow: #ffd166;
          --bc-cyber-red: #ff557f;
          --bc-cyber-font: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
          --bc-cyber-mono: "Cascadia Code", "JetBrains Mono", Consolas, monospace;
          --font-sans: var(--bc-cyber-font);
          --font-mono: var(--bc-cyber-mono);
          --color-token-main-surface-primary: var(--bc-cyber-void);
          --color-token-main-surface-secondary: var(--bc-cyber-night);
          --color-token-dropdown-background: var(--bc-cyber-panel);
          --color-token-dropdown-foreground: var(--bc-cyber-text);
          --color-token-input-background: var(--bc-cyber-raised);
          --color-token-input-border: var(--bc-cyber-border);
          --color-token-foreground: var(--bc-cyber-text);
          --color-token-text-primary: var(--bc-cyber-text);
          --color-token-text-secondary: color-mix(in srgb, var(--bc-cyber-text) 72%, transparent);
          --color-token-text-tertiary: var(--bc-cyber-muted);
          --color-token-focus-border: var(--bc-cyber-cyan);
          --color-token-description-foreground: var(--bc-cyber-muted);
          --color-token-icon-foreground: var(--bc-cyber-cyan);
          --color-token-border-default: var(--bc-cyber-border);
          --color-token-border: color-mix(in srgb, var(--bc-cyber-border) 78%, transparent);
          --color-token-border-light: color-mix(in srgb, var(--bc-cyber-cyan) 9%, transparent);
          --color-token-border-heavy: var(--bc-cyber-border-hot);
          --color-token-list-hover-background: var(--bc-cyber-hover);
          --color-token-git-decoration-added-resource-foreground: #52ff9a;
          --color-token-git-decoration-deleted-resource-foreground: var(--bc-cyber-red);
          --color-token-git-decoration-modified-resource-foreground: var(--bc-cyber-yellow);
          --color-surface: var(--bc-cyber-void);
          --color-surface-secondary: var(--bc-cyber-night);
          --color-surface-tertiary: var(--bc-cyber-panel);
          --color-surface-elevated: color-mix(in srgb, var(--bc-cyber-panel) 96%, transparent);
          --color-surface-elevated-secondary: var(--bc-cyber-panel);
          --color-background-surface: var(--bc-cyber-void);
          --color-background-surface-under: #030105;
          --codex-base-surface: var(--bc-cyber-void);
          --wb-surface-primary: var(--bc-cyber-void);
          --wb-surface-secondary: var(--bc-cyber-night);
          --wb-text-primary: var(--bc-cyber-text);
          --wb-text-secondary: color-mix(in srgb, var(--bc-cyber-text) 72%, transparent);
          --wb-text-tertiary: var(--bc-cyber-muted);
          --vscode-foreground: var(--bc-cyber-text);
          --vscode-editor-background: var(--bc-cyber-void);
          --vscode-sideBar-background: var(--bc-cyber-night);
          --vscode-sideBar-foreground: var(--bc-cyber-text);
          --vscode-input-background: var(--bc-cyber-raised);
          --vscode-input-foreground: var(--bc-cyber-text);
          --vscode-input-border: var(--bc-cyber-border);
          --vscode-focusBorder: var(--bc-cyber-cyan);
          --vscode-list-hoverBackground: var(--bc-cyber-hover);
          --vscode-list-activeSelectionBackground: #28133d;
          --vscode-list-activeSelectionForeground: var(--bc-cyber-text);
          --vscode-dropdown-background: var(--bc-cyber-panel);
          --vscode-dropdown-listBackground: color-mix(in srgb, var(--bc-cyber-panel) 96%, transparent);
          --vscode-dropdown-foreground: var(--bc-cyber-text);
          background: var(--bc-cyber-void) !important;
        }

        html[${ROOT_ATTRIBUTE}],
        html[${ROOT_ATTRIBUTE}] body,
        html[${ROOT_ATTRIBUTE}] #root {
          background: var(--bc-cyber-void) !important;
          color: var(--bc-cyber-text) !important;
        }

        html[${ROOT_ATTRIBUTE}][${LOW_CONTRAST_ATTRIBUTE}] body,
        html[${ROOT_ATTRIBUTE}][${LOW_CONTRAST_ATTRIBUTE}] #root {
          background:
            radial-gradient(circle at 100% 0%, rgba(255, 60, 172, .17), transparent 44rem),
            radial-gradient(circle at 0% 100%, rgba(50, 230, 255, .14), transparent 52rem),
            linear-gradient(145deg, #07030e 0%, #11071b 48%, #05030a 100%) !important;
          background-attachment: fixed !important;
        }

        html[${ROOT_ATTRIBUTE}] body,
        html[${ROOT_ATTRIBUTE}] button,
        html[${ROOT_ATTRIBUTE}] input,
        html[${ROOT_ATTRIBUTE}] textarea,
        html[${ROOT_ATTRIBUTE}] select,
        html[${ROOT_ATTRIBUTE}] [contenteditable="true"] {
          font-family: var(--bc-cyber-font) !important;
        }

        html[${ROOT_ATTRIBUTE}] body::before,
        html[${ROOT_ATTRIBUTE}] body::after {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          pointer-events: none;
        }

        html[${ROOT_ATTRIBUTE}] body::before {
          background:
            linear-gradient(rgba(50, 230, 255, .024) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 60, 172, .018) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: linear-gradient(to bottom, transparent 2%, #000 30%, #000 100%);
        }

        html[${ROOT_ATTRIBUTE}] body::after {
          background: repeating-linear-gradient(to bottom, transparent 0, transparent 4px, rgba(154, 244, 255, .022) 5px);
          box-shadow: inset 0 0 130px rgba(0, 0, 0, .72), inset 0 1px 0 rgba(50, 230, 255, .18);
        }

        html[${ROOT_ATTRIBUTE}] ::selection {
          color: var(--bc-cyber-void);
          background: var(--bc-cyber-cyan);
        }

        html[${ROOT_ATTRIBUTE}] * {
          scrollbar-color: var(--bc-cyber-border-hot) var(--bc-cyber-void);
        }

        html[${ROOT_ATTRIBUTE}] *::-webkit-scrollbar { width: 10px; height: 10px; }
        html[${ROOT_ATTRIBUTE}] *::-webkit-scrollbar-track { background: var(--bc-cyber-void); }
        html[${ROOT_ATTRIBUTE}] *::-webkit-scrollbar-thumb {
          border: 2px solid var(--bc-cyber-void);
          border-radius: 2px;
          background: linear-gradient(var(--bc-cyber-cyan), var(--bc-cyber-magenta));
        }

        html[${ROOT_ATTRIBUTE}] :where(main, [role="main"]) {
          background:
            radial-gradient(circle at 100% 0%, rgba(255, 60, 172, .09), transparent 38rem),
            radial-gradient(circle at 0% 100%, rgba(50, 230, 255, .07), transparent 46rem),
            var(--bc-cyber-void) !important;
        }

        html[${ROOT_ATTRIBUTE}][${LOW_CONTRAST_ATTRIBUTE}] :where(main, [role="main"]) {
          background:
            linear-gradient(rgba(50, 230, 255, .043) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 60, 172, .034) 1px, transparent 1px),
            radial-gradient(circle at 100% 0%, rgba(255, 60, 172, .15), transparent 40rem),
            radial-gradient(circle at 0% 100%, rgba(50, 230, 255, .12), transparent 48rem),
            linear-gradient(145deg, #07030e, #100719 52%, #05030a) !important;
          background-size: 30px 30px, 30px 30px, auto, auto, auto !important;
          background-attachment: local, local, fixed, fixed, fixed !important;
        }

        html[${ROOT_ATTRIBUTE}][${LOW_CONTRAST_ATTRIBUTE}] :where(aside, [role="navigation"]) {
          background:
            linear-gradient(180deg, rgba(255, 60, 172, .07), transparent 25%),
            #0d0716 !important;
          box-shadow: inset -1px 0 0 rgba(50, 230, 255, .14), 8px 0 32px rgba(0, 0, 0, .18);
        }

        html[${ROOT_ATTRIBUTE}] :where(aside, [role="navigation"]) {
          border-color: var(--bc-cyber-border) !important;
          background: linear-gradient(180deg, rgba(255, 60, 172, .035), transparent 22%), var(--bc-cyber-night) !important;
          box-shadow: inset -1px 0 0 rgba(50, 230, 255, .06);
        }

        html[${ROOT_ATTRIBUTE}] :where(#app-titlebar, #toolbar, header) {
          border-color: var(--bc-cyber-border) !important;
          background-color: rgba(6, 3, 11, .94) !important;
          box-shadow: 0 1px 0 rgba(50, 230, 255, .06);
        }

        html[${ROOT_ATTRIBUTE}] :where(h1, h2, h3, h4) {
          color: var(--bc-cyber-text) !important;
          font-weight: 720 !important;
          letter-spacing: .035em;
          text-shadow: 1px 0 0 rgba(50, 230, 255, .26), -1px 0 0 rgba(255, 60, 172, .2);
        }

        html[${ROOT_ATTRIBUTE}] :where(a[href]) {
          color: var(--bc-cyber-cyan-soft);
          text-decoration-color: rgba(255, 60, 172, .62);
          text-underline-offset: 3px;
        }

        html[${ROOT_ATTRIBUTE}] :where(button, input, textarea, select, [role="button"]) {
          border-color: var(--bc-cyber-border) !important;
          border-radius: 4px !important;
          color: var(--bc-cyber-text);
        }

        html[${ROOT_ATTRIBUTE}] :where(button, [role="button"]):hover {
          border-color: var(--bc-cyber-cyan) !important;
          background-color: var(--bc-cyber-hover) !important;
          color: var(--bc-cyber-text) !important;
          box-shadow: inset 2px 0 0 var(--bc-cyber-magenta), 0 0 14px rgba(50, 230, 255, .1);
        }

        html[${ROOT_ATTRIBUTE}] :where(button, a, input, textarea, select, [contenteditable="true"]):focus-visible {
          outline: 1px solid var(--bc-cyber-cyan) !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 3px rgba(50, 230, 255, .13), 0 0 20px rgba(255, 60, 172, .08) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(input, textarea, select) {
          background: var(--bc-cyber-raised) !important;
          caret-color: var(--bc-cyber-cyan);
        }

        html[${ROOT_ATTRIBUTE}] :where(input, textarea)::placeholder {
          color: var(--bc-cyber-muted) !important;
          opacity: .76;
        }

        html[${ROOT_ATTRIBUTE}] :where([role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [data-radix-popper-content-wrapper] > *) {
          border-color: var(--bc-cyber-border-hot) !important;
          border-radius: 4px !important;
          background: linear-gradient(145deg, rgba(50, 230, 255, .035), transparent 32%), var(--bc-cyber-panel) !important;
          color: var(--bc-cyber-text) !important;
          box-shadow: 0 18px 48px rgba(0, 0, 0, .72), 0 0 0 1px rgba(255, 60, 172, .1), 0 0 30px rgba(50, 230, 255, .06) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where([role="menuitem"], [role="option"]):hover,
        html[${ROOT_ATTRIBUTE}] :where([aria-selected="true"], [aria-current="page"]) {
          background: linear-gradient(90deg, rgba(255, 60, 172, .14), rgba(50, 230, 255, .05)) !important;
          color: var(--bc-cyber-text) !important;
          box-shadow: inset 2px 0 0 var(--bc-cyber-cyan);
        }

        html[${ROOT_ATTRIBUTE}] :where([aria-disabled="true"], :disabled) {
          color: var(--bc-cyber-muted) !important;
          opacity: .5;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-app-action-sidebar-thread-row], [data-app-action-sidebar-project-row]) {
          border-radius: 3px !important;
          border-left: 2px solid transparent;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-app-action-sidebar-thread-active="true"], [data-app-action-sidebar-thread-selected="true"], [data-app-action-sidebar-project-row][aria-expanded="true"]) {
          border-left-color: var(--bc-cyber-cyan) !important;
          background: linear-gradient(90deg, rgba(50, 230, 255, .12), rgba(255, 60, 172, .055)) !important;
          box-shadow: inset 0 1px 0 rgba(154, 244, 255, .05);
        }

        html[${ROOT_ATTRIBUTE}] :where(
          [data-app-action-sidebar-section-heading="Projects"],
          [data-app-action-sidebar-section-heading="Recents"]
        ) {
          background: linear-gradient(90deg, rgba(50, 230, 255, .018), transparent 72%);
        }

        html[${ROOT_ATTRIBUTE}] :where(
          [data-app-action-sidebar-section-heading="Projects"],
          [data-app-action-sidebar-section-heading="Recents"]
        ) [data-app-action-sidebar-section-toggle] {
          border: 0 !important;
          border-radius: 2px !important;
          color: var(--bc-cyber-text) !important;
          font-family: var(--bc-cyber-mono) !important;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .075em;
          text-transform: uppercase;
          text-shadow: 1px 0 0 rgba(50, 230, 255, .3), -1px 0 0 rgba(255, 60, 172, .22);
        }

        html[${ROOT_ATTRIBUTE}] :where(
          [data-app-action-sidebar-section-heading="Projects"],
          [data-app-action-sidebar-section-heading="Recents"]
        ) [data-app-action-sidebar-section-toggle]::before {
          content: "//";
          flex: 0 0 auto;
          color: var(--bc-cyber-magenta);
          font-size: 10px;
          letter-spacing: -.08em;
          text-shadow: 0 0 8px rgba(255, 60, 172, .42);
        }

        html[${ROOT_ATTRIBUTE}] :where(
          [data-app-action-sidebar-section-heading="Projects"],
          [data-app-action-sidebar-section-heading="Recents"]
        ) [data-app-action-sidebar-section-toggle] * {
          color: inherit !important;
          opacity: 1 !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(
          [data-app-action-sidebar-section-heading="Projects"],
          [data-app-action-sidebar-section-heading="Recents"]
        ) [data-app-action-sidebar-section-toggle]:hover {
          border-color: transparent !important;
          background: linear-gradient(90deg, rgba(255, 60, 172, .075), rgba(50, 230, 255, .04)) !important;
          box-shadow: inset 2px 0 0 var(--bc-cyber-cyan) !important;
        }

        html[${ROOT_ATTRIBUTE}] [class~="bg-token-dropdown-background"]:has([data-slot="thread-summary-panel-item-button"]) {
          overflow: hidden;
          border: 1px solid var(--bc-cyber-border-hot) !important;
          border-radius: 7px 7px 2px 7px !important;
          background:
            linear-gradient(135deg, rgba(50, 230, 255, .075), transparent 27%, rgba(255, 60, 172, .045)),
            var(--bc-cyber-panel) !important;
          box-shadow:
            0 18px 50px rgba(0, 0, 0, .68),
            0 0 24px rgba(50, 230, 255, .07),
            inset -1px 0 0 rgba(255, 60, 172, .5) !important;
        }

        html[${ROOT_ATTRIBUTE}] [class~="bg-token-dropdown-background"]:has([data-slot="thread-summary-panel-item-button"])::before {
          content: "";
          position: absolute;
          inset: 0 34% auto 0;
          z-index: 20;
          height: 2px;
          pointer-events: none;
          background: linear-gradient(90deg, var(--bc-cyber-cyan), rgba(50, 230, 255, .12), transparent);
          box-shadow: 0 0 11px rgba(50, 230, 255, .45);
        }

        html[${ROOT_ATTRIBUTE}] [class~="bg-token-dropdown-background"]:has([data-slot="thread-summary-panel-item-button"])::after {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          z-index: 21;
          width: 2px;
          pointer-events: none;
          background: var(--bc-cyber-cyan);
          box-shadow: 0 0 9px rgba(50, 230, 255, .38);
        }

        html[${ROOT_ATTRIBUTE}] section:has([data-slot="thread-summary-panel-item-button"]) {
          border-bottom: 1px solid rgba(134, 86, 173, .28);
          background: linear-gradient(90deg, rgba(50, 230, 255, .018), transparent 54%);
        }

        html[${ROOT_ATTRIBUTE}] section:has([data-slot="thread-summary-panel-item-button"]) > header {
          border-bottom: 1px solid rgba(50, 230, 255, .16) !important;
          background:
            linear-gradient(90deg, rgba(50, 230, 255, .075), transparent 48%, rgba(255, 60, 172, .04)),
            var(--bc-cyber-night) !important;
          color: var(--bc-cyber-text) !important;
          box-shadow: none;
        }

        html[${ROOT_ATTRIBUTE}] section:has([data-slot="thread-summary-panel-item-button"]) > header > button[aria-expanded] {
          color: var(--bc-cyber-text) !important;
          font-family: var(--bc-cyber-mono) !important;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .075em;
          text-transform: uppercase;
          text-shadow: 1px 0 0 rgba(50, 230, 255, .3), -1px 0 0 rgba(255, 60, 172, .22);
        }

        html[${ROOT_ATTRIBUTE}] section:has([data-slot="thread-summary-panel-item-button"]) > header > button[aria-expanded]::before {
          content: "//";
          color: var(--bc-cyber-magenta);
          font-size: 10px;
          letter-spacing: -.08em;
          text-shadow: 0 0 8px rgba(255, 60, 172, .42);
        }

        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-icon-button"] {
          border: 1px solid var(--bc-cyber-border-hot) !important;
          border-radius: 3px !important;
          background: rgba(255, 60, 172, .055) !important;
          color: var(--bc-cyber-cyan) !important;
          box-shadow: inset 0 0 10px rgba(50, 230, 255, .045);
        }

        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-icon-button"]:hover {
          border-color: var(--bc-cyber-cyan) !important;
          background: linear-gradient(135deg, rgba(50, 230, 255, .14), rgba(255, 60, 172, .12)) !important;
          box-shadow: 0 0 14px rgba(50, 230, 255, .14), inset 2px 0 0 var(--bc-cyber-magenta) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-slot="thread-summary-panel-item-button"], [data-slot="thread-summary-panel-item"]) {
          min-height: 31px;
          border-bottom: 1px solid rgba(61, 39, 89, .3) !important;
          border-radius: 2px !important;
          background: linear-gradient(90deg, rgba(50, 230, 255, .015), transparent 42%) !important;
          color: var(--bc-cyber-text) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-item-button"]:hover {
          border-color: rgba(50, 230, 255, .32) !important;
          background: linear-gradient(90deg, rgba(50, 230, 255, .13), rgba(255, 60, 172, .075)) !important;
          box-shadow: inset 2px 0 0 var(--bc-cyber-cyan), inset -1px 0 0 rgba(255, 60, 172, .5), 0 0 15px rgba(50, 230, 255, .055) !important;
          transform: translateX(1px);
        }

        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-item-leading"] {
          color: var(--bc-cyber-cyan) !important;
          filter: drop-shadow(0 0 4px rgba(50, 230, 255, .24));
        }

        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-item-label"] {
          color: #d9c8e7 !important;
          letter-spacing: .012em;
        }

        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-item-button"]:hover [data-slot="thread-summary-panel-item-label"] {
          color: var(--bc-cyber-text) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-item-meta"],
        html[${ROOT_ATTRIBUTE}] [data-slot="thread-summary-panel-item-actions"] {
          color: var(--bc-cyber-magenta) !important;
        }

        html[${ROOT_ATTRIBUTE}] [class~="text-token-git-decoration-added-resource-foreground"] {
          color: #52ff9a !important;
          text-shadow: 0 0 7px rgba(82, 255, 154, .26);
        }

        html[${ROOT_ATTRIBUTE}] [class~="text-token-git-decoration-deleted-resource-foreground"] {
          color: var(--bc-cyber-red) !important;
          text-shadow: 0 0 7px rgba(255, 85, 127, .26);
        }

        html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant] {
          border: 1px solid var(--bc-cyber-border-hot) !important;
          border-radius: 2px !important;
          overflow: hidden;
          background:
            linear-gradient(100deg, rgba(50, 230, 255, .055), transparent 35%, rgba(255, 60, 172, .05)),
            var(--bc-cyber-raised) !important;
          box-shadow: 0 0 0 1px rgba(50, 230, 255, .05), 0 16px 42px rgba(0, 0, 0, .58), inset 3px 0 0 var(--bc-cyber-cyan), inset -2px 0 0 var(--bc-cyber-magenta) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant]:focus-within {
          border-color: var(--bc-cyber-cyan) !important;
          box-shadow: 0 0 0 1px rgba(50, 230, 255, .16), 0 0 26px rgba(50, 230, 255, .09), inset 3px 0 0 var(--bc-cyber-cyan), inset -2px 0 0 var(--bc-cyber-magenta) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-codex-composer] {
          color: var(--bc-cyber-text) !important;
          caret-color: var(--bc-cyber-cyan) !important;
        }

        html[${ROOT_ATTRIBUTE}] [role="menubar"][aria-label="Application menu"] > button[role="menuitem"] {
          border: 0 !important;
          border-radius: 3px !important;
          box-shadow: none !important;
        }

        html[${ROOT_ATTRIBUTE}] [role="menubar"][aria-label="Application menu"] > button[role="menuitem"]:hover,
        html[${ROOT_ATTRIBUTE}] [role="menubar"][aria-label="Application menu"] > button[role="menuitem"][data-state="open"] {
          border: 0 !important;
          background: linear-gradient(90deg, rgba(50, 230, 255, .09), rgba(255, 60, 172, .065)) !important;
          box-shadow: inset 0 -1px 0 var(--bc-cyber-cyan) !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant] :where(button, [role="button"]):hover {
          border-color: var(--bc-cyber-border-hot) !important;
          background: rgba(50, 230, 255, .075) !important;
          color: var(--bc-cyber-text) !important;
          box-shadow: 0 0 12px rgba(50, 230, 255, .08) !important;
          transform: none;
        }

        html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant] :where(button[aria-label="Send"], button[aria-label="Stop"]) {
          border: 1px solid var(--bc-cyber-cyan) !important;
          border-radius: 50% !important;
          background: var(--bc-cyber-cyan) !important;
          color: var(--bc-cyber-void) !important;
          box-shadow: 0 0 11px rgba(50, 230, 255, .18), inset 0 0 0 1px rgba(154, 244, 255, .22) !important;
          transition: transform 130ms ease, border-color 130ms ease, background 130ms ease, box-shadow 130ms ease !important;
        }

        html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant] :where(button[aria-label="Send"], button[aria-label="Stop"]):hover {
          border-color: var(--bc-cyber-magenta) !important;
          border-radius: 50% !important;
          background: linear-gradient(135deg, var(--bc-cyber-cyan-soft), var(--bc-cyber-magenta)) !important;
          color: var(--bc-cyber-void) !important;
          box-shadow: 0 0 18px rgba(50, 230, 255, .28), 0 0 12px rgba(255, 60, 172, .2), inset 0 0 0 1px rgba(255, 255, 255, .24) !important;
          transform: translateY(-1px);
        }

        html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant] :where(button[aria-label="Send"], button[aria-label="Stop"]):active {
          transform: translateY(0) scale(.96);
        }

        html[${ROOT_ATTRIBUTE}] [data-codex-approval-surface] {
          border: 1px solid rgba(255, 209, 102, .66) !important;
          border-radius: 4px !important;
          background: linear-gradient(90deg, rgba(255, 209, 102, .11), transparent), var(--bc-cyber-panel) !important;
          box-shadow: inset 3px 0 0 var(--bc-cyber-yellow), 0 0 20px rgba(255, 209, 102, .06) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-message-author-role="assistant"], [data-testid="assistant-message"]) {
          border-left: 2px solid rgba(50, 230, 255, .78);
          padding-left: 14px;
        }

        html[${ROOT_ATTRIBUTE}] :where([data-message-author-role="user"], [data-testid="user-message"]) {
          border-right: 2px solid rgba(255, 60, 172, .78);
          border-radius: 4px 4px 2px 4px !important;
          background: linear-gradient(100deg, rgba(255, 60, 172, .065), rgba(50, 230, 255, .025)) !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(pre, code, kbd, samp) {
          font-family: var(--bc-cyber-mono) !important;
        }

        html[${ROOT_ATTRIBUTE}] pre {
          border: 1px solid var(--bc-cyber-border) !important;
          border-left: 3px solid var(--bc-cyber-cyan) !important;
          border-radius: 3px !important;
          background: #040207 !important;
          color: #eafcff !important;
          box-shadow: 0 12px 32px rgba(0, 0, 0, .5), inset -1px 0 0 rgba(255, 60, 172, .26) !important;
        }

        html[${ROOT_ATTRIBUTE}] :not(pre) > code,
        html[${ROOT_ATTRIBUTE}] kbd {
          border: 1px solid var(--bc-cyber-border);
          border-radius: 2px !important;
          background: var(--bc-cyber-raised) !important;
          color: var(--bc-cyber-cyan-soft) !important;
        }

        html[${ROOT_ATTRIBUTE}] blockquote {
          border-left: 2px solid var(--bc-cyber-magenta) !important;
          color: #d3c0df !important;
        }

        html[${ROOT_ATTRIBUTE}] :where(hr, table, th, td) { border-color: var(--bc-cyber-border) !important; }
        html[${ROOT_ATTRIBUTE}] th { color: var(--bc-cyber-cyan); text-transform: uppercase; letter-spacing: .06em; }
        html[${ROOT_ATTRIBUTE}] ins { color: var(--bc-cyber-cyan-soft) !important; background: rgba(50, 230, 255, .085) !important; }
        html[${ROOT_ATTRIBUTE}] del { color: #ff8bab !important; background: rgba(255, 60, 172, .075) !important; }

        html[${ROOT_ATTRIBUTE}] :where([class*="text-muted"], [class*="text-tertiary"], [class*="text-secondary"]) {
          color: var(--bc-cyber-muted) !important;
        }

        @media (prefers-reduced-transparency: reduce) {
          html[${ROOT_ATTRIBUTE}] body::before { background: none; }
          html[${ROOT_ATTRIBUTE}] body::after { background: none; box-shadow: inset 0 1px 0 rgba(50, 230, 255, .18); }
          html[${ROOT_ATTRIBUTE}] :where(#app-titlebar, #toolbar, header) { background-color: var(--bc-cyber-void) !important; }
        }

        @media (prefers-contrast: more) {
          html[${ROOT_ATTRIBUTE}] { --bc-cyber-muted: #cbb8d8; --bc-cyber-border: #765497; }
        }

        @media (prefers-reduced-motion: reduce) {
          html[${ROOT_ATTRIBUTE}] [data-composer-radius-variant][data-composer-surface-variant] :where(button[aria-label="Send"], button[aria-label="Stop"]) {
            transition: none !important;
          }
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
            --bb-bg: #06030b;
            --bb-side: #0b0612;
            --bb-surface: #171026;
            --bb-hover: #211333;
            --bb-border: #3d2759;
            --bb-text: #f4edff;
            --bb-muted: #a990bd;
            --bb-icon: #32e6ff;
          }
          :host([${HOST_ATTRIBUTE}]) .view {
            background:
              linear-gradient(rgba(50, 230, 255, .018) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 60, 172, .014) 1px, transparent 1px),
              #06030b;
            background-size: 32px 32px;
            font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
          }
          :host([${HOST_ATTRIBUTE}]) :is(.sidebar, .main) { background-color: rgba(6, 3, 11, .94); }
          :host([${HOST_ATTRIBUTE}]) .sidebar { background-color: #0b0612; border-color: #3d2759; box-shadow: inset -1px 0 0 rgba(50, 230, 255, .06); }
          :host([${HOST_ATTRIBUTE}]) :is(.back, .nav, .card, .plugin-card, .repo, .generate-plus, .track) { border-radius: 4px; }
          :host([${HOST_ATTRIBUTE}]) :is(.nav-heading, h1, h2, .name) { letter-spacing: .035em; }
          :host([${HOST_ATTRIBUTE}]) :is(.back, .nav, .repo, .generate-addon):hover { color: #f4edff; border-color: #32e6ff; background: #211333; box-shadow: inset 2px 0 0 #ff3cac; }
          :host([${HOST_ATTRIBUTE}]) .nav.active { color: #f4edff; background: linear-gradient(90deg, rgba(50, 230, 255, .12), rgba(255, 60, 172, .055)); box-shadow: inset 2px 0 0 #32e6ff; }
          :host([${HOST_ATTRIBUTE}]) :is(.card, .plugin-card) { border-color: #3d2759; background: linear-gradient(145deg, rgba(50, 230, 255, .035), transparent 35%), #171026; box-shadow: 0 14px 34px rgba(0, 0, 0, .38), inset -1px 0 0 rgba(255, 60, 172, .12); }
          :host([${HOST_ATTRIBUTE}]) .plugin-preview { border-color: #3d2759; }
          :host([${HOST_ATTRIBUTE}]) .track { border-radius: 3px; background: #202944; }
          :host([${HOST_ATTRIBUTE}]) .track::after { border-radius: 2px; }
          :host([${HOST_ATTRIBUTE}]) input:checked + .track { background: #1688e8; box-shadow: 0 0 14px rgba(22, 136, 232, .28); }
          :host([${HOST_ATTRIBUTE}]) input:focus-visible + .track { outline: 1px solid #32e6ff; outline-offset: 2px; }
        `;
        host.shadowRoot.append(managerStyle);
      };

      installManagerTheme();
      const observer = new MutationObserver(installManagerTheme);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      const syncContrastAppearance = () => {
        const contrast = Number.parseFloat(getComputedStyle(root).getPropertyValue("--codex-base-contrast"));
        if (Number.isFinite(contrast) && contrast <= 65) root.setAttribute(LOW_CONTRAST_ATTRIBUTE, "");
        else root.removeAttribute(LOW_CONTRAST_ATTRIBUTE);
      };
      syncContrastAppearance();
      const appearanceObserver = new MutationObserver(syncContrastAppearance);
      appearanceObserver.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
      globalThis.__BETTERCODEX_CYBERPUNK_THEME_ACTIVE__ = true;

      cleanup = () => {
        if (stopped) return;
        stopped = true;
        observer.disconnect();
        appearanceObserver.disconnect();
        style.remove();
        managerStyle?.remove();
        if (managerHost) {
          if (managerHostHadMarker) managerHost.setAttribute(HOST_ATTRIBUTE, previousManagerHostMarker ?? "");
          else managerHost.removeAttribute(HOST_ATTRIBUTE);
        }
        if (rootHadMarker) root.setAttribute(ROOT_ATTRIBUTE, previousRootMarker ?? "");
        else root.removeAttribute(ROOT_ATTRIBUTE);
        if (rootHadLowContrastMarker) root.setAttribute(LOW_CONTRAST_ATTRIBUTE, previousLowContrastMarker ?? "");
        else root.removeAttribute(LOW_CONTRAST_ATTRIBUTE);
        delete globalThis.__BETTERCODEX_CYBERPUNK_THEME_ACTIVE__;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
