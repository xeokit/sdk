import type {Candidate} from "../Candidate";
import {candidateMetric} from "../Candidate";
import type {EvaluationContext} from "../EvaluationContext";
import type {Evaluator} from "../Score";
import {clampScore} from "../Score";

export class BlockQualityEvaluator implements Evaluator {
  name = "Block Quality";
  defaultWeight = 1.1;

  evaluate(candidate: Candidate, context: EvaluationContext): number {
    const area = candidateMetric(candidate, "blockArea", Math.abs(context.block?.area || 7600));
    const profileArea = context.profile?.blocks.area?.median ?? context.profile?.blocks.area?.mean ?? context.config?.profileData?.blocks.area?.median ?? 7600;
    const compactness = candidateMetric(candidate, "compactness", 0.68);
    const aspect = candidateMetric(candidate, "blockAspectRatio", 1.8);
    const enclosure = candidateMetric(candidate, "enclosure", 0.62);
    const buildable = candidateMetric(candidate, "buildableShare", 0.72);
    const areaScore = clampScore(1 - Math.abs(area - Number(profileArea)) / Math.max(2000, Number(profileArea) * 1.35));
    const aspectScore = clampScore(1 - Math.max(0, aspect - 4.8) / 6);
    return clampScore(areaScore * 0.28 + compactness * 0.2 + aspectScore * 0.18 + enclosure * 0.2 + buildable * 0.14);
  }

  describe(_candidate: Candidate, _context: EvaluationContext, score: number): string[] {
    return [`Block quality ${score.toFixed(2)}`];
  }
}
