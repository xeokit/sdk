#!/usr/bin/env node
import path from "node:path";
import {Command} from "commander";
import {ensureNaturalEarthDataset} from "./naturalEarth/downloadNaturalEarth";
import {loadLineFeatures, loadPolygonFeatures} from "./naturalEarth/loadNaturalEarth";
import {buildLand} from "./globe/buildLand";
import {buildWater} from "./globe/buildWater";
import {buildCountryRegions, buildNeutralTerritories, countryRegionGroupFromObjectId} from "./globe/buildCountryRegions";
import {buildCountryDataArtifacts} from "./globe/buildCountryDataModel";
import {buildCoastlines} from "./globe/buildCoastlines";
import {buildCountryBoundaries} from "./globe/buildCountryBoundaries";
import {buildOcean} from "./globe/buildOcean";
import {validateLines, validateMeshes} from "./globe/validate";
import {writeDebugObj} from "./globe/debugObj";
import {buildSceneModel} from "./xeokit/buildSceneModel";
import {exportXGFStream} from "./xeokit/exportXGFStream";
import {writeFileAny} from "./util/files";
import type {BuildStats, EarthOptions, LineData, MeshData} from "./types";

const EARTH_RADIUS = 6371000;

async function main(): Promise<void> {
  const program = new Command()
    .name("earth-generator")
    .description("Build a streamable xeokit XGF Stream Earth dataset from Natural Earth 1:10m land/coastline geometry.")
    .option("--out <dir>", "output stream directory", "./dist/earth")
    .option("--force-download", "download and extract Natural Earth archives again", false)
    .option("--no-land", "skip ne_10m_land polygon geometry", false)
    .option("--water", "include tiled water polygon underlay geometry", false)
    .option("--country-regions", "include filled ne_10m_admin_0_countries meshes on the countryRegions layer", false)
    .option("--coastlines", "include ne_10m_coastline line geometry", false)
    .option("--country-boundaries", "include ne_10m_admin_0_boundary_lines_land on the countryBoundaries layer", false)
    .option("--ocean", "include a moderate-resolution ocean sphere", false)
    .option("--tile-degrees <number>", "geographic tile size in degrees", parseNumber, 10)
    .option("--max-edge-angle <number>", "maximum geodesic segment angle before densification", parseNumber, 0.1)
    .option("--simplify <number>", "reserved for future optional simplification; 0 preserves source detail", parseNumber, 0)
    .option("--earth-radius <number>", "base Earth radius in meters", parseNumber, EARTH_RADIUS)
    .option("--ocean-offset <number>", "ocean radius offset from base Earth radius in meters", parseNumber, -5000)
    .option("--land-offset <number>", "land height above ocean radius in meters", parseNumber, 1500)
    .option("--coastline-offset <number>", "coastline height above land in meters", parseNumber, 20)
    .option("--boundary-offset <number>", "country boundary height above land in meters", parseNumber, 35)
    .option("--chunk-size <number>", "target objects per XGF Stream chunk", parseNumber, 500)
    .option("--max-land-features <number>", "smoke-test limit for source land features; 0 means all", parseNumber, 0)
    .option("--max-country-region-features <number>", "smoke-test limit for source country-region features; 0 means all", parseNumber, 0)
    .option("--max-coastline-features <number>", "smoke-test limit for source coastline features; 0 means all", parseNumber, 0)
    .option("--max-boundary-features <number>", "smoke-test limit for source country boundary features; 0 means all", parseNumber, 0)
    .option("--min-lon <number>", "optional smoke-test longitude lower bound", parseNumber)
    .option("--max-lon <number>", "optional smoke-test longitude upper bound", parseNumber)
    .option("--min-lat <number>", "optional smoke-test latitude lower bound", parseNumber)
    .option("--max-lat <number>", "optional smoke-test latitude upper bound", parseNumber)
    .option("--verbose", "log progress and memory usage", false)
    .option("--debug-geojson", "write tiled intermediate land polygons", false)
    .option("--debug-obj", "write a Wavefront OBJ debug dump", false)
    .parse(process.argv);

  const options = normalizeOptions(program.opts());
  if (options.simplify !== 0) {
    throw new Error("--simplify is currently accepted only as 0; the default preserves Natural Earth 1:10m detail.");
  }
  logOptions(options);

  const meshes: MeshData[] = [];
  const lines: LineData[] = [];
  let landFeaturesCount = 0;
  let landPolygons = 0;
  let landRings = 0;
  let landObjects = 0;
  let landFeaturesForWater: any[] | null = null;

  if (options.land || options.water || options.countryRegions) {
    console.log("[earth-generator] loading Natural Earth land");
    const landShp = await ensureNaturalEarthDataset("ne_10m_land", options.forceDownload, options.verbose);
    const landFeaturesAll = await loadPolygonFeatures(landShp);
    const landFeatures = options.maxLandFeatures > 0 ? landFeaturesAll.slice(0, options.maxLandFeatures) : landFeaturesAll;
    landFeaturesForWater = landFeatures;
    if (options.land) {
      console.log(`[earth-generator] building land from ${landFeatures.length} source features`);
      const land = await buildLand(landFeatures, options);
      console.log(`[earth-generator] land meshes: ${land.meshes.length}`);
      meshes.push(...land.meshes);
      landFeaturesCount = land.features;
      landPolygons = land.polygons;
      landRings = land.rings;
      landObjects = land.meshes.length;
    }
  }

  let waterObjects = 0;
  if (options.water) {
    if (!landFeaturesForWater) {
      throw new Error("--water requires Natural Earth land features");
    }
    console.log(`[earth-generator] building water from ${landFeaturesForWater.length} source land features`);
    const water = buildWater(landFeaturesForWater, options);
    meshes.push(...water.meshes);
    waterObjects = water.meshes.length;
    console.log(`[earth-generator] water meshes: ${waterObjects}`);
  }

  let countryRegionFeatures = 0;
  let countryRegionObjects = 0;
  let countryDataFeatures: any[] = [];
  let countryObjectDataObjectIds: Record<string, string> = {};
  if (options.countryRegions) {
    if (!landFeaturesForWater) {
      throw new Error("--country-regions requires Natural Earth land features for neutral territories");
    }
    console.log("[earth-generator] loading Natural Earth country regions");
    const countryShp = await ensureNaturalEarthDataset("ne_10m_admin_0_countries", options.forceDownload, options.verbose);
    const countryAll = await loadPolygonFeatures(countryShp);
    const countrySource = options.maxCountryRegionFeatures > 0 ? countryAll.slice(0, options.maxCountryRegionFeatures) : countryAll;
    countryDataFeatures = countrySource;
    countryRegionFeatures = countrySource.length;
    console.log(`[earth-generator] building country regions from ${countrySource.length} source features`);
    const countries = buildCountryRegions(countrySource, options);
    meshes.push(...countries.meshes);
    countryObjectDataObjectIds = countries.objectDataObjectIds || {};
    console.log(`[earth-generator] country region meshes: ${countries.meshes.length}`);
    console.log("[earth-generator] building neutral territories");
    const neutral = buildNeutralTerritories(landFeaturesForWater, countrySource, options, countries.clippedByTile);
    meshes.push(...neutral.meshes);
    countryRegionObjects = countries.meshes.length + neutral.meshes.length;
    console.log(`[earth-generator] neutral territory meshes: ${neutral.meshes.length}`);
    console.log(`[earth-generator] country view meshes: ${countryRegionObjects}`);
  }

  let coastlineSegments = 0;
  let coastlineFeatures = 0;
  let coastlineObjects = 0;
  if (options.coastlines) {
    console.log("[earth-generator] loading Natural Earth coastline");
    const coastlineShp = await ensureNaturalEarthDataset("ne_10m_coastline", options.forceDownload, options.verbose);
    const coastlineAll = await loadLineFeatures(coastlineShp);
    const coastlineSource = options.maxCoastlineFeatures > 0 ? coastlineAll.slice(0, options.maxCoastlineFeatures) : coastlineAll;
    coastlineFeatures = coastlineSource.length;
    console.log(`[earth-generator] building coastlines from ${coastlineSource.length} source features`);
    const coast = buildCoastlines(coastlineSource, options);
    lines.push(...coast.lines);
    coastlineSegments = coast.segments;
    coastlineObjects = coast.lines.length;
    console.log(`[earth-generator] coastline objects: ${coastlineObjects}, segments: ${coastlineSegments}`);
  }

  let countryBoundarySegments = 0;
  let countryBoundaryFeatures = 0;
  let countryBoundaryObjects = 0;
  if (options.countryBoundaries) {
    console.log("[earth-generator] loading Natural Earth country boundaries");
    const boundaryShp = await ensureNaturalEarthDataset("ne_10m_admin_0_boundary_lines_land", options.forceDownload, options.verbose);
    const boundaryAll = await loadLineFeatures(boundaryShp);
    const boundarySource = options.maxBoundaryFeatures > 0 ? boundaryAll.slice(0, options.maxBoundaryFeatures) : boundaryAll;
    countryBoundaryFeatures = boundarySource.length;
    console.log(`[earth-generator] building country boundaries from ${boundarySource.length} source features`);
    const boundaries = buildCountryBoundaries(boundarySource, options);
    lines.push(...boundaries.lines);
    countryBoundarySegments = boundaries.segments;
    countryBoundaryObjects = boundaries.lines.length;
    console.log(`[earth-generator] country boundary objects: ${countryBoundaryObjects}, segments: ${countryBoundarySegments}`);
  }

  if (options.ocean) {
    console.log("[earth-generator] building ocean sphere");
    meshes.push(buildOcean(options.earthRadius + options.oceanOffset));
  }

  console.log("[earth-generator] validating geometry");
  if (meshes.length > 0) {
    validateMeshes(meshes, options.earthRadius + options.landOffset, options.tileDegrees);
  }
  validateLines(lines);
  if (options.debugObj) {
    await writeDebugObj(options.out, meshes, lines);
  }

  console.log("[earth-generator] building SceneModel");
  const {sceneModel, coordinateSystem} = buildSceneModel(meshes, lines);
  console.log("[earth-generator] exporting XGF Stream");
  const exportResult = await exportXGFStream(
    sceneModel,
    path.resolve(options.out),
    options.chunkSize,
    coordinateSystem,
    options.countryRegions ? countryRegionGroupFromObjectId : undefined
  );
  if (options.countryRegions) {
    const countryData = buildCountryDataArtifacts(countryDataFeatures, countryObjectDataObjectIds);
    await writeFileAny(path.join(options.out, "countries.datamodel.json"), countryData.dataModel);
    await writeFileAny(path.join(options.out, "countries.objectMap.json"), countryData.objectMap);
  }

  const stats: BuildStats = {
    sourceFeatures: landFeaturesCount + countryRegionFeatures + coastlineFeatures + countryBoundaryFeatures,
    sourcePolygons: landPolygons,
    sourceRings: landRings,
    landObjects,
    waterObjects,
    countryRegionObjects,
    coastlineObjects,
    countryBoundaryObjects,
    vertices: countVertices(meshes),
    triangles: countTriangles(meshes),
    coastlineSegments,
    countryBoundarySegments,
    chunks: exportResult.chunks,
    outputBytes: exportResult.bytes
  };
  console.log(JSON.stringify(stats, null, 2));
}

function normalizeOptions(opts: any): EarthOptions {
  return {
    out: String(opts.out),
    forceDownload: !!opts.forceDownload,
    land: opts.land !== false,
    water: !!opts.water,
    countryRegions: !!opts.countryRegions,
    coastlines: !!opts.coastlines,
    countryBoundaries: !!opts.countryBoundaries,
    ocean: !!opts.ocean,
    tileDegrees: positive(opts.tileDegrees, "tile-degrees"),
    maxEdgeAngle: positive(opts.maxEdgeAngle, "max-edge-angle"),
    simplify: Math.max(0, Number(opts.simplify || 0)),
    earthRadius: positive(opts.earthRadius, "earth-radius"),
    oceanOffset: Number(opts.oceanOffset),
    landOffset: Number(opts.landOffset),
    coastlineOffset: Number(opts.coastlineOffset),
    boundaryOffset: Number(opts.boundaryOffset),
    chunkSize: Math.max(1, Math.floor(positive(opts.chunkSize, "chunk-size"))),
    verbose: !!opts.verbose,
    debugGeojson: !!opts.debugGeojson,
    debugObj: !!opts.debugObj,
    maxLandFeatures: Math.max(0, Math.floor(Number(opts.maxLandFeatures || 0))),
    maxCountryRegionFeatures: Math.max(0, Math.floor(Number(opts.maxCountryRegionFeatures || 0))),
    maxCoastlineFeatures: Math.max(0, Math.floor(Number(opts.maxCoastlineFeatures || 0))),
    maxBoundaryFeatures: Math.max(0, Math.floor(Number(opts.maxBoundaryFeatures || 0))),
    minLon: optionalNumber(opts.minLon),
    maxLon: optionalNumber(opts.maxLon),
    minLat: optionalNumber(opts.minLat),
    maxLat: optionalNumber(opts.maxLat)
  };
}

function parseNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Expected a finite number, got ${value}`);
  return n;
}

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} must be positive`);
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function countVertices(meshes: MeshData[]): number {
  return meshes.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0);
}

function countTriangles(meshes: MeshData[]): number {
  return meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0);
}

function logOptions(options: EarthOptions): void {
  if (!options.verbose) return;
  console.log(`[earth-generator] options ${JSON.stringify(options)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
