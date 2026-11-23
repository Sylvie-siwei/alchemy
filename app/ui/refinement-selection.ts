import type { Signal } from "../domain/model";

export function eligibleRefinementSignals(signals: Signal[]): Signal[] {
  return signals.filter((signal) => !["pending", "failed"].includes(signal.unified.standardizationStatus) && signal.unified.refinementStatus !== "completed");
}

export function normalizeRefinementSelection(selectedIds: string[], signals: Signal[]): string[] {
  const eligibleIds = new Set(eligibleRefinementSignals(signals).map((signal) => signal.id));
  return [...new Set(selectedIds)].filter((id) => eligibleIds.has(id));
}

export function toggleRefinementSelection(selectedIds: string[], signalId: string): string[] {
  return selectedIds.includes(signalId) ? selectedIds.filter((id) => id !== signalId) : [...selectedIds, signalId];
}

export function toggleVisibleRefinementSelection(selectedIds: string[], visibleSignals: Signal[]): string[] {
  const visibleIds = eligibleRefinementSignals(visibleSignals).map((signal) => signal.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  return allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleIds])];
}
