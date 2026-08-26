import type {LineFeature} from "../naturalEarth/loadNaturalEarth";
import type {EarthOptions, LineData, TileKey} from "../types";
import {densifyLineGeodesic} from "../geo/densifyGeodesic";
import {lonLatToXYZ} from "../geo/lonLatToXYZ";
import {createTiles, lineSegmentsForTile} from "../geo/tilePolygons";

export const COASTLINE_LAYER_ID = "coastlines";

export interface CoastlineBuildResult {
  lines: LineData[];
  segments: number;
}

export function buildCoastlines(features: LineFeature[], options: EarthOptions): CoastlineBuildResult {
  const tiles = createTiles(options.tileDegrees, options);
  const indexed = features.map((feature) => ({feature, bbox: featureBBox(feature)}));
  const lines: LineData[] = [];
  let segments = 0;
  for (const tile of tiles) {
    let part = 0;
    for (const {feature, bbox} of indexed) {
      if (!bboxIntersectsTile(bbox, tile)) continue;
      for (const clipped of lineSegmentsForTile(feature, tile)) {
        const dense = densifyLineGeodesic(clipped, options.maxEdgeAngle);
        if (dense.length < 2) continue;
        const positions = new Float64Array(dense.length * 3);
        const indices = new Uint32Array((dense.length - 1) * 2);
        for (let i = 0; i < dense.length; i++) {
          const [x, y, z] = lonLatToXYZ(dense[i], options.earthRadius + options.landOffset + options.coastlineOffset);
          positions[i * 3] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = z;
          if (i + 1 < dense.length) {
            indices[i * 2] = i;
            indices[i * 2 + 1] = i + 1;
            segments++;
          }
        }
        lines.push({
          id: `earth.coastline.tile.${tileId(tile)}.${String(part++).padStart(4, "0")}`,
          positions,
          indices,
          materialId: "earth.coastline",
          layerId: COASTLINE_LAYER_ID
        });
      }
    }
  }
  return {lines, segments};
}

function featureBBox(feature: LineFeature): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const line of feature.lines) {
    for (const p of line) {
      minLon = Math.min(minLon, p[0]);
      minLat = Math.min(minLat, p[1]);
      maxLon = Math.max(maxLon, p[0]);
      maxLat = Math.max(maxLat, p[1]);
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

function bboxIntersectsTile([minLon, minLat, maxLon, maxLat]: [number, number, number, number], tile: TileKey): boolean {
  if (maxLat < tile.minLat || minLat > tile.maxLat) return false;
  for (const shift of [-360, 0, 360]) {
    if (maxLon + shift >= tile.minLon && minLon + shift <= tile.maxLon) return true;
  }
  return false;
}

function tileId(tile: TileKey): string {
  return `${String(tile.x).padStart(2, "0")}.${String(tile.y).padStart(2, "0")}`;
}
