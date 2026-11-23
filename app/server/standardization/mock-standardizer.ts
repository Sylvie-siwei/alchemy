import { validateStandardizedSignal } from "../../domain/signals";
import type { SignalInput } from "../../domain/model";
import type { SignalStandardizer } from "./provider";

export class MockStandardizer implements SignalStandardizer {
  async standardize(input: SignalInput) {
    const content = input.rawContent.trim();
    const firstSentence = content.split(/[。！？!?.\n]/).find(Boolean)?.trim() || content;
    return validateStandardizedSignal({
      title: firstSentence.slice(0, 36),
      problem: content,
      scenario: input.sourceType === "team_discovery" ? "团队成员在工作过程中发现" : "用户在实际使用或交流中反馈",
      module: "待确认",
      confidence: 0.72,
    });
  }
}
