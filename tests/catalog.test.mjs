import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAddons, validateManifest } from "../src/catalog.mjs";

test("loads a validated add-on catalog", async () => {
  const root = await mkdtemp(join(tmpdir(), "bettercodex-catalog-"));
  try {
    const addonRoot = join(root, "hello-world");
    await mkdir(addonRoot);
    await writeFile(join(addonRoot, "manifest.json"), JSON.stringify({
      id: "hello-world", name: "Hello world", version: "1.2.3", description: "A test add-on.",
      category: "tweak", tags: ["Workflow", "Productivity"], screenshot: "screenshot.svg", enabledByDefault: true
    }));
    await writeFile(join(addonRoot, "index.js"), "BetterCodex.register({ id: 'hello-world' });");
    await writeFile(join(addonRoot, "screenshot.svg"), "<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const [addon] = await loadAddons(root);
    assert.equal(addon.manifest.id, "hello-world");
    assert.equal(addon.manifest.category, "tweak");
    assert.deepEqual(addon.manifest.tags, ["Workflow", "Productivity"]);
    assert.match(addon.screenshot, /^data:image\/svg\+xml;base64,/);
    assert.match(addon.source, /bettercodex-addon:\/\/hello-world/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects invalid or mismatched manifests", () => {
  assert.throws(() => validateManifest({ id: "Bad ID", name: "Bad", version: "1", description: "No" }), /kebab-case/);
  assert.throws(() => validateManifest({ id: "one", name: "One", version: "1", description: "No" }, "two"), /match folder/);
  assert.throws(() => validateManifest({ id: "one", name: "One", version: "1", description: "No", screenshot: "..\\bad.svg" }), /screenshot/);
  assert.equal(validateManifest({ id: "one", name: "One", version: "1", description: "No", category: "theme" }).category, "theme");
  assert.throws(() => validateManifest({ id: "one", name: "One", version: "1", description: "No", category: "skin" }), /category/);
  assert.throws(() => validateManifest({ id: "one", name: "One", version: "1", description: "No", tags: "workflow" }), /tags/);
  assert.throws(() => validateManifest({ id: "one", name: "One", version: "1", description: "No", tags: [] }), /tags/);
  assert.throws(() => validateManifest({ id: "one", name: "One", version: "1", description: "No", tags: ["Workflow", "workflow"] }), /unique/);
});
