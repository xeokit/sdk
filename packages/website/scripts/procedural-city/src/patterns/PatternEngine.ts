import type {UrbanPatternApplication} from "../types";
import {clamp, round} from "../geometry/PolygonUtils";
import type {Pattern, PatternApplication, PatternEffect, PatternResult, PatternStage} from "./Pattern";
import type {PatternContext} from "./PatternContext";
import {CITY_PATTERNS} from "./CityPatterns";
import {DISTRICT_PATTERNS} from "./DistrictPatterns";
import {STREET_PATTERNS} from "./StreetPatterns";
import {BLOCK_PATTERNS} from "./BlockPatterns";
import {BUILDING_PATTERNS} from "./BuildingPatterns";

export class PatternEngine {
  constructor(private readonly patterns: Pattern[]) {}

  evaluate(context: PatternContext, stages?: PatternStage[]): PatternResult {
    const applications: PatternApplication[] = [];
    for (const pattern of this.patterns) {
      if (stages && !pattern.stages.some((stage) => stages.includes(stage))) {
        continue;
      }
      if (!pattern.applies(context)) {
        continue;
      }
      const weight = clamp(pattern.weight(context), 0, 1);
      if (weight <= 0.01) {
        continue;
      }
      applications.push({
        pattern,
        weight,
        effect: pattern.effect(context, weight)
      });
    }
    return {
      applications,
      effect: composePatternEffects(applications)
    };
  }
}

export function createDefaultPatternEngine(): PatternEngine {
  return new PatternEngine([
    ...CITY_PATTERNS,
    ...DISTRICT_PATTERNS,
    ...STREET_PATTERNS,
    ...BLOCK_PATTERNS,
    ...BUILDING_PATTERNS
  ]);
}

export function composePatternEffects(applications: PatternApplication[]): PatternEffect {
  const effect: PatternEffect = {};
  for (const application of applications) {
    mergePatternEffect(effect, application.effect);
  }
  return effect;
}

export function toUrbanPatternApplications(applications: PatternApplication[]): UrbanPatternApplication[] {
  return applications.map((application) => ({
    id: application.pattern.id,
    name: application.pattern.name,
    category: application.pattern.category,
    weight: round(application.weight, 3),
    stages: application.pattern.stages,
    tags: application.pattern.tags
  }));
}

export function patternSummary(applications: UrbanPatternApplication[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const application of applications) {
    summary[application.id] = round((summary[application.id] || 0) + application.weight, 3);
  }
  return summary;
}

function mergePatternEffect(target: PatternEffect, source: PatternEffect): void {
  addNumber(target, "landValueDelta", source.landValueDelta);
  addNumber(target, "densityBiasDelta", source.densityBiasDelta);
  addNumber(target, "heightBiasDelta", source.heightBiasDelta);
  addNumber(target, "coverageBiasDelta", source.coverageBiasDelta);
  addNumber(target, "setbackBiasDelta", source.setbackBiasDelta);
  addNumber(target, "courtyardProbabilityDelta", source.courtyardProbabilityDelta);
  addNumber(target, "streetAlignmentDelta", source.streetAlignmentDelta);
  addNumber(target, "imperfectionDelta", source.imperfectionDelta);
  addNumber(target, "neighborContinuityDelta", source.neighborContinuityDelta);
  addNumber(target, "heightMultiplierDelta", source.heightMultiplierDelta);
  addNumber(target, "coverageMultiplierDelta", source.coverageMultiplierDelta);
  addNumber(target, "towerProbabilityDelta", source.towerProbabilityDelta);
  addNumber(target, "setbackTowerProbabilityDelta", source.setbackTowerProbabilityDelta);
  addNumber(target, "facadeRhythmDelta", source.facadeRhythmDelta);
  if (source.treeDensityMultiplier !== undefined) {
    target.treeDensityMultiplier = (target.treeDensityMultiplier ?? 1) * source.treeDensityMultiplier;
  }
  if (source.blockGrammar !== undefined) {
    target.blockGrammar = source.blockGrammar;
  }
  if (source.growthPhase !== undefined) {
    target.growthPhase = source.growthPhase;
  }
  if (source.facadeAge !== undefined) {
    target.facadeAge = source.facadeAge;
  }
  if (source.materialFamily !== undefined) {
    target.materialFamily = source.materialFamily;
  }
  if (source.useBias !== undefined) {
    target.useBias = source.useBias;
  }
}

function addNumber(target: PatternEffect, key: keyof PatternEffect, value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  (target as Record<string, number>)[key] = ((target as Record<string, number>)[key] || 0) + value;
}
