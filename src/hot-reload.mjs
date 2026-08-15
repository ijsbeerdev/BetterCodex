import { watch } from "node:fs";

export async function reloadRenderers(sessions, expression, replace) {
  const results = await Promise.allSettled(
    [...sessions].map((session) => replace(session, expression))
  );
  return {
    reloaded: results.filter(({ status }) => status === "fulfilled").length,
    errors: results.filter(({ status }) => status === "rejected").map(({ reason }) => reason)
  };
}

export function watchFiles(root, onChange, options = {}) {
  const debounceMs = options.debounceMs ?? 180;
  const watchImpl = options.watchImpl ?? watch;
  const recursive = options.recursive ?? true;
  let timer;
  let latestChange = { eventType: "change", filename: "catalog" };
  const watcher = watchImpl(root, { recursive }, (eventType, filename) => {
    latestChange = { eventType, filename: filename ? String(filename) : "catalog" };
    clearTimeout(timer);
    timer = setTimeout(() => onChange(latestChange), debounceMs);
  });

  return {
    close() {
      clearTimeout(timer);
      watcher.close();
    }
  };
}
