import { syntheticFeedback } from "../../../data/synthetic-feedback";
import { mapProductFeedback } from "../../../server/product-feedback-adapter";
import { appendProductFeedback } from "../../../server/signal-store";

// Request bodies, URLs and credentials are never consumed. Fixed synthetic fixtures only.
export async function POST() {
  const results = syntheticFeedback.map(raw => appendProductFeedback(mapProductFeedback(raw)));
  const added = results.filter(result => result.kind === "added");
  return Response.json({ mode: "synthetic", entries: added.map(result => result.entry),
    result: { added: added.length, skipped: results.length - added.length } });
}
