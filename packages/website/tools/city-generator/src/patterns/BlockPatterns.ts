import type {Pattern} from "./Pattern";
import {clamp} from "../geometry/PolygonUtils";

export const BLOCK_PATTERNS: Pattern[] = [
  {
    id: "block.perimeter-block",
    name: "Perimeter Block",
    category: "block",
    stages: ["block", "parcel", "building"],
    tags: ["street-wall", "courtyard", "urban-block"],
    applies: (context) => context.district !== "Downtown" && context.district !== "Civic District" && (context.blockArea ?? 0) > 1800 && (context.courtyardProbability ?? 0) > 0.3,
    weight: (context) => clamp(0.22 + (context.densityBias ?? 0.7) * 0.12 + (context.streetAlignment ?? 0.6) * 0.12 + (context.courtyardProbability ?? 0.3) * 0.2, 0, 1),
    effect: (_context, weight) => ({
      blockGrammar: weight > 0.76 ? "perimeter-courtyard" : undefined,
      courtyardProbabilityDelta: 0.08 * weight,
      coverageBiasDelta: 0.08 * weight,
      streetAlignmentDelta: 0.14 * weight,
      neighborContinuityDelta: 0.1 * weight
    })
  },
  {
    id: "block.podium-and-tower",
    name: "Podium And Tower",
    category: "block",
    stages: ["block", "parcel", "building"],
    tags: ["downtown", "skyline", "podium"],
    applies: (context) => context.district === "Downtown"
      && (context.blockArea ?? 0) > 4200
      && ((context.landValue ?? 0) > 0.72 || ((context.landValue ?? 0) > 0.64 && (context.roadInfluence ?? 0) > 0.58))
      && blockVariation(context) < clamp(((context.landValue ?? 0) - 0.68) * 0.85 + (context.roadInfluence ?? 0) * 0.16 + ((context.blockArea ?? 0) > 9000 ? 0.08 : 0), 0.06, 0.34),
    weight: (context) => clamp((context.landValue ?? 0) * 0.38 + (context.roadInfluence ?? 0) * 0.22 + (context.downtownInfluence ?? 0) * 0.18, 0, 1),
    effect: (_context, weight) => ({
      blockGrammar: weight > 0.66 ? "tower-podium" : undefined,
      growthPhase: weight > 0.66 ? "contemporary-infill" : undefined,
      heightBiasDelta: 0.08 * weight,
      towerProbabilityDelta: 0.09 * weight,
      coverageBiasDelta: 0.02 * weight,
      facadeAge: weight > 0.66 ? "contemporary" : undefined,
      materialFamily: weight > 0.66 ? "glass" : undefined
    })
  },
  {
    id: "block.civic-campus",
    name: "Civic Campus",
    category: "block",
    stages: ["block", "public-space", "building"],
    tags: ["civic", "setback", "monument"],
    applies: (context) => context.district === "Civic District" || !!context.hasLandmark,
    weight: (context) => clamp(context.hasLandmark ? 0.9 : 0.58 + (context.landmarkInfluence ?? 0) * 0.24, 0, 1),
    effect: (_context, weight) => ({
      blockGrammar: "civic-campus",
      setbackBiasDelta: 0.28 * weight,
      coverageBiasDelta: -0.12 * weight,
      heightBiasDelta: -0.08 * weight,
      streetAlignmentDelta: -0.12 * weight,
      materialFamily: "stone",
      useBias: "civic"
    })
  },
  {
    id: "block.market-square",
    name: "Market Square",
    category: "block",
    stages: ["block", "public-space", "building"],
    tags: ["plaza", "retail-edge", "public-space"],
    applies: (context) => !!context.hasOpenSpace && context.district !== "Downtown",
    weight: (context) => clamp(0.52 + (context.landValue ?? 0.4) * 0.24 + (context.roadInfluence ?? 0.3) * 0.16, 0, 1),
    effect: (_context, weight) => ({
      setbackBiasDelta: 0.12 * weight,
      streetAlignmentDelta: 0.1 * weight,
      useBias: "mixed",
      treeDensityMultiplier: 1 + 0.18 * weight,
      neighborContinuityDelta: 0.08 * weight
    })
  },
  {
    id: "block.terraced-housing",
    name: "Terraced Housing",
    category: "block",
    stages: ["block", "parcel", "building"],
    tags: ["residential", "repetition", "street-wall"],
    applies: (context) => context.district === "Mixed Residential" && context.roadHierarchy === "local" && (context.blockArea ?? 0) < 12000,
    weight: (context) => clamp(0.48 + (context.neighborContinuity ?? 0.5) * 0.28, 0, 1),
    effect: (_context, weight) => ({
      streetAlignmentDelta: 0.12 * weight,
      heightBiasDelta: -0.06 * weight,
      facadeRhythmDelta: -0.08 * weight,
      useBias: "residential",
      neighborContinuityDelta: 0.14 * weight
    })
  },
  {
    id: "block.warehouse-yard",
    name: "Warehouse Yard",
    category: "block",
    stages: ["block", "parcel", "building"],
    tags: ["industrial", "large-footprint", "yard"],
    applies: (context) => context.growthPhase === "industrial-expansion" && (context.blockArea ?? 0) > 12000 && context.district !== "Historic Core",
    weight: (context) => clamp(0.24 + (context.roadInfluence ?? 0.4) * 0.22, 0, 1),
    effect: (_context, weight) => ({
      coverageBiasDelta: 0.035 * weight,
      setbackBiasDelta: 0.08 * weight,
      streetAlignmentDelta: -0.08 * weight,
      facadeAge: "industrial",
      materialFamily: "brick"
    })
  }
];

function blockVariation(context: {block?: {center: [number, number]; area: number}}): number {
  const block = context.block;
  if (!block) {
    return 0.5;
  }
  const value = Math.sin(block.center[0] * 12.9898 + block.center[1] * 78.233 + block.area * 0.00031) * 43758.5453;
  return value - Math.floor(value);
}
