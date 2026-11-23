// Public-edition build wiring, authored from the installed plugin APIs.
import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig(async () => {
  // Set these before importing the Cloudflare plugin, which reads log settings at import time.
  const localPaths = { WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: ".wrangler/logs", MINIFLARE_REGISTRY_PATH: ".wrangler/registry" };
  for (const [key, value] of Object.entries(localPaths)) process.env[key] ??= value;
  const cloudflareModule = await import("@cloudflare/vite-plugin");
  return {
    server: { host: "127.0.0.1" },
    plugins: [vinext(), cloudflareModule.cloudflare({
      config: { main: "worker/index.ts", compatibility_date: "2026-11-17", compatibility_flags: ["nodejs_compat"] },
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    })],
  };
});
