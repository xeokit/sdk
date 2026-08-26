import type {Candidate} from "../Candidate";
import {candidateMetric} from "../Candidate";
import type {EvaluationContext} from "../EvaluationContext";
import type {Evaluator} from "../Score";
import {clampScore} from "../Score";

export class LandmarkEvaluator implements Evaluator {
  name = "Landmark Quality";
  defaultWeight = 0.85;

  evaluate(candidate: Candidate, context: EvaluationContext): number {
    if (context.stage !== "landmark-placement" && context.stage !== "park-placement") {
      return 0.58;
    }
    const visibility = candidateMetric(candidate, "visibility", 0.62);
    const accessibility = candidateMetric(candidate, "accessibility", 0.64);
    const publicSpace = candidateMetric(candidate, "publicSpaceRelationship", context.stage === "park-placement" ? 0.82 : 0.56);
    const roadRelation = candidateMetric(candidate, "roadRelation", 0.6);
    const centrality = candidateMetric(candidate, "centrality", 0.58);
    return clampScore(visibility * 0.24 + accessibility * 0.24 + publicSpace * 0.22 + roadRelation * 0.16 + centrality * 0.14);
  }

  describe(_candidate: Candidate, context: EvaluationContext, score: number): string[] {
    return [`${context.stage === "park-placement" ? "Open space" : "Landmark"} quality ${score.toFixed(2)}`];
  }
}
