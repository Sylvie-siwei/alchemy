import { evolution, lineage, objects, projections } from "../../../data/mock";
import { composeDailyBrief, generateDailyBriefData } from "../../../domain/daily-brief";

export async function GET() {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return Response.json({ mode: "synthetic_snapshot", brief: composeDailyBrief(generateDailyBriefData({ objects, projections, events: evolution, lineage, date })), records: [] });
}
export async function POST() {
  return Response.json({ code: "disabled_in_public_demo", error: "公开演示版仅支持简报预览，不发送外部消息。" }, { status: 403 });
}
