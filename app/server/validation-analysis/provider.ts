export interface ValidationFeedbackCandidate { id: string; title: string; content: string; rationale: string }
export interface ValidationAnalyzer { analyzeValidation(input: { objectTitle: string; record: string; newFeedback: string }): Promise<ValidationFeedbackCandidate[]> }
