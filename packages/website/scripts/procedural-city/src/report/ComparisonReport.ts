import type {Block, CityProfile, CityScene, Road, Vec2} from "../types";
import {distance, polygonArea} from "../geometry/PolygonUtils";

export interface MetricComparison {
  key: string;
  label: string;
  unit?: string;
  source: number | null;
  generated: number | null;
  differencePercent: number | null;
  tolerancePercent: number;
  ok: boolean;
  warning?: string;
}

export interface ComparisonReport {
  schema: "xeokit-procedural-city-comparison/1.0";
  profileName: string;
  seed: string | number;
  generatedAt: string;
  source: CityProfile["source"];
  generatedStats: CityScene["stats"];
  metrics: MetricComparison[];
  warnings: string[];
}

interface GeneratedMetrics {
  medianRoadSegmentLength: number;
  medianBlockArea: number;
  medianBuildingCoverage: number;
  courtyardBlockRatio: number;
  medianBuildingLevels: number;
  openSpaceRatio: number;
}

export function createComparisonReport(scene: CityScene): ComparisonReport {
  const profile = scene.config.profileData;
  const sourceMetrics = sourceProfileMetrics(profile);
  const generatedMetrics = generatedCityMetrics(scene);
  const metrics = [
    compareMetric("medianRoadSegmentLength", "Median road segment length", sourceMetrics.medianRoadSegmentLength, generatedMetrics.medianRoadSegmentLength, "m", 35),
    compareMetric("medianBlockArea", "Median block area", sourceMetrics.medianBlockArea, generatedMetrics.medianBlockArea, "m2", 45),
    compareMetric("medianBuildingCoverage", "Median building coverage", sourceMetrics.medianBuildingCoverage, generatedMetrics.medianBuildingCoverage, undefined, 35),
    compareMetric("courtyardBlockRatio", "Courtyard block ratio", sourceMetrics.courtyardBlockRatio, generatedMetrics.courtyardBlockRatio, undefined, 35),
    compareMetric("medianBuildingLevels", "Median building levels", sourceMetrics.medianBuildingLevels, generatedMetrics.medianBuildingLevels, undefined, 50),
    compareMetric("openSpaceRatio", "Open-space ratio", sourceMetrics.openSpaceRatio, generatedMetrics.openSpaceRatio, undefined, 40)
  ];
  const warnings = metrics.flatMap((metric) => metric.warning ? [metric.warning] : []);
  return {
    schema: "xeokit-procedural-city-comparison/1.0",
    profileName: profile?.name || "unknown-profile",
    seed: scene.config.seed,
    generatedAt: "deterministic",
    source: profile?.source,
    generatedStats: scene.stats,
    metrics,
    warnings
  };
}

export function formatComparisonReport(report: ComparisonReport): string {
  const lines = [`${report.profileName} profile vs generated city`, ""];
  lines.push(`${"Metric".padEnd(32)} ${"Source".padStart(12)} ${"Generated".padStart(12)} ${"Diff".padStart(10)}`);
  lines.push("-".repeat(70));
  for (const metric of report.metrics) {
    lines.push(`${metric.label.padEnd(32)} ${formatMetric(metric.source, metric.unit).padStart(12)} ${formatMetric(metric.generated, metric.unit).padStart(12)} ${formatPercent(metric.differencePercent).padStart(10)}`);
  }
  if (report.warnings.length) {
    lines.push("", "Warnings:");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  return lines.join("\n");
}

function sourceProfileMetrics(profile: CityProfile | undefined): GeneratedMetrics {
  return {
    medianRoadSegmentLength: value(profile?.roads.segmentLength?.median, profile?.roads.segmentLength?.mean),
    medianBlockArea: value(profile?.blocks.area?.median, profile?.blocks.area?.mean),
    medianBuildingCoverage: value(profile?.parcels.buildableCoverage?.median, profile?.parcels.buildableCoverage?.mean, profile?.buildings.coverage?.median, profile?.buildings.coverage?.mean),
    courtyardBlockRatio: value(profile?.blocks.courtyardFrequency, profile?.relationships.courtyardProbability),
    medianBuildingLevels: value(profile?.buildings.levels?.median, profile?.buildings.levels?.mean),
    openSpaceRatio: value(profile?.publicSpace.areaRatio, profile?.publicSpace.openSpaceRatio)
  };
}

export function generatedCityMetrics(scene: CityScene): GeneratedMetrics {
  const roadSegments = segmentLengths(scene.roads);
  const buildableBlocks = scene.blocks.filter((block) => !block.openSpace && !block.landmark);
  const blockAreas = buildableBlocks.map((block) => Math.abs(block.area));
  const coverageByBlock = buildingCoverageByBlock(scene, buildableBlocks);
  const buildingLevels = scene.objects
    .map((object) => Number(object.metadata.floors))
    .filter((floors) => Number.isFinite(floors) && floors > 0);
  const totalBlockArea = scene.blocks.reduce((sum, block) => sum + Math.abs(block.area), 0);
  const openArea = scene.blocks
    .filter((block) => block.openSpace)
    .reduce((sum, block) => sum + Math.abs(block.area), 0);
  const courtyardBlocks = buildableBlocks.filter((block) => block.pattern === "perimeter-courtyard").length;
  return {
    medianRoadSegmentLength: median(roadSegments),
    medianBlockArea: median(blockAreas),
    medianBuildingCoverage: median(coverageByBlock),
    courtyardBlockRatio: buildableBlocks.length ? courtyardBlocks / buildableBlocks.length : 0,
    medianBuildingLevels: median(buildingLevels),
    openSpaceRatio: totalBlockArea > 0 ? openArea / totalBlockArea : 0
  };
}

function buildingCoverageByBlock(scene: CityScene, blocks: Block[]): number[] {
  const areaByBlock = new Map<string, number>();
  for (const object of scene.objects) {
    if (object.type !== "Building") {
      continue;
    }
    const blockId = String(object.metadata.blockId || "");
    const area = Number(object.metadata.footprintArea || 0);
    areaByBlock.set(blockId, (areaByBlock.get(blockId) || 0) + area);
  }
  return blocks.map((block) => {
    const edgeMargins = block.edgeMargins;
    const buildableFraction = edgeMargins
      ? Math.max(0.1, 1 - edgeMargins.u0 - edgeMargins.u1) * Math.max(0.1, 1 - edgeMargins.v0 - edgeMargins.v1)
      : 1;
    const buildableArea = Math.max(1, Math.abs(block.area) * buildableFraction);
    return Math.min(1, (areaByBlock.get(block.id) || 0) / buildableArea);
  });
}

function segmentLengths(roads: Road[]): number[] {
  const lengths: number[] = [];
  for (const road of roads) {
    for (let i = 1; i < road.polyline.length; i++) {
      const length = distance(road.polyline[i - 1], road.polyline[i]);
      if (length > 1) {
        lengths.push(length);
      }
    }
  }
  return lengths;
}

function compareMetric(key: string, label: string, source: number, generated: number, unit: string | undefined, tolerancePercent: number): MetricComparison {
  const sourceValue = Number.isFinite(source) ? source : null;
  const generatedValue = Number.isFinite(generated) ? generated : null;
  const differencePercent = sourceValue !== null && generatedValue !== null && Math.abs(sourceValue) > 1e-9
    ? ((generatedValue - sourceValue) / sourceValue) * 100
    : null;
  const ok = differencePercent === null || Math.abs(differencePercent) <= tolerancePercent;
  return {
    key,
    label,
    unit,
    source: sourceValue,
    generated: generatedValue,
    differencePercent,
    tolerancePercent,
    ok,
    warning: ok ? undefined : `${label} differs by ${Math.round(Math.abs(differencePercent || 0))}% from source profile`
  };
}

function value(...values: Array<number | undefined>): number {
  for (const candidate of values) {
    if (Number.isFinite(candidate)) {
      return Number(candidate);
    }
  }
  return NaN;
}

function median(values: number[]): number {
  const clean = values.filter((candidate) => Number.isFinite(candidate)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return NaN;
  }
  const mid = (clean.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  return lo === hi ? clean[lo] : clean[lo] + (clean[hi] - clean[lo]) * (mid - lo);
}

function formatMetric(value: number | null, unit: string | undefined): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }
  const formatted = unit ? Math.round(value).toLocaleString() : value.toFixed(value < 1 ? 2 : 1).replace(/\.0$/, "");
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}

export function polygonBounds(points: Vec2[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  return [minX, minY, maxX, maxY];
}

export function metadataFootprint(value: unknown): Vec2[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => [Number(point[0]), Number(point[1])] as Vec2);
}

export function footprintArea(value: unknown): number {
  const footprint = metadataFootprint(value);
  return footprint.length >= 3 ? Math.abs(polygonArea(footprint)) : 0;
}
