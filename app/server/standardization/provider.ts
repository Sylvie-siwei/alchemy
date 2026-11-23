import type { SignalInput, StandardizedSignal } from "../../domain/model";

export interface SignalStandardizer {
  standardize(input: SignalInput): Promise<StandardizedSignal>;
}

export const standardizedSignalSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    problem: { type: "string" },
    scenario: { type: "string" },
    module: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["title", "problem", "scenario", "module", "confidence"],
} as const;

export function parseProviderCandidate(value: unknown): StandardizedSignal {
  if (!value || typeof value !== "object") throw new Error("标准化服务返回格式无效");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.title !== "string" || typeof candidate.problem !== "string") throw new Error("标准化服务缺少标题或问题描述");
  if (candidate.scenario !== undefined && typeof candidate.scenario !== "string") throw new Error("使用场景格式无效");
  if (candidate.module !== undefined && typeof candidate.module !== "string") throw new Error("相关模块格式无效");
  if (candidate.confidence !== undefined && typeof candidate.confidence !== "number") throw new Error("置信度格式无效");
  return candidate as unknown as StandardizedSignal;
}
