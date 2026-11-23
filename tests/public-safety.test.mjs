import test from "node:test";
import assert from "node:assert/strict";
import { safeAttachmentUrl } from "../app/ui/attachment-presentation.ts";
import { objects } from "../app/data/mock.ts";
import { applyRefinement } from "../app/domain/refinement.ts";
import { readFile } from "node:fs/promises";

import { request, outboundCount } from "./worker-helper.mjs";

test("public demo performs no outbound fetch during analysis, import or disabled sending", async () => {
  const before = outboundCount();
  {
    const signals = objects.filter(object => ["sig-m01", "sig-m06"].includes(object.id));
    const analyzed = await request("/api/refinements/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signals }) });
    assert.equal(analyzed.status, 200);
    const result = await analyzed.json(); assert.equal(result.provider, "mock");
    assert.equal(result.plan.draftRequirements.length, 1);
    const candidate = { ...result.plan.draftRequirements[0], title: "人工确认的合成任务试跑" };
    const confirmed = applyRefinement(candidate, signals, "产品示例", "2026-08-13T12:00:00Z", { id: "public-flow", key: "REQ-PUBLIC" });
    assert.equal(confirmed.requirement.title, candidate.title); assert.equal(confirmed.lineage.length, 2);
    const imported = await request("/api/import/product-feedback", { method: "POST", body: JSON.stringify({ url: "https://example.com/ignored" }) });
    assert.equal(imported.status, 200); assert.equal((await imported.json()).mode, "synthetic");
    assert.equal((await request("/api/daily-brief/send", { method: "POST" })).status, 403);
    assert.equal(outboundCount(), before);
  }
});

test("remote, protocol-relative, script and arbitrary same-origin attachment URLs are never loaded", () => {
  for (const value of ["https://example.com/remote.png", "//example.com/image", "javascript:alert(1)", "/api/signals", "data:image/svg+xml;base64,PHN2Zz4="]) assert.equal(safeAttachmentUrl(value), "/demo-feedback.svg");
  assert.equal(safeAttachmentUrl("data:image/png;base64,dGVzdA=="), "data:image/png;base64,dGVzdA==");
});

test("public Provider selection contains only Mock implementations and ignores environment switches", async () => {
  for (const file of ["refinement-analysis", "standardization"]) {
    const source = await readFile(new URL("../app/server/" + file + "/index.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /process[.]env|fetch[(]|OpenAIProvider|CodexStandardizer/);
  }
});
