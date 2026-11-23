import type { ProductFeedbackRawData, UnifiedSignalFields } from "../domain/model";

export interface ImportedProductFeedback {
  rawData: ProductFeedbackRawData;
  unified: UnifiedSignalFields;
}

export function mapProductFeedback(rawData: ProductFeedbackRawData): ImportedProductFeedback {
  const attachments = rawData.screenshot ? [rawData.screenshot] : [];
  return {
    rawData,
    unified: {
      sourceType: "product_feedback", sourceId: rawData.id, title: rawData.title, content: rawData.content, submitter: rawData.submitter,
      createdAt: rawData.createdAt, attachments, channel: "产品内反馈", priority: null, owner: null, processingStatus: "待提炼", standardizationStatus: "not_required",
      refinementStatus: "pending_refinement", linkedRequirementIds: [], updatedAt: rawData.createdAt,
    },
  };
}

export interface ProductFeedbackAdapter {
  import(): Promise<ImportedProductFeedback[]>;
}

