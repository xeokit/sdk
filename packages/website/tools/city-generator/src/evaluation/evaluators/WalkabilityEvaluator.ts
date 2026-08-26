import type {Candidate} from "../Candidate";
import {candidateMetric} from "../Candidate";
import type {EvaluationContext} from "../EvaluationContext";
import type {Evaluator} from "../Score";
import {clampScore} from "../Score";

export class WalkabilityEvaluator implements Evaluator {
  name = "Walkability";
  defaultWeight = 1.15;

  evaluate(candidate: Candidate, context: EvaluationContext): number {
    const connectivity = candidateMetric(candidate, "connectivity", context.roads?.length ? 0.72 : 0.62);
    const activeFrontage = candidateMetric(candidate, "activeFrontage", 0.58);
    const parkAccess = candidateMetric(candidate, "parkAccess", context.stage === "park-placement" ? 0.82 : 0.56);
    const streetEdge = candidateMetric(candidate, "streetEdgeContinuity", 0.58);
    const walkBlock = candidateMetric(candidate, "walkableBlockSize", 0.6);
    const penalty = candidateMetric(candidate, "disconnectedPenalty", 0)
      + candidateMetric(candidate, "blankEdgePenalty", 0)
      + candidateMetric(candidate, "oversizedIntersectionPenalty", 0);
    return clampScore((connectivity * 0.25 + activeFrontage * 0.2 + parkAccess * 0.16 + streetEdge * 0.22 + walkBlock * 0.17) - penalty * 0.24);
  }

  describe(_candidate: Candidate, context: EvaluationContext, score: number): string[] {
    return [`Walkability ${score.toFixed(2)} on ${context.stage}`];
  }
}
