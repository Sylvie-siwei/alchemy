import { Miniflare } from "miniflare";
import { after } from "node:test";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
const directory = fileURLToPath(new URL("../dist/server/", import.meta.url));
const modules = {};
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name.endsWith(".js")) modules[path.relative(directory, full).split(path.sep).join("/")] = { type: "esm", contents: fs.readFileSync(full, "utf8") };
  }
}
collect(directory);
let outboundCalls = 0;
const runtime = new Miniflare({ workers: [{
  config: { name: "alchemy-test", compatibilityDate: "2026-11-17", compatibilityFlags: ["nodejs_compat"],
    manifest: { mainModule: "index.js", modulesRoot: directory, modules },
    env: { ASSETS: { type: "fetcher", handler: () => new Response("Not found", { status: 404 }) } },
  },
  dev: { outboundService: { type: "fetcher", handler: () => { outboundCalls++; return new Response("Outbound disabled in tests", { status: 502 }); } } },
}] });
after(() => runtime.dispose());
export const outboundCount = () => outboundCalls;
export function request(path, init) { return runtime.dispatchFetch("http://localhost" + path, init); }
