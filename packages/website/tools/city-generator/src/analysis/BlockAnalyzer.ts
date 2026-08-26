import type {CityProfile} from "../types";
import {distribution, round} from "./Stats";
import type {RoadAnalysis} from "./RoadAnalyzer";

export interface BlockAnalysis {
  profile: CityProfile["blocks"];
  measuredBlocks: Array<{
    area: number;
    perimeter: number;
    compactness: number;
    aspectRatio: number;
    frontageLength: number;
  }>;
}

export function analyzeBlocks(roads: RoadAnalysis): BlockAnalysis {
  const measuredBlocks = estimateBlocksFromRoadCells(roads);
  if (measuredBlocks.length >= 6) {
    const compactnessValues = measuredBlocks.map((block) => block.compactness);
    return {
      measuredBlocks,
      profile: {
        area: distribution(measuredBlocks.map((block) => block.area), {mean: 7000}),
        perimeter: distribution(measuredBlocks.map((block) => block.perimeter), {mean: 350}),
        compactness: distribution(compactnessValues, {mean: 0.62}),
        aspectRatio: distribution(measuredBlocks.map((block) => block.aspectRatio), {mean: 1.5}),
        frontageLength: distribution(measuredBlocks.map((block) => block.frontageLength), {mean: 80}),
        courtyardFrequency: round(Math.min(0.68, Math.max(0.08, compactnessValues.filter((value) => value > 0.52 && value < 0.82).length / measuredBlocks.length))),
        irregularity: distribution(compactnessValues.map((value) => 1 - value), {mean: 0.35}),
        measuredCount: measuredBlocks.length,
        openCellRatio: round(openCellRatio(roads), 4)
      }
    };
  }

  const segment = roads.profile.segmentLength;
  const meanSegment = segment?.mean || 90;
  const p25 = segment?.p25 || meanSegment * 0.65;
  const p75 = segment?.p75 || meanSegment * 1.35;
  const blockWidths = [p25, meanSegment, p75].filter((value) => value > 0);
  const blockDepths = [p25 * 0.8, meanSegment * 1.15, p75 * 1.25].filter((value) => value > 0);
  const areas: number[] = [];
  const perimeters: number[] = [];
  const aspectRatios: number[] = [];
  const compactnessValues: number[] = [];
  const frontage: number[] = [];
  for (const width of blockWidths) {
    for (const depth of blockDepths) {
      areas.push(width * depth);
      perimeters.push((width + depth) * 2);
      aspectRatios.push(Math.max(width, depth) / Math.max(1, Math.min(width, depth)));
      compactnessValues.push((4 * Math.PI * width * depth) / (((width + depth) * 2) ** 2));
      frontage.push(Math.min(width, depth));
    }
  }
  return {
    measuredBlocks,
    profile: {
      area: distribution(areas, {mean: 7000}),
      perimeter: distribution(perimeters, {mean: 350}),
      compactness: distribution(compactnessValues, {mean: 0.62}),
      aspectRatio: distribution(aspectRatios, {mean: 1.5}),
      frontageLength: distribution(frontage, {mean: 80}),
      courtyardFrequency: round(Math.min(0.55, Math.max(0.08, (roads.profile.curvature?.mean || 1.08) - 0.86)), 4),
      irregularity: distribution(compactnessValues.map((value) => 1 - value), {mean: 0.35})
    }
  };
}

function estimateBlocksFromRoadCells(roads: RoadAnalysis): BlockAnalysis["measuredBlocks"] {
  const [minX, minY, maxX, maxY] = roads.bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 50 || height <= 50 || roads.roadLines.length < 4) {
    return [];
  }
  let cellSize = clamp((roads.profile.segmentLength?.median || roads.profile.segmentLength?.mean || 90) / 5, 8, 22);
  let cols = Math.ceil(width / cellSize);
  let rows = Math.ceil(height / cellSize);
  while (cols * rows > 70000) {
    cellSize *= 1.2;
    cols = Math.ceil(width / cellSize);
    rows = Math.ceil(height / cellSize);
  }

  const roadCells = new Uint8Array(cols * rows);
  for (const road of roads.roadLines) {
    const radius = Math.max(cellSize * 0.55, roadWidth(road.hierarchy) * 0.5 + cellSize * 0.35);
    for (let i = 1; i < road.points.length; i++) {
      markSegmentCells(roadCells, cols, rows, minX, minY, cellSize, road.points[i - 1], road.points[i], radius);
    }
  }

  const visited = new Uint8Array(cols * rows);
  const blocks: BlockAnalysis["measuredBlocks"] = [];
  const totalArea = width * height;
  for (let start = 0; start < roadCells.length; start++) {
    if (roadCells[start] || visited[start]) {
      continue;
    }
    const component = floodComponent(start, roadCells, visited, cols, rows);
    if (component.touchesBoundary) {
      continue;
    }
    const area = component.count * cellSize * cellSize;
    if (area < 450 || area > totalArea * 0.16) {
      continue;
    }
    const boxWidth = Math.max(cellSize, (component.maxX - component.minX + 1) * cellSize);
    const boxHeight = Math.max(cellSize, (component.maxY - component.minY + 1) * cellSize);
    const perimeter = component.exposedEdges * cellSize;
    const compactness = perimeter > 0 ? Math.min(1, (4 * Math.PI * area) / (perimeter * perimeter)) : 0;
    blocks.push({
      area: round(area, 2),
      perimeter: round(perimeter, 2),
      compactness: round(compactness, 4),
      aspectRatio: round(Math.max(boxWidth, boxHeight) / Math.max(1, Math.min(boxWidth, boxHeight)), 4),
      frontageLength: round(Math.min(boxWidth, boxHeight), 2)
    });
  }
  return blocks;
}

function markSegmentCells(
  roadCells: Uint8Array,
  cols: number,
  rows: number,
  minX: number,
  minY: number,
  cellSize: number,
  a: [number, number],
  b: [number, number],
  radius: number
): void {
  const ix0 = clampInt(Math.floor((Math.min(a[0], b[0]) - radius - minX) / cellSize), 0, cols - 1);
  const ix1 = clampInt(Math.ceil((Math.max(a[0], b[0]) + radius - minX) / cellSize), 0, cols - 1);
  const iy0 = clampInt(Math.floor((Math.min(a[1], b[1]) - radius - minY) / cellSize), 0, rows - 1);
  const iy1 = clampInt(Math.ceil((Math.max(a[1], b[1]) + radius - minY) / cellSize), 0, rows - 1);
  for (let iy = iy0; iy <= iy1; iy++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = minX + (ix + 0.5) * cellSize;
      const y = minY + (iy + 0.5) * cellSize;
      if (distancePointToSegment([x, y], a, b) <= radius) {
        roadCells[iy * cols + ix] = 1;
      }
    }
  }
}

function floodComponent(start: number, roadCells: Uint8Array, visited: Uint8Array, cols: number, rows: number): {
  count: number;
  exposedEdges: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  touchesBoundary: boolean;
} {
  const stack = [start];
  visited[start] = 1;
  let count = 0;
  let exposedEdges = 0;
  let minX = cols;
  let minY = rows;
  let maxX = 0;
  let maxY = 0;
  let touchesBoundary = false;
  while (stack.length) {
    const cell = stack.pop()!;
    const x = cell % cols;
    const y = Math.floor(cell / cols);
    count++;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) {
      touchesBoundary = true;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
        exposedEdges++;
        continue;
      }
      const next = ny * cols + nx;
      if (roadCells[next]) {
        exposedEdges++;
      } else if (!visited[next]) {
        visited[next] = 1;
        stack.push(next);
      }
    }
  }
  return {count, exposedEdges, minX, minY, maxX, maxY, touchesBoundary};
}

function openCellRatio(roads: RoadAnalysis): number {
  const [minX, minY, maxX, maxY] = roads.bounds;
  const area = Math.max(1, (maxX - minX) * (maxY - minY));
  const roadArea = roads.roadLines.reduce((sum, road) => sum + road.length * roadWidth(road.hierarchy), 0);
  return Math.max(0, Math.min(1, 1 - roadArea / area));
}

function distancePointToSegment(point: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) {
    return Math.hypot(point[0] - a[0], point[1] - a[1]);
  }
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t));
}

function roadWidth(hierarchy: string): number {
  switch (hierarchy) {
    case "arterial": return 30;
    case "collector": return 19;
    case "pedestrian": return 9;
    case "alley": return 6;
    default: return 12;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
