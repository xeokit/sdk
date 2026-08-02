import type {CityGeneratorConfig, RandomStreams, Road, RoadHierarchy, RoadNetwork, Vec2} from "../types";
import {landmarkAnchors} from "./Zoning";
import {distance} from "../geometry/PolygonUtils";
import {clampProfileValue, distributionRange, distributionValue, profileNumber} from "../profiles/ProfileResolver";
import {generateWaterways, routeRoadsAroundWaterways} from "./WaterwayGenerator";

export function generateRoadNetwork(config: CityGeneratorConfig, streams: RandomStreams): RoadNetwork {
  const half = config.size / 2;
  const profile = config.profileData;
  const [profileMinStep, profileMaxStep] = distributionRange(profile?.roads.segmentLength, 78, 132);
  const densityBias = clampProfileValue(profileNumber(profile?.relationships.localRoadDensityBias, 1), 0.65, 1.55);
  const hierarchyScale = clampProfileValue(profileNumber(profile?.relationships.roadHierarchyBlockScale, 1), 0.72, 1.38);
  const blockScale = hierarchyScale / Math.sqrt(densityBias);
  const profileBlockArea = distributionValue(profile?.blocks.area, 7600);
  const areaStep = clampProfileValue(Math.sqrt(Math.max(900, profileBlockArea)), 42, 190);
  const segmentMinStep = profileMinStep * blockScale;
  const segmentMaxStep = Math.max(profileMaxStep * blockScale, segmentMinStep + 20);
  const minStep = clampProfileValue(segmentMinStep * 0.55 + areaStep * 0.72 * 0.45, 42, 165);
  const maxStep = clampProfileValue(Math.max(segmentMaxStep * 0.55 + areaStep * 1.38 * 0.45, minStep + 20), minStep + 18, 240);
  const orientationRadians = 0;
  const irregularity = clampProfileValue(
    profileNumber(profile?.relationships.streetIrregularity, 0.58) * 0.34
      + distributionValue(profile?.blocks.irregularity, 0.35) * 0.16,
    0,
    0.42
  );
  const xCoords = createStreetCoords(config.size, minStep, maxStep, streams.roads);
  const yCoords = createStreetCoords(config.size, minStep * 0.92, maxStep * 0.95, streams.roads);
  const gridPoints: Vec2[][] = [];
  for (let ix = 0; ix < xCoords.length; ix++) {
    gridPoints[ix] = [];
    for (let iy = 0; iy < yCoords.length; iy++) {
      gridPoints[ix][iy] = jitterPoint(xCoords[ix], yCoords[iy], half, streams, irregularity);
    }
  }

  const roads: Road[] = [];
  const arterialSpacing = distributionValue(profile?.roads.arterialSpacing, 360);
  const verticalArterials = arterialIndices(xCoords.length, config.size, arterialSpacing);
  const horizontalArterials = arterialIndices(yCoords.length, config.size, arterialSpacing);

  for (let ix = 0; ix < xCoords.length; ix++) {
    const hierarchy = roadHierarchy(ix, xCoords.length, verticalArterials, profile);
    roads.push({
      id: `road-v-${ix}`,
      name: `${nameForHierarchy(hierarchy)} ${ix + 1}`,
      hierarchy,
      width: widthForHierarchy(hierarchy, config),
      polyline: yCoords.map((_y, iy) => gridPoints[ix][iy])
    });
  }

  for (let iy = 0; iy < yCoords.length; iy++) {
    const hierarchy = roadHierarchy(iy, yCoords.length, horizontalArterials, profile);
    roads.push({
      id: `road-h-${iy}`,
      name: `${nameForHierarchy(hierarchy)} ${iy + 1}`,
      hierarchy,
      width: widthForHierarchy(hierarchy, config),
      polyline: xCoords.map((_x, ix) => gridPoints[ix][iy])
    });
  }

  const diagonalRoads = createDiagonalRoads(config.size, streams, irregularity, config, orientationRadians);
  roads.push(...diagonalRoads);
  roads.push(...createRadialRoads(config.size, streams, config, orientationRadians));
  roads.push(...createPedestrianStreets(config.size, config, orientationRadians));
  const waterways = generateWaterways(config, roads, streams);
  const routedRoads = routeRoadsAroundWaterways(config, roads, waterways);

  return {
    roads: routedRoads,
    xCoords,
    yCoords,
    gridPoints,
    diagonalRoads,
    landmarkAnchors: landmarkAnchors(),
    waterways
  };
}

function createStreetCoords(size: number, minStep: number, maxStep: number, rng: () => number): number[] {
  const half = size / 2;
  const coords = [-half];
  let cursor = -half;
  while (cursor < half - minStep * 1.2) {
    const centerBias = 1 - Math.min(1, Math.abs(cursor) / half);
    const step = minStep + (maxStep - minStep) * rng() - centerBias * 18;
    cursor += Math.max(minStep * 0.72, step);
    if (cursor < half - minStep * 0.6) {
      coords.push(cursor);
    }
  }
  coords.push(half);
  return coords;
}

function jitterPoint(x: number, y: number, half: number, streams: RandomStreams, irregularity: number): Vec2 {
  const border = Math.abs(x) > half - 1 || Math.abs(y) > half - 1;
  if (border) {
    return [x, y];
  }
  const n = streams.roadNoise(x * 0.003, y * 0.003);
  const n2 = streams.roadNoise((x + 791) * 0.003, (y - 353) * 0.003);
  return [x + n * (2.5 + irregularity * 6), y + n2 * (2.5 + irregularity * 5.5)];
}

function arterialIndices(count: number, size: number, spacing: number): Set<number> {
  const result = new Set<number>();
  const target = Math.max(1, Math.min(4, Math.round(size / Math.max(120, spacing))));
  for (let i = 1; i <= target; i++) {
    result.add(Math.floor((i / (target + 1)) * count));
  }
  return result;
}

function roadHierarchy(index: number, count: number, arterials: Set<number>, profile: CityGeneratorConfig["profileData"]): RoadHierarchy {
  if (index === 0 || index === count - 1) {
    return "collector";
  }
  if (arterials.has(index)) {
    return "arterial";
  }
  const shares = profile?.roads.hierarchyShare || {};
  const pedestrianShare = clampProfileValue((shares.pedestrian ?? 0.03) * profileNumber(profile?.relationships.pedestrianStreetBias, 1), 0.01, 0.16);
  const alleyShare = shares.alley ?? 0.09;
  const collectorShare = shares.collector ?? 0.25;
  const t = ((index * 37) % 100) / 100;
  if (t < pedestrianShare) {
    return "pedestrian";
  }
  if (t < pedestrianShare + alleyShare) {
    return "alley";
  }
  if (t < pedestrianShare + alleyShare + collectorShare) {
    return "collector";
  }
  return "local";
}

function widthForHierarchy(hierarchy: RoadHierarchy, config: CityGeneratorConfig): number {
  const profileWidth = config.profileData?.roads.widthByHierarchy?.[hierarchy];
  if (Number.isFinite(profileWidth)) {
    return Number(profileWidth);
  }
  switch (hierarchy) {
    case "arterial": return 28;
    case "collector": return 19;
    case "pedestrian": return 10;
    case "alley": return 6.5;
    case "local":
    default: return 12;
  }
}

function nameForHierarchy(hierarchy: RoadHierarchy): string {
  switch (hierarchy) {
    case "arterial": return "Avenue";
    case "collector": return "Boulevard";
    case "alley": return "Lane";
    case "pedestrian": return "Walk";
    case "local":
    default: return "Street";
  }
}

function createDiagonalRoads(size: number, streams: RandomStreams, irregularity: number, config: CityGeneratorConfig, orientationRadians: number): Road[] {
  const half = size / 2;
  const bend = 12 + irregularity * 32;
  const roadA: Road = {
    id: "road-diagonal-market",
    name: "Market Diagonal",
    hierarchy: "collector",
    width: widthForHierarchy("collector", config) * 0.92,
    polyline: rotatePolyline([
      [-half * 0.86, -half * 0.55],
      [-half * 0.35, -half * 0.15 + streams.roads() * bend],
      [half * 0.12, half * 0.05],
      [half * 0.76, half * 0.48]
    ], orientationRadians)
  };
  const roadB: Road = {
    id: "road-diagonal-riverside",
    name: "Riverside Cut",
    hierarchy: "local",
    width: widthForHierarchy("local", config) * 0.92,
    polyline: rotatePolyline([
      [-half * 0.72, half * 0.34],
      [-half * 0.25, half * 0.23],
      [half * 0.28, -half * 0.02],
      [half * 0.82, -half * 0.26]
    ], orientationRadians)
  };
  return [roadA, roadB];
}

function createRadialRoads(size: number, streams: RandomStreams, config: CityGeneratorConfig, orientationRadians: number): Road[] {
  const half = size / 2;
  const [historic, civic] = landmarkAnchors();
  const roads: Road[] = [];
  const radialCount = radialRoadCount(config);
  for (const [anchorIndex, anchor] of [historic, civic].entries()) {
    const rotatedAnchor = rotatePoint(anchor, orientationRadians);
    for (let i = 0; i < radialCount; i++) {
      const angle = (i / radialCount) * Math.PI * 2 + anchorIndex * 0.22 + streams.roads() * 0.08 + orientationRadians;
      const end: Vec2 = [
        Math.max(-half, Math.min(half, rotatedAnchor[0] + Math.cos(angle) * half * 0.92)),
        Math.max(-half, Math.min(half, rotatedAnchor[1] + Math.sin(angle) * half * 0.92))
      ];
      if (distance(rotatedAnchor, end) < half * 0.25) {
        continue;
      }
      roads.push({
        id: `road-radial-${anchorIndex}-${i}`,
        name: anchorIndex === 0 ? `Cathedral Radial ${i + 1}` : `Civic Radial ${i + 1}`,
        hierarchy: i === 0 ? "collector" : "local",
        width: i === 0 ? widthForHierarchy("collector", config) * 0.9 : widthForHierarchy("local", config) * 0.85,
        polyline: [rotatedAnchor, end],
        pedestrianPriority: i === 2
      });
    }
  }
  return roads;
}

function createPedestrianStreets(size: number, config: CityGeneratorConfig, orientationRadians: number): Road[] {
  const half = size / 2;
  const width = widthForHierarchy("pedestrian", config);
  const roads: Road[] = [
    {
      id: "road-pedestrian-old-town",
      name: "Old Town Walk",
      hierarchy: "pedestrian",
      width,
      pedestrianPriority: true,
      polyline: rotatePolyline([[-half * 0.42, half * 0.04], [-half * 0.22, half * 0.16], [-half * 0.06, half * 0.13]], orientationRadians)
    },
    {
      id: "road-pedestrian-civic",
      name: "Civic Promenade",
      hierarchy: "pedestrian",
      width: width * 1.2,
      pedestrianPriority: true,
      polyline: rotatePolyline([[half * 0.24, half * 0.22], [half * 0.44, half * 0.32], [half * 0.62, half * 0.28]], orientationRadians)
    }
  ];
  const pedestrianBias = profileNumber(config.profileData?.relationships.pedestrianStreetBias, 1);
  const pedestrianShare = config.profileData?.roads.hierarchyShare?.pedestrian ?? 0.03;
  const extraCount = Math.max(0, Math.min(4, Math.round((pedestrianBias - 0.8) * 2.5 + pedestrianShare * 18)));
  for (let i = 0; i < extraCount; i++) {
    const y = -half * 0.18 + i * half * 0.14;
    const x0 = -half * (0.35 - i * 0.035);
    roads.push({
      id: `road-pedestrian-market-${i}`,
      name: `Market Walk ${i + 1}`,
      hierarchy: "pedestrian",
      width: width * (0.88 + i * 0.04),
      pedestrianPriority: true,
      polyline: rotatePolyline([[x0, y], [x0 + half * 0.16, y + half * 0.035], [x0 + half * 0.34, y + half * 0.012]], orientationRadians)
    });
  }
  return roads;
}

function radialRoadCount(config: CityGeneratorConfig): number {
  const weights = config.profileData?.roads.intersectionDegreeWeights || {};
  const branching = Number(weights["5"] || 0) + Number(weights["6"] || 0);
  return Math.max(3, Math.min(7, Math.round(4 + branching * 8)));
}

function rotatePolyline(points: Vec2[], radians: number): Vec2[] {
  return points.map((point) => rotatePoint(point, radians));
}

function rotatePoint(point: Vec2, radians: number): Vec2 {
  if (Math.abs(radians) < 1e-6) {
    return point;
  }
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [point[0] * c - point[1] * s, point[0] * s + point[1] * c];
}
