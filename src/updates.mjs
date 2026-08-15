import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const UPDATE_BINDING = "__BETTERCODEX_CHECK_FOR_UPDATES__";
const UPDATE_EVENT = "bettercodex:update-result";
const MAX_INSTALLER_SIZE = 256 * 1024 * 1024;
const MAX_CHECKSUM_SIZE = 16 * 1024;

export const AUTO_UPDATE_STORAGE_KEY = "bettercodex:autoupdate:v1";

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

export function compareVersions(left, right) {
  const parts = (value) => normalizeVersion(value).split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = parts(left);
  const rightParts = parts(right);
  for (let index = 0; index < 3; index += 1) {
    if ((leftParts[index] || 0) !== (rightParts[index] || 0)) return (leftParts[index] || 0) > (rightParts[index] || 0) ? 1 : -1;
  }
  return 0;
}

export function automaticUpdatesEnabled(preferences) {
  return preferences?.storage?.[AUTO_UPDATE_STORAGE_KEY] === "true";
}

function validateReleaseAsset(asset) {
  if (!asset || typeof asset.name !== "string" || typeof asset.browser_download_url !== "string") return null;
  const url = new URL(asset.browser_download_url);
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("GitHub returned an invalid release asset URL");
  return { name: asset.name, browser_download_url: url.href, size: Number(asset.size) || null };
}

export async function fetchLatestRelease(repositoryUrl, options = {}) {
  const repository = new URL(repositoryUrl);
  const [owner, repositoryName] = repository.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").split("/");
  if (repository.hostname !== "github.com" || !owner || !repositoryName) throw new Error("Unsupported repository URL");
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "BetterCodex" },
    signal: options.signal || AbortSignal.timeout(10_000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const release = await response.json();
  const tagName = String(release.tag_name || "");
  const releaseUrl = new URL(release.html_url || `${repository.origin}/${owner}/${repositoryName}/releases/latest`);
  if (!tagName || releaseUrl.protocol !== "https:" || releaseUrl.hostname !== "github.com") throw new Error("GitHub returned an invalid release");
  const assets = Array.isArray(release.assets) ? release.assets.map(validateReleaseAsset).filter(Boolean) : [];
  return { tag_name: tagName, html_url: releaseUrl.href, assets };
}

async function fetchAsset(asset, limit, options = {}) {
  if (asset.size && asset.size > limit) throw new Error(`${asset.name} is too large`);
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(asset.browser_download_url, {
    headers: { Accept: "application/octet-stream", "User-Agent": "BetterCodex" },
    redirect: "follow",
    signal: options.signal || AbortSignal.timeout(120_000)
  });
  if (!response.ok) throw new Error(`Could not download ${asset.name}: GitHub returned ${response.status}`);
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) throw new Error(`${asset.name} is too large`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > limit) throw new Error(`${asset.name} is too large`);
  return buffer;
}

function expectedReleaseAssets(release) {
  const version = normalizeVersion(release?.tag_name);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Latest release has an invalid version");
  const installerName = `bettercodex-${version}-windows-x64-setup.exe`;
  const find = (name) => release.assets?.find((asset) => asset.name.toLowerCase() === name.toLowerCase());
  const installer = find(installerName);
  const checksum = find(`${installerName}.sha256`);
  if (!installer || !checksum) throw new Error("Latest release does not include a checksum-verified Windows installer");
  return { version, installerName, installer, checksum };
}

export async function downloadAutomaticUpdate(release, destinationRoot, options = {}) {
  const { version, installerName, installer, checksum } = expectedReleaseAssets(release);
  const [installerBytes, checksumBytes] = await Promise.all([
    fetchAsset(installer, MAX_INSTALLER_SIZE, options),
    fetchAsset(checksum, MAX_CHECKSUM_SIZE, options)
  ]);
  const checksumText = checksumBytes.toString("utf8").trim();
  const checksumMatch = checksumText.match(/^([a-f\d]{64})\s+\*?(.+)$/i);
  if (!checksumMatch || checksumMatch[2].trim().toLowerCase() !== installerName.toLowerCase()) {
    throw new Error("The release checksum file is invalid");
  }
  const actualChecksum = createHash("sha256").update(installerBytes).digest("hex");
  if (actualChecksum !== checksumMatch[1].toLowerCase()) throw new Error("The downloaded installer failed SHA-256 verification");

  const versionRoot = join(destinationRoot, version);
  const installerPath = join(versionRoot, installerName);
  const temporaryPath = `${installerPath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(versionRoot, { recursive: true });
  try {
    await writeFile(temporaryPath, installerBytes, { mode: 0o600 });
    await rm(installerPath, { force: true });
    await rename(temporaryPath, installerPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  return { version, installerPath, checksum: actualChecksum };
}

export function launchAutomaticUpdate(installerPath, options = {}) {
  const spawnImpl = options.spawnImpl || spawn;
  const child = spawnImpl(installerPath, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS", "/AUTOMATICUPDATE=1"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref?.();
  return child;
}

export async function installAutomaticUpdate({ repositoryUrl, currentVersion, destinationRoot, ...options }) {
  const release = await fetchLatestRelease(repositoryUrl, options);
  if (!release) return { status: "up-to-date" };
  const version = normalizeVersion(release.tag_name);
  if (compareVersions(version, currentVersion) <= 0) return { status: "up-to-date", version };
  const downloaded = await downloadAutomaticUpdate(release, destinationRoot, options);
  launchAutomaticUpdate(downloaded.installerPath, options);
  return { status: "installing", ...downloaded };
}

export async function installUpdateBridge(connection, repositoryUrl, options = {}) {
  await connection.send("Runtime.addBinding", { name: UPDATE_BINDING });
  connection.on("Runtime.bindingCalled", ({ name, payload, executionContextId }) => {
    if (name !== UPDATE_BINDING) return;
    Promise.resolve().then(async () => {
      let result;
      try {
        const release = await fetchLatestRelease(repositoryUrl, options);
        result = { requestId: payload, release: release && { tag_name: release.tag_name, html_url: release.html_url } };
      } catch (error) {
        result = { requestId: payload, error: error instanceof Error ? error.message : "Could not check for updates" };
      }
      const evaluate = {
        expression: `globalThis.dispatchEvent(new CustomEvent(${JSON.stringify(UPDATE_EVENT)}, { detail: ${JSON.stringify(result)} }))`
      };
      if (Number.isInteger(executionContextId)) evaluate.contextId = executionContextId;
      await connection.send("Runtime.evaluate", evaluate);
    }).catch(() => {});
  });
}
