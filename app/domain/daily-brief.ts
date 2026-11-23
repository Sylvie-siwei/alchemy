import type { EvolutionEvent, LineageRelation, ObjectProjection, ProductObject } from "./model";
import { deriveAttentionItems, type AttentionItem } from "./attention.ts";

export interface DailyBriefData {
  scope: "owner" | "global";
  owner?: string;
  date: string;
  newFeedback: number;
  newDemands: number;
  completedRefinement: number;
  completedReview: number;
  stageChanges: { stage: "planning" | "implementation" | "validation"; count: number }[];
  overdue: ProductObject[];
  blocked: ProductObject[];
  pendingActions: { kind: "confirmation" | "review" | "validation"; count: number }[];
  hotTopics: { object: ProductObject; relatedFeedback: number }[];
  importantChanges: { object: ProductObject; summary: string }[];
  attentionItems: AttentionItem[];
}

export interface DailyBriefSection { title: string; items: string[] }
export interface DailyBrief { title: string; sections: DailyBriefSection[]; actionLabel: string; data: DailyBriefData }

const dateOnly = (value: string) => value.slice(0, 10);

export function generateDailyBriefData(input: { objects: ProductObject[]; projections: ObjectProjection[]; events: EvolutionEvent[]; lineage: LineageRelation[]; date: string; owner?: string }): DailyBriefData {
  const date = dateOnly(input.date);
  const previous = new Date(`${date}T00:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
  const activityDate = previous.toISOString().slice(0, 10);
  const objects = input.owner ? input.objects.filter((object) => object.owner === input.owner) : input.objects;
  const ids = new Set(objects.map((object) => object.id));
  const projections = input.projections.filter((projection) => ids.has(projection.objectId));
  const events = input.events.filter((event) => ids.has(event.objectId) && dateOnly(event.occurredAt) === activityDate);
  const objectFor = (id: string) => objects.find((object) => object.id === id);
  const stageCount = (stage: ObjectProjection["currentStage"]) => events.filter((event) => event.eventType === "stage_entered" && event.stage === stage).length;
  const newFeedback = objects.filter((object) => object.type === "signal" && dateOnly(object.createdAt) === activityDate).length;
  const newDemands = objects.filter((object) => object.type === "requirement" && dateOnly(object.createdAt) === activityDate).length;
  const blocked = objects.filter((object) => object.implementation?.status === "阻塞" || projections.some((projection) => projection.objectId === object.id && projection.currentStageStatus === "阻塞"));
  const pendingConfirmation = projections.filter((projection) => projection.currentStageStatus.includes("确认") || projection.currentStageStatus.includes("澄清")).length;
  const pendingReview = projections.filter((projection) => projection.currentStageStatus === "待评审").length;
  const pendingValidation = projections.filter((projection) => projection.currentStage === "validation" && projection.currentStageStatus !== "已完成").length;
  const changed = objects.filter((object) => dateOnly(object.updatedAt) === activityDate);
  const hotTopics = changed.map((object) => ({ object, relatedFeedback: input.lineage.filter((relation) => relation.targetObjectId === object.id && input.objects.find((candidate) => candidate.id === relation.sourceObjectId)?.type === "signal").length })).filter((topic) => topic.relatedFeedback > 1).sort((a, b) => b.relatedFeedback - a.relatedFeedback);
  return {
    scope: input.owner ? "owner" : "global", owner: input.owner, date,
    newFeedback, newDemands,
    completedRefinement: events.filter((event) => event.eventType === "lineage_created").length,
    completedReview: events.filter((event) => event.eventType === "review_recorded").length,
    stageChanges: (["planning", "implementation", "validation"] as const).map((stage) => ({ stage, count: stageCount(stage) })).filter((item) => item.count > 0),
    overdue: [], blocked,
    pendingActions: [{ kind: "confirmation", count: pendingConfirmation }, { kind: "review", count: pendingReview }, { kind: "validation", count: pendingValidation }].filter((item) => item.count > 0) as DailyBriefData["pendingActions"],
    hotTopics,
    importantChanges: changed.slice(0, 4).map((object) => ({ object, summary: objectFor(object.id)?.implementation?.status ? `当前状态：${objectFor(object.id)?.implementation?.status}` : "需求信息已更新" })),
    attentionItems: deriveAttentionItems({ objects, projections, events: input.events, asOf: date }),
  };
}

const stageLabels = { planning: "进入产品规划", implementation: "进入研发实现", validation: "进入交付验证" } as const;
const actionLabels = { confirmation: "待确认", review: "待评审", validation: "待验证" } as const;

export function composeDailyBrief(data: DailyBriefData): DailyBrief {
  const dateLabel = `${Number(data.date.slice(5, 7))}月${Number(data.date.slice(8, 10))}日`;
  const changes = [data.newFeedback && `新增反馈 ${data.newFeedback}`, data.newDemands && `新增需求 ${data.newDemands}`, data.completedRefinement && `完成提炼 ${data.completedRefinement}`, data.completedReview && `完成评审 ${data.completedReview}`, ...data.stageChanges.map((item) => `${stageLabels[item.stage]} ${item.count}`)].filter(Boolean) as string[];
  const attention = data.hotTopics.map((item) => `${item.object.title} · 关联反馈 ${item.relatedFeedback} 条`);
  const important = data.importantChanges.map((item) => `${item.object.title} · ${item.summary}`);
  const currentAttention = data.attentionItems.filter((item) => !item.resolved).slice(0, 6).map((item) => `${item.objectTitle} · ${item.label} · ${item.reason}${item.waitingFor ? ` · 等待${item.waitingFor}` : ""}`);
  const risks = [data.overdue.length && `${data.overdue.length} 项需求延期`, data.blocked.length && `${data.blocked.length} 项需求阻塞`].filter(Boolean) as string[];
  const pending = data.pendingActions.map((item) => `${actionLabels[item.kind]} ${item.count}`);
  const sections = data.scope === "owner"
    ? [{ title: "昨日变化", items: changes }, { title: "需要关注", items: currentAttention.length ? currentAttention : [...attention, ...important] }, { title: "今日待处理", items: [...pending, ...risks] }]
    : [{ title: "昨日变化", items: changes }, { title: "重点关注", items: currentAttention.length ? currentAttention : [...attention, ...important] }, { title: "风险", items: risks }, { title: "当前状态", items: pending }];
  return { title: `${data.scope === "owner" ? "我的日报" : "团队日报"} · ${dateLabel}`, sections: sections.filter((section) => section.items.length > 0), actionLabel: data.scope === "owner" ? "查看我的需求 →" : "查看团队总览 →", data };
}
