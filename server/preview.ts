import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { startGateway } from "./gateway.js";

const host = process.env.BLACKBOX_WEB_HOST ?? "127.0.0.1";
const port = Number(process.env.BLACKBOX_WEB_PORT ?? 4321);
const root = resolve(process.cwd(), "dist");
const gateway = startGateway();

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const web = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
    let target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      if ((await stat(target)).isDirectory()) target = resolve(target, "index.html");
    } catch {
      target = resolve(root, "index.html");
    }

    const body = await readFile(target);
    response.writeHead(200, {
      "content-type": contentTypes[extname(target)] ?? "application/octet-stream",
      "cache-control": target.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Internal server error");
  }
});

function shutdown() {
  gateway.close();
  web.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

web.listen(port, host, () => {
  console.log(`Blackbox ready at http://${host}:${port}`);
});
