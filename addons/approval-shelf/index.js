let approvalShelfCleanup = () => {};

Blackbox.register({
  id: "approval-shelf",
  start() {
    approvalShelfCleanup();

    const SURFACE_SELECTOR = "[data-composer-radius-variant][data-composer-surface-variant]";
    const EDITOR_SELECTOR = "[data-codex-composer]";
    const APPROVAL_SELECTOR = "[data-codex-approval-surface]";
    const PRESERVED_ATTRIBUTE = "data-blackbox-preserved-composer";
    const state = {
      surface: null,
      editor: null,
      editorParent: null,
      editorNextSibling: null,
      scheduled: false,
      stopped: false
    };

    const findApproval = () => [...document.querySelectorAll(APPROVAL_SELECTOR)]
      .findLast((element) => !element.closest("#blackbox-client-root"));

    const rememberNativeComposer = (editor) => {
      const surface = editor?.closest(SURFACE_SELECTOR);
      if (!surface || surface.hasAttribute(PRESERVED_ATTRIBUTE)) return;
      state.surface = surface;
      state.editor = editor;
      state.editorParent = editor.parentElement;
      state.editorNextSibling = editor.nextSibling;
    };

    const restoreEditorToSurface = () => {
      if (!state.editor || state.editor.isConnected || !state.editorParent) return;
      if (state.editorNextSibling?.parentNode === state.editorParent) {
        state.editorParent.insertBefore(state.editor, state.editorNextSibling);
      } else {
        state.editorParent.append(state.editor);
      }
    };

    const removeStaleSurface = (currentEditor) => {
      const currentSurface = currentEditor?.closest(SURFACE_SELECTOR);
      if (!state.surface?.hasAttribute(PRESERVED_ATTRIBUTE) || currentSurface === state.surface) return;
      state.surface.remove();
      state.surface.removeAttribute(PRESERVED_ATTRIBUTE);
    };

    const sync = () => {
      state.scheduled = false;
      if (state.stopped) return;

      const approval = findApproval();
      const currentEditor = document.querySelector(`${EDITOR_SELECTOR}:not([${PRESERVED_ATTRIBUTE}] ${EDITOR_SELECTOR})`);
      if (approval) {
        if (currentEditor) rememberNativeComposer(currentEditor);
        if (!state.surface) return;
        restoreEditorToSurface();
        if (!state.surface.isConnected) {
          state.surface.setAttribute(PRESERVED_ATTRIBUTE, "");
          approval.after(state.surface);
        }
        return;
      }

      if (currentEditor) {
        removeStaleSurface(currentEditor);
        rememberNativeComposer(currentEditor);
      }
    };

    const scheduleSync = () => {
      if (state.scheduled || state.stopped) return;
      state.scheduled = true;
      queueMicrotask(sync);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    rememberNativeComposer(document.querySelector(EDITOR_SELECTOR));
    sync();
    globalThis.__BLACKBOX_APPROVAL_SHELF_ACTIVE__ = true;

    approvalShelfCleanup = () => {
      if (state.stopped) return;
      state.stopped = true;
      observer.disconnect();
      if (state.surface?.hasAttribute(PRESERVED_ATTRIBUTE)) state.surface.remove();
      state.surface?.removeAttribute(PRESERVED_ATTRIBUTE);
      delete globalThis.__BLACKBOX_APPROVAL_SHELF_ACTIVE__;
    };
  },
  stop() {
    approvalShelfCleanup();
    approvalShelfCleanup = () => {};
  }
});
