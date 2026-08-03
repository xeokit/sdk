import type {BlockGrammar, BuildingUrbanContext, GrowthPhase, UrbanPatternCategory} from "../types";
import type {PatternContext} from "./PatternContext";

export type PatternStage = "city" | "district" | "street" | "block" | "parcel" | "building" | "public-space";

export interface PatternEffect {
  landValueDelta?: number;
  densityBiasDelta?: number;
  heightBiasDelta?: number;
  coverageBiasDelta?: number;
  setbackBiasDelta?: number;
  courtyardProbabilityDelta?: number;
  streetAlignmentDelta?: number;
  imperfectionDelta?: number;
  neighborContinuityDelta?: number;
  treeDensityMultiplier?: number;
  blockGrammar?: BlockGrammar;
  growthPhase?: GrowthPhase;
  heightMultiplierDelta?: number;
  coverageMultiplierDelta?: number;
  towerProbabilityDelta?: number;
  setbackTowerProbabilityDelta?: number;
  facadeRhythmDelta?: number;
  facadeAge?: BuildingUrbanContext["facadeAge"];
  materialFamily?: string;
  useBias?: BuildingUrbanContext["useBias"];
}

export interface Pattern {
  id: string;
  name: string;
  category: UrbanPatternCategory;
  stages: PatternStage[];
  tags: string[];
  applies: (context: PatternContext) => boolean;
  weight: (context: PatternContext) => number;
  effect: (context: PatternContext, weight: number) => PatternEffect;
}

export interface PatternApplication {
  pattern: Pattern;
  weight: number;
  effect: PatternEffect;
}

export interface PatternResult {
  applications: PatternApplication[];
  effect: PatternEffect;
}
