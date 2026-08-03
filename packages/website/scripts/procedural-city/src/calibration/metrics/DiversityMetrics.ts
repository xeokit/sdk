import type {CityScene} from "../../types";
import type {MetricGroupResult} from "../CalibrationReport";
import {entropy, round, safeRatio, scoreAverage, targetRangeScore} from "./MetricUtils";

export function collectDiversityMetrics(scene: CityScene): MetricGroupResult {
  const buildings = scene.objects.filter((object) => object.type === "Building");
  const massingKeys = buildings.map((object) => `${object.metadata.grammar || "none"}:${heightBand(Number(object.metadata.floors || 0))}`);
  const facadeKeys = buildings.map((object) => String(object.metadata.facadeStyle || "none"));
  const roofKeys = buildings.map((object) => String(object.metadata.roofType || "none"));
  const materialKeys = buildings.map((object) => String(object.metadata.materialFamily || object.metadata.facadeStyle || "none"));
  const blockKeys = scene.blocks.map((block) => String(block.pattern || block.metadata.grammar || "none"));
  const neighborSimilarity = neighboringBuildingSimilarity(scene);
  const districtIdentity = districtIdentityScore(scene);
  const repeatedMassing = repeatedShare(massingKeys);
  const facadeEntropy = categoricalEntropy(facadeKeys);
  const roofEntropy = categoricalEntropy(roofKeys);
  const materialEntropy = categoricalEntropy(materialKeys);
  const blockEntropy = categoricalEntropy(blockKeys);
  const score = scoreAverage([
    targetRangeScore(repeatedMassing, 0, 0.42),
    targetRangeScore(facadeEntropy, 0.32, 0.9),
    targetRangeScore(roofEntropy, 0.24, 0.86),
    targetRangeScore(blockEntropy, 0.22, 0.88),
    targetRangeScore(materialEntropy, 0.2, 0.85),
    targetRangeScore(neighborSimilarity, 0.28, 0.82),
    districtIdentity
  ]);
  const warnings: string[] = [];
  if (repeatedMassing > 0.5) {
    warnings.push("Building massing is too repetitive");
  }
  if (facadeEntropy > 0.96 || roofEntropy > 0.96) {
    warnings.push("Architectural variation is becoming noisy");
  }
  if (districtIdentity < 0.45) {
    warnings.push("District identities are weak");
  }
  return {
    key: "diversity",
    label: "Diversity metrics",
    score: round(score),
    warnings,
    metrics: [
      {key: "repeatedBuildingMassing", label: "Repeated building massing", value: round(repeatedMassing), score: targetRangeScore(repeatedMassing, 0, 0.42)},
      {key: "facadeConfigurationEntropy", label: "Facade configuration entropy", value: round(facadeEntropy), score: targetRangeScore(facadeEntropy, 0.32, 0.9)},
      {key: "roofTypeEntropy", label: "Roof type entropy", value: round(roofEntropy), score: targetRangeScore(roofEntropy, 0.24, 0.86)},
      {key: "blockLayoutEntropy", label: "Block layout entropy", value: round(blockEntropy), score: targetRangeScore(blockEntropy, 0.22, 0.88)},
      {key: "materialFamilyEntropy", label: "Material family entropy", value: round(materialEntropy), score: targetRangeScore(materialEntropy, 0.2, 0.85)},
      {key: "neighborBuildingSimilarity", label: "Neighboring-building similarity", value: round(neighborSimilarity), score: targetRangeScore(neighborSimilarity, 0.28, 0.82)},
      {key: "districtIdentity", label: "District-level identity", value: round(districtIdentity), score: districtIdentity}
    ],
    details: {
      facadeCounts: counts(facadeKeys),
      roofCounts: counts(roofKeys),
      blockCounts: counts(blockKeys)
    }
  };
}

function heightBand(floors: number): string {
  if (floors >= 24) {
    return "tower";
  }
  if (floors >= 12) {
    return "mid-high";
  }
  if (floors >= 5) {
    return "mid";
  }
  return "low";
}

function categoricalEntropy(keys: string[]): number {
  const unique = Array.from(new Set(keys));
  if (unique.length <= 1) {
    return 0;
  }
  const index = new Map(unique.map((key, i) => [key, i]));
  return entropy(keys.map((key) => (index.get(key) || 0) / unique.length), unique.length);
}

function repeatedShare(keys: string[]): number {
  const map = counts(keys);
  const repeated = Object.values(map).filter((count) => count > Math.max(4, keys.length * 0.035)).reduce((sum, count) => sum + count, 0);
  return safeRatio(repeated, keys.length);
}

function counts(keys: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of keys) {
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

function neighboringBuildingSimilarity(scene: CityScene): number {
  const buildings = scene.objects
    .filter((object) => object.type === "Building")
    .map((object) => ({
      center: Array.isArray(object.metadata.center) ? [Number(object.metadata.center[0]), Number(object.metadata.center[1])] : undefined,
      key: `${object.metadata.facadeStyle}:${object.metadata.roofType}:${heightBand(Number(object.metadata.floors || 0))}`
    }))
    .filter((entry) => entry.center);
  let samples = 0;
  let same = 0;
  for (let i = 0; i < buildings.length; i++) {
    const current = buildings[i];
    const nearest = buildings
      .map((other, j) => j === i ? undefined : {
        key: other.key,
        distance: Math.hypot(current.center![0] - other.center![0], current.center![1] - other.center![1])
      })
      .filter(Boolean)
      .sort((a, b) => a!.distance - b!.distance)
      .slice(0, 3) as Array<{key: string; distance: number}>;
    for (const neighbor of nearest) {
      samples++;
      if (neighbor.key === current.key) {
        same++;
      }
    }
  }
  return safeRatio(same, samples);
}

function districtIdentityScore(scene: CityScene): number {
  const byDistrict = new Map<string, string[]>();
  for (const object of scene.objects) {
    if (object.type !== "Building") {
      continue;
    }
    const district = String(object.metadata.district || "unknown");
    const keys = byDistrict.get(district) || [];
    keys.push(`${object.metadata.facadeStyle}:${object.metadata.roofType}:${object.metadata.materialFamily || ""}`);
    byDistrict.set(district, keys);
  }
  const scores = Array.from(byDistrict.values()).map((keys) => targetRangeScore(categoricalEntropy(keys), 0.18, 0.78));
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.5;
}
