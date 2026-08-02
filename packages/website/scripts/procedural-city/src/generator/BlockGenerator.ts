import type {Block, CityGeneratorConfig, RandomStreams, Road, RoadNetwork, Vec2, Waterway} from "../types";
import {bbox, clipPolygonToBounds, distanceToPolyline, polygonArea, polygonCentroid, round} from "../geometry/PolygonUtils";
import {assignDistrict} from "./Zoning";
import {distributionValue, profileNumber} from "../profiles/ProfileResolver";
import {distanceToWaterway} from "./WaterwayGenerator";

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
      const district = assignDistrict(center, config.size, streams.roadNoise(center[0] * 0.004, center[1] * 0.004), config.profileData);
      const bounds = bbox(polygon);
      const width = bounds[2] - bounds[0];
      const depth = bounds[3] - bounds[1];
      const edgeMargins = edgeMarginsForBlock(raw, ix, iy, roadById);
      const pattern = patternFor(district, width, depth, streams.blocks, config);
      const id = `block-${String(nextId++).padStart(3, "0")}`;
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
  reserveLandmarks(blocks);
  return blocks;
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

function patternFor(district: Block["district"], width: number, depth: number, rng: () => number, config: CityGeneratorConfig): Block["pattern"] {
  const courtyardFrequency = profileNumber(config.profileData?.blocks.courtyardFrequency, 0.28);
  const courtyardProbability = profileNumber(config.profileData?.relationships.courtyardProbability, courtyardFrequency);
  const perimeterBias = profileNumber(config.profileData?.relationships.perimeterBlockBias, courtyardProbability);
  if (district === "Downtown") {
    const largeBlocks = distributionValue(config.profileData?.blocks.area, 7600) > 10000;
    return rng() < (largeBlocks ? 0.76 : 0.58) ? "podium-tower" : "mixed-use";
  }
  if (district === "Historic Core") {
    return width < 95 || depth < 95 || rng() < 0.58 - perimeterBias * 0.18 ? "historic-narrow" : "perimeter-courtyard";
  }
  if (district === "Civic District") {
    return rng() < 0.42 ? "standalone-civic" : "mixed-use";
  }
  return rng() < 0.24 + Math.max(courtyardProbability, perimeterBias) * 0.78 ? "perimeter-courtyard" : "mixed-use";
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
    const preferred = candidates.find((block) => block.area <= maxSingleOpenSpaceArea || (priority && block.area <= targetOpenSpaceArea * 0.75));
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

function reserveLandmarks(blocks: Block[]): void {
  const cityHall = nearestAvailable(blocks, [220, 165], "Civic District");
  if (cityHall) {
    markLandmark(cityHall, "city-hall");
  }
  const cathedral = nearestAvailable(blocks, [-195, 90], "Historic Core");
  if (cathedral) {
    markLandmark(cathedral, "cathedral");
  }
  const museum = nearestAvailable(blocks, [280, 20], "Civic District");
  if (museum) {
    markLandmark(museum, "museum");
  }
}

function nearestAvailable(blocks: Block[], target: Vec2, district?: Block["district"]): Block | undefined {
  return blocks
    .filter((block) => !block.openSpace && !block.landmark && (!district || block.district === district))
    .sort((a, b) => dist2(a.center, target) - dist2(b.center, target))[0];
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
