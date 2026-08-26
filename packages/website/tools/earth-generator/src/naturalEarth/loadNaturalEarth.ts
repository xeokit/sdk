import * as shapefile from "shapefile";
import type {MultiPolygon, Polygon, Ring} from "../types";

export interface PolygonFeature {
  id: number;
  geometry: MultiPolygon;
  properties?: Record<string, any>;
}

export interface LineFeature {
  id: number;
  lines: Ring[];
}

export async function loadPolygonFeatures(shpPath: string): Promise<PolygonFeature[]> {
  const source = await shapefile.open(shpPath);
  const features: PolygonFeature[] = [];
  let id = 0;
  while (true) {
    const next = await source.read();
    if (next.done) break;
    const geometry = next.value?.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      features.push({id: id++, geometry: [cleanPolygon(geometry.coordinates)], properties: next.value?.properties || undefined});
    } else if (geometry.type === "MultiPolygon") {
      features.push({id: id++, geometry: geometry.coordinates.map(cleanPolygon), properties: next.value?.properties || undefined});
    }
  }
  return features;
}

export async function loadLineFeatures(shpPath: string): Promise<LineFeature[]> {
  const source = await shapefile.open(shpPath);
  const features: LineFeature[] = [];
  let id = 0;
  while (true) {
    const next = await source.read();
    if (next.done) break;
    const geometry = next.value?.geometry;
    if (!geometry) continue;
    if (geometry.type === "LineString") {
      features.push({id: id++, lines: [cleanRing(geometry.coordinates)]});
    } else if (geometry.type === "MultiLineString") {
      features.push({id: id++, lines: geometry.coordinates.map(cleanRing)});
    }
  }
  return features;
}

function cleanPolygon(poly: number[][][]): Polygon {
  return poly.map(cleanRing).filter((ring) => ring.length >= 4);
}

function cleanRing(ring: number[][]): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const lon = Number(p[0]);
    const lat = Number(p[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      const prev = out[out.length - 1];
      if (!prev || prev[0] !== lon || prev[1] !== lat) {
        out.push([lon, lat]);
      }
    }
  }
  return out;
}
