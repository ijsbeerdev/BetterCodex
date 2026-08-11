import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const PREFERENCES_BINDING = "__BETTERCODEX_SAVE_PREFERENCES__";
const STORAGE_KEY_PATTERN = /^bettercodex(?:[.:_-]|$)/i;
const MAX_STORAGE_KEYS = 100;
const MAX_STORAGE_VALUE_LENGTH = 4 * 1024 * 1024;
const MAX_TOTAL_LENGTH = 8 * 1024 * 1024;

export function normalizePreferences(value) {
  const storage = {};
  let totalLength = 0;
  const entries = Object.entries(value?.storage && typeof value.storage === "object" ? value.storage : {});
  for (const [key, storedValue] of entries.slice(0, MAX_STORAGE_KEYS)) {
    if (!STORAGE_KEY_PATTERN.test(key) || typeof storedValue !== "string" || storedValue.length > MAX_STORAGE_VALUE_LENGTH) continue;
    totalLength += key.length + storedValue.length;
    if (totalLength > MAX_TOTAL_LENGTH) break;
    storage[key] = storedValue;
  }
  return { version: 1, storage };
}

export async function loadPreferences(path) {
  try {
    const preferences = normalizePreferences(JSON.parse(await readFile(path, "utf8")));
    return { ...preferences, persisted: true };
  } catch (error) {
    if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    return { version: 1, storage: {}, persisted: false };
  }
}

export async function savePreferences(path, value) {
  const preferences = normalizePreferences(value);
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  return preferences;
}

export function createPreferencesStore(path) {
  let queue = Promise.resolve();
  return {
    path,
    load() {
      return queue.catch(() => {}).then(() => loadPreferences(path));
    },
    save(value) {
      queue = queue.catch(() => {}).then(() => savePreferences(path, value));
      return queue;
    }
  };
}

export async function installPreferencesBridge(connection, store, options = {}) {
  await connection.send("Runtime.addBinding", { name: PREFERENCES_BINDING });
  connection.on("Runtime.bindingCalled", ({ name, payload }) => {
    if (name !== PREFERENCES_BINDING) return;
    Promise.resolve().then(async () => {
      const preferences = await store.save(JSON.parse(payload));
      await options.onSaved?.(preferences);
    }).catch((error) => options.onError?.(error));
  });
}
