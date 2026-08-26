import type {Pattern} from "./Pattern";
import {clamp} from "../geometry/PolygonUtils";

export const STREET_PATTERNS: Pattern[] = [
  {
    id: "street.boulevard",
    name: "Boulevard",
    category: "street",
    stages: ["street", "block", "building"],
    tags: ["arterial", "trees", "formal-frontage"],
    applies: (context) => context.roadHierarchy === "arterial" && (context.roadInfluence ?? 0) > 0.55,
    weight: (context) => clamp(context.roadInfluence ?? 0, 0, 1),
    effect: (_context, weight) => ({
      landValueDelta: 0.05 * weight,
      heightBiasDelta: 0.035 * weight,
      streetAlignmentDelta: 0.12 * weight,
      treeDensityMultiplier: 1 + 0.24 * weight,
      useBias: weight > 0.62 ? "mixed" : undefined
    })
  },
  {
    id: "street.shopping-street",
    name: "Shopping Street",
    category: "street",
    stages: ["street", "parcel", "building"],
    tags: ["retail", "active-frontage", "footfall"],
    applies: (context) => (context.roadHierarchy === "arterial" || context.roadHierarchy === "collector") && (context.landValue ?? 0) > 0.5 && context.district !== "Civic District",
    weight: (context) => clamp((context.landValue ?? 0) * 0.52 + (context.roadInfluence ?? 0) * 0.38, 0, 1),
    effect: (_context, weight) => ({
      coverageBiasDelta: 0.035 * weight,
      streetAlignmentDelta: 0.16 * weight,
      setbackBiasDelta: -0.035 * weight,
      facadeRhythmDelta: 0.08 * weight,
      useBias: "mixed"
    })
  },
  {
    id: "street.residential-street",
    name: "Residential Street",
    category: "street",
    stages: ["street", "block", "building"],
    tags: ["quiet", "setbacks", "domestic"],
    applies: (context) => context.roadHierarchy === "local" && context.district === "Mixed Residential",
    weight: (context) => clamp(0.56 + (1 - (context.roadInfluence ?? 0.4)) * 0.22, 0, 1),
    effect: (_context, weight) => ({
      heightBiasDelta: -0.08 * weight,
      setbackBiasDelta: 0.12 * weight,
      treeDensityMultiplier: 1 + 0.18 * weight,
      useBias: "residential",
      facadeRhythmDelta: -0.04 * weight
    })
  },
  {
    id: "street.pedestrian-lane",
    name: "Pedestrian Lane",
    category: "street",
    stages: ["street", "block", "building"],
    tags: ["pedestrian", "fine-grain", "intimate"],
    applies: (context) => context.roadHierarchy === "pedestrian" || context.roadHierarchy === "alley",
    weight: (context) => context.roadHierarchy === "pedestrian" ? 0.82 : 0.52,
    effect: (_context, weight) => ({
      heightBiasDelta: -0.12 * weight,
      setbackBiasDelta: -0.1 * weight,
      coverageBiasDelta: 0.03 * weight,
      streetAlignmentDelta: 0.16 * weight,
      blockGrammar: "fine-grain-streetwall",
      useBias: weight > 0.7 ? "mixed" : undefined
    })
  },
  {
    id: "street.market-street",
    name: "Market Street",
    category: "street",
    stages: ["street", "public-space", "building"],
    tags: ["market", "plaza-edge", "retail"],
    applies: (context) => (context.hasOpenSpace || (context.viewCorridorPressure ?? 0) > 0.62) && (context.roadInfluence ?? 0) > 0.35,
    weight: (context) => clamp(Math.max(context.viewCorridorPressure ?? 0, context.hasOpenSpace ? 0.62 : 0) * 0.8, 0, 1),
    effect: (_context, weight) => ({
      setbackBiasDelta: 0.08 * weight,
      streetAlignmentDelta: 0.08 * weight,
      useBias: "mixed",
      treeDensityMultiplier: 1 + 0.16 * weight
    })
  },
  {
    id: "street.waterfront-promenade",
    name: "Waterfront Promenade",
    category: "street",
    stages: ["street", "block", "public-space", "building"],
    tags: ["waterfront", "promenade", "views"],
    applies: (context) => (context.waterfrontInfluence ?? 0) > 0.38,
    weight: (context) => clamp(context.waterfrontInfluence ?? 0, 0, 1),
    effect: (_context, weight) => ({
      setbackBiasDelta: 0.22 * weight,
      heightBiasDelta: -0.04 * weight,
      coverageBiasDelta: -0.08 * weight,
      streetAlignmentDelta: 0.1 * weight,
      treeDensityMultiplier: 1 + 0.2 * weight,
      growthPhase: weight > 0.5 ? "waterfront-renewal" : undefined
    })
  }
];
