import { reviewAnalyzer } from "../../../server/review-analysis";
import type { ProductObject, RequirementReviewDraft } from "../../../domain/model";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { requirements?: ProductObject[]; drafts?: RequirementReviewDraft[] };
    if (!Array.isArray(body.requirements) || !Array.isArray(body.drafts)) return Response.json({ error: "评审输入无效" }, { status: 400 });
    const result = await reviewAnalyzer().analyzeReview({ requirements: body.requirements, drafts: body.drafts });
    return Response.json({ ...result, provider: "mock" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "评审整理失败" }, { status: 400 });
  }
}
