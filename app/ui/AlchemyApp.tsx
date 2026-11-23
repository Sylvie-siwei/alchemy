"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { decisions, evolution, lineage, objects, people, projectionFor, projections, transformations, versions as mockVersions } from "../data/mock";
import { attentionFor, deriveAttentionItems, type AttentionItem, type AttentionType } from "../domain/attention";
import { lifecycleStages, stageById, stageIndex, type LifecycleStage } from "../domain/lifecycle";
import { confirmSignalStandardization } from "../domain/signals";
import { applyReview, reviewResultLabels } from "../domain/reviews";
import { completeValidation, updateImplementation } from "../domain/delivery";
import { applyRefinement, applyRequirementRefinement, type RefinementPlan, type RefinementProblem, type RequirementCandidate } from "../domain/refinement";
import { previewReturnToPreviousStep, returnToPreviousStep, type ReturnStepPreview } from "../domain/return-step";
import { matchesSignalLibraryFilter, signalLibraryState, type SignalLibraryFilter } from "../domain/signal-library";
import { assignRequirementToVersion, versionLabel } from "../domain/versions";
import { projectForPosition, scopeByOwner, versionProgress } from "./team-projection";
import { safeAttachmentUrl, isImageAttachment } from "./attachment-presentation";
import { eligibleRefinementSignals, normalizeRefinementSelection, toggleRefinementSelection, toggleVisibleRefinementSelection } from "./refinement-selection";
import type { DailyBrief } from "../domain/daily-brief";
import { priorityDefinitions, type AttachmentRef, type DecisionRecord, type EvolutionEvent, type ImplementationStatus, type LineageRelation, type ObjectProjection, type Position, type Priority, type ProductObject, type ProductVersion, type RequirementReviewDraft, type ReviewChangeCandidate, type ReviewResult, type Signal, type SignalInput, type SignalSourceType, type StandardizedSignal, type Transformation, type ValidationFollowUp, type ValidationResult } from "../domain/model";

type View = "global-overview" | "role-overview" | "role-workspace" | LifecycleStage | "archive" | "settings" | "evolution-map";
type ViewMode = Position;
type PlanningFilter = "all" | "pending_review" | "pending_version" | `version:${string}`;
type RoleScope = "all" | "owned" | "submitted";
const NavigationBackContext = createContext({ sourceLabel: "上一级", actionReturnLabel: "需求详情" });

const stageStats: Record<LifecycleStage, { total: number; note: string; tone?: "warning" | "danger" }> = {
  intake: { total: 32, note: "4 条待响应" },
  refinement: { total: 14, note: "7 条堆积", tone: "warning" },
  planning: { total: 18, note: "5 条待评审" },
  implementation: { total: 9, note: "2 条阻塞", tone: "danger" },
  validation: { total: 6, note: "2 条验收中" },
};

const stageCopy: Record<LifecycleStage, string> = {
  intake: "现实中的反馈、缺陷、客户需求与团队想法在这里进入系统。",
  refinement: "澄清与识别真正的问题结构，保留每一次来源和变化。",
  planning: "决定需求最终以什么产品形态进入现实。优先级：P0 核心闭环与企业使用底线 · P1 闭环稳定性 · P2 Skill 可用性 · P3 体验与能力优化。",
  implementation: "跟踪规划转化为现实产品的进度、负责人和阻塞。",
  validation: "用测试、验收和交付结果检验此前的判断与实现。",
};

export function AlchemyApp() {
  const [currentViewId, setCurrentViewId] = useState<"global" | Position>("global");
  const [view, setView] = useState<View>("global-overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("全部负责人");
  const [roleScope, setRoleScope] = useState<RoleScope>("all");
  const [priority, setPriority] = useState("全部优先级");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newDemandOpen, setNewDemandOpen] = useState(false);
  const [captureNotice, setCaptureNotice] = useState("");
  const [intakeEntry, setIntakeEntry] = useState<"table" | "feedback" | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [refinementTargetIds, setRefinementTargetIds] = useState<string[]>([]);
  const [reviewTargetIds, setReviewTargetIds] = useState<string[]>([]);
  const [deliveryAction, setDeliveryAction] = useState<{ id: string; kind: "implementation" | "validation" } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [returnTargetId, setReturnTargetId] = useState<string | null>(null);
  const [versionTargetId, setVersionTargetId] = useState<string | null>(null);
  const [rerefineTargetId, setRerefineTargetId] = useState<string | null>(null);
  const [runtimeObjects, setRuntimeObjects] = useState<ProductObject[]>(objects);
  const [runtimeProjections, setRuntimeProjections] = useState<ObjectProjection[]>(projections);
  const [runtimeEvolution, setRuntimeEvolution] = useState<EvolutionEvent[]>(evolution);
  const [runtimeDecisions, setRuntimeDecisions] = useState<DecisionRecord[]>(decisions);
  const [runtimeLineage, setRuntimeLineage] = useState<LineageRelation[]>(lineage);
  const [runtimeTransformations, setRuntimeTransformations] = useState<Transformation[]>(transformations);
  const [runtimeVersions, setRuntimeVersions] = useState<ProductVersion[]>(mockVersions);
  const currentUser = people.find((person) => person.position === currentViewId) ?? people[0];
  const viewMode: ViewMode = currentViewId === "global" ? "product" : currentViewId;

  const selected = selectedId ? runtimeObjects.find((object) => object.id === selectedId) : undefined;
  useEffect(() => {
    fetch("/api/signals").then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!payload?.entries?.length) return;
      setRuntimeObjects((current) => [...payload.entries.map((entry: { signal: Signal }) => entry.signal), ...current.filter((object) => !payload.entries.some((entry: { signal: Signal }) => entry.signal.id === object.id))]);
      setRuntimeProjections((current) => [...payload.entries.map((entry: { projection: ObjectProjection }) => entry.projection), ...current.filter((projection) => !payload.entries.some((entry: { projection: ObjectProjection }) => entry.projection.objectId === projection.objectId))]);
      setRuntimeEvolution((current) => [...payload.entries.flatMap((entry: { evolution: EvolutionEvent[] }) => entry.evolution), ...current]);
    }).catch(() => undefined);
  }, []);
  const navigate = (target: View) => {
    setView(target);
    setSidebarOpen(false);
  };
  const openNewDemand = () => { setNewDemandOpen(true); setSidebarOpen(false); };
  const changeCurrentView = (targetViewId: "global" | Position) => {
    setCurrentViewId(targetViewId);
    setOwner("全部负责人");
    setRoleScope("all");
    setPriority("全部优先级");
    setQuery("");
    setView(targetViewId === "global" ? "global-overview" : "role-overview");
    setSelectedId(null);
    setActionId(null);
    setSidebarOpen(false);
  };
  const applyReviewActions = (command: { drafts: RequirementReviewDraft[]; candidates: ReviewChangeCandidate[]; actor: string; occurredAt: string }, close = true) => {
    const result = applyReview(command, runtimeObjects, runtimeProjections);
    setRuntimeObjects([...result.createdObjects, ...result.updatedObjects]);
    setRuntimeProjections(result.projections);
    setRuntimeEvolution((current) => [...current, ...result.events]);
    setRuntimeDecisions((current) => [...current, ...result.decisions]);
    setRuntimeTransformations((current) => [...current, ...result.transformations]);
    setRuntimeLineage((current) => [...current, ...result.lineage]);
    if (close) setReviewOpen(false);
  };
  const applyRefinementCandidates = (candidates: RequirementCandidate[]) => {
    const sourceSignals = runtimeObjects.filter(isSignalObject);
    const timestamp = new Date().toISOString();
    let workingSignals = sourceSignals;
    const baseCount = runtimeObjects.filter((object) => object.type === "requirement").length;
    const results = candidates.map((candidate, index) => { const result = applyRefinement(candidate, workingSignals, currentUser.name, timestamp, { id: `req-${Date.parse(timestamp)}-${index}`, key: `REQ-${String(baseCount + index + 1).padStart(3, "0")}` }); workingSignals = result.updatedSignals; return result; });
    setRuntimeObjects((items) => [...results.map((result) => result.requirement), ...items.map((item) => workingSignals.find((signal) => signal.id === item.id) ?? item)]);
    setRuntimeProjections((items) => [...results.map((result) => result.projection), ...items]);
    setRuntimeEvolution((items) => [...items, ...results.flatMap((result) => result.evolution)]);
    setRuntimeDecisions((items) => [...items, ...results.map((result) => result.decision)]);
    setRuntimeTransformations((items) => [...items, ...results.map((result) => result.transformation)]);
    setRuntimeLineage((items) => [...items, ...results.flatMap((result) => result.lineage)]);
    setRefinementOpen(false);
    setView(currentViewId === "global" ? "planning" : "role-workspace");
    setSelectedId(results[0]?.requirement.id ?? null);
  };
  const applyVersionPlan = (requirementId: string, targetVersionId: string) => {
    const requirement = runtimeObjects.find((object) => object.id === requirementId);
    const projection = runtimeProjections.find((item) => item.objectId === requirementId);
    if (!requirement || !projection) return;
    const result = assignRequirementToVersion(requirement, projection, targetVersionId, runtimeVersions, runtimeObjects, currentUser.name, new Date().toISOString());
    setRuntimeObjects((items) => items.map((item) => item.id === requirement.id ? result.requirement : item));
    setRuntimeProjections((items) => items.map((item) => item.objectId === requirement.id ? result.projection : item));
    setRuntimeVersions(result.versions);
    setRuntimeEvolution((items) => [...items, ...result.events]);
    setVersionTargetId(null);
    setSelectedId(requirement.id);
  };
  const applyRerefinement = (requirementId: string, candidate: { title: string; description: string; rationale?: string }) => {
    const requirement = runtimeObjects.find((object) => object.id === requirementId); const projection = runtimeProjections.find((item) => item.objectId === requirementId); if (!requirement || !projection) return;
    const result = applyRequirementRefinement(requirement, projection, candidate, currentUser.name, new Date().toISOString());
    setRuntimeObjects((items) => items.map((item) => item.id === requirementId ? result.requirement : item)); setRuntimeProjections((items) => items.map((item) => item.objectId === requirementId ? result.projection : item)); setRuntimeEvolution((items) => [...items, result.event]); setRuntimeTransformations((items) => [...items, result.transformation]); setRuntimeDecisions((items) => [...items, result.decision]); setRerefineTargetId(null); setSelectedId(requirementId);
  };
  const ownerScopedObjects = scopeByOwner(runtimeObjects, owner);
  const projectedObjects = projectForPosition(ownerScopedObjects, runtimeProjections, viewMode);
  const projectedObjectIds = new Set(projectedObjects.map((object) => object.id));
  const projectedProjections = runtimeProjections.filter((projection) => projectedObjectIds.has(projection.objectId));
  const visibleStages = viewMode === "engineering" ? lifecycleStages.filter((stage) => ["planning", "implementation", "validation"].includes(stage.id)) : lifecycleStages;
  const isGlobalView = currentViewId === "global";
  const isGlobalContext = isGlobalView && (view === "global-overview" || lifecycleStages.some((stage) => stage.id === view));
  const workbenchReturnId = deliveryAction?.id ?? (reviewOpen ? reviewTargetIds[0] : refinementOpen ? refinementTargetIds[0] : undefined);
  const refinementSignals = (isGlobalView ? runtimeObjects : projectedObjects).filter(isSignalObject);
  const roleScopedObjects = scopeRoleObjects(runtimeObjects, runtimeLineage, roleScope, currentUser.name);
  const roleProjectedObjects = projectForPosition(roleScopedObjects, runtimeProjections, viewMode);
  const roleProjectedIds = new Set(roleProjectedObjects.map((object) => object.id));
  const roleProjectedProjections = runtimeProjections.filter((projection) => roleProjectedIds.has(projection.objectId));
  const sourceLabel = viewReturnLabel(view, isGlobalView, viewMode);
  const actionReturnLabel = selected ? "需求详情" : sourceLabel;

  return (
    <NavigationBackContext.Provider value={{ sourceLabel, actionReturnLabel }}><div className="app-shell">
      <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="打开导航">☰</button>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark">A</span><span>Alchemy</span></div>
        <ViewSelector value={currentViewId} onChange={changeCurrentView} />
        <button className="sidebar-capture" onClick={openNewDemand}>＋ 新增需求</button>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="关闭导航">×</button>
        <nav aria-label="Alchemy 导航">
          {isGlobalView ? <><NavButton active={view === "global-overview"} onClick={() => navigate("global-overview")} icon="⌂">总览</NavButton><div className="nav-label nav-label-secondary">生命周期</div>{lifecycleStages.map((stage, index) => <NavButton key={stage.id} active={view === stage.id} onClick={() => navigate(stage.id)} icon={String(index + 1).padStart(2, "0")}>{stage.label}</NavButton>)}</> : <><div className="nav-label">我的工作</div><NavButton active={view === "role-overview"} onClick={() => navigate("role-overview")} icon="⌂">总览</NavButton><NavButton active={view === "role-workspace"} onClick={() => navigate("role-workspace")} icon="▦">工作区</NavButton></>}
          <div className="nav-label nav-label-secondary">其他</div>
          <NavButton active={view === "archive"} onClick={() => navigate("archive")} icon="□">归档</NavButton>
          <NavButton active={view === "settings"} onClick={() => navigate("settings")} icon="·">设置</NavButton>
        </nav>
        <div className="sidebar-foot"><span className="presence" /> Alchemy<br /><small>{isGlobalView ? "总视图" : viewMode === "product" ? "产品视角" : viewMode === "engineering" ? "研发视角" : "管理视角"} · V1 Preview</small></div>
        <div className="evolution-map-nav">
          <NavButton active={view === "evolution-map"} onClick={() => navigate("evolution-map")} icon={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h9.5a4.5 4.5 0 0 1 0 9H8" /><path d="m8 13.5-3 3 3 3" /><circle cx="5" cy="7.5" r="2" /></svg>}>演化地图</NavButton>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="关闭导航遮罩" />}

      <main className="main">
        {view === "global-overview" && isGlobalView ? (
          <Overview scope="global" objects={runtimeObjects} projections={runtimeProjections} events={runtimeEvolution} decisions={runtimeDecisions} versions={runtimeVersions} stages={lifecycleStages} mode="product" owner={owner} setOwner={setOwner} onOpenStage={navigate} onSelect={setSelectedId} />
        ) : view === "role-overview" && !isGlobalView ? (
          <Overview scope="role" objects={roleProjectedObjects} projections={roleProjectedProjections} events={runtimeEvolution} decisions={runtimeDecisions} versions={runtimeVersions} stages={visibleStages} mode={viewMode} owner={owner} setOwner={setOwner} roleScope={roleScope} setRoleScope={setRoleScope} onOpenStage={() => navigate("role-workspace")} onSelect={setSelectedId} />
        ) : view === "role-workspace" && !isGlobalView ? (
          <RoleWorkspace mode={viewMode} objects={projectedObjects} projections={projectedProjections} onStandardize={(id) => setActionId(id)} onRefine={(ids) => { setRefinementTargetIds(ids); setRefinementOpen(true); }} onReview={(ids) => { setReviewTargetIds(ids); setReviewOpen(true); }} onPlan={(id) => setVersionTargetId(id)} onImplementation={(id) => setDeliveryAction({ id, kind: "implementation" })} onValidation={(id) => setDeliveryAction({ id, kind: "validation" })} />
        ) : view === "evolution-map" ? (
          <EvolutionMap />
        ) : lifecycleStages.some((stage) => stage.id === view) ? (
          <StageView stage={view as LifecycleStage} objects={runtimeObjects} projections={runtimeProjections} versions={runtimeVersions} viewMode="product" query={query} setQuery={setQuery} owner={owner} setOwner={setOwner} priority={priority} setPriority={setPriority} onSelect={setSelectedId} onNewDemand={openNewDemand} onImportTable={() => setIntakeEntry("table")} onSyncFeedback={() => setIntakeEntry("feedback")} onStartRefinement={(selectedIds) => { setRefinementTargetIds(selectedIds); setRefinementOpen(true); }} onStartReview={() => { setReviewTargetIds(runtimeObjects.filter((object) => object.type === "requirement" && runtimeProjections.find((projection) => projection.objectId === object.id)?.currentStage === "planning" && runtimeProjections.find((projection) => projection.objectId === object.id)?.currentStageStatus === "待评审").map((object) => object.id)); setReviewOpen(true); }} />
        ) : (
          view === "settings" ? <SettingsPage /> : <QuietPage />
        )}
      </main>
      {selected && !actionId && !deliveryAction && !refinementOpen && !reviewOpen && !versionTargetId && !rerefineTargetId && !returnTargetId && <div className="overlay-back-slot"><ContextBackEntry onBack={() => setSelectedId(null)} /></div>}
      {refinementOpen && <div className="overlay-back-slot workbench-back"><ContextBackEntry level="action" onBack={() => setRefinementOpen(false)} /></div>}
      {reviewOpen && <div className="overlay-back-slot workbench-back"><ContextBackEntry level="action" onBack={() => setReviewOpen(false)} /></div>}
      {versionTargetId && <div className="overlay-back-slot workbench-back"><ContextBackEntry level="action" onBack={() => setVersionTargetId(null)} /></div>}
      {rerefineTargetId && <div className="overlay-back-slot workbench-back"><ContextBackEntry level="action" onBack={() => setRerefineTargetId(null)} /></div>}
      {deliveryAction && <div className="overlay-back-slot workbench-back"><ContextBackEntry level="action" onBack={() => setDeliveryAction(null)} /></div>}
      {returnTargetId && <div className="overlay-back-slot workbench-back"><ContextBackEntry level="action" onBack={() => setReturnTargetId(null)} /></div>}
      {actionId && <div className="overlay-back-slot workbench-back"><ContextBackEntry level="action" onBack={() => setActionId(null)} /></div>}
      {newDemandOpen && <div className="overlay-back-slot workbench-back"><ContextBackEntry onBack={() => setNewDemandOpen(false)} /></div>}
      {intakeEntry && <div className="overlay-back-slot workbench-back"><ContextBackEntry onBack={() => setIntakeEntry(null)} /></div>}

      {selected && !actionId && !deliveryAction && (isGlobalContext || viewMode === "product" ? <ObjectDrawer object={selected} allObjects={runtimeObjects} projections={runtimeProjections} versions={runtimeVersions} allEvolution={runtimeEvolution} records={runtimeDecisions} relations={runtimeLineage} transformations={runtimeTransformations} onSelect={setSelectedId} onProcess={() => setActionId(selected.id)} onReturn={() => setReturnTargetId(selected.id)} onRefine={() => { setRefinementTargetIds([selected.id]); setRefinementOpen(true); }} onReview={() => { setReviewTargetIds([selected.id]); setReviewOpen(true); }} onRerefine={() => setRerefineTargetId(selected.id)} onPlanVersion={() => setVersionTargetId(selected.id)} onStageAction={(kind) => setDeliveryAction({ id: selected.id, kind })} onClose={() => setSelectedId(null)} /> : <ProjectedObjectDrawer mode={viewMode} object={selected} projection={runtimeProjections.find((projection) => projection.objectId === selected.id)!} versions={runtimeVersions} evidence={runtimeLineage.filter((relation) => relation.targetObjectId === selected.id).map((relation) => runtimeObjects.find((object) => object.id === relation.sourceObjectId)).filter((object): object is ProductObject => Boolean(object))} decisions={runtimeDecisions.filter((decision) => decision.objectId === selected.id)} onReturn={() => setReturnTargetId(selected.id)} onStageAction={(kind) => setDeliveryAction({ id: selected.id, kind })} onClose={() => setSelectedId(null)} />)}
      {refinementOpen && <SimpleRefinementWorkbench signals={refinementSignals} initialSignalIds={refinementTargetIds} actor={currentUser.name} onClose={() => setRefinementOpen(false)} onApply={applyRefinementCandidates} />}
      {reviewOpen && <ReviewWorkbench actor={currentUser.name} requirements={runtimeObjects.filter((object) => object.type === "requirement" && reviewTargetIds.includes(object.id))} allRequirements={runtimeObjects.filter((object) => object.type === "requirement")} projections={runtimeProjections} versions={runtimeVersions} onReturn={(id) => setReturnTargetId(id)} onClose={() => setReviewOpen(false)} onApply={applyReviewActions} />}
      {versionTargetId && (() => { const requirement = runtimeObjects.find((object) => object.id === versionTargetId); return requirement ? <VersionPlanningDialog requirement={requirement} versions={runtimeVersions} onClose={() => setVersionTargetId(null)} onConfirm={(targetVersionId) => applyVersionPlan(requirement.id, targetVersionId)} /> : null; })()}
      {rerefineTargetId && (() => { const requirement = runtimeObjects.find((object) => object.id === rerefineTargetId); const notes = runtimeEvolution.filter((event) => event.objectId === rerefineTargetId && event.eventType === "review_recorded").at(-1)?.reason ?? "暂无评审备注"; const sourceSignals = runtimeLineage.filter((relation) => relation.targetObjectId === rerefineTargetId && relation.transformationType === "refinement").map((relation) => runtimeObjects.find((object) => object.id === relation.sourceObjectId)).filter((object): object is Signal => Boolean(object && isSignalObject(object))); return requirement ? <RerefineWorkbench requirement={requirement} signals={sourceSignals} reviewNotes={notes} onClose={() => setRerefineTargetId(null)} onConfirm={(candidate) => applyRerefinement(requirement.id, candidate)} /> : null; })()}
      {deliveryAction && (() => { const object = runtimeObjects.find((item) => item.id === deliveryAction.id)!; const projection = runtimeProjections.find((item) => item.objectId === deliveryAction.id)!; return deliveryAction.kind === "implementation" ? <ImplementationDialog object={object} projection={projection} onReturn={() => setReturnTargetId(object.id)} onClose={() => setDeliveryAction(null)} onSave={(facts) => { const result = updateImplementation(object, projection, facts, currentUser.name, new Date().toISOString()); setRuntimeObjects((items) => items.map((item) => item.id === object.id ? result.object : item)); setRuntimeProjections((items) => items.map((item) => item.objectId === object.id ? result.projection : item)); setRuntimeEvolution((items) => [...items, result.event]); setDeliveryAction(null); setSelectedId(object.id); }} /> : <ValidationDialog object={object} onReturn={() => setReturnTargetId(object.id)} onClose={() => setDeliveryAction(null)} onComplete={(facts, feedback) => { const result = completeValidation(object, projection, facts, feedback, currentUser.name, new Date().toISOString()); setRuntimeObjects((items) => [...result.signals.map((created) => created.signal), ...items.map((item) => item.id === object.id ? result.object : item)]); setRuntimeProjections((items) => [...result.signals.map((created) => created.projection), ...items.map((item) => item.objectId === object.id ? result.projection : item)]); setRuntimeEvolution((items) => [...items, result.event, ...result.signals.flatMap((created) => created.evolution)]); setRuntimeTransformations((items) => [...items, ...result.transformations]); setRuntimeLineage((items) => [...items, ...result.lineage]); setDeliveryAction(null); setSelectedId(object.id); }} />; })()}
      {returnTargetId && (() => { const object = runtimeObjects.find((item) => item.id === returnTargetId); const projection = runtimeProjections.find((item) => item.objectId === returnTargetId); if (!object || !projection) return null; const preview = previewReturnToPreviousStep(object.id, runtimeProjections, runtimeEvolution, runtimeLineage); return <ReturnStepDialog object={object} preview={preview} onClose={() => setReturnTargetId(null)} onConfirm={(reason) => { const result = returnToPreviousStep({ objectId: object.id, reason, actor: currentUser.name, occurredAt: new Date().toISOString() }, object, projection, preview); setRuntimeObjects((items) => items.map((item) => item.id === object.id ? result.object : item)); setRuntimeProjections((items) => items.map((item) => item.objectId === object.id ? result.projection : item)); setRuntimeEvolution((items) => [...items, result.event]); setRuntimeDecisions((items) => [...items, result.decision]); setReturnTargetId(null); setRefinementOpen(false); setReviewOpen(false); setDeliveryAction(null); setSelectedId(object.id); }} />; })()}
      {actionId && (() => { const actionObject = runtimeObjects.find((object) => object.id === actionId); const actionProjection = runtimeProjections.find((projection) => projection.objectId === actionId); return actionObject && actionProjection && isSignalObject(actionObject) ? <StandardizationWorkbench signal={actionObject} projection={actionProjection} actor={currentUser.name} onClose={() => setActionId(null)} onConfirmed={(result) => { setRuntimeObjects((current) => current.map((object) => object.id === result.signal.id ? result.signal : object)); setRuntimeEvolution((current) => [...current, result.event]); setRuntimeProjections((current) => current.map((projection) => projection.objectId === result.signal.id ? result.projection : projection)); setActionId(null); setSelectedId(result.signal.id); }} /> : null; })()}
      {newDemandOpen && <NewDemandDialog actor={isGlobalView ? "Alchemy 用户" : currentUser.name} defaultSubmitter={isGlobalView ? "" : currentUser.name} onClose={() => setNewDemandOpen(false)} onCreated={(created) => {
        setRuntimeObjects((current) => [created.signal, ...current]);
        setRuntimeProjections((current) => [created.projection, ...current]);
        setRuntimeEvolution((current) => [...created.evolution, ...current]);
        setNewDemandOpen(false);
        setCaptureNotice(`已新增“${created.signal.unified.title}”，并汇入原始需求。`);
      }} />}
      {captureNotice && <div className="capture-toast" role="status"><span>{captureNotice}</span><button onClick={() => setCaptureNotice("")} aria-label="关闭新增成功提示">×</button></div>}
      {workbenchReturnId && !returnTargetId && stageIndex(runtimeProjections.find((projection) => projection.objectId === workbenchReturnId)?.currentStage ?? "intake") > 0 && <button className="workbench-return-shortcut" onClick={() => setReturnTargetId(workbenchReturnId)}>返回上一步</button>}
      {intakeEntry && <IntakeEntrySkeleton kind={intakeEntry} onClose={() => setIntakeEntry(null)} onSynced={(created) => {
        setRuntimeObjects((current) => [...created.map((entry) => entry.signal), ...current.filter((object) => !created.some((entry) => entry.signal.id === object.id))]);
        setRuntimeProjections((current) => [...created.map((entry) => entry.projection), ...current.filter((projection) => !created.some((entry) => entry.projection.objectId === projection.objectId))]);
        setRuntimeEvolution((current) => [...created.flatMap((entry) => entry.evolution), ...current]);
      }} />}
    </div></NavigationBackContext.Provider>
  );
}

function NavButton({ active, icon, badge, children, onClick, ariaLabel }: { active: boolean; icon: React.ReactNode; badge?: number; children: React.ReactNode; onClick: () => void; ariaLabel?: string }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick} aria-label={ariaLabel}><span className="nav-icon">{icon}</span>{children}{Boolean(badge) && <span className="nav-badge">{badge}</span>}</button>;
}

function ViewSelector({ value, onChange }: { value: "global" | Position; onChange: (viewId: "global" | Position) => void }) {
  return <label className="view-mode-switcher current-user-switcher"><span>当前视图</span><select value={value} onChange={(event) => onChange(event.target.value as "global" | Position)} aria-label="切换当前视图"><option value="global">总视图</option><option value="product">产品</option><option value="engineering">研发</option><option value="management">管理</option></select></label>;
}

function Header({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function BackEntry({ label, onBack }: { label: string; onBack: () => void }) {
  return <button type="button" className="page-back-entry" onClick={onBack}>← 返回{label}</button>;
}

function ContextBackEntry({ level = "source", onBack }: { level?: "source" | "action"; onBack: () => void }) {
  const navigation = useContext(NavigationBackContext);
  return <BackEntry label={level === "action" ? navigation.actionReturnLabel : navigation.sourceLabel} onBack={onBack} />;
}

function viewReturnLabel(view: View, global: boolean, mode: ViewMode) {
  if (view === "role-workspace") return "工作区";
  if (view === "global-overview" || view === "role-overview") return "总览";
  if (view === "settings") return "设置";
  if (lifecycleStages.some((stage) => stage.id === view)) return stageById(view as LifecycleStage).label;
  return global ? "总视图" : mode === "product" ? "产品视图" : mode === "engineering" ? "研发视图" : "管理视图";
}

function NewDemandMenu({ onManual, onTable, onFeedback }: { onManual: () => void; onTable: () => void; onFeedback: () => void }) {
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => { setOpen(false); action(); };
  return <div className="new-demand-menu"><button className="primary-action" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>＋ 新需求 <span>⌄</span></button>{open && <div role="menu"><button role="menuitem" onClick={() => choose(onManual)}><strong>手动新增</strong><small>录入团队发现或用户反馈</small></button><button role="menuitem" onClick={() => choose(onTable)}><strong>导入表格</strong><small>未实现：公开版仅说明边界</small></button><button role="menuitem" onClick={() => choose(onFeedback)}><strong>导入合成反馈</strong><small>固定虚构案例，无外部连接</small></button></div>}</div>;
}

function Overview({ scope, objects: allObjects, projections: allProjections, events, decisions: allDecisions, versions, stages, mode, owner, setOwner, roleScope = "all", setRoleScope = () => undefined, onOpenStage, onSelect }: { scope: "global" | "role"; objects: ProductObject[]; projections: ObjectProjection[]; events: EvolutionEvent[]; decisions: DecisionRecord[]; versions: ProductVersion[]; stages: ReadonlyArray<(typeof lifecycleStages)[number]>; mode: ViewMode; owner: string; setOwner: (owner: string) => void; roleScope?: RoleScope; setRoleScope?: (scope: RoleScope) => void; onOpenStage: (stage: View) => void; onSelect: (id: string) => void }) {
  const roleTitle = mode === "product" ? "产品视角整体情况" : mode === "engineering" ? "研发视角整体情况" : "管理视角整体情况";
  return <>
    <Header eyebrow={scope === "global" ? "全局 · 总视图" : "当前角色 · 总览"} title={scope === "global" ? "产品生命周期总视图" : roleTitle} copy={scope === "global" ? "从原始需求到交付验证，观察全部对象的分布、风险与变化。" : mode === "product" ? "从产品角色出发，关注需要整理、判断和推进的需求。" : mode === "engineering" ? "从研发角色出发，关注进入规划、实现与验证的工作。" : "从管理角色出发，关注高优先级、风险、阻塞和关键判断。"} />
    {scope === "global" ? <OwnerScopeFilter value={owner} onChange={setOwner} /> : <RoleScopeSwitch value={roleScope} onChange={setRoleScope} />}
    {scope === "global" ? <DemandOverview scope={scope} objects={allObjects} projections={allProjections} events={events} decisions={allDecisions} stages={stages} mode={mode} onOpenStage={onOpenStage} onSelect={onSelect} /> : mode === "product" ? <ProductAttentionOverview objects={allObjects} projections={allProjections} events={events} onOpenStage={onOpenStage} onSelect={onSelect} /> : mode === "engineering" ? <EngineeringAttentionOverview objects={allObjects} projections={allProjections} events={events} onSelect={onSelect} /> : <ManagementRoleOverview objects={allObjects} projections={allProjections} versions={versions} decisions={allDecisions} onSelect={onSelect} />}
  </>;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function RoleMetrics({ items }: { items: Array<{ label: string; value: string | number; tone?: string }> }) {
  return <div className="role-dashboard-metrics">{items.map((item) => <article className={item.tone ?? ""} key={item.label}><strong>{item.value}</strong><span>{item.label}</span></article>)}</div>;
}

function ProductRoleOverview({ objects, projections, onOpenStage, onSelect }: { objects: ProductObject[]; projections: ObjectProjection[]; events: EvolutionEvent[]; decisions: DecisionRecord[]; onOpenStage: (stage: View) => void; onSelect: (id: string) => void }) { const projectionOf = (id: string) => projections.find((item) => item.objectId === id); const flow = [{ label: "原始需求", count: objects.filter(isSignalObject).length, stage: "intake" as LifecycleStage }, { label: "待提炼", count: objects.filter((object) => isSignalObject(object) && object.unified.refinementStatus !== "completed").length, stage: "refinement" as LifecycleStage }, { label: "待评审", count: projections.filter((item) => item.currentStageStatus === "待评审").length, stage: "planning" as LifecycleStage }, { label: "已规划", count: objects.filter((object) => Boolean(object.targetVersionId)).length, stage: "planning" as LifecycleStage }, { label: "研发中", count: projections.filter((item) => item.currentStage === "implementation").length, stage: "implementation" as LifecycleStage }, { label: "待验证", count: projections.filter((item) => item.currentStage === "validation" && item.currentStageStatus !== "已完成").length, stage: "validation" as LifecycleStage }]; const push = objects.filter((object) => { const projection = projectionOf(object.id); return object.type !== "signal" && Boolean(projection && (projection.currentStageStatus === "阻塞" || projection.currentStageStatus === "待评审" || projection.currentStage === "validation" || !object.owner)); }).sort(attentionSort).slice(0, 5); const stalled = objects.filter((object) => daysSince(object.updatedAt) >= 3).length; const unowned = objects.filter((object) => object.type !== "signal" && !object.owner).length; return <div className="role-dashboard concise-overview"><section className="concise-section"><h2>需求流转</h2><div className="concise-flow">{flow.map((item, index) => <div key={item.label}><button onClick={() => onOpenStage(item.stage)}><strong>{item.count}</strong><span>{item.label}</span></button>{index < flow.length - 1 && <em>→</em>}</div>)}</div></section>{push.length > 0 && <section className="concise-section"><h2>需要推动</h2><AttentionList objects={push} projections={projections} onSelect={onSelect} /></section>}<section className="concise-section"><h2>协作异常</h2><div className="alignment-counts"><span><strong>{stalled}</strong>超时停留</span><span><strong>{objects.filter((object) => object.implementation?.status === "阻塞").length}</strong>等待协作</span><span><strong>{unowned}</strong>负责人为空</span></div></section></div>; }

function EngineeringRoleOverview({ objects, projections, onSelect }: { objects: ProductObject[]; projections: ObjectProjection[]; onSelect: (id: string) => void }) { const implementations = objects.filter((object) => object.implementation && object.implementation.status !== "已完成"); const validating = objects.filter((object) => projections.find((projection) => projection.objectId === object.id)?.currentStage === "validation"); const prioritized = [...new Map([...implementations, ...validating].map((object) => [object.id, object])).values()].sort(attentionSort).slice(0, 6); const blocked = implementations.filter((object) => object.implementation?.status === "阻塞"); const stale = implementations.filter((object) => daysSince(object.implementation?.updatedAt ?? object.updatedAt) >= 2); return <div className="role-dashboard concise-overview"><RoleMetrics items={[{ label: "待实现", value: implementations.filter((object) => object.implementation?.status === "待开发").length }, { label: "实现中", value: implementations.filter((object) => object.implementation?.status === "开发中").length }, { label: "阻塞", value: blocked.length, tone: "danger" }, { label: "待验证", value: validating.length }]} /><section className="concise-section"><h2>优先处理</h2><AttentionList objects={prioritized} projections={projections} onSelect={onSelect} /></section><section className="concise-section"><h2>协作与对齐</h2><div className="alignment-counts"><button onClick={() => stale[0] && onSelect(stale[0].id)}><strong>{stale.length}</strong>等我处理</button><button onClick={() => blocked[0] && onSelect(blocked[0].id)}><strong>{blocked.length}</strong>我在等待</button><button onClick={() => stale[0] && onSelect(stale[0].id)}><strong>{stale.length}</strong>状态待更新</button></div></section></div>; }

function ManagementRoleOverview({ objects, projections, versions, onSelect }: { objects: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[]; decisions: DecisionRecord[]; onSelect: (id: string) => void }) { const current = versions.filter((version) => version.status === "open").toSorted((a, b) => (a.plannedEndAt ?? "").localeCompare(b.plannedEndAt ?? ""))[0] ?? versions[0]; const linked = current ? objects.filter((object) => object.targetVersionId === current.id) : []; const completed = linked.filter((object) => object.implementation?.status === "已完成" || projections.find((item) => item.objectId === object.id)?.currentStage === "validation"); const risks = linked.filter((object) => object.implementation?.status === "阻塞" || Boolean(object.implementation?.plannedEndAt && object.implementation.plannedEndAt < todayDate() && object.implementation.status !== "已完成")); const progress = current ? versionProgress(current.id, objects, projections) : 0; return <div className="role-dashboard concise-overview management-observation"><section className="version-status"><div><span>当前版本</span><h2>{current ? `V${current.sequence} · ${current.name ?? versionLabel(current)}` : "暂无版本"}</h2><small>{current?.plannedEndAt ? `计划完成 ${formatShortDate(current.plannedEndAt)}` : ""}</small></div><strong className={risks.length ? "danger" : ""}>{risks.length ? "有风险" : "进行顺利"}</strong><div className="version-numbers"><span><strong>{linked.length}</strong>计划</span><span><strong>{completed.length}</strong>已完成</span><span><strong>{Math.max(0, linked.length - completed.length - risks.length)}</strong>进行中</span><span><strong>{risks.length}</strong>风险</span></div><i><b style={{ width: `${progress}%` }} /></i></section>{risks.length > 0 && <section className="concise-section"><h2>关键风险</h2><AttentionList objects={risks} projections={projections} onSelect={onSelect} versionRisk /></section>}<section className="concise-section"><h2>版本变化</h2><div className="version-changes"><p>昨日：{completed.filter((object) => object.updatedAt.slice(0, 10) === previousDate()).length} 项完成实现 / {projections.filter((item) => linked.some((object) => object.id === item.objectId) && item.currentStage === "validation").length} 项进入验证</p><p>近 7 天：完成 {completed.filter((object) => daysSince(object.updatedAt) <= 7).length} 项 / 新增进入版本 {linked.filter((object) => daysSince(object.updatedAt) <= 7).length} 项</p></div></section></div>; }

function RoleScopeSwitch({ value, onChange }: { value: RoleScope; onChange: (value: RoleScope) => void }) { return <div className="role-scope-switch" aria-label="需求范围">{([['all', '全部'], ['owned', '我负责的'], ['submitted', '我提出的']] as const).map(([scope, label]) => <button className={value === scope ? "active" : ""} key={scope} onClick={() => onChange(scope)}>{label}</button>)}</div>; }

function scopeRoleObjects(items: ProductObject[], relations: LineageRelation[], scope: RoleScope, user: string) { if (scope === "all") return items; if (scope === "owned") return items.filter((object) => (isSignalObject(object) ? object.unified.owner : object.owner) === user); const proposedSignalIds = new Set(items.filter((object) => isSignalObject(object) && object.unified.submitter === user).map((object) => object.id)); const proposedTargets = new Set(relations.filter((relation) => proposedSignalIds.has(relation.sourceObjectId)).map((relation) => relation.targetObjectId)); return items.filter((object) => proposedSignalIds.has(object.id) || proposedTargets.has(object.id)); }
const todayDate = () => "2026-08-13"; const previousDate = () => "2026-08-12"; const daysSince = (date: string) => Math.max(0, Math.floor((Date.parse(`${todayDate()}T00:00:00Z`) - Date.parse(`${date.slice(0, 10)}T00:00:00Z`)) / 86400000)); const formatShortDate = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`; const attentionSort = (a: ProductObject, b: ProductObject) => Number(b.implementation?.status === "阻塞") - Number(a.implementation?.status === "阻塞") || ({ P0: 0, P1: 1, P2: 2, P3: 3 }[a.priority ?? "P3"] - { P0: 0, P1: 1, P2: 2, P3: 3 }[b.priority ?? "P3"]) || (a.implementation?.plannedEndAt ?? "9999").localeCompare(b.implementation?.plannedEndAt ?? "9999") || a.updatedAt.localeCompare(b.updatedAt);
function AttentionList({ objects, projections, onSelect, versionRisk = false }: { objects: ProductObject[]; projections: ObjectProjection[]; onSelect: (id: string) => void; versionRisk?: boolean }) { return <div className="attention-object-list">{objects.map((object) => { const projection = projections.find((item) => item.objectId === object.id); const status = object.implementation?.status ?? projection?.currentStageStatus ?? "待处理"; const wait = daysSince(object.implementation?.updatedAt ?? object.updatedAt); const due = object.implementation?.plannedEndAt; return <button key={object.id} onClick={() => onSelect(object.id)}><span>{object.priority ?? "—"}</span><strong>{object.title}</strong><small>{status}{wait ? ` · ${wait}天` : ""}{due && !versionRisk ? ` · ${formatShortDate(due)}` : ""}</small><p>{versionRisk ? "可能影响版本交付" : object.implementation?.blocker || (!object.owner ? "负责人尚未确认" : projection?.currentStage === "validation" ? "等待验证结果" : "")}</p></button>; })}</div>; }

function OwnerScopeFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="overview-owner-filter"><label><span>负责人</span><select value={value} onChange={(event) => onChange(event.target.value)}><option>全部负责人</option>{people.map((person) => <option key={person.id}>{person.name}</option>)}</select></label><small>只改变当前数据范围，不改变当前用户职位视图</small></div>;
}

function DemandOverview({ scope, objects: allObjects, projections: allProjections, events, decisions: allDecisions, stages, mode, onOpenStage, onSelect }: { scope: "global" | "role"; objects: ProductObject[]; projections: ObjectProjection[]; events: EvolutionEvent[]; decisions: DecisionRecord[]; stages: ReadonlyArray<(typeof lifecycleStages)[number]>; mode: ViewMode; onOpenStage: (stage: View) => void; onSelect: (id: string) => void }) {
  const stageCount = (stage: LifecycleStage) => allProjections.filter((projection) => projection.currentStage === stage).length;
  const reviewCount = allProjections.filter((projection) => projection.currentStageStatus.includes("评审")).length;
  const blockedCount = allProjections.filter((projection) => projection.currentStageStatus === "阻塞").length;
  const highPriorityCount = allObjects.filter((object) => object.priority === "P0" || object.priority === "P1").length;
  const attentionRows = mode === "engineering" ? [
    { label: `${stageCount("planning")} 项即将进入研发，需要关注规划变化`, stage: "planning" as LifecycleStage, tone: "calm" },
    { label: `${blockedCount} 项研发存在阻塞`, stage: "implementation" as LifecycleStage, tone: blockedCount ? "danger" : "calm" },
    { label: `${stageCount("validation")} 项正在等待或进行验证`, stage: "validation" as LifecycleStage, tone: "warning" },
  ] : mode === "management" ? [
    { label: `${blockedCount} 项关键工作存在阻塞`, stage: "implementation" as LifecycleStage, tone: blockedCount ? "danger" : "calm" },
    { label: `${highPriorityCount} 项高优先级事项需要持续关注`, stage: "planning" as LifecycleStage, tone: "warning" },
    { label: `${reviewCount} 项等待关键判断`, stage: "planning" as LifecycleStage, tone: "calm" },
  ] : [
    { label: `${stageCount("intake")} 项原始需求等待进一步处理`, stage: "intake" as LifecycleStage, tone: "calm" },
    { label: `${stageCount("refinement")} 项需求停留在提炼阶段`, stage: "refinement" as LifecycleStage, tone: "warning" },
    { label: `${blockedCount} 项研发阻塞正在影响产品推进`, stage: "implementation" as LifecycleStage, tone: blockedCount ? "danger" : "calm" },
  ];
  const visibleObjectIds = new Set(allObjects.map((object) => object.id));
  const relevantEvents = events.filter((event) => visibleObjectIds.has(event.objectId) && (mode === "product" || (mode === "engineering" ? ["planning", "implementation", "validation"].includes(event.stage ?? "") : ["version_assigned", "priority_changed", "validation_recorded"].includes(event.eventType)))).map((event) => ({ id: event.id, objectId: event.objectId, occurredAt: event.occurredAt, label: event.label, detail: event.reason ?? `${event.actor} 记录` }));
  const relevantDecisions = allDecisions.filter((decision) => visibleObjectIds.has(decision.objectId) && mode !== "engineering").map((decision) => ({ id: decision.id, objectId: decision.objectId, occurredAt: decision.decidedAt, label: decision.title, detail: decision.rationale }));
  const recentChanges = [...relevantEvents, ...relevantDecisions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, mode === "management" ? 4 : 6);
  const maxCount = Math.max(1, ...stages.map((stage) => stageCount(stage.id)));
  const roleMetrics = mode === "engineering" ? [
    ["待接手", allProjections.filter((projection) => ["待开发", "待接手"].includes(projection.currentStageStatus)).length],
    ["研发进行中", allProjections.filter((projection) => projection.currentStage === "implementation" && projection.currentStageStatus === "开发中").length],
    ["阻塞事项", blockedCount], ["需要产品确认", reviewCount], ["临近验证", stageCount("validation")], ["当前负载", allObjects.length],
  ] : mode === "management" ? [
    ["高优事项", highPriorityCount], ["生命周期内对象", allObjects.length], ["阻塞与风险", blockedCount],
    ["待关键决策", reviewCount], ["交付验证中", stageCount("validation")], ["近期决策", allDecisions.filter((decision) => new Set(allObjects.map((object) => object.id)).has(decision.objectId)).length],
  ] : [
    ["新进入原始需求", stageCount("intake")], ["待提炼", allObjects.filter((object) => isSignalObject(object) && object.unified.refinementStatus !== "completed").length],
    ["待评审 / 确认", reviewCount], ["高优需求", highPriorityCount], ["即将进入研发", stageCount("planning")], ["规划推进中", stageCount("implementation")],
  ];
  return <>
    {scope === "global" ? <section className="overview-state-section">
      <div className="overview-section-label"><span>01</span><div><h2>{scope === "global" ? "全局状态" : "当前角色状态"}</h2><p>{mode === "engineering" ? "规划进入实现，并继续流向验证" : mode === "management" ? "整体推进是否正常，风险集中在哪里" : "需求在五个阶段中的当前分布与流向"}</p></div></div>
      <div className="overview-lifecycle-flow">{stages.map((stage) => {
        const index = lifecycleStages.findIndex((candidate) => candidate.id === stage.id);
        const count = stageCount(stage.id);
        const muted = mode === "engineering" && ["intake", "refinement"].includes(stage.id);
        return <div className={`overview-flow-stage ${muted ? "muted" : ""}`} key={stage.id}><button onClick={() => onOpenStage(stage.id)}><span>0{index + 1} · {stage.action}</span><strong>{count}</strong><h3>{stage.label}</h3><i><b style={{ width: `${Math.max(8, count / maxCount * 100)}%` }} /></i></button>{stage.id !== stages.at(-1)?.id && <em>→</em>}</div>;
      })}</div>
      <p className="overview-flow-caption">当前对象主要集中在 {stages.toSorted((a, b) => stageCount(b.id) - stageCount(a.id))[0]?.label}，系统继续沿时间向交付验证流动。</p>
    </section> : <section className={`overview-state-section role-attention-state role-attention-${mode}`}><div className="overview-section-label"><span>01</span><div><h2>{mode === "product" ? "产品注意力" : mode === "engineering" ? "研发态势" : "管理关注"}</h2><p>{mode === "product" ? "从需求进入、质量与规划推进中识别需要判断的事项" : mode === "engineering" ? "从接手、实现、阻塞与交付中识别推进风险" : "从优先级、整体进度、风险与决策中观察系统"}</p></div></div><div className="role-attention-metrics">{roleMetrics.map(([label, count]) => <article key={label}><strong>{count}</strong><span>{label}</span></article>)}</div></section>}
    <section className="overview-attention-section"><div className="overview-section-label"><span>02</span><div><h2>需要关注</h2><p>偏离正常流动、存在风险或需要判断的事项</p></div></div><div className="overview-attention-list">{attentionRows.map((row) => <button key={row.label} onClick={() => onOpenStage(row.stage)}><i className={row.tone} /><strong>{row.label}</strong><span>{scope === "global" ? "查看阶段" : "进入工作区"} →</span></button>)}</div></section>
    <section className="overview-changes-section"><div className="overview-section-label"><span>03</span><div><h2>最近变化</h2><p>由现有 Evolution 与 Decision 按时间派生</p></div></div><div className="overview-change-list">{recentChanges.length ? recentChanges.map((change, index) => { const object = allObjects.find((candidate) => candidate.id === change.objectId); const previousDate = recentChanges[index - 1]?.occurredAt.slice(0, 10); const date = change.occurredAt.slice(0, 10); return <div key={change.id}>{date !== previousDate && <time>{date.replaceAll("-", "/")}</time>}<button onClick={() => object && onSelect(object.id)}><span>{object?.type === "signal" ? "原始需求" : object?.key ?? "系统变化"}</span><strong>{change.label}</strong><small>{change.detail}</small></button></div>; }) : <p className="overview-empty">当前视角下暂无重要变化。</p>}</div></section>
  </>;
}

type WorkspaceAction = { id: string; title: string; description: string; count: number; actionLabel: string; onAction: () => void };

function RoleWorkspace({ mode, objects: roleObjects, projections: roleProjections, onStandardize, onRefine, onReview, onPlan, onImplementation, onValidation }: { mode: ViewMode; objects: ProductObject[]; projections: ObjectProjection[]; onStandardize: (id: string) => void; onRefine: (ids: string[]) => void; onReview: (ids: string[]) => void; onPlan: (id: string) => void; onImplementation: (id: string) => void; onValidation: (id: string) => void }) {
  const roleLabel = mode === "product" ? "产品" : mode === "engineering" ? "研发" : "管理";
  const projectionOf = (id: string) => roleProjections.find((projection) => projection.objectId === id);
  const pendingStandardization = roleObjects.filter((object): object is Signal => isSignalObject(object) && ["pending", "failed"].includes(object.unified.standardizationStatus));
  const pendingRefinement = roleObjects.filter((object): object is Signal => isSignalObject(object) && !["pending", "failed"].includes(object.unified.standardizationStatus) && object.unified.refinementStatus !== "completed");
  const pendingReview = roleObjects.filter((object) => object.type === "requirement" && projectionOf(object.id)?.currentStage === "planning" && projectionOf(object.id)?.currentStageStatus === "待评审");
  const pendingPlanning = roleObjects.filter((object) => object.type === "requirement" && object.reviewResult === "approved" && !object.targetVersionId && projectionOf(object.id)?.currentStage === "planning");
  const pendingImplementation = roleObjects.filter((object) => object.type === "requirement" && projectionOf(object.id)?.currentStage === "implementation" && object.implementation?.status !== "已完成");
  const pendingValidation = roleObjects.filter((object) => object.type === "requirement" && projectionOf(object.id)?.currentStage === "validation" && !object.validation?.result);
  const productActions: WorkspaceAction[] = [
    { id: "standardization", title: "原始需求整理", description: `${pendingStandardization.length} 条原始需求等待标准化确认`, count: pendingStandardization.length, actionLabel: "去整理", onAction: () => onStandardize(pendingStandardization[0].id) },
    { id: "refinement", title: "需求提炼", description: `${pendingRefinement.length} 条原始反馈等待提炼`, count: pendingRefinement.length, actionLabel: "去提炼", onAction: () => onRefine(pendingRefinement.map((signal) => signal.id)) },
    { id: "review", title: "需求评审", description: `${pendingReview.length} 条需求等待产品评审`, count: pendingReview.length, actionLabel: "去评审", onAction: () => onReview(pendingReview.map((object) => object.id)) },
    { id: "planning", title: "产品规划", description: `${pendingPlanning.length} 条已通过需求等待规划版本`, count: pendingPlanning.length, actionLabel: "去规划", onAction: () => onPlan(pendingPlanning[0].id) },
  ];
  const engineeringActions: WorkspaceAction[] = [
    { id: "implementation", title: "研发处理", description: `${pendingImplementation.length} 条研发事项等待更新或继续处理`, count: pendingImplementation.length, actionLabel: "去处理", onAction: () => onImplementation(pendingImplementation[0].id) },
    { id: "validation", title: "交付验证", description: `${pendingValidation.length} 条实现结果等待验证`, count: pendingValidation.length, actionLabel: "去验证", onAction: () => onValidation(pendingValidation[0].id) },
  ];
  const actions = (mode === "product" ? productActions : mode === "engineering" ? engineeringActions : []).filter((action) => action.count > 0);
  return <>
    <Header eyebrow={`当前角色 · ${roleLabel}`} title="工作区" copy="现在有什么事情等我处理？" />
    <section className="workspace-actions" aria-label={`${roleLabel}待处理事项`}>
      <div className="workspace-section-heading"><span>待处理</span><small>{actions.length ? `${actions.length} 类事项` : "暂无事项"}</small></div>
      {actions.length ? <div className="workspace-action-list">{actions.map((action) => <article key={action.id}><div className="workspace-action-copy"><span>{action.title}</span><strong>{action.count}</strong><p>{action.description}</p></div><button className="primary-action" onClick={action.onAction}>{action.actionLabel} →</button></article>)}</div> : <div className="workspace-empty"><strong>当前没有需要你处理的事项</strong><p>需要查看整体情况时前往总览；需要查找具体对象时前往生命周期页面。</p></div>}
    </section>
  </>;
}

function ProductAttentionOverview({ objects, projections, events, onOpenStage, onSelect }: { objects: ProductObject[]; projections: ObjectProjection[]; events: EvolutionEvent[]; onOpenStage: (stage: View) => void; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<AttentionType | "all">("all");
  const attentions = deriveAttentionItems({ objects, projections, events, asOf: new Date().toISOString() });
  const flow = [{ label: "原始需求", stage: "intake" as const }, { label: "待提炼", stage: "refinement" as const }, { label: "待评审", stage: "planning" as const }, { label: "研发中", stage: "implementation" as const }, { label: "待验证", stage: "validation" as const }];
  const types: Array<[AttentionType, string]> = [["stalled", "超时停留"], ["waiting_collaboration", "等待协作"], ["unowned", "负责人为空"], ["blocked", "阻塞"], ["stale_update", "长期未更新"]];
  const visible = attentions.filter((item) => filter === "all" || item.type === filter);
  return <div className="role-dashboard concise-overview"><section className="concise-section"><h2>需求流转</h2><div className="concise-flow">{flow.map((item, index) => <div key={item.stage}><button onClick={() => onOpenStage(item.stage)}><strong>{projections.filter((projection) => projection.currentStage === item.stage).length}</strong><span>{item.label}</span></button>{index < flow.length - 1 && <em>→</em>}</div>)}</div></section><AttentionFilters items={attentions} filters={types} active={filter} onChange={setFilter} /><section className="concise-section"><h2>需要关注</h2><AttentionItemList items={visible} onSelect={onSelect} /></section></div>;
}

function EngineeringAttentionOverview({ objects, projections, events, onSelect }: { objects: ProductObject[]; projections: ObjectProjection[]; events: EvolutionEvent[]; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<AttentionType | "all">("all");
  const attentions = deriveAttentionItems({ objects, projections, events, asOf: new Date().toISOString() });
  const implementations = objects.filter((object) => object.implementation && object.implementation.status !== "已完成");
  const types: Array<[AttentionType, string]> = [["stale_update", "等我处理"], ["waiting_collaboration", "我在等待"], ["blocked", "阻塞"], ["stale_update", "状态待更新"], ["due_soon", "临近交付"], ["high_priority_pending", "高优先级待实现"]];
  const visible = attentions.filter((item) => filter === "all" || item.type === filter);
  return <div className="role-dashboard concise-overview"><RoleMetrics items={[{ label: "待实现", value: implementations.filter((object) => object.implementation?.status === "待开发").length }, { label: "实现中", value: implementations.filter((object) => object.implementation?.status === "开发中").length }, { label: "阻塞", value: implementations.filter((object) => object.implementation?.status === "阻塞").length, tone: "danger" }, { label: "待验证", value: projections.filter((projection) => projection.currentStage === "validation").length }]} /><AttentionFilters items={attentions} filters={types} active={filter} onChange={setFilter} /><section className="concise-section"><h2>优先处理</h2><AttentionItemList items={visible} onSelect={onSelect} /></section></div>;
}

function AttentionFilters({ items, filters, active, onChange }: { items: AttentionItem[]; filters: Array<[AttentionType, string]>; active: AttentionType | "all"; onChange: (value: AttentionType | "all") => void }) {
  return <div className="attention-filters">{filters.map(([type, label]) => { const count = items.filter((item) => item.type === type).length; return count ? <button className={active === type ? "active" : ""} key={`${type}-${label}`} onClick={() => onChange(active === type ? "all" : type)}><strong>{count}</strong><span>{label}</span></button> : null; })}</div>;
}

function AttentionItemList({ items, onSelect }: { items: AttentionItem[]; onSelect: (id: string) => void }) {
  return <div className="attention-item-list">{items.map((item) => <button key={item.id} onClick={() => onSelect(item.objectId)}><span>{item.priority ?? "—"}</span><strong>{item.objectTitle}</strong><small>{item.stageLabel} · {item.label} · 已持续 {item.durationDays} 天</small><p>{item.reason}{item.waitingFor ? ` · 等待${item.waitingFor}` : ""}</p><em>{item.owner ?? "负责人未确认"}</em></button>)}{!items.length && <p className="overview-empty">当前没有未解决的 Attention。</p>}</div>;
}

function StageView({ stage, objects: allObjects, projections: allProjections, versions, viewMode, query, setQuery, owner, setOwner, priority, setPriority, onSelect, onNewDemand, onImportTable, onSyncFeedback, onStartRefinement, onStartReview }: { stage: LifecycleStage; objects: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[]; viewMode: ViewMode; query: string; setQuery: (value: string) => void; owner: string; setOwner: (value: string) => void; priority: string; setPriority: (value: string) => void; onSelect: (id: string) => void; onNewDemand: () => void; onImportTable: () => void; onSyncFeedback: () => void; onStartRefinement: (selectedIds: string[]) => void; onStartReview: () => void }) {
  const [source, setSource] = useState<SignalSourceType | "all">("all");
  const [status, setStatus] = useState("全部状态");
  const [signalLibraryFilter, setSignalLibraryFilter] = useState<SignalLibraryFilter>("all");
  const [planningFilter, setPlanningFilter] = useState<PlanningFilter>("all");
  const [selectedRefinementIds, setSelectedRefinementIds] = useState<string[]>([]);
  const intakeObjects = useMemo(() => allObjects.filter(isSignalObject), [allObjects]);
  const stageObjects = useMemo(() => allObjects.filter((object) => {
    const projection = allProjections.find((candidate) => candidate.objectId === object.id);
    const unified = isSignalObject(object) ? object.unified : undefined;
    const searchable = stage === "intake" ? `${unified?.title ?? object.title}${unified?.content ?? object.summary}` : `${object.title}${object.key}${object.summary}`;
    const matchesQuery = searchable.toLowerCase().includes(query.toLowerCase());
    const matchesSource = stage !== "intake" || source === "all" || signalSourceFor(object) === source;
    const matchesStatus = stage !== "intake" || status === "全部状态" || (unified?.processingStatus ?? projection?.currentStageStatus) === status;
    const matchesLibrary = stage !== "intake" || (isSignalObject(object) && matchesSignalLibraryFilter(object, signalLibraryFilter));
    const matchesPlanning = stage !== "planning" || (object.type === "requirement" && (planningFilter === "all" || planningFilter === "pending_review" && projection?.currentStage === "planning" && projection.currentStageStatus === "待评审" || planningFilter === "pending_version" && projection?.currentStage === "planning" && projection.currentStageStatus === "待版本规划" || planningFilter.startsWith("version:") && object.targetVersionId === planningFilter.slice(8)));
    const matchesOwner = owner === "全部负责人" || (unified?.owner ?? object.owner) === owner;
    const matchesPriority = priority === "全部优先级" || (unified?.priority ?? object.priority) === priority;
    const refinementInput = stage === "refinement" && isSignalObject(object) && !["pending", "failed"].includes(object.unified.standardizationStatus);
    const belongsToWorkspace = stage === "intake" ? isSignalObject(object) : stage === "planning" ? object.type === "requirement" : projection?.currentStage === stage || refinementInput;
    return belongsToWorkspace && matchesQuery && matchesSource && matchesStatus && matchesLibrary && matchesPlanning && matchesOwner && matchesPriority;
  }), [allObjects, allProjections, stage, query, source, status, signalLibraryFilter, planningFilter, owner, priority]);
  const stat = stageStats[stage];
  return <>
    <Header eyebrow={stageById(stage).action} title={stageById(stage).label} copy={stageCopy[stage]} action={viewMode === "product" && stage === "intake" ? <NewDemandMenu onManual={onNewDemand} onTable={onImportTable} onFeedback={onSyncFeedback} /> : viewMode === "product" && stage === "refinement" && stageObjects.some((object) => isSignalObject(object) && object.unified.refinementStatus !== "completed") ? <button className="primary-action" disabled={!selectedRefinementIds.length} onClick={() => onStartRefinement(selectedRefinementIds)}>开始提炼{selectedRefinementIds.length ? `（${selectedRefinementIds.length}）` : ""}</button> : viewMode === "product" && stage === "planning" && stageObjects.some((object) => allProjections.find((projection) => projection.objectId === object.id)?.currentStageStatus === "待评审") ? <button className="primary-action" onClick={onStartReview}>开始评审</button> : undefined} />
    {viewMode === "product" && stage === "intake" ? <><SourceSummary objects={intakeObjects} active={source} onSelect={setSource} /><SignalLibraryTabs signals={intakeObjects.filter(isSignalObject)} active={signalLibraryFilter} onSelect={setSignalLibraryFilter} /></> : viewMode === "product" && stage === "refinement" ? <div className="planning-review-summary">{(["pending_refinement", "pending_confirmation", "completed"] as const).map((value) => <div key={value}><strong>{stageObjects.filter((object) => isSignalObject(object) && object.unified.refinementStatus === value).length}</strong><span>{{ pending_refinement: "待提炼", pending_confirmation: "待确认", completed: "已提炼" }[value]}</span></div>)}</div> : viewMode === "product" && stage === "planning" ? <PlanningTabs objects={allObjects.filter((object) => object.type === "requirement")} projections={allProjections} versions={versions} active={planningFilter} onSelect={setPlanningFilter} /> : viewMode === "product" ? <div className="stage-summary-row">
      <div><strong>{stat.total}</strong><span>当前对象</span></div><div><strong>{stageObjects.length}</strong><span>示例数据</span></div><div><strong className={stat.tone}>{stat.note.split(" ")[0]}</strong><span>{stat.note.split(" ").slice(1).join(" ")}</span></div>
    </div> : <div className="role-projection-note"><span>{viewMode === "engineering" ? "研发视角" : "管理视角"}</span><p>{viewMode === "engineering" ? "已隐藏产品整理过程，聚焦实现、进度、风险和验证。" : "已隐藏执行细节，聚焦重点、负责人、风险和决策。"}</p></div>}
    <div className="toolbar">
      <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={stage === "intake" ? "搜索标题或描述" : "搜索对象、编号或描述"} aria-label="搜索需求" /></label>
      {viewMode === "product" && stage === "intake" && <select value={source} onChange={(event) => setSource(event.target.value as SignalSourceType | "all")} aria-label="来源筛选"><option value="all">全部来源</option><option value="team_discovery">团队发现</option><option value="product_feedback">产品反馈</option><option value="user_feedback">用户反馈</option></select>}
      {viewMode === "product" && stage === "intake" && <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="状态筛选"><option>全部状态</option><option>已汇入</option><option>已记录</option><option>待澄清</option><option>需响应</option></select>}
      {viewMode !== "engineering" && <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="优先级筛选"><option>全部优先级</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select>}
      <select value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="负责人筛选"><option>全部负责人</option>{people.map((person) => <option key={person.id}>{person.name}</option>)}</select>
      {viewMode === "product" && <button className="filter-button">更新时间 ↓</button>}
    </div>
    <section className={`object-table panel ${stage === "intake" ? "intake-table" : ""}`}>
      {viewMode !== "product" ? <div className="role-table-head"><span>对象</span><span>{viewMode === "engineering" ? "实现关注" : "重点信息"}</span><span>状态</span><span>查看</span></div> : stage === "intake" ? <div className="intake-table-head"><span>标题</span><span>来源</span><span>优先级</span><span>状态</span><span>负责人</span><span>提出时间</span></div> :
      stage === "refinement" ? <div className="refinement-select-head"><span>选择</span><span>Signal</span><span>来源</span><span>负责人</span><span>提炼状态</span></div> : <div className="table-head"><span>对象</span><span>结构</span><span>负责人</span><span>当前状态</span></div>
      }
      {stageObjects.length ? viewMode !== "product" ? <ModeProjectedList mode={viewMode} objects={stageObjects} projections={allProjections} versions={versions} onSelect={onSelect} /> : stage === "intake" ? <IntakeList objects={stageObjects} projections={allProjections} onSelect={onSelect} /> : stage === "refinement" ? <RefinementSelectionList objects={stageObjects.filter(isSignalObject)} selectedIds={selectedRefinementIds} onSelectedIdsChange={setSelectedRefinementIds} onSelect={onSelect} /> : <ObjectList objects={stageObjects} projections={allProjections} versions={versions} onSelect={onSelect} /> : <div className="empty-state"><strong>当前视角下没有需要展示的对象</strong><span>切换视角或阶段后查看其他内容。</span></div>}
    </section>
  </>;
}

const sourceLabels: Record<SignalSourceType, string> = { team_discovery: "团队发现", product_feedback: "产品反馈", user_feedback: "用户反馈" };

function signalSourceFor(object: ProductObject): SignalSourceType | undefined {
  if (isSignalObject(object)) return object.unified.sourceType;
  return undefined;
}

function isSignalObject(object: ProductObject): object is Signal {
  return object.type === "signal" && "unified" in object && "rawData" in object;
}

function SourceSummary({ objects: intakeObjects, active, onSelect }: { objects: ProductObject[]; active: SignalSourceType | "all"; onSelect: (source: SignalSourceType | "all") => void }) {
  const sources: SignalSourceType[] = ["team_discovery", "product_feedback", "user_feedback"];
  return <div className="source-summary" aria-label="按来源快速筛选">
    <button className={active === "all" ? "active" : ""} onClick={() => onSelect("all")}><strong>{intakeObjects.length}</strong><span className="source-tag source-all">全部需求</span></button>
    {sources.map((source) => <button key={source} className={active === source ? "active" : ""} onClick={() => onSelect(source)}><strong>{intakeObjects.filter((object) => signalSourceFor(object) === source).length}</strong><span className={`source-tag source-${source}`}>{sourceLabels[source]}</span></button>)}
  </div>;
}

function SignalLibraryTabs({ signals, active, onSelect }: { signals: Signal[]; active: SignalLibraryFilter; onSelect: (filter: SignalLibraryFilter) => void }) {
  const tabs: Array<[SignalLibraryFilter, string]> = [["all", "全部"], ["pending_standardization", "待标准化"], ["pending_refinement", "待提炼"], ["completed", "已提炼"], ["ended", "已结束"]];
  return <div className="signal-library-tabs" aria-label="原始需求处理状态">{tabs.map(([filter, label]) => <button key={filter} className={active === filter ? "active" : ""} onClick={() => onSelect(filter)}><span>{label}</span><strong>{filter === "all" ? signals.length : signals.filter((signal) => signalLibraryState(signal) === filter).length}</strong></button>)}</div>;
}

function RefinementSelectionList({ objects: signals, selectedIds, onSelectedIdsChange, onSelect }: { objects: Signal[]; selectedIds: string[]; onSelectedIdsChange: (ids: string[]) => void; onSelect: (id: string) => void }) {
  const eligible = eligibleRefinementSignals(signals);
  const allVisibleSelected = eligible.length > 0 && eligible.every((signal) => selectedIds.includes(signal.id));
  const toggle = (id: string) => onSelectedIdsChange(toggleRefinementSelection(selectedIds, id));
  const toggleVisible = () => onSelectedIdsChange(toggleVisibleRefinementSelection(selectedIds, signals));
  return <div className="refinement-selection-list"><div className="refinement-select-all"><label><input type="checkbox" checked={allVisibleSelected} disabled={!eligible.length} onChange={toggleVisible} /> 选择当前列表中可提炼的 Signal</label><span>已选择 {selectedIds.length} 条</span></div>{signals.map((signal) => { const canRefine = eligible.some((candidate) => candidate.id === signal.id); return <div className={`refinement-select-row ${canRefine ? "" : "disabled"}`} key={signal.id}><input type="checkbox" aria-label={`选择 ${signal.unified.title}`} checked={selectedIds.includes(signal.id)} disabled={!canRefine} onChange={() => toggle(signal.id)} /><button onClick={() => onSelect(signal.id)}><strong>{signal.unified.title}</strong><small>{signal.standardized?.problem || signal.unified.content}</small></button><span>{sourceLabels[signal.unified.sourceType]}</span><span>{signal.unified.owner ?? ""}</span><span>{signal.unified.refinementStatus === "completed" ? "已提炼" : signal.unified.refinementStatus === "pending_confirmation" ? "待确认" : "待提炼"}</span></div>; })}</div>;
}

function PlanningTabs({ objects: requirements, projections: sourceProjections, versions, active, onSelect }: { objects: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[]; active: PlanningFilter; onSelect: (filter: PlanningFilter) => void }) {
  const fixed: Array<[PlanningFilter, string, number]> = [
    ["all", "全部", requirements.length],
    ["pending_review", "待评审", requirements.filter((object) => sourceProjections.find((projection) => projection.objectId === object.id)?.currentStageStatus === "待评审").length],
    ["pending_version", "待版本规划", requirements.filter((object) => sourceProjections.find((projection) => projection.objectId === object.id)?.currentStageStatus === "待版本规划").length],
  ];
  return <div className="planning-tabs" aria-label="产品规划状态与版本">{fixed.map(([filter, label, count]) => <button key={filter} className={active === filter ? "active" : ""} onClick={() => onSelect(filter)}><span>{label}</span><strong>{count}</strong></button>)}{versions.toSorted((a, b) => a.sequence - b.sequence).map((version) => { const filter = `version:${version.id}` as PlanningFilter; return <button key={version.id} className={active === filter ? "active" : ""} onClick={() => onSelect(filter)}><span>{versionLabel(version)}</span><strong>{requirements.filter((object) => object.targetVersionId === version.id).length}</strong></button>; })}</div>;
}

function statusToneFor(status: string) {
  if (status === "需响应") return "attention";
  if (status === "待澄清") return "pending";
  if (status === "已汇入") return "imported";
  return "recorded";
}

function IntakeList({ objects: intakeObjects, projections: sourceProjections, onSelect }: { objects: ProductObject[]; projections: ObjectProjection[]; onSelect: (id: string) => void }) {
  return <div>{intakeObjects.map((object) => {
    const projection = sourceProjections.find((candidate) => candidate.objectId === object.id)!;
    const signal = isSignalObject(object) ? object : undefined;
    const fields = signal?.unified;
    const source = signalSourceFor(object);
    const attention = attentionFor(object, projection);
    const intakeStatus = fields?.refinementStatus === "completed" ? "已提炼" : fields?.refinementStatus ? "待提炼" : fields?.processingStatus ?? projection.currentStageStatus;
    return <button className="intake-row" key={object.id} onClick={() => onSelect(object.id)}>
      <div className="object-main"><strong>{fields?.title ?? object.title}</strong><p>{fields?.content ?? object.summary}</p></div>
      <div className="source-cell"><span className={`source-tag ${source ? `source-${source}` : "source-all"}`}>{source ? sourceLabels[source] : "未分类"}</span></div>
      <div>{fields?.priority ? <span className={`priority priority-${fields.priority}`}>{fields.priority}</span> : null}</div>
      <div><span className={`status-tag status-${attention ? "pending" : statusToneFor(intakeStatus)}`}>{attention?.label ?? intakeStatus}</span></div>
      <div className="intake-owner">{fields?.owner ?? object.owner ?? ""}</div>
      <time>{(fields?.createdAt ?? object.createdAt).slice(5, 10).replace("-", "/")}</time>
    </button>;
  })}</div>;
}

function ModeProjectedList({ mode, objects: list, projections: sourceProjections, versions, onSelect }: { mode: Exclude<ViewMode, "product">; objects: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[]; onSelect: (id: string) => void }) {
  return <div>{list.map((object) => {
    const projection = sourceProjections.find((candidate) => candidate.objectId === object.id)!;
    const focus = mode === "engineering" ? `${object.owner ?? ""} · ${versionName(object.targetVersionId, versions)}` : `${object.priority ?? ""}${object.priority && object.owner ? " · " : ""}${object.owner ?? ""}`;
    return <button className="role-object-row" key={object.id} onClick={() => onSelect(object.id)}><div className="object-main"><strong>{object.title}</strong><p>{object.summary}</p></div><div className="role-responsibility"><span>{mode === "engineering" ? "负责人 / 版本" : "优先级 / 负责人"}</span><strong>{focus}</strong></div><span className={`status-tag ${projection.currentStageStatus === "阻塞" ? "status-attention" : "status-recorded"}`}>{projection.currentStageStatus}</span><span className="role-row-action">查看 →</span></button>;
  })}</div>;
}

function ObjectList({ objects: list, projections: sourceProjections = projections, versions = mockVersions, onSelect, compact = false }: { objects: ProductObject[]; projections?: ObjectProjection[]; versions?: ProductVersion[]; onSelect: (id: string) => void; compact?: boolean }) {
  return <div className={`object-list ${compact ? "compact" : ""}`}>{list.map((object) => {
    const projection = sourceProjections.find((candidate) => candidate.objectId === object.id) ?? projectionFor(object.id);
    const sources = lineage.filter((relation) => relation.targetObjectId === object.id).length;
    return <button className="object-row" key={object.id} onClick={() => onSelect(object.id)}>
      <div className="object-main"><div><span className="object-key">{object.key}</span>{object.priority && <span className={`priority priority-${object.priority}`}>{object.priority}</span>}</div><strong>{object.title}</strong><p>{object.summary}</p></div>
      {!compact && <div className="object-structure"><span>{versionName(object.targetVersionId, versions)}</span><small>{sources ? `来自 ${sources} 个对象` : object.sourceKind ?? "独立对象"}</small></div>}
      {!compact && <div className="object-owner">{object.owner ? <><span className="avatar">{object.owner.slice(0, 1)}</span>{object.owner}</> : null}</div>}
      <div className="object-status"><span className={`status-dot ${projection.currentStage}`} />{projection.currentStageStatus}<b>›</b></div>
    </button>;
  })}</div>;
}

function versionName(versionId: string | undefined, versions: ProductVersion[]) {
  const version = versions.find((item) => item.id === versionId);
  return version ? versionLabel(version) : "未规划";
}

function ObjectDrawer({ object, allObjects, projections: sourceProjections, versions, allEvolution, records: allDecisions, relations, transformations: allTransformations, onSelect, onProcess, onReturn, onRefine, onReview, onRerefine, onPlanVersion, onStageAction, onClose }: { object: ProductObject; allObjects: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[]; allEvolution: EvolutionEvent[]; records: DecisionRecord[]; relations: LineageRelation[]; transformations: Transformation[]; onSelect: (id: string) => void; onProcess: () => void; onReturn: () => void; onRefine: () => void; onReview: () => void; onRerefine: () => void; onPlanVersion: () => void; onStageAction: (kind: "implementation" | "validation") => void; onClose: () => void }) {
  const [graphOpen, setGraphOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"information" | "evolution">("information");
  const projection = sourceProjections.find((candidate) => candidate.objectId === object.id) ?? projectionFor(object.id);
  const attention = attentionFor(object, projection);
  const upstream = relations.filter((relation) => relation.targetObjectId === object.id).map((relation) => allObjects.find((candidate) => candidate.id === relation.sourceObjectId)!).filter(Boolean);
  const downstream = relations.filter((relation) => relation.sourceObjectId === object.id).map((relation) => allObjects.find((candidate) => candidate.id === relation.targetObjectId)!).filter(Boolean);
  const history = allEvolution.filter((event) => event.objectId === object.id).sort((a, b) => b.sequence - a.sequence);
  const records = allDecisions.filter((decision) => decision.objectId === object.id);
  return <><div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${object.title} 详情`}>
    <button className="drawer-scrim" onClick={onClose} aria-label="关闭详情" />
    <aside className="drawer">
      <div className="drawer-header"><div><ContextBackEntry onBack={onClose} /><span className="object-key">{object.type === "signal" ? "原始需求" : `${object.key} · ${object.type.toUpperCase()}`}</span><h2>{object.title}</h2></div><div className="object-header-actions"><button disabled>编辑</button>{stageIndex(projection.currentStage) > 0 && <button onClick={onReturn}>返回上一步</button>}<button disabled>更多</button><button onClick={onClose} aria-label="关闭详情">×</button></div></div>
      <LifecycleStepper current={projection.currentStage} />
      <DetailTabs value={detailTab} onChange={setDetailTab} />
      <div className="drawer-body">
        {detailTab === "information" && attention && <div className="drawer-attention"><div><span className="attention-dot" /><strong>{attention.label}</strong><small>此事项需要人工介入</small></div>{isSignalObject(object) && object.unified.standardizationStatus === "pending" && <button onClick={onProcess}>处理</button>}</div>}
        {detailTab === "information" && <>
        {isSignalObject(object) ? <SignalDetails signal={object} allObjects={allObjects} projections={sourceProjections} versions={versions} /> : <section className="detail-section"><div className="detail-label">当前形态</div><p className="detail-summary">{object.summary}</p>
          <div className="facts"><Fact label="当前状态" value={projection.currentStageStatus} /><Fact label="负责人" value={object.owner ?? ""} /><Fact label="优先级" value={object.priority ?? ""} /><Fact label="目标版本" value={versionName(object.targetVersionId, versions)} /><Fact label="当前周期" value={projection.currentCycleId.replace("cycle-", "#")} /><Fact label="最近更新" value={object.updatedAt.slice(5).replace("-", "/")} /></div>
        </section>}
        {isSignalObject(object) && !["pending", "failed"].includes(object.unified.standardizationStatus) && object.unified.refinementStatus !== "completed" && <DeliveryFacts title="需求提炼" action="处理当前需求" onAction={onRefine} facts={[["当前状态", object.unified.refinementStatus === "pending_confirmation" ? "待确认" : "待提炼"], ["处理方式", "人工提炼或 AI 建议"]]} />}
        {object.type === "requirement" && projection.currentStage === "planning" && projection.currentStageStatus === "待评审" && <DeliveryFacts title="产品规划 / 评审" action="评审当前需求" onAction={onReview} facts={[["优先级", object.priority ?? "待定"], ["负责人", object.owner ?? ""], ["评审状态", projection.currentStageStatus]]} />}
        {object.type === "requirement" && history.some((event) => event.eventType === "review_recorded") && <DeliveryFacts title="评审后的需求整理" action="再次提炼" onAction={onRerefine} facts={[["当前 Requirement", object.title], ["最近评审备注", history.find((event) => event.eventType === "review_recorded")?.reason || "暂无备注"], ["处理结果", "更新当前 Requirement，保留内容变化历史"]]} />}
        {object.type === "requirement" && object.reviewResult === "approved" && <DeliveryFacts title="版本规划" action={object.targetVersionId ? "调整版本" : "规划版本"} onAction={onPlanVersion} facts={[["评审结果", "已通过"], ["目标版本", versionName(object.targetVersionId, versions)], ["规划状态", object.targetVersionId ? "已进入版本" : "待版本规划"]]} />}
        {projection.currentStage === "implementation" && <DeliveryFacts title="研发实现" action="更新进展" onAction={() => onStageAction("implementation")} facts={[["负责人", object.owner ?? ""], ["当前状态", object.implementation?.status ?? projection.currentStageStatus], ["实现说明", object.implementation?.description || "尚未填写"], ["问题 / 阻塞", object.implementation?.blocker || "暂无"]]} />}
        {projection.currentStage === "validation" && <DeliveryFacts title="交付验证" action="完成验证" onAction={() => onStageAction("validation")} facts={[["原始目标", object.validation?.originalGoal || object.summary], ["实现结果", object.validation?.implementationResult || object.implementation?.description || "尚未记录"], ["验证结果", object.validation?.result || "待验证"], ["验证记录", object.validation?.record || "尚未填写"], ["新反馈", object.validation?.newFeedback || "暂无"]]} />}
        </>}
        {detailTab === "evolution" && <>
        {(upstream.length > 0 || downstream.length > 0) && <section className="detail-section"><div className="section-heading"><div><div className="detail-label">来源与去向</div><h3>由什么生成，又生成了什么</h3></div><button className="lineage-graph-link" onClick={() => setGraphOpen(true)}>查看图谱</button></div><LineageView current={object} upstream={upstream} downstream={downstream} relations={relations} onSelect={onSelect} /></section>}
        <section className="detail-section"><div className="detail-label">处理记录</div><h3>操作历史</h3>
          {history.length ? <div className="timeline">{history.map((event) => <div className="timeline-item" key={event.id}><span className="timeline-dot" /><div><time>{event.occurredAt.slice(5).replace("-", "/")}</time><strong>{event.label}</strong>{event.reason && <p>{event.reason}</p>}<small>{event.actor} · {event.cycleId.replace("cycle-", "周期 ")}</small></div></div>)}</div> : <p className="muted-copy">该示例对象暂未展开操作记录。</p>}
        </section>
        <section className="detail-section"><div className="detail-label">决策记录</div><h3>为什么成为现在这样</h3>
          {records.length ? records.map((record) => <article className="decision" key={record.id}><div><strong>{record.title}</strong><time>{record.decidedAt.slice(5).replace("-", "/")}</time></div><p>{record.rationale}</p><small>{record.decidedBy}</small></article>) : <p className="muted-copy">该示例对象暂未记录独立决策。</p>}
        </section>
        </>}
      </div>
    </aside>
  </div>{graphOpen && <LineageGraph current={object} objects={allObjects} relations={relations} transformations={allTransformations} onClose={() => setGraphOpen(false)} onSelect={(id) => { setGraphOpen(false); onSelect(id); }} />}</>;
}

function DetailTabs({ value, onChange }: { value: "information" | "evolution"; onChange: (value: "information" | "evolution") => void }) {
  return <div className="object-detail-tabs" role="tablist" aria-label="需求详情"><button role="tab" aria-selected={value === "information"} className={value === "information" ? "active" : ""} onClick={() => onChange("information")}>需求信息</button><button role="tab" aria-selected={value === "evolution"} className={value === "evolution" ? "active" : ""} onClick={() => onChange("evolution")}>演化记录</button></div>;
}

function ProjectedObjectDrawer({ mode, object, projection, versions, evidence, decisions: objectDecisions, onReturn, onStageAction, onClose }: { mode: Exclude<ViewMode, "product">; object: ProductObject; projection: ObjectProjection; versions: ProductVersion[]; evidence: ProductObject[]; decisions: DecisionRecord[]; onReturn: () => void; onStageAction: (kind: "implementation" | "validation") => void; onClose: () => void }) {
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${object.title} 详情`}><button className="drawer-scrim" onClick={onClose} aria-label="关闭详情" /><aside className="drawer projected-drawer"><div className="drawer-header"><div><span className="object-key">{stageById(projection.currentStage).label}</span><h2>{object.title}</h2></div><div className="object-header-actions">{stageIndex(projection.currentStage) > 0 && <button onClick={onReturn}>返回上一步</button>}<button onClick={onClose} aria-label="关闭详情">×</button></div></div><LifecycleStepper current={projection.currentStage} /><div className="drawer-body">
    <section className="detail-section"><div className="detail-label">{mode === "engineering" ? "需求与目标" : "重点事项"}</div><p className="detail-summary">{object.summary}</p>{mode === "management" && evidence.length > 0 && <p className="projection-evidence-count">影响范围：关联 {evidence.length} 条来源</p>}</section>
    <section className="detail-section"><div className="detail-label">{mode === "engineering" ? "研发信息" : "整体状态"}</div><h3>{mode === "engineering" ? "实现所需上下文" : "管理关注信息"}</h3><div className="projection-review-facts"><Fact label="负责人" value={object.owner ?? ""} /><Fact label={mode === "engineering" ? "目标版本" : "优先级"} value={mode === "engineering" ? versionName(object.targetVersionId, versions) : object.priority ?? ""} /><Fact label="当前状态" value={projection.currentStageStatus} /></div></section>
    {mode === "management" && objectDecisions.length > 0 && <section className="detail-section"><div className="detail-label">关键 Decision</div><h3>需要了解的判断依据</h3><div className="projection-prior-decisions">{objectDecisions.map((decision) => <article key={decision.id}><strong>{decision.title}</strong><p>{decision.rationale}</p></article>)}</div></section>}
    {mode === "engineering" && projection.currentStage === "implementation" && <DeliveryFacts title="研发实现" action="更新进展" onAction={() => onStageAction("implementation")} facts={[["实现说明", object.implementation?.description || "尚未填写"], ["问题 / 阻塞", object.implementation?.blocker || "暂无"]]} />}
    {mode === "engineering" && projection.currentStage === "validation" && <DeliveryFacts title="交付验证" action="完成验证" onAction={() => onStageAction("validation")} facts={[["实现结果", object.validation?.implementationResult || object.implementation?.description || "尚未记录"], ["验证结论", object.validation?.result || "待验证"], ["验证问题", object.validation?.record || "尚未填写"]]} />}
  </div></aside></div>;
}

function LifecycleStepper({ current }: { current: LifecycleStage }) {
  const currentIndex = stageIndex(current);
  return <div className="stepper">{lifecycleStages.map((stage, index) => <div className={`step ${index < currentIndex ? "done" : index === currentIndex ? "current" : "future"}`} key={stage.id}><span>{index < currentIndex ? "✓" : ""}</span><small>{stage.label}</small>{index < lifecycleStages.length - 1 && <i />}</div>)}</div>;
}

const transformationLabels = { refinement: "提炼", merge: "合并", split: "拆分", new_signal: "形成新 Signal", content_adjustment: "内容调整" } as const;
function objectDisplayType(object: ProductObject) { return isSignalObject(object) ? sourceLabels[object.unified.sourceType] : "Requirement"; }
function LineageView({ current, upstream, downstream, relations, onSelect }: { current: ProductObject; upstream: ProductObject[]; downstream: ProductObject[]; relations: LineageRelation[]; onSelect: (id: string) => void }) {
  const relationFor = (objectId: string, direction: "up" | "down") => relations.find((relation) => direction === "up" ? relation.sourceObjectId === objectId && relation.targetObjectId === current.id : relation.sourceObjectId === current.id && relation.targetObjectId === objectId)!;
  return <div className="lineage-summary">{upstream.length > 0 && <div><span>来源</span>{upstream.map((object) => { const relation = relationFor(object.id, "up"); return <button key={object.id} onClick={() => onSelect(object.id)}><strong>{object.type === "signal" ? object.title : object.key}</strong><small>{objectDisplayType(object)} · 经{transformationLabels[relation.transformationType]}形成当前对象</small></button>; })}</div>}{downstream.length > 0 && <div><span>去向</span>{downstream.map((object) => { const relation = relationFor(object.id, "down"); return <button key={object.id} onClick={() => onSelect(object.id)}><strong>{object.type === "signal" ? object.title : object.key}</strong><small>{relation.transformationType === "merge" ? "当前需求已合并至此" : relation.transformationType === "split" ? "由当前需求拆分形成" : relation.transformationType === "new_signal" ? "由当前对象产生的新 Signal" : "由当前需求提炼形成"}</small></button>; })}</div>}</div>;
}

function LineageGraph({ current, objects: allObjects, relations, transformations: allTransformations, onClose, onSelect }: { current: ProductObject; objects: ProductObject[]; relations: LineageRelation[]; transformations: Transformation[]; onClose: () => void; onSelect: (id: string) => void }) {
  const direct = relations.filter((relation) => relation.sourceObjectId === current.id || relation.targetObjectId === current.id);
  const upstream = [...new Set(direct.filter((relation) => relation.targetObjectId === current.id).map((relation) => relation.sourceObjectId))].map((id) => allObjects.find((object) => object.id === id)!).filter(Boolean);
  const downstream = [...new Set(direct.filter((relation) => relation.sourceObjectId === current.id).map((relation) => relation.targetObjectId))].map((id) => allObjects.find((object) => object.id === id)!).filter(Boolean);
  const directTransformations = [...new Set(direct.map((relation) => relation.transformationId))].map((id) => allTransformations.find((transformation) => transformation.id === id)).filter((transformation): transformation is Transformation => Boolean(transformation));
  const incoming = directTransformations.filter((transformation) => transformation.targetObjectIds.includes(current.id));
  const outgoing = directTransformations.filter((transformation) => transformation.sourceObjectIds.includes(current.id));
  const node = (object: ProductObject, active = false) => <button className={`lineage-graph-node ${active ? "active" : ""}`} key={object.id} onClick={() => onSelect(object.id)}><small>{object.type === "signal" ? "Signal" : object.key}</small><strong>{object.title}</strong></button>;
  return <div className="lineage-graph-layer" role="dialog" aria-modal="true" aria-label={`${current.title} 来源与去向图谱`}><button className="lineage-graph-scrim" onClick={onClose} aria-label="关闭图谱" /><section className="lineage-graph-dialog"><header><div><span>来源与去向</span><h2>一跳生成关系</h2></div><button onClick={onClose}>×</button></header><div className="lineage-graph-canvas"><div className="lineage-graph-column">{upstream.map((object) => node(object))}</div>{upstream.length > 0 && <><i>→</i><div className="transformation-node">{incoming.map((transformation) => <span key={transformation.id}>{transformationLabels[transformation.type]}</span>)}</div><i>→</i></>}<div className="lineage-graph-column current">{node(current, true)}</div>{downstream.length > 0 && <><i>→</i><div className="transformation-node">{outgoing.map((transformation) => <span key={transformation.id}>{transformationLabels[transformation.type]}</span>)}</div><i>→</i><div className="lineage-graph-column">{downstream.map((object) => node(object))}</div></>}</div><footer>仅展示当前对象、直接上游、直接下游与已经确认的 Transformation。</footer></section></div>;
}

const standardizationLabels = { pending: "待标准化", standardized: "已标准化", not_required: "无需标准化", failed: "标准化失败" } as const;

function SignalDetails({ signal, allObjects, projections: sourceProjections, versions }: { signal: Signal; allObjects: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[] }) {
  const fields = signal.unified;
  const raw = signal.rawData;
  const linkedRequirements = fields.linkedRequirementIds.map((id) => allObjects.find((object) => object.id === id)?.title).filter(Boolean).join("、");
  const requirementFlow = fields.linkedRequirementIds.map((id) => allObjects.find((object) => object.id === id)).filter((object): object is ProductObject => Boolean(object));
  const sourceFacts: Array<[string, string | undefined]> = raw.sourceType === "product_feedback" ? [
    ["数据源", "合成产品反馈"], ["来源 ID", raw.id], ["提交人", raw.submitter], ["邮箱", raw.email], ["原始类型", raw.feedbackType], ["原始标题", raw.title], ["原始内容", raw.content], ["原始状态", raw.sourceStatus], ["创建时间", raw.createdAt], ["截图地址", raw.screenshotUrl],
  ] : raw.sourceType === "user_feedback" ? [
    ["提交人", raw.submitter], ["联系方式", raw.contact], ["渠道", raw.channel], ["原始标题", raw.title], ["原始内容", raw.content], ["记录人", raw.recorder], ["创建时间", raw.createdAt],
  ] : [
    ["发现人", raw.submitter], ["原始类型", raw.discoveryType], ["发现渠道 / 场景", raw.environment], ["原始标题", raw.title], ["原始描述", raw.content], ["发现时间", raw.createdAt],
  ];
  return <>
    <section className="detail-section"><div className="detail-label">基本信息</div><h3>{fields.title}</h3><p className="detail-summary">{fields.content}</p></section>
    {fields.attachments.length > 0 && <section className="detail-section"><div className="detail-label">截图 / 附件</div><AttachmentList attachments={fields.attachments} /></section>}
    <section className="detail-section"><div className="detail-label">原始记录</div><h3>原始来源记录</h3><div className="source-facts"><Fact label="来源" value={sourceLabels[fields.sourceType]} />{sourceFacts.filter(([, value]) => Boolean(value)).map(([label, value]) => <Fact key={label} label={label} value={value!} />)}</div></section>
    <section className="detail-section"><div className="detail-label">管理信息</div><h3>Alchemy 管理字段</h3><div className="source-facts"><Fact label="优先级" value={fields.priority ?? ""} /><Fact label="负责人" value={fields.owner ?? ""} /><Fact label="处理状态" value={fields.processingStatus} /><Fact label="标准化状态" value={standardizationLabels[fields.standardizationStatus]} /><Fact label="关联 Requirement" value={linkedRequirements || "暂无关联"} /><Fact label="更新时间" value={fields.updatedAt} /></div></section>
    {requirementFlow.length > 0 && <section className="detail-section"><div className="detail-label">全流程</div><h3>后续 Requirement 进展</h3>{requirementFlow.map((requirement) => { const projection = sourceProjections.find((item) => item.objectId === requirement.id); return <div className="source-facts" key={requirement.id}><Fact label="对应 Requirement" value={requirement.title} /><Fact label="评审结果" value={requirement.reviewResult ? reviewResultLabels[requirement.reviewResult] : projection?.currentStageStatus ?? "待评审"} /><Fact label="目标版本" value={versionName(requirement.targetVersionId, versions)} /><Fact label="研发状态" value={requirement.implementation?.status ?? (projection?.currentStage === "implementation" ? projection.currentStageStatus : "尚未进入")} /><Fact label="验证结果" value={requirement.validation?.result ?? (projection?.currentStage === "validation" ? projection.currentStageStatus : "尚未验证")} /></div>; })}</section>}
  </>;
}

/* eslint-disable @next/next/no-img-element -- local synthetic illustrations and user-selected data images */
function AttachmentList({ attachments }: { attachments: Signal["unified"]["attachments"] }) {
  const [preview, setPreview] = useState<AttachmentRef | null>(null);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [previewFailure, setPreviewFailure] = useState("");
  const imageFailure = async (attachment: AttachmentRef, previewImage = false) => {
    let message = "截图加载失败";
    try { const response = await fetch(safeAttachmentUrl(attachment.url)); const payload = await response.json(); message = payload.error || message; } catch { /* 图片响应不是 JSON 时保留通用错误。 */ }
    if (previewImage) setPreviewFailure(message); else setFailures((current) => ({ ...current, [attachment.id]: message }));
  };
  if (!attachments.length) return <div className="attachment-list"><span>截图 / 附件</span><small>无附件</small></div>;
  return <>
    <div className="attachment-list"><span>截图 / 附件</span>{attachments.map((attachment) => {
      if (isImageAttachment(attachment) && attachment.url) return <ImageAttachment key={attachment.id} attachment={attachment} error={failures[attachment.id]} onError={() => void imageFailure(attachment)} onPreview={() => { setPreviewFailure(""); setPreview(attachment); }} />;
      return attachment.url ? <a key={attachment.id} href={safeAttachmentUrl(attachment.url)} target="_blank" rel="noreferrer">{attachment.name}</a> : <strong key={attachment.id}>{attachment.name}</strong>;
    })}</div>
    {preview && <ImageLightbox attachment={preview} error={previewFailure} onError={() => void imageFailure(preview, true)} onClose={() => setPreview(null)} />}
  </>;
}

function ImageAttachment({ attachment, error, onError, onPreview }: { attachment: AttachmentRef; error?: string; onError: () => void; onPreview: () => void }) {
  return <div className="attachment-thumbnail">{error ? <div className="image-load-error">{error}</div> : <button type="button" onClick={onPreview} aria-label={`预览 ${attachment.name}`}><img src={safeAttachmentUrl(attachment.url)} alt={attachment.name} onError={onError} /></button>}<strong>{attachment.name}</strong></div>;
}

function ImageLightbox({ attachment, error, onError, onClose }: { attachment: AttachmentRef; error: string; onError: () => void; onClose: () => void }) {
  return <div className="image-preview-layer" role="dialog" aria-modal="true" aria-label={`${attachment.name} 大图预览`}><button className="image-preview-scrim" onClick={onClose} aria-label="关闭大图预览" /><section className="image-preview-dialog"><header><strong>{attachment.name}</strong><div><a href={safeAttachmentUrl(attachment.url)} target="_blank" rel="noreferrer">打开原图</a><button onClick={onClose} aria-label="关闭大图预览">×</button></div></header><div className="image-preview-body">{error ? <div className="image-load-error">{error}</div> : <img src={safeAttachmentUrl(attachment.url)} alt={attachment.name} onError={onError} />}</div></section></div>;
}
/* eslint-enable @next/next/no-img-element */

function DeliveryFacts({ title, action, facts, onAction }: { title: string; action: string; facts: Array<[string, string]>; onAction: () => void }) {
  return <section className="detail-section delivery-facts"><div className="section-heading"><div><div className="detail-label">当前阶段</div><h3>{title}</h3></div><button className="secondary-action" onClick={onAction}>{action}</button></div><div>{facts.map(([label, value]) => <Fact key={label} label={label} value={value} />)}</div></section>;
}

function ImplementationDialog({ object, projection, onReturn, onClose, onSave }: { object: ProductObject; projection: ObjectProjection; onReturn: () => void; onClose: () => void; onSave: (facts: { status: ImplementationStatus; description: string; blocker: string }) => void }) {
  void onReturn;
  const [status, setStatus] = useState<ImplementationStatus>(object.implementation?.status ?? (projection.currentStageStatus as ImplementationStatus));
  const [description, setDescription] = useState(object.implementation?.description ?? "");
  const [blocker, setBlocker] = useState(object.implementation?.blocker ?? "");
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="更新研发进展"><div className="workbench delivery-dialog"><header><div><span>研发实现</span><h2>{object.title}</h2></div><button onClick={onClose}>×</button></header><div className="delivery-form"><label className="field"><span>当前状态</span><select value={status} onChange={(event) => setStatus(event.target.value as ImplementationStatus)}>{["待开发", "开发中", "阻塞", "已完成"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field"><span>实现说明</span><textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明目前已经实现了什么" /></label><label className="field"><span>问题 / 阻塞</span><textarea rows={4} value={blocker} onChange={(event) => setBlocker(event.target.value)} placeholder="没有问题时可留空" /></label></div><footer><button className="secondary-action" onClick={onClose}>取消</button><button className="primary-action" onClick={() => onSave({ status, description, blocker })}>保存进展</button></footer></div></div>;
}

type ValidationCandidateState = { id: string; title: string; content: string; rationale: string; decision: "pending" | "confirmed" | "ignored" };
function ValidationDialog({ object, onReturn, onClose, onComplete }: { object: ProductObject; onReturn: () => void; onClose: () => void; onComplete: (facts: { result: ValidationResult; followUp: ValidationFollowUp; record: string; newFeedback: string }, confirmedFeedback: string[]) => void }) {
  const [result, setResult] = useState<ValidationResult>(object.validation?.result ?? "通过");
  const [record, setRecord] = useState(object.validation?.record ?? "");
  const [newFeedback, setNewFeedback] = useState(object.validation?.newFeedback ?? "");
  const [followUp, setFollowUp] = useState<ValidationFollowUp>(object.validation?.followUp ?? "complete");
  const [candidates, setCandidates] = useState<ValidationCandidateState[] | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const analyze = async () => { if (!newFeedback.trim()) { onComplete({ result, followUp, record, newFeedback }, []); return; } setBusy(true); setError(""); try { const response = await fetch("/api/validations/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectTitle: object.title, record, newFeedback }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "整理失败"); setCandidates(payload.candidates.map((candidate: Omit<ValidationCandidateState, "decision">) => ({ ...candidate, decision: "pending" }))); } catch (reason) { setError(reason instanceof Error ? reason.message : "整理失败"); } finally { setBusy(false); } };
  const updateCandidate = (id: string, change: Partial<ValidationCandidateState>) => setCandidates((items) => items?.map((item) => item.id === id ? { ...item, ...change } : item) ?? null);
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="完成交付验证"><div className="workbench validation-dialog">
    <header><div><span>交付验证</span><h2>{object.title}</h2></div><div className="workbench-header-actions"><button onClick={onReturn}>返回上一步</button><button onClick={onClose}>×</button></div></header>
    {candidates === null ? <div className="validation-form">
      <div className="validation-context"><Fact label="原始目标" value={object.validation?.originalGoal || object.summary} /><Fact label="实现结果" value={object.validation?.implementationResult || object.implementation?.description || "尚未记录实现结果"} /></div>
      <fieldset><legend>验证结果</legend><div className="validation-options">{(["通过", "部分通过", "未通过"] as ValidationResult[]).map((value) => <button className={result === value ? "active" : ""} onClick={() => setResult(value)} key={value}>{value}</button>)}</div></fieldset>
      <fieldset><legend>后续处理</legend><div className="validation-follow-up">{([['complete', '无需继续处理'], ['next_implementation', '进入下一轮研发'], ['next_planning', '进入下一轮规划'], ['new_signal', '形成新的 Signal']] as [ValidationFollowUp, string][]).map(([value, label]) => <label key={value}><input type="radio" checked={followUp === value} onChange={() => setFollowUp(value)} />{label}</label>)}</div></fieldset>
      <label className="field"><span>验证记录</span><textarea rows={5} value={record} onChange={(event) => setRecord(event.target.value)} placeholder="记录现实如何回答，以及观察到的结果" /></label>
      <label className="field"><span>新反馈</span><textarea rows={4} value={newFeedback} onChange={(event) => setNewFeedback(event.target.value)} placeholder="发现新的独立问题时保留原话；确认后创建新的 Signal" /></label>
      <p className="forward-time-note">返回上一步用于恢复误操作，不增加 Cycle；下一轮研发或规划表示新的业务处理周期。</p>
    </div> : <div className="validation-candidates"><div className="detail-label">AI 建议 · 新的现实问题</div><h3>确认哪些信息需要重新进入原始需求</h3>{candidates.length ? candidates.map((candidate) => <article className={`validation-candidate ${candidate.decision}`} key={candidate.id}><label className="field"><span>Signal 标题</span><input value={candidate.title} onChange={(event) => updateCandidate(candidate.id, { title: event.target.value })} /></label><label className="field"><span>原始反馈</span><textarea rows={3} value={candidate.content} onChange={(event) => updateCandidate(candidate.id, { content: event.target.value })} /></label><p>{candidate.rationale}</p><div><button onClick={() => updateCandidate(candidate.id, { decision: "ignored" })}>忽略</button><button className={candidate.decision === "confirmed" ? "confirmed" : ""} onClick={() => updateCandidate(candidate.id, { decision: "confirmed" })}>{candidate.decision === "confirmed" ? "已确认" : "创建 Signal"}</button></div></article>) : <p className="muted-copy">没有识别到独立的新问题。</p>}</div>}
    {error && <p className="form-error">{error}</p>}
    <footer><button className="secondary-action" onClick={candidates === null ? onClose : () => setCandidates(null)}>{candidates === null ? "取消" : "返回修改"}</button>{candidates === null ? <button className="primary-action" disabled={busy || !record.trim() || (followUp === "new_signal" && !newFeedback.trim())} onClick={analyze}>{busy ? "AI 整理中…" : newFeedback.trim() ? "整理新反馈" : "完成验证"}</button> : <button className="primary-action" disabled={candidates.some((candidate) => candidate.decision === "pending")} onClick={() => onComplete({ result, followUp, record, newFeedback }, candidates.filter((candidate) => candidate.decision === "confirmed").map((candidate) => candidate.content))}>确认并完成验证</button>}</footer>
  </div></div>;
}

function VersionPlanningDialog({ requirement, versions, onClose, onConfirm }: { requirement: ProductObject; versions: ProductVersion[]; onClose: () => void; onConfirm: (versionId: string) => void }) {
  const openVersions = versions.filter((version) => version.status === "open").toSorted((a, b) => a.sequence - b.sequence);
  const [selectedVersionId, setSelectedVersionId] = useState(requirement.targetVersionId ?? openVersions[0]?.id ?? "");
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="规划版本"><div className="version-planning-dialog"><header><div><span>产品规划</span><h2>{requirement.targetVersionId ? "调整目标版本" : "规划版本"}</h2></div><button onClick={onClose} aria-label="关闭版本规划">×</button></header><div className="version-planning-body"><div className="version-requirement"><strong>{requirement.title}</strong><p>{requirement.summary}</p></div><fieldset><legend>选择目标版本</legend>{openVersions.map((version) => <label key={version.id}><input type="radio" checked={selectedVersionId === version.id} onChange={() => setSelectedVersionId(version.id)} /><span>{versionLabel(version)}</span></label>)}</fieldset><p>版本仅表示顺序规划，不包含发布日期或排期；确认后 Requirement 才进入研发。</p></div><footer><button className="secondary-action" onClick={onClose}>取消</button><button className="primary-action" disabled={!selectedVersionId} onClick={() => onConfirm(selectedVersionId)}>确认</button></footer></div></div>;
}

type ReviewCandidateState = { candidate: ReviewChangeCandidate; decision: "pending" | "confirmed" | "ignored" };

function RerefineWorkbench({ requirement, signals, reviewNotes, onClose, onConfirm }: { requirement: ProductObject; signals: Signal[]; reviewNotes: string; onClose: () => void; onConfirm: (candidate: { title: string; description: string; rationale?: string }) => void }) {
  const [title, setTitle] = useState(requirement.title); const [description, setDescription] = useState(requirement.summary); const [rationale, setRationale] = useState(`根据评审备注再次提炼：${reviewNotes}`);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const aiRefine = async () => { setBusy(true); setError(""); try { const response = await fetch("/api/refinements/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirement, signals, reviewNotes }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "再次提炼失败"); setTitle(payload.candidate.title); setDescription(payload.candidate.description); setRationale(payload.candidate.rationale || ""); } catch (reason) { setError(reason instanceof Error ? reason.message : "再次提炼失败"); } finally { setBusy(false); } };
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="再次提炼"><div className="workbench refinement-workbench"><header><div><span>需求提炼 · 同一 Requirement</span><h2>再次提炼</h2></div><button onClick={onClose}>×</button></header><div className="refinement-groups rerefine-layout"><aside><div className="detail-label">当前上下文</div><article><strong>当前 Requirement</strong><p>{requirement.title}</p><small>{requirement.summary}</small></article><article><strong>来源 Signal · {signals.length} 条</strong>{signals.map((signal) => <p key={signal.id}>· {signal.unified.title}</p>)}</article><article><strong>本轮评审备注</strong><p>{reviewNotes}</p></article></aside><section><div className="detail-label">再次提炼结果</div><label className="field"><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>需求描述</span><textarea rows={8} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="field"><span>变更摘要</span><textarea rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} /></label><button className="secondary-action" disabled={busy} onClick={() => void aiRefine()}>{busy ? "AI 整理中…" : "AI 再提炼"}</button>{error && <p className="form-error">{error}</p>}</section></div><footer><button className="secondary-action" onClick={onClose}>取消</button><button className="primary-action" disabled={!title.trim() || !description.trim()} onClick={() => onConfirm({ title, description, rationale })}>确认更新</button></footer></div></div>;
}

type RefinementDraftGroup = { id: string; groupName: string; groupSummary: string; aiOriginal: RequirementCandidate; currentDraft: RequirementCandidate; confirmedQuestions: string[] };
type CandidateTextField = "title" | "problem" | "description" | "targetUser" | "requirementType" | "scenario" | "expectedOutcome" | "rationale";
/* eslint-disable jsx-a11y/label-has-associated-control */

function SimpleRefinementWorkbench({ signals, initialSignalIds, actor, onClose, onApply }: { signals: Signal[]; initialSignalIds: string[]; actor: string; onClose: () => void; onApply: (candidates: RequirementCandidate[]) => void }) {
  const eligible = eligibleRefinementSignals(signals); const [selectedIds, setSelectedIds] = useState(() => normalizeRefinementSelection(initialSignalIds, signals));
  const [step, setStep] = useState<"analysis" | "confirm">("analysis"); const [plan, setPlan] = useState<RefinementPlan | null>(null); const [decisions, setDecisions] = useState<Record<string, string>>({}); const [expanded, setExpanded] = useState<string | null>(null); const [editing, setEditing] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const selected = eligible.filter((signal) => selectedIds.includes(signal.id));
  const analyze = async () => { setBusy(true); setError(""); try { const response = await fetch("/api/refinements/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signals: selected, productContext: "虚构需求沙盒，仅使用合成数据。" }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "分析失败"); setPlan(payload.plan); } catch (reason) { setError(reason instanceof Error ? reason.message : "分析失败"); } finally { setBusy(false); } };
  const suggestions = plan?.suggestions.filter((item) => item.kind !== "independent" && item.kind !== "duplicate") ?? [];
  const drafts = plan?.draftRequirements ?? [];
  const updateDraft = (id: string | undefined, change: Partial<RequirementCandidate>) => setPlan((current) => current ? { ...current, draftRequirements: current.draftRequirements.map((draft) => draft.id === id ? { ...draft, ...change } : draft) } : current);
  const sourceKeys = (ids: string[]) => ids.map((id) => selected.find((signal) => signal.id === id)?.key ?? id).join(" · ");
  const resolved = suggestions.filter((item) => decisions[item.id]).length;
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="需求提炼"><div className="workbench simple-refinement"><header><div><div className="refinement-steps"><span className={step === "analysis" ? "active" : ""}>① AI 分析</span><span className={step === "confirm" ? "active" : ""}>② 需求确认</span></div><h2>{step === "analysis" ? "AI 分析" : `需求确认 · ${drafts.length} 条`}</h2></div><button onClick={onClose}>×</button></header>{!plan ? <div className="refinement-signal-picker">{eligible.map((signal) => <label key={signal.id}><input type="checkbox" checked={selectedIds.includes(signal.id)} onChange={() => setSelectedIds((ids) => toggleRefinementSelection(ids, signal.id))} /><span><strong>{signal.key} · {signal.unified.title}</strong><small>{signal.unified.content}</small></span></label>)}</div> : step === "analysis" ? <div className="simple-analysis-list">{suggestions.map((suggestion) => { const sources = suggestion.signalIds.map((id) => selected.find((signal) => signal.id === id)).filter((signal): signal is Signal => Boolean(signal)); const choice = decisions[suggestion.id]; return <article className={choice ? "resolved" : ""} key={suggestion.id}><header><span>{suggestion.kind === "merge" ? "建议合并" : suggestion.kind === "split" ? "建议拆分" : "需要判断"}</span><strong>{sources.map((signal) => signal.key).join(" + ")}</strong></header><h3>{sources.map((signal) => signal.unified.title).join(" / ")}</h3><div className="analysis-facts"><div><b>用户问题</b><p>{suggestion.reason}</p></div><div><b>产品现状</b><p>结合当前产品能力判断是否需要形成独立需求。</p></div>{sources.some((signal) => signal.unified.attachments.length) && <div><b>截图分析</b><p>AI 已结合附件与用户描述分析；请展开原始反馈核对图片事实。</p></div>}</div><div className="source-expanders">{sources.map((signal) => <div key={signal.id}><button onClick={() => setExpanded(expanded === signal.id ? null : signal.id)}>{signal.key} · 查看原始反馈</button>{expanded === signal.id && <section><strong>{signal.unified.title}</strong><p>{signal.unified.content}</p><small>{sourceLabels[signal.unified.sourceType]} · {signal.unified.submitter} · {signal.key}</small><AttachmentList attachments={signal.unified.attachments} /></section>}</div>)}</div><footer>{choice ? <><em>✓ {choice}</em><button onClick={() => setDecisions((current) => { const next = { ...current }; delete next[suggestion.id]; return next; })}>修改</button></> : suggestion.kind === "merge" ? <><button onClick={() => setDecisions((current) => ({ ...current, [suggestion.id]: "保持独立" }))}>保持独立</button><button className="primary-action" onClick={() => setDecisions((current) => ({ ...current, [suggestion.id]: "接受合并" }))}>接受合并</button></> : <><button onClick={() => setDecisions((current) => ({ ...current, [suggestion.id]: "保持一个需求" }))}>保持一个需求</button><button className="primary-action" onClick={() => setDecisions((current) => ({ ...current, [suggestion.id]: "接受拆分" }))}>接受拆分</button></>}</footer></article>; })}{!suggestions.length && <p className="overview-empty">AI 没有发现需要人工确认的合并或拆分。</p>}</div> : <div className="simple-confirm-list">{drafts.map((draft, index) => <article key={draft.id}><span>{String(index + 1).padStart(2, "0")}</span>{editing === draft.id ? <div><DraftField label="标题" value={draft.title} onChange={(value) => updateDraft(draft.id, { title: value })} /><DraftField label="内容" value={draft.description} multiline onChange={(value) => updateDraft(draft.id, { description: value })} /><button onClick={() => setEditing(null)}>完成编辑</button></div> : <div><h3>{draft.title}</h3><p>{draft.description}</p><small>来源：{sourceKeys(draft.sourceSignalIds)}</small><button onClick={() => setEditing(draft.id ?? null)}>编辑</button></div>}</article>)}</div>}{error && <p className="form-error">{error}</p>}<footer>{!plan ? <><button className="secondary-action" onClick={onClose}>取消</button><button className="primary-action" disabled={busy || !selected.length} onClick={() => void analyze()}>{busy ? "AI 分析中…" : "开始 AI 分析"}</button></> : step === "analysis" ? <><span>已确认 {resolved} / {suggestions.length}</span><button className="primary-action" disabled={resolved < suggestions.length} onClick={() => setStep("confirm")}>进入需求确认</button></> : <><button className="secondary-action" onClick={() => setStep("analysis")}>返回 AI 分析</button><button className="primary-action" disabled={!drafts.length || drafts.some((draft) => !draft.title.trim() || !draft.description.trim())} onClick={() => onApply(drafts)}>确认提炼 {drafts.length} 条需求</button></>}</footer><span className="refinement-actor">确认人：{actor}</span></div></div>;
}

/* eslint-disable jsx-a11y/label-has-associated-control */
function StagedRefinementWorkbench({ signals, initialSignalIds, actor, onClose, onApply }: { signals: Signal[]; initialSignalIds: string[]; actor: string; onClose: () => void; onApply: (candidates: RequirementCandidate[]) => void }) {
  const eligible = eligibleRefinementSignals(signals); const [selectedIds, setSelectedIds] = useState(() => normalizeRefinementSelection(initialSignalIds, signals));
  const [step, setStep] = useState<"judgment" | "structure" | "drafts">("judgment"); const [plan, setPlan] = useState<RefinementPlan | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [mergingProblemId, setMergingProblemId] = useState<string | null>(null);
  const selected = eligible.filter((signal) => selectedIds.includes(signal.id)); const generated = plan?.problems.filter((problem) => problem.disposition === "generate") ?? [];
  const updateProblem = (id: string, change: Partial<RefinementProblem>) => setPlan((current) => current ? { ...current, problems: current.problems.map((problem) => problem.id === id ? { ...problem, ...change } : problem), draftRequirements: current.draftRequirements.map((draft) => draft.problemSnapshot?.id === id ? { ...draft, problem: change.summary ?? draft.problem, sourceSignalIds: change.sourceSignalIds ?? draft.sourceSignalIds, problemSnapshot: { id, name: change.name ?? draft.problemSnapshot.name, summary: change.summary ?? draft.problemSnapshot.summary, sourceSignalIds: change.sourceSignalIds ?? draft.problemSnapshot.sourceSignalIds } } : draft) } : current);
  const analyze = async () => { if (!selected.length) return; setBusy(true); setError(""); try { const response = await fetch("/api/refinements/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signals: selected }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "分析失败"); setPlan(payload.plan); } catch (reason) { setError(reason instanceof Error ? reason.message : "分析失败"); } finally { setBusy(false); } };
  const decide = (suggestionId: string, decision: string) => setDecisions((current) => ({ ...current, [suggestionId]: decision }));
  const keepSeparate = (signalIds: string[]) => setPlan((current) => {
    if (!current) return current;
    const target = current.problems.find((problem) => signalIds.every((id) => problem.sourceSignalIds.includes(id)));
    if (!target) return current;
    const rest = signalIds.slice(1).map((signalId, index) => ({ id: `${target.id}-separate-${index + 1}`, name: selected.find((signal) => signal.id === signalId)?.unified.title ?? "独立问题", summary: selected.find((signal) => signal.id === signalId)?.unified.content ?? "", sourceSignalIds: [signalId], disposition: "generate" as const, confidence: target.confidence }));
    return { ...current, problems: [...current.problems.map((problem) => problem.id === target.id ? { ...problem, sourceSignalIds: [signalIds[0]] } : problem), ...rest], draftRequirements: [...current.draftRequirements.map((draft) => draft.problemSnapshot?.id === target.id ? { ...draft, sourceSignalIds: [signalIds[0]], problemSnapshot: { ...draft.problemSnapshot, sourceSignalIds: [signalIds[0]] } } : draft), ...rest.map((problem) => ({ id: `draft-${problem.id}`, title: problem.name, problem: problem.summary, description: problem.summary, openQuestions: [], sourceSignalIds: problem.sourceSignalIds, createdBy: "human" as const, status: "pending_confirmation" as const, problemSnapshot: problem }))] };
  });
  const mergeProblems = (targetId: string, sourceId: string) => setPlan((current) => {
    if (!current || targetId === sourceId) return current;
    const target = current.problems.find((problem) => problem.id === targetId); const source = current.problems.find((problem) => problem.id === sourceId);
    if (!target || !source) return current;
    const sourceSignalIds = [...new Set([...target.sourceSignalIds, ...source.sourceSignalIds])];
    return { ...current, problems: current.problems.filter((problem) => problem.id !== sourceId).map((problem) => problem.id === targetId ? { ...problem, sourceSignalIds } : problem), draftRequirements: current.draftRequirements.filter((draft) => draft.problemSnapshot?.id !== sourceId).map((draft) => draft.problemSnapshot?.id === targetId ? { ...draft, sourceSignalIds, problemSnapshot: { ...draft.problemSnapshot, sourceSignalIds } } : draft) };
  });
  const keepOneProblem = (problemIds: string[]) => setPlan((current) => {
    if (!current || problemIds.length < 2) return current;
    const [targetId, ...sourceIds] = problemIds; const related = current.problems.filter((problem) => problemIds.includes(problem.id)); const target = related.find((problem) => problem.id === targetId);
    if (!target) return current;
    const sourceSignalIds = [...new Set(related.flatMap((problem) => problem.sourceSignalIds))];
    return { ...current, problems: current.problems.filter((problem) => !sourceIds.includes(problem.id)).map((problem) => problem.id === targetId ? { ...problem, sourceSignalIds } : problem), draftRequirements: current.draftRequirements.filter((draft) => !sourceIds.includes(draft.problemSnapshot?.id ?? "")).map((draft) => draft.problemSnapshot?.id === targetId ? { ...draft, sourceSignalIds, problemSnapshot: { ...draft.problemSnapshot, sourceSignalIds } } : draft) };
  });
  const splitProblem = (problem: RefinementProblem) => { const id = `${problem.id}-manual-split-${Date.now()}`; const split: RefinementProblem = { ...problem, id, name: `${problem.name} · 新问题`, summary: "", confidence: 1 }; setPlan((current) => current ? { ...current, problems: [...current.problems, split], draftRequirements: [...current.draftRequirements, { id: `draft-${id}`, title: split.name, problem: "", description: "", openQuestions: [], sourceSignalIds: split.sourceSignalIds, createdBy: "human", status: "pending_confirmation", problemSnapshot: split }] } : current); setEditingProblemId(id); };
  const addProblem = () => { const id = `problem-manual-${Date.now()}`; const problem: RefinementProblem = { id, name: "新问题", summary: "", sourceSignalIds: [], disposition: "generate", confidence: 1 }; setPlan((current) => current ? { ...current, problems: [...current.problems, problem], draftRequirements: [...current.draftRequirements, { id: `draft-${id}`, title: "新需求", problem: "", description: "", openQuestions: [], sourceSignalIds: [], createdBy: "human", status: "pending_confirmation", problemSnapshot: problem }] } : current); };
  const updateDraft = (id: string, change: Partial<RequirementCandidate>) => setPlan((current) => current ? { ...current, draftRequirements: current.draftRequirements.map((draft) => draft.id === id ? { ...draft, ...change } : draft) } : current);
  const finalDrafts = (plan?.draftRequirements ?? []).filter((draft) => generated.some((problem) => problem.id === draft.problemSnapshot?.id)).map((draft) => { const problem = generated.find((item) => item.id === draft.problemSnapshot?.id)!; return { ...draft, problemSnapshot: { id: problem.id, name: problem.name, summary: problem.summary, sourceSignalIds: problem.sourceSignalIds }, sourceSignalIds: problem.sourceSignalIds }; });
  const valid = finalDrafts.length > 0 && finalDrafts.every((draft) => draft.title.trim() && draft.description.trim() && draft.sourceSignalIds.length);
  const judgmentSuggestions = plan?.suggestions.filter((suggestion) => suggestion.kind !== "independent" && suggestion.kind !== "duplicate") ?? [];
  const resolvedJudgments = judgmentSuggestions.filter((suggestion) => decisions[suggestion.id]).length;
  const header = <><div className="refinement-steps"><span className={step === "judgment" ? "active" : ""}>① AI 判断</span><span className={step === "structure" ? "active" : ""}>② 问题结构</span><span className={step === "drafts" ? "active" : ""}>③ 需求草稿</span></div><h2>{selected.length} 条原始反馈 → {plan?.problems.length ?? 0} 个问题 → 将生成 {generated.length} 条需求</h2></>;
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="需求提炼"><div className="workbench refinement-workbench staged-refinement"><header><div>{header}</div><button onClick={onClose}>×</button></header>{!plan ? <div className="refinement-signal-picker"><p>先选择需要共同分析的原始反馈。AI 将先完成整理，只把无法确定的结构判断交给你。</p>{eligible.map((signal) => <label key={signal.id}><input type="checkbox" checked={selectedIds.includes(signal.id)} onChange={() => setSelectedIds((ids) => toggleRefinementSelection(ids, signal.id))} /><span><strong>{signal.key} · {signal.unified.title}</strong><small>{signal.unified.content}</small></span></label>)}</div> : step === "judgment" ? <JudgmentStage suggestions={judgmentSuggestions} decisions={decisions} selected={selected} onDecide={(suggestion, decision) => { if (decision === "保持分开") keepSeparate(suggestion.signalIds); if (decision === "保持一个问题" || decision === "作为一个问题") keepOneProblem(suggestion.problemIds); decide(suggestion.id, decision); }} onModify={(id) => setDecisions((current) => { const next = { ...current }; delete next[id]; return next; })} /> : step === "structure" ? <ProblemStructureStage problems={plan.problems} selected={selected} editingId={editingProblemId} mergingId={mergingProblemId} onEdit={setEditingProblemId} onMergeStart={setMergingProblemId} onUpdate={updateProblem} onMerge={(targetId, sourceId) => { mergeProblems(targetId, sourceId); setMergingProblemId(null); }} onSplit={splitProblem} onAdd={addProblem} /> : <div className="requirement-draft-stage"><div className="stage-question"><strong>这些问题最终生成什么需求？</strong><p>基于已确认的问题生成需求草稿。</p></div>{finalDrafts.map((draft, index) => <article key={draft.id}><header><span>Requirement {index + 1}</span><strong>{draft.problemSnapshot?.name}</strong></header><DraftField label="标准化标题" value={draft.title} onChange={(value) => updateDraft(draft.id!, { title: value })} /><DraftField label="核心问题 / 用户痛点" value={draft.problem ?? ""} multiline onChange={(value) => updateDraft(draft.id!, { problem: value })} /><DraftField label="需求描述" value={draft.description} multiline onChange={(value) => updateDraft(draft.id!, { description: value })} /><div className="candidate-grid"><DraftField label="目标用户" value={draft.targetUser ?? ""} onChange={(value) => updateDraft(draft.id!, { targetUser: value })} /><DraftField label="需求类型" value={draft.requirementType ?? ""} onChange={(value) => updateDraft(draft.id!, { requirementType: value })} /></div><DraftField label="使用场景" value={draft.scenario ?? ""} multiline onChange={(value) => updateDraft(draft.id!, { scenario: value })} /><DraftField label="预期结果" value={draft.expectedOutcome ?? ""} multiline onChange={(value) => updateDraft(draft.id!, { expectedOutcome: value })} /><label className="field"><span>openQuestions</span><textarea rows={3} value={(draft.openQuestions ?? []).join("\n")} onChange={(event) => updateDraft(draft.id!, { openQuestions: event.target.value.split("\n").filter(Boolean) })} /></label></article>)}</div>}{error && <p className="form-error">{error}</p>}<footer>{!plan ? <><button className="secondary-action" onClick={onClose}>取消</button><button className="primary-action" disabled={busy || !selected.length} onClick={() => void analyze()}>{busy ? "AI 判断中…" : "开始 AI 判断"}</button></> : step === "judgment" ? <><button className="secondary-action" onClick={() => setPlan(null)}>返回选择</button><span className="judgment-progress">已处理 {resolvedJudgments} / {judgmentSuggestions.length} 个 AI 判断</span><button className="primary-action" disabled={resolvedJudgments < judgmentSuggestions.length} onClick={() => setStep("structure")}>确认判断，查看问题结构</button></> : step === "structure" ? <><button className="secondary-action" onClick={() => setStep("judgment")}>返回 AI 判断</button><button className="primary-action" onClick={() => setStep("drafts")}>确认问题，生成需求草稿</button></> : <><button className="secondary-action" onClick={() => setStep("structure")}>返回问题结构</button><button className="primary-action" disabled={!valid} onClick={() => onApply(finalDrafts)}>确认生成 {finalDrafts.length} 条需求</button></>}</footer><span className="refinement-actor">确认人：{actor}</span></div></div>;
}

function JudgmentStage({ suggestions, decisions, selected, onDecide, onModify }: { suggestions: RefinementPlan["suggestions"]; decisions: Record<string, string>; selected: Signal[]; onDecide: (suggestion: RefinementPlan["suggestions"][number], decision: string) => void; onModify: (id: string) => void }) { return <div className="refinement-judgments"><div className="stage-question"><strong>AI 有哪些地方需要我拍板？</strong></div>{suggestions.map((suggestion) => { const decision = decisions[suggestion.id]; const label = suggestion.kind === "merge" ? "建议合并" : suggestion.kind === "split" ? "建议拆分" : "AI 不确定"; const choices = suggestion.kind === "merge" ? ["保持分开", "已合并"] : suggestion.kind === "split" ? ["保持一个问题", "已拆分"] : suggestion.problemIds.length > 1 ? ["作为一个问题", "拆成两个问题"] : ["暂不处理", "人工编辑"]; return <article className={decision ? "resolved" : ""} key={suggestion.id}><div className="judgment-card-head"><span>{label}</span><small>{Math.round(suggestion.confidence * 100)}%</small></div><div>{suggestion.signalIds.map((id) => { const signal = selected.find((item) => item.id === id); return <strong key={id}>{signal?.key} · {signal?.unified.title}</strong>; })}</div><p>{suggestion.reason}</p><footer>{decision ? <><em>✓ {decision}</em><button onClick={() => onModify(suggestion.id)}>修改</button></> : choices.map((choice, index) => <button className={index === 1 ? "primary-action" : ""} key={choice} onClick={() => onDecide(suggestion, choice)}>{choice === "已合并" ? "接受合并" : choice === "已拆分" ? "接受拆分" : choice}</button>)}</footer></article>; })}{!suggestions.length && <div className="judgment-empty">AI 没有发现需要人工拍板的结构判断。</div>}</div>; }

function ProblemStructureStage({ problems, selected, editingId, mergingId, onEdit, onMergeStart, onUpdate, onMerge, onSplit, onAdd }: { problems: RefinementProblem[]; selected: Signal[]; editingId: string | null; mergingId: string | null; onEdit: (id: string | null) => void; onMergeStart: (id: string | null) => void; onUpdate: (id: string, change: Partial<RefinementProblem>) => void; onMerge: (targetId: string, sourceId: string) => void; onSplit: (problem: RefinementProblem) => void; onAdd: () => void }) { return <div className="problem-structure-stage"><div className="problem-structure-heading"><div><span>问题整理</span><strong>AI 整理出 {problems.length} 个问题</strong></div><button className="secondary-action" onClick={onAdd}>＋ 新建 Problem</button></div>{problems.map((problem, index) => <article className="problem-result" key={problem.id}><header><span>{String(index + 1).padStart(2, "0")}</span><strong>{problem.name}</strong></header>{editingId === problem.id ? <div className="problem-inline-editor"><label className="field"><span>问题名称</span><input value={problem.name} onChange={(event) => onUpdate(problem.id, { name: event.target.value })} /></label><label className="field"><span>问题概括</span><textarea rows={3} value={problem.summary} onChange={(event) => onUpdate(problem.id, { summary: event.target.value })} /></label><button onClick={() => onEdit(null)}>完成编辑</button></div> : <p>{problem.summary}</p>}<small>来源：{problem.sourceSignalIds.map((id) => selected.find((signal) => signal.id === id)?.key ?? id).join("、") || "人工新建"}</small><footer><button onClick={() => onEdit(problem.id)}>编辑</button><button onClick={() => onMergeStart(mergingId === problem.id ? null : problem.id)}>合并</button><button onClick={() => onSplit(problem)}>拆分</button>{mergingId === problem.id && <select defaultValue="" onChange={(event) => event.target.value && onMerge(event.target.value, problem.id)}><option value="">合并到…</option>{problems.filter((item) => item.id !== problem.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</footer></article>)}</div>; }

function DraftField({ label, value, multiline = false, onChange }: { label: string; value: string; multiline?: boolean; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span>{multiline ? <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>; }

function draftGroupFromCandidate(candidate: RequirementCandidate, index: number): RefinementDraftGroup {
  const original = { ...candidate, openQuestions: [...(candidate.openQuestions ?? [])], sourceSignalIds: [...candidate.sourceSignalIds] };
  return { id: candidate.id ?? `draft-group-${index + 1}`, groupName: candidate.title || `问题 ${index + 1}`, groupSummary: candidate.problem || candidate.description, aiOriginal: original, currentDraft: { ...original, openQuestions: [...(original.openQuestions ?? [])], sourceSignalIds: [...original.sourceSignalIds] }, confirmedQuestions: [] };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function RefinementWorkbench({ signals, initialSignalIds, actor, onReturn, onClose, onApply }: { signals: Signal[]; initialSignalIds: string[]; actor: string; onReturn: (id: string) => void; onClose: () => void; onApply: (candidates: RequirementCandidate[]) => void }) {
  void onReturn;
  const eligible = eligibleRefinementSignals(signals);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => normalizeRefinementSelection(initialSignalIds, signals));
  const [groups, setGroups] = useState<RefinementDraftGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const selected = eligible.filter((signal) => selectedIds.includes(signal.id));
  const activeGroups = groups.filter((group) => group.currentDraft.sourceSignalIds.length > 0);
  const hasEdits = groups.some((group) => group.groupName !== group.aiOriginal.title || group.groupSummary !== (group.aiOriginal.problem || group.aiOriginal.description) || (Object.keys(group.currentDraft) as Array<keyof RequirementCandidate>).some((field) => JSON.stringify(group.currentDraft[field]) !== JSON.stringify(group.aiOriginal[field])) || group.confirmedQuestions.length);
  const installDraft = (candidates: RequirementCandidate[]) => { const next = candidates.map(draftGroupFromCandidate); setGroups(next); setActiveGroupId(next[0]?.id ?? ""); };
  const createManual = () => { if (!selected.length) { setError("请至少选择一条 Signal"); return; } setError(""); installDraft([{ id: `manual-${selectedIds.join("-")}`, title: selected.length === 1 ? selected[0].unified.title : "待命名需求", problem: null, description: selected.map((signal) => signal.standardized?.problem || signal.unified.content).join("；"), openQuestions: [], rationale: "由产品人员基于选中的 Signal 人工提炼。", sourceSignalIds: selectedIds, createdBy: "human", status: "pending_confirmation" }]); };
  const analyze = async () => { if (!selected.length) { setError("请至少选择一条 Signal"); return; } setBusy(true); setError(""); try { const response = await fetch("/api/refinements/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signals: selected }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "分析失败"); installDraft(payload.candidates); } catch (reason) { setError(reason instanceof Error ? reason.message : "分析失败"); } finally { setBusy(false); } };
  const updateGroup = (id: string, change: Partial<RefinementDraftGroup>) => setGroups((items) => items.map((group) => group.id === id ? { ...group, ...change } : group));
  const updateDraft = (id: string, change: Partial<RequirementCandidate>) => setGroups((items) => items.map((group) => group.id === id ? { ...group, currentDraft: { ...group.currentDraft, ...change } } : group));
  const moveSignal = (signalId: string, targetId: string) => setGroups((items) => items.map((group) => ({ ...group, currentDraft: { ...group.currentDraft, sourceSignalIds: group.id === targetId ? [...new Set([...group.currentDraft.sourceSignalIds, signalId])] : group.currentDraft.sourceSignalIds.filter((id) => id !== signalId) } })));
  const addGroup = () => { const candidate: RequirementCandidate = { id: `manual-group-${Date.now()}`, title: "新需求", problem: null, description: "", openQuestions: [], rationale: "人工新建问题组。", sourceSignalIds: [], createdBy: "human", status: "pending_confirmation" }; const next = draftGroupFromCandidate(candidate, groups.length); setGroups((items) => [...items, next]); setActiveGroupId(next.id); };
  const restoreField = (group: RefinementDraftGroup, field: CandidateTextField | "openQuestions") => updateDraft(group.id, { [field]: field === "openQuestions" ? [...(group.aiOriginal.openQuestions ?? [])] : group.aiOriginal[field] } as Partial<RequirementCandidate>);
  const fieldEdited = (group: RefinementDraftGroup, field: CandidateTextField | "openQuestions") => JSON.stringify(group.currentDraft[field]) !== JSON.stringify(group.aiOriginal[field]);
  const cancelDraft = () => { if (hasEdits && !globalThis.confirm("当前草稿包含未保存的修改，确定取消？")) return; setGroups([]); };
  const groupedIds = new Set(activeGroups.flatMap((group) => group.currentDraft.sourceSignalIds));
  const valid = activeGroups.length > 0 && activeGroups.every((group) => group.currentDraft.title.trim() && group.currentDraft.description.trim()) && selectedIds.every((id) => groupedIds.has(id)) && groupedIds.size === selectedIds.length;
  const confirmDraft = () => onApply(activeGroups.map((group) => ({ ...group.currentDraft, openQuestions: (group.currentDraft.openQuestions ?? []).filter((question) => !group.confirmedQuestions.includes(question)) })));
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const mostlyIndependent = selected.length > 2 && activeGroups.length >= Math.ceil(selected.length * .8);
  if (groups.length && activeGroup) return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="需求提炼"><div className="workbench refinement-workbench refinement-master-detail"><header><div><span>需求提炼 · AI 建议 → 人工修订</span><h2>{selected.length} 条原始反馈 → {activeGroups.length} 个问题 → 将生成 {activeGroups.length} 条需求</h2></div><button onClick={onClose}>×</button></header><div className="refinement-guidance"><strong>? 提炼说明</strong><p>左侧确认这些反馈实际在说哪几件事，右侧编辑当前问题最终应表达成什么 Requirement。原始反馈保持只读，确认前不会生成正式对象。</p></div>{mostlyIndependent && <p className="independent-problem-hint">当前多数反馈被识别为独立问题，请确认是否需要合并。</p>}<div className="refinement-master-detail-body"><section className="problem-master"><div className="section-heading"><div><div className="detail-label">问题与来源</div><h3>AI 识别的问题</h3></div><button className="secondary-action" onClick={addGroup}>＋ 新建问题组</button></div>{groups.map((group, index) => { const groupEdited = group.groupName !== group.aiOriginal.title || group.groupSummary !== (group.aiOriginal.problem || group.aiOriginal.description); const sources = group.currentDraft.sourceSignalIds.map((id) => selected.find((signal) => signal.id === id)).filter((signal): signal is Signal => Boolean(signal)); return <article className={`problem-master-card ${group.id === activeGroup.id ? "active" : ""}`} key={group.id}><button className="problem-master-select" onClick={() => setActiveGroupId(group.id)}><span>问题 {index + 1} · 来源 {sources.length} 条</span><strong>{group.groupName || "未命名问题"}</strong><small>{groupEdited ? "已编辑" : group.currentDraft.createdBy === "ai" ? "AI 草稿" : "人工草稿"}</small></button><div className="problem-master-editor"><label className="field"><span>问题名称</span><input value={group.groupName} onFocus={() => setActiveGroupId(group.id)} onChange={(event) => updateGroup(group.id, { groupName: event.target.value })} /></label><label className="field"><span>共同问题概括</span><textarea rows={3} value={group.groupSummary} onFocus={() => setActiveGroupId(group.id)} onChange={(event) => updateGroup(group.id, { groupSummary: event.target.value })} /></label>{groupEdited && <button className="draft-restore" onClick={() => updateGroup(group.id, { groupName: group.aiOriginal.title, groupSummary: group.aiOriginal.problem || group.aiOriginal.description })}>恢复 AI 建议</button>}<div className="problem-source-list">{sources.map((signal) => <div key={signal.id}><span><strong>{signal.unified.title}</strong><small>{sourceLabels[signal.unified.sourceType]} · 原始反馈只读</small></span><label>移至其他问题<select value={group.id} onChange={(event) => { moveSignal(signal.id, event.target.value); if (event.target.value) setActiveGroupId(event.target.value); }}><option value="">未分组</option>{groups.map((target) => <option value={target.id} key={target.id}>{target.groupName || "未命名问题"}</option>)}</select></label></div>)}{!sources.length && <p>暂无来源反馈。可将其他问题中的反馈移入此组。</p>}</div></div></article>; })}{selected.filter((signal) => !groupedIds.has(signal.id)).map((signal) => <article className="ungrouped-signal" key={signal.id}><strong>{signal.unified.title}</strong><small>未分组</small><select value="" onChange={(event) => { moveSignal(signal.id, event.target.value); setActiveGroupId(event.target.value); }}><option value="">归入问题…</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.groupName}</option>)}</select></article>)}</section><section className="requirement-detail"><div className="requirement-detail-heading"><div><div className="detail-label">需求草稿</div><h3>Requirement {groups.findIndex((group) => group.id === activeGroup.id) + 1}</h3></div><span>来源 {activeGroup.currentDraft.sourceSignalIds.length} 条</span></div><article className={`refinement-group-card ${!activeGroup.currentDraft.sourceSignalIds.length ? "empty-group" : ""}`}><DraftTextField label="标准化标题" field="title" group={activeGroup} onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="核心问题 / 用户痛点" field="problem" group={activeGroup} multiline onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="整理后的需求描述" field="description" group={activeGroup} multiline onChange={updateDraft} onRestore={restoreField} /><div className="candidate-grid"><DraftTextField label="目标用户" field="targetUser" group={activeGroup} onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="需求类型" field="requirementType" group={activeGroup} onChange={updateDraft} onRestore={restoreField} /></div><DraftTextField label="使用场景" field="scenario" group={activeGroup} multiline onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="预期结果" field="expectedOutcome" group={activeGroup} multiline onChange={updateDraft} onRestore={restoreField} /><div className="draft-questions"><header><span>待确认问题</span><div>{fieldEdited(activeGroup, "openQuestions") && <button onClick={() => restoreField(activeGroup, "openQuestions")}>恢复 AI 建议</button>}<button onClick={() => updateDraft(activeGroup.id, { openQuestions: [...(activeGroup.currentDraft.openQuestions ?? []), ""] })}>＋ 新增</button></div></header>{(activeGroup.currentDraft.openQuestions ?? []).map((question, questionIndex) => <div className={activeGroup.confirmedQuestions.includes(question) ? "resolved" : ""} key={`${activeGroup.id}-question-${questionIndex}`}><input value={question} onChange={(event) => updateDraft(activeGroup.id, { openQuestions: (activeGroup.currentDraft.openQuestions ?? []).map((item, itemIndex) => itemIndex === questionIndex ? event.target.value : item) })} /><button onClick={() => updateGroup(activeGroup.id, { confirmedQuestions: activeGroup.confirmedQuestions.includes(question) ? activeGroup.confirmedQuestions.filter((item) => item !== question) : [...activeGroup.confirmedQuestions, question] })}>{activeGroup.confirmedQuestions.includes(question) ? "取消确认" : "标记已确认"}</button><button onClick={() => updateDraft(activeGroup.id, { openQuestions: (activeGroup.currentDraft.openQuestions ?? []).filter((_, itemIndex) => itemIndex !== questionIndex) })}>删除</button></div>)}</div><DraftTextField label="提炼说明（可选）" field="rationale" group={activeGroup} multiline onChange={updateDraft} onRestore={restoreField} /></article></section></div>{error && <p className="form-error">{error}</p>}<footer><button className="secondary-action" onClick={cancelDraft}>取消草稿</button><button className="primary-action" disabled={!valid} onClick={confirmDraft}>确认生成 {activeGroups.length} 条需求</button></footer><span className="refinement-actor">确认人：{actor}</span></div></div>;
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="需求提炼"><div className="workbench refinement-workbench"><header><div><span>需求提炼 · AI 建议 → 人工修订</span><h2>{groups.length ? `可编辑草稿 · 将生成 ${activeGroups.length} 条 Requirement` : `已选择 ${selected.length} 条 Signal`}</h2></div><button onClick={onClose}>×</button></header><div className="refinement-guidance"><strong>提炼说明</strong><p>AI 会提供问题归组和需求表达建议。所有分组和需求字段均可人工调整。AI 不会修改原始反馈，只有最终确认后才会正式生成 Requirement。</p></div>{groups.length ? <div className="refinement-draft-layout"><aside><div className="detail-label">原始反馈 · 只读</div>{selected.map((signal) => { const group = groups.find((item) => item.currentDraft.sourceSignalIds.includes(signal.id)); return <article key={signal.id}><strong>{signal.unified.title}</strong><p>{signal.standardized?.problem || signal.unified.content}</p><small>{sourceLabels[signal.unified.sourceType]} · 原始内容不会被修改</small><label><span>归入</span><select value={group?.id ?? ""} onChange={(event) => moveSignal(signal.id, event.target.value)}><option value="">未分组</option>{groups.map((item) => <option value={item.id} key={item.id}>{item.groupName || "未命名问题"}</option>)}</select></label></article>; })}</aside><section className="problem-groups"><div className="section-heading"><div><div className="detail-label">AI 识别的问题</div><h3>调整反馈与问题组的关系</h3></div><button className="secondary-action" onClick={addGroup}>＋ 新建问题组</button></div>{groups.map((group, index) => { const groupEdited = group.groupName !== group.aiOriginal.title || group.groupSummary !== (group.aiOriginal.problem || group.aiOriginal.description); return <article className="problem-group-card" key={group.id}><header><span>问题 {index + 1} · 来源 {group.currentDraft.sourceSignalIds.length} 条</span><small>{groupEdited ? "已编辑" : group.currentDraft.createdBy === "ai" ? "AI 草稿" : "人工草稿"}</small></header><label className="field"><span>问题名称</span><input value={group.groupName} onChange={(event) => updateGroup(group.id, { groupName: event.target.value })} /></label><label className="field"><span>共同问题概括</span><textarea rows={4} value={group.groupSummary} onChange={(event) => updateGroup(group.id, { groupSummary: event.target.value })} /></label><div className="group-signal-chips">{group.currentDraft.sourceSignalIds.map((id) => <span key={id}>{selected.find((signal) => signal.id === id)?.unified.title ?? id}</span>)}{!group.currentDraft.sourceSignalIds.length && <em>暂未归入 Signal</em>}</div>{groupEdited && <button className="draft-restore" onClick={() => updateGroup(group.id, { groupName: group.aiOriginal.title, groupSummary: group.aiOriginal.problem || group.aiOriginal.description })}>恢复 AI 建议</button>}</article>; })}</section><section className="requirement-drafts"><div className="detail-label">将生成的需求</div>{groups.map((group, index) => <article className={`refinement-group-card ${!group.currentDraft.sourceSignalIds.length ? "empty-group" : ""}`} key={group.id}><span>Requirement {index + 1} · {group.currentDraft.sourceSignalIds.length ? `来源 ${group.currentDraft.sourceSignalIds.length} 条` : "未关联反馈，不会生成"}</span><DraftTextField label="标准化标题" field="title" group={group} onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="核心问题 / 用户痛点" field="problem" group={group} multiline onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="整理后的需求描述" field="description" group={group} multiline onChange={updateDraft} onRestore={restoreField} /><div className="candidate-grid"><DraftTextField label="目标用户" field="targetUser" group={group} onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="需求类型" field="requirementType" group={group} onChange={updateDraft} onRestore={restoreField} /></div><DraftTextField label="使用场景" field="scenario" group={group} multiline onChange={updateDraft} onRestore={restoreField} /><DraftTextField label="预期结果" field="expectedOutcome" group={group} multiline onChange={updateDraft} onRestore={restoreField} /><div className="draft-questions"><header><span>待确认问题</span><div>{fieldEdited(group, "openQuestions") && <button onClick={() => restoreField(group, "openQuestions")}>恢复 AI 建议</button>}<button onClick={() => updateDraft(group.id, { openQuestions: [...(group.currentDraft.openQuestions ?? []), ""] })}>＋ 新增</button></div></header>{(group.currentDraft.openQuestions ?? []).map((question, questionIndex) => <div className={group.confirmedQuestions.includes(question) ? "resolved" : ""} key={`${group.id}-question-${questionIndex}`}><input value={question} onChange={(event) => updateDraft(group.id, { openQuestions: (group.currentDraft.openQuestions ?? []).map((item, itemIndex) => itemIndex === questionIndex ? event.target.value : item) })} /><button onClick={() => updateGroup(group.id, { confirmedQuestions: group.confirmedQuestions.includes(question) ? group.confirmedQuestions.filter((item) => item !== question) : [...group.confirmedQuestions, question] })}>{group.confirmedQuestions.includes(question) ? "取消确认" : "标记已确认"}</button><button onClick={() => updateDraft(group.id, { openQuestions: (group.currentDraft.openQuestions ?? []).filter((_, itemIndex) => itemIndex !== questionIndex) })}>删除</button></div>)}</div><DraftTextField label="提炼说明（可选）" field="rationale" group={group} multiline onChange={updateDraft} onRestore={restoreField} /></article>)}</section></div> : <div className="refinement-signals"><p>选择一个或多个 Signal。AI 会根据原始事实和图片附件生成问题归组与 Requirement 草稿，确认前不会修改任何正式对象。</p>{eligible.map((signal) => <label key={signal.id} aria-label={`选择 ${signal.unified.title}`}><input type="checkbox" checked={selectedIds.includes(signal.id)} onChange={() => setSelectedIds((ids) => toggleRefinementSelection(ids, signal.id))} /><span><strong>{signal.unified.title}</strong><small>{sourceLabels[signal.unified.sourceType]} · {signal.standardized?.problem || signal.unified.content}</small></span></label>)}</div>}{error && <p className="form-error">{error}</p>}<footer>{groups.length ? <><button className="secondary-action" onClick={cancelDraft}>取消草稿</button><button className="primary-action" disabled={!valid} onClick={confirmDraft}>确认生成 {activeGroups.length} 条需求</button></> : <><button className="secondary-action" onClick={onClose}>取消</button><button className="secondary-action" disabled={!selected.length} onClick={createManual}>人工提炼</button><button className="primary-action" disabled={busy || !selected.length} onClick={analyze}>{busy ? "AI 提炼中…" : "AI 提炼"}</button></>}</footer><span className="refinement-actor">确认人：{actor}</span></div></div>;
}

function DraftTextField({ label, field, group, multiline = false, onChange, onRestore }: { label: string; field: CandidateTextField; group: RefinementDraftGroup; multiline?: boolean; onChange: (id: string, change: Partial<RequirementCandidate>) => void; onRestore: (group: RefinementDraftGroup, field: CandidateTextField) => void }) {
  const current = String(group.currentDraft[field] ?? ""); const original = String(group.aiOriginal[field] ?? ""); const edited = current !== original;
  return <label className="field draft-field"><span>{label}<i>{edited ? "已编辑" : group.currentDraft.createdBy === "ai" ? "AI 草稿" : "人工草稿"}</i>{edited && <button type="button" onClick={() => onRestore(group, field)}>恢复 AI 建议</button>}</span>{multiline ? <textarea rows={field === "description" ? 4 : 2} value={current} onChange={(event) => onChange(group.id, { [field]: event.target.value || (field === "problem" ? null : "") } as Partial<RequirementCandidate>)} /> : <input value={current} onChange={(event) => onChange(group.id, { [field]: event.target.value || null } as Partial<RequirementCandidate>)} />}</label>;
}

function MergeCandidateWorkbench({ candidate, decision, requirements, projections: sourceProjections, versions, onChange, onDecision }: { candidate: Extract<ReviewChangeCandidate, { kind: "merge" }>; decision: ReviewCandidateState["decision"]; requirements: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[]; onChange: (change: Partial<ReviewChangeCandidate>) => void; onDecision: (decision: ReviewCandidateState["decision"]) => void }) {
  const [query, setQuery] = useState(""); const selected = requirements.filter((requirement) => candidate.requirementIds.includes(requirement.id));
  const available = requirements.filter((requirement) => !candidate.requirementIds.includes(requirement.id) && requirement.title.toLowerCase().includes(query.toLowerCase()) && sourceProjections.find((projection) => projection.objectId === requirement.id)?.currentStage === "planning");
  const toggle = (id: string) => onChange({ requirementIds: candidate.requirementIds.includes(id) ? candidate.requirementIds.filter((item) => item !== id) : [...candidate.requirementIds, id] } as Partial<ReviewChangeCandidate>);
  return <article className={`merge-workbench ${decision}`}><div className="section-heading"><div><div className="detail-label">建议动作 · 合并 Requirement</div><h3>明确来源后生成新的 Requirement</h3></div><button onClick={() => onDecision("ignored")}>忽略</button></div><p className="merge-rationale">{candidate.rationale}</p><label className="field"><span>搜索并添加 planning Requirement</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Requirement" /></label>{query && <div className="merge-search-results">{available.map((requirement) => <button key={requirement.id} onClick={() => toggle(requirement.id)}>＋ {requirement.key} · {requirement.title}</button>)}</div>}<div className="merge-source-cards">{selected.map((requirement) => { const projection = sourceProjections.find((item) => item.objectId === requirement.id); return <article key={requirement.id}><div><strong>{requirement.key} · {requirement.title}</strong><button onClick={() => toggle(requirement.id)}>移除</button></div><p>{requirement.summary}</p><small>{stageById(projection?.currentStage ?? "planning").label} · {versionName(requirement.targetVersionId, versions)} · {requirement.owner}</small></article>; })}</div><div className="merge-result-editor"><div className="detail-label">Merge Candidate</div><label className="field"><span>新 Requirement 标题</span><input value={candidate.title} onChange={(event) => onChange({ title: event.target.value })} /></label><label className="field"><span>需求描述</span><textarea rows={4} value={candidate.summary || ""} onChange={(event) => onChange({ summary: event.target.value } as Partial<ReviewChangeCandidate>)} /></label><label className="field"><span>合并说明</span><textarea rows={3} value={candidate.rationale} onChange={(event) => onChange({ rationale: event.target.value })} /></label></div><div className="merge-confirm-summary"><strong>确认摘要</strong><span>将合并 {selected.length} 个 Requirement，生成 1 个新的 Requirement</span><span>原 Requirement 不删除；新需求重新进入待评审，目标版本需重新规划</span></div><div className="candidate-actions"><button onClick={() => onDecision("ignored")}>返回修改</button><button className={decision === "confirmed" ? "confirmed" : ""} disabled={selected.length < 2 || !candidate.title.trim() || !candidate.summary?.trim()} onClick={() => onDecision("confirmed")}>{decision === "confirmed" ? "已确认合并" : "确认合并"}</button></div></article>;
}

function ReviewWorkbench({ actor, requirements, allRequirements, projections: allProjections, versions, onReturn, onClose, onApply }: { actor: string; requirements: ProductObject[]; allRequirements: ProductObject[]; projections: ObjectProjection[]; versions: ProductVersion[]; onReturn: (id: string) => void; onClose: () => void; onApply: (command: { drafts: RequirementReviewDraft[]; candidates: ReviewChangeCandidate[]; actor: string; occurredAt: string }, close?: boolean) => void }) {
  void onReturn;
  const [step, setStep] = useState<"meeting" | "processing" | "manual" | "candidates">("meeting");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<RequirementReviewDraft[]>(() => requirements.map((requirement) => ({ requirementId: requirement.id, priority: requirement.priority ?? undefined, owner: requirement.owner === "待定" ? "" : requirement.owner ?? "", result: "approved", notes: "" })));
  const [candidateStates, setCandidateStates] = useState<ReviewCandidateState[]>([]);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [manualKind, setManualKind] = useState<"merge" | "split" | "new_signal">("merge");
  const [manualTargetId, setManualTargetId] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const current = requirements[index];
  const currentDraft = drafts[index];
  const updateDraft = (change: Partial<RequirementReviewDraft>) => setDrafts((items) => items.map((draft, draftIndex) => draftIndex === index ? { ...draft, ...change } : draft));
  const applyOrdinary = (close = true) => onApply({ drafts, candidates: [], actor, occurredAt: new Date().toISOString() }, close);
  const analyze = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/reviews/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirements: allRequirements, drafts }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "评审整理失败");
      const resolvedDrafts = payload.drafts as RequirementReviewDraft[];
      setDrafts(resolvedDrafts);
      setCandidateStates((payload.candidates as ReviewChangeCandidate[]).map((candidate) => ({ candidate, decision: "pending" })));
      setCompletedActions(resolvedDrafts.flatMap((draft) => { const requirement = requirements.find((item) => item.id === draft.requirementId); if (!requirement) return []; return [draft.priority !== requirement.priority ? `优先级 ${requirement.priority ?? "未设置"} → ${draft.priority ?? "未设置"}` : null, draft.owner !== (requirement.owner === "待定" ? "" : requirement.owner) ? `负责人 → ${draft.owner || "待定"}` : null, `评审结果 → ${reviewResultLabels[draft.result]}`, draft.notes.trim() ? "评审备注已记录" : null].filter((item): item is string => Boolean(item)); }));
      onApply({ drafts: resolvedDrafts, candidates: [], actor, occurredAt: new Date().toISOString() }, false);
      setStep("candidates");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "评审整理失败"); }
    finally { setBusy(false); }
  };
  const setDecision = (id: string, decision: ReviewCandidateState["decision"]) => setCandidateStates((items) => items.map((item) => item.candidate.id === id ? { ...item, decision } : item));
  const updateCandidate = (id: string, change: Partial<ReviewChangeCandidate>) => setCandidateStates((items) => items.map((item) => item.candidate.id === id ? { ...item, candidate: { ...item.candidate, ...change } as ReviewChangeCandidate } : item));
  const confirmed = candidateStates.filter((item) => item.decision === "confirmed").map((item) => item.candidate);
  const candidateLabel = (candidate: ReviewChangeCandidate) => candidate.kind === "merge" ? "合并建议" : candidate.kind === "split" ? "拆分建议" : candidate.kind === "new_signal" ? "发现新的需求" : "Requirement 调整";
  const previewManualStructure = () => {
    const source = requirements[0];
    if (!source || !manualTitle.trim() || (manualKind === "merge" && !manualTargetId)) return;
    const rationale = drafts[0]?.notes || "由评审人员手动发起。";
    const candidate: ReviewChangeCandidate = manualKind === "merge" ? { id: `manual-merge-${Date.now()}`, kind: "merge", requirementIds: [source.id, manualTargetId], title: manualTitle, rationale } : manualKind === "split" ? { id: `manual-split-${Date.now()}`, kind: "split", sourceRequirementId: source.id, title: source.title, secondTitle: manualTitle, rationale } : { id: `manual-signal-${Date.now()}`, kind: "new_signal", sourceRequirementId: source.id, title: manualTitle, content: rationale, rationale: "评审中人工确认发现独立问题。" };
    setCompletedActions(["优先级、负责人、评审结果与备注将直接应用"]);
    setCandidateStates([{ candidate, decision: "pending" }]);
    onApply({ drafts, candidates: [], actor, occurredAt: new Date().toISOString() }, false);
    setStep("candidates");
  };
  const candidateCard = ({ candidate, decision }: ReviewCandidateState) => candidate.kind === "merge" ? <MergeCandidateWorkbench key={candidate.id} candidate={candidate} decision={decision} requirements={allRequirements} projections={allProjections} versions={versions} onChange={(change) => updateCandidate(candidate.id, change)} onDecision={(value) => setDecision(candidate.id, value)} /> : <article className={`review-candidate ${decision}`} key={candidate.id}><div className="candidate-number">△</div><div className="candidate-content"><span>{candidateLabel(candidate)}</span><label className="field"><span>结果预览</span><input value={candidate.title} onChange={(event) => updateCandidate(candidate.id, { title: event.target.value })} /></label>{candidate.kind === "split" && <label className="field"><span>第二个 Requirement</span><input value={candidate.secondTitle} onChange={(event) => updateCandidate(candidate.id, { secondTitle: event.target.value })} /></label>}{candidate.kind === "requirement_adjustment" && <label className="field"><span>调整后需求</span><textarea rows={3} value={candidate.summary} onChange={(event) => updateCandidate(candidate.id, { summary: event.target.value })} /></label>}{candidate.kind === "new_signal" && <label className="field"><span>原始信息</span><textarea rows={3} value={candidate.content} onChange={(event) => updateCandidate(candidate.id, { content: event.target.value })} /></label>}<div className="candidate-rationale"><span>判断依据</span><p>{candidate.rationale}</p></div><div className="candidate-actions"><button onClick={() => setDecision(candidate.id, "ignored")}>忽略</button><button className={decision === "confirmed" ? "confirmed" : ""} onClick={() => setDecision(candidate.id, "confirmed")}>{decision === "confirmed" ? "已确认" : "确认"}</button></div></div></article>;
  if (!requirements.length) return null;
  return <div className="workbench-layer review-layer" role="dialog" aria-modal="true" aria-label="需求评审"><div className="workbench review-workbench">
    <header><div><span>产品规划 · 需求评审</span><h2>{step === "meeting" ? `需求评审 ${index + 1} / ${requirements.length}` : step === "processing" ? "处理评审结果" : step === "manual" ? "手动处理" : "评审备注处理结果"}</h2></div><button onClick={onClose} aria-label="关闭评审">×</button></header>
    {step === "meeting" && current && currentDraft && <div className="review-meeting"><section className="review-context"><div className="detail-label">Requirement</div><h3>{current.title}</h3><span>需求</span><p>{current.summary}</p><small>来源事实与历史将在正式对象中继续保留</small></section><section className="review-form"><div className="review-form-grid"><fieldset><legend>优先级</legend><div className="priority-options">{(["P0", "P1", "P2", "P3"] as Priority[]).map((value) => <button className={currentDraft.priority === value ? "active" : ""} onClick={() => updateDraft({ priority: value })} key={value}>{value}</button>)}</div><small className="priority-definition">{currentDraft.priority ? `${priorityDefinitions[currentDraft.priority].label}：${priorityDefinitions[currentDraft.priority].description}` : "P0 核心闭环 · P1 闭环稳定 · P2 Skill 可用 · P3 体验优化"}</small></fieldset><label className="field"><span>负责人</span><select value={currentDraft.owner} onChange={(event) => updateDraft({ owner: event.target.value })}><option value="">待定</option>{people.map((person) => <option key={person.id}>{person.name}</option>)}</select></label><label className="field"><span>评审结果</span><select value={currentDraft.result} onChange={(event) => updateDraft({ result: event.target.value as ReviewResult })}>{(Object.entries(reviewResultLabels) as [ReviewResult, string][]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><label className="field"><span>备注</span><textarea rows={7} value={currentDraft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="记录会议事实、结论，以及合并、新问题或理解变化。无需现场整理结构。" /></label></section></div>}
    {step === "processing" && <div className="review-processing"><div className="detail-label">评审已经记录完成</div><h3>选择如何处理本次变化</h3><p>人工处理直接调用业务 Action；AI 处理备注会自动应用低风险变化，只把合并、拆分和新对象留给你确认。</p><div><button className="secondary-action" onClick={() => setStep("manual")}><strong>手动处理</strong><small>直接更新，或发起合并、拆分和新增 Signal</small></button><button className="primary-action" disabled={busy} onClick={analyze}><strong>{busy ? "正在处理…" : "AI 处理备注"}</strong><small>识别可执行 Action，并按风险自动分流</small></button></div></div>}
    {step === "manual" && <div className="review-manual"><section><div className="detail-label">普通 Action</div><h3>直接应用明确变化</h3><p>优先级、负责人、评审结果和备注不需要再次确认。</p><button className="primary-action" onClick={() => applyOrdinary(true)}>应用普通更新</button></section><section><div className="detail-label">结构 Action</div><h3>先查看结果，再确认生成关系</h3><label className="field"><span>动作</span><select value={manualKind} onChange={(event) => setManualKind(event.target.value as typeof manualKind)}><option value="merge">合并</option><option value="split">拆分</option><option value="new_signal">新增 Signal</option></select></label>{manualKind === "merge" && <label className="field"><span>合并对象</span><select value={manualTargetId} onChange={(event) => setManualTargetId(event.target.value)}><option value="">选择 planning Requirement</option>{allRequirements.filter((item) => item.id !== requirements[0]?.id && allProjections.find((projection) => projection.objectId === item.id)?.currentStage === "planning").map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}<label className="field"><span>{manualKind === "merge" ? "新 Requirement 标题" : manualKind === "split" ? "拆出的需求标题" : "Signal 标题"}</span><input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} /></label><button className="secondary-action" disabled={!manualTitle.trim() || (manualKind === "merge" && !manualTargetId)} onClick={previewManualStructure}>查看结果预览</button></section></div>}
    {step === "candidates" && <div className="review-results"><section className="review-action-result"><div className="detail-label">已完成</div>{completedActions.map((action, actionIndex) => <p key={`${action}-${actionIndex}`}>✓ {action}</p>)}</section><section className="candidate-section"><div className="detail-label">需要确认</div>{candidateStates.length ? candidateStates.map(candidateCard) : <div className="candidate-empty"><p>没有需要额外确认的结构变化，低风险 Action 已经完成。</p></div>}</section></div>}
    {error && <p className="form-error">{error}</p>}<footer>{step === "meeting" ? <><button className="secondary-action" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>上一条</button>{index < requirements.length - 1 ? <button className="primary-action" onClick={() => setIndex((value) => value + 1)}>下一条</button> : <button className="primary-action" onClick={() => setStep("processing")}>结束评审</button>}</> : step === "processing" || step === "manual" ? <button className="secondary-action" onClick={() => setStep(step === "manual" ? "processing" : "meeting")}>返回</button> : <><button className="secondary-action" onClick={onClose}>完成</button>{candidateStates.length > 0 && <button className="secondary-action" onClick={() => setCandidateStates((items) => items.map((item) => ({ ...item, decision: "confirmed" })))}>全部确认</button>}<button className="primary-action" disabled={candidateStates.some((item) => item.decision === "pending")} onClick={() => confirmed.length ? onApply({ drafts: [], candidates: confirmed, actor, occurredAt: new Date().toISOString() }) : onClose()}>应用已确认项</button></>}</footer>
  </div></div>;
}

function StandardizationWorkbench({ signal, projection, actor, onClose, onConfirmed }: { signal: Signal; projection: ObjectProjection; actor: string; onClose: () => void; onConfirmed: (result: { signal: Signal; projection: ObjectProjection; event: EvolutionEvent }) => void }) {
  const [candidate, setCandidate] = useState<StandardizedSignal | null>(signal.standardized ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const raw = signal.rawData;
  const generate = async () => {
    setBusy(true); setError("");
    try {
      const input: SignalInput = { sourceType: raw.sourceType, sourceChannel: signal.unified.channel, rawContent: raw.content, collectedAt: raw.createdAt, attachments: signal.unified.attachments };
      const response = await fetch("/api/signals/standardize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "生成建议失败");
      setCandidate(payload.candidate);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "生成建议失败"); }
    finally { setBusy(false); }
  };
  const update = (field: keyof StandardizedSignal, value: string) => setCandidate((current) => current ? { ...current, [field]: value } : current);
  const confirm = () => { if (!candidate) return; onConfirmed(confirmSignalStandardization(signal, projection, candidate, actor, new Date().toISOString())); };
  return <div className="workbench-layer" role="dialog" aria-modal="true" aria-label="处理需求标准化"><div className="workbench">
    <header><div><span>原始需求 · 待标准化</span><h2>{signal.unified.title}</h2></div><button onClick={onClose} aria-label="关闭处理界面">×</button></header>
    <div className="workbench-body"><section><div className="detail-label">原始材料</div><h3>忠实保留的来源信息</h3><div className="raw-material"><p>{raw.content}</p><small>{sourceLabels[raw.sourceType]} · {raw.submitter} · {raw.createdAt.slice(0, 10)}</small></div><AttachmentList attachments={signal.unified.attachments} /></section>
      <section><div className="detail-label">AI 提炼建议</div><h3>标准化候选</h3>{candidate ? <div className="candidate-workbench"><label className="field"><span>标题</span><input value={candidate.title} onChange={(event) => update("title", event.target.value)} /></label><label className="field"><span>问题描述</span><textarea rows={5} value={candidate.problem} onChange={(event) => update("problem", event.target.value)} /></label><div className="candidate-grid"><label className="field"><span>使用场景</span><input value={candidate.scenario || ""} onChange={(event) => update("scenario", event.target.value)} /></label><label className="field"><span>相关模块</span><input value={candidate.module || ""} onChange={(event) => update("module", event.target.value)} /></label></div></div> : <div className="candidate-empty"><p>AI 建议只在你决定处理时生成。原始材料不会被覆盖。</p><button className="primary-action" onClick={generate} disabled={busy}>{busy ? "生成中…" : "生成标准化建议"}</button></div>}{error && <p className="form-error">{error}</p>}</section>
    </div><footer><button className="secondary-action" onClick={onClose}>暂不处理</button><button className="primary-action" onClick={confirm} disabled={!candidate}>确认标准化</button></footer>
  </div></div>;
}

type CreatedPayload = { signal: Signal; projection: ObjectProjection; evolution: EvolutionEvent[] };

function IntakeEntrySkeleton({ kind, onClose, onSynced }: { kind: "table" | "feedback"; onClose: () => void; onSynced: (entries: CreatedPayload[]) => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const importDemo = async () => { setBusy(true); try {
    const response = await fetch("/api/import/product-feedback", { method: "POST" });
    if (!response.ok) throw new Error("导入失败");
    const payload = await response.json(); onSynced(payload.entries);
    setMessage(`合成反馈：新增 ${payload.result.added} 条，跳过 ${payload.result.skipped} 条。`);
  } catch { setMessage("合成反馈导入失败"); } finally { setBusy(false); } };
  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="演示数据导入"><button className="drawer-scrim" onClick={onClose} aria-label="关闭" /><aside className="demand-dialog"><div className="demand-header"><h2>{kind === "table" ? "表格导入边界" : "导入合成反馈"}</h2><button onClick={onClose}>×</button></div><div className="demand-body"><p>{kind === "table" ? "公开版未实现表格解析与批量导入。请使用手动新增或合成反馈。" : "仅导入固定的虚构沙盒反馈；不会连接任何外部系统。重复导入按来源 ID 去重。"}</p>{message && <p>{message}</p>}{kind === "feedback" && <button className="primary-action" disabled={busy} onClick={importDemo}>{busy ? "导入中…" : "导入合成反馈"}</button>}<button onClick={onClose}>关闭</button></div></aside></div>;
}

function NewDemandDialog({ actor, defaultSubmitter, onClose, onCreated }: { actor: string; defaultSubmitter: string; onClose: () => void; onCreated: (created: CreatedPayload) => void }) {
  const [sourceType, setSourceType] = useState<"team_discovery" | "user_feedback">("team_discovery");
  const [sourceChannel, setSourceChannel] = useState("产品测试");
  const [title, setTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [submitter, setSubmitter] = useState(() => defaultSubmitter);
  const [collectedAt, setCollectedAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input: SignalInput = { sourceType, sourceChannel, title, submitter, rawContent, collectedAt: collectedAt ? new Date(collectedAt).toISOString() : "", attachments };

  const selectScreenshots = async (files: FileList | null) => {
    if (!files) return;
    const images = [...files];
    if (images.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) { setError("仅支持 5MB 以内的图片"); return; }
    const refs = await Promise.all(images.map((file, index) => new Promise<AttachmentRef>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: `screenshot-${Date.now()}-${index}`, name: file.name, mediaType: file.type, url: String(reader.result), source: "alchemy_upload" });
      reader.onerror = () => reject(new Error("截图读取失败"));
      reader.readAsDataURL(file);
    })));
    setAttachments((current) => [...current, ...refs]);
    setError("");
  };

  const confirm = async () => {
    if (!rawContent.trim()) { setError("请输入原始内容"); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/signals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, actor }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "汇入失败");
      onCreated(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "汇入失败"); }
    finally { setBusy(false); }
  };

  return <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="新需求">
    <button className="drawer-scrim" onClick={onClose} aria-label="关闭新需求" />
    <aside className="demand-dialog">
      <div className="demand-header"><div><span>原始需求</span><h2>新需求</h2></div><button onClick={onClose} aria-label="关闭">×</button></div>
      <div className="demand-body">
        <fieldset><legend>来源</legend><label><input type="radio" checked={sourceType === "team_discovery"} onChange={() => { setSourceType("team_discovery"); setSourceChannel("产品测试"); }} /> 团队发现</label><label><input type="radio" checked={sourceType === "user_feedback"} onChange={() => { setSourceType("user_feedback"); setSourceChannel("内测群"); }} /> 用户反馈</label></fieldset>
        <div className="candidate-grid"><label className="field"><span>提交人</span><input value={submitter} onChange={(event) => setSubmitter(event.target.value)} placeholder={sourceType === "team_discovery" ? "团队成员姓名" : "姓名或称呼，可留空"} /></label><label className="field"><span>创建时间</span><input type="datetime-local" value={collectedAt} onChange={(event) => setCollectedAt(event.target.value)} /></label></div>
        <div className="candidate-grid"><label className="field"><span>渠道</span><select value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)}>{sourceType === "team_discovery" ? <><option>使用体验</option><option>产品测试</option><option>研发过程</option><option>数据分析</option></> : <><option>内测群</option><option>线下沟通</option><option>访谈</option><option>其他</option></>}</select></label><label className="field"><span>标题（选填）</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="留空时根据原始内容生成" /></label></div>
        <label className="field"><span>原始内容</span><textarea value={rawContent} onChange={(event) => setRawContent(event.target.value)} placeholder="在这里输入收到的反馈、问题或想法" rows={7} /></label>
        <label className="screenshot-field"><span>截图</span><input type="file" accept="image/*" multiple onChange={(event) => void selectScreenshots(event.target.files)} /><small>支持一张或多张图片，单张不超过 5MB</small></label>
        {attachments.length > 0 && <div className="screenshot-list">{attachments.map((attachment) => <div key={attachment.id}><span className="screenshot-file">图片</span><span>{attachment.name}</span><button onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label={`移除 ${attachment.name}`}>×</button></div>)}</div>}
        <div className="demand-actions"><button className="primary-action" onClick={confirm} disabled={busy}>{busy ? "正在汇入…" : "确认汇入"}</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </aside>
  </div>;
}

function ReturnStepDialog({ object, preview, onClose, onConfirm }: { object: ProductObject; preview: ReturnStepPreview; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return <div className="workbench-layer return-step-layer" role="dialog" aria-modal="true" aria-label="返回上一步"><div className="workbench return-step-dialog"><header><div><span>对象操作</span><h2>返回上一步</h2></div><button onClick={onClose}>×</button></header><div className="return-step-body"><p className="return-object-title">{object.title}</p><div className="return-step-facts"><Fact label="当前状态" value={`${stageById(preview.currentStage).label} / ${preview.currentStatus}`} /><Fact label="上一步操作" value={preview.previousOperation} />{preview.targetStage && preview.targetStatus && <Fact label="返回后" value={`${stageById(preview.targetStage).label} / ${preview.targetStatus}`} />}</div>{preview.blocked ? <div className="return-step-blocked"><strong>无法直接返回</strong><p>{preview.blockedReason}</p></div> : <label className="field"><span>返回原因</span><textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明为什么需要返回上一步" /></label>}</div><footer><button className="secondary-action" onClick={onClose}>取消</button><button className="primary-action" disabled={preview.blocked || !reason.trim()} onClick={() => onConfirm(reason)}>确认返回</button></footer></div></div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function EvolutionMap() {
  return <>
    <Header eyebrow="系统逻辑" title="演化地图" copy="Alchemy 取意于炼金术中的持续转化：它不只记录对象现在是什么，更追踪对象如何由现实输入、人的观察与行动持续生成。" />
    <section className="evolution-origin" aria-label="Alchemy 演化思想">
      <div><span>ALCHEMY</span><h2>持续转化，而不是静态状态</h2><p>现实中的零散信号经过提炼、判断、实现与验证，逐渐形成可以行动和交付的对象。每次变化都保留来源、原因与时间，不用一个当前状态覆盖生成过程。</p></div>
      <div className="evolution-principles"><article><small>OBJECT EVOLUTION</small><strong>对象沿时间演化</strong><p>当前形态只是 Evolution 历史在此刻的投影。</p></article><article><small>OBSERVER LOOP</small><strong>观察者参与生成</strong><p>View → Attention → Action → Evolution → 新的现实。</p></article><article><small>LINEAGE</small><strong>来源与去向可追溯</strong><p>sourceObjectId → targetObjectId 保留提炼、合并与拆分关系。</p></article></div>
    </section>
    <section className="concept-map" aria-label="Alchemy 对象生成与演化逻辑">
      <div className="map-layer-heading"><span>01</span><div><strong>系统原理</strong><p>Alchemy 认为事物是怎么生成和变化的？</p></div></div>
      <div className="concept-time"><i /><strong>时间 →</strong></div>
      <div className="concept-chain">
        <div className="reality-node"><span>现实</span><small>持续输入</small></div><span className="concept-arrow">→</span>
        <ConceptObject index="0" /><span className="concept-arrow">→</span>
        <ConceptTransformation index="1" /><span className="concept-arrow">→</span>
        <ConceptObject index="1" /><span className="concept-arrow">→</span>
        <ConceptTransformation index="2" /><span className="concept-arrow">→</span>
        <ConceptObject index="2" /><span className="concept-arrow">→</span><span className="concept-ellipsis">…</span>
      </div>
      <p className="map-single-note">对象在现实输入与决策作用下不断发生 Transformation，形成新的稳定形态；历史不被覆盖，时间始终向前。</p>
    </section>
    <section className="cycle-rules" aria-label="Cycle 演化规则">
      <div className="map-layer-heading"><span>02</span><div><strong>Cycle 演化规则</strong><p>一个 Object 的正式事实如何沿时间变化？</p></div></div>
      <div className="cycle-flow">
        <div className="cycle-source"><strong>Object · Cycle N</strong><small>当前稳定形态</small></div><i>↓</i>
        <div className="cycle-input"><span>新输入 / Action</span><small>Human / AI 可以参与</small></div><i>↓</i>
        <div className="cycle-apply"><strong>本轮业务结论</strong><small>验证后决定是否继续处理</small></div><i>↓</i>
        <div className="cycle-transformation">Transformation</div>
        <div className="cycle-branches"><article><span>同一 Object 仍需处理</span><strong>Cycle N+1</strong></article><article><span>生成新 Object</span><strong>Cycle 1</strong></article></div>
      </div>
      <div className="cycle-rule-notes"><p><strong>当前处理轮次</strong><span>规划、研发与验证通常属于同一 Cycle</span></p><p><strong>继续处理</strong><span>验证形成结论后才进入下一 Cycle</span></p><p><strong>普通 Event / 返回</strong><span>不会改变 Cycle</span></p><p><strong>生成对象</strong><span>新 Object 从 Cycle 1 开始</span></p></div>
      <div className="cycle-examples"><div><code>REQ-001 · Cycle 2 · P2</code><i>Apply</i><code>REQ-001 · Cycle 3 · P1</code></div><div><code>REQ-A · N + REQ-B · M</code><i>合并</i><code>REQ-C · Cycle 1</code></div><div><code>REQ-A · Cycle N</code><i>拆分</i><code>REQ-B · 1 + REQ-C · 1</code></div></div>
    </section>
    <section className="v1-evolution demand-journey" aria-label="Alchemy V1 一条需求的完整生命周期">
      <div className="map-layer-heading"><span>03</span><div><strong>一条需求的完整生命周期</strong><p>一条现实输入在当前产品中具体怎么走？</p></div></div>
      <div className="v1-lifecycle-map">
        <div className="v1-stage-row">{lifecycleStages.map((stage, index) => <div key={stage.id}><span>{stage.label}</span>{index < lifecycleStages.length - 1 && <i>→</i>}</div>)}</div>
      </div>
      <div className="demand-journey-flow">
        <JourneyStep title="现实输入" copy="用户反馈、产品反馈或团队发现" />
        <JourneyStep title="Raw 原始数据" copy="原文、来源、时间、提交人、附件与外部 ID 永久保留" />
        <JourneyStep title="字段结构化 → Signal" copy="只整理成可处理字段，不等于需求提炼" />
        <JourneyStep title="需求提炼 → Requirement" copy="人工提炼或 AI 建议；确认并 Apply 后形成 Requirement" />
        <JourneyStep title="产品规划 / 评审" copy="单条或批量记录优先级、负责人、结果与备注" actions={["更新当前需求", "合并", "拆分", "新增 Signal", "仅记录"]} />
        <JourneyStep title="研发实现" copy="待开发 → 开发中 → 阻塞 → 已完成；只记录真实实现事实" />
        <JourneyStep title="交付验证" copy="通过 / 部分通过 / 未通过；重新接触现实" actions={["发现新问题 → New Signal", "进入原始需求", "开始下一轮演化"]} />
      </div>
      <div className="journey-transformations"><span>SIG-A + SIG-B</span><i>提炼</i><strong>REQ-C</strong><span>REQ-A + REQ-B</span><i>合并</i><strong>REQ-C · Cycle 1</strong><span>REQ-A</span><i>拆分</i><strong>REQ-B + REQ-C</strong></div>
      <p className="forward-only-note">评审中发生合并或拆分、验证中发现新问题，都产生新的 Transformation 或 Object；阶段和时间不会回退。</p>
      <p className="evolution-closing">现实不断产生新的输入，Object 在 AI、Human 与 Decision 的作用下持续发生 Transformation；一轮形成结论后如仍需处理才进入新的 Cycle，新对象从 Cycle 1 开始，整个系统只向前演化。</p>
    </section>
  </>;
}

function ConceptObject({ index }: { index: string }) { return <div className="concept-object"><span>Object<sub>{index}</sub></span><small>可观察形态</small></div>; }
function ConceptTransformation({ index }: { index: string }) { return <div className="concept-transformation"><div><span>Transformation<sub>{index}</sub></span><small>生成与变化</small></div><i /><div className="concept-participation"><span>AI + Human</span><b>Decision</b></div></div>; }
function JourneyStep({ title, copy, actions }: { title: string; copy: string; actions?: string[] }) { return <div className="journey-step"><article><strong>{title}</strong><p>{copy}</p>{actions && <div>{actions.map((action) => <span key={action}>{action}</span>)}</div>}</article><i>↓</i></div>; }

function SettingsPage() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [error, setError] = useState("");
  const preview = async () => {
    try { const response = await fetch("/api/daily-brief/send"); if (!response.ok) throw new Error("预览失败"); setBrief((await response.json()).brief); }
    catch { setError("暂时无法预览简报"); }
  };
  return <><Header eyebrow="公开演示" title="演示设置" copy="所有分析使用 Mock；不提供凭证、外部地址或发送配置。" /><section className="panel settings-card"><h2>合成数据快照简报</h2><p>简报来自预置数据，不汇总当前浏览器中的修改；不执行定时任务或外部发送。</p><button className="secondary-action" onClick={preview}>预览合成简报</button>{error && <p>{error}</p>}{brief && <article><h3>{brief.title}</h3>{brief.sections.map(section => <section key={section.title}><h4>{section.title}</h4>{section.items.map(item => <p key={item}>{item}</p>)}</section>)}</article>}</section></>;
}

function QuietPage() {
  return <><Header eyebrow="需求工作区" title="归档" copy="保留已结束需求及其来源和操作历史。" /><div className="quiet-page panel"><span>□</span><h2>暂无归档需求</h2><p>V1 保留这个稳定入口，不提前扩展非核心能力。</p></div></>;
}
