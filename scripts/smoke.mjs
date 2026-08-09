import WebSocket from "ws";

const socket = new WebSocket(process.env.PUBLIC_GATEWAY_URL ?? "ws://127.0.0.1:8787", {
  origin: "http://127.0.0.1:4321",
});

let nextId = 1;
const pending = new Map();

socket.on("message", (data) => {
  const message = JSON.parse(data.toString());
  if (message.id === undefined || message.method) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message ?? "Codex returned an error"));
  else request.resolve(message.result);
});

socket.on("close", (code, reason) => {
  const error = new Error(`Gateway closed (${code}${reason.length ? `: ${reason.toString()}` : ""})`);
  for (const request of pending.values()) request.reject(error);
  pending.clear();
});

function rpc(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ method, id, params }));
  });
}

function waitForOpen() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out connecting to the Blackbox gateway")), 15_000);
    socket.once("open", () => { clearTimeout(timer); resolve(); });
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

try {
  await waitForOpen();
  await rpc("initialize", { clientInfo: { name: "blackbox_smoke", title: "Blackbox smoke test", version: "0.1.0" } });
  socket.send(JSON.stringify({ method: "initialized", params: {} }));

  const modelResult = await rpc("model/list", {});
  const threads = [];
  let cursor = null;
  let page = 0;
  do {
    const result = await rpc("thread/list", {
      cursor,
      limit: 100,
      sortKey: "updated_at",
      sortDirection: "desc",
      sourceKinds: ["cli", "vscode", "appServer", "exec"],
    });
    threads.push(...(result?.data ?? []));
    cursor = result?.nextCursor ?? null;
    page += 1;
  } while (cursor && page < 50);

  const projects = new Set(threads.map((thread) => thread.cwd).filter(Boolean));
  console.log(`Codex handshake OK: ${modelResult?.data?.length ?? 0} models, ${threads.length} threads across ${projects.size} projects`);
  socket.close();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  socket.close();
  process.exitCode = 1;
}
