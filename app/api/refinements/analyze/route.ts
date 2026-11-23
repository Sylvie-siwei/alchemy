import type { ProductObject, Signal } from "../../../domain/model";
import { refinementAIProvider, refinementAnalyzer } from "../../../server/refinement-analysis";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { signals?: Signal[]; requirement?: ProductObject; reviewNotes?: string };
    if (body.requirement) {
      const analyzer = refinementAnalyzer();
      return Response.json({ candidate: await analyzer.analyzeRequirement({ requirement: body.requirement, signals: body.signals ?? [], reviewNotes: body.reviewNotes ?? "" }), provider: "mock" });
    }
    if (!body.signals?.length) return Response.json({ error: "请选择待分析 Signal" }, { status: 400 });
    const provider = refinementAIProvider();
    return Response.json({ plan: await provider.analyzeSignals(body.signals), provider: provider.name });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "提炼分析失败" }, { status: 502 });
  }
}
