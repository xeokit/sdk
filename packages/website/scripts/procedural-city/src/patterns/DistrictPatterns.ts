import type {Pattern} from "./Pattern";
import {clamp} from "../geometry/PolygonUtils";

export const DISTRICT_PATTERNS: Pattern[] = [
  {
    id: "district.historic-core",
    name: "Historic Core",
    category: "district",
    stages: ["district", "street", "block", "parcel", "building"],
    tags: ["historic", "fine-grain", "street-wall"],
    applies: (context) => context.district === "Historic Core",
    weight: (context) => clamp(0.65 + (context.landValue ?? 0.5) * 0.22, 0, 1),
    effect: (_context, weight) => ({
      densityBiasDelta: 0.06 * weight,
      heightBiasDelta: -0.18 * weight,
      courtyardProbabilityDelta: 0.12 * weight,
      streetAlignmentDelta: 0.16 * weight,
      imperfectionDelta: 0.12 * weight,
      blockGrammar: weight > 0.78 ? "perimeter-courtyard" : "fine-grain-streetwall",
      growthPhase: "historic-core",
      facadeAge: "historic"
    })
  },
  {
    id: "district.commercial-high-street",
    name: "Commercial High Street",
    category: "district",
    stages: ["street", "block", "parcel", "building"],
    tags: ["retail", "active-frontage", "important-street"],
    applies: (context) => (context.roadHierarchy === "arterial" || context.roadHierarchy === "collector") && (context.roadInfluence ?? 0) > 0.66 && context.district !== "Civic District",
    weight: (context) => clamp((context.roadInfluence ?? 0) * 0.72 + (context.landValue ?? 0) * 0.14, 0, 1),
    effect: (context, weight) => ({
      landValueDelta: 0.07 * weight,
      densityBiasDelta: 0.04 * weight,
      coverageBiasDelta: 0.03 * weight,
      streetAlignmentDelta: 0.12 * weight,
      blockGrammar: context.roadHierarchy === "arterial" && weight > 0.82 ? "commercial-corridor" : undefined,
      useBias: "mixed",
      facadeRhythmDelta: 0.06 * weight
    })
  },
  {
    id: "district.mixed-use-neighbourhood",
    name: "Mixed-Use Neighbourhood",
    category: "district",
    stages: ["district", "block", "building"],
    tags: ["mixed-use", "courtyards", "residential"],
    applies: (context) => context.district === "Mixed Residential",
    weight: (context) => clamp(0.58 + (context.neighborContinuity ?? 0.5) * 0.22, 0, 1),
    effect: (_context, weight) => ({
      courtyardProbabilityDelta: 0.08 * weight,
      heightBiasDelta: 0.04 * weight,
      coverageBiasDelta: 0.06 * weight,
      neighborContinuityDelta: 0.08 * weight,
      blockGrammar: weight > 0.82 ? "perimeter-courtyard" : undefined,
      useBias: "residential"
    })
  },
  {
    id: "district.civic-district",
    name: "Civic District",
    category: "district",
    stages: ["district", "block", "public-space", "building"],
    tags: ["civic", "plaza", "institution"],
    applies: (context) => context.district === "Civic District",
    weight: (context) => clamp(0.62 + (context.landmarkInfluence ?? 0) * 0.24, 0, 1),
    effect: (_context, weight) => ({
      densityBiasDelta: -0.18 * weight,
      setbackBiasDelta: 0.28 * weight,
      streetAlignmentDelta: -0.12 * weight,
      heightBiasDelta: -0.08 * weight,
      blockGrammar: "civic-campus",
      useBias: "civic",
      materialFamily: "stone"
    })
  },
  {
    id: "district.warehouse-edge",
    name: "Warehouse Edge",
    category: "district",
    stages: ["district", "block", "building"],
    tags: ["industrial", "large-parcels", "conversion"],
    applies: (context) => context.growthPhase === "industrial-expansion" && context.district !== "Downtown",
    weight: (context) => clamp(0.38 + (context.roadInfluence ?? 0) * 0.36, 0, 1),
    effect: (_context, weight) => ({
      setbackBiasDelta: 0.08 * weight,
      coverageBiasDelta: 0.12 * weight,
      facadeAge: "industrial",
      materialFamily: "brick",
      useBias: weight > 0.58 ? "mixed" : undefined
    })
  }
];
