import { appendSignal, listImportedSignals } from "../../server/signal-store";

export async function GET() {
  return Response.json({ entries: listImportedSignals() });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const created = appendSignal({ input: payload.input, candidate: payload.candidate, actor: payload.actor || "当前用户" });
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "汇入失败" }, { status: 400 });
  }
}
