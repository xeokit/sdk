import type {Block, BlockUrbanContext, CityGeneratorConfig, CityProfile, CityUrbanContext, Parcel, ParcelUrbanContext, RandomStreams, RoadHierarchy, Vec2} from "../types";
import {bbox, distance, insetPolygon, polygonArea, polygonCentroid, quadPoint, round, scalePolygon} from "../geometry/PolygonUtils";
import {clampProfileValue, distributionRange, distributionValue, profileNumber} from "../profiles/ProfileResolver";
import {createParcelContext} from "./UrbanContext";
import type {Candidate} from "../evaluation/Candidate";
import {selectUrbanCandidate} from "../evaluation/UrbanEvaluation";

export function generateParcels(
  blocks: Block[],
  streams: RandomStreams,
  profile?: CityProfile,
  urbanContext?: CityUrbanContext,
  config?: CityGeneratorConfig
): Parcel[] {
  const parcels: Parcel[] = [];
  for (const block of blocks) {
    if (block.openSpace || block.landmark) {
      continue;
    }
    const blockContext = urbanContext?.blockContexts[block.id];
    const count = parcelCountFor(block, streams.parcels, profile, blockContext, config);
    const splitAlongU = splitDirection(block);
    const weights = variableWeights(count, streams.parcels, block.district, blockContext);
    const margin = blockEdgeMarginFor(block, profile, blockContext);
    const edgeMargins = block.edgeMargins || {u0: margin, u1: margin, v0: margin, v1: margin};
    const gap = parcelGapFractionFor(block, streams.parcels, profile, blockContext);
    const minParcelArea = minimumParcelArea(profile);
    let cursor = 0;
    for (let i = 0; i < weights.length; i++) {
      const next = cursor + weights[i];
      const [a, b] = rangeWithGap(cursor, next, gap);
      if (b <= a) {
        cursor = next;
        continue;
      }
      const u0 = scaledBlockRange(a, edgeMargins.u0, edgeMargins.u1);
      const u1 = scaledBlockRange(b, edgeMargins.u0, edgeMargins.u1);
      const v0 = scaledBlockRange(a, edgeMargins.v0, edgeMargins.v1);
      const v1 = scaledBlockRange(b, edgeMargins.v0, edgeMargins.v1);
      const polygon = splitAlongU
        ? quadSlice(block.polygon, u0, u1, edgeMargins.v0, 1 - edgeMargins.v1)
        : quadSlice(block.polygon, edgeMargins.u0, 1 - edgeMargins.u1, v0, v1);
      cursor = next;
      const center = polygonCentroid(polygon);
      const area = Math.abs(polygonArea(polygon));
      if (area < minParcelArea || !usableParcelShape(polygon, block, profile)) {
        continue;
      }
      const setback = setbackFor(block, streams.parcels, profile, blockContext);
      const parcelPolygon = insetPolygon(polygon, Math.min(setback * 0.25, 2.4));
      const id = `${block.id}-parcel-${String(i + 1).padStart(2, "0")}`;
      const parcel: Parcel = {
        id,
        blockId: block.id,
        polygon: parcelPolygon,
        center,
        area,
        district: block.district,
        frontageHierarchy: frontageFor(block, blockContext),
        setback
      };
      parcels.push(parcel);
      if (urbanContext && blockContext && config) {
        urbanContext.parcelContexts[id] = createParcelContext(parcel, blockContext, config, streams);
      }
    }
  }
  return parcels;
}

function parcelCountFor(block: Block, rng: () => number, profile: CityProfile | undefined, blockContext?: BlockUrbanContext, config?: CityGeneratorConfig): number {
  const [uLength, vLength] = blockEdgeLengths(block.polygon);
  const edge = Math.max(uLength, vLength);
  const shortEdge = Math.max(1, Math.min(uLength, vLength));
  const frontage = distributionValue(profile?.parcels.frontage, 21);
  const largeGridProfile = isLargeGridProfile(profile);
  const contextScale = blockContext
    ? clampProfileValue(1.15 - blockContext.densityBias * 0.16 + blockContext.imperfection * 0.12, 0.72, 1.34)
    : 1;
  const grammarScale = blockContext?.grammar === "fine-grain-streetwall"
    ? 0.68
    : blockContext?.grammar === "tower-podium"
      ? 1.18
      : blockContext?.grammar === "civic-campus"
        ? 1.42
        : 1;
  const districtScale = block.district === "Historic Core" ? 0.72 : block.district === "Downtown" ? 1.15 : block.district === "Civic District" ? 1.6 : 1.05;
  const base = clampProfileValue(frontage * districtScale * grammarScale * contextScale * (largeGridProfile ? 0.86 : 1), 9, 86);
  const shapeDivisor = largeGridProfile ? 10.5 : 5.8;
  const maxByShape = Math.max(2, Math.floor(edge / Math.max(8, shortEdge / shapeDivisor)));
  const largeBlockThreshold = distributionValue(profile?.blocks.area, 7600, "p75") * 0.82;
  const largeBlockBonus = block.area > largeBlockThreshold || edge > 145
    ? Math.max(0, Math.floor(edge / (largeGridProfile ? 105 : 150)) - 1)
    : 0;
  const count = Math.min(maxByShape, Math.round(edge / (base * (0.88 + rng() * 0.38))) + largeBlockBonus);
  let result: number;
  if (block.pattern === "podium-tower") {
    const contextBonus = (blockContext?.landValue ?? 0) > 0.78 ? 1 : 0;
    result = Math.max(2, Math.min(largeGridProfile ? 10 : 7, count + contextBonus));
  } else if (block.pattern === "historic-narrow") {
    result = Math.max(4, Math.min(11, count + 1));
  } else if (block.pattern === "standalone-civic") {
    result = Math.max(2, Math.min(largeGridProfile ? 8 : 6, count));
  } else {
    result = Math.max(3, Math.min(largeGridProfile ? 15 : 9, count + 1));
  }
  if (!config || config.evaluation?.enabled === false) {
    return result;
  }
  return selectParcelCount(block, result, edge, shortEdge, profile, blockContext, config);
}

function selectParcelCount(
  block: Block,
  baseCount: number,
  edge: number,
  shortEdge: number,
  profile: CityProfile | undefined,
  blockContext: BlockUrbanContext | undefined,
  config: CityGeneratorConfig
): number {
  const minCount = block.pattern === "historic-narrow" ? 4 : block.pattern === "podium-tower" || block.pattern === "standalone-civic" ? 2 : 3;
  const maxCount = block.pattern === "podium-tower" ? 9 : block.pattern === "standalone-civic" ? 8 : 15;
  const choices = Array.from(new Set([baseCount - 2, baseCount - 1, baseCount, baseCount + 1, baseCount + 2]
    .map((value) => Math.max(minCount, Math.min(maxCount, value)))))
    .sort((a, b) => a - b);
  const targetFrontage = distributionValue(profile?.parcels.frontage, 21);
  const candidates: Candidate<number>[] = choices.map((count) => {
    const frontage = edge / Math.max(1, count);
    const aspect = edge / Math.max(1, shortEdge);
    const frontageFit = 1 - Math.abs(frontage - targetFrontage) / Math.max(8, targetFrontage * 1.25);
    const blockFit = count >= minCount && count <= maxCount ? 0.76 : 0.42;
    return {
      id: `parcel-count-${count}`,
      label: `${count} parcels`,
      value: count,
      tags: block.pattern === "historic-narrow" ? ["fine-grain", "street-wall"] : block.pattern === "podium-tower" ? ["podium"] : ["mixed-use"],
      metrics: {
        parcelFrontage: frontage,
        parcelArea: block.area / Math.max(1, count),
        blockArea: block.area,
        blockAspectRatio: aspect,
        compactness: Math.max(0.24, Math.min(0.96, 1 / Math.sqrt(aspect))),
        patternFit: Math.max(0.35, Math.min(0.92, frontageFit * 0.72 + blockFit * 0.28)),
        walkableBlockSize: count > 2 ? 0.82 : 0.54,
        variety: count === baseCount ? 0.58 : 0.66 - Math.abs(count - baseCount) * 0.04,
        repetitionPenalty: count === baseCount ? 0.08 : 0,
        randomnessPenalty: Math.abs(count - baseCount) > 1 ? 0.1 : 0
      }
    };
  });
  const context = {
    stage: "parcel-subdivision" as const,
    subjectId: block.id,
    config,
    profile,
    district: block.district,
    block
  };
  const result = selectUrbanCandidate(candidates, context, {
    threshold: config.evaluation?.threshold ?? 0.56,
    weights: {
      "Skyline": 0,
      "Landmark Quality": 0
    }
  });
  return result.candidate.value;
}

function isLargeGridProfile(profile: CityProfile | undefined): boolean {
  const name = profile?.name.toLowerCase() || "";
  const blockArea = distributionValue(profile?.blocks.area, 7600);
  const perimeterBias = profileNumber(profile?.relationships.perimeterBlockBias, 0.45);
  return name.includes("new-york") || name.includes("north-american") || (blockArea > 9500 && perimeterBias < 0.26);
}

function splitDirection(block: Block): boolean {
  const [uLength, vLength] = blockEdgeLengths(block.polygon);
  return uLength >= vLength;
}

function variableWeights(count: number, rng: () => number, district: Block["district"], blockContext?: BlockUrbanContext): number[] {
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const contextNarrow = blockContext?.grammar === "fine-grain-streetwall" ? 0.22 : 0;
    const continuity = blockContext?.neighborContinuity ?? 0.5;
    const narrowBias = district === "Historic Core" ? 0.36 + contextNarrow : 0.08 + contextNarrow * 0.4;
    raw.push(0.82 + rng() * (0.38 + (1 - continuity) * 0.34) - (rng() < narrowBias ? rng() * 0.16 : 0));
  }
  const sum = raw.reduce((acc, v) => acc + v, 0);
  return raw.map((v) => v / sum);
}

function quadSlice(poly: Vec2[], u0: number, u1: number, v0: number, v1: number): Vec2[] {
  const p00 = poly[0];
  const p10 = poly[1];
  const p11 = poly[2];
  const p01 = poly[3];
  return [
    quadPoint(p00, p10, p11, p01, u0, v0),
    quadPoint(p00, p10, p11, p01, u1, v0),
    quadPoint(p00, p10, p11, p01, u1, v1),
    quadPoint(p00, p10, p11, p01, u0, v1)
  ];
}

function setbackFor(block: Block, rng: () => number, profile: CityProfile | undefined, blockContext?: BlockUrbanContext): number {
  const [minSetback, maxSetback] = distributionRange(profile?.parcels.setbacks, 2.1, 7.5);
  const profileSetback = minSetback + (maxSetback - minSetback) * rng();
  const contextSetback = blockContext
    ? clampProfileValue(blockContext.setbackBias + blockContext.viewCorridorPressure * 0.18 + blockContext.waterfrontInfluence * 0.22, 0.35, 1.9)
    : 1;
  if (block.district === "Historic Core") {
    return clampProfileValue(profileSetback * 0.72 * contextSetback, 0.7, 7);
  }
  if (block.district === "Downtown") {
    return clampProfileValue(profileSetback * 1.75 * contextSetback, 3, 20);
  }
  if (block.district === "Civic District") {
    return clampProfileValue(profileSetback * 2.2 * contextSetback, 5, 28);
  }
  return clampProfileValue(profileSetback * 1.15 * contextSetback, 1.8, 15);
}

function blockEdgeMarginFor(block: Block, profile: CityProfile | undefined, blockContext?: BlockUrbanContext): number {
  const coverage = distributionValue(profile?.parcels.buildableCoverage, 0.56);
  const contextCoverage = blockContext ? clampProfileValue(blockContext.coverageBias, 0.4, 1.2) : 1;
  const base = clampProfileValue((1 - coverage * contextCoverage) * 0.12, 0.035, 0.11);
  if (block.district === "Historic Core") {
    return clampProfileValue(base * 0.92, 0.045, 0.1);
  }
  if (block.district === "Downtown") {
    return clampProfileValue(base * 1.12, 0.055, 0.12);
  }
  if (block.district === "Civic District") {
    return clampProfileValue(base * 1.35, 0.06, 0.14);
  }
  return clampProfileValue(base, 0.05, 0.11);
}

function parcelGapFractionFor(block: Block, rng: () => number, profile: CityProfile | undefined, blockContext?: BlockUrbanContext): number {
  const spacing = distributionValue(profile?.buildings.spacing, 7);
  const base = clampProfileValue(spacing / 650, 0.004, 0.024);
  const continuity = blockContext?.neighborContinuity ?? 0.5;
  const contextGap = clampProfileValue(1.2 - continuity * 0.32 + (blockContext?.imperfection ?? 0.24) * 0.28, 0.72, 1.48);
  if (block.district === "Historic Core") {
    return base * contextGap * (0.55 + rng() * 0.55);
  }
  if (block.district === "Downtown") {
    return base * contextGap * (1.45 + rng() * 1.15);
  }
  if (block.district === "Civic District") {
    return base * contextGap * (1.45 + rng() * 1.05);
  }
  return base * contextGap * (0.9 + rng() * 0.9);
}

function rangeWithGap(start: number, end: number, gap: number): [number, number] {
  const width = end - start;
  const localGap = Math.min(gap, width * 0.22);
  return [start + localGap, end - localGap];
}

function scaledBlockRange(value: number, startMargin: number, endMargin: number): number {
  return startMargin + value * Math.max(0.1, 1 - startMargin - endMargin);
}

function frontageFor(block: Block, blockContext?: BlockUrbanContext): RoadHierarchy {
  if (blockContext) {
    return blockContext.roadHierarchy;
  }
  const size = Math.max(...blockEdgeLengths(block.polygon));
  if (block.district === "Downtown" && size > 95) {
    return "arterial";
  }
  if (block.district === "Historic Core" && size < 85) {
    return "local";
  }
  return size > 120 ? "collector" : "local";
}

function minimumParcelArea(profile: CityProfile | undefined): number {
  return clampProfileValue(distributionValue(profile?.parcels.area, 260, "p25") * 0.55, 45, 130);
}

function usableParcelShape(polygon: Vec2[], block: Block, profile: CityProfile | undefined): boolean {
  const [uLength, vLength] = blockEdgeLengths(polygon);
  const minLength = Math.min(uLength, vLength);
  const maxLength = Math.max(uLength, vLength);
  const frontageP25 = distributionValue(profile?.parcels.frontage, 12, "p25");
  const largeGridProfile = isLargeGridProfile(profile);
  const minSide = clampProfileValue(frontageP25 * 0.8, block.district === "Historic Core" || largeGridProfile ? 4.2 : 5.2, 9);
  const maxAspect = largeGridProfile
    ? 16
    : block.district === "Historic Core"
    ? 12
    : distributionValue(profile?.parcels.depth, 42) / Math.max(1, distributionValue(profile?.parcels.frontage, 14)) > 3
      ? 10
      : 7;
  return minLength >= minSide && maxLength / Math.max(1, minLength) <= maxAspect;
}

function blockEdgeLengths(polygon: Vec2[]): [number, number] {
  if (polygon.length < 4) {
    const [minX, minY, maxX, maxY] = bbox(polygon);
    return [maxX - minX, maxY - minY];
  }
  const uLength = (distance(polygon[0], polygon[1]) + distance(polygon[3], polygon[2])) / 2;
  const vLength = (distance(polygon[0], polygon[3]) + distance(polygon[1], polygon[2])) / 2;
  return [uLength, vLength];
}

export function parcelFootprint(parcel: Parcel, profile?: CityProfile, urbanContext?: CityUrbanContext): Vec2[] {
  const parcelContext = urbanContext?.parcelContexts[parcel.id];
  const alignment = parcelContext?.streetAlignment
    ?? clampProfileValue(profileNumber(profile?.buildings.streetAlignmentProbability, distributionValue(profile?.buildings.streetAlignment, 0.72)), 0.35, 0.94);
  const setbackBias = parcelContext?.setbackBias ?? 1;
  const insetDistance = parcel.setback * setbackBias * (0.72 - alignment * 0.42);
  const inset = insetPolygon(parcel.polygon, insetDistance);
  const regularized = regularizeDeepNarrowFootprint(inset, parcel, parcelContext);
  const coverageScale = parcelContext ? clampProfileValue(0.93 + (parcelContext.coverageBias - 0.7) * 0.1 - parcelContext.imperfection * 0.025, 0.84, 0.99) : 1;
  const contextual = coverageScale < 0.995 ? scalePolygon(regularized, coverageScale, coverageScale) : regularized;
  const [minX, minY, maxX, maxY] = bbox(contextual);
  if (distance([minX, minY], [maxX, maxY]) < 7) {
    return insetPolygon(parcel.polygon, Math.max(0.6, parcel.setback * 0.35));
  }
  return contextual.map((p) => [round(p[0]), round(p[1])] as Vec2);
}

function regularizeDeepNarrowFootprint(footprint: Vec2[], parcel: Parcel, parcelContext?: ParcelUrbanContext): Vec2[] {
  const [minX, minY, maxX, maxY] = bbox(footprint);
  const width = maxX - minX;
  const depth = maxY - minY;
  const minSide = Math.min(width, depth);
  const maxSide = Math.max(width, depth);
  const maxAspect = parcel.district === "Historic Core"
    ? 3.6
    : parcelContext?.grammar === "tower-podium"
      ? 4.2
      : 3.3;
  if (minSide <= 0 || maxSide / minSide <= maxAspect) {
    return footprint;
  }
  if (width > depth) {
    return scalePolygon(footprint, (depth * maxAspect) / width, 1);
  }
  return scalePolygon(footprint, 1, (width * maxAspect) / depth);
}
