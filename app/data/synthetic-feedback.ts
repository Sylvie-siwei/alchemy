import type { ProductFeedbackRawData } from "../domain/model";

/** Hand-authored fictional fixtures. No external system contract or customer export. */
export const syntheticFeedback: ProductFeedbackRawData[] = [{
  sourceType: "product_feedback", id: "demo-feedback-001", submitter: "合成用户 01",
  email: "demo01@example.com", feedbackType: "体验建议", title: "合成案例：批量标签的结果摘要",
  content: "在虚构沙盒里为三张实验卡片添加标签后，只能看到完成提示，无法分辨哪张卡片没有更新。希望显示逐项结果。",
  sourceStatus: "示例待处理", createdAt: "2026-08-13T09:00:00.000Z",
}];
