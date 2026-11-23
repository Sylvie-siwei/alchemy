import type { ValidationAnalyzer, ValidationFeedbackCandidate } from "./provider";

export class MockValidationAnalyzer implements ValidationAnalyzer {
  async analyzeValidation(input: { objectTitle: string; record: string; newFeedback: string }): Promise<ValidationFeedbackCandidate[]> {
    const source = input.newFeedback.trim();
    if (!source) return [];
    return source.split(/[。；;\n]/).map((content) => content.trim()).filter((content) => content.length > 3).slice(0, 4).map((content, index): ValidationFeedbackCandidate => ({ id: `validation-candidate-${index}`, title: content.slice(0, 36), content, rationale: `该信息来自「${input.objectTitle}」的交付验证，可能是需要重新进入需求池的独立现实问题。` }));
  }
}
