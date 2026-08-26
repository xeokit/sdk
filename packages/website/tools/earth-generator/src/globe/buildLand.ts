import fs from "node:fs/promises";
import path from "node:path";
import type {PolygonFeature} from "../naturalEarth/loadNaturalEarth";
import type {EarthOptions, MeshData, MultiPolygon, TileKey} from "../types";
import {createTiles, clipFeatureToTile} from "../geo/tilePolygons";
import {triangulateTilePolygon} from "../geo/triangulatePolygon";
import {ensureDir} from "../util/files";

export interface LandBuildResult {
  meshes: MeshData[];
  features: number;
  polygons: number;
  rings: number;
}

export async function buildLand(features: PolygonFeature[], options: EarthOptions): Promise<LandBuildResult> {
  const tiles = createTiles(options.tileDegrees, options);
  const indexed = features.map((feature) => ({feature, bbox: featureBBox(feature)}));
  const meshes: MeshData[] = [];
  let polygons = 0;
  let rings = 0;
  const debugFeatures: any[] = [];

  for (const tile of tiles) {
    let part = 0;
    for (const {feature, bbox} of indexed) {
      if (!bboxIntersectsTile(bbox, tile)) continue;
      const clipped = clipFeatureToTile(feature, tile);
      if (clipped.length === 0) continue;
      polygons += countPolygons(clipped);
      rings += countRings(clipped);
      if (options.debugGeojson) {
        for (const poly of clipped) {
          debugFeatures.push({type: "Feature", properties: {tile: tileId(tile), source: feature.id}, geometry: {type: "Polygon", coordinates: poly}});
        }
      }
      for (const polygon of clipped) {
        const mesh = triangulateTilePolygon(
          polygon,
          tile,
          options.earthRadius + options.landOffset,
          options.maxEdgeAngle,
          `earth.land.tile.${tileId(tile)}.${String(part++).padStart(4, "0")}`,
          "earth.land"
        );
        if (mesh && mesh.indices.length > 0) meshes.push(mesh);
      }
    }
    if (options.verbose && part > 0) {
      console.log(`[earth-generator] land tile ${tileId(tile)}: ${part} polygon parts`);
    }
  }

  if (options.debugGeojson) {
    await ensureDir(path.join(options.out, "debug"));
    await fs.writeFile(path.join(options.out, "debug", "land.tiled.geojson"), `${JSON.stringify({type: "FeatureCollection", features: debugFeatures})}\n`);
  }
  return {meshes, features: features.length, polygons, rings};
}

function featureBBox(feature: PolygonFeature): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const poly of feature.geometry) {
    for (const ring of poly) {
      for (const p of ring) {
        minLon = Math.min(minLon, p[0]);
        minLat = Math.min(minLat, p[1]);
        maxLon = Math.max(maxLon, p[0]);
        maxLat = Math.max(maxLat, p[1]);
      }
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

function countPolygons(multi: MultiPolygon): number {
  return multi.length;
}

function countRings(multi: MultiPolygon): number {
  return multi.reduce((sum, poly) => sum + poly.length, 0);
}
