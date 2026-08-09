import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { WebSocketServer, WebSocket } from "ws";

export interface GatewayHandle {
  close: (callback?: () => void) => void;
}

function isAllowedOrigin(origin?: string) {
  if (!origin || origin === "null") return true;
  try {
    const url = new URL(origin);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  } catch {
    return false;
  }
}

export function startGateway(): GatewayHandle {
  const host = process.env.BLACKBOX_GATEWAY_HOST ?? "127.0.0.1";
  const port = Number(process.env.BLACKBOX_GATEWAY_PORT ?? 8787);
  const codexBinary = process.env.CODEX_BIN ?? "codex";
  const children = new Set<ChildProcessWithoutNullStreams>();

  const server = createServer((request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ ok: true, service: "blackbox-gateway" }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
  });

  const webSockets = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/" || !isAllowedOrigin(request.headers.origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (client) => webSockets.emit("connection", client, request));
  });

  webSockets.on("connection", (client) => {
    client.send(JSON.stringify({ method: "_blackbox/ready", params: { cwd: process.cwd() } }));
    const codex = spawn(codexBinary, ["app-server", "--listen", "stdio://"], {
      cwd: process.cwd(), env: process.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    children.add(codex);

    const stdout = createInterface({ input: codex.stdout });
    stdout.on("line", (line) => {
      if (client.readyState === WebSocket.OPEN) client.send(line);
    });
    codex.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) console.error(`[codex] ${text}`);
    });
    client.on("message", (data, isBinary) => {
      if (isBinary || !codex.stdin.writable) return;
      const line = data.toString();
      try {
        JSON.parse(line);
        codex.stdin.write(`${line}\n`);
      } catch {
        client.send(JSON.stringify({ method: "_blackbox/error", params: { message: "Gateway accepts JSON messages only" } }));
      }
    });

    const closeChild = () => {
      stdout.close();
      if (!codex.killed) codex.kill();
      children.delete(codex);
    };
    client.on("close", closeChild);
    client.on("error", closeChild);
    codex.on("error", (error) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ method: "_blackbox/error", params: { message: `Could not start Codex: ${error.message}` } }));
        client.close(1011, "Codex app-server failed to start");
      }
    });
    codex.on("exit", (code, signal) => {
      children.delete(codex);
      if (client.readyState === WebSocket.OPEN) client.close(code === 0 ? 1000 : 1011, `Codex exited (${code ?? signal ?? "unknown"})`);
    });
  });

  server.on("error", (error) => console.error(`[gateway] ${error.message}`));
  server.listen(port, host, () => console.log(`Blackbox gateway listening on ws://${host}:${port}`));

  return {
    close(callback) {
      for (const child of children) if (!child.killed) child.kill();
      webSockets.close();
      server.close(callback);
    },
  };
}
