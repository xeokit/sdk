import type {Candidate} from "../Candidate";
import {candidateMetric} from "../Candidate";
import type {EvaluationContext} from "../EvaluationContext";
import type {Evaluator} from "../Score";
import {clampScore} from "../Score";

export class VarietyEvaluator implements Evaluator {
  name = "Variety";
  defaultWeight = 0.7;

  evaluate(candidate: Candidate, _context: EvaluationContext): number {
    const variety = candidateMetric(candidate, "variety", 0.58);
    const repetition = candidateMetric(candidate, "repetitionPenalty", 0);
    const randomness = candidateMetric(candidate, "randomnessPenalty", 0);
    const monotony = candidateMetric(candidate, "monotonyPenalty", 0);
    return clampScore(variety - repetition * 0.32 - randomness * 0.22 - monotony * 0.28);
  }

  describe(_candidate: Candidate, _context: EvaluationContext, score: number): string[] {
    return [`Variety ${score.toFixed(2)}`];
  }
}
