import type {CityScene} from "../../types";
import type {MetricGroupResult} from "../CalibrationReport";
import {average, round, safeRatio, scoreAverage, targetRangeScore} from "./MetricUtils";

export interface PatternMetricResult {
  patternId: string;
  score: number;
  sampleCount: number;
  warnings: string[];
}

export function collectPatternMetrics(scene: CityScene): MetricGroupResult {
  const results: PatternMetricResult[] = [
    neighborhoodCenters(scene),
    importantStreetActiveFrontage(scene),
    definedParkEdges(scene),
    landmarkPublicSpace(scene),
    streetWallContinuity(scene),
    courtyardAccess(scene),
    residentialInteriorQuiet(scene),
    districtTransitions(scene),
    landmarkViewCorridors(scene)
  ];
  const score = scoreAverage(results.map((result) => result.score));
  const warnings = results.flatMap((result) => result.warnings);
  return {
    key: "patterns",
    label: "Pattern metrics",
    score: round(score),
    warnings,
    metrics: results.map((result) => ({
      key: result.patternId,
      label: result.patternId.replace(/-/g, " "),
      value: round(result.score),
      score: result.score,
      warning: result.warnings[0]
    })),
    details: {
      patternResults: results,
      summary: scene.urbanContext?.patternSummary || {}
    }
  };
}

function neighborhoodCenters(scene: CityScene): PatternMetricResult {
  const districts = new Set(scene.blocks.map((block) => block.district));
  const represented = Array.from(districts).filter((district) => scene.blocks.some((block) => block.district === district && (block.openSpace || block.landmark || Number(block.metadata.landValue || 0) > 0.65)));
  const score = safeRatio(represented.length, Math.max(1, districts.size));
  return result("neighborhood-centers", score, districts.size, score < 0.7 ? ["Some districts lack a center"] : []);
}

function importantStreetActiveFrontage(scene: CityScene): PatternMetricResult {
  const important = scene.objects.filter((object) => object.type === "Building" && (object.metadata.roadHierarchy === "arterial" || object.metadata.roadHierarchy === "collector"));
  const active = important.filter((object) => ["Retail", "MixedUse", "Office", "Hotel"].includes(String(object.metadata.usage || ""))).length;
  const score = safeRatio(active, important.length);
  return result("important-street-active-frontage", score, important.length, score < 0.45 ? ["Important streets have weak active frontage"] : []);
}

function definedParkEdges(scene: CityScene): PatternMetricResult {
  const parks = scene.blocks.filter((block) => block.openSpace);
  const buildings = scene.objects.filter((object) => object.type === "Building");
  const scores = parks.map((park) => {
    const near = buildings.filter((building) => {
      const center = metadataPoint(building.metadata.center);
      return center && Math.hypot(center[0] - park.center[0], center[1] - park.center[1]) < Math.sqrt(Math.abs(park.area)) + 150;
    }).length;
    return targetRangeScore(near, 4, 42);
  });
  const score = average(scores);
  return result("defined-park-edges", score || 0.6, parks.length, score < 0.45 ? ["Parks lack defined urban edges"] : []);
}

function landmarkPublicSpace(scene: CityScene): PatternMetricResult {
  const landmarks = scene.blocks.filter((block) => block.landmark);
  if (!landmarks.length) {
    return result("landmark-public-space", 0.55, 0, ["No landmark blocks found"]);
  }
  const plazas = scene.blocks.filter((block) => block.openSpace === "plaza" || block.openSpace === "civic-plaza");
  const linked = landmarks.filter((landmark) => plazas.some((plaza) => Math.hypot(plaza.center[0] - landmark.center[0], plaza.center[1] - landmark.center[1]) < 260)).length;
  const score = safeRatio(linked, landmarks.length);
  return result("landmark-public-space", score, landmarks.length, score < 0.5 ? ["Landmarks are weakly related to public space"] : []);
}

function streetWallContinuity(scene: CityScene): PatternMetricResult {
  const dense = scene.objects.filter((object) => object.type === "Building" && (object.metadata.district === "Historic Core" || object.metadata.district === "Mixed Residential"));
  const streetWall = dense.filter((object) => {
    const patterns = JSON.stringify(object.metadata.patterns || []);
    return patterns.includes("street-wall") || object.metadata.grammar === "fine-grain-streetwall" || object.metadata.grammar === "perimeter-courtyard";
  }).length;
  const score = safeRatio(streetWall, dense.length);
  return result("street-wall-continuity", score || 0.55, dense.length, score < 0.5 ? ["Dense districts have broken street walls"] : []);
}

function courtyardAccess(scene: CityScene): PatternMetricResult {
  const courtyardBlocks = scene.blocks.filter((block) => block.pattern === "perimeter-courtyard");
  const withBuildings = courtyardBlocks.filter((block) => scene.objects.some((object) => object.type === "Building" && object.metadata.blockId === block.id)).length;
  const score = safeRatio(withBuildings, courtyardBlocks.length);
  return result("courtyard-access", score || 0.6, courtyardBlocks.length, score < 0.5 ? ["Courtyard blocks are under-developed"] : []);
}

function residentialInteriorQuiet(scene: CityScene): PatternMetricResult {
  const residential = scene.objects.filter((object) => object.type === "Building" && object.metadata.district === "Mixed Residential");
  const quiet = residential.filter((object) => object.metadata.roadHierarchy === "local" || object.metadata.roadHierarchy === "alley").length;
  const score = safeRatio(quiet, residential.length);
  return result("residential-interior-quiet", score || 0.55, residential.length, score < 0.35 ? ["Residential interiors are too road-dominant"] : []);
}

function districtTransitions(scene: CityScene): PatternMetricResult {
  const blocks = scene.blocks;
  if (blocks.length < 2) {
    return result("district-transitions", 0.5, blocks.length, []);
  }
  const scores = blocks.map((block) => {
    const near = blocks
      .filter((other) => other.id !== block.id)
      .map((other) => ({
        district: other.district,
        distance: Math.hypot(block.center[0] - other.center[0], block.center[1] - other.center[1])
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    const same = safeRatio(near.filter((entry) => entry.district === block.district).length, near.length);
    return targetRangeScore(same, 0.35, 0.95);
  });
  const score = average(scores);
  return result("district-transitions", score, blocks.length, score < 0.42 ? ["District transitions are too abrupt or noisy"] : []);
}

function landmarkViewCorridors(scene: CityScene): PatternMetricResult {
  const corridors = scene.urbanContext?.viewCorridors || [];
  if (!corridors.length) {
    return result("landmark-view-corridors", 0.6, 0, []);
  }
  const buildings = scene.objects.filter((object) => object.type === "Building");
  const protectedCount = buildings.filter((building) => Number(building.metadata.viewCorridorPressure || 0) > 0.25 && Number(building.metadata.height || 0) < 34).length;
  const pressured = buildings.filter((building) => Number(building.metadata.viewCorridorPressure || 0) > 0.25).length;
  const score = safeRatio(protectedCount, pressured);
  return result("landmark-view-corridors", score || 0.55, corridors.length, score < 0.45 ? ["View corridors are weakly protected"] : []);
}

function result(patternId: string, score: number, sampleCount: number, warnings: string[]): PatternMetricResult {
  return {
    patternId,
    score: round(score),
    sampleCount,
    warnings
  };
}

function metadataPoint(value: unknown): [number, number] | undefined {
  return Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1])
    ? [Number(value[0]), Number(value[1])]
    : undefined;
}
