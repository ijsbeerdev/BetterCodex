(() => {
  let cleanup = () => {};

  BetterCodex.register({
    id: "weekly-limit",
    start() {
      cleanup();

      const SURFACE_SELECTOR = "[data-composer-radius-variant][data-composer-surface-variant]";
      const EDITOR_SELECTOR = "[data-codex-composer]";
      const INDICATOR_ATTRIBUTE = "data-bettercodex-weekly-limit";
      const STYLE_ATTRIBUTE = "data-bettercodex-weekly-limit-style";
      const WEEK_SECONDS = 7 * 24 * 60 * 60;
      const REFRESH_INTERVAL = 60 * 1000;
      const REQUEST_TIMEOUT = 10 * 1000;
      const DICTATION_CONTROL_PATTERN = /\b(dictat(?:e|ion)|microphone|voice)\b/i;
      const state = {
        stopped: false,
        scheduled: false,
        indicator: null,
        style: null,
        observer: null,
        interval: null,
        requestId: null,
        requestTimeout: null,
        weeklyWindow: null,
        loading: true
      };

      const number = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const clampPercent = (value) => Math.min(Math.max(value, 0), 100);
      const windowDurationSeconds = (window) => number(window?.limit_window_seconds)
        ?? (number(window?.windowDurationMins) == null ? null : number(window.windowDurationMins) * 60);
      const weeklyWindowFrom = (usage) => {
        const rateLimit = usage?.rate_limit ?? usage?.rateLimit;
        const windows = [
          rateLimit?.primary_window ?? rateLimit?.primary,
          rateLimit?.secondary_window ?? rateLimit?.secondary
        ].filter(Boolean);
        return windows.find((window) => {
          const seconds = windowDurationSeconds(window);
          return seconds != null && Math.abs(seconds - WEEK_SECONDS) <= 60;
        }) ?? null;
      };
      const usedPercentFor = (window) => number(window?.used_percent ?? window?.usedPercent);
      const resetAtFor = (window) => number(window?.reset_at ?? window?.resetsAt);

      const resetLabel = (window) => {
        const resetAt = resetAtFor(window);
        if (resetAt == null) return "";
        const date = new Date(resetAt < 1e12 ? resetAt * 1000 : resetAt);
        if (!Number.isFinite(date.getTime())) return "";
        return ` · Resets ${date.toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit"
        })}`;
      };

      const render = () => {
        const indicator = state.indicator;
        if (!indicator) return;
        const usedPercent = usedPercentFor(state.weeklyWindow);
        if (usedPercent == null) {
          indicator.textContent = state.loading ? "Weekly …" : "Weekly —";
          indicator.dataset.state = "unavailable";
          indicator.setAttribute("aria-label", state.loading
            ? "Loading weekly usage"
            : "Weekly usage is unavailable");
          indicator.title = state.loading
            ? "Loading weekly usage…"
            : "Weekly usage is unavailable";
          return;
        }

        const remaining = Math.round(clampPercent(100 - usedPercent));
        indicator.textContent = `Weekly ${remaining}%`;
        indicator.dataset.state = remaining <= 20 ? "critical" : remaining <= 50 ? "warning" : "healthy";
        indicator.setAttribute("aria-label", `Weekly usage: ${remaining}% remaining`);
        indicator.title = `Weekly limit: ${remaining}% remaining${resetLabel(state.weeklyWindow)}`;
      };

      const createIndicator = () => {
        const indicator = document.createElement("span");
        indicator.setAttribute(INDICATOR_ATTRIBUTE, "");
        indicator.setAttribute("role", "status");
        indicator.setAttribute("aria-live", "polite");
        indicator.setAttribute("aria-atomic", "true");
        state.indicator = indicator;
        render();
        return indicator;
      };

      const findComposer = () => [...document.querySelectorAll(EDITOR_SELECTOR)]
        .findLast((editor) => !editor.closest("#bettercodex-client-root"));
      const findToolbarAnchor = (surface, editor) => {
        const buttons = [...surface.querySelectorAll("button")]
          .filter((button) => !editor.contains(button) && !button.closest("#bettercodex-client-root"));
        const dictationButton = buttons.find((button) => DICTATION_CONTROL_PATTERN.test([
          button.getAttribute("aria-label"),
          button.getAttribute("title")
        ].filter(Boolean).join(" ")));
        // Codex keeps the microphone immediately before the final send control.
        // Keep that positional fallback because accessible labels can vary by
        // dictation state, app version, and locale.
        return dictationButton ?? buttons.at(-2) ?? buttons.at(-1) ?? null;
      };

      const sync = () => {
        state.scheduled = false;
        if (state.stopped) return;
        const editor = findComposer();
        const surface = editor?.closest(SURFACE_SELECTOR);
        if (!editor || !surface) return;
        const anchor = findToolbarAnchor(surface, editor);
        if (!anchor?.parentElement) return;
        const indicator = state.indicator ?? createIndicator();
        if (indicator.parentElement !== anchor.parentElement || indicator.nextSibling !== anchor) {
          anchor.parentElement.insertBefore(indicator, anchor);
        }
      };

      const scheduleSync = () => {
        if (state.scheduled || state.stopped) return;
        state.scheduled = true;
        queueMicrotask(sync);
      };

      const finishRequest = () => {
        if (state.requestTimeout != null) clearTimeout(state.requestTimeout);
        state.requestTimeout = null;
        state.requestId = null;
      };

      const markRequestUnavailable = (requestId) => {
        if (state.stopped || state.requestId !== requestId) return;
        finishRequest();
        state.loading = false;
        render();
      };

      const handleHostMessage = (event) => {
        const message = event.data;
        if (!message || typeof message !== "object"
          || message.type !== "fetch-response"
          || message.requestId !== state.requestId) return;

        finishRequest();
        if (message.responseType !== "success" || message.status < 200 || message.status >= 300) {
          state.loading = false;
          render();
          return;
        }

        try {
          const usage = typeof message.bodyJsonString === "string"
            ? JSON.parse(message.bodyJsonString)
            : message.body;
          state.weeklyWindow = weeklyWindowFrom(usage);
        } catch (_) {
          state.weeklyWindow = null;
        }
        state.loading = false;
        render();
      };

      const requestUsage = () => {
        const bridge = globalThis.electronBridge;
        if (state.stopped || state.requestId != null || typeof bridge?.sendMessageFromView !== "function") {
          if (!state.stopped && state.requestId == null && !state.weeklyWindow) {
            state.loading = false;
            render();
          }
          return;
        }

        const requestId = globalThis.crypto?.randomUUID?.()
          ?? `bettercodex-weekly-limit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const headers = {
          "OAI-Language": document.documentElement.lang || navigator.language || "en",
          "X-OpenAI-Attach-Auth": "1",
          "X-OpenAI-Attach-Integrity-State": "1",
          originator: "Codex Desktop"
        };
        try {
          const appVersion = bridge.getSentryInitOptions?.()?.appVersion;
          if (typeof appVersion === "string" && appVersion.trim()) {
            headers["X-OpenAI-Codex-Client-Version"] = appVersion.trim();
          }
        } catch (_) {}

        state.requestId = requestId;
        state.loading = state.weeklyWindow == null;
        render();
        state.requestTimeout = setTimeout(() => markRequestUnavailable(requestId), REQUEST_TIMEOUT);
        Promise.resolve(bridge.sendMessageFromView({
          type: "fetch",
          requestId,
          method: "GET",
          url: "/wham/usage",
          headers
        })).catch(() => markRequestUnavailable(requestId));
      };

      document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`).forEach((node) => node.remove());
      document.querySelectorAll(`[${INDICATOR_ATTRIBUTE}]`).forEach((node) => node.remove());
      state.style = document.createElement("style");
      state.style.setAttribute(STYLE_ATTRIBUTE, "");
      state.style.textContent = `
        [${INDICATOR_ATTRIBUTE}] {
          --bettercodex-weekly-limit-color: light-dark(#39745b, #8bd8ae);
          align-items: center;
          background: color-mix(in srgb, var(--bettercodex-weekly-limit-color) 11%, transparent);
          border: 1px solid color-mix(in srgb, var(--bettercodex-weekly-limit-color) 24%, transparent);
          border-radius: 999px;
          color: var(--bettercodex-weekly-limit-color);
          display: inline-flex;
          flex: none;
          font: inherit;
          font-size: 11px;
          font-variant-numeric: tabular-nums;
          font-weight: 550;
          height: 24px;
          letter-spacing: 0.01em;
          line-height: 1;
          padding: 0 7px;
          white-space: nowrap;
        }

        [${INDICATOR_ATTRIBUTE}][data-state="warning"] {
          --bettercodex-weekly-limit-color: light-dark(#9a6700, #f4c15d);
        }

        [${INDICATOR_ATTRIBUTE}][data-state="critical"] {
          --bettercodex-weekly-limit-color: light-dark(#b42318, #ff9b93);
        }

        [${INDICATOR_ATTRIBUTE}][data-state="unavailable"] {
          --bettercodex-weekly-limit-color: light-dark(#687078, #a9b0b8);
        }
      `;
      (document.head || document.documentElement).append(state.style);

      state.observer = new MutationObserver(scheduleSync);
      state.observer.observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener("message", handleHostMessage);
      window.addEventListener("focus", requestUsage);
      document.addEventListener("visibilitychange", requestUsage);
      state.interval = setInterval(requestUsage, REFRESH_INTERVAL);
      sync();
      requestUsage();
      globalThis.__BETTERCODEX_WEEKLY_LIMIT_ACTIVE__ = true;

      cleanup = () => {
        if (state.stopped) return;
        state.stopped = true;
        state.observer?.disconnect();
        if (state.interval != null) clearInterval(state.interval);
        if (state.requestTimeout != null) clearTimeout(state.requestTimeout);
        window.removeEventListener("message", handleHostMessage);
        window.removeEventListener("focus", requestUsage);
        document.removeEventListener("visibilitychange", requestUsage);
        state.indicator?.remove();
        state.style?.remove();
        delete globalThis.__BETTERCODEX_WEEKLY_LIMIT_ACTIVE__;
      };
    },
    stop() {
      cleanup();
      cleanup = () => {};
    }
  });
})();
