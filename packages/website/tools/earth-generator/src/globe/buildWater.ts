import type {PolygonFeature} from "../naturalEarth/loadNaturalEarth";
import type {EarthOptions, MeshData, MultiPolygon, TileKey} from "../types";
import {createTiles} from "../geo/tilePolygons";
import {triangulateTilePolygon} from "../geo/triangulatePolygon";

export interface WaterBuildResult {
  meshes: MeshData[];
  polygons: number;
  rings: number;
}

export function buildWater(_features: PolygonFeature[], options: EarthOptions): WaterBuildResult {
  const tiles = createTiles(options.tileDegrees, options);
  const meshes: MeshData[] = [];
  let polygons = 0;
  let rings = 0;

  for (const tile of tiles) {
    const water = tileWaterPolygon(tile);
    let part = 0;
    for (const polygon of water) {
      polygons++;
      rings += polygon.length;
      const mesh = triangulateTilePolygon(
        polygon,
        tile,
        options.earthRadius + options.landOffset - 500,
        options.maxEdgeAngle,
        `earth.water.tile.${tileId(tile)}.${String(part++).padStart(4, "0")}`,
        "earth.water"
      );
      if (mesh && mesh.indices.length > 0) {
        meshes.push(mesh);
      }
    }
    if (options.verbose && part > 0) {
      console.log(`[earth-generator] water tile ${tileId(tile)}: ${part} polygon parts`);
    }
  }

  return {meshes, polygons, rings};
}

function tileWaterPolygon(tile: TileKey): MultiPolygon {
  return [[[
    [tile.minLon, tile.minLat],
    [tile.maxLon, tile.minLat],
    [tile.maxLon, tile.maxLat],
    [tile.minLon, tile.maxLat],
    [tile.minLon, tile.minLat]
  ]]];
}

function tileId(tile: TileKey): string {
  return `${String(tile.x).padStart(2, "0")}.${String(tile.y).padStart(2, "0")}`;
}
