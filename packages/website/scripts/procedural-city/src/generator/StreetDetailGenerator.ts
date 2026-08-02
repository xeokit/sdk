import type {CityGeneratorConfig, CityObject, RandomStreams, Road, RoadNetwork, Vec2, Waterway} from "../types";
import {MeshBuilder} from "../geometry/MeshBuilder";
import {distance, distanceToPolyline, lerp2, samplePolyline, segmentLength} from "../geometry/PolygonUtils";
import {distanceToWaterway} from "./WaterwayGenerator";

const STREET_TREE_ROAD_EDGE_OFFSET = 7.5;
const STREET_FURNITURE_ROAD_EDGE_OFFSET = 4.8;
const TREE_ROAD_SURFACE_CLEARANCE = 2.8;

export function generateRoadObjects(network: RoadNetwork): CityObject[] {
  return network.roads.map((road) => {
    const asphalt = new MeshBuilder();
    const sidewalks = new MeshBuilder();
    const bridges = (network.waterways || []).flatMap((waterway) => waterway.bridgeCrossings
      .filter((crossing) => crossing.roadId === road.id)
      .map((crossing) => crossing.id));
    const clipAgainstWater = !road.id.startsWith("road-waterfront");
    let visibleSegments = 0;
    let clippedSegments = 0;
    for (let i = 1; i < road.polyline.length; i++) {
      const a = road.polyline[i - 1];
      const b = road.polyline[i];
      const roadSpans = clipAgainstWater ? clippedRoadSpans(a, b, road, network.waterways || [], road.width, 1.5) : [[a, b] as [Vec2, Vec2]];
      const sidewalkSpans = clipAgainstWater ? clippedRoadSpans(a, b, road, network.waterways || [], road.width + 7, 2.5) : [[a, b] as [Vec2, Vec2]];
      if (roadSpans.length !== 1 || sidewalkSpans.length !== 1 || distance(roadSpans[0]?.[0] || a, a) > 0.01 || distance(roadSpans[0]?.[1] || b, b) > 0.01) {
        clippedSegments++;
      }
      for (const [spanA, spanB] of roadSpans) {
        asphalt.addRoadSegment(spanA, spanB, road.width, 0.01);
        visibleSegments++;
      }
      for (const [spanA, spanB] of sidewalkSpans) {
        sidewalks.addRoadSegment(spanA, spanB, road.width + 7, -0.015);
      }
    }
    return {
      id: road.id,
      name: road.name,
      type: "Road",
      layerId: "roads",
      meshes: [
        sidewalks.toMesh("paving-stone", `${road.id}-sidewalks`),
        asphalt.toMesh(road.hierarchy === "pedestrian" ? "paving-stone" : "asphalt", `${road.id}-asphalt`)
      ],
      metadata: {
        id: road.id,
        type: "Road",
        name: road.name,
        hierarchy: road.hierarchy,
        width: road.width,
        length: Math.round(segmentLength(road.polyline)),
        pedestrianPriority: road.pedestrianPriority === true,
        routedAroundWater: road.routedAroundWater === true,
        visibleSegments,
        clippedByWaterway: clippedSegments > 0,
        bridges
      }
    };
  });
}

export function generateStreetDetails(network: RoadNetwork, config: CityGeneratorConfig, streams: RandomStreams): CityObject[] {
  const trunks = new MeshBuilder();
  const crowns = new MeshBuilder();
  const lights = new MeshBuilder();
  const benches = new MeshBuilder();
  const traffic = new MeshBuilder();
  const shelters = new MeshBuilder();
  let treeCount = 0;
  let furnitureCount = 0;

  for (const road of network.roads) {
    const spacing = road.hierarchy === "arterial" ? 34 : road.hierarchy === "collector" ? 28 : road.hierarchy === "alley" ? 55 : 24;
    const samples = samplePolyline(road.polyline, spacing);
    for (let i = 0; i < samples.length; i++) {
      const {point, tangent} = samples[i];
      if (pointIsInWaterReservedArea(point, road, network.waterways || [])) {
        continue;
      }
      const normal: Vec2 = [-tangent[1], tangent[0]];
      for (const side of [-1, 1]) {
        const treePoint: Vec2 = [
          point[0] + normal[0] * side * (road.width * 0.5 + STREET_TREE_ROAD_EDGE_OFFSET),
          point[1] + normal[1] * side * (road.width * 0.5 + STREET_TREE_ROAD_EDGE_OFFSET)
        ];
        const furniturePoint: Vec2 = [
          point[0] + normal[0] * side * (road.width * 0.5 + STREET_FURNITURE_ROAD_EDGE_OFFSET),
          point[1] + normal[1] * side * (road.width * 0.5 + STREET_FURNITURE_ROAD_EDGE_OFFSET)
        ];
        if (
          road.hierarchy !== "alley"
          && road.hierarchy !== "pedestrian"
          && streams.vegetation() < 0.62
          && !pointIsInAnyRoadSurface(treePoint, network.roads, TREE_ROAD_SURFACE_CLEARANCE)
        ) {
          addStreetTree(trunks, crowns, treePoint, 5.2 + streams.vegetation() * 3.8);
          treeCount++;
        }
        if (i % 2 === 0 && streams.furniture() < 0.74) {
          addStreetlight(lights, furniturePoint);
          furnitureCount++;
        }
      }
      if (road.hierarchy === "arterial" && i % 5 === 0) {
        shelters.addBox([point[0], point[1], 1.35], [4.8, 1.5, 2.7], Math.atan2(tangent[1], tangent[0]));
        furnitureCount++;
      }
      if ((road.hierarchy === "arterial" || road.hierarchy === "collector") && i % 6 === 0) {
        traffic.addBox([point[0] + tangent[0] * 2, point[1] + tangent[1] * 2, 2.4], [0.35, 0.35, 4.8], 0);
        traffic.addBox([point[0] + tangent[0] * 2, point[1] + tangent[1] * 2, 4.8], [1.2, 0.35, 0.55], 0);
        furnitureCount++;
      }
      if (road.hierarchy === "pedestrian" && streams.furniture() < 0.55) {
        benches.addBox([point[0], point[1], 0.45], [2.2, 0.55, 0.42], Math.atan2(tangent[1], tangent[0]));
        furnitureCount++;
      }
    }
  }

  const objects: CityObject[] = [
    {
      id: "street-trees",
      name: "Street trees",
      type: "Vegetation",
      layerId: "vegetation",
      meshes: [
        trunks.toMesh("tree-trunk", "street-tree-trunks"),
        crowns.toMesh("tree-canopy", "street-tree-canopies")
      ],
      metadata: {id: "street-trees", type: "Vegetation", treeCount}
    },
    {
      id: "street-furniture",
      name: "Street furniture",
      type: "StreetFurniture",
      layerId: "streetFurniture",
      meshes: [
        lights.toMesh("steel", "streetlights"),
        benches.toMesh("street-furniture", "benches"),
        traffic.toMesh("traffic-light", "traffic-lights"),
        shelters.toMesh("dark-glass", "bus-shelters")
      ],
      metadata: {id: "street-furniture", type: "StreetFurniture", count: furnitureCount}
    }
  ];

  if (config.density === "high") {
    addBollards(objects[1], config.size);
  }
  return objects;
}

function clippedRoadSpans(a: Vec2, b: Vec2, road: Road, waterways: Waterway[], width: number, margin: number): Array<[Vec2, Vec2]> {
  if (!waterways.length) {
    return [[a, b]];
  }
  const len = distance(a, b);
  if (len < 0.01) {
    return [];
  }
  const steps = Math.max(1, Math.ceil(len / 5.5));
  let visibleStart: number | null = null;
  let previousT = 0;
  let previousBlocked = roadPointOverlapsWater(lerp2(a, b, 0), waterways, width, margin);
  if (!previousBlocked) {
    visibleStart = 0;
  }
  const spans: Array<[Vec2, Vec2]> = [];
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const blocked = roadPointOverlapsWater(lerp2(a, b, t), waterways, width, margin);
    if (previousBlocked && !blocked) {
      visibleStart = refineWaterBoundary(a, b, waterways, width, margin, previousT, t);
    } else if (!previousBlocked && blocked) {
      const end = refineWaterBoundary(a, b, waterways, width, margin, previousT, t);
      if (visibleStart !== null && end - visibleStart > 0.003) {
        spans.push([lerp2(a, b, visibleStart), lerp2(a, b, end)]);
      }
      visibleStart = null;
    }
    previousT = t;
    previousBlocked = blocked;
  }
  if (!previousBlocked && visibleStart !== null && 1 - visibleStart > 0.003) {
    spans.push([lerp2(a, b, visibleStart), b]);
  }
  return spans.filter(([spanA, spanB]) => distance(spanA, spanB) > 0.25);
}

function refineWaterBoundary(a: Vec2, b: Vec2, waterways: Waterway[], width: number, margin: number, t0: number, t1: number): number {
  let low = t0;
  let high = t1;
  const lowBlocked = roadPointOverlapsWater(lerp2(a, b, low), waterways, width, margin);
  for (let i = 0; i < 8; i++) {
    const mid = (low + high) / 2;
    const midBlocked = roadPointOverlapsWater(lerp2(a, b, mid), waterways, width, margin);
    if (midBlocked === lowBlocked) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function roadPointOverlapsWater(point: Vec2, waterways: Waterway[], width: number, margin: number): boolean {
  for (const waterway of waterways) {
    if (distanceToWaterway(point, waterway) < width * 0.5 + margin) {
      return true;
    }
  }
  return false;
}

function pointIsInAnyRoadSurface(point: Vec2, roads: Road[], clearance: number): boolean {
  for (const road of roads) {
    if (distanceToPolyline(point, road.polyline) < road.width * 0.5 + clearance) {
      return true;
    }
  }
  return false;
}

function pointIsInWaterReservedArea(point: Vec2, road: Road, waterways: Waterway[]): boolean {
  for (const waterway of waterways) {
    if (distanceToWaterway(point, waterway) < road.width * 0.5 + 8) {
      return true;
    }
    if (pointIsOnBridgeReservation(point, road, waterway)) {
      return true;
    }
  }
  return false;
}

function pointIsOnBridgeReservation(point: Vec2, road: Road, waterway: Waterway): boolean {
  for (const crossing of waterway.bridgeCrossings) {
    if (crossing.roadId !== road.id) {
      continue;
    }
    const dx = point[0] - crossing.point[0];
    const dy = point[1] - crossing.point[1];
    const along = Math.abs(dx * crossing.tangent[0] + dy * crossing.tangent[1]);
    const across = Math.abs(dx * -crossing.tangent[1] + dy * crossing.tangent[0]);
    const bridgeHalfLength = (waterway.width + crossing.roadWidth + 52) * 0.5;
    const bridgeHalfWidth = (crossing.roadWidth + 14) * 0.5;
    if (along < bridgeHalfLength + 4 && across < bridgeHalfWidth + 5) {
      return true;
    }
  }
  return false;
}

function addStreetTree(trunks: MeshBuilder, crowns: MeshBuilder, point: Vec2, height: number): void {
  trunks.addCylinder([point[0], point[1], height * 0.27], 0.18 + height * 0.018, height * 0.54, 8);
  crowns.addBox([point[0], point[1], height * 0.76], [height * 0.52, height * 0.52, height * 0.42], Math.PI / 4);
}

function addStreetlight(builder: MeshBuilder, point: Vec2): void {
  builder.addCylinder([point[0], point[1], 2.6], 0.09, 5.2, 8);
  builder.addBox([point[0] + 0.42, point[1], 5.12], [0.85, 0.16, 0.22], 0);
}

function addBollards(object: CityObject, size: number): void {
  const builder = new MeshBuilder();
  const half = size / 2;
  for (let i = 0; i < 120; i++) {
    const x = -half + (i % 30) * (size / 29);
    const y = i < 60 ? -half * 0.52 : half * 0.52;
    builder.addCylinder([x, y, 0.45], 0.12, 0.9, 7);
  }
  object.meshes.push(builder.toMesh("street-furniture", "bollards"));
  object.metadata.count = Number(object.metadata.count || 0) + 120;
}
