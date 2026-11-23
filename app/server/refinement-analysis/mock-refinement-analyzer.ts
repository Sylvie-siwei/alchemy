import type { Signal } from "../../domain/model";
import type { RefinementPlan, RefinementProblem, RefinementSuggestion, RequirementCandidate } from "../../domain/refinement";
import type { AIProvider, RefinementAnalyzer } from "./provider";

const draft = (problem: RefinementProblem, title = problem.name, openQuestions: string[] = []): RequirementCandidate => ({ id: `draft-${problem.id}`, title, problem: problem.summary, description: problem.summary, openQuestions, rationale: "Mock 根据已识别 Problem 生成的待确认需求草稿。", sourceSignalIds: problem.sourceSignalIds, createdBy: "ai", status: "pending_confirmation", problemSnapshot: { id: problem.id, name: problem.name, summary: problem.summary, sourceSignalIds: problem.sourceSignalIds } });

export class MockRefinementAnalyzer implements RefinementAnalyzer {
  readonly name = "mock" as const;
  async analyzeSignals(signals: Signal[]) {
    const byKey = new Map(signals.map((signal) => [signal.key, signal]));
    const used = new Set<string>(); const problems: RefinementProblem[] = []; const suggestions: RefinementSuggestion[] = [];
    const add = (problem: RefinementProblem) => { problems.push(problem); problem.sourceSignalIds.forEach((id) => used.add(id)); };
    const pair = [byKey.get("SIG-M01"), byKey.get("SIG-M06")].filter((signal): signal is Signal => Boolean(signal));
    if (pair.length === 2) { add({ id: "problem-immediate-run", name: "定时任务缺少即时执行能力", summary: "用户调试任务时无法绕过计划时间立即触发一次执行。", sourceSignalIds: pair.map((signal) => signal.id), disposition: "generate", confidence: .97 }); suggestions.push({ id: "suggest-merge-immediate-run", kind: "merge", signalIds: pair.map((signal) => signal.id), problemIds: ["problem-immediate-run"], title: "建议合并", reason: "两条反馈都在表达定时任务缺少即时执行能力。", confidence: .97 }); }
    const split = (key: string, definitions: Array<[string, string, string]>) => { const signal = byKey.get(key); if (!signal) return; const ids: string[] = []; definitions.forEach(([id, name, summary]) => { ids.push(id); add({ id, name, summary, sourceSignalIds: [signal.id], disposition: "generate", confidence: .88 }); }); suggestions.push({ id: `suggest-split-${key}`, kind: "split", signalIds: [signal.id], problemIds: ids, title: "建议拆分", reason: `一条反馈中包含 ${definitions.length} 个可独立验证的问题。`, confidence: .88 }); };
    split("SIG-M04", [["problem-run-visibility", "任务执行过程不可感知", "任务执行中缺少进度和当前步骤反馈。"], ["problem-failure-location", "失败节点无法定位", "任务失败后无法判断具体失败节点。"]]);
    split("SIG-M05", [["problem-task-isolation", "多人任务缺少项目或团队隔离", "多人使用时任务混在一起，缺少清晰的组织边界。"], ["problem-permission-isolation", "协作权限缺少隔离", "不同项目或团队之间的访问权限无法隔离。"]]);
    split("SIG-M10", [["problem-resource-accounting", "项目资源消耗不可统计", "项目结束后无法查看 GPU 等资源消耗。"], ["problem-cost-accounting", "项目成本不可核算和导出", "项目成本无法分项目查看并导出给财务。"]]);
    for (const signal of signals.filter((item) => !used.has(item.id))) {
      const unclear = ["SIG-M03", "SIG-M07"].includes(signal.key); const solutionLed = signal.key === "SIG-M08";
      const name = signal.key === "SIG-M03" ? "任务启动状态缺少即时反馈" : signal.key === "SIG-M07" ? "实验空间 初始化状态无法判定" : solutionLed ? "模型服务首次调用门槛高" : signal.unified.title;
      const summary = signal.key === "SIG-M03" ? "用户触发任务后无法确认任务是否已经开始执行。" : signal.key === "SIG-M07" ? "长时间初始化时无法区分仍在启动还是已经失败。" : solutionLed ? "模型服务发布后，用户难以快速获得完整调用参数并完成首次调用。" : signal.unified.content;
      const problem = { id: `problem-${signal.id}`, name, summary, sourceSignalIds: [signal.id], disposition: "generate" as const, confidence: unclear ? .65 : .82 }; add(problem);
      suggestions.push({ id: `suggest-${signal.id}`, kind: unclear ? "unclear" : "independent", signalIds: [signal.id], problemIds: [problem.id], title: unclear ? "需要确认" : "独立问题", reason: unclear ? "反馈主要描述现象，具体触发条件和期望状态仍需确认。" : solutionLed ? "用户提出了 curl 方案，Mock 示例回到首次调用门槛这一真实问题。" : "暂未发现与其他反馈的结构冲突。", confidence: problem.confidence });
    }
    const draftRequirements = problems.map((problem) => draft(problem, problem.id === "problem-immediate-run" ? "支持定时任务立即执行" : problem.id === "problem-sig-m08" ? "提供模型服务快速调用指引" : problem.name, problem.confidence < .7 ? ["该现象在什么条件下稳定复现？", "用户期望看到哪些明确状态？"] : []));
    return { problems, suggestions, draftRequirements } satisfies RefinementPlan;
  }

  async analyzeRequirement({ requirement, signals, reviewNotes }: Parameters<RefinementAnalyzer["analyzeRequirement"]>[0]) {
    const sourceContext = signals.map((signal) => signal.standardized?.problem || signal.unified.content).filter(Boolean);
    return {
      title: requirement.title,
      description: [requirement.summary, reviewNotes.trim() ? `评审补充：${reviewNotes.trim()}` : "", sourceContext.length ? `来源事实：${sourceContext.join("；")}` : ""].filter(Boolean).join("\n\n"),
      rationale: `根据当前 Requirement、${signals.length} 条来源 Signal 与评审备注重新整理；仍更新同一个 Requirement。`,
    };
  }
}

export class MockAIProvider extends MockRefinementAnalyzer implements AIProvider {}
