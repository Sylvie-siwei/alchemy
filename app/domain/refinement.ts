import type { DecisionRecord, EvolutionEvent, LineageRelation, ObjectProjection, ProductObject, Signal, Transformation } from "./model";

export interface RequirementCandidate {
  id?: string;
  title: string;
  problem?: string | null;
  description: string;
  targetUser?: string | null;
  scenario?: string | null;
  expectedOutcome?: string | null;
  requirementType?: string | null;
  openQuestions?: string[];
  rationale?: string;
  sourceSignalIds: string[];
  createdBy: "human" | "ai";
  status: "pending_confirmation" | "applied";
  problemSnapshot?: { id: string; name: string; summary: string; sourceSignalIds: string[] };
}

export type RefinementSuggestionKind = "merge" | "split" | "duplicate" | "independent" | "unclear";
export interface RefinementProblem { id: string; name: string; summary: string; sourceSignalIds: string[]; disposition: "generate" | "existing" | "defer"; existingRequirementId?: string; confidence: number; }
export interface RefinementSuggestion { id: string; kind: RefinementSuggestionKind; signalIds: string[]; problemIds: string[]; title: string; reason: string; confidence: number; }
export interface RefinementPlan { problems: RefinementProblem[]; suggestions: RefinementSuggestion[]; draftRequirements: RequirementCandidate[]; }

export function applyRefinement(candidate: RequirementCandidate, signals: Signal[], actor: string, occurredAt: string, identity: { id: string; key: string }) {
  if (!candidate.title.trim() || !candidate.description.trim() || candidate.sourceSignalIds.length === 0) throw new Error("提炼候选缺少必要信息");
  const sourceIds = new Set(candidate.sourceSignalIds);
  const sources = signals.filter((signal) => sourceIds.has(signal.id));
  if (sources.length !== sourceIds.size) throw new Error("提炼来源不存在");
  if (sources.some((signal) => !["standardized", "not_required"].includes(signal.unified.standardizationStatus))) throw new Error("存在尚未完成标准化的 Signal");
  const cycleId = `cycle-${identity.id}-1`;
  const createdId = `event-${identity.id}-created`;
  const planningId = `event-${identity.id}-planning`;
  const requirement: ProductObject = {
    id: identity.id, key: identity.key, type: "requirement", title: candidate.title.trim(), summary: candidate.description.trim(), owner: null, createdAt: occurredAt, updatedAt: occurredAt,
    refinementResult: { title: candidate.title.trim(), problem: candidate.problem?.trim() || null, description: candidate.description.trim(), targetUser: candidate.targetUser?.trim() || null, scenario: candidate.scenario?.trim() || null, expectedOutcome: candidate.expectedOutcome?.trim() || null, type: candidate.requirementType?.trim() || null, openQuestions: candidate.openQuestions?.map((question) => question.trim()).filter(Boolean) ?? [], problemSnapshot: candidate.problemSnapshot },
  };
  const evolution: EvolutionEvent[] = [
    { id: createdId, objectId: requirement.id, sequence: 1, occurredAt, cycleId, stage: "refinement", stageOccurrence: 1, eventType: "object_created", label: "由 Signal 提炼生成 Requirement", reason: candidate.rationale, actor },
    { id: planningId, objectId: requirement.id, sequence: 2, occurredAt, cycleId, stage: "planning", stageOccurrence: 1, eventType: "stage_entered", label: "进入产品规划", reason: "提炼候选已由人工确认", actor },
  ];
  const transformationId = `transformation-refinement-${identity.id}`;
  const transformation: Transformation = { id: transformationId, type: "refinement", sourceObjectIds: sources.map((signal) => signal.id), targetObjectIds: [requirement.id], cycleId, actorId: actor, reason: candidate.rationale, createdAt: occurredAt };
  const lineage: LineageRelation[] = sources.map((signal, index) => ({ id: `lineage-${identity.id}-${index}`, transformationId, sourceObjectId: signal.id, targetObjectId: requirement.id, transformationType: "refinement", createdAt: occurredAt, reason: candidate.rationale }));
  const decision: DecisionRecord = { id: `decision-refinement-${identity.id}`, objectId: requirement.id, kind: "review", title: "确认提炼为 Requirement", rationale: candidate.rationale ?? "", decidedBy: actor, decidedAt: occurredAt };
  const updatedSignals = signals.map((signal) => sourceIds.has(signal.id) ? { ...signal, updatedAt: occurredAt, unified: { ...signal.unified, processingStatus: "已提炼", refinementStatus: "completed" as const, linkedRequirementIds: [...new Set([...signal.unified.linkedRequirementIds, requirement.id])], updatedAt: occurredAt } } : signal);
  const projection: ObjectProjection = { objectId: requirement.id, currentStage: "planning", currentStageStatus: "待评审", currentCycleId: cycleId, latestEventId: planningId };
  return { requirement, updatedSignals, projection, evolution, transformation, lineage, decision, candidate: { ...candidate, status: "applied" as const } };
}

export function applyRequirementRefinement(requirement: ProductObject, projection: ObjectProjection, candidate: Pick<RequirementCandidate, "title" | "description" | "rationale">, actor: string, occurredAt: string) {
  if (requirement.type !== "requirement" || !candidate.title.trim() || !candidate.description.trim()) throw new Error("再次提炼内容不完整");
  const timestamp = Date.parse(occurredAt);
  const event: EvolutionEvent = { id: `rerefine-${requirement.id}-${timestamp}`, objectId: requirement.id, sequence: 32, occurredAt, cycleId: projection.currentCycleId, stage: "planning", stageOccurrence: 1, eventType: "content_changed", label: "评审后再次提炼 Requirement", reason: candidate.rationale, actor };
  const transformation: Transformation = { id: `transformation-rerefine-${requirement.id}-${timestamp}`, type: "content_adjustment", sourceObjectIds: [requirement.id], targetObjectIds: [requirement.id], cycleId: projection.currentCycleId, actorId: actor, reason: candidate.rationale, createdAt: occurredAt };
  const decision: DecisionRecord = { id: `decision-rerefine-${requirement.id}-${timestamp}`, objectId: requirement.id, kind: "scope", title: "确认再次提炼", rationale: candidate.rationale || "根据评审产生的新信息重新整理 Requirement。", decidedBy: actor, decidedAt: occurredAt };
  return { requirement: { ...requirement, title: candidate.title.trim(), summary: candidate.description.trim(), updatedAt: occurredAt }, projection: { ...projection, currentStage: "planning" as const, currentStageStatus: "待评审", latestEventId: event.id }, event, transformation, decision };
}
