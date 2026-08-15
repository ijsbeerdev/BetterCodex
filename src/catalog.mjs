import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATEGORY_DIRECTORIES = Object.freeze({
  addon: "addons",
  tweak: "tweaks",
  theme: "themes"
});
const SCREENSHOT_TYPES = new Map([
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

export function validateManifest(manifest, folderName = manifest?.id, expectedCategory) {
  if (!manifest || typeof manifest !== "object") throw new Error("Add-on manifest must be an object");
  if (!ID_PATTERN.test(manifest.id ?? "")) throw new Error("Add-on id must use kebab-case");
  if (folderName && manifest.id !== folderName) throw new Error(`Add-on id ${manifest.id} must match folder ${folderName}`);
  for (const field of ["name", "version", "description"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) throw new Error(`Add-on ${manifest.id} needs ${field}`);
  }
  if (manifest.creator !== undefined
    && (typeof manifest.creator !== "string" || !manifest.creator.trim() || manifest.creator.trim().length > 60)) {
    throw new Error(`Add-on ${manifest.id} creator must be a short, non-empty name`);
  }
  if (manifest.shareUrl !== undefined) {
    let shareUrl;
    try { shareUrl = new URL(manifest.shareUrl); } catch {}
    if (typeof manifest.shareUrl !== "string" || !shareUrl || !["http:", "https:"].includes(shareUrl.protocol)) {
      throw new Error(`Add-on ${manifest.id} shareUrl must be an HTTP or HTTPS URL`);
    }
  }
  if (manifest.category !== undefined && !["addon", "tweak", "theme"].includes(manifest.category)) {
    throw new Error(`Add-on ${manifest.id} category must be addon, tweak, or theme`);
  }
  if (expectedCategory && manifest.category !== expectedCategory) {
    throw new Error(`Add-on ${manifest.id} category must be ${expectedCategory} inside ${CATEGORY_DIRECTORIES[expectedCategory]}`);
  }
  if (manifest.enabledByDefault !== undefined && typeof manifest.enabledByDefault !== "boolean") {
    throw new Error(`Add-on ${manifest.id} enabledByDefault must be a boolean`);
  }
  if (manifest.tags !== undefined) {
    if (!Array.isArray(manifest.tags) || manifest.tags.length === 0 || manifest.tags.length > 6
      || manifest.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 24 || tag.includes("|"))) {
      throw new Error(`Add-on ${manifest.id} tags must be an array of 1 to 6 short labels`);
    }
    const normalizedTags = manifest.tags.map((tag) => tag.trim().toLocaleLowerCase());
    if (new Set(normalizedTags).size !== normalizedTags.length) {
      throw new Error(`Add-on ${manifest.id} tags must be unique`);
    }
  }
  if (manifest.screenshot !== undefined) {
    const extension = extname(manifest.screenshot).toLowerCase();
    if (typeof manifest.screenshot !== "string" || basename(manifest.screenshot) !== manifest.screenshot || !SCREENSHOT_TYPES.has(extension)) {
      throw new Error(`Add-on ${manifest.id} screenshot must be a local PNG, JPEG, WebP, or SVG filename`);
    }
  }
  return manifest;
}

async function loadCategory(root, category) {
  const entries = await readdir(root, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  return Promise.all(folders.map(async (folder) => {
    const entryRoot = join(root, folder);
    const manifest = validateManifest(JSON.parse(await readFile(join(entryRoot, "manifest.json"), "utf8")), folder, category);
    const source = await readFile(join(entryRoot, "index.js"), "utf8");
    let screenshot = null;
    if (manifest.screenshot) {
      const extension = extname(manifest.screenshot).toLowerCase();
      const image = await readFile(join(entryRoot, manifest.screenshot));
      screenshot = `data:${SCREENSHOT_TYPES.get(extension)};base64,${image.toString("base64")}`;
    }
    return { manifest, screenshot, source: `${source}\n//# sourceURL=bettercodex-addon://${manifest.id}/index.js` };
  }));
}

export async function loadCatalog(catalogRoots) {
  const groups = await Promise.all(Object.keys(CATEGORY_DIRECTORIES).map((category) => {
    const root = catalogRoots?.[category];
    if (typeof root !== "string" || !root) throw new Error(`Catalog needs a ${category} directory`);
    return loadCategory(root, category);
  }));
  return groups.flat().sort((left, right) => left.manifest.id.localeCompare(right.manifest.id));
}
