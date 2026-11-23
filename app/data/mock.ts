// Entire dataset is hand-authored synthetic demonstration material. Dates and progress are fictional.
import type { DecisionRecord, EvolutionEvent, LineageRelation, ObjectProjection, Person, Priority, ProductObject, ProductVersion, Signal, SignalSourceRawData, Transformation } from "../domain/model";

export const people: Person[] = [
  { id: "product-demo", name: "产品示例", position: "product" },
  { id: "engineering-demo", name: "研发示例", position: "engineering" },
  { id: "management-demo", name: "管理示例", position: "management" },
];

export const versions: ProductVersion[] = [
  { id: "version-1", sequence: 1, name: "基础闭环", goal: "以合成数据演示当前版本目标。", status: "completed", createdAt: "2026-07-20", plannedStartAt: "2026-07-20", plannedEndAt: "2026-08-02" },
  { id: "version-2", sequence: 2, name: "协作效率", goal: "以合成数据演示当前版本目标。", status: "open", createdAt: "2026-07-28", plannedStartAt: "2026-07-28", plannedEndAt: "2026-08-12" },
  { id: "version-3", sequence: 3, name: "检索体验", goal: "以合成数据演示当前版本目标。", status: "open", createdAt: "2026-08-08", plannedStartAt: "2026-08-08", plannedEndAt: "2026-08-25" },
  { id: "version-4", sequence: 4, name: "下一迭代", goal: "以合成数据演示当前版本目标。", status: "open", createdAt: "2026-08-12", plannedStartAt: "2026-08-26", plannedEndAt: "2026-09-12" },
];

function mockSignal(id: string, key: string, rawData: SignalSourceRawData, management: { owner: string; status: string; updatedAt: string; priority?: Priority; linkedRequirementIds?: string[]; standardizationStatus?: "pending" | "standardized" | "not_required" | "failed" }): Signal {
  const attachments = rawData.sourceType === "product_feedback" ? (rawData.screenshot ? [rawData.screenshot] : []) : rawData.attachments ?? [];
  const channel = rawData.sourceType === "user_feedback" ? rawData.channel : rawData.sourceType === "product_feedback" ? "产品内反馈" : rawData.environment;
  const sourceKind = rawData.sourceType === "user_feedback" ? "用户反馈" : rawData.sourceType === "product_feedback" ? "客户需求" : "团队想法";
  return {
    id, key, type: "signal", title: rawData.title || rawData.content.slice(0, 36), summary: rawData.content, priority: management.priority, owner: management.owner, sourceKind,
    createdAt: rawData.createdAt, updatedAt: management.updatedAt,
    rawData,
    unified: {
      sourceType: rawData.sourceType, sourceId: rawData.sourceType === "product_feedback" ? rawData.id : undefined, title: rawData.title || rawData.content.slice(0, 36), content: rawData.content,
      submitter: rawData.submitter, createdAt: rawData.createdAt, attachments, channel, priority: management.priority, owner: management.owner,
      processingStatus: management.status, standardizationStatus: management.standardizationStatus ?? (rawData.sourceType === "product_feedback" ? "not_required" : "standardized"),
      refinementStatus: management.linkedRequirementIds?.length ? "completed" : "pending_refinement",
      linkedRequirementIds: management.linkedRequirementIds ?? [], updatedAt: management.updatedAt,
    },
    standardized: rawData.sourceType === "product_feedback" || management.standardizationStatus === "pending" ? undefined : { title: rawData.title || rawData.content.slice(0, 36), problem: rawData.content, module: "待确认", confidence: 0.82 },
  };
}

export const objects: ProductObject[] = [
  mockSignal("sig-12", "SIG-012", { sourceType: "user_feedback", submitter: "合成用户 01", contact: "demo1@example.com", channel: "合成反馈沙盒", title: "实验空间创建回执", content: "合成脚本连续创建两个实验空间后，没有逐个回执；需要区分提交与就绪。", createdAt: "2026-08-03", attachments: [], recorder: "产品示例" }, { owner: "产品示例", status: "已提炼", updatedAt: "2026-08-11", linkedRequirementIds: ["req-23"], standardizationStatus: "standardized" }),
  mockSignal("sig-17", "SIG-017", { sourceType: "product_feedback", id: "PF-1048", submitter: "合成用户 02", email: "demo2@example.com", feedbackType: "功能建议", title: "实验模板预选", content: "虚构沙盒中的三个模板只显示编号，需要在选择前看到用途与资源摘要。", sourceStatus: "处理中", createdAt: "2026-08-04", screenshotUrl: "/demo-feedback.svg", screenshot: { id: "att-pf-1048", name: "合成模板示意.svg", url: "/demo-feedback.svg", mediaType: "image/svg+xml" } }, { owner: "研发示例", status: "已记录", updatedAt: "2026-08-10", linkedRequirementIds: ["req-23"] }),
  mockSignal("bug-04", "BUG-004", { sourceType: "product_feedback", id: "PF-1057", submitter: "合成用户 03", email: "demo3@example.com", feedbackType: "Bug", title: "实验空间失败提示", content: "合成弱网场景里一次空间创建失败，界面仍显示等待，需要明确重试条件。", sourceStatus: "新提交", createdAt: "2026-08-05" }, { owner: "研发示例", status: "需响应", updatedAt: "2026-08-11", priority: "P0", linkedRequirementIds: ["req-23"] }),
  mockSignal("sig-29", "SIG-029", { sourceType: "team_discovery", submitter: "合成用户 04", discoveryType: "体验问题", title: "批量标签结果", content: "给三张合成卡片打标签后，需要知道哪一项未成功。", environment: "虚构测试场景", createdAt: "2026-08-11", attachments: [] }, { owner: "研发示例", status: "已记录", updatedAt: "2026-08-11", priority: "P2" }),
  mockSignal("sig-21", "SIG-021", { sourceType: "team_discovery", submitter: "合成用户 05", discoveryType: "优化建议", title: "卡片检索摘要", content: "搜索合成实验卡片时，需要在结果中看到命中的短句。", environment: "虚构测试场景", createdAt: "2026-08-08", attachments: [] }, { owner: "研发示例", status: "已提炼", updatedAt: "2026-08-09", priority: "P2", linkedRequirementIds: ["req-31"] }),
  mockSignal("sig-26", "SIG-026", { sourceType: "user_feedback", submitter: "合成用户 06", channel: "合成反馈沙盒", title: "小屏筛选收起", content: "虚构小屏设备上打开筛选后，需要明显的收起与清除入口。", createdAt: "2026-08-10", attachments: [], recorder: "产品示例" }, { owner: "管理示例", status: "已提炼", updatedAt: "2026-08-11", priority: "P1", linkedRequirementIds: ["req-36"] }),
  mockSignal("sig-m01", "SIG-M01", { sourceType: "user_feedback", submitter: "合成用户 07", channel: "合成反馈沙盒", title: "沙盒任务单次运行", content: "合成任务原计划明日运行，演练人员希望先手动试跑一次。", createdAt: "2026-08-13T08:01:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:01:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m02", "SIG-M02", { sourceType: "user_feedback", submitter: "合成用户 08", channel: "合成反馈沙盒", title: "输出通道短名", content: "两条合成输出通道编号过长，需要可读短名帮助识别。", createdAt: "2026-08-13T08:02:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:02:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m03", "SIG-M03", { sourceType: "user_feedback", submitter: "合成用户 09", channel: "合成反馈沙盒", title: "任务启动回执", content: "虚构任务点击运行后没有立即变化，需要区分排队与执行。", createdAt: "2026-08-13T08:03:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:03:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m04", "SIG-M04", { sourceType: "user_feedback", submitter: "合成用户 10", channel: "合成反馈沙盒", title: "任务进度与失败定位", content: "合成任务包含三个步骤，需要看到当前步骤，并能定位模拟失败节点。", createdAt: "2026-08-13T08:04:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:04:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m05", "SIG-M05", { sourceType: "user_feedback", submitter: "合成用户 11", channel: "合成反馈沙盒", title: "实验项目的任务与权限隔离", content: "两个虚构项目共用沙盒，任务列表混杂，需要项目分组和访问边界。", createdAt: "2026-08-13T08:05:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:05:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m06", "SIG-M06", { sourceType: "user_feedback", submitter: "合成用户 12", channel: "合成反馈沙盒", title: "再次提出单次试跑", content: "另一位合成用户希望调试沙盒任务时无需修改计划时间。", createdAt: "2026-08-13T08:06:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:06:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m07", "SIG-M07", { sourceType: "user_feedback", submitter: "合成用户 13", channel: "合成反馈沙盒", title: "空间初始化超时", content: "合成初始化任务停留在等待，需要区分继续等待和明确失败。", createdAt: "2026-08-13T08:07:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:07:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m08", "SIG-M08", { sourceType: "user_feedback", submitter: "合成用户 14", channel: "合成反馈沙盒", title: "示例服务调用指引", content: "虚构模型服务仅显示编号，初次使用者需要看到参数说明与示例请求。", createdAt: "2026-08-13T08:08:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:08:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m09", "SIG-M09", { sourceType: "team_discovery", submitter: "合成用户 15", discoveryType: "体验问题", title: "模拟部署错误解释", content: "沙盒故意触发资源不足，需要将错误转为可理解的原因与后续动作。", environment: "虚构测试场景", createdAt: "2026-08-13T08:09:00.000Z", attachments: [] }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:09:00.000Z", standardizationStatus: "standardized" }),
  mockSignal("sig-m10", "SIG-M10", { sourceType: "user_feedback", submitter: "合成用户 16", channel: "合成反馈沙盒", title: "项目资源与预算摘要", content: "两个合成实验项目需要分别展示模拟资源用量和预算，并导出示例报表。", createdAt: "2026-08-13T08:10:00.000Z", attachments: [], recorder: "产品示例" }, { owner: "", status: "待提炼", updatedAt: "2026-08-13T08:10:00.000Z", standardizationStatus: "standardized" }),
  { id: "req-23", key: "REQ-023", type: "requirement", title: "实验空间创建回执优化", summary: "将合成创建请求、就绪状态和失败提示组织为连续的演示流程。", priority: "P1", owner: "研发示例", createdAt: "2026-08-05", updatedAt: "2026-08-11" },
  { id: "req-31", key: "REQ-031", type: "requirement", title: "实验卡片检索摘要", summary: "在合成检索结果中展示命中短句与对象类型。", priority: "P2", owner: "研发示例", reviewResult: "approved", targetVersionId: "version-3", createdAt: "2026-08-08", updatedAt: "2026-08-10", implementation: { status: "待开发", description: "", blocker: "", plannedStartAt: "2026-08-14", plannedEndAt: "2026-08-22", progress: 8, updatedAt: "2026-08-10" } },
  { id: "req-36", key: "REQ-036", type: "requirement", title: "小屏筛选收起与清除", summary: "为虚构小屏场景提供可发现的收起、清除与确认动作。", priority: "P1", owner: "研发示例", createdAt: "2026-08-10", updatedAt: "2026-08-11" },
  { id: "req-18", key: "REQ-018", type: "requirement", title: "合成成员列表导入预览", summary: "用虚构 CSV 行演示字段检查、重复项识别和结果预览。", priority: "P2", owner: "研发示例", reviewResult: "approved", targetVersionId: "version-2", createdAt: "2026-07-28", updatedAt: "2026-08-11", implementation: { status: "阻塞", description: "合成实现记录：用预设数据演示该能力的状态。", blocker: "合成阻塞：示例校验规则仍待演示评审确认。", plannedStartAt: "2026-08-01", plannedEndAt: "2026-08-14", progress: 62, updatedAt: "2026-08-11" } },
  { id: "req-09", key: "REQ-009", type: "requirement", title: "合成交付摘要", summary: "按虚构版本组织已完成项、模拟风险和验证记录。", priority: "P1", owner: "研发示例", reviewResult: "approved", targetVersionId: "version-1", createdAt: "2026-07-20", updatedAt: "2026-08-11", implementation: { status: "已完成", description: "合成实现记录：用预设数据演示该能力的状态。", blocker: "", plannedStartAt: "2026-07-22", plannedEndAt: "2026-08-02", progress: 100, updatedAt: "2026-08-10" }, validation: { originalGoal: "验证虚构场景中的状态与来源是否可追溯。", implementationResult: "合成结果：预置案例已进入验证阶段。", record: "", newFeedback: "" } },
  { id: "feat-08", key: "FEAT-008", type: "feature", title: "实验空间快捷创建", summary: "演示模板预选与初始化反馈的组合能力。", priority: "P1", owner: "研发示例", targetVersionId: "version-3", createdAt: "2026-08-09", updatedAt: "2026-08-11", implementation: { status: "开发中", description: "合成实现记录：用预设数据演示该能力的状态。", blocker: "", plannedStartAt: "2026-08-09", plannedEndAt: "2026-08-18", progress: 58, updatedAt: "2026-08-11" } },
  { id: "req-40", key: "REQ-040", type: "requirement", title: "沙盒首次配置指引", summary: "以合成空间创建和成员导入案例演示需求合并。", priority: "P1", owner: "研发示例", createdAt: "2026-08-12", updatedAt: "2026-08-12" },
  { id: "req-41", key: "REQ-041", type: "requirement", title: "小屏筛选入口", summary: "以合成设备场景演示独立的筛选入口问题。", priority: "P1", owner: "研发示例", createdAt: "2026-08-12", updatedAt: "2026-08-12" },
  { id: "req-42", key: "REQ-042", type: "requirement", title: "小屏筛选清除", summary: "以合成数据演示独立的筛选条件清除问题。", priority: "P1", owner: "研发示例", createdAt: "2026-08-12", updatedAt: "2026-08-12" },
];

export const projections: ObjectProjection[] = [
  { objectId: "sig-12", currentStage: "intake", currentStageStatus: "待澄清", currentCycleId: "cycle-s12-1", latestEventId: "e-s12-1" },
  { objectId: "sig-17", currentStage: "refinement", currentStageStatus: "已提炼", currentCycleId: "cycle-s17-1", latestEventId: "e-s17-1" },
  { objectId: "bug-04", currentStage: "refinement", currentStageStatus: "已提炼", currentCycleId: "cycle-b04-1", latestEventId: "e-b04-1" },
  { objectId: "sig-29", currentStage: "intake", currentStageStatus: "已记录", currentCycleId: "cycle-s29-1", latestEventId: "e-s29-1" },
  { objectId: "sig-21", currentStage: "refinement", currentStageStatus: "已提炼", currentCycleId: "cycle-s21-1", latestEventId: "e-s21-2" },
  { objectId: "sig-26", currentStage: "refinement", currentStageStatus: "已提炼", currentCycleId: "cycle-s26-1", latestEventId: "e-s26-2" },
  ...Array.from({ length: 10 }, (_, index) => { const number = String(index + 1).padStart(2, "0"); return { objectId: `sig-m${number}`, currentStage: "refinement" as const, currentStageStatus: "待提炼", currentCycleId: `cycle-sm${number}-1`, latestEventId: `e-sm${number}-1` }; }),
  { objectId: "req-23", currentStage: "planning", currentStageStatus: "待评审", currentCycleId: "cycle-r23-1", latestEventId: "e-r23-5" },
  { objectId: "req-31", currentStage: "implementation", currentStageStatus: "待开发", currentCycleId: "cycle-r31-1", latestEventId: "e-r31-4" },
  { objectId: "req-36", currentStage: "planning", currentStageStatus: "待评审", currentCycleId: "cycle-r36-1", latestEventId: "e-r36-3" },
  { objectId: "req-18", currentStage: "implementation", currentStageStatus: "阻塞", currentCycleId: "cycle-r18-1", latestEventId: "e-r18-6" },
  { objectId: "req-09", currentStage: "validation", currentStageStatus: "验收中", currentCycleId: "cycle-r09-1", latestEventId: "e-r09-7" },
  { objectId: "feat-08", currentStage: "implementation", currentStageStatus: "开发中", currentCycleId: "cycle-f08-1", latestEventId: "e-f08-3" },
  { objectId: "req-40", currentStage: "planning", currentStageStatus: "待评审", currentCycleId: "cycle-r40-1", latestEventId: "e-r40-1" },
  { objectId: "req-41", currentStage: "planning", currentStageStatus: "待评审", currentCycleId: "cycle-r41-1", latestEventId: "e-r41-1" },
  { objectId: "req-42", currentStage: "planning", currentStageStatus: "待评审", currentCycleId: "cycle-r42-1", latestEventId: "e-r42-1" },
];

export const lineage: LineageRelation[] = [
  { id: "l-1", transformationId: "t-refine-23", sourceObjectId: "sig-12", targetObjectId: "req-23", transformationType: "refinement", createdAt: "2026-08-06" },
  { id: "l-2", transformationId: "t-refine-23", sourceObjectId: "sig-17", targetObjectId: "req-23", transformationType: "refinement", createdAt: "2026-08-06" },
  { id: "l-3", transformationId: "t-refine-23", sourceObjectId: "bug-04", targetObjectId: "req-23", transformationType: "refinement", createdAt: "2026-08-06" },
  { id: "l-5", transformationId: "t-refine-31", sourceObjectId: "sig-21", targetObjectId: "req-31", transformationType: "refinement", createdAt: "2026-08-09" },
  { id: "l-6", transformationId: "t-refine-36", sourceObjectId: "sig-26", targetObjectId: "req-36", transformationType: "refinement", createdAt: "2026-08-11" },
  { id: "l-7", transformationId: "t-merge-40", sourceObjectId: "req-18", targetObjectId: "req-40", transformationType: "merge", createdAt: "2026-08-12" },
  { id: "l-8", transformationId: "t-merge-40", sourceObjectId: "req-23", targetObjectId: "req-40", transformationType: "merge", createdAt: "2026-08-12" },
  { id: "l-9", transformationId: "t-split-36", sourceObjectId: "req-36", targetObjectId: "req-41", transformationType: "split", createdAt: "2026-08-12" },
  { id: "l-10", transformationId: "t-split-36", sourceObjectId: "req-36", targetObjectId: "req-42", transformationType: "split", createdAt: "2026-08-12" },
];

export const transformations: Transformation[] = [
  { id: "t-refine-23", type: "refinement", sourceObjectIds: ["sig-12", "sig-17", "bug-04"], targetObjectIds: ["req-23"], cycleId: "cycle-r23-1", actorId: "product-demo", reason: "合成决策依据：根据演示案例追加一次可追溯变化。", createdAt: "2026-08-06" },
  { id: "t-refine-31", type: "refinement", sourceObjectIds: ["sig-21"], targetObjectIds: ["req-31"], cycleId: "cycle-r31-1", actorId: "product-demo", createdAt: "2026-08-09" },
  { id: "t-refine-36", type: "refinement", sourceObjectIds: ["sig-26"], targetObjectIds: ["req-36"], cycleId: "cycle-r36-1", actorId: "product-demo", createdAt: "2026-08-11" },
  { id: "t-merge-40", type: "merge", sourceObjectIds: ["req-18", "req-23"], targetObjectIds: ["req-40"], cycleId: "cycle-r18-1", actorId: "product-demo", reason: "合成决策依据：根据演示案例追加一次可追溯变化。", createdAt: "2026-08-12" },
  { id: "t-split-36", type: "split", sourceObjectIds: ["req-36"], targetObjectIds: ["req-41", "req-42"], cycleId: "cycle-r36-1", actorId: "product-demo", reason: "合成决策依据：根据演示案例追加一次可追溯变化。", createdAt: "2026-08-12" },
];

export const evolution: EvolutionEvent[] = [
  ...Array.from({ length: 10 }, (_, index) => { const number = String(index + 1).padStart(2, "0"); return { id: `e-sm${number}-1`, objectId: `sig-m${number}`, sequence: 1, occurredAt: `2026-08-13T08:${number}:00.000Z`, cycleId: `cycle-sm${number}-1`, stage: "refinement" as const, stageOccurrence: 1, eventType: "object_created" as const, label: "原始需求进入，等待提炼", actor: "产品示例" }; }),
  { id: "e-r23-1", objectId: "req-23", sequence: 1, occurredAt: "2026-08-05", cycleId: "cycle-r23-1", stage: "intake", stageOccurrence: 1, eventType: "object_created", label: "原始需求进入", actor: "产品示例" },
  { id: "e-r23-2", objectId: "req-23", sequence: 2, occurredAt: "2026-08-06", cycleId: "cycle-r23-1", stage: "refinement", stageOccurrence: 1, eventType: "stage_entered", label: "进入需求提炼", actor: "产品示例" },
  { id: "e-r23-3", objectId: "req-23", sequence: 3, occurredAt: "2026-08-06", cycleId: "cycle-r23-1", stage: "refinement", stageOccurrence: 1, eventType: "lineage_created", label: "合并 3 条来源", reason: "合成决策依据：根据演示案例追加一次可追溯变化。", actor: "产品示例" },
  { id: "e-r23-4", objectId: "req-23", sequence: 4, occurredAt: "2026-08-08", cycleId: "cycle-r23-1", stage: "planning", stageOccurrence: 1, eventType: "stage_entered", label: "进入产品规划", actor: "产品示例" },
  { id: "e-r23-5", objectId: "req-23", sequence: 5, occurredAt: "2026-08-09", cycleId: "cycle-r23-1", stage: "planning", stageOccurrence: 1, eventType: "review_recorded", label: "进入评审准备", reason: "合成决策依据：根据演示案例追加一次可追溯变化。", actor: "产品示例" },
];

export const decisions: DecisionRecord[] = [
  { id: "d-1", objectId: "req-23", kind: "merge", title: "合并为一个创建体验问题", rationale: "合成决策说明：用于展示来源、确认与演化关系。", decidedBy: "产品示例 · 研发示例", decidedAt: "2026-08-06" },
  { id: "d-2", objectId: "req-23", kind: "priority", title: "优先级设为 P1", rationale: "合成决策说明：用于展示来源、确认与演化关系。", decidedBy: "Product Review", decidedAt: "2026-08-08" },
];


export const projectionFor = (objectId: string) => projections.find((projection) => projection.objectId === objectId)!;
export const objectFor = (objectId: string) => objects.find((object) => object.id === objectId);
