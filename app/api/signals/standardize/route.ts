import { standardizeSignal } from "../../../server/standardization";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    return Response.json({ candidate: await standardizeSignal(payload.input) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI 整理失败" }, { status: 400 });
  }
}
