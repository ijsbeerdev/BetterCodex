import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPreferencesStore,
  installPreferencesBridge,
  loadPreferences,
  normalizePreferences
} from "../src/preferences.mjs";

test("normalizes BetterCodex-owned preference storage", () => {
  assert.deepEqual(normalizePreferences({
    storage: {
      "bettercodex:addons:v1": "{\"theme\":true}",
      "bettercodex.project-kanban.v1": "{\"cards\":[]}",
      unrelated: "discard me",
      "bettercodex:invalid": 42
    }
  }), {
    version: 1,
    storage: {
      "bettercodex:addons:v1": "{\"theme\":true}",
      "bettercodex.project-kanban.v1": "{\"cards\":[]}"
    }
  });
});

test("persists preferences atomically outside the runtime", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bettercodex-preferences-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "profile", "preferences.json");
  const store = createPreferencesStore(path);

  assert.equal((await store.load()).persisted, false);
  await store.save({ storage: { "bettercodex:addons:v1": "{\"cli-theme\":true}" } });
  await store.save({ storage: { "bettercodex:addons:v1": "{\"cli-theme\":false}" } });

  assert.deepEqual(await loadPreferences(path), {
    version: 1,
    storage: { "bettercodex:addons:v1": "{\"cli-theme\":false}" },
    persisted: true
  });
  assert.match(await readFile(path, "utf8"), /cli-theme/);
});

test("bridges renderer preference snapshots to the profile store", async () => {
  let handler;
  let saved;
  let refreshed = false;
  const connection = {
    async send(method, params) {
      assert.equal(method, "Runtime.addBinding");
      assert.equal(params.name, "__BETTERCODEX_SAVE_PREFERENCES__");
    },
    on(method, listener) {
      assert.equal(method, "Runtime.bindingCalled");
      handler = listener;
    }
  };
  const store = {
    async save(value) {
      saved = value;
      return normalizePreferences(value);
    }
  };
  await installPreferencesBridge(connection, store, { onSaved() { refreshed = true; } });
  handler({
    name: "__BETTERCODEX_SAVE_PREFERENCES__",
    payload: JSON.stringify({ storage: { "bettercodex:addons:v1": "{}" } })
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(saved, { storage: { "bettercodex:addons:v1": "{}" } });
  assert.equal(refreshed, true);
});
