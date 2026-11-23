import type { EvolutionEvent, ObjectProjection, Signal, SignalInput, SignalSourceRawData, StandardizedSignal } from "./model";

export interface CreateSignalCommand {
  input: SignalInput;
  candidate?: StandardizedSignal;
  actor: string;
}

export interface CreatedSignal {
  signal: Signal;
  evolution: EvolutionEvent[];
  projection: ObjectProjection;
}

export function confirmSignalStandardization(signal: Signal, projection: ObjectProjection, candidate: StandardizedSignal, actor: string, occurredAt: string): { signal: Signal; projection: ObjectProjection; event: EvolutionEvent } {
  if (signal.unified.sourceType === "product_feedback" || signal.unified.standardizationStatus === "not_required") throw new Error("产品反馈已经结构化，无需标准化");
  const standardized = validateStandardizedSignal(candidate);
  const sequence = 2;
  const event: EvolutionEvent = {
    id: `event-${signal.id}-standardized-${Date.parse(occurredAt)}`,
    objectId: signal.id,
    sequence,
    occurredAt,
    cycleId: `cycle-${signal.id}-1`,
    stage: "refinement",
    stageOccurrence: 1,
    eventType: "stage_entered",
    label: "标准化结果已确认，进入需求提炼",
    actor: actor.trim() || "当前用户",
  };
  return {
    signal: { ...signal, title: standardized.title, summary: standardized.problem, updatedAt: occurredAt, standardized, unified: { ...signal.unified, title: standardized.title, content: standardized.problem, processingStatus: "待提炼", standardizationStatus: "standardized", updatedAt: occurredAt } },
    projection: { ...projection, currentStage: "refinement", currentStageStatus: "待提炼", latestEventId: event.id },
    event,
  };
}

export function validateSignalInput(input: SignalInput): SignalInput {
  if (!["product_feedback", "team_discovery", "user_feedback"].includes(input.sourceType)) {
    throw new Error("请选择有效的需求来源");
  }
  const rawContent = input.rawContent.trim();
  if (!rawContent) throw new Error("请输入原始内容");
  if (rawContent.length > 10_000) throw new Error("原始内容不能超过 10000 个字符");
  const collectedAt = new Date(input.collectedAt);
  if (Number.isNaN(collectedAt.getTime())) throw new Error("收集时间无效");
  return { ...input, title: input.title?.trim() || undefined, submitter: input.submitter?.trim() || undefined, sourceChannel: input.sourceChannel?.trim() || undefined, rawContent, collectedAt: collectedAt.toISOString() };
}

export function validateStandardizedSignal(candidate: StandardizedSignal): StandardizedSignal {
  const title = candidate.title.trim();
  const problem = candidate.problem.trim();
  if (!title) throw new Error("标题不能为空");
  if (!problem) throw new Error("问题描述不能为空");
  if (title.length > 120) throw new Error("标题不能超过 120 个字符");
  if (problem.length > 2000) throw new Error("问题描述不能超过 2000 个字符");
  const confidence = candidate.confidence;
  if (confidence !== undefined && (confidence < 0 || confidence > 1)) throw new Error("置信度必须在 0 到 1 之间");
  return {
    title,
    problem,
    scenario: candidate.scenario?.trim() || undefined,
    module: candidate.module?.trim() || undefined,
    confidence,
  };
}

export function createSignal(command: CreateSignalCommand, identity: { id: string; key: string; now: string }): CreatedSignal {
  const input = validateSignalInput(command.input);
  const standardized = command.candidate ? validateStandardizedSignal(command.candidate) : undefined;
  const generatedTitle = input.rawContent.split(/[。！？!?.\n]/).find(Boolean)?.trim().slice(0, 36) || "未命名需求";
  const title = input.title || standardized?.title || generatedTitle;
  const content = standardized?.problem || input.rawContent;
  const needsStandardization = input.sourceType !== "product_feedback" && !standardized;
  const cycleId = `cycle-${identity.id}-1`;
  const eventId = `event-${identity.id}-created`;
  const recorder = command.actor.trim() || "当前用户";
  const rawData: SignalSourceRawData = input.sourceType === "team_discovery" ? {
    sourceType: "team_discovery", submitter: input.submitter || "", discoveryType: "其他", title: input.title || "", content: input.rawContent, environment: input.sourceChannel, createdAt: input.collectedAt, attachments: input.attachments,
  } : input.sourceType === "user_feedback" ? {
    sourceType: "user_feedback", submitter: input.submitter || "", channel: input.sourceChannel || "其他", title: input.title || "", content: input.rawContent, createdAt: input.collectedAt, attachments: input.attachments, recorder,
  } : {
    sourceType: "product_feedback", id: identity.id, submitter: input.submitter || "", email: "", feedbackType: "其他", title, content: input.rawContent, sourceStatus: "已提交", createdAt: input.collectedAt,
  };
  const signal: Signal = {
    id: identity.id,
    key: identity.key,
    type: "signal",
    title,
    summary: content,
    owner: null,
    sourceKind: input.sourceType === "team_discovery" ? "团队想法" : input.sourceType === "user_feedback" ? "用户反馈" : "客户需求",
    createdAt: identity.now,
    updatedAt: identity.now,
    rawData,
    unified: {
      sourceType: input.sourceType,
      sourceId: input.sourceType === "product_feedback" ? identity.id : undefined,
      title,
      content,
      submitter: rawData.submitter,
      createdAt: input.collectedAt,
      attachments: input.attachments ?? [],
      channel: input.sourceChannel,
      owner: null,
      processingStatus: needsStandardization ? "已汇入" : "待提炼",
      standardizationStatus: input.sourceType === "product_feedback" ? "not_required" : standardized ? "standardized" : "pending",
      refinementStatus: "pending_refinement",
      linkedRequirementIds: [],
      updatedAt: identity.now,
    },
    standardized,
  };
  const event: EvolutionEvent = {
    id: eventId,
    objectId: signal.id,
    sequence: 1,
    occurredAt: identity.now,
    cycleId,
    stage: "intake",
    stageOccurrence: 1,
    eventType: "object_created",
    label: "需求已汇入原始需求",
    actor: recorder,
  };
  return {
    signal,
    evolution: [event],
    projection: { objectId: signal.id, currentStage: needsStandardization ? "intake" : "refinement", currentStageStatus: needsStandardization ? "待标准化" : "待提炼", currentCycleId: cycleId, latestEventId: eventId },
  };
}
