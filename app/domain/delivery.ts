import type { EvolutionEvent, ImplementationFacts, LineageRelation, ObjectProjection, ProductObject, Transformation, ValidationFacts, ValidationFollowUp, ValidationResult } from "./model";
import { createSignal } from "./signals.ts";

export function updateImplementation(object: ProductObject, projection: ObjectProjection, facts: Omit<ImplementationFacts, "updatedAt">, actor: string, occurredAt: string) {
  const event: EvolutionEvent = { id: `implementation-${object.id}-${Date.parse(occurredAt)}`, objectId: object.id, sequence: 40, occurredAt, cycleId: projection.currentCycleId, stage: "implementation", stageOccurrence: 1, eventType: "stage_status_changed", label: `研发进展更新：${facts.status}`, reason: [facts.description, facts.blocker && `阻塞：${facts.blocker}`].filter(Boolean).join("；"), actor };
  const transitionEvent: EvolutionEvent | undefined = facts.status === "已完成" ? { id: `validation-entered-${object.id}-${Date.parse(occurredAt)}`, objectId: object.id, sequence: 41, occurredAt, cycleId: projection.currentCycleId, stage: "validation", stageOccurrence: 1, eventType: "stage_entered", label: "实现完成，进入交付验证", reason: facts.description, actor } : undefined;
  return { object: { ...object, implementation: { ...facts, updatedAt: occurredAt }, validation: facts.status === "已完成" ? object.validation ?? { originalGoal: object.summary, implementationResult: facts.description, record: "", newFeedback: "" } : object.validation, updatedAt: occurredAt }, projection: facts.status === "已完成" ? { ...projection, currentStage: "validation" as const, currentStageStatus: "待验证", latestEventId: transitionEvent!.id } : { ...projection, currentStageStatus: facts.status, latestEventId: event.id }, event: transitionEvent ?? event };
}

export function completeValidation(object: ProductObject, projection: ObjectProjection, facts: Omit<ValidationFacts, "originalGoal" | "implementationResult" | "updatedAt"> & { result: ValidationResult; followUp: ValidationFollowUp }, confirmedFeedback: string[], actor: string, occurredAt: string) {
  const validation: ValidationFacts = { originalGoal: object.validation?.originalGoal || object.summary, implementationResult: object.validation?.implementationResult || object.implementation?.description || "尚未记录实现结果", ...facts, updatedAt: occurredAt };
  const event: EvolutionEvent = { id: `validation-${object.id}-${Date.parse(occurredAt)}`, objectId: object.id, sequence: 50, occurredAt, cycleId: projection.currentCycleId, stage: "validation", stageOccurrence: 1, eventType: "validation_recorded", label: `验证结果：${facts.result}`, reason: facts.record, actor };
  const signals = confirmedFeedback.map((content, index) => { const created = createSignal({ input: { sourceType: "user_feedback", sourceChannel: "交付验证", title: content.slice(0, 36), rawContent: content, submitter: "验证参与者", collectedAt: occurredAt }, actor }, { id: `sig-validation-${Date.parse(occurredAt)}-${index}`, key: `SIG-VALIDATION-${index + 1}`, now: occurredAt }); return { ...created, signal: { ...created.signal, unified: { ...created.signal.unified, originObjectId: object.id, originContext: `来自验证记录：${facts.record}` } } }; });
  const transformationId = `transformation-validation-signal-${object.id}-${Date.parse(occurredAt)}`;
  const transformations: Transformation[] = signals.length ? [{ id: transformationId, type: "new_signal", sourceObjectIds: [object.id], targetObjectIds: signals.map((created) => created.signal.id), cycleId: projection.currentCycleId, actorId: actor, reason: facts.record || "交付验证发现新的独立问题", createdAt: occurredAt }] : [];
  const lineage: LineageRelation[] = signals.map((created, index) => ({ id: `lineage-validation-signal-${object.id}-${Date.parse(occurredAt)}-${index}`, transformationId, sourceObjectId: object.id, targetObjectId: created.signal.id, transformationType: "new_signal", createdAt: occurredAt, reason: created.signal.unified.originContext }));
  const nextCycleId = incrementCycle(projection.currentCycleId);
  const nextProjection: ObjectProjection = facts.followUp === "next_implementation"
    ? { ...projection, currentStage: "implementation", currentStageStatus: "待开发", currentCycleId: nextCycleId, latestEventId: event.id }
    : facts.followUp === "next_planning"
      ? { ...projection, currentStage: "planning", currentStageStatus: "待评审", currentCycleId: nextCycleId, latestEventId: event.id }
      : { ...projection, currentStageStatus: facts.result === "通过" ? "已完成" : "验证已记录", latestEventId: event.id };
  return { object: { ...object, validation, targetVersionId: facts.followUp === "next_planning" ? undefined : object.targetVersionId, updatedAt: occurredAt }, projection: nextProjection, event, signals, transformations, lineage };
}

function incrementCycle(cycleId: string) {
  const match = cycleId.match(/^(.*-)(\d+)$/);
  return match ? `${match[1]}${Number(match[2]) + 1}` : `${cycleId}-next`;
}
