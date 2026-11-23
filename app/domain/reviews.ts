import type { DecisionRecord, EvolutionEvent, LineageRelation, ObjectProjection, ProductObject, RequirementReviewDraft, ReviewChangeCandidate, Signal, Transformation } from "./model";
import { createSignal } from "./signals.ts";

export const reviewResultLabels = { approved: "通过", deferred: "暂缓", rejected: "拒绝", needs_info: "待补充" } as const;

export interface ApplyReviewCommand {
  drafts: RequirementReviewDraft[];
  candidates: ReviewChangeCandidate[];
  actor: string;
  occurredAt: string;
}

export interface AppliedReview {
  updatedObjects: ProductObject[];
  createdObjects: ProductObject[];
  projections: ObjectProjection[];
  events: EvolutionEvent[];
  decisions: DecisionRecord[];
  transformations: Transformation[];
  lineage: LineageRelation[];
}

export function applyReview(command: ApplyReviewCommand, objects: ProductObject[], projections: ObjectProjection[]): AppliedReview {
  const timestamp = Date.parse(command.occurredAt);
  const draftById = new Map(command.drafts.map((draft) => [draft.requirementId, draft]));
  const events: EvolutionEvent[] = [];
  const decisions: DecisionRecord[] = [];
  const createdObjects: ProductObject[] = [];
  const createdProjections: ObjectProjection[] = [];
  const createdLineage: LineageRelation[] = [];
  const transformations: Transformation[] = [];
  const structuralCycles = new Map<string, { cycleId: string; status: string; latestEventId: string }>();
  const currentCycleByObject = new Map(command.drafts.map((draft) => [draft.requirementId, projections.find((item) => item.objectId === draft.requirementId)?.currentCycleId ?? `cycle-${draft.requirementId}-1`] as const));
  const updatedObjects = objects.map((object) => {
    const draft = draftById.get(object.id);
    if (!draft) return object;
    const baseSequence = 20;
    const currentCycleId = currentCycleByObject.get(object.id)!;
    events.push({ id: `review-${object.id}-${timestamp}`, objectId: object.id, sequence: baseSequence, occurredAt: command.occurredAt, cycleId: currentCycleId, stage: "planning", stageOccurrence: 1, eventType: "review_recorded", label: `评审结果：${reviewResultLabels[draft.result]}`, reason: draft.notes || undefined, actor: command.actor });
    decisions.push({ id: `decision-review-${object.id}-${timestamp}`, objectId: object.id, kind: "review", title: `评审结论：${reviewResultLabels[draft.result]}`, rationale: draft.notes || "会议确认了优先级、负责人和评审结果。", decidedBy: command.actor, decidedAt: command.occurredAt });
    return { ...object, priority: draft.priority, owner: draft.owner || "待定", reviewResult: draft.result, targetVersionId: draft.result === "approved" ? undefined : object.targetVersionId, updatedAt: command.occurredAt };
  });
  const advanceStructuralSource = (objectId: string, status: string, label: string, index: number) => {
    if (structuralCycles.has(objectId)) return;
    const cycleId = projections.find((item) => item.objectId === objectId)?.currentCycleId ?? `cycle-${objectId}-1`;
    const latestEventId = `structure-source-${objectId}-${timestamp}-${index}`;
    structuralCycles.set(objectId, { cycleId, status, latestEventId });
    events.push({ id: latestEventId, objectId, sequence: 40 + index, occurredAt: command.occurredAt, cycleId, stage: "planning", stageOccurrence: 1, eventType: "stage_status_changed", label, actor: command.actor });
  };

  for (const [index, candidate] of command.candidates.entries()) {
    if (candidate.kind === "requirement_adjustment") {
      const targetIndex = updatedObjects.findIndex((object) => object.id === candidate.requirementId);
      if (targetIndex >= 0) updatedObjects[targetIndex] = { ...updatedObjects[targetIndex], title: candidate.title, summary: candidate.summary, updatedAt: command.occurredAt };
      events.push({ id: `adjust-${candidate.requirementId}-${timestamp}-${index}`, objectId: candidate.requirementId, sequence: 30 + index, occurredAt: command.occurredAt, cycleId: projections.find((item) => item.objectId === candidate.requirementId)?.currentCycleId ?? `cycle-${candidate.requirementId}-1`, stage: "planning", stageOccurrence: 1, eventType: "content_changed", label: "评审确认需求理解调整", reason: candidate.rationale, actor: command.actor });
      decisions.push({ id: `decision-adjust-${candidate.requirementId}-${timestamp}-${index}`, objectId: candidate.requirementId, kind: "scope", title: "确认需求内容调整", rationale: candidate.rationale, decidedBy: command.actor, decidedAt: command.occurredAt });
      transformations.push({ id: `transformation-adjust-${candidate.requirementId}-${timestamp}-${index}`, type: "content_adjustment", sourceObjectIds: [candidate.requirementId], targetObjectIds: [candidate.requirementId], cycleId: projections.find((item) => item.objectId === candidate.requirementId)?.currentCycleId, actorId: command.actor, reason: candidate.rationale, createdAt: command.occurredAt });
    }
    if (candidate.kind === "new_signal") {
      const created = createSignal({ input: { sourceType: "team_discovery", sourceChannel: "需求评审", title: candidate.title, rawContent: candidate.content, collectedAt: command.occurredAt, submitter: command.actor }, actor: command.actor }, { id: `sig-review-${timestamp}-${index}`, key: `SIG-REVIEW-${index + 1}`, now: command.occurredAt });
      const signal: Signal = { ...created.signal, rawData: { ...created.signal.rawData, content: candidate.content }, unified: { ...created.signal.unified, processingStatus: "评审中新发现", standardizationStatus: "pending", originObjectId: candidate.sourceRequirementId, originContext: candidate.rationale } };
      createdObjects.push(signal); createdProjections.push(created.projection); events.push(...created.evolution);
      const transformationId = `transformation-review-signal-${timestamp}-${index}`;
      transformations.push({ id: transformationId, type: "new_signal", sourceObjectIds: [candidate.sourceRequirementId], targetObjectIds: [signal.id], cycleId: projections.find((item) => item.objectId === candidate.sourceRequirementId)?.currentCycleId, actorId: command.actor, reason: candidate.rationale, createdAt: command.occurredAt });
      createdLineage.push({ id: `lineage-review-signal-${timestamp}-${index}`, transformationId, sourceObjectId: candidate.sourceRequirementId, targetObjectId: signal.id, transformationType: "new_signal", createdAt: command.occurredAt, reason: candidate.rationale });
    }
    if (candidate.kind === "merge") {
      if (candidate.requirementIds.length < 2) throw new Error("合并至少需要两个 Requirement");
      const mergeSources = candidate.requirementIds.map((id) => updatedObjects.find((object) => object.id === id));
      if (mergeSources.some((object) => !object || object.type !== "requirement")) throw new Error("合并来源 Requirement 不存在");
      if (candidate.requirementIds.some((id) => projections.find((projection) => projection.objectId === id)?.currentStage !== "planning")) throw new Error("V1 只允许合并处于产品规划阶段的 Requirement");
      const mergedId = `req-merged-${timestamp}-${index}`;
      const merged: ProductObject = { id: mergedId, key: `REQ-M-${index + 1}`, type: "requirement", title: candidate.title, summary: candidate.summary?.trim() || candidate.rationale, owner: "待定", createdAt: command.occurredAt, updatedAt: command.occurredAt };
      createdObjects.push(merged);
      const eventId = `merge-created-${timestamp}-${index}`;
      createdProjections.push({ objectId: mergedId, currentStage: "planning", currentStageStatus: "待评审", currentCycleId: `cycle-${mergedId}-1`, latestEventId: eventId });
      events.push({ id: eventId, objectId: mergedId, sequence: 1, occurredAt: command.occurredAt, cycleId: `cycle-${mergedId}-1`, stage: "planning", stageOccurrence: 1, eventType: "object_created", label: "评审确认合并并生成新 Requirement", reason: candidate.rationale, actor: command.actor });
      decisions.push({ id: `decision-merge-${timestamp}-${index}`, objectId: mergedId, kind: "merge", title: "确认需求合并", rationale: candidate.rationale, decidedBy: command.actor, decidedAt: command.occurredAt });
      const transformationId = `transformation-merge-${timestamp}-${index}`;
      transformations.push({ id: transformationId, type: "merge", sourceObjectIds: [...candidate.requirementIds], targetObjectIds: [mergedId], cycleId: projections.find((item) => item.objectId === candidate.requirementIds[0])?.currentCycleId, actorId: command.actor, reason: candidate.rationale, createdAt: command.occurredAt });
      candidate.requirementIds.forEach((sourceObjectId) => advanceStructuralSource(sourceObjectId, "已合并", `确认合并至 ${merged.key}`, index));
      candidate.requirementIds.forEach((sourceObjectId) => { const sourceIndex = updatedObjects.findIndex((object) => object.id === sourceObjectId); if (sourceIndex >= 0) updatedObjects[sourceIndex] = { ...updatedObjects[sourceIndex], mergedIntoRequirementId: mergedId, updatedAt: command.occurredAt }; });
      candidate.requirementIds.forEach((sourceObjectId, relationIndex) => createdLineage.push({ id: `lineage-merge-${timestamp}-${index}-${relationIndex}`, transformationId, sourceObjectId, targetObjectId: mergedId, transformationType: "merge", createdAt: command.occurredAt, reason: candidate.rationale }));
    }
    if (candidate.kind === "split") {
      if (projections.find((projection) => projection.objectId === candidate.sourceRequirementId)?.currentStage !== "planning") throw new Error("V1 只允许拆分处于产品规划阶段的 Requirement");
      advanceStructuralSource(candidate.sourceRequirementId, "已拆分", "确认拆分并形成新的 Requirement", index);
      const transformationId = `transformation-split-${timestamp}-${index}`;
      const targetObjectIds: string[] = [];
      [candidate.title, candidate.secondTitle].forEach((title, splitIndex) => { const splitId = `req-split-${timestamp}-${index}-${splitIndex}`; targetObjectIds.push(splitId); const eventId = `split-created-${timestamp}-${index}-${splitIndex}`; createdObjects.push({ id: splitId, key: `REQ-S-${index + 1}${splitIndex + 1}`, type: "requirement", title, summary: candidate.rationale, owner: "待定", createdAt: command.occurredAt, updatedAt: command.occurredAt }); createdProjections.push({ objectId: splitId, currentStage: "planning", currentStageStatus: "待评审", currentCycleId: `cycle-${splitId}-1`, latestEventId: eventId }); events.push({ id: eventId, objectId: splitId, sequence: 1, occurredAt: command.occurredAt, cycleId: `cycle-${splitId}-1`, stage: "planning", stageOccurrence: 1, eventType: "object_created", label: "评审确认拆分并生成新 Requirement", reason: candidate.rationale, actor: command.actor }); createdLineage.push({ id: `lineage-split-${timestamp}-${index}-${splitIndex}`, transformationId, sourceObjectId: candidate.sourceRequirementId, targetObjectId: splitId, transformationType: "split", createdAt: command.occurredAt, reason: candidate.rationale }); });
      transformations.push({ id: transformationId, type: "split", sourceObjectIds: [candidate.sourceRequirementId], targetObjectIds, cycleId: projections.find((item) => item.objectId === candidate.sourceRequirementId)?.currentCycleId, actorId: command.actor, reason: candidate.rationale, createdAt: command.occurredAt });
    }
  }
  const reviewedProjections = projections.map((projection) => {
    const draft = draftById.get(projection.objectId);
    const structural = structuralCycles.get(projection.objectId);
    if (structural) return { ...projection, currentStageStatus: structural.status, currentCycleId: structural.cycleId, latestEventId: structural.latestEventId };
    return draft ? { ...projection, currentStage: "planning" as const, currentStageStatus: draft.result === "approved" ? "待版本规划" : reviewResultLabels[draft.result], latestEventId: `review-${projection.objectId}-${timestamp}` } : projection;
  });
  return { updatedObjects, createdObjects, projections: [...reviewedProjections, ...createdProjections], events, decisions, transformations, lineage: createdLineage };
}
