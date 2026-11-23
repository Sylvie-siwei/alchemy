import type { ProductObject, RequirementReviewDraft, ReviewChangeCandidate } from "../../domain/model";

export interface ReviewAnalysisInput {
  requirements: ProductObject[];
  drafts: RequirementReviewDraft[];
}

export interface ReviewAnalyzer {
  analyzeReview(input: ReviewAnalysisInput): Promise<{ drafts: RequirementReviewDraft[]; candidates: ReviewChangeCandidate[] }>;
}
