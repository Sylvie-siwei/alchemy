import { validateSignalInput } from "../../domain/signals";
import type { SignalInput, StandardizedSignal } from "../../domain/model";
import { MockStandardizer } from "./mock-standardizer";
export async function standardizeSignal(input: SignalInput): Promise<StandardizedSignal> {
  const validated = validateSignalInput(input);
  if (validated.sourceType === "product_feedback") throw new Error("产品反馈已经结构化，无需调用 Standardizer");
  return new MockStandardizer().standardize(validated);
}
