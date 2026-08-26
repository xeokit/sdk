import type {Candidate} from "../Candidate";
import {candidateMetric} from "../Candidate";
import type {EvaluationContext} from "../EvaluationContext";
import type {Evaluator} from "../Score";
import {clampScore} from "../Score";
import type {DistributionProfile} from "../../types";

export class ProfileEvaluator implements Evaluator {
  name = "OSM Profile Fit";
  defaultWeight = 1;

  evaluate(candidate: Candidate, context: EvaluationContext): number {
    const direct = candidateMetric(candidate, "profileFit", NaN);
    if (Number.isFinite(direct)) {
      return clampScore(direct);
    }
    const profile = context.profile || context.config?.profileData;
    if (!profile) {
      return 0.62;
    }
    const scores: number[] = [];
    addDistributionScore(scores, candidate, "roadSegmentLength", profile.roads.segmentLength);
    addDistributionScore(scores, candidate, "roadSpacing", profile.roads.intersectionSpacing || profile.roads.segmentLength);
    addDistributionScore(scores, candidate, "blockArea", profile.blocks.area);
    addDistributionScore(scores, candidate, "blockAspectRatio", profile.blocks.aspectRatio);
    addDistributionScore(scores, candidate, "parcelFrontage", profile.parcels.frontage);
    addDistributionScore(scores, candidate, "parcelArea", profile.parcels.area);
    addDistributionScore(scores, candidate, "buildingCoverage", profile.buildings.coverage || profile.parcels.buildableCoverage);
    addDistributionScore(scores, candidate, "levels", profile.buildings.levels);
    const courtyard = candidateMetric(candidate, "courtyardProbability", NaN);
    if (Number.isFinite(courtyard)) {
      const target = profile.relationships.courtyardProbability ?? profile.blocks.courtyardFrequency ?? 0.32;
      scores.push(close01(courtyard, target, 0.32));
    }
    return scores.length ? average(scores) : 0.62;
  }

  describe(candidate: Candidate, context: EvaluationContext, score: number): string[] {
    return [`Profile fit ${score.toFixed(2)} for ${context.stage}`];
  }
}

function addDistributionScore(scores: number[], candidate: Candidate, key: string, distribution: DistributionProfile | undefined): void {
  const value = candidateMetric(candidate, key, NaN);
  if (!Number.isFinite(value) || !distribution) {
    return;
  }
  const target = distribution.median ?? distribution.mean;
  if (!Number.isFinite(target)) {
    return;
  }
  const low = distribution.p25 ?? distribution.min ?? Number(target) * 0.72;
  const high = distribution.p75 ?? distribution.max ?? Number(target) * 1.28;
  const tolerance = Math.max(Math.abs(Number(high) - Number(low)), Math.abs(Number(target)) * 0.25, 1);
  scores.push(close01(value, Number(target), tolerance));
}

function close01(value: number, target: number, tolerance: number): number {
  return clampScore(1 - Math.abs(value - target) / Math.max(1e-6, tolerance * 1.8));
}

function average(values: number[]): number {
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}
