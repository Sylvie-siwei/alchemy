import { MockAIProvider, MockRefinementAnalyzer } from "./mock-refinement-analyzer";
import type { AIProvider, RefinementAnalyzer } from "./provider";
// Intentionally independent of environment variables in the public edition.
export function refinementAnalyzer(): RefinementAnalyzer { return new MockRefinementAnalyzer(); }
export function refinementAIProvider(): AIProvider { return new MockAIProvider(); }
