import fs from "node:fs/promises";
import path from "node:path";
import type {CityObject, CityScene, MeshData} from "../types";
import {GLTFExporter} from "@xeokit/sdk/formats/gltf";
import {buildSceneModel, Z_UP_COORDINATE_SYSTEM} from "./XGFExporter";

export interface ThreeDTilesExportResult {
  outputDir: string;
  tileCount: number;
  contentCount: number;
}

export interface ThreeDTilesExportOptions {
  outputDir: string;
  gridCellSize?: number;
  maxObjectsPerTile?: number;
}

interface Bounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

interface TileBucket {
  id: string;
  x: number;
  y: number;
  objects: CityObject[];
  bounds: Bounds;
}

const GLTF_Y_UP_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, -1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const GLOBAL_OBJECT_TYPES = new Set(["Ground"]);

export async function exportThreeDTiles(cityScene: CityScene, options: ThreeDTilesExportOptions): Promise<ThreeDTilesExportResult> {
  const gridCellSize = options.gridCellSize ?? 260;
  const maxObjectsPerTile = options.maxObjectsPerTile ?? 420;
  const outputDir = options.outputDir;
  const tilesDir = path.join(outputDir, "tiles");

  await fs.rm(outputDir, {recursive: true, force: true});
  await fs.mkdir(tilesDir, {recursive: true});

  const objectBounds = new Map<string, Bounds>();
  const cityBounds = emptyBounds();
  const rootObjects: CityObject[] = [];
  const buckets = new Map<string, TileBucket>();

  for (const object of cityScene.objects) {
    const bounds = boundsForObject(object);
    if (!bounds) {
      continue;
    }
    objectBounds.set(object.id, bounds);
    includeBounds(cityBounds, bounds);

    if (GLOBAL_OBJECT_TYPES.has(object.type)) {
      rootObjects.push(object);
      continue;
    }

    const cx = (bounds.minX + bounds.maxX) * 0.5;
    const cy = (bounds.minY + bounds.maxY) * 0.5;
    const x = Math.floor(cx / gridCellSize);
    const y = Math.floor(cy / gridCellSize);
    const key = `${x},${y}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {id: tileId(x, y, 0), x, y, objects: [], bounds: emptyBounds()};
      buckets.set(key, bucket);
    }
    bucket.objects.push(object);
    includeBounds(bucket.bounds, bounds);
  }

  const childTiles: any[] = [];
  let contentCount = 0;
  if (rootObjects.length > 0) {
    await writeGLBForObjects(cityScene, rootObjects, path.join(outputDir, "root.glb"));
    contentCount++;
  }

  const splitBuckets = splitLargeBuckets([...buckets.values()], maxObjectsPerTile);
  splitBuckets.sort((a, b) => a.id.localeCompare(b.id));
  for (const bucket of splitBuckets) {
    const fileName = `${bucket.id}.glb`;
    await writeGLBForObjects(cityScene, bucket.objects, path.join(tilesDir, fileName));
    childTiles.push({
      boundingVolume: {box: boxFromBounds(bucket.bounds)},
      geometricError: 0,
      refine: "ADD",
      content: {uri: `tiles/${fileName}`},
      metadata: {
        class: "proceduralCityTile",
        properties: {
          tileId: bucket.id,
          gridX: bucket.x,
          gridY: bucket.y,
          objectCount: bucket.objects.length,
          triangleCount: triangleCount(bucket.objects)
        }
      }
    });
    contentCount++;
  }

  const root: any = {
    boundingVolume: {box: boxFromBounds(cityBounds)},
    geometricError: Math.max(128, gridCellSize * 1.5),
    refine: "ADD",
    children: childTiles,
    metadata: {
      class: "proceduralCityRoot",
      properties: {
        profile: cityScene.config.profileData?.name || "procedural city",
        buildingCount: cityScene.stats.buildings,
        tileCount: childTiles.length,
        triangleCount: cityScene.stats.triangles
      }
    }
  };
  if (rootObjects.length > 0) {
    root.content = {uri: "root.glb"};
  }

  const tileset = {
    asset: {
      version: "1.1",
      tilesetVersion: "xeokit-procedural-city-3dtiles/1.0"
    },
    schema: {
      classes: {
        proceduralCityRoot: {
          properties: {
            profile: {type: "STRING"},
            buildingCount: {type: "SCALAR", componentType: "UINT32"},
            tileCount: {type: "SCALAR", componentType: "UINT32"},
            triangleCount: {type: "SCALAR", componentType: "UINT32"}
          }
        },
        proceduralCityTile: {
          properties: {
            tileId: {type: "STRING"},
            gridX: {type: "SCALAR", componentType: "INT32"},
            gridY: {type: "SCALAR", componentType: "INT32"},
            objectCount: {type: "SCALAR", componentType: "UINT32"},
            triangleCount: {type: "SCALAR", componentType: "UINT32"}
          }
        }
      }
    },
    geometricError: root.geometricError,
    root
  };

  await fs.writeFile(path.join(outputDir, "tileset.json"), `${JSON.stringify(tileset, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputDir, "coordSys.json"), `${JSON.stringify(Z_UP_COORDINATE_SYSTEM, null, 2)}\n`, "utf8");

  return {
    outputDir,
    tileCount: childTiles.length,
    contentCount
  };
}

async function writeGLBForObjects(cityScene: CityScene, objects: CityObject[], filePath: string): Promise<void> {
  const {sceneModel} = buildSceneModel({
    ...cityScene,
    id: `${cityScene.id}-${path.basename(filePath, ".glb")}`,
    objects
  });
  const fileData = await new GLTFExporter().write({sceneModel}, {
    coordinateSystem: GLTF_Y_UP_COORDINATE_SYSTEM,
    ignoreNormals: true,
    ignoreUVs: true,
    yieldIntervalMs: 80
  });
  await fs.writeFile(filePath, Buffer.from(fileData));
}

function splitLargeBuckets(buckets: TileBucket[], maxObjectsPerTile: number): TileBucket[] {
  const out: TileBucket[] = [];
  for (const bucket of buckets) {
    if (bucket.objects.length <= maxObjectsPerTile) {
      out.push(bucket);
      continue;
    }
    for (let i = 0; i < bucket.objects.length; i += maxObjectsPerTile) {
      const part = bucket.objects.slice(i, i + maxObjectsPerTile);
      const bounds = emptyBounds();
      for (const object of part) {
        const objectBounds = boundsForObject(object);
        if (objectBounds) includeBounds(bounds, objectBounds);
      }
      out.push({
        id: tileId(bucket.x, bucket.y, Math.floor(i / maxObjectsPerTile) + 1),
        x: bucket.x,
        y: bucket.y,
        objects: part,
        bounds
      });
    }
  }
  return out;
}

function tileId(x: number, y: number, part: number): string {
  const sx = x < 0 ? `m${String(-x).padStart(3, "0")}` : `p${String(x).padStart(3, "0")}`;
  const sy = y < 0 ? `m${String(-y).padStart(3, "0")}` : `p${String(y).padStart(3, "0")}`;
  const suffix = part > 0 ? `-${String(part).padStart(2, "0")}` : "";
  return `tile-${sx}-${sy}${suffix}`;
}

function boundsForObject(object: CityObject): Bounds | null {
  const bounds = emptyBounds();
  for (const mesh of object.meshes) {
    includeMesh(bounds, mesh);
  }
  return isFiniteBounds(bounds) ? bounds : null;
}

function includeMesh(bounds: Bounds, mesh: MeshData): void {
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i] ?? 0;
    const y = mesh.positions[i + 1] ?? 0;
    const z = mesh.positions[i + 2] ?? 0;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.maxZ = Math.max(bounds.maxZ, z);
  }
}

function emptyBounds(): Bounds {
  return {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity
  };
}

function includeBounds(target: Bounds, source: Bounds): void {
  target.minX = Math.min(target.minX, source.minX);
  target.minY = Math.min(target.minY, source.minY);
  target.minZ = Math.min(target.minZ, source.minZ);
  target.maxX = Math.max(target.maxX, source.maxX);
  target.maxY = Math.max(target.maxY, source.maxY);
  target.maxZ = Math.max(target.maxZ, source.maxZ);
}

function isFiniteBounds(bounds: Bounds): boolean {
  return Number.isFinite(bounds.minX)
    && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.minZ)
    && Number.isFinite(bounds.maxX)
    && Number.isFinite(bounds.maxY)
    && Number.isFinite(bounds.maxZ);
}

function boxFromBounds(bounds: Bounds): number[] {
  const minX = bounds.minX;
  const minY = bounds.minY;
  const minZ = bounds.minZ;
  const maxX = bounds.maxX;
  const maxY = bounds.maxY;
  const maxZ = bounds.maxZ;
  return [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
    Math.max((maxX - minX) * 0.5, 0.01), 0, 0,
    0, Math.max((maxY - minY) * 0.5, 0.01), 0,
    0, 0, Math.max((maxZ - minZ) * 0.5, 0.01)
  ];
}

function triangleCount(objects: CityObject[]): number {
  let count = 0;
  for (const object of objects) {
    for (const mesh of object.meshes) {
      count += Math.floor(mesh.indices.length / 3);
    }
  }
  return count;
}
