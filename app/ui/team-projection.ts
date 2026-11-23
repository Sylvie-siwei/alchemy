import type { ObjectProjection, Person, Position, ProductObject, Signal } from "../domain/model";

export function implementationProgress(object: ProductObject): number {
  if (!object.implementation) return 0;
  if (typeof object.implementation.progress === "number") return Math.min(100, Math.max(0, object.implementation.progress));
  return object.implementation.status === "已完成" ? 100 : object.implementation.status === "开发中" || object.implementation.status === "阻塞" ? 50 : 0;
}

export function versionProgress(versionId: string, objects: ProductObject[], projections: ObjectProjection[]): number {
  const linked = objects.filter((object) => object.targetVersionId === versionId);
  if (!linked.length) return 0;
  const total = linked.reduce((sum, object) => {
    const projection = projections.find((candidate) => candidate.objectId === object.id);
    if (object.implementation) return sum + implementationProgress(object);
    if (projection?.currentStage === "validation") return sum + 100;
    if (projection?.currentStage === "implementation") return sum + 20;
    return sum;
  }, 0);
  return Math.round(total / linked.length);
}

export function positionFor(person: Person): Position { return person.position; }

export function scopeByOwner(objects: ProductObject[], ownerFilter: string): ProductObject[] {
  return ownerFilter === "全部负责人" ? objects : objects.filter((object) => object.owner === ownerFilter);
}

export function projectForPosition(objects: ProductObject[], projections: ObjectProjection[], position: Position): ProductObject[] {
  return objects.filter((object) => {
    const projection = projections.find((candidate) => candidate.objectId === object.id);
    if (position === "product") return true;
    if (position === "engineering") return object.type !== "signal" && Boolean(projection && ["planning", "implementation", "validation"].includes(projection.currentStage));
    return object.priority === "P0" || object.priority === "P1" || Boolean(projection && (projection.currentStageStatus.includes("评审") || projection.currentStageStatus === "阻塞" || projection.currentStage === "validation"));
  });
}

export function actionableForPosition(objects: ProductObject[], projections: ObjectProjection[], position: Position): ProductObject[] {
  return objects.filter((object) => {
    const projection = projections.find((candidate) => candidate.objectId === object.id);
    if (!projection) return false;
    if (position === "product") {
      if (object.type === "signal" && "unified" in object) return (object as Signal).unified.refinementStatus !== "completed";
      return projection.currentStage === "planning" && ["待评审", "待版本规划"].includes(projection.currentStageStatus);
    }
    if (position === "engineering") return ["planning", "implementation", "validation"].includes(projection.currentStage) && projection.currentStageStatus !== "已完成";
    return object.priority === "P0" || object.priority === "P1" || projection.currentStageStatus === "阻塞" || projection.currentStageStatus.includes("评审") || projection.currentStage === "validation";
  });
}
