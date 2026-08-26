import type {Pattern} from "./Pattern";
import {clamp} from "../geometry/PolygonUtils";

export const CITY_PATTERNS: Pattern[] = [
  {
    id: "city.strong-centre",
    name: "Strong City Centre",
    category: "city",
    stages: ["city", "block", "building"],
    tags: ["centre", "skyline", "land-value"],
    applies: (context) => (context.downtownInfluence ?? 0) > 0.18 || context.scope === "city",
    weight: (context) => context.scope === "city" ? 0.56 : clamp((context.downtownInfluence ?? 0) * 0.82, 0, 1),
    effect: (_context, weight) => ({
      landValueDelta: 0.08 * weight,
      densityBiasDelta: 0.05 * weight,
      heightBiasDelta: 0.07 * weight,
      towerProbabilityDelta: 0.035 * weight,
      neighborContinuityDelta: 0.08 * weight
    })
  },
  {
    id: "city.green-corridors",
    name: "Green Corridors",
    category: "city",
    stages: ["block", "public-space", "street"],
    tags: ["parks", "walkability", "open-space"],
    applies: (context) => (context.viewCorridorPressure ?? 0) > 0.45 || !!context.hasOpenSpace,
    weight: (context) => clamp(Math.max(context.viewCorridorPressure ?? 0, context.hasOpenSpace ? 0.55 : 0), 0, 1),
    effect: (_context, weight) => ({
      heightBiasDelta: -0.16 * weight,
      setbackBiasDelta: 0.18 * weight,
      treeDensityMultiplier: 1 + 0.36 * weight,
      imperfectionDelta: -0.04 * weight
    })
  },
  {
    id: "city.landmark-hierarchy",
    name: "Landmark Hierarchy",
    category: "city",
    stages: ["block", "building", "public-space"],
    tags: ["landmarks", "vistas", "civic-space"],
    applies: (context) => (context.landmarkInfluence ?? 0) > 0.28 || !!context.hasLandmark,
    weight: (context) => clamp(Math.max(context.landmarkInfluence ?? 0, context.hasLandmark ? 0.9 : 0), 0, 1),
    effect: (_context, weight) => ({
      landValueDelta: 0.1 * weight,
      setbackBiasDelta: 0.16 * weight,
      streetAlignmentDelta: -0.08 * weight,
      heightBiasDelta: -0.08 * weight,
      blockGrammar: weight > 0.72 ? "civic-campus" : undefined
    })
  },
  {
    id: "city.riverfront-development",
    name: "Riverfront Development",
    category: "city",
    stages: ["block", "street", "building", "public-space"],
    tags: ["waterfront", "promenade", "renewal"],
    applies: (context) => !!context.hasWaterways && (context.waterfrontInfluence ?? 0) > 0.24,
    weight: (context) => clamp(context.waterfrontInfluence ?? 0, 0, 1),
    effect: (_context, weight) => ({
      landValueDelta: 0.14 * weight,
      setbackBiasDelta: 0.2 * weight,
      coverageBiasDelta: -0.08 * weight,
      heightBiasDelta: 0.06 * weight,
      streetAlignmentDelta: 0.08 * weight,
      blockGrammar: weight > 0.55 ? "waterfront-edge" : undefined,
      growthPhase: weight > 0.48 ? "waterfront-renewal" : undefined,
      materialFamily: weight > 0.55 ? "glass" : undefined
    })
  },
  {
    id: "city.distributed-parks",
    name: "Distributed Parks",
    category: "city",
    stages: ["block", "public-space"],
    tags: ["parks", "neighbourhood-centres"],
    applies: (context) => !!context.hasOpenSpace || (context.district === "Mixed Residential" && (context.landValue ?? 0) < 0.58),
    weight: (context) => clamp(context.hasOpenSpace ? 0.8 : 0.36 + (1 - (context.landValue ?? 0.5)) * 0.22, 0, 1),
    effect: (_context, weight) => ({
      heightBiasDelta: -0.08 * weight,
      densityBiasDelta: -0.06 * weight,
      treeDensityMultiplier: 1 + 0.22 * weight,
      neighborContinuityDelta: 0.06 * weight
    })
  }
];
