import type {BuildingUrbanContext, CityGeneratorConfig, CityObject, CityUrbanContext, Parcel, RandomStreams, Vec2} from "../types";
import {bbox, clamp, polygonArea, polygonCentroid, rectPolygon, round, scalePolygon} from "../geometry/PolygonUtils";
import {extrudePolygon} from "../geometry/Extrusion";
import {parcelFootprint} from "./ParcelGenerator";
import {downtownFactor} from "./Zoning";
import {createFacadeMeshes} from "./FacadeGenerator";
import {createRoofMeshes, type RoofType} from "./RoofGenerator";
import {clampProfileValue, distributionValue, profileNumber} from "../profiles/ProfileResolver";
import {createBuildingContext} from "./UrbanContext";
import type {Candidate} from "../evaluation/Candidate";
import {selectUrbanCandidate} from "../evaluation/UrbanEvaluation";

type BuildingMassing = "street-wall-slab" | "courtyard" | "setback-tower" | "podium-tower";

export function generateBuildings(parcels: Parcel[], config: CityGeneratorConfig, streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject[] {
  const shuffled = parcels
    .map((parcel) => ({parcel, key: stableParcelPriority(parcel, streams.buildings, urbanContext)}))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.parcel);
  const target = config.buildingCount || (config.density === "high" ? 560 : 380);
  const selected = shuffled.slice(0, Math.min(target, shuffled.length));
  selected.sort((a, b) => a.id.localeCompare(b.id));
  return selected.map((parcel, index) => createBuilding(parcel, index + 1, config, streams, urbanContext));
}

function createBuilding(parcel: Parcel, ordinal: number, config: CityGeneratorConfig, streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject {
  const id = `building-${String(ordinal).padStart(4, "0")}`;
  const parcelContext = urbanContext?.parcelContexts[parcel.id];
  const buildingContext = parcelContext ? createBuildingContext(parcel, parcelContext, config, streams) : undefined;
  if (urbanContext && buildingContext) {
    urbanContext.buildingContexts[id] = buildingContext;
  }
  const footprint = parcelFootprint(parcel, config.profileData, urbanContext);
  const area = Math.abs(polygonArea(footprint));
  const center = polygonCentroid(footprint);
  const downtown = downtownFactor(center, config.size);
  const floors = floorCount(parcel, area, downtown, streams, config, buildingContext);
  const floorHeight = parcel.district === "Downtown" ? 3.75 : parcel.district === "Historic Core" ? 3.15 : 3.35;
  const height = floors * floorHeight;
  const usage = usageFor(parcel, floors, streams.buildings, config, buildingContext);
  const facadeStyle = facadeStyleFor(parcel, floors, streams.buildings, buildingContext);
  const roofType = roofTypeFor(parcel, floors, streams.roofs, buildingContext);
  const wallMaterialId = wallMaterialFor(parcel, facadeStyle, buildingContext);
  const meshes = [];

  const [minX, minY, maxX, maxY] = bbox(footprint);
  const width = maxX - minX;
  const depth = maxY - minY;
  const gradient = profileNumber(config.profileData?.relationships.downtownHeightGradient, 1);
  const towerChance = buildingContext?.towerProbability
    ?? clampProfileValue(0.42 + gradient * 0.18 + (distributionValue(config.profileData?.buildings.levels, 7, "p95") - 20) * 0.008, 0.28, 0.82);
  const courtyardChance = buildingContext?.courtyardProbability
    ?? clampProfileValue(profileNumber(config.profileData?.relationships.courtyardProbability, 0.32) * 1.35, 0.16, 0.7);
  const canTower = parcel.district === "Downtown" && area > 950 && floors >= 14;
  const canCourtyard = (parcel.district === "Historic Core" || parcel.district === "Mixed Residential") && area > 850 && width > 24 && depth > 24;
  const massing = selectBuildingMassing(parcel, id, area, floors, width, depth, canTower, towerChance, canCourtyard, courtyardChance, config, buildingContext);

  if (massing === "podium-tower") {
    const podiumFloors = Math.max(3, Math.min(6, Math.round(floors * 0.22)));
    const podiumHeight = podiumFloors * floorHeight;
    meshes.push(extrudePolygon({polygon: footprint, height: podiumHeight, materialId: "concrete"}));
    addDetailMeshes(meshes, footprint, 0, podiumHeight, podiumFloors, parcel, usage, "concrete-grid", roofType, streams, buildingContext);

    const towerFootprint = scalePolygon(footprint, 0.48 + streams.buildings() * 0.22, 0.44 + streams.buildings() * 0.22);
    const towerHeight = height - podiumHeight;
    meshes.push(extrudePolygon({polygon: towerFootprint, height: towerHeight, baseZ: podiumHeight, materialId: wallMaterialId}));
    addDetailMeshes(meshes, towerFootprint, podiumHeight, towerHeight, floors - podiumFloors, parcel, usage, "curtain-wall", "flat", streams, buildingContext);
  } else if (massing === "courtyard") {
    const wing = Math.min(width, depth) * (0.22 + streams.buildings() * 0.06);
    const parts = [
      rectPolygon((minX + maxX) / 2, minY + wing / 2, width, wing),
      rectPolygon((minX + maxX) / 2, maxY - wing / 2, width, wing),
      rectPolygon(minX + wing / 2, (minY + maxY) / 2, wing, depth - wing * 2),
      rectPolygon(maxX - wing / 2, (minY + maxY) / 2, wing, depth - wing * 2)
    ];
    for (const part of parts) {
      meshes.push(extrudePolygon({polygon: part, height, materialId: wallMaterialId}));
      addDetailMeshes(meshes, part, 0, height, floors, parcel, usage, facadeStyle, roofType, streams, buildingContext);
    }
  } else if (massing === "setback-tower") {
    const lowerFloors = Math.max(4, Math.floor(floors * 0.62));
    const lowerHeight = lowerFloors * floorHeight;
    meshes.push(extrudePolygon({polygon: footprint, height: lowerHeight, materialId: wallMaterialId}));
    addDetailMeshes(meshes, footprint, 0, lowerHeight, lowerFloors, parcel, usage, facadeStyle, "terrace", streams, buildingContext);
    const upper = scalePolygon(footprint, 0.78, 0.74);
    const upperHeight = height - lowerHeight;
    meshes.push(extrudePolygon({polygon: upper, height: upperHeight, baseZ: lowerHeight, materialId: wallMaterialId}));
    addDetailMeshes(meshes, upper, lowerHeight, upperHeight, floors - lowerFloors, parcel, usage, facadeStyle, roofType, streams, buildingContext);
  } else {
    meshes.push(extrudePolygon({polygon: footprint, height, materialId: wallMaterialId}));
    addDetailMeshes(meshes, footprint, 0, height, floors, parcel, usage, facadeStyle, roofType, streams, buildingContext);
  }

  return {
    id,
    name: `${parcel.district} ${usage} ${ordinal}`,
    type: "Building",
    layerId: "buildings",
    meshes,
    metadata: {
      id,
      type: "Building",
      blockId: parcel.blockId,
      parcelId: parcel.id,
      district: parcel.district,
      usage,
      floors,
      height: round(height, 1),
      footprintArea: round(area, 1),
      footprint: footprint.map((point) => [round(point[0], 2), round(point[1], 2)]),
      center: center.map((value) => round(value, 2)),
      facadeStyle,
      roofType,
      roadHierarchy: parcel.frontageHierarchy,
      ...(buildingContext ? {
        grammar: buildingContext.grammar,
        growthPhase: buildingContext.growthPhase,
        landValue: buildingContext.landValue,
        useBias: buildingContext.useBias,
        facadeAge: buildingContext.facadeAge,
        materialFamily: buildingContext.materialFamily,
        viewCorridorPressure: buildingContext.viewCorridorPressure,
        imperfection: buildingContext.imperfection,
        patterns: buildingContext.patterns.map((pattern) => ({
          id: pattern.id,
          weight: pattern.weight
        }))
      } : {})
    }
  };
}

function selectBuildingMassing(
  parcel: Parcel,
  buildingId: string,
  area: number,
  floors: number,
  width: number,
  depth: number,
  canTower: boolean,
  towerChance: number,
  canCourtyard: boolean,
  courtyardChance: number,
  config: CityGeneratorConfig,
  buildingContext?: BuildingUrbanContext
): BuildingMassing {
  const candidates: Candidate<BuildingMassing>[] = [
    massingCandidate("street-wall-slab", "Street-wall slab", "street-wall-slab", parcel, area, floors, width, depth, 0.72, buildingContext),
    ...(canCourtyard ? [massingCandidate("courtyard", "Courtyard building", "courtyard", parcel, area, floors, width, depth, courtyardChance, buildingContext)] : []),
    ...(parcel.district !== "Historic Core" && floors > 8 ? [massingCandidate("setback-tower", "Setback tower", "setback-tower", parcel, area, floors, width, depth, buildingContext?.setbackTowerProbability ?? 0.42, buildingContext)] : []),
    ...(canTower ? [massingCandidate("podium-tower", "Podium tower", "podium-tower", parcel, area, floors, width, depth, towerChance, buildingContext)] : [])
  ];
  const context = {
    stage: "building-massing" as const,
    subjectId: buildingId,
    config,
    profile: config.profileData,
    district: parcel.district,
    parcel
  };
  const result = selectUrbanCandidate(candidates, context, {
    threshold: config.evaluation?.threshold ?? 0.57,
    weights: {
      "Walkability": 0.55,
      "Block Quality": 0.4,
      "Landmark Quality": 0
    }
  });
  return result.candidate.value;
}

function massingCandidate(
  id: BuildingMassing,
  label: string,
  massing: BuildingMassing,
  parcel: Parcel,
  area: number,
  floors: number,
  width: number,
  depth: number,
  contextualChance: number,
  buildingContext?: BuildingUrbanContext
): Candidate<BuildingMassing> {
  const aspect = Math.max(width, depth) / Math.max(1, Math.min(width, depth));
  const downtown = parcel.district === "Downtown";
  const historic = parcel.district === "Historic Core";
  const mixed = parcel.district === "Mixed Residential";
  let patternFit = 0.62;
  if (massing === "podium-tower") {
    patternFit = downtown && buildingContext?.grammar === "tower-podium" ? 0.84 : downtown ? 0.58 : 0.24;
  } else if (massing === "courtyard") {
    patternFit = historic || mixed ? 0.72 + contextualChance * 0.18 : 0.36;
  } else if (massing === "setback-tower") {
    patternFit = downtown || parcel.frontageHierarchy === "arterial" ? 0.68 : 0.44;
  } else {
    patternFit = historic ? 0.78 : downtown ? 0.58 : 0.72;
  }
  const tower = massing === "podium-tower" || massing === "setback-tower";
  return {
    id,
    label,
    value: massing,
    tags: massingTags(massing, parcel),
    metrics: {
      levels: floors,
      buildingCoverage: massing === "podium-tower" ? 0.58 : massing === "courtyard" ? 0.72 : 0.82,
      activeFrontage: massing === "street-wall-slab" || massing === "courtyard" ? 0.78 : 0.62,
      streetEdgeContinuity: massing === "street-wall-slab" || massing === "courtyard" ? 0.82 : 0.54,
      patternFit,
      downtownFit: downtown ? (tower ? 0.82 : 0.62) : tower ? 0.36 : 0.58,
      heightTransition: tower ? Math.max(0.38, 0.88 - floors / 52) : 0.74,
      skylineRhythm: tower ? 0.72 : floors > 10 ? 0.66 : 0.58,
      landmarkProminence: tower ? 0.66 : 0.48,
      isolatedTowerPenalty: tower && buildingContext?.grammar !== "tower-podium" ? 0.22 : 0,
      blockAspectRatio: aspect,
      variety: massing === "street-wall-slab" ? 0.52 : 0.72,
      repetitionPenalty: massing === "street-wall-slab" ? 0.08 : 0,
      randomnessPenalty: patternFit < 0.38 ? 0.2 : 0
    }
  };
}

function massingTags(massing: BuildingMassing, parcel: Parcel): string[] {
  if (massing === "podium-tower") {
    return ["podium", "skyline", "mixed-use"];
  }
  if (massing === "setback-tower") {
    return ["skyline", "mixed-use"];
  }
  if (massing === "courtyard") {
    return ["courtyard", parcel.district === "Historic Core" ? "historic" : "residential", "street-wall"];
  }
  return [parcel.district === "Historic Core" ? "historic" : "mixed-use", "street-wall"];
}

function addDetailMeshes(
  meshes: CityObject["meshes"],
  polygon: Vec2[],
  baseZ: number,
  height: number,
  floors: number,
  parcel: Parcel,
  usage: string,
  facadeStyle: ReturnType<typeof facadeStyleFor>,
  roofType: RoofType,
  streams: RandomStreams,
  buildingContext?: BuildingUrbanContext
): void {
  const bounds = bbox(polygon);
  meshes.push(...createFacadeMeshes({
    bounds,
    polygon,
    baseZ,
    height,
    floors,
    district: parcel.district,
    usage,
    facadeStyle,
    glassMaterialId: facadeStyle === "curtain-wall" ? "dark-glass" : "light-glass",
    trimMaterialId: parcel.district === "Historic Core" ? "limestone" : "steel",
    balconyMaterialId: "steel",
    urbanContext: buildingContext
  }));
  meshes.push(...createRoofMeshes({
    bounds,
    polygon,
    topZ: baseZ + height,
    roofType,
    roofMaterialId: roofType === "gable" || roofType === "mansard" ? "roof-tile" : "flat-roof",
    trimMaterialId: parcel.district === "Historic Core" ? "limestone" : "concrete",
    equipmentMaterialId: "steel",
    rng: streams.roofs
  }));
}

function floorCount(parcel: Parcel, area: number, downtown: number, streams: RandomStreams, config: CityGeneratorConfig, buildingContext?: BuildingUrbanContext): number {
  const profile = config.profileData;
  const profileMean = distributionValue(profile?.buildings.levels, 7);
  const profileP25 = distributionValue(profile?.buildings.levels, 4, "p25");
  const profileP75 = distributionValue(profile?.buildings.levels, 10, "p75");
  const profileP95 = distributionValue(profile?.buildings.levels, 24, "p95");
  const heightRoadBias = profileNumber(profile?.relationships.heightRoadBias, 0.72);
  const downtownGradient = profileNumber(profile?.relationships.downtownHeightGradient, 1);
  const roadBoost = (parcel.frontageHierarchy === "arterial" ? 4.2 : parcel.frontageHierarchy === "collector" ? 2.1 : 0) * heightRoadBias;
  const n = streams.heightNoise(parcel.center[0] * 0.008, parcel.center[1] * 0.008);
  if (parcel.district === "Downtown") {
    const isSkylineParcel = buildingContext?.grammar === "tower-podium";
    const min = clampProfileValue(profileP25 * 1.15, 6, 14);
    const max = isSkylineParcel
      ? clampProfileValue(profileP95 * 1.08, 18, 42)
      : clampProfileValue(profileP75 * 1.25, 10, 24);
    const base = isSkylineParcel
      ? clampProfileValue(profileMean * 1.02, 7, 18)
      : clampProfileValue(profileMean * 0.82, 6, 14);
    const skyline = Math.pow(downtown, 1.35) * (max - base) * downtownGradient * (isSkylineParcel ? 0.58 : 0.28);
    return contextualFloor(base + skyline + roadBoost * (isSkylineParcel ? 0.62 : 0.32) + n * 3 + streams.buildings() * (isSkylineParcel ? 4.5 : 2.5), min, max, buildingContext);
  }
  if (parcel.district === "Historic Core") {
    const min = clampProfileValue(profileP25 * 0.72, 2, 5);
    const max = clampProfileValue(profileP75 * 0.8, 4, 9);
    return contextualFloor(min + streams.buildings() * (max - min + 0.5) + n * 0.8, min, max, buildingContext);
  }
  if (parcel.district === "Civic District") {
    const max = clampProfileValue(profileP75 * 0.95, 5, 14);
    return contextualFloor(2.5 + area / 900 + streams.buildings() * 3.5, 2, max, buildingContext);
  }
  const min = clampProfileValue(profileP25 * 0.9, 3, 7);
  const max = clampProfileValue(profileP75 * 1.15, 7, 18);
  return contextualFloor(min + area / 850 + roadBoost + streams.buildings() * 4 + n * 1.5, min, max, buildingContext);
}

function contextualFloor(value: number, min: number, max: number, buildingContext?: BuildingUrbanContext): number {
  const protectedMax = Math.max(min, max * (1 - (buildingContext?.viewCorridorPressure ?? 0) * 0.28));
  const adjusted = value * (buildingContext?.heightMultiplier ?? 1);
  return Math.round(clamp(adjusted, min, protectedMax));
}

function usageFor(parcel: Parcel, floors: number, rng: () => number, config: CityGeneratorConfig, buildingContext?: BuildingUrbanContext): string {
  const landUse = config.profileData?.landUse;
  const residential = profileNumber(landUse?.residential, 0.42);
  const commercial = profileNumber(landUse?.commercial, 0.19);
  const mixedUse = profileNumber(landUse?.mixedUse, 0.25);
  const civic = profileNumber(landUse?.civic, 0.04);
  const commercialBias = profileNumber(config.profileData?.relationships.commercialRoadBias, 0.68);
  const intersectionBias = profileNumber(config.profileData?.relationships.commercialIntersectionBias, 0.45);
  const roadCommercial = parcel.frontageHierarchy === "arterial"
    ? commercialBias * 0.22 + intersectionBias * 0.08
    : parcel.frontageHierarchy === "collector"
      ? commercialBias * 0.12 + intersectionBias * 0.04
      : 0;
  const contextualCommercial = buildingContext?.useBias === "commercial"
    ? 0.24
    : buildingContext?.useBias === "mixed"
      ? 0.12
      : buildingContext?.useBias === "civic"
        ? -0.04
        : 0;
  if (parcel.district === "Downtown") {
    const t = rng();
    const hotelShare = floors > 24 ? 0.18 : 0.06;
    if (t < commercial + roadCommercial + contextualCommercial) {
      return "Office";
    }
    if (t < commercial + roadCommercial + contextualCommercial + mixedUse + 0.2) {
      return "MixedUse";
    }
    return rng() < hotelShare ? "Hotel" : "Office";
  }
  if (parcel.district === "Historic Core") {
    return rng() < mixedUse + roadCommercial + contextualCommercial + 0.34 ? "MixedUse" : "Residential";
  }
  if (parcel.district === "Civic District") {
    return rng() < civic + 0.34 ? "Civic" : "Office";
  }
  return rng() < residential + 0.22 - roadCommercial - contextualCommercial * 0.5 ? "Residential" : "MixedUse";
}

function facadeStyleFor(parcel: Parcel, floors: number, rng: () => number, buildingContext?: BuildingUrbanContext): "brick" | "stone" | "stucco" | "curtain-wall" | "concrete-grid" | "residential" {
  if (buildingContext?.facadeAge === "contemporary" && floors > 8) {
    return buildingContext.materialFamily === "glass" || rng() < 0.56 ? "curtain-wall" : "concrete-grid";
  }
  if (buildingContext?.facadeAge === "historic") {
    return buildingContext.materialFamily === "stone" ? "stone" : buildingContext.materialFamily === "stucco" ? "stucco" : "brick";
  }
  if (buildingContext?.facadeAge === "industrial") {
    return rng() < 0.58 ? "brick" : "concrete-grid";
  }
  if (parcel.district === "Downtown" && floors > 14) {
    return rng() < 0.68 ? "curtain-wall" : "concrete-grid";
  }
  if (parcel.district === "Historic Core") {
    return rng() < 0.45 ? "brick" : rng() < 0.72 ? "stucco" : "stone";
  }
  if (parcel.district === "Mixed Residential") {
    return rng() < 0.65 ? "residential" : "brick";
  }
  return rng() < 0.55 ? "stone" : "concrete-grid";
}

function roofTypeFor(parcel: Parcel, floors: number, rng: () => number, buildingContext?: BuildingUrbanContext): RoofType {
  if (buildingContext?.growthPhase === "waterfront-renewal") {
    return rng() < 0.42 ? "terrace" : "flat";
  }
  if (buildingContext?.growthPhase === "historic-core") {
    return rng() < 0.48 ? "mansard" : rng() < 0.8 ? "gable" : "hip";
  }
  if (buildingContext?.growthPhase === "postwar-rebuild" && parcel.district !== "Downtown") {
    return rng() < 0.32 ? "terrace" : rng() < 0.62 ? "gable" : rng() < 0.82 ? "hip" : "flat";
  }
  if (parcel.district === "Downtown" || floors > 12) {
    return rng() < 0.34 ? "stepped" : rng() < 0.5 ? "terrace" : "flat";
  }
  if (parcel.district === "Historic Core") {
    return rng() < 0.42 ? "mansard" : rng() < 0.76 ? "gable" : "hip";
  }
  if (parcel.district === "Mixed Residential") {
    return rng() < 0.36 ? "terrace" : rng() < 0.7 ? "gable" : rng() < 0.88 ? "hip" : "flat";
  }
  return rng() < 0.32 ? "terrace" : rng() < 0.58 ? "gable" : "flat";
}

function wallMaterialFor(parcel: Parcel, facadeStyle: ReturnType<typeof facadeStyleFor>, buildingContext?: BuildingUrbanContext): string {
  if (buildingContext?.materialFamily === "glass") {
    return facadeStyle === "curtain-wall" ? "concrete" : "dark-glass";
  }
  if (buildingContext?.materialFamily === "stone") {
    return "sandstone";
  }
  if (buildingContext?.materialFamily === "stucco") {
    return "painted-concrete";
  }
  if (facadeStyle === "curtain-wall") {
    return "concrete";
  }
  if (facadeStyle === "brick") {
    return "brick";
  }
  if (facadeStyle === "stone") {
    return "sandstone";
  }
  if (facadeStyle === "stucco") {
    return "painted-concrete";
  }
  if (facadeStyle === "concrete-grid") {
    return "concrete";
  }
  return parcel.district === "Historic Core" ? "limestone" : "painted-concrete";
}

function stableParcelPriority(parcel: Parcel, rng: () => number, urbanContext?: CityUrbanContext): number {
  const parcelContext = urbanContext?.parcelContexts[parcel.id];
  const districtWeight = parcel.district === "Downtown" ? -0.08 : parcel.district === "Historic Core" ? -0.06 : 0;
  const contextWeight = parcelContext
    ? -parcelContext.landValue * 0.08 - parcelContext.densityBias * 0.03 + parcelContext.viewCorridorPressure * 0.12 + parcelContext.imperfection * 0.04
    : 0;
  return rng() + districtWeight + contextWeight;
}
