import type {Candidate} from "../Candidate";
import {candidateMetric} from "../Candidate";
import type {EvaluationContext} from "../EvaluationContext";
import type {Evaluator} from "../Score";
import {clampScore} from "../Score";

export class SkylineEvaluator implements Evaluator {
  name = "Skyline";
  defaultWeight = 0.85;

  evaluate(candidate: Candidate, context: EvaluationContext): number {
    const levels = candidateMetric(candidate, "levels", 6);
    const downtownFit = candidateMetric(candidate, "downtownFit", context.district === "Downtown" ? 0.8 : 0.45);
    const transition = candidateMetric(candidate, "heightTransition", 0.68);
    const rhythm = candidateMetric(candidate, "skylineRhythm", 0.58);
    const landmarkProminence = candidateMetric(candidate, "landmarkProminence", context.stage === "landmark-placement" ? 0.76 : 0.52);
    const isolatedTowerPenalty = candidateMetric(candidate, "isolatedTowerPenalty", 0);
    const flatnessPenalty = levels < 4 ? 0.12 : 0;
    return clampScore(downtownFit * 0.24 + transition * 0.26 + rhythm * 0.22 + landmarkProminence * 0.14 + heightBandScore(levels, context) * 0.14 - isolatedTowerPenalty * 0.34 - flatnessPenalty);
  }

  describe(_candidate: Candidate, _context: EvaluationContext, score: number): string[] {
    return [`Skyline score ${score.toFixed(2)}`];
  }
}

function heightBandScore(levels: number, context: EvaluationContext): number {
  if (context.district === "Downtown") {
    return levels >= 10 && levels <= 34 ? 0.86 : levels > 34 ? 0.66 : 0.52;
  }
  if (context.district === "Historic Core") {
    return levels >= 3 && levels <= 8 ? 0.88 : 0.46;
  }
  if (context.district === "Civic District") {
    return levels >= 2 && levels <= 14 ? 0.8 : 0.52;
  }
  return levels >= 4 && levels <= 14 ? 0.82 : 0.58;
}
