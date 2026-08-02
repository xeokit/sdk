import fs from "node:fs/promises";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

export interface OSMFeature {
  id: string;
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

export interface OSMExtract {
  inputPath: string;
  features: OSMFeature[];
  bounds: [number, number, number, number];
  projection: {
    units: "meters";
    center: [number, number];
    source: "geographic" | "projected";
  };
}

export async function loadOSMExtract(inputPath: string): Promise<OSMExtract> {
  const ext = path.extname(inputPath).toLowerCase();
  if (inputPath.endsWith(".osm.pbf") || ext === ".pbf") {
    return projectExtract(parseGeoJSON(await loadPBFViaOsmium(inputPath), inputPath));
  }
  const text = await fs.readFile(inputPath, "utf8");
  if (ext === ".geojson" || ext === ".json") {
    return projectExtract(parseGeoJSON(JSON.parse(text), inputPath));
  }
  if (ext === ".osm" || ext === ".xml") {
    return projectExtract(parseOSMXML(text, inputPath));
  }
  throw new Error(`Unsupported OSM input: ${inputPath}. Use .geojson, .json, .osm, .xml, or .osm.pbf with osmium installed.`);
}

function parseGeoJSON(json: any, inputPath: string): OSMExtract {
  const features = (json.type === "FeatureCollection" ? json.features : [json])
    .filter((feature: any) => feature && feature.geometry)
    .map((feature: any, index: number) => ({
      id: String(feature.id ?? feature.properties?.id ?? feature.properties?.["@id"] ?? `feature-${index}`),
      properties: feature.properties || {},
      geometry: feature.geometry
    }));
  return {
    inputPath,
    features,
    bounds: [0, 0, 0, 0],
    projection: {units: "meters", center: [0, 0], source: "geographic"}
  };
}

function parseOSMXML(xml: string, inputPath: string): OSMExtract {
  const nodes = new Map<string, [number, number]>();
  const features: OSMFeature[] = [];
  for (const match of xml.matchAll(/<node\b([^>]*)\/?>/g)) {
    const attrs = attrsFrom(match[1]);
    if (attrs.id && attrs.lon && attrs.lat) {
      nodes.set(attrs.id, [Number(attrs.lon), Number(attrs.lat)]);
    }
  }
  for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
    const attrs = attrsFrom(match[1]);
    const body = match[2];
    const refs = Array.from(body.matchAll(/<nd\b([^>]*)\/>/g)).map((nd) => attrsFrom(nd[1]).ref).filter(Boolean);
    const tags = Object.fromEntries(Array.from(body.matchAll(/<tag\b([^>]*)\/>/g)).map((tag) => {
      const tagAttrs = attrsFrom(tag[1]);
      return [tagAttrs.k, tagAttrs.v];
    }).filter(([key]) => key));
    const coords = refs.map((ref) => nodes.get(ref)).filter(Boolean) as [number, number][];
    if (coords.length < 2) {
      continue;
    }
    const closed = coords.length > 3 && refs[0] === refs[refs.length - 1];
    features.push({
      id: attrs.id || `way-${features.length}`,
      properties: tags,
      geometry: closed
        ? {type: "Polygon", coordinates: [coords]}
        : {type: "LineString", coordinates: coords}
    });
  }
  return {
    inputPath,
    features,
    bounds: [0, 0, 0, 0],
    projection: {units: "meters", center: [0, 0], source: "geographic"}
  };
}

async function loadPBFViaOsmium(inputPath: string): Promise<unknown> {
  try {
    const {stdout} = await execFileAsync("osmium", ["export", "-f", "geojson", "-o", "-", inputPath], {
      maxBuffer: 512 * 1024 * 1024
    });
    return JSON.parse(stdout);
  } catch (error: any) {
    throw new Error(`Unable to read .osm.pbf directly. Install osmium-tool or convert to GeoJSON first. Details: ${error.message}`);
  }
}

function projectExtract(extract: OSMExtract): OSMExtract {
  const coords = extract.features.flatMap((feature) => collectCoordinates(feature.geometry.coordinates));
  if (coords.length === 0) {
    return extract;
  }
  const lonLatBounds = boundsFor(coords);
  const geographic = lonLatBounds[0] >= -180 && lonLatBounds[2] <= 180 && lonLatBounds[1] >= -90 && lonLatBounds[3] <= 90;
  const center: [number, number] = [(lonLatBounds[0] + lonLatBounds[2]) / 2, (lonLatBounds[1] + lonLatBounds[3]) / 2];
  const metersPerLon = geographic ? 111320 * Math.cos(center[1] * Math.PI / 180) : 1;
  const metersPerLat = geographic ? 110540 : 1;
  for (const feature of extract.features) {
    feature.geometry.coordinates = mapCoordinates(feature.geometry.coordinates, (coord) => [
      (coord[0] - center[0]) * metersPerLon,
      (coord[1] - center[1]) * metersPerLat
    ]);
  }
  const projected = extract.features.flatMap((feature) => collectCoordinates(feature.geometry.coordinates));
  return {
    ...extract,
    bounds: boundsFor(projected),
    projection: {units: "meters", center, source: geographic ? "geographic" : "projected"}
  };
}

function collectCoordinates(value: unknown): [number, number][] {
  if (!Array.isArray(value)) {
    return [];
  }
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    return [[value[0], value[1]]];
  }
  return value.flatMap((entry) => collectCoordinates(entry));
}

function mapCoordinates(value: unknown, map: (coord: [number, number]) => [number, number]): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    return map([value[0], value[1]]);
  }
  return value.map((entry) => mapCoordinates(entry, map));
}

function boundsFor(coords: [number, number][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const coord of coords) {
    minX = Math.min(minX, coord[0]);
    minY = Math.min(minY, coord[1]);
    maxX = Math.max(maxX, coord[0]);
    maxY = Math.max(maxY, coord[1]);
  }
  return [minX, minY, maxX, maxY];
}

function attrsFrom(value: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of value.matchAll(/([:\w-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXML(match[2]);
  }
  return attrs;
}

function decodeXML(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
