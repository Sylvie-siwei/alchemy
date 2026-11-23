import type { ReviewChangeCandidate } from "../../domain/model";
import type { ReviewAnalysisInput, ReviewAnalyzer } from "./provider";

export class MockReviewAnalyzer implements ReviewAnalyzer {
  async analyzeReview(input: ReviewAnalysisInput): Promise<{ drafts: ReviewAnalysisInput["drafts"]; candidates: ReviewChangeCandidate[] }> {
    const drafts = input.drafts.map((draft) => normalizeDraft(draft));
    const candidates: ReviewChangeCandidate[] = [];
    for (const draft of drafts) {
      const requirement = input.requirements.find((item) => item.id === draft.requirementId);
      if (!requirement || !draft.notes.trim()) continue;
      const notes = draft.notes.trim();
      const mergeTarget = input.requirements.find((item) => item.id !== requirement.id && (notes.includes(item.key) || notes.includes(item.title)));
      if ((notes.includes("合并") || notes.includes("同一个问题")) && mergeTarget) candidates.push({ id: `candidate-merge-${requirement.id}`, kind: "merge", requirementIds: [requirement.id, mergeTarget.id], title: `${requirement.title}整合`, summary: `${requirement.summary}；${mergeTarget.summary}`, rationale: notes });
      if (notes.includes("拆分") || notes.includes("单独处理")) candidates.push({ id: `candidate-split-${requirement.id}`, kind: "split", sourceRequirementId: requirement.id, title: `${requirement.title} · 主问题`, secondTitle: `${requirement.title} · 独立问题`, rationale: notes });
      if (/真正问题|新问题|另外发现|独立需求/.test(notes)) candidates.push({ id: `candidate-signal-${requirement.id}`, kind: "new_signal", sourceRequirementId: requirement.id, title: extractTitle(notes, "评审中新发现的问题"), content: notes, rationale: "会议备注包含与当前 Requirement 不同的独立问题信息。" });
      if (/核心问题|重新理解|需求应|调整为/.test(notes)) candidates.push({ id: `candidate-adjust-${requirement.id}`, kind: "requirement_adjustment", requirementId: requirement.id, title: extractTitle(notes, requirement.title), summary: notes, rationale: "会议讨论改变了对需求核心问题的理解。" });
    }
    return { drafts, candidates };
  }
}

const memberNames = ["产品示例", "研发示例", "管理示例"];

function normalizeDraft<T extends ReviewAnalysisInput["drafts"][number]>(draft: T): T {
  const priority = draft.notes.match(/(?:改|设为|调整为|优先级[:：]?\s*)?(P[0-3])/i)?.[1]?.toUpperCase() as T["priority"] | undefined;
  const owner = memberNames.find((name) => draft.notes.includes(name));
  const result = /暂缓/.test(draft.notes) ? "deferred" : /拒绝|不做/.test(draft.notes) ? "rejected" : /待补充|再确认/.test(draft.notes) ? "needs_info" : /通过/.test(draft.notes) ? "approved" : draft.result;
  return { ...draft, priority: priority ?? draft.priority, owner: owner ?? draft.owner, result };
}

function extractTitle(notes: string, fallback: string) {
  const segment = notes.split(/[。；;\n]/).find((part) => part.trim().length > 4)?.trim();
  return (segment || fallback).replace(/^(研发认为|会议认为|真正问题是|核心问题是)/, "").slice(0, 42);
}
