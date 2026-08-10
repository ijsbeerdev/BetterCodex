import { watch } from "node:fs";

export function watchAddons(addonsRoot, onChange, options = {}) {
  const debounceMs = options.debounceMs ?? 180;
  const watchImpl = options.watchImpl ?? watch;
  let timer;
  let latestChange = { eventType: "change", filename: "addons" };
  const watcher = watchImpl(addonsRoot, { recursive: true }, (eventType, filename) => {
    latestChange = { eventType, filename: filename ? String(filename) : "addons" };
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
