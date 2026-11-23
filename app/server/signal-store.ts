import { createSignal, type CreateSignalCommand, type CreatedSignal } from "../domain/signals";
import type { ImportedProductFeedback } from "./product-feedback-adapter";

const entries: CreatedSignal[] = [];
let nextSequence = 100;

export function listImportedSignals() {
  return [...entries].reverse();
}

export function appendSignal(command: CreateSignalCommand) {
  const sequence = nextSequence++;
  const now = new Date().toISOString();
  const created = createSignal(command, {
    id: `sig-${sequence}`,
    key: `SIG-${String(sequence).padStart(3, "0")}`,
    now,
  });
  entries.push(created);
  return created;
}

export function appendProductFeedback(imported: ImportedProductFeedback, actor = "合成反馈") {
  const existing = entries.find((entry) => entry.signal.unified.sourceType === "product_feedback" && entry.signal.unified.sourceId === imported.rawData.id);
  if (existing) {
    const inferredOwner = existing.signal.owner === "合成反馈" || existing.signal.owner === "待分配";
    existing.signal = { ...existing.signal, priority: existing.signal.priority ?? null, owner: inferredOwner ? null : existing.signal.owner, unified: { ...existing.signal.unified, attachments: imported.unified.attachments, priority: existing.signal.unified.priority ?? null, owner: inferredOwner ? null : existing.signal.unified.owner } };
    return { kind: "existing" as const, entry: existing };
  }
  const created = appendSignal({ input: { sourceType: "product_feedback", title: imported.rawData.title, submitter: imported.rawData.submitter, rawContent: imported.rawData.content, attachments: imported.unified.attachments, collectedAt: imported.rawData.createdAt }, actor });
  created.signal = { ...created.signal, priority: imported.unified.priority, owner: imported.unified.owner, rawData: imported.rawData, unified: { ...imported.unified, updatedAt: created.signal.updatedAt } };
  return { kind: "added" as const, entry: created };
}
