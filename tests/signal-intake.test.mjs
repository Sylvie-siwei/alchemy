import assert from "node:assert/strict";
import test from "node:test";
import { evolution, lineage, objects, people, projections, transformations, versions } from "../app/data/mock.ts";
import { composeDailyBrief, generateDailyBriefData } from "../app/domain/daily-brief.ts";
import { dailyBriefSchedule, ownerNotificationTarget } from "../app/domain/notifications.ts";
import { actionableForPosition, implementationProgress, positionFor, projectForPosition, scopeByOwner, versionProgress } from "../app/ui/team-projection.ts";
import { applyRefinement, applyRequirementRefinement } from "../app/domain/refinement.ts";
import { applyReview } from "../app/domain/reviews.ts";
import { completeValidation, updateImplementation } from "../app/domain/delivery.ts";
import { previewReturnToPreviousStep, returnToPreviousStep } from "../app/domain/return-step.ts";
import { matchesSignalLibraryFilter, signalLibraryState } from "../app/domain/signal-library.ts";
import { isImageAttachment } from "../app/ui/attachment-presentation.ts";
import { eligibleRefinementSignals, normalizeRefinementSelection, toggleRefinementSelection, toggleVisibleRefinementSelection } from "../app/ui/refinement-selection.ts";
import { assignRequirementToVersion } from "../app/domain/versions.ts";
import { confirmSignalStandardization, createSignal } from "../app/domain/signals.ts";
import { mapProductFeedback } from "../app/server/product-feedback-adapter.ts";

import { request } from "./worker-helper.mjs";

test("generates deterministic owner and global daily briefs", () => {
  const ownerData = generateDailyBriefData({ objects, projections, events: evolution, lineage, date: "2026-08-13", owner: "研发示例" });
  assert.equal(ownerData.scope, "owner");
  assert.ok(ownerData.importantChanges.every((change) => change.object.owner === "研发示例"));
  const ownerBrief = composeDailyBrief(ownerData);
  assert.match(ownerBrief.title, /我的日报/);
  assert.ok(ownerBrief.sections.every((section) => section.items.length > 0));

  const globalBrief = composeDailyBrief(generateDailyBriefData({ objects, projections, events: evolution, lineage, date: "2026-08-13" }));
  assert.match(globalBrief.title, /团队日报/);
  assert.equal(globalBrief.actionLabel, "查看团队总览 →");
});

test("keeps notification delivery and scheduling as explicit boundaries", () => {
  assert.deepEqual(dailyBriefSchedule(), { feedbackSyncAt: "06:00", generateAt: "09:20", deliverAt: "09:30" });
  const target = ownerNotificationTarget({ ...people[0], notificationId: "demo-recipient" }, "preview");
  assert.equal(target.address, "demo-recipient");
  assert.equal(target.scope, "owner");
});

test("derives engineering and version progress from Implementation facts", () => {
  const completed = objects.find((object) => object.id === "req-09");
  const blocked = objects.find((object) => object.id === "req-18");
  assert.equal(implementationProgress(completed), 100);
  assert.equal(implementationProgress(blocked), 62);
  assert.equal(versionProgress("version-1", objects, projections), 100);
  assert.equal(versionProgress("version-2", objects, projections), 62);
  assert.equal("progress" in objects.find((object) => object.id === "req-23"), false);
});

test("renders the Alchemy demand workspace", async () => {
  const response = await request("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Alchemy — AI-Native Requirement Workspace/);
  assert.match(html, /当前视图/);
  assert.match(html, /总视图/);
  assert.match(html, /生命周期/);
  assert.match(html, /原始需求/);
  assert.match(html, /需求提炼/);
  assert.match(html, /产品规划/);
  assert.match(html, /研发实现/);
  assert.match(html, /交付验证/);
  assert.match(html, /切换当前视图/);
  assert.match(html, /产品示例/);
  assert.match(html, /研发示例/);
  assert.match(html, /管理示例/);
  assert.match(html, /全部负责人/);
});

test("public demo previews briefs and rejects external sending", async () => {
  const preview = await request("/api/daily-brief/send"); assert.equal(preview.status, 200);
  assert.equal((await preview.json()).mode, "synthetic_snapshot");
  const sent = await request("/api/daily-brief/send", { method: "POST" });
  assert.equal(sent.status, 403); assert.equal((await sent.json()).code, "disabled_in_public_demo");
});

test("captures raw input without standardization and appends creation history", async () => {
  const input = {
    sourceType: "team_discovery",
    sourceChannel: "产品测试",
    title: "",
    submitter: "Test User",
    rawContent: "创建 实验空间 时步骤太多，团队演示中经常有人不知道是否创建成功。",
    attachments: [{ id: "shot-1", name: "现场截图.png", mediaType: "image/png", url: "data:image/png;base64,dGVzdA==", source: "alchemy_upload" }],
    collectedAt: new Date().toISOString(),
  };
  const createResponse = await request("/api/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, actor: "Recorder" }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.signal.type, "signal");
  assert.equal(created.signal.rawData.content, input.rawContent);
  assert.equal(created.signal.unified.channel, "产品测试");
  assert.equal(created.signal.unified.sourceType, "team_discovery");
  assert.match(created.signal.unified.title, /创建 实验空间 时步骤太多/);
  assert.equal(created.signal.unified.submitter, "Test User");
  assert.equal(created.signal.rawData.submitter, "Test User");
  assert.equal(created.signal.owner, null);
  assert.equal(created.signal.unified.owner, null);
  assert.equal(created.signal.unified.attachments.length, 1);
  assert.equal(created.signal.unified.attachments[0].source, "alchemy_upload");
  assert.equal(created.signal.unified.attachments[0].url, input.attachments[0].url);
  assert.equal(created.signal.unified.processingStatus, "已汇入");
  assert.equal(created.signal.unified.standardizationStatus, "pending");
  assert.equal(created.signal.standardized, undefined);
  assert.equal(created.projection.currentStage, "intake");
  assert.equal(created.evolution.length, 1);
  assert.equal(created.evolution[0].eventType, "object_created");
  assert.equal(created.projection.latestEventId, created.evolution[0].id);

  const listResponse = await request("/api/signals");
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.equal(listed.entries[0].signal.id, created.signal.id);
});

test("keeps submitter independent from an unassigned owner", async () => {
  const collectedAt = new Date().toISOString();
  const response = await request("/api/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { sourceType: "user_feedback", submitter: "实际提交人", rawContent: "提交关系不能自动成为责任关系。", collectedAt }, actor: "记录操作人" }),
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.signal.rawData.submitter, "实际提交人");
  assert.equal(created.signal.rawData.recorder, "记录操作人");
  assert.equal(created.signal.unified.submitter, "实际提交人");
  assert.equal(created.signal.owner, null);
  assert.equal(created.signal.unified.owner, null);
});

test("classifies image attachments independently from their source", () => {
  assert.equal(isImageAttachment({ id: "manual", name: "截图.PNG", url: "data:image/png;base64,dGVzdA==", source: "alchemy_upload" }), true);
  assert.equal(isImageAttachment({ id: "external", name: "反馈截图", mediaType: "image/*", url: "/demo-feedback.svg", source: "external" }), true);
  assert.equal(isImageAttachment({ id: "future", name: "photo.jpeg", url: "/attachments/photo", source: "external" }), true);
  assert.equal(isImageAttachment({ id: "document", name: "说明.pdf", mediaType: "application/pdf", url: "/attachments/doc" }), false);
});

test("keeps refinement selection counts stable from list snapshot to modal initialization", () => {
  const sourceSignals = objects.filter((object) => object.type === "signal").slice(0, 4);
  const signals = sourceSignals.map((signal, index) => ({ ...signal, id: `selection-${index}`, unified: { ...signal.unified, standardizationStatus: "standardized", refinementStatus: "pending_refinement" } }));
  const eligible = eligibleRefinementSignals(signals);
  assert.equal(eligible.length, 4);

  const one = toggleRefinementSelection([], eligible[0].id);
  assert.equal(normalizeRefinementSelection(one, signals).length, 1);

  const many = toggleRefinementSelection(one, eligible[1].id);
  assert.equal(normalizeRefinementSelection(many, signals).length, 2);

  const all = toggleVisibleRefinementSelection([], signals);
  assert.equal(all.length, eligible.length);
  assert.equal(normalizeRefinementSelection(all, signals).length, eligible.length);

  const partial = toggleRefinementSelection(all, eligible[0].id);
  assert.equal(partial.length, eligible.length - 1);
  assert.equal(normalizeRefinementSelection(partial, signals).length, eligible.length - 1);

  const filtered = eligible.slice(0, 2);
  const selectionOutsideFilter = toggleVisibleRefinementSelection(all, filtered);
  assert.equal(selectionOutsideFilter.length, eligible.length - 2);
});

test("keeps ingestion method independent from Signal source", () => {
  const manual = createSignal({ input: { sourceType: "user_feedback", sourceChannel: "访谈", rawContent: "访谈中的用户原话", collectedAt: "2026-08-13T08:00:00.000Z" }, actor: "产品示例" }, { id: "sig-ingest-manual", key: "SIG-I-1", now: "2026-08-13T08:00:00.000Z" });
  const mapped = mapProductFeedback({ sourceType: "product_feedback", id: "feedback-88", submitter: "API 用户", email: "user@example.com", feedbackType: "功能建议", title: "API 中的用户反馈", content: "希望支持批量处理。", sourceStatus: "新提交", createdAt: "2026-08-13T09:00:00.000Z" });
  assert.equal(manual.signal.unified.sourceType, "user_feedback");
  assert.equal(mapped.unified.sourceType, "product_feedback");
  assert.equal("ingestionMethod" in manual.signal.unified, false);
  assert.equal("ingestionMethod" in mapped.unified, false);
  assert.equal(mapped.unified.sourceId, "feedback-88");
  assert.equal(mapped.unified.priority, null);
  assert.equal(mapped.unified.owner, null);
});

test("imports only fixed synthetic feedback and deduplicates by source ID", async () => {
  const first = await request("/api/import/product-feedback", { method: "POST", body: JSON.stringify({ url: "https://example.com/ignored", token: "ignored" }) });
  const payload = await first.json(); assert.equal(first.status, 200); assert.equal(payload.mode, "synthetic"); assert.equal(payload.result.added, 1);
  const second = await request("/api/import/product-feedback", { method: "POST" });
  const duplicate = await second.json(); assert.equal(duplicate.result.added, 0); assert.equal(duplicate.result.skipped, 1);
});

test("rejects invalid confirmed data without creating a Signal", async () => {
  const before = await (await request("/api/signals")).json();
  const response = await request("/api/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { sourceType: "user_feedback", rawContent: "", collectedAt: new Date().toISOString() },
      candidate: { title: "无效", problem: "无效" },
    }),
  });
  assert.equal(response.status, 400);
  const after = await (await request("/api/signals")).json();
  assert.equal(after.entries.length, before.entries.length);
});

test("maps structured Product Feedback directly to refinement without standardization", async () => {
  const raw = { sourceType: "product_feedback", id: "PF-2001", submitter: "用户甲", email: "user@example.com", feedbackType: "Bug", title: "导出失败", content: "点击导出后没有文件。", sourceStatus: "新提交", createdAt: "2026-08-13T08:00:00.000Z", screenshotUrl: "https://example.com/pf.png", screenshot: { id: "shot-pf", name: "错误截图.png", url: "https://example.com/pf.png", mediaType: "image/png" } };
  const mapped = mapProductFeedback(raw, "产品示例");
  assert.equal(mapped.rawData, raw);
  assert.equal(mapped.unified.standardizationStatus, "not_required");
  assert.equal(mapped.unified.refinementStatus, "pending_refinement");
  assert.equal(mapped.unified.processingStatus, "待提炼");

  const created = createSignal({ input: { sourceType: "product_feedback", title: raw.title, submitter: raw.submitter, rawContent: raw.content, collectedAt: raw.createdAt }, actor: "产品示例" }, { id: "sig-pf-2001", key: "SIG-PF-2001", now: raw.createdAt });
  assert.equal(created.signal.unified.standardizationStatus, "not_required");
  assert.equal(created.signal.standardized, undefined);
  assert.equal(created.projection.currentStage, "refinement");
  assert.equal(created.projection.currentStageStatus, "待提炼");

  const standardizeResponse = await request("/api/signals/standardize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { sourceType: "product_feedback", rawContent: raw.content, collectedAt: raw.createdAt } }) });
  assert.equal(standardizeResponse.status, 400);
  assert.match((await standardizeResponse.json()).error, /无需调用 Standardizer/);
});

test("standardizes User Feedback without changing its Raw source facts", () => {
  const created = createSignal({ input: { sourceType: "user_feedback", sourceChannel: "内测群", submitter: "用户乙", rawContent: "原话：这里不知道怎么继续。", collectedAt: "2026-08-13T09:00:00.000Z" }, actor: "产品示例" }, { id: "sig-user-1", key: "SIG-U-1", now: "2026-08-13T09:00:00.000Z" });
  const rawBefore = structuredClone(created.signal.rawData);
  const confirmed = confirmSignalStandardization(created.signal, created.projection, { title: "操作路径缺少继续提示", problem: "用户无法判断下一步操作。", scenario: "内测使用", module: "引导", confidence: 0.8 }, "产品示例", "2026-08-13T09:10:00.000Z");
  assert.deepEqual(confirmed.signal.rawData, rawBefore);
  assert.equal(confirmed.signal.standardized.title, "操作路径缺少继续提示");
  assert.equal(confirmed.signal.unified.standardizationStatus, "standardized");
  assert.equal(confirmed.signal.unified.processingStatus, "待提炼");
  assert.equal(confirmed.projection.currentStage, "refinement");
  assert.throws(() => confirmSignalStandardization({ ...created.signal, unified: { ...created.signal.unified, sourceType: "product_feedback", standardizationStatus: "not_required" } }, created.projection, { title: "无效", problem: "无效" }, "产品示例", "2026-08-13T09:20:00.000Z"), /无需标准化/);
  assert.throws(() => applyRefinement({ title: "不应生成", description: "尚未标准化", rationale: "无", sourceSignalIds: [created.signal.id], createdBy: "human", status: "pending_confirmation" }, [created.signal], "产品示例", "2026-08-13T09:05:00.000Z", { id: "req-invalid", key: "REQ-INVALID" }), /尚未完成标准化/);
});

test("creates the formal Requirement from the human-edited draft without mutating the AI original", () => {
  const source = objects.find((object) => object.type === "signal" && ["standardized", "not_required"].includes(object.unified.standardizationStatus));
  const originalSourceState = structuredClone(source);
  const aiOriginal = { id: "ai-original", title: "AI 标题", problem: "AI 问题", description: "AI 描述", targetUser: null, scenario: null, expectedOutcome: null, requirementType: null, openQuestions: ["AI 待确认问题"], rationale: "AI 建议", sourceSignalIds: [source.id], createdBy: "ai", status: "pending_confirmation" };
  const currentDraft = { ...aiOriginal, title: "人工确认后的标题", problem: "人工修订后的核心问题", description: "人工确认后的需求描述", openQuestions: [] };
  const result = applyRefinement(currentDraft, [source], "确认人", "2026-08-13T12:00:00.000Z", { id: "req-human-draft", key: "REQ-HUMAN" });
  assert.equal(aiOriginal.title, "AI 标题");
  assert.equal(aiOriginal.openQuestions.length, 1);
  assert.equal(result.requirement.title, "人工确认后的标题");
  assert.equal(result.requirement.refinementResult.problem, "人工修订后的核心问题");
  assert.equal(result.requirement.refinementResult.description, "人工确认后的需求描述");
  assert.deepEqual(result.requirement.refinementResult.openQuestions, []);
  assert.deepEqual(source, originalSourceState);
});

test("groups multiple Signals into editable Requirement candidates without forcing N to 1", async () => {
  const makeSignal = (id, module, title) => ({ id, key: id.toUpperCase(), type: "signal", title, summary: title, owner: "产品示例", createdAt: "2026-08-13", updatedAt: "2026-08-13", rawData: { sourceType: "team_discovery", content: title, submitter: "产品示例", createdAt: "2026-08-13" }, unified: { sourceType: "team_discovery", title, content: title, submitter: "产品示例", createdAt: "2026-08-13", attachments: [], priority: null, owner: "产品示例", processingStatus: "待提炼", standardizationStatus: "standardized", refinementStatus: "pending_refinement", linkedRequirementIds: [], updatedAt: "2026-08-13" }, standardized: { title, problem: title, module } });
  const signals = [makeSignal("sig-group-a", "实验空间", "创建入口难找"), makeSignal("sig-group-b", "权限", "成员权限不清楚")];
  const response = await request("/api/refinements/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signals }) });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.plan.draftRequirements.length, 2);
  assert.deepEqual(payload.plan.draftRequirements.flatMap((candidate) => candidate.sourceSignalIds).sort(), ["sig-group-a", "sig-group-b"]);
  assert.ok(payload.plan.draftRequirements.every((candidate) => candidate.description && candidate.status === "pending_confirmation"));
});

test("re-refines the same Requirement and preserves its Cycle and identity", () => {
  const requirement = objects.find((object) => object.id === "req-23");
  const projection = projections.find((item) => item.objectId === requirement.id);
  const result = applyRequirementRefinement(requirement, projection, { title: "实验空间 首次创建反馈优化", description: "基于评审新信息重新表述问题。", rationale: "评审明确了核心问题。" }, "产品示例", "2026-08-13T10:00:00.000Z");
  assert.equal(result.requirement.id, requirement.id);
  assert.equal(result.projection.currentCycleId, projection.currentCycleId);
  assert.equal(result.projection.currentStage, "planning");
  assert.equal(result.transformation.type, "content_adjustment");
  assert.deepEqual(result.transformation.sourceObjectIds, [requirement.id]);
  assert.deepEqual(result.transformation.targetObjectIds, [requirement.id]);
});

test("turns review notes into candidates without applying domain changes", async () => {
  const requirements = [
    { id: "req-a", key: "REQ-A", type: "requirement", title: "实验空间 环境说明", summary: "说明环境选项", owner: "待定", createdAt: "2026-08-01", updatedAt: "2026-08-01" },
    { id: "req-b", key: "REQ-B", type: "requirement", title: "实验空间 创建流程优化", summary: "简化创建流程", owner: "待定", createdAt: "2026-08-01", updatedAt: "2026-08-01" },
  ];
  const response = await request("/api/reviews/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirements, drafts: [{ requirementId: "req-a", priority: "P1", owner: "研发示例", result: "approved", notes: "REQ-B 与本需求是同一个问题，建议合并。另外发现真正问题是默认镜像启动速度太慢。" }] }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "mock");
  assert.ok(payload.candidates.some((candidate) => candidate.kind === "merge"));
  assert.ok(payload.candidates.some((candidate) => candidate.kind === "new_signal"));
});

test("extracts validation feedback as reviewable Signal candidates", async () => {
  const response = await request("/api/validations/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectTitle: "实验空间 创建流程优化", record: "环境选择时间有所下降。", newFeedback: "用户仍然不了解镜像区别。默认镜像启动速度较慢。" }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "mock");
  assert.equal(payload.candidates.length, 2);
  assert.match(payload.candidates[0].rationale, /交付验证/);
});

test("derives view projection from current person and keeps owner scope independent", () => {
  const fan = people.find((person) => person.id === "product-demo");
  const yan = people.find((person) => person.id === "engineering-demo");
  const lin = people.find((person) => person.id === "management-demo");
  assert.equal(positionFor(fan), "product");
  assert.equal(positionFor(yan), "engineering");
  assert.equal(positionFor(lin), "management");

  const yanScope = scopeByOwner(objects, "研发示例");
  assert.ok(yanScope.length > 0);
  assert.ok(yanScope.every((object) => object.owner === "研发示例"));
  assert.ok(projectForPosition(yanScope, projections, positionFor(fan)).every((object) => object.owner === "研发示例"));

  const dongsenScope = scopeByOwner(objects, "研发示例");
  const engineeringView = projectForPosition(dongsenScope, projections, positionFor(yan));
  assert.ok(engineeringView.length > 0);
  assert.ok(engineeringView.every((object) => object.owner === "研发示例" && object.type !== "signal"));
  assert.equal(positionFor(yan), "engineering");
  const productActions = actionableForPosition(objects, projections, "product");
  assert.ok(productActions.every((object) => object.type === "signal" && object.unified.refinementStatus !== "completed" || projections.find((projection) => projection.objectId === object.id)?.currentStage === "planning"));
  const engineeringActions = actionableForPosition(scopeByOwner(objects, "研发示例"), projections, "engineering");
  assert.ok(engineeringActions.every((object) => object.owner === "研发示例"));
});

test("keeps refinement, merge, and split lineage explicit and traceable", () => {
  assert.deepEqual([...new Set(lineage.map((relation) => relation.transformationType))].sort(), ["merge", "refinement", "split"]);
  assert.ok(lineage.every((relation) => relation.transformationId && relation.sourceObjectId && relation.targetObjectId));

  const refinement = lineage.filter((relation) => relation.transformationId === "t-refine-23");
  assert.equal(refinement.length, 3);
  assert.ok(refinement.every((relation) => relation.targetObjectId === "req-23"));

  const merge = lineage.filter((relation) => relation.transformationId === "t-merge-40");
  assert.deepEqual(merge.map((relation) => relation.sourceObjectId).sort(), ["req-18", "req-23"]);
  assert.ok(objects.some((object) => object.id === "req-18"));
  assert.ok(objects.some((object) => object.id === "req-23"));
  assert.ok(objects.some((object) => object.id === "req-40"));

  const split = lineage.filter((relation) => relation.transformationId === "t-split-36");
  assert.deepEqual(split.map((relation) => relation.targetObjectId).sort(), ["req-41", "req-42"]);
  assert.ok(objects.some((object) => object.id === "req-36"));
  assert.ok(lineage.every((relation) => transformations.some((transformation) => transformation.id === relation.transformationId)));
  const mergeTransformation = transformations.find((transformation) => transformation.id === "t-merge-40");
  assert.deepEqual(mergeTransformation.sourceObjectIds.sort(), ["req-18", "req-23"]);
  assert.deepEqual(mergeTransformation.targetObjectIds, ["req-40"]);
  const splitTransformation = transformations.find((transformation) => transformation.id === "t-split-36");
  assert.deepEqual(splitTransformation.targetObjectIds.sort(), ["req-41", "req-42"]);
});

test("keeps every Signal in the raw-demand object library after its work stage changes", () => {
  const signals = objects.filter((object) => object.type === "signal");
  const intakeQueue = signals.filter((signal) => projections.find((projection) => projection.objectId === signal.id)?.currentStage === "intake");
  const completed = signals.filter((signal) => matchesSignalLibraryFilter(signal, "completed"));
  assert.ok(signals.length > intakeQueue.length);
  assert.ok(completed.length > 0);
  assert.ok(completed.every((signal) => signalLibraryState(signal) === "completed"));
  assert.ok(completed.some((signal) => projections.find((projection) => projection.objectId === signal.id)?.currentStage === "refinement"));
  assert.ok(signals.every((signal) => matchesSignalLibraryFilter(signal, "all")));
});

test("uses one refinement status for every Signal surface", () => {
  const signals = objects.filter((object) => object.type === "signal");
  const states = signals.map((signal) => signalLibraryState(signal));
  assert.ok(states.every((state) => ["pending_standardization", "pending_refinement", "completed", "ended"].includes(state)));
  assert.equal(signalLibraryState(objects.find((object) => object.id === "sig-12")), "completed");
  assert.equal(signalLibraryState(objects.find((object) => object.id === "sig-29")), "pending_refinement");
  assert.ok(signals.every((signal) => matchesSignalLibraryFilter(signal, signalLibraryState(signal))));
});

test("connects Signal refinement, planning approval, implementation, and validation", () => {
  const source = objects.find((object) => object.id === "sig-29");
  const refined = applyRefinement({ title: "批量操作结果反馈", description: "用户需要确认批量操作成功与失败数量。", rationale: "该 Signal 描述了独立且明确的问题。", sourceSignalIds: [source.id] }, [source], "产品示例", "2026-08-12T10:00:00.000Z", { id: "req-chain", key: "REQ-CHAIN" });
  assert.equal(refined.projection.currentStage, "planning");
  assert.equal(refined.projection.currentStageStatus, "待评审");
  assert.equal(refined.lineage[0].transformationType, "refinement");
  assert.equal(refined.transformation.type, "refinement");
  assert.deepEqual(refined.transformation.sourceObjectIds, [source.id]);
  assert.deepEqual(refined.transformation.targetObjectIds, ["req-chain"]);
  assert.equal(refined.updatedSignals[0].rawData.content, source.rawData.content);
  assert.ok(refined.updatedSignals[0].unified.linkedRequirementIds.includes("req-chain"));

  const reviewed = applyReview({ drafts: [{ requirementId: "req-chain", priority: "P1", owner: "研发示例", result: "approved", notes: "确认进入研发。" }], candidates: [], actor: "产品示例", occurredAt: "2026-08-12T11:00:00.000Z" }, [refined.requirement], [refined.projection]);
  assert.equal(reviewed.projections[0].currentStage, "planning");
  assert.equal(reviewed.projections[0].currentStageStatus, "待版本规划");
  assert.equal(reviewed.projections[0].currentCycleId, "cycle-req-chain-1");
  assert.ok(!reviewed.events.some((event) => event.eventType === "cycle_started"));
  assert.deepEqual(reviewed.transformations, []);

  const planned = assignRequirementToVersion(reviewed.updatedObjects[0], reviewed.projections[0], "version-test-1", [{ id: "version-test-1", sequence: 1, status: "open", createdAt: "2026-08-12T11:30:00.000Z" }], reviewed.updatedObjects, "产品示例", "2026-08-12T11:30:00.000Z");
  assert.equal(planned.projection.currentStage, "implementation");
  assert.equal(planned.projection.currentStageStatus, "待开发");
  assert.equal(planned.requirement.targetVersionId, "version-test-1");
  assert.equal(planned.versions.length, 2);
  assert.equal(planned.versions[1].sequence, 2);
  assert.equal(planned.projection.currentCycleId, "cycle-req-chain-1");
  assert.deepEqual(planned.events.map((event) => event.eventType), ["version_assigned", "stage_entered"]);

  const implemented = updateImplementation(planned.requirement, planned.projection, { status: "已完成", description: "已完成批量结果提示。", blocker: "" }, "研发示例", "2026-08-12T12:00:00.000Z");
  assert.equal(implemented.projection.currentStage, "validation");
  assert.equal(implemented.projection.currentStageStatus, "待验证");
  assert.equal(implemented.event.eventType, "stage_entered");
});

test("maintains exactly one next empty version without coupling Version to Cycle", () => {
  const baseProjection = { objectId: "req-version-a", currentStage: "planning", currentStageStatus: "待版本规划", currentCycleId: "cycle-req-version-a-3", latestEventId: "review-a" };
  const requirementA = { id: "req-version-a", key: "REQ-A", type: "requirement", title: "A", summary: "A", owner: "产品示例", reviewResult: "approved", createdAt: "2026-08-13", updatedAt: "2026-08-13" };
  const requirementB = { ...requirementA, id: "req-version-b", key: "REQ-B", title: "B" };
  const initialVersions = [{ id: "version-seq-1", sequence: 1, status: "open", createdAt: "2026-08-13" }];
  const first = assignRequirementToVersion(requirementA, baseProjection, "version-seq-1", initialVersions, [requirementA, requirementB], "产品示例", "2026-08-13T10:00:00.000Z");
  assert.deepEqual(first.versions.map((version) => version.sequence), [1, 2]);
  assert.equal(first.projection.currentCycleId, "cycle-req-version-a-3");
  assert.equal(first.event.eventType, "version_assigned");

  const second = assignRequirementToVersion(requirementB, { ...baseProjection, objectId: requirementB.id }, "version-seq-1", first.versions, [first.requirement, requirementB], "产品示例", "2026-08-13T11:00:00.000Z");
  assert.equal(second.versions.length, 2);
  const moved = assignRequirementToVersion(first.requirement, first.projection, "version-2", second.versions, [first.requirement, second.requirement], "产品示例", "2026-08-13T12:00:00.000Z");
  assert.equal(moved.versions.length, 3);
  assert.equal(moved.event.eventType, "target_version_changed");
  assert.equal(moved.events.length, 1);
  assert.equal(moved.event.fromVersionId, "version-seq-1");
  assert.equal(moved.event.toVersionId, "version-2");
  assert.equal(moved.projection.currentCycleId, first.projection.currentCycleId);
  assert.equal(moved.requirement.id, requirementA.id);
});

test("creates Transformations only for confirmed structural business changes", () => {
  const requirements = objects.filter((object) => ["req-18", "req-23", "req-36"].includes(object.id));
  const relatedProjections = projections.filter((projection) => requirements.some((object) => object.id === projection.objectId));
  const result = applyReview({
    drafts: [],
    candidates: [
      { id: "candidate-adjust", kind: "requirement_adjustment", requirementId: "req-23", title: "实验空间 首次创建体验", summary: "重新定义首次创建的核心问题。", rationale: "评审确认核心问题发生变化。" },
      { id: "candidate-merge", kind: "merge", requirementIds: ["req-23", "req-36"], title: "首次配置体验", summary: "统一首次配置中的关键问题。", rationale: "两个需求共同指向首次配置。" },
      { id: "candidate-split", kind: "split", sourceRequirementId: "req-40", title: "配置入口", secondTitle: "配置撤销", rationale: "两个问题可独立验证。" },
      { id: "candidate-signal", kind: "new_signal", sourceRequirementId: "req-23", title: "镜像启动慢", content: "默认镜像启动性能需要改善。", rationale: "评审发现独立问题。" },
    ],
    actor: "产品示例",
    occurredAt: "2026-08-13T13:00:00.000Z",
  }, [...requirements, objects.find((object) => object.id === "req-40")], [...relatedProjections, projections.find((projection) => projection.objectId === "req-40")]);
  assert.deepEqual(result.transformations.map((item) => item.type).sort(), ["content_adjustment", "merge", "new_signal", "split"]);
  assert.equal(result.transformations.filter((item) => item.type === "merge").length, 1);
  assert.equal(result.lineage.filter((item) => item.transformationType === "merge").length, 2);
  assert.equal(result.transformations.filter((item) => item.type === "split").length, 1);
  assert.equal(result.lineage.filter((item) => item.transformationType === "split").length, 2);
  assert.equal(result.lineage.filter((item) => item.transformationType === "content_adjustment").length, 0);
  assert.equal(result.lineage.filter((item) => item.transformationType === "new_signal").length, 1);
  assert.ok(result.updatedObjects.filter((object) => ["req-23", "req-36"].includes(object.id)).every((object) => object.mergedIntoRequirementId));
});

test("AI review handling resolves low-risk note actions and leaves structural actions for confirmation", async () => {
  const requirement = objects.find((object) => object.id === "req-23");
  const response = await request("/api/reviews/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirements: objects.filter((object) => object.type === "requirement"), drafts: [{ requirementId: requirement.id, priority: "P2", owner: "", result: "needs_info", notes: "改 P1，研发示例负责。和 REQ-018 合并。" }] }) });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.drafts[0].priority, "P1");
  assert.equal(payload.drafts[0].owner, "研发示例");
  assert.ok(payload.candidates.some((candidate) => candidate.kind === "merge"));
});

test("returns through one domain command in the current cycle and blocks downstream lineage", () => {
  const object = objects.find((item) => item.id === "req-18");
  const projection = projections.find((item) => item.objectId === object.id);
  const preview = previewReturnToPreviousStep(object.id, projections, [], []);
  assert.equal(preview.targetStage, "planning");
  assert.equal(preview.targetStatus, "待评审");
  const returned = returnToPreviousStep({ objectId: object.id, reason: "实现前需要重新确认范围", actor: "产品示例", occurredAt: "2026-08-13T09:00:00.000Z" }, object, projection, preview);
  assert.equal(returned.projection.currentStage, "planning");
  assert.equal(returned.projection.currentCycleId, "cycle-r18-1");
  assert.equal(returned.event.eventType, "stage_entered");
  assert.match(returned.decision.rationale, /重新确认范围/);

  const blocked = previewReturnToPreviousStep("req-36", projections, [], lineage);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.blockedReason, /Lineage/);
});

test("starts a new cycle only when validation sends the same requirement into another round", () => {
  const object = objects.find((item) => item.id === "req-09");
  const projection = projections.find((item) => item.objectId === object.id);
  const completed = completeValidation(object, projection, { result: "通过", followUp: "complete", record: "目标已达到。", newFeedback: "" }, [], "产品示例", "2026-08-13T10:00:00.000Z");
  assert.equal(completed.projection.currentCycleId, projection.currentCycleId);
  assert.equal(completed.projection.currentStageStatus, "已完成");
  assert.deepEqual(completed.transformations, []);

  const implementationRound = completeValidation(object, projection, { result: "未通过", followUp: "next_implementation", record: "实现存在缺陷。", newFeedback: "" }, [], "产品示例", "2026-08-13T11:00:00.000Z");
  assert.equal(implementationRound.projection.currentCycleId, "cycle-r09-2");
  assert.equal(implementationRound.projection.currentStage, "implementation");

  const planningRound = completeValidation(object, projection, { result: "部分通过", followUp: "next_planning", record: "方案需要调整。", newFeedback: "" }, [], "产品示例", "2026-08-13T12:00:00.000Z");
  assert.equal(planningRound.projection.currentCycleId, "cycle-r09-2");
  assert.equal(planningRound.projection.currentStage, "planning");
  assert.equal(planningRound.object.targetVersionId, undefined);

  assert.ok(versions.some((version) => !objects.some((object) => object.type === "requirement" && object.targetVersionId === version.id)));

  const feedback = completeValidation(object, projection, { result: "通过", followUp: "new_signal", record: "发现独立性能问题。", newFeedback: "默认镜像启动慢。" }, ["默认镜像启动慢。"], "产品示例", "2026-08-13T13:00:00.000Z");
  assert.equal(feedback.transformations.length, 1);
  assert.equal(feedback.transformations[0].type, "new_signal");
  assert.equal(feedback.lineage.length, 1);
  assert.equal(feedback.lineage[0].sourceObjectId, object.id);
  assert.equal(feedback.lineage[0].targetObjectId, feedback.signals[0].signal.id);
  assert.equal(feedback.lineage[0].transformationId, feedback.transformations[0].id);
});
