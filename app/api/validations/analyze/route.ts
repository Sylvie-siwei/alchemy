import { validationAnalyzer } from "../../../server/validation-analysis";
export async function POST(request: Request) {
  try {
    const input = await request.json() as { objectTitle?: string; record?: string; newFeedback?: string };
    if (!input.objectTitle || typeof input.record !== "string" || typeof input.newFeedback !== "string") return Response.json({ error: "验证输入无效" }, { status: 400 });
    return Response.json({ candidates: await validationAnalyzer().analyzeValidation({ objectTitle: input.objectTitle, record: input.record, newFeedback: input.newFeedback }), provider: "mock" });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "验证整理失败" }, { status: 400 }); }
}
