import type { EvolutionEvent, ObjectProjection, ProductObject, ProductVersion } from "./model";

export function versionLabel(version: ProductVersion) {
  return `第 ${version.sequence} 版`;
}

export function assignRequirementToVersion(
  requirement: ProductObject,
  projection: ObjectProjection,
  versionId: string,
  versions: ProductVersion[],
  requirements: ProductObject[],
  actor: string,
  occurredAt: string,
) {
  if (requirement.type !== "requirement") throw new Error("只有 Requirement 可以进入产品版本");
  if (requirement.reviewResult !== "approved" && projection.currentStageStatus !== "待版本规划" && !requirement.targetVersionId) throw new Error("Requirement 尚未通过评审");
  const target = versions.find((version) => version.id === versionId && version.status === "open");
  if (!target) throw new Error("目标版本不存在或已经关闭");
  const previousVersionId = requirement.targetVersionId;
  const targetWasEmpty = !requirements.some((item) => item.type === "requirement" && item.id !== requirement.id && item.targetVersionId === target.id);
  const updatedRequirement: ProductObject = {
    ...requirement,
    targetVersionId: target.id,
    implementation: requirement.implementation ?? { status: "待开发", description: "", blocker: "", updatedAt: occurredAt },
    updatedAt: occurredAt,
  };
  const timestamp = Date.parse(occurredAt);
  const event: EvolutionEvent = {
    id: `target-version-${requirement.id}-${timestamp}`,
    objectId: requirement.id,
    sequence: 35,
    occurredAt,
    cycleId: projection.currentCycleId,
    stage: "planning",
    stageOccurrence: 1,
    eventType: previousVersionId ? "target_version_changed" : "version_assigned",
    label: previousVersionId ? `目标版本调整为${versionLabel(target)}` : `进入${versionLabel(target)}`,
    reason: previousVersionId ? "产品规划调整目标版本" : "评审通过后完成版本规划",
    actor,
    fromVersionId: previousVersionId,
    toVersionId: target.id,
  };
  const entersImplementation = projection.currentStage === "planning" && projection.currentStageStatus === "待版本规划";
  const stageEvent: EvolutionEvent | undefined = entersImplementation ? { id: `implementation-entered-${requirement.id}-${timestamp}`, objectId: requirement.id, sequence: 36, occurredAt, cycleId: projection.currentCycleId, stage: "implementation", stageOccurrence: 1, eventType: "stage_entered", label: `完成版本规划，进入研发实现`, reason: `目标版本：${versionLabel(target)}`, actor } : undefined;
  const updatedProjection: ObjectProjection = entersImplementation
    ? { ...projection, currentStage: "implementation", currentStageStatus: "待开发", latestEventId: stageEvent!.id }
    : { ...projection, latestEventId: event.id };
  let updatedVersions = versions;
  const hasLaterEmptyVersion = versions.some((version) => version.sequence > target.sequence && !requirements.some((item) => item.type === "requirement" && item.id !== requirement.id && item.targetVersionId === version.id));
  if (targetWasEmpty && !hasLaterEmptyVersion) {
    const nextSequence = Math.max(0, ...versions.map((version) => version.sequence)) + 1;
    updatedVersions = [...versions, { id: `version-${nextSequence}`, sequence: nextSequence, status: "open", createdAt: occurredAt }];
  }
  return { requirement: updatedRequirement, projection: updatedProjection, versions: updatedVersions, event, events: stageEvent ? [event, stageEvent] : [event] };
}
