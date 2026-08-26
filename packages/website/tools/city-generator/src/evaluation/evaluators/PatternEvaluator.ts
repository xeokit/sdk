import type {Candidate} from "../Candidate";
import {candidateMetric} from "../Candidate";
import type {EvaluationContext} from "../EvaluationContext";
import type {Evaluator} from "../Score";
import {clampScore} from "../Score";

export class PatternEvaluator implements Evaluator {
  name = "Pattern Fit";
  defaultWeight = 1.2;

  evaluate(candidate: Candidate, context: EvaluationContext): number {
    const direct = candidateMetric(candidate, "patternFit", NaN);
    if (Number.isFinite(direct)) {
      return clampScore(direct);
    }
    const tags = new Set(candidate.tags || []);
    let score = 0.58;
    if (context.district === "Historic Core" && (tags.has("courtyard") || tags.has("fine-grain") || tags.has("street-wall"))) {
      score += 0.18;
    }
    if (context.district === "Downtown" && (tags.has("skyline") || tags.has("mixed-use") || tags.has("podium"))) {
      score += 0.16;
    }
    if (context.district === "Mixed Residential" && (tags.has("courtyard") || tags.has("residential") || tags.has("street-wall"))) {
      score += 0.14;
    }
    if (context.district === "Civic District" && (tags.has("public-space") || tags.has("landmark") || tags.has("campus"))) {
      score += 0.18;
    }
    return clampScore(score);
  }

  describe(candidate: Candidate, _context: EvaluationContext, score: number): string[] {
    const tagText = candidate.tags?.length ? ` (${candidate.tags.slice(0, 3).join(", ")})` : "";
    return [`Pattern fit ${score.toFixed(2)}${tagText}`];
  }
}
