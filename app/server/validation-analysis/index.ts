import { MockValidationAnalyzer } from "./mock-validation-analyzer";
import type { ValidationAnalyzer } from "./provider";
export function validationAnalyzer(): ValidationAnalyzer { return new MockValidationAnalyzer(); }
