import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateManifest(manifest, folderName = manifest?.id) {
  if (!manifest || typeof manifest !== "object") throw new Error("Add-on manifest must be an object");
  if (!ID_PATTERN.test(manifest.id ?? "")) throw new Error("Add-on id must use kebab-case");
  if (folderName && manifest.id !== folderName) throw new Error(`Add-on id ${manifest.id} must match folder ${folderName}`);
  for (const field of ["name", "version", "description"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) throw new Error(`Add-on ${manifest.id} needs ${field}`);
  }
  if (manifest.enabledByDefault !== undefined && typeof manifest.enabledByDefault !== "boolean") {
    throw new Error(`Add-on ${manifest.id} enabledByDefault must be a boolean`);
  }
  return manifest;
}

export async function loadAddons(addonsRoot) {
  const entries = await readdir(addonsRoot, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  return Promise.all(folders.map(async (folder) => {
    const root = join(addonsRoot, folder);
    const manifest = validateManifest(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")), folder);
    const source = await readFile(join(root, "index.js"), "utf8");
    return { manifest, source: `${source}\n//# sourceURL=blackbox-addon://${manifest.id}/index.js` };
  }));
}
