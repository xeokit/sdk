import type {PolygonFeature} from "../naturalEarth/loadNaturalEarth";
import type {EarthOptions, MeshData, MultiPolygon, TileKey} from "../types";
import {clipFeatureToTile, createTiles} from "../geo/tilePolygons";
import {triangulateTilePolygon} from "../geo/triangulatePolygon";

export const COUNTRY_REGION_LAYER_ID = "countryRegions";

export interface CountryRegionBuildResult {
  meshes: MeshData[];
  features: number;
  polygons: number;
  rings: number;
  clippedByTile?: Map<string, MultiPolygon>;
  objectDataObjectIds?: Record<string, string>;
}

export function buildCountryRegions(features: PolygonFeature[], options: EarthOptions): CountryRegionBuildResult {
  const tiles = createTiles(options.tileDegrees, options);
  const indexed = features.map((feature) => ({feature, bbox: featureBBox(feature)}));
  const meshes: MeshData[] = [];
  const clippedByTile = new Map<string, MultiPolygon>();
  const objectDataObjectIds: Record<string, string> = {};
  let polygons = 0;
  let rings = 0;

  for (const tile of tiles) {
    let part = 0;
    for (const {feature, bbox} of indexed) {
      if (!bboxIntersectsTile(bbox, tile)) continue;
      const clipped = clipFeatureToTile(feature, tile);
      if (clipped.length === 0) continue;
      const key = tileId(tile);
      let tileCountries = clippedByTile.get(key);
      if (!tileCountries) {
        tileCountries = [];
        clippedByTile.set(key, tileCountries);
      }
      tileCountries.push(...clipped);
      polygons += countPolygons(clipped);
      rings += countRings(clipped);
      for (const polygon of clipped) {
        const countryId = countryIdForFeature(feature);
        const objectId = `earth.countryRegion.country.${countryId}.tile.${tileId(tile)}.${String(feature.id).padStart(4, "0")}.${String(part++).padStart(4, "0")}`;
        const mesh = triangulateTilePolygon(
          polygon,
          tile,
          options.earthRadius + options.landOffset,
          options.maxEdgeAngle,
          objectId,
          "earth.countryRegion",
          COUNTRY_REGION_LAYER_ID
        );
        if (mesh && mesh.indices.length > 0) {
          meshes.push(mesh);
          objectDataObjectIds[objectId] = countryDataObjectIdForCountryId(countryId);
        }
      }
    }
    if (options.verbose && part > 0) {
      console.log(`[earth-generator] country region tile ${tileId(tile)}: ${part} polygon parts`);
    }
  }

  return {meshes, features: features.length, polygons, rings, clippedByTile, objectDataObjectIds};
}

export function buildNeutralTerritories(
  landFeatures: PolygonFeature[],
  countryFeatures: PolygonFeature[],
  options: EarthOptions,
  clippedCountriesByTile?: Map<string, MultiPolygon>
): CountryRegionBuildResult {
  const tiles = createTiles(options.tileDegrees, options);
  const countryBBoxes = countryFeatures.map(featureBBox);
  const landIndexed = landFeatures
    .map((feature) => ({feature, bbox: featureBBox(feature)}))
    .filter(({bbox}) => !countryBBoxes.some((countryBBox) => bboxIntersectsBBox(bbox, countryBBox)));
  const meshes: MeshData[] = [];
  let polygons = 0;
  let rings = 0;

  for (const tile of tiles) {
    let part = 0;
    for (const {feature, bbox} of landIndexed) {
      if (!bboxIntersectsTile(bbox, tile)) continue;
      const clippedLand = clipFeatureToTile(feature, tile);
      for (const landPolygon of clippedLand) {
        polygons++;
        rings += landPolygon.length;
        const mesh = triangulateTilePolygon(
          landPolygon,
          tile,
          options.earthRadius + options.landOffset,
          options.maxEdgeAngle,
          `earth.countryRegion.neutral.neutral-territory.tile.${tileId(tile)}.${String(feature.id).padStart(4, "0")}.${String(part++).padStart(4, "0")}`,
          "earth.neutralTerritory",
          COUNTRY_REGION_LAYER_ID
        );
        if (mesh && mesh.indices.length > 0) {
          meshes.push(mesh);
        }
      }
    }
    if (options.verbose && part > 0) {
      console.log(`[earth-generator] neutral territory tile ${tileId(tile)}: ${part} polygon parts`);
    }
  }

  return {meshes, features: landFeatures.length, polygons, rings};
}

export function countryRegionGroupFromObjectId(objectId: string): string | undefined {
  const match = /^earth\.countryRegion\.(country|neutral)\.([^.]+)\./.exec(objectId);
  return match ? `${match[1]}-${match[2]}` : undefined;
}

export function countryIdForFeature(feature: PolygonFeature): string {
  const props = feature.properties || {};
  const country = props.ADM0_A3 || props.ISO_A3 || props.SOV_A3 || props.GU_A3 || props.NAME_LONG || props.NAME || "unknown-country";
  return `${slug(String(country))}-${String(feature.id).padStart(4, "0")}`;
}

export function countryDataObjectIdForCountryId(countryId: string): string {
  return `earth.country.${countryId}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-country";
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

function bboxIntersectsBBox(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[2] >= b[0] && a[0] <= b[2] && a[3] >= b[1] && a[1] <= b[3];
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
