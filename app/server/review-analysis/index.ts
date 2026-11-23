import { MockReviewAnalyzer } from "./mock-review-analyzer";
import type { ReviewAnalyzer } from "./provider";

export function reviewAnalyzer(): ReviewAnalyzer {
  // V1 只有一个集中选择入口；未来可在这里按服务端配置替换 Provider。
  return new MockReviewAnalyzer();
}
