import type {CityGeneratorConfig, CityObject, Parcel, RandomStreams, Vec2} from "../types";
import {bbox, clamp, polygonArea, polygonCentroid, rectPolygon, round, scalePolygon} from "../geometry/PolygonUtils";
import {extrudePolygon} from "../geometry/Extrusion";
import {parcelFootprint} from "./ParcelGenerator";
import {downtownFactor} from "./Zoning";
import {createFacadeMeshes} from "./FacadeGenerator";
import {createRoofMeshes, type RoofType} from "./RoofGenerator";
import {clampProfileValue, distributionValue, profileNumber} from "../profiles/ProfileResolver";

export function generateBuildings(parcels: Parcel[], config: CityGeneratorConfig, streams: RandomStreams): CityObject[] {
  const shuffled = parcels
    .map((parcel) => ({parcel, key: stableParcelPriority(parcel, streams.buildings)}))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.parcel);
  const target = config.buildingCount || (config.density === "high" ? 560 : 380);
  const selected = shuffled.slice(0, Math.min(target, shuffled.length));
  selected.sort((a, b) => a.id.localeCompare(b.id));
  return selected.map((parcel, index) => createBuilding(parcel, index + 1, config, streams));
}

function createBuilding(parcel: Parcel, ordinal: number, config: CityGeneratorConfig, streams: RandomStreams): CityObject {
  const id = `building-${String(ordinal).padStart(4, "0")}`;
  const footprint = parcelFootprint(parcel, config.profileData);
  const area = Math.abs(polygonArea(footprint));
  const center = polygonCentroid(footprint);
  const downtown = downtownFactor(center, config.size);
  const floors = floorCount(parcel, area, downtown, streams, config);
  const floorHeight = parcel.district === "Downtown" ? 3.75 : parcel.district === "Historic Core" ? 3.15 : 3.35;
  const height = floors * floorHeight;
  const usage = usageFor(parcel, floors, streams.buildings, config);
  const facadeStyle = facadeStyleFor(parcel, floors, streams.buildings);
  const roofType = roofTypeFor(parcel, floors, streams.roofs);
  const wallMaterialId = wallMaterialFor(parcel, facadeStyle);
  const meshes = [];

  const [minX, minY, maxX, maxY] = bbox(footprint);
  const width = maxX - minX;
  const depth = maxY - minY;
  const gradient = profileNumber(config.profileData?.relationships.downtownHeightGradient, 1);
  const towerChance = clampProfileValue(0.42 + gradient * 0.18 + (distributionValue(config.profileData?.buildings.levels, 7, "p95") - 20) * 0.008, 0.28, 0.82);
  const courtyardChance = clampProfileValue(profileNumber(config.profileData?.relationships.courtyardProbability, 0.32) * 1.35, 0.16, 0.7);
  const canTower = parcel.district === "Downtown" && area > 950 && floors >= 14;
  const canCourtyard = (parcel.district === "Historic Core" || parcel.district === "Mixed Residential") && area > 850 && width > 24 && depth > 24;

  if (canTower && streams.buildings() < towerChance) {
    const podiumFloors = Math.max(3, Math.min(6, Math.round(floors * 0.22)));
    const podiumHeight = podiumFloors * floorHeight;
    meshes.push(extrudePolygon({polygon: footprint, height: podiumHeight, materialId: "concrete"}));
    addDetailMeshes(meshes, footprint, 0, podiumHeight, podiumFloors, parcel, usage, "concrete-grid", roofType, streams);

    const towerFootprint = scalePolygon(footprint, 0.48 + streams.buildings() * 0.22, 0.44 + streams.buildings() * 0.22);
    const towerHeight = height - podiumHeight;
    meshes.push(extrudePolygon({polygon: towerFootprint, height: towerHeight, baseZ: podiumHeight, materialId: wallMaterialId}));
    addDetailMeshes(meshes, towerFootprint, podiumHeight, towerHeight, floors - podiumFloors, parcel, usage, "curtain-wall", "flat", streams);
  } else if (canCourtyard && streams.buildings() < courtyardChance) {
    const wing = Math.min(width, depth) * (0.22 + streams.buildings() * 0.06);
    const parts = [
      rectPolygon((minX + maxX) / 2, minY + wing / 2, width, wing),
      rectPolygon((minX + maxX) / 2, maxY - wing / 2, width, wing),
      rectPolygon(minX + wing / 2, (minY + maxY) / 2, wing, depth - wing * 2),
      rectPolygon(maxX - wing / 2, (minY + maxY) / 2, wing, depth - wing * 2)
    ];
    for (const part of parts) {
      meshes.push(extrudePolygon({polygon: part, height, materialId: wallMaterialId}));
      addDetailMeshes(meshes, part, 0, height, floors, parcel, usage, facadeStyle, roofType, streams);
    }
  } else if (parcel.district !== "Historic Core" && floors > 8 && streams.buildings() < 0.42) {
    const lowerFloors = Math.max(4, Math.floor(floors * 0.62));
    const lowerHeight = lowerFloors * floorHeight;
    meshes.push(extrudePolygon({polygon: footprint, height: lowerHeight, materialId: wallMaterialId}));
    addDetailMeshes(meshes, footprint, 0, lowerHeight, lowerFloors, parcel, usage, facadeStyle, "terrace", streams);
    const upper = scalePolygon(footprint, 0.78, 0.74);
    const upperHeight = height - lowerHeight;
    meshes.push(extrudePolygon({polygon: upper, height: upperHeight, baseZ: lowerHeight, materialId: wallMaterialId}));
    addDetailMeshes(meshes, upper, lowerHeight, upperHeight, floors - lowerFloors, parcel, usage, facadeStyle, roofType, streams);
  } else {
    meshes.push(extrudePolygon({polygon: footprint, height, materialId: wallMaterialId}));
    addDetailMeshes(meshes, footprint, 0, height, floors, parcel, usage, facadeStyle, roofType, streams);
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
      roadHierarchy: parcel.frontageHierarchy
    }
  };
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
  streams: RandomStreams
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
    balconyMaterialId: "steel"
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

function floorCount(parcel: Parcel, area: number, downtown: number, streams: RandomStreams, config: CityGeneratorConfig): number {
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
    const min = clampProfileValue(profileP25 * 1.35, 7, 18);
    const max = clampProfileValue(profileP95 * 1.45, 20, 55);
    const base = clampProfileValue(profileMean * 1.25, 8, 24);
    return Math.round(clamp(base + downtown * (max - base) * downtownGradient + roadBoost + n * 4 + streams.buildings() * 7, min, max));
  }
  if (parcel.district === "Historic Core") {
    const min = clampProfileValue(profileP25 * 0.72, 2, 5);
    const max = clampProfileValue(profileP75 * 0.8, 4, 9);
    return Math.round(clamp(min + streams.buildings() * (max - min + 0.5) + n * 0.8, min, max));
  }
  if (parcel.district === "Civic District") {
    const max = clampProfileValue(profileP75 * 0.95, 5, 14);
    return Math.round(clamp(2.5 + area / 900 + streams.buildings() * 3.5, 2, max));
  }
  const min = clampProfileValue(profileP25 * 0.9, 3, 7);
  const max = clampProfileValue(profileP75 * 1.15, 7, 18);
  return Math.round(clamp(min + area / 850 + roadBoost + streams.buildings() * 4 + n * 1.5, min, max));
}

function usageFor(parcel: Parcel, floors: number, rng: () => number, config: CityGeneratorConfig): string {
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
  if (parcel.district === "Downtown") {
    const t = rng();
    const hotelShare = floors > 24 ? 0.18 : 0.06;
    if (t < commercial + roadCommercial) {
      return "Office";
    }
    if (t < commercial + roadCommercial + mixedUse + 0.2) {
      return "MixedUse";
    }
    return rng() < hotelShare ? "Hotel" : "Office";
  }
  if (parcel.district === "Historic Core") {
    return rng() < mixedUse + roadCommercial + 0.34 ? "MixedUse" : "Residential";
  }
  if (parcel.district === "Civic District") {
    return rng() < civic + 0.34 ? "Civic" : "Office";
  }
  return rng() < residential + 0.22 - roadCommercial ? "Residential" : "MixedUse";
}

function facadeStyleFor(parcel: Parcel, floors: number, rng: () => number): "brick" | "stone" | "stucco" | "curtain-wall" | "concrete-grid" | "residential" {
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

function roofTypeFor(parcel: Parcel, floors: number, rng: () => number): RoofType {
  if (parcel.district === "Downtown" || floors > 12) {
    return rng() < 0.28 ? "stepped" : "flat";
  }
  if (parcel.district === "Historic Core") {
    return rng() < 0.42 ? "mansard" : rng() < 0.76 ? "gable" : "hip";
  }
  if (parcel.district === "Mixed Residential") {
    return rng() < 0.34 ? "terrace" : rng() < 0.62 ? "flat" : "gable";
  }
  return rng() < 0.22 ? "terrace" : "flat";
}

function wallMaterialFor(parcel: Parcel, facadeStyle: ReturnType<typeof facadeStyleFor>): string {
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

function stableParcelPriority(parcel: Parcel, rng: () => number): number {
  const districtWeight = parcel.district === "Downtown" ? -0.22 : parcel.district === "Historic Core" ? -0.1 : 0;
  return rng() + districtWeight;
}
