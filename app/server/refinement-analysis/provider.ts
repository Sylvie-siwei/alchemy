import type { ProductObject, Signal } from "../../domain/model";
import type { RefinementPlan } from "../../domain/refinement";
export interface RequirementRefinementInput {
  requirement: ProductObject;
  signals: Signal[];
  reviewNotes: string;
}

export interface RequirementRefinementCandidate {
  title: string;
  description: string;
  rationale?: string;
}

export interface RefinementAnalyzer {
  analyzeSignals(signals: Signal[]): Promise<RefinementPlan>;
  analyzeRequirement(input: RequirementRefinementInput): Promise<RequirementRefinementCandidate>;
}

export interface AIProvider {
  readonly name: "mock" | "openai";
  analyzeSignals(signals: Signal[]): Promise<RefinementPlan>;
}
