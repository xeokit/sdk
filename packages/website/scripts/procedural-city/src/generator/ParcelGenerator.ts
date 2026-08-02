import type {Block, CityProfile, Parcel, RandomStreams, RoadHierarchy, Vec2} from "../types";
import {bbox, distance, insetPolygon, polygonArea, polygonCentroid, quadPoint, round, scalePolygon} from "../geometry/PolygonUtils";
import {clampProfileValue, distributionRange, distributionValue, profileNumber} from "../profiles/ProfileResolver";

export function generateParcels(blocks: Block[], streams: RandomStreams, profile?: CityProfile): Parcel[] {
  const parcels: Parcel[] = [];
  for (const block of blocks) {
    if (block.openSpace || block.landmark) {
      continue;
    }
    const count = parcelCountFor(block, streams.parcels, profile);
    const splitAlongU = splitDirection(block);
    const weights = variableWeights(count, streams.parcels, block.district);
    const margin = blockEdgeMarginFor(block, profile);
    const edgeMargins = block.edgeMargins || {u0: margin, u1: margin, v0: margin, v1: margin};
    const gap = parcelGapFractionFor(block, streams.parcels, profile);
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
      const setback = setbackFor(block, streams.parcels, profile);
      const parcelPolygon = insetPolygon(polygon, Math.min(setback * 0.25, 2.4));
      const id = `${block.id}-parcel-${String(i + 1).padStart(2, "0")}`;
      parcels.push({
        id,
        blockId: block.id,
        polygon: parcelPolygon,
        center,
        area,
        district: block.district,
        frontageHierarchy: frontageFor(block),
        setback
      });
    }
  }
  return parcels;
}

function parcelCountFor(block: Block, rng: () => number, profile: CityProfile | undefined): number {
  const [uLength, vLength] = blockEdgeLengths(block.polygon);
  const edge = Math.max(uLength, vLength);
  const shortEdge = Math.max(1, Math.min(uLength, vLength));
  const frontage = distributionValue(profile?.parcels.frontage, 21);
  const largeGridProfile = isLargeGridProfile(profile);
  const districtScale = block.district === "Historic Core" ? 0.72 : block.district === "Downtown" ? 1.15 : block.district === "Civic District" ? 1.6 : 1.05;
  const base = clampProfileValue(frontage * districtScale * (largeGridProfile ? 0.86 : 1), 9, 86);
  const shapeDivisor = largeGridProfile ? 10.5 : 5.8;
  const maxByShape = Math.max(2, Math.floor(edge / Math.max(8, shortEdge / shapeDivisor)));
  const largeBlockThreshold = distributionValue(profile?.blocks.area, 7600, "p75") * 0.82;
  const largeBlockBonus = block.area > largeBlockThreshold || edge > 145
    ? Math.max(0, Math.floor(edge / (largeGridProfile ? 105 : 150)) - 1)
    : 0;
  const count = Math.min(maxByShape, Math.round(edge / (base * (0.88 + rng() * 0.38))) + largeBlockBonus);
  if (block.pattern === "podium-tower") {
    return Math.max(3, Math.min(largeGridProfile ? 18 : 10, count + 1));
  }
  if (block.pattern === "historic-narrow") {
    return Math.max(4, Math.min(11, count + 1));
  }
  if (block.pattern === "standalone-civic") {
    return Math.max(2, Math.min(largeGridProfile ? 8 : 6, count));
  }
  return Math.max(3, Math.min(largeGridProfile ? 15 : 9, count + 1));
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

function variableWeights(count: number, rng: () => number, district: Block["district"]): number[] {
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const narrowBias = district === "Historic Core" ? 0.36 : 0.08;
    raw.push(0.82 + rng() * 0.52 - (rng() < narrowBias ? rng() * 0.12 : 0));
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

function setbackFor(block: Block, rng: () => number, profile: CityProfile | undefined): number {
  const [minSetback, maxSetback] = distributionRange(profile?.parcels.setbacks, 2.1, 7.5);
  const profileSetback = minSetback + (maxSetback - minSetback) * rng();
  if (block.district === "Historic Core") {
    return clampProfileValue(profileSetback * 0.72, 1.1, 6);
  }
  if (block.district === "Downtown") {
    return clampProfileValue(profileSetback * 1.75, 4, 16);
  }
  if (block.district === "Civic District") {
    return clampProfileValue(profileSetback * 2.2, 5, 22);
  }
  return clampProfileValue(profileSetback * 1.15, 2.4, 12);
}

function blockEdgeMarginFor(block: Block, profile: CityProfile | undefined): number {
  const coverage = distributionValue(profile?.parcels.buildableCoverage, 0.56);
  const base = clampProfileValue((1 - coverage) * 0.12, 0.045, 0.1);
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

function parcelGapFractionFor(block: Block, rng: () => number, profile: CityProfile | undefined): number {
  const spacing = distributionValue(profile?.buildings.spacing, 7);
  const base = clampProfileValue(spacing / 650, 0.004, 0.024);
  if (block.district === "Historic Core") {
    return base * (0.55 + rng() * 0.55);
  }
  if (block.district === "Downtown") {
    return base * (1.15 + rng() * 0.9);
  }
  if (block.district === "Civic District") {
    return base * (1.45 + rng() * 1.05);
  }
  return base * (0.9 + rng() * 0.9);
}

function rangeWithGap(start: number, end: number, gap: number): [number, number] {
  const width = end - start;
  const localGap = Math.min(gap, width * 0.22);
  return [start + localGap, end - localGap];
}

function scaledBlockRange(value: number, startMargin: number, endMargin: number): number {
  return startMargin + value * Math.max(0.1, 1 - startMargin - endMargin);
}

function frontageFor(block: Block): RoadHierarchy {
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

export function parcelFootprint(parcel: Parcel, profile?: CityProfile): Vec2[] {
  const alignment = clampProfileValue(profileNumber(profile?.buildings.streetAlignmentProbability, distributionValue(profile?.buildings.streetAlignment, 0.72)), 0.35, 0.94);
  const insetDistance = parcel.setback * (0.88 - alignment * 0.48);
  const inset = insetPolygon(parcel.polygon, insetDistance);
  const regularized = regularizeDeepNarrowFootprint(inset, parcel);
  const [minX, minY, maxX, maxY] = bbox(regularized);
  if (distance([minX, minY], [maxX, maxY]) < 7) {
    return insetPolygon(parcel.polygon, Math.max(0.6, parcel.setback * 0.35));
  }
  return regularized.map((p) => [round(p[0]), round(p[1])] as Vec2);
}

function regularizeDeepNarrowFootprint(footprint: Vec2[], parcel: Parcel): Vec2[] {
  const [minX, minY, maxX, maxY] = bbox(footprint);
  const width = maxX - minX;
  const depth = maxY - minY;
  const minSide = Math.min(width, depth);
  const maxSide = Math.max(width, depth);
  const maxAspect = parcel.district === "Historic Core" ? 3.6 : 3.3;
  if (minSide <= 0 || maxSide / minSide <= maxAspect) {
    return footprint;
  }
  if (width > depth) {
    return scalePolygon(footprint, (depth * maxAspect) / width, 1);
  }
  return scalePolygon(footprint, 1, (width * maxAspect) / depth);
}
