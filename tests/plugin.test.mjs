import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRepository } from "../scripts/validate.mjs";

const testsRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(testsRoot);

test("Blackbox is a single native Codex plugin", () => {
  const { marketplace, plugin } = validateRepository(repoRoot);
  assert.equal(marketplace.plugins[0].policy.installation, "INSTALLED_BY_DEFAULT");
  assert.equal(plugin.interface.displayName, "Blackbox");
  assert.equal(plugin.interface.category, "Developer Tools");
});

test("the info skill reads canonical plugin metadata", () => {
  const skill = readFileSync(join(repoRoot, "plugins", "blackbox", "skills", "show-blackbox-info", "SKILL.md"), "utf8");
  assert.match(skill, /\.\.\/\.\.\/\.codex-plugin\/plugin\.json/);
  assert.match(skill, /repository/);
  assert.doesNotMatch(skill, /\[TODO:/);
});
