import { lifecycleStages, stageIndex, type LifecycleStage } from "./lifecycle.ts";
import type { DecisionRecord, EvolutionEvent, LineageRelation, ObjectProjection, ProductObject } from "./model.ts";

const targetStatus: Record<LifecycleStage, string> = { intake: "已汇入", refinement: "待提炼", planning: "待评审", implementation: "待开发", validation: "待验证" };

export interface ReturnStepPreview {
  objectId: string; currentStage: LifecycleStage; currentStatus: string; previousOperation: string;
  targetStage?: LifecycleStage; targetStatus?: string; blocked: boolean; blockedReason?: string;
}

export function previewReturnToPreviousStep(objectId: string, projections: ObjectProjection[], events: EvolutionEvent[], lineage: LineageRelation[]): ReturnStepPreview {
  const projection = projections.find((item) => item.objectId === objectId);
  if (!projection) throw new Error("对象当前状态不存在");
  const history = events.filter((event) => event.objectId === objectId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.sequence - a.sequence);
  const latest = history.find((event) => event.id === projection.latestEventId) ?? history[0];
  const previousIndex = stageIndex(projection.currentStage) - 1;
  const base = { objectId, currentStage: projection.currentStage, currentStatus: projection.currentStageStatus, previousOperation: latest?.label ?? "最近一次有效处理" };
  if (previousIndex < 0) return { ...base, blocked: true, blockedReason: "当前对象已经位于第一阶段，无法返回上一步。" };
  const targetStage = lifecycleStages[previousIndex].id;
  if (lineage.some((relation) => relation.sourceObjectId === objectId)) return { ...base, targetStage, targetStatus: targetStatus[targetStage], blocked: true, blockedReason: "当前操作已经生成新的 Object 或建立 Lineage，存在后续影响，无法直接返回上一步。" };
  return { ...base, targetStage, targetStatus: targetStatus[targetStage], blocked: false };
}

export function returnToPreviousStep(command: { objectId: string; reason: string; actor: string; occurredAt: string }, object: ProductObject, projection: ObjectProjection, preview: ReturnStepPreview) {
  if (preview.objectId !== command.objectId || preview.blocked || !preview.targetStage || !preview.targetStatus) throw new Error(preview.blockedReason || "无法返回上一步");
  if (!command.reason.trim()) throw new Error("请填写返回原因");
  const cycleId = projection.currentCycleId;
  const timestamp = Date.parse(command.occurredAt);
  const label = lifecycleStages.find((stage) => stage.id === preview.targetStage)!.label;
  const event: EvolutionEvent = { id: `return-step-${object.id}-${timestamp}`, objectId: object.id, sequence: timestamp, occurredAt: command.occurredAt, cycleId, stage: preview.targetStage, stageOccurrence: 1, eventType: "stage_entered", label: `返回至${label}`, reason: command.reason.trim(), actor: command.actor };
  const decision: DecisionRecord = { id: `decision-return-step-${object.id}-${timestamp}`, objectId: object.id, kind: "stage", title: `确认返回至${label}`, rationale: command.reason.trim(), decidedBy: command.actor, decidedAt: command.occurredAt };
  return { object: { ...object, updatedAt: command.occurredAt }, projection: { ...projection, currentStage: preview.targetStage, currentStageStatus: preview.targetStatus, currentCycleId: cycleId, latestEventId: event.id }, event, decision };
}
