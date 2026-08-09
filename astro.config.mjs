import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { startGateway } from "./server/gateway.ts";

function blackboxGateway() {
  return {
    name: "blackbox-gateway",
    hooks: {
      "astro:server:setup": ({ server }) => {
        const gateway = startGateway();
        server.httpServer?.once("close", () => gateway.close());
      },
    },
  };
}

export default defineConfig({
  compressHTML: true,
  prefetch: true,
  integrations: [react(), blackboxGateway()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      target: "es2022",
      assetsInlineLimit: 4096,
    },
  },
});
