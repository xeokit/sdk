import type {Pattern} from "./Pattern";
import {clamp} from "../geometry/PolygonUtils";

export const BUILDING_PATTERNS: Pattern[] = [
  {
    id: "building.continuous-street-wall",
    name: "Continuous Street Wall",
    category: "building",
    stages: ["parcel", "building"],
    tags: ["street-wall", "frontage", "enclosure"],
    applies: (context) => (context.streetAlignment ?? 0) > 0.62 && context.blockGrammar !== "civic-campus",
    weight: (context) => clamp((context.streetAlignment ?? 0) * 0.72 + (context.neighborContinuity ?? 0.5) * 0.2, 0, 1),
    effect: (_context, weight) => ({
      coverageMultiplierDelta: 0.03 * weight,
      streetAlignmentDelta: 0.1 * weight,
      setbackBiasDelta: -0.035 * weight,
      facadeRhythmDelta: -0.04 * weight
    })
  },
  {
    id: "building.active-frontage",
    name: "Active Frontage",
    category: "building",
    stages: ["parcel", "building"],
    tags: ["retail", "ground-floor", "street-life"],
    applies: (context) => ((context.roadHierarchy === "arterial" || context.roadHierarchy === "collector") && (context.landValue ?? 0) > 0.48) || context.blockGrammar === "commercial-corridor",
    weight: (context) => clamp((context.landValue ?? 0.4) * 0.42 + (context.roadInfluence ?? 0.4) * 0.46, 0, 1),
    effect: (_context, weight) => ({
      useBias: "mixed",
      streetAlignmentDelta: 0.08 * weight,
      coverageMultiplierDelta: 0.025 * weight,
      facadeRhythmDelta: 0.08 * weight
    })
  },
  {
    id: "building.landmark-entrance",
    name: "Landmark Entrance",
    category: "building",
    stages: ["building", "public-space"],
    tags: ["entrance", "vista", "civic"],
    applies: (context) => (context.landmarkInfluence ?? 0) > 0.58 || (context.viewCorridorPressure ?? 0) > 0.7,
    weight: (context) => clamp(Math.max(context.landmarkInfluence ?? 0, context.viewCorridorPressure ?? 0), 0, 1),
    effect: (_context, weight) => ({
      setbackBiasDelta: 0.12 * weight,
      heightMultiplierDelta: -0.12 * weight,
      facadeRhythmDelta: 0.08 * weight,
      materialFamily: weight > 0.72 ? "stone" : undefined
    })
  },
  {
    id: "building.courtyard-entrance",
    name: "Courtyard Entrance",
    category: "building",
    stages: ["parcel", "building"],
    tags: ["courtyard", "threshold", "perimeter-block"],
    applies: (context) => context.blockGrammar === "perimeter-courtyard" || (context.courtyardProbability ?? 0) > 0.48,
    weight: (context) => clamp(0.42 + (context.courtyardProbability ?? 0.3) * 0.42, 0, 1),
    effect: (_context, weight) => ({
      courtyardProbabilityDelta: 0.14 * weight,
      streetAlignmentDelta: 0.06 * weight,
      coverageMultiplierDelta: -0.015 * weight
    })
  },
  {
    id: "building.residential-frontage",
    name: "Residential Frontage",
    category: "building",
    stages: ["parcel", "building"],
    tags: ["residential", "balconies", "quieter-street"],
    applies: (context) => context.district === "Mixed Residential" && context.roadHierarchy === "local",
    weight: (context) => clamp(0.5 + (1 - (context.landValue ?? 0.5)) * 0.2, 0, 1),
    effect: (_context, weight) => ({
      useBias: "residential",
      heightMultiplierDelta: -0.06 * weight,
      setbackBiasDelta: 0.08 * weight,
      facadeRhythmDelta: -0.08 * weight
    })
  }
];
