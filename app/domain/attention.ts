import { stageById, type LifecycleStage } from "./lifecycle.ts";
import type { EvolutionEvent, ObjectProjection, Priority, ProductObject } from "./model.ts";

export type AttentionType = "stalled" | "waiting_collaboration" | "unowned" | "blocked" | "stale_update" | "due_soon" | "high_priority_pending";

export interface AttentionItem {
  id: string;
  objectId: string;
  objectTitle: string;
  type: AttentionType;
  label: string;
  reason: string;
  stage: LifecycleStage;
  stageLabel: string;
  startedAt: string;
  durationDays: number;
  owner: string | null;
  waitingFor?: string;
  priority?: Priority | null;
  versionId?: string;
  resolved: boolean;
}

const thresholds: Partial<Record<LifecycleStage, number>> = { refinement: 3, planning: 3, implementation: 4, validation: 2 };
const dateOnly = (value: string) => value.slice(0, 10);
const daysBetween = (from: string, to: string) => Math.max(0, Math.floor((Date.parse(`${dateOnly(to)}T00:00:00Z`) - Date.parse(`${dateOnly(from)}T00:00:00Z`)) / 86400000));
const activeRequirement = (object: ProductObject) => object.type !== "signal" && !object.mergedIntoRequirementId && object.validation?.result !== "通过";

function stageStartedAt(object: ProductObject, projection: ObjectProjection, events: EvolutionEvent[]) {
  return events.filter((event) => event.objectId === object.id && event.stage === projection.currentStage && (event.eventType === "stage_entered" || event.eventType === "object_created")).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]?.occurredAt ?? object.updatedAt;
}

function waitingFor(blocker: string) {
  const match = blocker.match(/(?:等待|等|待)(产品|研发|管理|[^，。；]{2,10})(?:确认|处理|回复|补充)/);
  return match?.[1] ? `${match[1]}处理` : undefined;
}

export function deriveAttentionItems(input: { objects: ProductObject[]; projections: ObjectProjection[]; events: EvolutionEvent[]; asOf: string }): AttentionItem[] {
  const projectionOf = (id: string) => input.projections.find((projection) => projection.objectId === id);
  const items: AttentionItem[] = [];
  const add = (object: ProductObject, projection: ObjectProjection, type: AttentionType, label: string, reason: string, startedAt: string, wait?: string) => items.push({ id: `${object.id}:${type}`, objectId: object.id, objectTitle: object.title, type, label, reason, stage: projection.currentStage, stageLabel: stageById(projection.currentStage).label, startedAt, durationDays: daysBetween(startedAt, input.asOf), owner: object.owner && object.owner !== "待定" ? object.owner : null, waitingFor: wait, priority: object.priority, versionId: object.targetVersionId, resolved: false });

  input.objects.filter(activeRequirement).forEach((object) => {
    const projection = projectionOf(object.id); if (!projection) return;
    const stageStart = stageStartedAt(object, projection, input.events);
    const stageDays = daysBetween(stageStart, input.asOf);
    const blocker = object.implementation?.blocker?.trim();
    const wait = blocker ? waitingFor(blocker) : undefined;
    if (!object.owner || object.owner === "待定") add(object, projection, "unowned", "负责人为空", "尚未确认当前负责人", object.updatedAt);
    if (object.implementation?.status === "阻塞") {
      add(object, projection, "blocked", "阻塞", blocker || "研发实现处于阻塞状态", object.implementation.updatedAt, wait);
      if (wait) add(object, projection, "waiting_collaboration", "等待协作", blocker!, object.implementation.updatedAt, wait);
    }
    const threshold = thresholds[projection.currentStage];
    if (threshold && stageDays >= threshold) add(object, projection, "stalled", "超时停留", `在${stageById(projection.currentStage).label}停留超过 ${threshold} 天`, stageStart);
    const updateDays = daysBetween(object.implementation?.updatedAt ?? object.updatedAt, input.asOf);
    if ((projection.currentStage === "implementation" || projection.currentStage === "validation") && updateDays >= 2) add(object, projection, "stale_update", "长期未更新", `${updateDays} 天没有新的状态记录`, object.implementation?.updatedAt ?? object.updatedAt);
    if (object.implementation?.plannedEndAt) {
      const dueDays = daysBetween(input.asOf, object.implementation.plannedEndAt);
      if (dueDays <= 7 && object.implementation.status !== "已完成") add(object, projection, "due_soon", "临近交付", dueDays === 0 ? "计划今日交付" : `距计划交付 ${dueDays} 天`, input.asOf);
    }
    if ((object.priority === "P0" || object.priority === "P1") && object.implementation?.status === "待开发") add(object, projection, "high_priority_pending", "高优先级待实现", `${object.priority} 需求尚未开始实现`, object.implementation.updatedAt);
  });
  return items;
}

export function attentionFor(object: ProductObject, projection: ObjectProjection, items: AttentionItem[] = []) {
  return items.find((item) => item.objectId === object.id && !item.resolved) ?? (projection.currentStageStatus === "阻塞" ? { type: "blocked" as const, label: "阻塞", stage: projection.currentStage } : undefined);
}
