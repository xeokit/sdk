import type {
  Block,
  BlockGrammar,
  BlockUrbanContext,
  BuildingUrbanContext,
  CityGeneratorConfig,
  CityUrbanContext,
  DistrictName,
  DistrictUrbanContext,
  GrowthPhase,
  Parcel,
  ParcelUrbanContext,
  RandomStreams,
  Road,
  RoadHierarchy,
  RoadNetwork,
  UrbanPatternApplication,
  Vec2
} from "../types";
import {clamp, distance, distanceToPolyline, distanceToSegment, round} from "../geometry/PolygonUtils";
import {distributionValue, profileNumber} from "../profiles/ProfileResolver";
import {downtownFactor, landmarkAnchors} from "./Zoning";
import {distanceToWaterway} from "./WaterwayGenerator";
import {createDefaultPatternEngine, patternSummary, toUrbanPatternApplications} from "../patterns/PatternEngine";
import type {PatternContext} from "../patterns/PatternContext";

const ROAD_INFLUENCE: Record<RoadHierarchy, number> = {
  arterial: 1,
  collector: 0.72,
  local: 0.44,
  alley: 0.18,
  pedestrian: 0.36
};

const PATTERN_ENGINE = createDefaultPatternEngine();

export function createUrbanContext(config: CityGeneratorConfig, network: RoadNetwork, blocks: Block[], streams: RandomStreams): CityUrbanContext {
  const cityPatternResult = PATTERN_ENGINE.evaluate(createCityPatternContext(config, network), ["city"]);
  const cityPatterns = toUrbanPatternApplications(cityPatternResult.applications);
  const districtContexts = createDistrictContexts(config, cityPatterns);
  const viewCorridors = createViewCorridors(config, network);
  const context: CityUrbanContext = {
    schema: "xeokit-procedural-city-urban-context/1.0",
    profileName: config.profileData?.name || "central-european",
    growthPhases: ["historic-core", "industrial-expansion", "postwar-rebuild", "contemporary-infill", "waterfront-renewal"],
    districtContexts,
    blockContexts: {},
    parcelContexts: {},
    buildingContexts: {},
    viewCorridors,
    patternSummary: patternSummary(cityPatterns),
    cityPatterns
  };

  for (const block of blocks) {
    context.blockContexts[block.id] = createBlockContext(block, config, network, districtContexts[block.district], viewCorridors, streams);
  }
  applyNeighborContinuity(blocks, context, config.size);
  return context;
}

export function applyUrbanContextToBlocks(blocks: Block[], context: CityUrbanContext): void {
  for (const block of blocks) {
    const blockContext = context.blockContexts[block.id];
    if (!blockContext) {
      continue;
    }
    if (!block.openSpace && !block.landmark) {
      block.pattern = patternFromGrammar(blockContext.grammar);
    }
    Object.assign(block.metadata, blockContextMetadata(blockContext));
    block.metadata.pattern = block.openSpace || block.landmark || block.pattern;
  }

  const corridorPlazas = blocks
    .filter((block) => {
      const blockContext = context.blockContexts[block.id];
      return !!blockContext
        && !block.openSpace
        && !block.landmark
        && block.area > 1800
        && block.area < 16000
        && blockContext.viewCorridorPressure > 0.72
        && blockContext.landValue > 0.42;
    })
    .sort((a, b) => {
      const ac = context.blockContexts[a.id];
      const bc = context.blockContexts[b.id];
      return (bc.viewCorridorPressure * bc.landValue) - (ac.viewCorridorPressure * ac.landValue);
    })
    .slice(0, Math.min(3, Math.max(1, context.viewCorridors.length)));

  for (const block of corridorPlazas) {
    block.openSpace = "plaza";
    block.metadata.openSpace = "plaza";
    block.metadata.pattern = "plaza";
    block.metadata.reservationReason = "view-corridor";
  }
}

export function createParcelContext(parcel: Parcel, blockContext: BlockUrbanContext, config: CityGeneratorConfig, streams: RandomStreams): ParcelUrbanContext {
  const profile = config.profileData;
  const expectedArea = distributionValue(profile?.parcels.area, 360);
  const parcelScale = clamp(Math.sqrt(parcel.area / Math.max(1, expectedArea)), 0.72, 1.28);
  const localNoise = (streams.parcels() - 0.5) * blockContext.imperfection * 0.18;
  const roadBoost = ROAD_INFLUENCE[parcel.frontageHierarchy] * 0.06;
  const baseLandValue = clamp(blockContext.landValue + roadBoost + localNoise, 0.02, 1);
  const patternResult = PATTERN_ENGINE.evaluate(createParcelPatternContext(config, parcel, blockContext, {
    landValue: baseLandValue,
    densityBias: blockContext.densityBias,
    heightBias: blockContext.heightBias,
    coverageBias: blockContext.coverageBias,
    setbackBias: blockContext.setbackBias,
    streetAlignment: blockContext.streetAlignment,
    imperfection: blockContext.imperfection
  }), ["street", "block", "parcel", "building"]);
  const effect = patternResult.effect;
  const patterns = mergePatternApplications(blockContext.patterns, toUrbanPatternApplications(patternResult.applications));
  return {
    parcelId: parcel.id,
    blockId: parcel.blockId,
    grammar: effect.blockGrammar ?? blockContext.grammar,
    growthPhase: effect.growthPhase ?? blockContext.growthPhase,
    landValue: round(clamp(baseLandValue + (effect.landValueDelta || 0), 0.02, 1), 3),
    densityBias: round(clamp(blockContext.densityBias * (0.92 + parcelScale * 0.12) + (effect.densityBiasDelta || 0), 0.2, 1.45), 3),
    heightBias: round(clamp(blockContext.heightBias * (0.86 + parcelScale * 0.18) + (effect.heightBiasDelta || 0), 0.18, 1.85), 3),
    coverageBias: round(clamp(blockContext.coverageBias * (0.9 + parcelScale * 0.1) + (effect.coverageBiasDelta || 0), 0.35, 1.35), 3),
    setbackBias: round(clamp(blockContext.setbackBias + (1 - parcelScale) * 0.12 + (effect.setbackBiasDelta || 0), 0.25, 1.8), 3),
    courtyardProbability: round(clamp(blockContext.courtyardProbability + (effect.courtyardProbabilityDelta || 0), 0.02, 0.88), 3),
    streetAlignment: round(clamp(blockContext.streetAlignment + roadBoost - blockContext.imperfection * 0.08 + (effect.streetAlignmentDelta || 0), 0.18, 0.98), 3),
    roadInfluence: blockContext.roadInfluence,
    roadHierarchy: parcel.frontageHierarchy,
    landmarkInfluence: blockContext.landmarkInfluence,
    waterfrontInfluence: blockContext.waterfrontInfluence,
    viewCorridorPressure: blockContext.viewCorridorPressure,
    imperfection: round(clamp(blockContext.imperfection * (1.08 - parcelScale * 0.08) + (effect.imperfectionDelta || 0), 0.03, 0.72), 3),
    neighborContinuity: round(clamp(blockContext.neighborContinuity + (effect.neighborContinuityDelta || 0), 0.05, 1), 3),
    patterns
  };
}

export function createBuildingContext(parcel: Parcel, parcelContext: ParcelUrbanContext, config: CityGeneratorConfig, streams: RandomStreams): BuildingUrbanContext {
  const patternResult = PATTERN_ENGINE.evaluate(createBuildingPatternContext(config, parcel, parcelContext), ["street", "block", "building"]);
  const effect = patternResult.effect;
  const patterns = mergePatternApplications(parcelContext.patterns, toUrbanPatternApplications(patternResult.applications));
  const facadeAge = effect.facadeAge ?? facadeAgeFor(parcelContext.growthPhase);
  const materialFamily = effect.materialFamily ?? materialFamilyFor(parcel.district, parcelContext.growthPhase, streams);
  const useBias = effect.useBias ?? useBiasFor(parcel.district, parcelContext);
  const profileTowerBias = distributionValue(config.profileData?.buildings.levels, 7, "p95") > 18 ? 0.04 : 0;
  const protectedHeight = 1 - parcelContext.viewCorridorPressure * 0.48;
  const heightMultiplier = clamp(
    (0.72 + parcelContext.heightBias * 0.14 + parcelContext.landValue * 0.06 + ROAD_INFLUENCE[parcelContext.roadHierarchy] * 0.04 + (effect.heightMultiplierDelta || 0)) * protectedHeight,
    0.45,
    1.45
  );
  const coverageMultiplier = clamp(
    0.72 + parcelContext.coverageBias * 0.16 + parcelContext.landValue * 0.05 - parcelContext.imperfection * 0.1 - parcelContext.viewCorridorPressure * 0.12 + (effect.coverageMultiplierDelta || 0),
    0.55,
    1.12
  );
  const towerBase = parcelContext.grammar === "tower-podium" ? 0.32 : parcel.district === "Downtown" ? 0.07 : 0.025;
  return {
    parcelId: parcel.id,
    blockId: parcel.blockId,
    grammar: parcelContext.grammar,
    growthPhase: parcelContext.growthPhase,
    landValue: parcelContext.landValue,
    heightMultiplier: round(heightMultiplier, 3),
    coverageMultiplier: round(coverageMultiplier, 3),
    towerProbability: round(clamp(towerBase + parcelContext.landValue * 0.09 + parcelContext.roadInfluence * 0.06 + profileTowerBias - parcelContext.viewCorridorPressure * 0.46 + (effect.towerProbabilityDelta || 0), 0, 0.54), 3),
    courtyardProbability: round(clamp((parcelContext.grammar === "perimeter-courtyard" || parcelContext.grammar === "fine-grain-streetwall" ? 0.46 : 0.12) + parcelContext.densityBias * 0.16 - parcelContext.waterfrontInfluence * 0.08 + (effect.courtyardProbabilityDelta || 0), 0.04, 0.78), 3),
    setbackTowerProbability: round(clamp((parcelContext.landValue + parcelContext.roadInfluence) * 0.14 - parcelContext.viewCorridorPressure * 0.26 + (effect.setbackTowerProbabilityDelta || 0), 0.02, 0.42), 3),
    streetAlignment: round(clamp(parcelContext.streetAlignment + (effect.streetAlignmentDelta || 0), 0.18, 0.98), 3),
    facadeRhythm: round(clamp(facadeRhythmFor(parcel.district, parcelContext) + (effect.facadeRhythmDelta || 0) + (streams.facades() - 0.5) * parcelContext.imperfection * 0.16, 0.68, 1.32), 3),
    facadeAge,
    materialFamily,
    useBias,
    viewCorridorPressure: parcelContext.viewCorridorPressure,
    imperfection: round(clamp(parcelContext.imperfection + (effect.imperfectionDelta || 0), 0.03, 0.72), 3),
    patterns
  };
}

export function summarizeUrbanContext(context: CityUrbanContext): Record<string, unknown> {
  const blocks = Object.values(context.blockContexts);
  const grammarCounts: Record<string, number> = {};
  const growthCounts: Record<string, number> = {};
  for (const block of blocks) {
    grammarCounts[block.grammar] = (grammarCounts[block.grammar] || 0) + 1;
    growthCounts[block.growthPhase] = (growthCounts[block.growthPhase] || 0) + 1;
  }
  const activePatterns = allPatternApplications(context);
  return {
    id: "urban-context",
    type: "UrbanContext",
    schema: context.schema,
    profileName: context.profileName,
    patternSummary: patternSummary(activePatterns),
    cityPatterns: context.cityPatterns.map((pattern) => ({
      id: pattern.id,
      weight: pattern.weight
    })),
    growthPhases: growthCounts,
    blockGrammars: grammarCounts,
    viewCorridors: context.viewCorridors.map((corridor) => ({
      id: corridor.id,
      protectedHeightFactor: corridor.protectedHeightFactor
    })),
    districtContexts: Object.fromEntries(Object.entries(context.districtContexts).map(([district, districtContext]) => [
      district,
      {
        identity: districtContext.identity,
        growthPhase: districtContext.dominantGrowthPhase,
        landValueBase: districtContext.landValueBase,
        densityBias: districtContext.densityBias,
        heightBias: districtContext.heightBias,
        imperfection: districtContext.imperfection,
        patterns: districtContext.patterns.map((pattern) => ({
          id: pattern.id,
          weight: pattern.weight
        }))
      }
    ]))
  };
}

function createCityPatternContext(config: CityGeneratorConfig, network: RoadNetwork): PatternContext {
  return {
    scope: "city",
    config,
    network,
    downtownInfluence: 0.72,
    hasWaterways: network.waterways.length > 0 || config.profileData?.waterways?.enabled === true,
    hasLandmark: true,
    hasOpenSpace: true,
    landValue: 0.56,
    densityBias: config.density === "high" ? 0.86 : 0.62,
    imperfection: distributionValue(config.profileData?.blocks.irregularity, profileNumber(config.profileData?.relationships.streetIrregularity, 0.34))
  };
}

function createDistrictPatternContext(config: CityGeneratorConfig, district: DistrictName, districtContext: DistrictUrbanContext): PatternContext {
  return {
    scope: "district",
    config,
    district,
    landValue: districtContext.landValueBase,
    densityBias: districtContext.densityBias,
    heightBias: districtContext.heightBias,
    courtyardProbability: districtContext.courtyardBias,
    streetAlignment: districtContext.streetAlignmentBias,
    imperfection: districtContext.imperfection,
    growthPhase: districtContext.dominantGrowthPhase,
    hasWaterways: config.profileData?.waterways?.enabled === true,
    hasOpenSpace: district === "Civic District" || district === "Mixed Residential",
    hasLandmark: district === "Civic District" || district === "Historic Core"
  };
}

function createBlockPatternContext(config: CityGeneratorConfig, block: Block, network: RoadNetwork, values: Partial<PatternContext>): PatternContext {
  return {
    ...values,
    scope: "block",
    config,
    network,
    block,
    district: block.district,
    blockArea: block.area,
    hasWaterways: network.waterways.length > 0 || config.profileData?.waterways?.enabled === true,
    hasOpenSpace: !!block.openSpace,
    hasLandmark: !!block.landmark
  };
}

function createParcelPatternContext(config: CityGeneratorConfig, parcel: Parcel, blockContext: BlockUrbanContext, values: Partial<PatternContext>): PatternContext {
  return {
    ...values,
    scope: "parcel",
    config,
    parcel,
    blockContext,
    district: parcel.district,
    roadHierarchy: parcel.frontageHierarchy,
    roadInfluence: blockContext.roadInfluence,
    landmarkInfluence: blockContext.landmarkInfluence,
    waterfrontInfluence: blockContext.waterfrontInfluence,
    viewCorridorPressure: blockContext.viewCorridorPressure,
    neighborContinuity: blockContext.neighborContinuity,
    courtyardProbability: blockContext.courtyardProbability,
    blockGrammar: blockContext.grammar,
    growthPhase: blockContext.growthPhase,
    blockArea: parcel.area,
    hasWaterways: config.profileData?.waterways?.enabled === true
  };
}

function createBuildingPatternContext(config: CityGeneratorConfig, parcel: Parcel, parcelContext: ParcelUrbanContext): PatternContext {
  return {
    scope: "building",
    config,
    parcel,
    parcelContext,
    district: parcel.district,
    roadHierarchy: parcelContext.roadHierarchy,
    roadInfluence: parcelContext.roadInfluence,
    landValue: parcelContext.landValue,
    densityBias: parcelContext.densityBias,
    heightBias: parcelContext.heightBias,
    coverageBias: parcelContext.coverageBias,
    setbackBias: parcelContext.setbackBias,
    courtyardProbability: parcelContext.courtyardProbability,
    streetAlignment: parcelContext.streetAlignment,
    landmarkInfluence: parcelContext.landmarkInfluence,
    waterfrontInfluence: parcelContext.waterfrontInfluence,
    viewCorridorPressure: parcelContext.viewCorridorPressure,
    neighborContinuity: parcelContext.neighborContinuity,
    imperfection: parcelContext.imperfection,
    blockGrammar: parcelContext.grammar,
    growthPhase: parcelContext.growthPhase,
    blockArea: parcel.area,
    hasWaterways: config.profileData?.waterways?.enabled === true
  };
}

function mergePatternApplications(...patternLists: UrbanPatternApplication[][]): UrbanPatternApplication[] {
  const byId = new Map<string, UrbanPatternApplication>();
  for (const patterns of patternLists) {
    for (const pattern of patterns) {
      const existing = byId.get(pattern.id);
      if (!existing || pattern.weight > existing.weight) {
        byId.set(pattern.id, pattern);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function allPatternApplications(context: CityUrbanContext): UrbanPatternApplication[] {
  return mergePatternApplications(
    context.cityPatterns,
    ...Object.values(context.districtContexts).map((districtContext) => districtContext.patterns),
    ...Object.values(context.blockContexts).map((blockContext) => blockContext.patterns),
    ...Object.values(context.parcelContexts).map((parcelContext) => parcelContext.patterns),
    ...Object.values(context.buildingContexts).map((buildingContext) => buildingContext.patterns)
  );
}

function createDistrictContexts(config: CityGeneratorConfig, cityPatterns: UrbanPatternApplication[]): Record<DistrictName, DistrictUrbanContext> {
  const profile = config.profileData;
  const courtyard = profileNumber(profile?.relationships.courtyardProbability, profileNumber(profile?.blocks.courtyardFrequency, 0.34));
  const alignment = profileNumber(profile?.relationships.buildingStreetAlignment, profileNumber(profile?.buildings.streetAlignmentProbability, 0.72));
  const irregularity = distributionValue(profile?.blocks.irregularity, profileNumber(profile?.relationships.streetIrregularity, 0.34));
  const contexts: Record<DistrictName, DistrictUrbanContext> = {
    "Historic Core": {
      district: "Historic Core",
      identity: "fine grain inherited street fabric",
      dominantGrowthPhase: "historic-core",
      landValueBase: 0.58,
      densityBias: 0.9,
      heightBias: 0.62,
      courtyardBias: clamp(courtyard + 0.2, 0.28, 0.88),
      streetAlignmentBias: clamp(alignment + 0.12, 0.52, 0.98),
      imperfection: clamp(irregularity + 0.16, 0.18, 0.72),
      preferredMaterials: ["brick", "limestone", "painted-concrete", "sandstone"],
      facadeRhythm: 0.88,
      patterns: []
    },
    "Downtown": {
      district: "Downtown",
      identity: "mixed commercial core with varied skyline and older retained blocks",
      dominantGrowthPhase: "contemporary-infill",
      landValueBase: 0.7,
      densityBias: 0.96,
      heightBias: 1.04,
      courtyardBias: clamp(courtyard * 0.42, 0.05, 0.36),
      streetAlignmentBias: clamp(alignment + 0.02, 0.48, 0.94),
      imperfection: clamp(irregularity * 0.72, 0.12, 0.5),
      preferredMaterials: ["concrete", "dark-glass", "steel"],
      facadeRhythm: 1.14,
      patterns: []
    },
    "Mixed Residential": {
      district: "Mixed Residential",
      identity: "incremental apartment fabric with shops on stronger streets",
      dominantGrowthPhase: "postwar-rebuild",
      landValueBase: 0.48,
      densityBias: 0.86,
      heightBias: 0.86,
      courtyardBias: clamp(courtyard + 0.08, 0.22, 0.78),
      streetAlignmentBias: clamp(alignment, 0.42, 0.92),
      imperfection: clamp(irregularity + 0.04, 0.12, 0.58),
      preferredMaterials: ["painted-concrete", "brick", "limestone"],
      facadeRhythm: 1,
      patterns: []
    },
    "Civic District": {
      district: "Civic District",
      identity: "planned civic rooms, institutions and ceremonial open space",
      dominantGrowthPhase: "postwar-rebuild",
      landValueBase: 0.62,
      densityBias: 0.58,
      heightBias: 0.7,
      courtyardBias: clamp(courtyard * 0.28, 0.04, 0.28),
      streetAlignmentBias: clamp(alignment - 0.18, 0.25, 0.78),
      imperfection: clamp(irregularity * 0.45, 0.06, 0.34),
      preferredMaterials: ["sandstone", "limestone", "concrete"],
      facadeRhythm: 1.08,
      patterns: []
    }
  };
  for (const district of Object.keys(contexts) as DistrictName[]) {
    const districtContext = contexts[district];
    const result = PATTERN_ENGINE.evaluate(createDistrictPatternContext(config, district, districtContext), ["district"]);
    const effect = result.effect;
    contexts[district] = {
      ...districtContext,
      dominantGrowthPhase: effect.growthPhase ?? districtContext.dominantGrowthPhase,
      landValueBase: round(clamp(districtContext.landValueBase + (effect.landValueDelta || 0), 0.05, 1), 3),
      densityBias: round(clamp(districtContext.densityBias + (effect.densityBiasDelta || 0), 0.2, 1.5), 3),
      heightBias: round(clamp(districtContext.heightBias + (effect.heightBiasDelta || 0), 0.18, 1.7), 3),
      courtyardBias: round(clamp(districtContext.courtyardBias + (effect.courtyardProbabilityDelta || 0), 0.02, 0.9), 3),
      streetAlignmentBias: round(clamp(districtContext.streetAlignmentBias + (effect.streetAlignmentDelta || 0), 0.18, 0.98), 3),
      imperfection: round(clamp(districtContext.imperfection + (effect.imperfectionDelta || 0), 0.04, 0.8), 3),
      facadeRhythm: round(clamp(districtContext.facadeRhythm + (effect.facadeRhythmDelta || 0), 0.68, 1.32), 3),
      preferredMaterials: effect.materialFamily ? [effect.materialFamily, ...districtContext.preferredMaterials] : districtContext.preferredMaterials,
      patterns: mergePatternApplications(cityPatterns, toUrbanPatternApplications(result.applications))
    };
  }
  return contexts;
}

function createBlockContext(
  block: Block,
  config: CityGeneratorConfig,
  network: RoadNetwork,
  districtContext: DistrictUrbanContext,
  viewCorridors: CityUrbanContext["viewCorridors"],
  streams: RandomStreams
): BlockUrbanContext {
  const roadProximity = nearestRoadInfluence(block.center, network.roads, config.size);
  const roadInfluence = roadProximity.influence;
  const waterfrontInfluence = network.waterways.length
    ? clamp(Math.max(...network.waterways.map((waterway) => 1 - distanceToWaterway(block.center, waterway) / (config.size * 0.16))), 0, 1)
    : 0;
  const landmarkInfluence = clamp(Math.max(...landmarkAnchors().map((anchor) => 1 - distance(block.center, anchor) / (config.size * 0.18))), 0, 1);
  const viewCorridorPressure = viewCorridors.length
    ? clamp(Math.max(...viewCorridors.map((corridor) => 1 - distanceToSegment(block.center, corridor.from, corridor.to) / (config.size * 0.055))), 0, 1)
    : 0;
  const downtown = downtownFactor(block.center, config.size);
  const localNoise = streams.heightNoise(block.center[0] * 0.006 + 19, block.center[1] * 0.006 - 31) * districtContext.imperfection * 0.18;
  const landValue = clamp(
    districtContext.landValueBase
    + downtown * 0.14
    + roadInfluence * 0.14
    + landmarkInfluence * 0.12
    + waterfrontInfluence * 0.16
    - viewCorridorPressure * 0.06
    + localNoise,
    0.04,
    0.98
  );
  const growthPhase = growthPhaseFor(block, roadProximity.hierarchy, landValue, waterfrontInfluence, landmarkInfluence);
  const grammar = grammarFor(block, roadProximity.hierarchy, landValue, districtContext, growthPhase, roadInfluence, waterfrontInfluence, landmarkInfluence);
  const densityBias = clamp(districtContext.densityBias + landValue * 0.14 + roadInfluence * 0.07 - viewCorridorPressure * 0.12, 0.24, 1.32);
  const heightBias = clamp(districtContext.heightBias + downtown * 0.2 + roadInfluence * 0.13 + waterfrontInfluence * 0.06 - viewCorridorPressure * 0.42, 0.18, 1.55);
  const coverageBias = clamp(0.62 + densityBias * 0.18 + districtContext.courtyardBias * 0.08 - (growthPhase === "waterfront-renewal" ? 0.08 : 0), 0.38, 1.08);
  const setbackBias = clamp(
    (block.district === "Civic District" ? 1.28 : block.district === "Downtown" ? 1.1 : 0.86)
    + waterfrontInfluence * 0.18
    + viewCorridorPressure * 0.2
    - roadInfluence * 0.1,
    0.28,
    1.72
  );
  const courtyardProbability = clamp(districtContext.courtyardBias + densityBias * 0.12 - waterfrontInfluence * 0.1, 0.02, 0.88);
  const streetAlignment = clamp(districtContext.streetAlignmentBias + roadInfluence * 0.08 - districtContext.imperfection * 0.05, 0.18, 0.98);
  const imperfection = clamp(districtContext.imperfection + localNoise * 0.35, 0.04, 0.76);
  const patternResult = PATTERN_ENGINE.evaluate(createBlockPatternContext(config, block, network, {
    roadHierarchy: roadProximity.hierarchy,
    roadInfluence,
    landValue,
    densityBias,
    heightBias,
    coverageBias,
    setbackBias,
    courtyardProbability,
    streetAlignment,
    landmarkInfluence,
    waterfrontInfluence,
    viewCorridorPressure,
    downtownInfluence: downtown,
    neighborContinuity: 0.5,
    imperfection,
    blockGrammar: grammar,
    growthPhase
  }), ["city", "district", "street", "block", "public-space"]);
  const effect = patternResult.effect;
  const patterns = mergePatternApplications(districtContext.patterns, toUrbanPatternApplications(patternResult.applications));

  return {
    blockId: block.id,
    district: block.district,
    grammar: effect.blockGrammar ?? grammar,
    growthPhase: effect.growthPhase ?? growthPhase,
    landValue: round(clamp(landValue + (effect.landValueDelta || 0), 0.04, 0.98), 3),
    densityBias: round(clamp(densityBias + (effect.densityBiasDelta || 0), 0.24, 1.32), 3),
    heightBias: round(clamp(heightBias + (effect.heightBiasDelta || 0), 0.18, 1.55), 3),
    coverageBias: round(clamp(coverageBias + (effect.coverageBiasDelta || 0), 0.38, 1.08), 3),
    setbackBias: round(clamp(setbackBias + (effect.setbackBiasDelta || 0), 0.28, 1.72), 3),
    courtyardProbability: round(clamp(courtyardProbability + (effect.courtyardProbabilityDelta || 0), 0.02, 0.88), 3),
    streetAlignment: round(clamp(streetAlignment + (effect.streetAlignmentDelta || 0), 0.18, 0.98), 3),
    roadInfluence: round(roadInfluence, 3),
    roadHierarchy: roadProximity.hierarchy,
    landmarkInfluence: round(landmarkInfluence, 3),
    waterfrontInfluence: round(waterfrontInfluence, 3),
    viewCorridorPressure: round(viewCorridorPressure, 3),
    imperfection: round(clamp(imperfection + (effect.imperfectionDelta || 0), 0.04, 0.76), 3),
    neighborContinuity: round(clamp(0.5 + (effect.neighborContinuityDelta || 0), 0.05, 1), 3),
    patterns,
    treeDensityMultiplier: round(clamp(effect.treeDensityMultiplier ?? 1, 0.55, 2.2), 3)
  };
}

function applyNeighborContinuity(blocks: Block[], context: CityUrbanContext, size: number): void {
  const radius = size * 0.16;
  for (const block of blocks) {
    const blockContext = context.blockContexts[block.id];
    if (!blockContext) {
      continue;
    }
    const neighbors = blocks
      .filter((candidate) => candidate.id !== block.id && candidate.district === block.district && distance(block.center, candidate.center) <= radius)
      .slice(0, 10);
    if (!neighbors.length) {
      continue;
    }
    let similarity = 0;
    for (const neighbor of neighbors) {
      const neighborContext = context.blockContexts[neighbor.id];
      if (!neighborContext) {
        continue;
      }
      similarity += (1 - Math.abs(blockContext.landValue - neighborContext.landValue)) * 0.65;
      similarity += (blockContext.grammar === neighborContext.grammar ? 1 : 0.35) * 0.35;
    }
    blockContext.neighborContinuity = round(clamp((similarity / neighbors.length) * 0.82 + blockContext.neighborContinuity * 0.18, 0.12, 1), 3);
    blockContext.imperfection = round(clamp(blockContext.imperfection * (1.08 - blockContext.neighborContinuity * 0.18), 0.04, 0.76), 3);
  }
}

function nearestRoadInfluence(point: Vec2, roads: Road[], size: number): { hierarchy: RoadHierarchy; influence: number } {
  let bestHierarchy: RoadHierarchy = "local";
  let bestInfluence = 0;
  for (const road of roads) {
    const d = distanceToPolyline(point, road.polyline);
    const reach = size * (road.hierarchy === "arterial" ? 0.18 : road.hierarchy === "collector" ? 0.13 : 0.08);
    const influence = clamp(1 - d / reach, 0, 1) * ROAD_INFLUENCE[road.hierarchy];
    if (influence > bestInfluence) {
      bestInfluence = influence;
      bestHierarchy = road.hierarchy;
    }
  }
  return {hierarchy: bestHierarchy, influence: bestInfluence};
}

function createViewCorridors(config: CityGeneratorConfig, network: RoadNetwork): CityUrbanContext["viewCorridors"] {
  const [historic, civic, downtown] = landmarkAnchors();
  const corridors: CityUrbanContext["viewCorridors"] = [
    {id: "historic-spire-to-downtown", from: historic, to: downtown, protectedHeightFactor: 0.62},
    {id: "civic-axis-to-core", from: civic, to: downtown, protectedHeightFactor: 0.72}
  ];
  const waterway = network.waterways[0];
  if (waterway && waterway.polyline.length) {
    const midpoint = waterway.polyline[Math.floor(waterway.polyline.length / 2)];
    corridors.push({
      id: "waterfront-view-to-core",
      from: midpoint,
      to: downtown,
      protectedHeightFactor: config.profileData?.waterways?.style === "thames" ? 0.7 : 0.78
    });
  }
  return corridors;
}

function growthPhaseFor(block: Block, roadHierarchy: RoadHierarchy, landValue: number, waterfrontInfluence: number, landmarkInfluence: number): GrowthPhase {
  if (waterfrontInfluence > 0.48 && landValue > 0.42) {
    return "waterfront-renewal";
  }
  if (block.district === "Historic Core" || landmarkInfluence > 0.72) {
    return "historic-core";
  }
  if (block.district === "Downtown" && landValue > 0.62) {
    return "contemporary-infill";
  }
  if (roadHierarchy === "arterial" && block.area > 12000 && landValue > 0.44 && landValue < 0.64) {
    return "industrial-expansion";
  }
  return "postwar-rebuild";
}

function grammarFor(
  block: Block,
  roadHierarchy: RoadHierarchy,
  landValue: number,
  districtContext: DistrictUrbanContext,
  growthPhase: GrowthPhase,
  roadInfluence: number,
  waterfrontInfluence: number,
  landmarkInfluence: number
): BlockGrammar {
  if (growthPhase === "waterfront-renewal" || waterfrontInfluence > 0.58) {
    return "waterfront-edge";
  }
  if (block.district === "Civic District" || landmarkInfluence > 0.68) {
    return "civic-campus";
  }
  const towerSuitability = clamp((landValue - 0.7) * 0.9 + roadInfluence * 0.18 + (block.area > 9000 ? 0.08 : 0), 0, 0.36);
  if (block.district === "Downtown" && block.area > 4200 && landValue > 0.74 && roadInfluence > 0.48 && blockVariation(block) < towerSuitability) {
    return "tower-podium";
  }
  if (block.district === "Downtown" && landValue > 0.62 && roadInfluence > 0.68) {
    return "commercial-corridor";
  }
  if (block.district === "Downtown") {
    return "mixed-infill";
  }
  if (block.district === "Historic Core") {
    return landValue > 0.38 || districtContext.courtyardBias > 0.28 ? "perimeter-courtyard" : "fine-grain-streetwall";
  }
  if (block.district === "Mixed Residential") {
    return districtContext.courtyardBias > 0.42 && landValue > 0.62 ? "perimeter-courtyard" : "mixed-infill";
  }
  if ((roadHierarchy === "arterial" || roadHierarchy === "collector") && roadInfluence > 0.82 && landValue > 0.64) {
    return "commercial-corridor";
  }
  if (districtContext.courtyardBias > 0.42) {
    return "perimeter-courtyard";
  }
  return "mixed-infill";
}

function blockVariation(block: Block): number {
  const value = Math.sin(block.center[0] * 12.9898 + block.center[1] * 78.233 + block.area * 0.00031) * 43758.5453;
  return value - Math.floor(value);
}

function patternFromGrammar(grammar: BlockGrammar): Block["pattern"] {
  switch (grammar) {
    case "fine-grain-streetwall":
      return "historic-narrow";
    case "perimeter-courtyard":
    case "waterfront-edge":
      return "perimeter-courtyard";
    case "tower-podium":
      return "podium-tower";
    case "civic-campus":
      return "standalone-civic";
    case "mixed-infill":
    case "commercial-corridor":
    default:
      return "mixed-use";
  }
}

function blockContextMetadata(blockContext: BlockUrbanContext): Record<string, unknown> {
  return {
    grammar: blockContext.grammar,
    growthPhase: blockContext.growthPhase,
    landValue: blockContext.landValue,
    densityBias: blockContext.densityBias,
    heightBias: blockContext.heightBias,
    coverageBias: blockContext.coverageBias,
    setbackBias: blockContext.setbackBias,
    courtyardProbability: blockContext.courtyardProbability,
    streetAlignment: blockContext.streetAlignment,
    roadInfluence: blockContext.roadInfluence,
    roadHierarchy: blockContext.roadHierarchy,
    landmarkInfluence: blockContext.landmarkInfluence,
    waterfrontInfluence: blockContext.waterfrontInfluence,
    viewCorridorPressure: blockContext.viewCorridorPressure,
    imperfection: blockContext.imperfection,
    neighborContinuity: blockContext.neighborContinuity,
    treeDensityMultiplier: blockContext.treeDensityMultiplier,
    patterns: blockContext.patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      weight: pattern.weight
    }))
  };
}

function facadeAgeFor(growthPhase: GrowthPhase): BuildingUrbanContext["facadeAge"] {
  switch (growthPhase) {
    case "historic-core":
      return "historic";
    case "industrial-expansion":
      return "industrial";
    case "contemporary-infill":
    case "waterfront-renewal":
      return "contemporary";
    case "postwar-rebuild":
    default:
      return "postwar";
  }
}

function materialFamilyFor(district: DistrictName, growthPhase: GrowthPhase, streams: RandomStreams): string {
  const families: Record<DistrictName, string[]> = {
    "Historic Core": ["brick", "stone", "stucco"],
    Downtown: ["glass", "concrete", "steel"],
    "Mixed Residential": ["painted-concrete", "brick", "limestone"],
    "Civic District": ["stone", "limestone", "concrete"]
  };
  const override = growthPhase === "waterfront-renewal" ? ["glass", "concrete", "steel"] : families[district];
  return override[Math.floor(streams.buildings() * override.length) % override.length];
}

function useBiasFor(district: DistrictName, context: ParcelUrbanContext): BuildingUrbanContext["useBias"] {
  if (district === "Civic District" || context.grammar === "civic-campus") {
    return "civic";
  }
  if (district === "Downtown" || context.grammar === "tower-podium") {
    return "commercial";
  }
  if (context.grammar === "commercial-corridor" || context.roadHierarchy === "arterial") {
    return "mixed";
  }
  return "residential";
}

function facadeRhythmFor(district: DistrictName, context: ParcelUrbanContext): number {
  if (context.growthPhase === "historic-core" || district === "Historic Core") {
    return 0.84 + context.neighborContinuity * 0.12;
  }
  if (context.growthPhase === "contemporary-infill" || context.grammar === "tower-podium") {
    return 1.12;
  }
  if (context.growthPhase === "waterfront-renewal") {
    return 1.08;
  }
  return 0.98;
}
