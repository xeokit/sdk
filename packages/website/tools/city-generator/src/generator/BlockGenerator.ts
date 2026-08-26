import type {Block, CityGeneratorConfig, DistrictName, RandomStreams, Road, RoadNetwork, Vec2, Waterway} from "../types";
import {bbox, clipPolygonToBounds, distanceToPolyline, polygonArea, polygonCentroid, round} from "../geometry/PolygonUtils";
import {assignDistrict} from "./Zoning";
import {distributionValue, profileNumber} from "../profiles/ProfileResolver";
import {distanceToWaterway} from "./WaterwayGenerator";
import type {Candidate} from "../evaluation/Candidate";
import {selectUrbanCandidate} from "../evaluation/UrbanEvaluation";

export function generateBlocks(config: CityGeneratorConfig, network: RoadNetwork, streams: RandomStreams): Block[] {
  const half = config.size / 2;
  const blocks: Block[] = [];
  const roadById = new Map(network.roads.map((road) => [road.id, road]));
  const overlayRoads = network.roads.filter((road) => road.id.startsWith("road-diagonal") || road.id.startsWith("road-radial") || road.id.startsWith("road-pedestrian"));
  const waterways = network.waterways || [];
  let nextId = 1;
  for (let ix = 0; ix < network.xCoords.length - 1; ix++) {
    for (let iy = 0; iy < network.yCoords.length - 1; iy++) {
      const raw: Vec2[] = [
        network.gridPoints[ix][iy],
        network.gridPoints[ix + 1][iy],
        network.gridPoints[ix + 1][iy + 1],
        network.gridPoints[ix][iy + 1]
      ];
      const polygon = clipPolygonToBounds(raw, [-half, -half], [half, half]);
      if (polygon.length < 3) {
        continue;
      }
      const area = Math.abs(polygonArea(polygon));
      const minBlockArea = Math.max(550, Math.min(1600, distributionValue(config.profileData?.blocks.area, 7600, "p05") * 0.22));
      if (area < minBlockArea) {
        continue;
      }
      const center = polygonCentroid(polygon);
      if (overlayRoads.some((road) => blockIntersectsRoadCorridor(polygon, center, road))) {
        continue;
      }
      if (waterways.some((waterway) => blockIntersectsWaterway(polygon, center, waterway, config))) {
        continue;
      }
      const id = `block-${String(nextId++).padStart(3, "0")}`;
      const assignedDistrict = assignDistrict(center, config.size, streams.roadNoise(center[0] * 0.004, center[1] * 0.004), config.profileData);
      const district = selectDistrict(assignedDistrict, center, config, id);
      const bounds = bbox(polygon);
      const width = bounds[2] - bounds[0];
      const depth = bounds[3] - bounds[1];
      const edgeMargins = edgeMarginsForBlock(raw, ix, iy, roadById);
      const pattern = patternFor(district, width, depth, area, streams.blocks, config, id);
      blocks.push({
        id,
        polygon,
        center,
        district,
        pattern,
        area,
        edgeMargins,
        metadata: {
          id,
          type: "Block",
          district,
          pattern,
          area: round(area, 1),
          edgeMargins,
          center: center.map((v) => round(v, 2))
        }
      });
    }
  }
  reserveOpenSpaces(blocks, config, streams);
  reserveLandmarks(blocks, config);
  return blocks;
}

function selectDistrict(assignedDistrict: DistrictName, center: Vec2, config: CityGeneratorConfig, id: string): DistrictName {
  const alternatives: DistrictName[] = ["Historic Core", "Downtown", "Mixed Residential", "Civic District"];
  const candidates = alternatives.map((district): Candidate<DistrictName> => {
    const fit = district === assignedDistrict ? 0.9 : districtCompatibility(district, center, config.size) * 0.62;
    return {
      id: district.toLowerCase().replace(/[^a-z]+/g, "-"),
      label: district,
      value: district,
      tags: districtTags(district),
      metrics: {
        patternFit: fit,
        variety: district === assignedDistrict ? 0.58 : 0.5,
        downtownFit: district === "Downtown" ? 0.72 : 0.44
      }
    };
  });
  const context = {
    stage: "district-boundary" as const,
    subjectId: id,
    config,
    profile: config.profileData,
    district: assignedDistrict
  };
  const result = selectUrbanCandidate(candidates, context, {
    threshold: config.evaluation?.threshold ?? 0.52,
    weights: {
      "Walkability": 0,
      "Block Quality": 0,
      "Skyline": 0.15,
      "OSM Profile Fit": 0,
      "Landmark Quality": 0
    }
  });
  return result.candidate.value;
}

function districtCompatibility(district: DistrictName, center: Vec2, size: number): number {
  const half = size / 2;
  const distanceFromCenter = Math.hypot(center[0], center[1]) / Math.max(1, half);
  if (district === "Downtown") {
    return Math.max(0, 1 - distanceFromCenter * 1.45);
  }
  if (district === "Historic Core") {
    const oldTownDistance = Math.hypot(center[0] + half * 0.28, center[1] - half * 0.08) / Math.max(1, half);
    return Math.max(0, 1 - oldTownDistance * 1.55);
  }
  if (district === "Civic District") {
    const civicDistance = Math.hypot(center[0] - half * 0.28, center[1] - half * 0.22) / Math.max(1, half);
    return Math.max(0, 1 - civicDistance * 1.45);
  }
  return 0.74;
}

function districtTags(district: DistrictName): string[] {
  switch (district) {
    case "Historic Core": return ["historic", "street-wall", "fine-grain"];
    case "Downtown": return ["mixed-use", "skyline", "podium"];
    case "Civic District": return ["public-space", "landmark", "campus"];
    case "Mixed Residential":
    default: return ["residential", "courtyard", "street-wall"];
  }
}

function edgeMarginsForBlock(raw: Vec2[], ix: number, iy: number, roadById: Map<string, Road>): NonNullable<Block["edgeMargins"]> {
  const uLength = (edgeLength(raw[0], raw[1]) + edgeLength(raw[3], raw[2])) / 2;
  const vLength = (edgeLength(raw[0], raw[3]) + edgeLength(raw[1], raw[2])) / 2;
  return {
    u0: roadMarginFraction(roadById.get(`road-v-${ix}`), uLength),
    u1: roadMarginFraction(roadById.get(`road-v-${ix + 1}`), uLength),
    v0: roadMarginFraction(roadById.get(`road-h-${iy}`), vLength),
    v1: roadMarginFraction(roadById.get(`road-h-${iy + 1}`), vLength)
  };
}

function roadMarginFraction(road: Road | undefined, blockEdgeLength: number): number {
  if (!road || blockEdgeLength <= 1) {
    return 0.055;
  }
  const clearance = road.width * 0.2 + 1.8;
  return Math.max(0.045, Math.min(0.18, clearance / blockEdgeLength));
}

function edgeLength(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function blockIntersectsRoadCorridor(polygon: Vec2[], center: Vec2, road: Road): boolean {
  const threshold = road.width * (road.hierarchy === "pedestrian" ? 0.48 : 0.58);
  if (distanceToPolyline(center, road.polyline) < threshold) {
    return true;
  }
  for (const point of polygon) {
    if (distanceToPolyline(point, road.polyline) < threshold * 0.58) {
      return true;
    }
  }
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (distanceToPolyline(mid, road.polyline) < threshold * 0.45) {
      return true;
    }
  }
  return false;
}

function blockIntersectsWaterway(polygon: Vec2[], center: Vec2, waterway: Waterway, config: CityGeneratorConfig): boolean {
  const setback = profileNumber(config.profileData?.waterways?.waterfrontSetback, 18);
  const centerThreshold = setback + Math.min(22, waterway.width * 0.18);
  if (distanceToWaterway(center, waterway) < centerThreshold) {
    return true;
  }
  for (const point of polygon) {
    if (distanceToWaterway(point, waterway) < setback * 0.62) {
      return true;
    }
  }
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (distanceToWaterway(mid, waterway) < setback * 0.48) {
      return true;
    }
  }
  return false;
}

function patternFor(district: Block["district"], width: number, depth: number, area: number, rng: () => number, config: CityGeneratorConfig, blockId: string): Block["pattern"] {
  const courtyardFrequency = profileNumber(config.profileData?.blocks.courtyardFrequency, 0.28);
  const courtyardProbability = profileNumber(config.profileData?.relationships.courtyardProbability, courtyardFrequency);
  const perimeterBias = profileNumber(config.profileData?.relationships.perimeterBlockBias, courtyardProbability);
  if (config.evaluation?.enabled !== false) {
    const candidates: Candidate<Block["pattern"]>[] = [
      blockPatternCandidate("mixed-use", "Mixed-use infill", "mixed-use", district, width, depth, area, courtyardProbability, perimeterBias, rng()),
      blockPatternCandidate("historic-narrow", "Historic narrow parcel block", "historic-narrow", district, width, depth, area, courtyardProbability, perimeterBias, rng()),
      blockPatternCandidate("perimeter-courtyard", "Perimeter courtyard block", "perimeter-courtyard", district, width, depth, area, courtyardProbability, perimeterBias, rng()),
      blockPatternCandidate("podium-tower", "Podium and tower block", "podium-tower", district, width, depth, area, courtyardProbability, perimeterBias, rng()),
      blockPatternCandidate("standalone-civic", "Standalone civic block", "standalone-civic", district, width, depth, area, courtyardProbability, perimeterBias, rng())
    ];
    const context = {
      stage: "block-subdivision" as const,
      subjectId: blockId,
      config,
      profile: config.profileData,
      district
    };
    const result = selectUrbanCandidate(candidates, context, {
      threshold: config.evaluation?.threshold ?? 0.57,
      weights: {
        "Landmark Quality": 0,
        "Skyline": district === "Downtown" ? 0.45 : 0.12
      }
    });
    return result.candidate.value;
  }
  if (district === "Downtown") {
    const largeBlocks = distributionValue(config.profileData?.blocks.area, 7600) > 10000;
    return rng() < (largeBlocks ? 0.34 : 0.22) ? "podium-tower" : "mixed-use";
  }
  if (district === "Historic Core") {
    return width < 95 || depth < 95 || rng() < 0.58 - perimeterBias * 0.18 ? "historic-narrow" : "perimeter-courtyard";
  }
  if (district === "Civic District") {
    return rng() < 0.42 ? "standalone-civic" : "mixed-use";
  }
  return rng() < 0.24 + Math.max(courtyardProbability, perimeterBias) * 0.78 ? "perimeter-courtyard" : "mixed-use";
}

function blockPatternCandidate(
  id: string,
  label: string,
  pattern: Block["pattern"],
  district: Block["district"],
  width: number,
  depth: number,
  area: number,
  courtyardProbability: number,
  perimeterBias: number,
  variation: number
): Candidate<Block["pattern"]> {
  const aspect = Math.max(width, depth) / Math.max(1, Math.min(width, depth));
  const tags = tagsForPattern(pattern);
  const downtown = district === "Downtown";
  const civic = district === "Civic District";
  const historic = district === "Historic Core";
  let fit = 0.56;
  if (pattern === "historic-narrow") {
    fit = historic ? (width < 110 || depth < 110 ? 0.88 : 0.72) : 0.32;
  } else if (pattern === "perimeter-courtyard") {
    fit = historic || district === "Mixed Residential" ? 0.66 + Math.max(courtyardProbability, perimeterBias) * 0.28 : 0.46;
  } else if (pattern === "podium-tower") {
    fit = downtown && area > 8200 && aspect < 3.4 ? 0.68 : 0.26;
  } else if (pattern === "standalone-civic") {
    fit = civic && area > 3200 ? 0.82 : 0.28;
  } else {
    fit = downtown ? 0.76 : civic ? 0.44 : 0.62;
  }
  return {
    id,
    label,
    value: pattern,
    tags,
    metrics: {
      blockArea: area,
      blockAspectRatio: aspect,
      compactness: Math.max(0.24, Math.min(0.96, 1 / Math.sqrt(aspect))),
      enclosure: pattern === "perimeter-courtyard" || pattern === "historic-narrow" ? 0.84 : pattern === "podium-tower" ? 0.52 : 0.66,
      buildableShare: pattern === "standalone-civic" ? 0.42 : pattern === "podium-tower" ? 0.64 : 0.76,
      courtyardProbability: pattern === "perimeter-courtyard" ? 0.82 : pattern === "historic-narrow" ? 0.42 : 0.18,
      patternFit: fit,
      walkableBlockSize: area < 12000 ? 0.84 : area < 24000 ? 0.62 : 0.38,
      variety: 0.48 + variation * 0.28,
      repetitionPenalty: pattern === "podium-tower" && !downtown ? 0.4 : 0,
      randomnessPenalty: fit < 0.34 ? 0.22 : 0,
      downtownFit: downtown && pattern === "podium-tower" ? 0.82 : downtown ? 0.66 : 0.42
    }
  };
}

function tagsForPattern(pattern: Block["pattern"]): string[] {
  switch (pattern) {
    case "historic-narrow": return ["historic", "fine-grain", "street-wall"];
    case "perimeter-courtyard": return ["courtyard", "residential", "street-wall"];
    case "podium-tower": return ["podium", "skyline", "mixed-use"];
    case "standalone-civic": return ["campus", "public-space", "landmark"];
    case "mixed-use":
    default: return ["mixed-use", "street-wall"];
  }
}

function reserveOpenSpaces(blocks: Block[], config: CityGeneratorConfig, streams: RandomStreams): void {
  const openSpaceRatio = profileNumber(config.profileData?.publicSpace.openSpaceRatio, config.density === "high" ? 0.08 : 0.1);
  const parkFrequency = profileNumber(config.profileData?.publicSpace.parkFrequency, 0.07);
  const totalArea = blocks.reduce((sum, block) => sum + Math.abs(block.area), 0);
  const targetOpenSpaceArea = totalArea * Math.max(0.05, Math.min(0.14, openSpaceRatio));
  const targetOpenSpaceCount = Math.max(2, Math.min(Math.ceil(blocks.length * 0.12), Math.round(blocks.length * openSpaceRatio + parkFrequency * 5)));
  const maxSingleOpenSpaceArea = Math.max(2200, targetOpenSpaceArea * 0.42);

  const near = (target: Vec2, district?: Block["district"]) => blocks
    .filter((block) => !district || block.district === district)
    .sort((a, b) => dist2(a.center, target) - dist2(b.center, target));

  const reserveNear = (target: Vec2, openSpace: NonNullable<Block["openSpace"]>, district?: Block["district"], priority = false) => {
    if (openSpaceCount(blocks) >= targetOpenSpaceCount && openSpaceArea(blocks) >= targetOpenSpaceArea * 0.85) {
      return;
    }
    const candidates = near(target, district).filter((block) => !block.openSpace && !block.landmark && block.area > 1600);
    const preferred = selectOpenSpaceBlock(candidates, target, openSpace, config, priority, maxSingleOpenSpaceArea, targetOpenSpaceArea);
    const fallback = priority && openSpaceCount(blocks) === 0 ? candidates[0] : undefined;
    const block = preferred || fallback;
    if (block) {
      markOpenSpace(block, openSpace);
    }
  };

  reserveNear([-65, -210], "central-park", undefined, true);
  for (const target of [[-300, -120], [330, -230], [-120, 300], [310, 60]] as Vec2[]) {
    reserveNear(target, streams.blocks() < 0.45 ? "plaza" : "neighborhood-park");
  }
  reserveNear([220, 165], "civic-plaza", "Civic District");

  let attempts = 0;
  while ((blocks.filter((block) => block.openSpace).length < targetOpenSpaceCount || openSpaceArea(blocks) < targetOpenSpaceArea * 0.9) && attempts < blocks.length * 4) {
    attempts++;
    const index = Math.floor(streams.blocks() * blocks.length);
    const block = blocks[index];
    if (canReserveOpenSpace(block, blocks, targetOpenSpaceArea, targetOpenSpaceCount, maxSingleOpenSpaceArea)) {
      markOpenSpace(block, "neighborhood-park");
    }
  }
}

function selectOpenSpaceBlock(
  blocks: Block[],
  target: Vec2,
  openSpace: NonNullable<Block["openSpace"]>,
  config: CityGeneratorConfig,
  priority: boolean,
  maxSingleOpenSpaceArea: number,
  targetOpenSpaceArea: number
): Block | undefined {
  const viable = blocks
    .filter((block) => block.area <= maxSingleOpenSpaceArea || (priority && block.area <= targetOpenSpaceArea * 0.75))
    .slice(0, 10);
  if (!viable.length) {
    return undefined;
  }
  const maxDistance = Math.max(1, Math.sqrt(dist2(viable[viable.length - 1].center, target)));
  const candidates: Candidate<Block>[] = viable.map((block) => {
    const distanceScore = 1 - Math.min(1, Math.sqrt(dist2(block.center, target)) / maxDistance);
    const areaFit = openSpace === "central-park"
      ? Math.min(1, block.area / Math.max(1, targetOpenSpaceArea * 0.3))
      : 1 - Math.abs(block.area - Math.min(maxSingleOpenSpaceArea, 4200)) / Math.max(4200, maxSingleOpenSpaceArea);
    return {
      id: block.id,
      label: `${openSpace} ${block.id}`,
      value: block,
      tags: ["public-space", block.district === "Civic District" ? "landmark" : "park"],
      metrics: {
        blockArea: block.area,
        compactness: 0.72,
        visibility: distanceScore,
        accessibility: 0.58 + distanceScore * 0.32,
        publicSpaceRelationship: openSpace.includes("plaza") || block.district === "Civic District" ? 0.82 : 0.68,
        roadRelation: block.district === "Downtown" ? 0.52 : 0.72,
        centrality: distanceScore,
        parkAccess: 0.9,
        patternFit: Math.max(0.42, areaFit),
        variety: 0.66
      }
    };
  });
  const context = {
    stage: "park-placement" as const,
    subjectId: openSpace,
    config,
    profile: config.profileData,
    blocks: viable
  };
  const result = selectUrbanCandidate(candidates, context, {
    threshold: config.evaluation?.threshold ?? 0.56,
    weights: {
      "Skyline": 0,
      "Variety": 0.35
    }
  });
  return result.candidate.value;
}

function canReserveOpenSpace(block: Block, blocks: Block[], targetArea: number, targetCount: number, maxSingleArea: number): boolean {
  if (block.openSpace || block.landmark || block.area <= 1800 || block.district === "Downtown") {
    return false;
  }
  const currentArea = openSpaceArea(blocks);
  const currentCount = openSpaceCount(blocks);
  if (block.area > maxSingleArea && currentCount > 0) {
    return false;
  }
  const projectedArea = currentArea + Math.abs(block.area);
  const minimumCount = Math.min(2, targetCount);
  return projectedArea <= targetArea * 1.22 || currentCount < minimumCount;
}

function openSpaceCount(blocks: Block[]): number {
  return blocks.filter((block) => block.openSpace).length;
}

function openSpaceArea(blocks: Block[]): number {
  return blocks
    .filter((block) => block.openSpace)
    .reduce((sum, block) => sum + Math.abs(block.area), 0);
}

function reserveLandmarks(blocks: Block[], config: CityGeneratorConfig): void {
  const cityHall = selectLandmarkBlock(blocks, [220, 165], "city-hall", config, "Civic District");
  if (cityHall) {
    markLandmark(cityHall, "city-hall");
  }
  const cathedral = selectLandmarkBlock(blocks, [-195, 90], "cathedral", config, "Historic Core");
  if (cathedral) {
    markLandmark(cathedral, "cathedral");
  }
  const museum = selectLandmarkBlock(blocks, [280, 20], "museum", config, "Civic District");
  if (museum) {
    markLandmark(museum, "museum");
  }
}

function selectLandmarkBlock(
  blocks: Block[],
  target: Vec2,
  landmark: NonNullable<Block["landmark"]>,
  config: CityGeneratorConfig,
  district?: Block["district"]
): Block | undefined {
  const viable = blocks
    .filter((block) => !block.openSpace && !block.landmark && (!district || block.district === district))
    .sort((a, b) => dist2(a.center, target) - dist2(b.center, target))
    .slice(0, 10);
  if (!viable.length) {
    return undefined;
  }
  const maxDistance = Math.max(1, Math.sqrt(dist2(viable[viable.length - 1].center, target)));
  const candidates: Candidate<Block>[] = viable.map((block) => {
    const distanceScore = 1 - Math.min(1, Math.sqrt(dist2(block.center, target)) / maxDistance);
    const areaScore = landmark === "cathedral"
      ? block.area > 2400 && block.area < 12000 ? 0.84 : 0.52
      : block.area > 2800 && block.area < 18000 ? 0.82 : 0.5;
    return {
      id: block.id,
      label: `${landmark} ${block.id}`,
      value: block,
      tags: ["landmark", block.district === "Civic District" ? "public-space" : "historic"],
      metrics: {
        blockArea: block.area,
        visibility: 0.48 + distanceScore * 0.38,
        accessibility: 0.54 + distanceScore * 0.36,
        publicSpaceRelationship: block.district === "Civic District" ? 0.82 : 0.62,
        roadRelation: block.pattern === "standalone-civic" || block.pattern === "mixed-use" ? 0.78 : 0.58,
        centrality: distanceScore,
        landmarkProminence: 0.72 + areaScore * 0.18,
        patternFit: areaScore,
        variety: 0.7
      }
    };
  });
  const context = {
    stage: "landmark-placement" as const,
    subjectId: landmark,
    config,
    profile: config.profileData,
    district,
    blocks: viable
  };
  const result = selectUrbanCandidate(candidates, context, {
    threshold: config.evaluation?.threshold ?? 0.58,
    weights: {
      "Skyline": 0.55
    }
  });
  return result.candidate.value;
}

function markOpenSpace(block: Block, openSpace: NonNullable<Block["openSpace"]>): void {
  block.openSpace = openSpace;
  block.metadata.openSpace = openSpace;
  block.metadata.pattern = openSpace;
}

function markLandmark(block: Block, landmark: NonNullable<Block["landmark"]>): void {
  block.landmark = landmark;
  block.metadata.landmark = landmark;
}

function dist2(a: Vec2, b: Vec2): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}
