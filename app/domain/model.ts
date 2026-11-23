import type { LifecycleStage } from "./lifecycle";

export type ObjectType = "signal" | "requirement" | "feature" | "product" | "sop" | "skill" | "agent";
export type Position = "product" | "engineering" | "management";
export interface Person {
  id: string;
  name: string;
  position: Position;
  role?: string;
  email?: string;
  notificationId?: string;
  status?: "active" | "inactive";
}
export type Priority = "P0" | "P1" | "P2" | "P3";
export const priorityDefinitions: Record<Priority, { label: string; description: string }> = {
  P0: { label: "核心闭环与企业使用底线", description: "Agent Loop 闭环、生产环境接入、安全权限、数据隔离" },
  P1: { label: "闭环稳定性", description: "任务状态、失败处理、中断恢复、日志定位、结果确认" },
  P2: { label: "Skill 可用性", description: "Skill 的发现、选择、配置、调用及执行效果" },
  P3: { label: "体验与能力优化", description: "页面交互、个性化、更多 Skill、连接器及增强能力" },
};
export const priorityOrder: Priority[] = ["P0", "P1", "P2", "P3"];
export type ReviewResult = "approved" | "deferred" | "rejected" | "needs_info";
export type ImplementationStatus = "待开发" | "开发中" | "阻塞" | "已完成";
export type ValidationResult = "通过" | "部分通过" | "未通过";
export type ValidationFollowUp = "complete" | "next_implementation" | "next_planning" | "new_signal";

export interface ProductVersion {
  id: string;
  sequence: number;
  status: "open" | "completed";
  createdAt: string;
  name?: string;
  goal?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
}

export interface ImplementationFacts {
  status: ImplementationStatus;
  description: string;
  blocker: string;
  updatedAt: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  progress?: number;
}

export interface ValidationFacts {
  originalGoal: string;
  implementationResult: string;
  result?: ValidationResult;
  followUp?: ValidationFollowUp;
  record: string;
  newFeedback: string;
  updatedAt?: string;
}

export type SignalSourceType = "product_feedback" | "team_discovery" | "user_feedback";

export interface AttachmentRef {
  id: string;
  name: string;
  url?: string;
  mediaType?: string;
  source?: "alchemy_upload" | "external";
}

export interface SignalInput {
  sourceType: SignalSourceType;
  sourceChannel?: string;
  title?: string;
  submitter?: string;
  rawContent: string;
  attachments?: AttachmentRef[];
  collectedAt: string;
}

export interface StandardizedSignal {
  title: string;
  problem: string;
  scenario?: string;
  module?: string;
  confidence?: number;
}

export interface ProductFeedbackRawData {
  sourceType: "product_feedback";
  id: string;
  submitter: string;
  email: string;
  feedbackType: string;
  title: string;
  content: string;
  sourceStatus: string;
  createdAt: string;
  screenshotUrl?: string;
  screenshot?: AttachmentRef;
}

export interface UserFeedbackRawData {
  sourceType: "user_feedback";
  submitter: string;
  contact?: string;
  channel: string;
  title?: string;
  content: string;
  createdAt: string;
  attachments?: AttachmentRef[];
  recorder: string;
}

export interface TeamDiscoveryRawData {
  sourceType: "team_discovery";
  submitter: string;
  discoveryType: "Bug" | "体验问题" | "优化建议" | "新需求" | "其他";
  title?: string;
  content: string;
  environment?: string;
  createdAt: string;
  attachments?: AttachmentRef[];
}

export type SignalSourceRawData = ProductFeedbackRawData | UserFeedbackRawData | TeamDiscoveryRawData;
export type SignalStandardizationStatus = "pending" | "standardized" | "not_required" | "failed";
export type RefinementStatus = "pending_refinement" | "pending_confirmation" | "completed";

export interface UnifiedSignalFields {
  sourceType: SignalSourceType;
  sourceId?: string;
  title: string;
  content: string;
  submitter: string;
  createdAt: string;
  attachments: AttachmentRef[];
  channel?: string;
  priority?: Priority | null;
  owner: string | null;
  processingStatus: string;
  standardizationStatus: SignalStandardizationStatus;
  refinementStatus: RefinementStatus;
  linkedRequirementIds: string[];
  updatedAt: string;
  originObjectId?: string;
  originContext?: string;
}

export interface ProductObject {
  id: string;
  key: string;
  type: ObjectType;
  title: string;
  summary: string;
  priority?: Priority | null;
  owner: string | null;
  reviewResult?: ReviewResult;
  targetVersionId?: string;
  mergedIntoRequirementId?: string;
  sourceKind?: "用户反馈" | "Bug" | "客户需求" | "团队想法";
  createdAt: string;
  updatedAt: string;
  implementation?: ImplementationFacts;
  validation?: ValidationFacts;
  refinementResult?: { title: string; problem: string | null; description: string; targetUser: string | null; scenario: string | null; expectedOutcome: string | null; type: string | null; openQuestions: string[]; problemSnapshot?: { id: string; name: string; summary: string; sourceSignalIds: string[] } };
}

export interface RequirementReviewDraft {
  requirementId: string;
  priority?: Priority;
  owner: string;
  result: ReviewResult;
  notes: string;
}

export type ReviewChangeCandidate =
  | { id: string; kind: "merge"; requirementIds: string[]; title: string; summary?: string; rationale: string }
  | { id: string; kind: "split"; sourceRequirementId: string; title: string; secondTitle: string; rationale: string }
  | { id: string; kind: "new_signal"; sourceRequirementId: string; title: string; content: string; rationale: string }
  | { id: string; kind: "requirement_adjustment"; requirementId: string; title: string; summary: string; rationale: string };

export interface Signal extends ProductObject {
  type: "signal";
  rawData: SignalSourceRawData;
  unified: UnifiedSignalFields;
  standardized?: StandardizedSignal;
}

export type TransformationType = "refinement" | "merge" | "split" | "new_signal" | "content_adjustment";

export interface Transformation {
  id: string;
  type: TransformationType;
  sourceObjectIds: string[];
  targetObjectIds: string[];
  cycleId?: string;
  actorId?: string;
  reason?: string;
  createdAt: string;
}

export interface LineageRelation {
  id: string;
  transformationId: string;
  sourceObjectId: string;
  targetObjectId: string;
  transformationType: TransformationType;
  createdAt: string;
  reason?: string;
}

export interface EvolutionEvent {
  id: string;
  objectId: string;
  sequence: number;
  occurredAt: string;
  cycleId: string;
  stage?: LifecycleStage;
  stageOccurrence?: number;
  eventType: "object_created" | "cycle_started" | "stage_entered" | "stage_status_changed" | "priority_changed" | "owner_changed" | "review_recorded" | "content_changed" | "version_assigned" | "target_version_changed" | "lineage_created" | "validation_recorded";
  label: string;
  reason?: string;
  actor: string;
  fromVersionId?: string;
  toVersionId?: string;
}

export interface DecisionRecord {
  id: string;
  objectId: string;
  kind: "review" | "merge" | "priority" | "stage" | "version" | "scope";
  title: string;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
}

export interface ObjectProjection {
  objectId: string;
  currentStage: LifecycleStage;
  currentStageStatus: string;
  currentCycleId: string;
  latestEventId: string;
}
