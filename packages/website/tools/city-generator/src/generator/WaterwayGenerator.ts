import type {BridgeCrossing, CityGeneratorConfig, CityObject, RandomStreams, Road, Vec2, Vec3, Waterway} from "../types";
import {distance, distanceToPolyline, lerp2, round, samplePolyline, segmentLength} from "../geometry/PolygonUtils";
import {distributionValue, profileNumber} from "../profiles/ProfileResolver";
import {extrudePolygon} from "../geometry/Extrusion";
import {MeshBuilder} from "../geometry/MeshBuilder";

interface WaterfrontConnection {
  waterwayId: string;
  side: -1 | 1;
  station: number;
  point: Vec2;
  sourceRoadId: string;
}

interface WaterCorridorCrossing {
  waterway: Waterway;
  entryCenter: Vec2;
  exitCenter: Vec2;
  entryT: number;
  exitT: number;
  beforeSide: -1 | 1;
  afterSide: -1 | 1;
}

const WATER_SURFACE_Z = -0.62;
const CHANNEL_FLOOR_Z = -0.78;
const BANK_TOP_Z = 0.075;
const WALL_CAP_Z = 0.095;
const QUAY_Z = 0.105;

export function generateWaterways(config: CityGeneratorConfig, roads: Road[], streams: RandomStreams): Waterway[] {
  const waterConfig = config.profileData?.waterways;
  const profileName = config.profileData?.name.toLowerCase() || "";
  if (!waterConfig?.enabled && !profileName.includes("chicago")) {
    return [];
  }
  const half = config.size / 2;
  const style = waterConfig?.style || (profileName.includes("chicago") ? "chicago-river" : "river");
  const mainWidth = distributionValue(waterConfig?.width, 76);
  const branchWidth = distributionValue(waterConfig?.branchWidth, mainWidth * 0.72);
  const waterways = style === "thames"
    ? [
      createWaterway("waterway-river-thames", "River Thames", "thames", mainWidth, createThamesRiver(half, streams))
    ]
    : [
      createWaterway("waterway-main-river", "Main River", style, mainWidth, createMainRiver(half, streams)),
      createWaterway("waterway-north-branch", "North Branch", style, branchWidth, createNorthBranch(half, streams))
    ];
  const spacing = distributionValue(waterConfig?.bridgeSpacing, 185);
  for (const waterway of waterways) {
    waterway.bridgeCrossings = selectBridgeCrossings(roads, waterway, spacing);
    waterway.metadata.bridgeCount = waterway.bridgeCrossings.length;
  }
  return waterways;
}

export function routeRoadsAroundWaterways(config: CityGeneratorConfig, roads: Road[], waterways: Waterway[]): Road[] {
  if (!waterways.length) {
    return roads;
  }
  const connections: WaterfrontConnection[] = [];
  const routedRoads = roads.flatMap((road) => routeRoadAroundWaterways(config, road, waterways, connections));
  return [
    ...routedRoads,
    ...createWaterfrontRoads(config, waterways, connections)
  ];
}

export function generateWaterwayObjects(waterways: Waterway[], streams: RandomStreams): CityObject[] {
  if (!waterways.length) {
    return [];
  }
  const waterMeshes = waterways.map((waterway) => extrudePolygon({
    id: `${waterway.id}-surface`,
    polygon: waterway.polygon,
    height: 0.02,
    baseZ: WATER_SURFACE_Z - 0.012,
    materialId: "water"
  }));
  const channelMeshes = waterways.map((waterway) => extrudePolygon({
    id: `${waterway.id}-channel-floor`,
    polygon: waterway.polygon,
    height: 0.025,
    baseZ: CHANNEL_FLOOR_Z,
    materialId: "channel-floor"
  }));

  const quays = new MeshBuilder();
  const bankWalls = new MeshBuilder();
  const bankCaps = new MeshBuilder();
  const riverwalkTrunks = new MeshBuilder();
  const riverwalkCrowns = new MeshBuilder();
  const riverwalkFurniture = new MeshBuilder();
  let treeCount = 0;
  let furnitureCount = 0;
  for (const waterway of waterways) {
    addBankWalls(bankWalls, bankCaps, waterway);
    addQuays(quays, waterway);
    for (const sample of samplePolyline(waterway.polyline, 38)) {
      const normal: Vec2 = [-sample.tangent[1], sample.tangent[0]];
      for (const side of [-1, 1]) {
        const point: Vec2 = [
          sample.point[0] + normal[0] * side * (waterway.width * 0.5 + 11),
          sample.point[1] + normal[1] * side * (waterway.width * 0.5 + 11)
        ];
        if (streams.vegetation() < 0.52 && !nearBridge(point, waterways)) {
          addRiverwalkTree(riverwalkTrunks, riverwalkCrowns, point, 6.5 + streams.vegetation() * 4.2);
          treeCount++;
        }
        if (streams.furniture() < 0.38 && !nearBridge(point, waterways)) {
          riverwalkFurniture.addBox([point[0], point[1], 0.45], [2.4, 0.55, 0.42], Math.atan2(sample.tangent[1], sample.tangent[0]));
          furnitureCount++;
        }
      }
    }
  }

  const bridgeDecks = new MeshBuilder();
  const bridgeRoads = new MeshBuilder();
  const bridgeRails = new MeshBuilder();
  let bridgeCount = 0;
  for (const waterway of waterways) {
    for (const crossing of waterway.bridgeCrossings) {
      addBridge(bridgeDecks, bridgeRoads, bridgeRails, waterway, crossing);
      bridgeCount++;
    }
  }

  return [
    {
      id: "city-waterways",
      name: "City waterways",
      type: "Waterway",
      layerId: "water",
      meshes: [
        ...channelMeshes,
        ...waterMeshes
      ],
      metadata: {
        id: "city-waterways",
        type: "Waterway",
        waterwayCount: waterways.length,
        waterways: waterways.map((waterway) => waterway.metadata)
      }
    },
    {
      id: "riverwalks",
      name: "Riverwalks and embankments",
      type: "Riverwalk",
      layerId: "water",
      meshes: [
        bankWalls.toMesh("river-wall", "river-bank-retaining-walls"),
        bankCaps.toMesh("concrete", "river-bank-wall-caps"),
        quays.toMesh("paving-stone", "riverwalk-quays")
      ],
      metadata: {
        id: "riverwalks",
        type: "Riverwalk",
        treeCount,
        furnitureCount,
        lodRole: "regular"
      }
    },
    {
      id: "riverwalk-details",
      name: "Riverwalk trees and furniture",
      type: "RiverwalkDetail",
      layerId: "water",
      meshes: [
        riverwalkTrunks.toMesh("tree-trunk", "riverwalk-tree-trunks"),
        riverwalkCrowns.toMesh("tree-canopy", "riverwalk-tree-canopies"),
        riverwalkFurniture.toMesh("street-furniture", "riverwalk-furniture")
      ],
      metadata: {
        id: "riverwalk-details",
        type: "RiverwalkDetail",
        parentId: "riverwalks",
        treeCount,
        furnitureCount,
        lodRole: "detail"
      }
    },
    {
      id: "river-bridges",
      name: "River bridges",
      type: "BridgeSet",
      layerId: "roads",
      meshes: [
        bridgeDecks.toMesh("asphalt", "bridge-decks"),
        bridgeRoads.toMesh("asphalt", "bridge-road-surfaces"),
        bridgeRails.toMesh("steel", "bridge-rails")
      ],
      metadata: {
        id: "river-bridges",
        type: "BridgeSet",
        bridgeCount,
        bridges: waterways.flatMap((waterway) => waterway.bridgeCrossings.map((crossing) => ({
          id: crossing.id,
          roadId: crossing.roadId,
          waterwayId: waterway.id,
          hierarchy: crossing.hierarchy,
          point: crossing.point.map((value) => round(value, 2))
        })))
      }
    }
  ];
}

function createMainRiver(half: number, streams: RandomStreams): Vec2[] {
  const bend = half * 0.045;
  return [
    [-half * 1.08, -half * 0.06],
    [-half * 0.70, -half * 0.03 + streams.waterNoise(-2, 1) * bend],
    [-half * 0.34, half * 0.02 + streams.waterways() * bend],
    [0, -half * 0.005],
    [half * 0.34, half * 0.055 + streams.waterways() * bend],
    [half * 0.72, half * 0.035 + streams.waterNoise(3, -1) * bend],
    [half * 1.08, half * 0.07]
  ];
}

function createNorthBranch(half: number, streams: RandomStreams): Vec2[] {
  const bend = half * 0.05;
  return [
    [-half * 0.18, half * 1.06],
    [-half * 0.13 + streams.waterNoise(0, 4) * bend, half * 0.70],
    [-half * 0.06, half * 0.42 + streams.waterways() * bend],
    [-half * 0.02, half * 0.22],
    [-half * 0.01, half * 0.02]
  ];
}

function createThamesRiver(half: number, streams: RandomStreams): Vec2[] {
  const bend = half * 0.085;
  return [
    [-half * 1.08, -half * 0.18],
    [-half * 0.84, -half * 0.12 + streams.waterNoise(-4, 1) * bend],
    [-half * 0.58, half * 0.02 + streams.waterways() * bend * 0.55],
    [-half * 0.33, half * 0.12 + streams.waterNoise(-1, 2) * bend],
    [-half * 0.08, half * 0.05],
    [half * 0.18, -half * 0.09 + streams.waterways() * bend * 0.45],
    [half * 0.46, -half * 0.13 + streams.waterNoise(2, -2) * bend],
    [half * 0.74, -half * 0.03],
    [half * 1.08, half * 0.10 + streams.waterNoise(4, 1) * bend]
  ];
}

function createWaterway(id: string, name: string, style: Waterway["style"], width: number, polyline: Vec2[]): Waterway {
  const polygon = bufferedPolylinePolygon(polyline, width);
  return {
    id,
    name,
    style,
    width,
    polyline,
    polygon,
    bridgeCrossings: [],
    metadata: {
        id,
        type: "Waterway",
        name,
        style,
        width: round(width, 1),
        length: round(segmentLength(polyline), 1),
        waterSurfaceZ: WATER_SURFACE_Z,
        bankTopZ: BANK_TOP_Z
      }
  };
}

function bufferedPolylinePolygon(polyline: Vec2[], width: number): Vec2[] {
  const half = width / 2;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < polyline.length; i++) {
    const tangent = vertexTangent(polyline, i);
    const normal: Vec2 = [-tangent[1], tangent[0]];
    left.push([polyline[i][0] + normal[0] * half, polyline[i][1] + normal[1] * half]);
    right.push([polyline[i][0] - normal[0] * half, polyline[i][1] - normal[1] * half]);
  }
  return [...left, ...right.reverse()];
}

function vertexTangent(polyline: Vec2[], index: number): Vec2 {
  const prev = polyline[Math.max(0, index - 1)];
  const next = polyline[Math.min(polyline.length - 1, index + 1)];
  const dx = next[0] - prev[0];
  const dy = next[1] - prev[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function selectBridgeCrossings(roads: Road[], waterway: Waterway, spacing: number): BridgeCrossing[] {
  const crossings = findRoadCrossings(roads, waterway)
    .filter((crossing) => {
      const angle = Number(crossing.metadata?.crossingAngleDegrees || 0);
      const before = Number(crossing.metadata?.approachLengthBefore || 0);
      const after = Number(crossing.metadata?.approachLengthAfter || 0);
      const stationRatio = waterwayStation(waterway, crossing.point) / Math.max(1, segmentLength(waterway.polyline));
      return (crossing.hierarchy === "arterial" || crossing.hierarchy === "collector")
        && angle > 48
        && before > waterway.width * 0.9
        && after > waterway.width * 0.9
        && stationRatio > 0.08
        && stationRatio < 0.92;
    })
    .sort((a, b) => {
      const stationDelta = waterwayStation(waterway, a.point) - waterwayStation(waterway, b.point);
      if (Math.abs(stationDelta) < spacing * 0.2) {
        return bridgePriority(a, waterway) - bridgePriority(b, waterway);
      }
      return stationDelta;
    });
  const selected: BridgeCrossing[] = [];
  for (const crossing of crossings) {
    const station = waterwayStation(waterway, crossing.point);
    const minGap = crossing.hierarchy === "arterial" ? spacing * 0.82 : spacing * 1.12;
    const tooClose = selected.some((candidate) => Math.abs(waterwayStation(waterway, candidate.point) - station) < minGap);
    if (!tooClose) {
      selected.push(crossing);
    }
  }
  return selected.slice(0, waterway.id.includes("branch") ? 4 : 7);
}

function findRoadCrossings(roads: Road[], waterway: Waterway): BridgeCrossing[] {
  const crossings: BridgeCrossing[] = [];
  const seenRoads = new Set<string>();
  for (const road of roads) {
    if (road.hierarchy === "alley" || road.hierarchy === "pedestrian") {
      continue;
    }
    for (let i = 1; i < road.polyline.length; i++) {
      const a = road.polyline[i - 1];
      const b = road.polyline[i];
      for (let j = 1; j < waterway.polyline.length; j++) {
        const point = segmentIntersection(a, b, waterway.polyline[j - 1], waterway.polyline[j]);
        if (!point || seenRoads.has(`${road.id}:${waterway.id}`)) {
          continue;
        }
        const len = distance(a, b) || 1;
        const tangent: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        const waterTangent = waterwayTangentAt(waterway, point);
        const crossingAngleDegrees = Math.asin(Math.min(1, Math.abs(cross(tangent, waterTangent)))) * 180 / Math.PI;
        const approachLengths = roadApproachLengths(road, i - 1, distance(a, point));
        crossings.push({
          id: `bridge-${waterway.id}-${road.id}`,
          roadId: road.id,
          roadName: road.name,
          hierarchy: road.hierarchy,
          point,
          tangent,
          roadWidth: road.width,
          waterwayId: waterway.id,
          metadata: {
            crossingAngleDegrees: round(crossingAngleDegrees, 1),
            approachLengthBefore: round(approachLengths.before, 1),
            approachLengthAfter: round(approachLengths.after, 1)
          }
        });
        seenRoads.add(`${road.id}:${waterway.id}`);
      }
    }
  }
  return crossings;
}

function bridgePriority(crossing: BridgeCrossing, waterway: Waterway): number {
  const hierarchyScore = crossing.hierarchy === "arterial" ? 0 : 70;
  const anglePenalty = 90 - Number(crossing.metadata?.crossingAngleDegrees || 0);
  const approachPenalty = -Math.min(Number(crossing.metadata?.approachLengthBefore || 0), Number(crossing.metadata?.approachLengthAfter || 0)) * 0.01;
  const centerPenalty = Math.abs(waterwayStation(waterway, crossing.point) / Math.max(1, segmentLength(waterway.polyline)) - 0.5) * 8;
  return hierarchyScore + anglePenalty + approachPenalty + centerPenalty;
}

function roadApproachLengths(road: Road, segmentIndex: number, distanceOnSegment: number): {before: number; after: number} {
  let before = distanceOnSegment;
  for (let i = 0; i < segmentIndex; i++) {
    before += distance(road.polyline[i], road.polyline[i + 1]);
  }
  let after = Math.max(0, distance(road.polyline[segmentIndex], road.polyline[segmentIndex + 1]) - distanceOnSegment);
  for (let i = segmentIndex + 1; i < road.polyline.length - 1; i++) {
    after += distance(road.polyline[i], road.polyline[i + 1]);
  }
  return {before, after};
}

function waterwayTangentAt(waterway: Waterway, point: Vec2): Vec2 {
  let best = Number.POSITIVE_INFINITY;
  let bestTangent: Vec2 = [1, 0];
  for (let i = 1; i < waterway.polyline.length; i++) {
    const a = waterway.polyline[i - 1];
    const b = waterway.polyline[i];
    const projection = closestSegmentProjection(point, a, b);
    const d = distance(point, projection.point);
    if (d < best) {
      const len = distance(a, b) || 1;
      best = d;
      bestTangent = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    }
  }
  return bestTangent;
}

function routeRoadAroundWaterways(config: CityGeneratorConfig, road: Road, waterways: Waterway[], connections: WaterfrontConnection[]): Road[] {
  if (road.hierarchy === "pedestrian" || road.hierarchy === "alley") {
    return splitRoadAroundUnbridgedWaterways(config, road, waterways, connections);
  }
  return splitRoadAroundUnbridgedWaterways(config, road, waterways, connections);
}

function splitRoadAroundUnbridgedWaterways(config: CityGeneratorConfig, road: Road, waterways: Waterway[], connections: WaterfrontConnection[]): Road[] {
  let piece: Vec2[] = [road.polyline[0]];
  const pieces: Vec2[][] = [];
  let detourCount = 0;
  for (let i = 1; i < road.polyline.length; i++) {
    const b = road.polyline[i];
    let segmentStart = piece[piece.length - 1] || road.polyline[i - 1];
    let guard = 0;
    while (guard++ < 6) {
      const crossing = firstUnbridgedWaterCorridorCrossing(segmentStart, b, road, waterways);
      if (!crossing) {
        if (distance(piece[piece.length - 1], b) > 0.5) {
          piece.push(b);
        }
        break;
      }
      detourCount++;
      const beforeBank = bankRoadPoint(crossing.waterway, crossing.entryCenter, crossing.beforeSide, bankRoadOffset(config, crossing.waterway));
      const afterBank = bankRoadPoint(crossing.waterway, crossing.exitCenter, crossing.afterSide, bankRoadOffset(config, crossing.waterway));
      if (distance(piece[piece.length - 1], beforeBank) > 0.5) {
        piece.push(beforeBank);
      }
      pushPiece(pieces, piece);
      registerWaterfrontConnection(connections, crossing.waterway, crossing.beforeSide, waterwayStation(crossing.waterway, crossing.entryCenter), beforeBank, road.id);
      registerWaterfrontConnection(connections, crossing.waterway, crossing.afterSide, waterwayStation(crossing.waterway, crossing.exitCenter), afterBank, road.id);
      piece = [afterBank];
      segmentStart = afterBank;
      if (distance(segmentStart, b) < 4) {
        piece.push(b);
        break;
      }
    }
  }
  pushPiece(pieces, piece);
  if (!detourCount) {
    registerBridgeConnections(config, road, waterways, connections);
    if (roadHasAnyBridge(road, waterways)) {
      return [road];
    }
    const avoided = avoidWaterCorridors(config, road.polyline, road, waterways);
    if (polylineChanged(road.polyline, avoided)) {
      return [{
        ...road,
        polyline: avoided,
        routedAroundWater: true
      }];
    }
    return [road];
  }
  return pieces.map((polyline, index) => ({
    ...road,
    id: index === 0 ? road.id : `${road.id}-bank-${index + 1}`,
    name: index === 0 ? road.name : `${road.name} Waterfront Approach ${index + 1}`,
    polyline: avoidWaterCorridors(config, polyline, road, waterways),
    routedAroundWater: true
  })).filter((routed) => segmentLength(routed.polyline) > Math.max(18, road.width * 2.2));
}

function roadHasAnyBridge(road: Road, waterways: Waterway[]): boolean {
  return waterways.some((waterway) => waterway.bridgeCrossings.some((crossing) => crossing.roadId === road.id));
}

function avoidWaterCorridors(config: CityGeneratorConfig, polyline: Vec2[], road: Road, waterways: Waterway[]): Vec2[] {
  if (!waterways.length || road.id.startsWith("road-waterfront")) {
    return polyline;
  }
  const result: Vec2[] = [pushPointAwayFromWater(config, polyline[0], road, waterways)];
  for (let i = 1; i < polyline.length; i++) {
    const previous = polyline[i - 1];
    const current = polyline[i];
    const midpoint = lerp2(previous, current, 0.5);
    const pushedMidpoint = pushPointAwayFromWater(config, midpoint, road, waterways);
    if (distance(midpoint, pushedMidpoint) > 1.5) {
      result.push(pushedMidpoint);
    }
    result.push(pushPointAwayFromWater(config, current, road, waterways));
  }
  return dedupePolyline(result);
}

function pushPointAwayFromWater(config: CityGeneratorConfig, point: Vec2, road: Road, waterways: Waterway[]): Vec2 {
  let pushed = point;
  for (const waterway of waterways) {
    const projection = closestWaterwayProjection(waterway, pushed);
    const dx = pushed[0] - projection.point[0];
    const dy = pushed[1] - projection.point[1];
    const len = Math.hypot(dx, dy) || 1;
    const clearance = bankRoadOffset(config, waterway) + road.width * 0.45;
    const distanceFromCenter = Math.hypot(dx, dy);
    if (distanceFromCenter < clearance) {
      pushed = [
        projection.point[0] + (dx / len) * clearance,
        projection.point[1] + (dy / len) * clearance
      ];
    }
  }
  return pushed;
}

function closestWaterwayProjection(waterway: Waterway, point: Vec2): {point: Vec2; station: number} {
  let station = 0;
  let best = Number.POSITIVE_INFINITY;
  let bestPoint = waterway.polyline[0];
  let bestStation = 0;
  for (let i = 1; i < waterway.polyline.length; i++) {
    const a = waterway.polyline[i - 1];
    const b = waterway.polyline[i];
    const len = distance(a, b);
    const projection = closestSegmentProjection(point, a, b);
    const d = distance(point, projection.point);
    if (d < best) {
      best = d;
      bestPoint = projection.point;
      bestStation = station + len * projection.t;
    }
    station += len;
  }
  return {point: bestPoint, station: bestStation};
}

function polylineChanged(a: Vec2[], b: Vec2[]): boolean {
  if (a.length !== b.length) {
    return true;
  }
  for (let i = 0; i < a.length; i++) {
    if (distance(a[i], b[i]) > 0.5) {
      return true;
    }
  }
  return false;
}

function pushPiece(pieces: Vec2[][], piece: Vec2[]): void {
  const deduped = dedupePolyline(piece);
  if (deduped.length > 1 && segmentLength(deduped) > 4) {
    pieces.push(deduped);
  }
}

function dedupePolyline(polyline: Vec2[]): Vec2[] {
  const result: Vec2[] = [];
  for (const point of polyline) {
    const previous = result[result.length - 1];
    if (!previous || distance(previous, point) > 0.5) {
      result.push(point);
    }
  }
  return result;
}

function firstUnbridgedWaterCorridorCrossing(a: Vec2, b: Vec2, road: Road, waterways: Waterway[]): WaterCorridorCrossing | null {
  let best: WaterCorridorCrossing | null = null;
  for (const waterway of waterways) {
    if (waterway.bridgeCrossings.some((crossing) => crossing.roadId === road.id)) {
      continue;
    }
    const interval = waterCorridorInterval(a, b, road, waterway);
    if (!interval) {
      continue;
    }
    const entryPoint = lerp2(a, b, interval.entryT);
    const exitPoint = lerp2(a, b, interval.exitT);
    const entryCenter = closestWaterwayProjection(waterway, entryPoint).point;
    const exitCenter = closestWaterwayProjection(waterway, exitPoint).point;
    const beforeProbe = lerp2(a, b, Math.max(0, interval.entryT - 0.02));
    const afterProbe = lerp2(a, b, Math.min(1, interval.exitT + 0.02));
    const crossing: WaterCorridorCrossing = {
      waterway,
      entryCenter,
      exitCenter,
      entryT: interval.entryT,
      exitT: interval.exitT,
      beforeSide: sideForPoint(beforeProbe, waterway, entryCenter),
      afterSide: sideForPoint(afterProbe, waterway, exitCenter)
    };
    if (!best || crossing.entryT < best.entryT) {
      best = crossing;
    }
  }
  return best;
}

function waterCorridorInterval(a: Vec2, b: Vec2, road: Road, waterway: Waterway): {entryT: number; exitT: number} | null {
  const len = distance(a, b);
  if (len < 0.001) {
    return null;
  }
  const clearance = waterCorridorClearance(road);
  const steps = Math.max(8, Math.ceil(len / 4));
  let previousT = 0;
  let previousBlocked = roadCenterOverlapsWaterCorridor(a, waterway, clearance);
  let entryT: number | null = previousBlocked ? 0 : null;
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const blocked = roadCenterOverlapsWaterCorridor(lerp2(a, b, t), waterway, clearance);
    if (!previousBlocked && blocked) {
      entryT = refineWaterCorridorBoundary(a, b, waterway, clearance, previousT, t);
    } else if (previousBlocked && !blocked && entryT !== null) {
      const exitT = refineWaterCorridorBoundary(a, b, waterway, clearance, previousT, t);
      if (exitT - entryT > 0.006) {
        return {entryT, exitT};
      }
      entryT = null;
    }
    previousT = t;
    previousBlocked = blocked;
  }
  if (previousBlocked && entryT !== null && 1 - entryT > 0.006) {
    return {entryT, exitT: 1};
  }
  return null;
}

function refineWaterCorridorBoundary(a: Vec2, b: Vec2, waterway: Waterway, clearance: number, t0: number, t1: number): number {
  let low = t0;
  let high = t1;
  const lowBlocked = roadCenterOverlapsWaterCorridor(lerp2(a, b, low), waterway, clearance);
  for (let i = 0; i < 9; i++) {
    const mid = (low + high) / 2;
    const midBlocked = roadCenterOverlapsWaterCorridor(lerp2(a, b, mid), waterway, clearance);
    if (midBlocked === lowBlocked) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function roadCenterOverlapsWaterCorridor(point: Vec2, waterway: Waterway, clearance: number): boolean {
  return distanceToWaterway(point, waterway) < clearance;
}

function waterCorridorClearance(road: Road): number {
  return Math.max(8, road.width * 0.5 + 5);
}

function registerBridgeConnections(config: CityGeneratorConfig, road: Road, waterways: Waterway[], connections: WaterfrontConnection[]): void {
  for (const waterway of waterways) {
    for (const crossing of waterway.bridgeCrossings) {
      if (crossing.roadId !== road.id) {
        continue;
      }
      const offset = bankRoadOffset(config, waterway);
      for (const side of [-1, 1] as const) {
        registerWaterfrontConnection(connections, waterway, side, waterwayStation(waterway, crossing.point), bankRoadPoint(waterway, crossing.point, side, offset), road.id);
      }
    }
  }
}

function registerWaterfrontConnection(connections: WaterfrontConnection[], waterway: Waterway, side: -1 | 1, station: number, point: Vec2, sourceRoadId: string): void {
  connections.push({
    waterwayId: waterway.id,
    side,
    station,
    point,
    sourceRoadId
  });
}

function createWaterfrontRoads(config: CityGeneratorConfig, waterways: Waterway[], connections: WaterfrontConnection[]): Road[] {
  const roads: Road[] = [];
  for (const waterway of waterways) {
    for (const side of [-1, 1] as const) {
      const offset = bankRoadOffset(config, waterway);
      const sideConnections = connections.filter((connection) => connection.waterwayId === waterway.id && connection.side === side);
      const points = offsetWaterwayPolyline(waterway, side, offset)
        .concat(sideConnections)
        .sort((a, b) => a.station - b.station)
        .map((entry) => entry.point);
      const polyline = dedupePolyline(points);
      if (polyline.length < 2 || segmentLength(polyline) < 80) {
        continue;
      }
      const mainRiver = !waterway.id.includes("branch");
      const thames = waterway.style === "thames";
      roads.push({
        id: `road-waterfront-${waterway.id}-${side < 0 ? "south" : "north"}`,
        name: thames ? side < 0 ? "South Bank" : "Victoria Embankment" : mainRiver ? side < 0 ? "South River Drive" : "North River Drive" : side < 0 ? "West Branch Drive" : "East Branch Drive",
        hierarchy: mainRiver ? "collector" : "local",
        width: mainRiver ? widthForWaterfrontHierarchy("collector", config) : widthForWaterfrontHierarchy("local", config),
        polyline,
        pedestrianPriority: true
      });
    }
  }
  return roads;
}

function offsetWaterwayPolyline(waterway: Waterway, side: -1 | 1, offset: number): Array<{point: Vec2; station: number; sourceRoadId: string}> {
  let station = 0;
  return waterway.polyline.map((point, index) => {
    if (index > 0) {
      station += distance(waterway.polyline[index - 1], point);
    }
    const tangent = vertexTangent(waterway.polyline, index);
    const normal: Vec2 = [-tangent[1], tangent[0]];
    return {
      point: [point[0] + normal[0] * side * offset, point[1] + normal[1] * side * offset],
      station,
      sourceRoadId: "waterway"
    };
  });
}

function bankRoadPoint(waterway: Waterway, point: Vec2, side: -1 | 1, offset: number): Vec2 {
  const tangent = waterwayTangentAt(waterway, point);
  const normal: Vec2 = [-tangent[1], tangent[0]];
  return [point[0] + normal[0] * side * offset, point[1] + normal[1] * side * offset];
}

function sideForPoint(point: Vec2, waterway: Waterway, crossingPoint: Vec2): -1 | 1 {
  const tangent = waterwayTangentAt(waterway, crossingPoint);
  const normal: Vec2 = [-tangent[1], tangent[0]];
  const dot = (point[0] - crossingPoint[0]) * normal[0] + (point[1] - crossingPoint[1]) * normal[1];
  return dot >= 0 ? 1 : -1;
}

function bankRoadOffset(config: CityGeneratorConfig, waterway: Waterway): number {
  const setback = profileNumber(config.profileData?.waterways?.waterfrontSetback, 22);
  return waterway.width * 0.5 + Math.max(36, setback * 1.4);
}

function widthForWaterfrontHierarchy(hierarchy: "collector" | "local", config: CityGeneratorConfig): number {
  const width = config.profileData?.roads.widthByHierarchy?.[hierarchy];
  if (Number.isFinite(width)) {
    return Math.max(10, Number(width) * (hierarchy === "collector" ? 0.66 : 0.72));
  }
  return hierarchy === "collector" ? 16 : 10;
}

function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-6) {
    return null;
  }
  const ac: Vec2 = [c[0] - a[0], c[1] - a[1]];
  const t = cross(ac, s) / denom;
  const u = cross(ac, r) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

function cross(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

function waterwayStation(waterway: Waterway, point: Vec2): number {
  let station = 0;
  let best = Number.POSITIVE_INFINITY;
  let bestStation = 0;
  for (let i = 1; i < waterway.polyline.length; i++) {
    const a = waterway.polyline[i - 1];
    const b = waterway.polyline[i];
    const len = distance(a, b);
    const projection = closestSegmentProjection(point, a, b);
    const d = distance(point, projection.point);
    if (d < best) {
      best = d;
      bestStation = station + len * projection.t;
    }
    station += len;
  }
  return bestStation;
}

function closestSegmentProjection(point: Vec2, a: Vec2, b: Vec2): {point: Vec2; t: number} {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2));
  return {point: lerp2(a, b, t), t};
}

function addBankWalls(walls: MeshBuilder, caps: MeshBuilder, waterway: Waterway): void {
  for (let i = 1; i < waterway.polyline.length; i++) {
    const a = waterway.polyline[i - 1];
    const b = waterway.polyline[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      continue;
    }
    const normal: Vec2 = [-dy / len, dx / len];
    for (const side of [-1, 1] as const) {
      const p0: Vec2 = [a[0] + normal[0] * side * waterway.width * 0.5, a[1] + normal[1] * side * waterway.width * 0.5];
      const p1: Vec2 = [b[0] + normal[0] * side * waterway.width * 0.5, b[1] + normal[1] * side * waterway.width * 0.5];
      const wallNormal: Vec3 = [-normal[0] * side, -normal[1] * side, 0];
      walls.addQuad(
        [p0[0], p0[1], WATER_SURFACE_Z - 0.035],
        [p1[0], p1[1], WATER_SURFACE_Z - 0.035],
        [p1[0], p1[1], BANK_TOP_Z],
        [p0[0], p0[1], BANK_TOP_Z],
        wallNormal
      );
      caps.addRoadSegment(p0, p1, 2.8, WALL_CAP_Z);
    }
  }
}

function addQuays(builder: MeshBuilder, waterway: Waterway): void {
  for (let i = 1; i < waterway.polyline.length; i++) {
    const a = waterway.polyline[i - 1];
    const b = waterway.polyline[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      continue;
    }
    const normal: Vec2 = [-dy / len, dx / len];
    for (const side of [-1, 1]) {
      const offset = waterway.width * 0.5 + 6.5;
      const p0: Vec2 = [a[0] + normal[0] * side * offset, a[1] + normal[1] * side * offset];
      const p1: Vec2 = [b[0] + normal[0] * side * offset, b[1] + normal[1] * side * offset];
      builder.addRoadSegment(p0, p1, 8.5, QUAY_Z);
    }
  }
}

function addBridge(decks: MeshBuilder, roads: MeshBuilder, rails: MeshBuilder, waterway: Waterway, crossing: BridgeCrossing): void {
  const length = waterway.width + crossing.roadWidth + 52;
  const half = length / 2;
  const a: Vec2 = [crossing.point[0] - crossing.tangent[0] * half, crossing.point[1] - crossing.tangent[1] * half];
  const b: Vec2 = [crossing.point[0] + crossing.tangent[0] * half, crossing.point[1] + crossing.tangent[1] * half];
  const width = crossing.roadWidth + 5;
  decks.addRoadSegment(a, b, width, 0.095);
  roads.addRoadSegment(a, b, crossing.roadWidth + 1.5, 0.125);

  const normal: Vec2 = [-crossing.tangent[1], crossing.tangent[0]];
  for (const side of [-1, 1]) {
    const p0: Vec2 = [a[0] + normal[0] * side * width * 0.58, a[1] + normal[1] * side * width * 0.58];
    const p1: Vec2 = [b[0] + normal[0] * side * width * 0.58, b[1] + normal[1] * side * width * 0.58];
    rails.addRoadSegment(p0, p1, 0.9, 0.42);
  }
}

function addRiverwalkTree(trunks: MeshBuilder, crowns: MeshBuilder, point: Vec2, height: number): void {
  trunks.addCylinder([point[0], point[1], height * 0.27], 0.18 + height * 0.018, height * 0.54, 8);
  crowns.addBox([point[0], point[1], height * 0.76], [height * 0.58, height * 0.58, height * 0.46], Math.PI / 4);
}

function nearBridge(point: Vec2, waterways: Waterway[]): boolean {
  return waterways.some((waterway) => waterway.bridgeCrossings.some((crossing) => distance(point, crossing.point) < 34));
}

export function distanceToWaterway(point: Vec2, waterway: Waterway): number {
  return distanceToPolyline(point, waterway.polyline) - waterway.width * 0.5;
}
