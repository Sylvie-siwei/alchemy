import type { Signal } from "./model";

export type SignalLibraryFilter = "all" | "pending_standardization" | "pending_refinement" | "completed" | "ended";
export type SignalLibraryState = Exclude<SignalLibraryFilter, "all">;

const endedProcessingStatuses = new Set(["已结束", "已拒绝", "已废弃", "合并吸收"]);

export function signalLibraryState(signal: Signal): SignalLibraryState {
  if (endedProcessingStatuses.has(signal.unified.processingStatus)) return "ended";
  if (["pending", "failed"].includes(signal.unified.standardizationStatus)) return "pending_standardization";
  if (signal.unified.refinementStatus === "completed") return "completed";
  return "pending_refinement";
}

export function matchesSignalLibraryFilter(signal: Signal, filter: SignalLibraryFilter) {
  return filter === "all" || signalLibraryState(signal) === filter;
}
