const UPDATE_BINDING = "__BETTERCODEX_CHECK_FOR_UPDATES__";
const UPDATE_EVENT = "bettercodex:update-result";

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
  return { tag_name: tagName, html_url: releaseUrl.href };
}

export async function installUpdateBridge(connection, repositoryUrl, options = {}) {
  await connection.send("Runtime.addBinding", { name: UPDATE_BINDING });
  connection.on("Runtime.bindingCalled", ({ name, payload, executionContextId }) => {
    if (name !== UPDATE_BINDING) return;
    Promise.resolve().then(async () => {
      let result;
      try {
        result = { requestId: payload, release: await fetchLatestRelease(repositoryUrl, options) };
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
