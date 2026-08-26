import fs from "node:fs/promises";
import path from "node:path";
import {exportXGFStream} from "./export/XGFExporter";
import type {CityObject, CityScene, MaterialDefinition, MeshData, Vec2} from "./types";

const rootDir = resolveRepoRoot(process.cwd());
const DEFAULT_OUTPUT = path.join(rootDir, "packages/website/models/LODBenchmarkLandscape/xgfstream");
const DEFAULT_REPORT = path.join(rootDir, "packages/website/models/LODBenchmarkLandscape/report.json");
const DEFAULT_METADATA = path.join(rootDir, "packages/website/models/LODBenchmarkLandscape/metadata.json");
const SIZE = 2400;
const GRID = 8;
const CELL_SIZE = SIZE / GRID;

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  const seed = Number(args.seed || 93);
  const outputDir = path.resolve(String(args.output || DEFAULT_OUTPUT));
  const reportPath = path.resolve(String(args.report || DEFAULT_REPORT));
  const metadataPath = path.resolve(String(args.metadata || DEFAULT_METADATA));
  const scene = createLandscape(seed);

  const result = await exportXGFStream(scene, {
    outputDir,
    chunkBudget: Number(args["chunk-budget"] || 520),
    minChunkBudget: Number(args["min-chunk-budget"] || 80),
    gridCellSize: Number(args["grid-cell-size"] || CELL_SIZE),
    chunkRepSets: {
      idPrefix: "lod-benchmark-landscape-chunk",
      allRepId: "all",
      regularRepId: "regular",
      dominantRepId: "dominant",
      allMinPixels: 2200,
      regularMinPixels: 1150,
      regularMaxPixels: 2200,
      dominantMaxPixels: 1150,
      hysteresisPixels: 160
    }
  });

  const manifest = createMetadata(scene, seed);
  const report = createReport(scene);
  await fs.mkdir(path.dirname(metadataPath), {recursive: true});
  await fs.mkdir(path.dirname(reportPath), {recursive: true});
  await fs.writeFile(metadataPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Generated LOD benchmark landscape seed=${seed}`);
  console.log(`Objects: ${scene.objects.length.toLocaleString()}`);
  console.log(`Dominant objects: ${scene.objects.filter((object) => object.metadata.lodRole === "dominant").length.toLocaleString()}`);
  console.log(`Regular objects: ${scene.objects.filter((object) => object.metadata.lodRole === "regular").length.toLocaleString()}`);
  console.log(`Detail objects: ${scene.objects.filter((object) => object.metadata.lodRole === "detail").length.toLocaleString()}`);
  console.log(`Triangles: ${scene.stats.triangles.toLocaleString()}`);
  console.log(`Stream chunks: ${result.chunkCount}`);
  console.log(`Stream files: ${result.fileCount}`);
  console.log(`Wrote ${path.relative(rootDir, path.join(outputDir, "index.runtime.json"))}`);
  console.log(`Wrote ${path.relative(rootDir, metadataPath)}`);
  console.log(`Wrote ${path.relative(rootDir, reportPath)}`);
}

function createLandscape(seed: number): CityScene {
  const random = mulberry32(seed);
  const objects: CityObject[] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const x0 = -SIZE / 2 + col * CELL_SIZE;
      const y0 = -SIZE / 2 + row * CELL_SIZE;
      const cx = x0 + CELL_SIZE / 2;
      const cy = y0 + CELL_SIZE / 2;
      const tileId = `landform-${row}-${col}`;
      objects.push({
        id: tileId,
        name: `Terrain tile ${row}, ${col}`,
        type: "Terrain",
        layerId: "blocks",
        meshes: [terrainMesh(x0, y0, CELL_SIZE, 18, "alpine-grass")],
        metadata: {
          id: tileId,
          type: "Terrain",
          center: [round(cx), round(cy)],
          lodRole: "dominant"
        }
      });

      for (let i = 0; i < 18; i++) {
        const x = x0 + 24 + random() * (CELL_SIZE - 48);
        const y = y0 + 24 + random() * (CELL_SIZE - 48);
        const h = heightAt(x, y);
        const radius = 8 + random() * 18;
        const objectId = `ridge-${row}-${col}-${i}`;
        objects.push({
          id: objectId,
          name: `Mid-detail ridge ${row}, ${col}, ${i}`,
          type: "LandscapeFeature",
          layerId: "landmarks",
          meshes: [rockMesh(x, y, h, radius, 3 + random() * 10, "granite")],
          metadata: {
            id: objectId,
            type: "LandscapeFeature",
            lodRole: "regular"
          }
        });
      }

      for (let i = 0; i < 190; i++) {
        const x = x0 + 10 + random() * (CELL_SIZE - 20);
        const y = y0 + 10 + random() * (CELL_SIZE - 20);
        const h = heightAt(x, y);
        const tree = random() < 0.62;
        const objectId = `${tree ? "tree" : "ground-detail"}-${row}-${col}-${i}`;
        objects.push({
          id: objectId,
          name: `${tree ? "Tree" : "Ground detail"} ${row}, ${col}, ${i}`,
          type: tree ? "Vegetation" : "GroundDetail",
          layerId: tree ? "vegetation" : "streetFurniture",
          meshes: tree
            ? treeMeshes(x, y, h, 5 + random() * 8, 10 + random() * 18)
            : [rockMesh(x, y, h, 1.5 + random() * 4.2, 0.8 + random() * 2.4, random() < 0.4 ? "wildflower" : "granite")],
          metadata: {
            id: objectId,
            type: tree ? "Vegetation" : "GroundDetail",
            lodRole: "detail"
          }
        });
      }
    }
  }

  return {
    id: `LODBenchmarkLandscape-${seed}`,
    config: {
      seed,
      size: SIZE,
      style: "european",
      density: "high",
      outputPath: path.join(DEFAULT_OUTPUT, "index.runtime.json")
    },
    materials: createMaterials(),
    objects,
    blocks: [],
    roads: [],
    metadata: {},
    stats: {
      buildings: 0,
      blocks: GRID * GRID,
      roads: 0,
      parks: GRID * GRID,
      landmarks: GRID * GRID * 18,
      trees: objects.filter((object) => object.type === "Vegetation").length,
      streetFurniture: objects.filter((object) => object.type === "GroundDetail").length,
      waterways: 0,
      bridges: 0,
      triangles: countTriangles(objects)
    }
  };
}

function createMaterials(): MaterialDefinition[] {
  return [
    {id: "alpine-grass", color: [0.42, 0.58, 0.34], roughness: 0.9},
    {id: "granite", color: [0.44, 0.45, 0.42], roughness: 0.82},
    {id: "bark", color: [0.32, 0.22, 0.13], roughness: 0.9},
    {id: "pine", color: [0.12, 0.34, 0.22], roughness: 0.86},
    {id: "wildflower", color: [0.74, 0.62, 0.28], roughness: 0.75}
  ];
}

function terrainMesh(x0: number, y0: number, size: number, segments: number, materialId: string): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= segments; y++) {
    for (let x = 0; x <= segments; x++) {
      const px = x0 + (x / segments) * size;
      const py = y0 + (y / segments) * size;
      positions.push(px, py, heightAt(px, py) - 2);
      normals.push(0, 0, 1);
    }
  }
  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  return {materialId, positions, normals, indices};
}

function treeMeshes(x: number, y: number, z: number, radius: number, height: number): MeshData[] {
  return [
    boxMesh(x, y, z + height * 0.18, radius * 0.16, radius * 0.16, height * 0.36, "bark"),
    coneMesh(x, y, z + height * 0.36, radius, height * 0.78, 8, "pine")
  ];
}

function rockMesh(x: number, y: number, z: number, radius: number, height: number, materialId: string): MeshData {
  return boxMesh(x, y, z + height / 2, radius, radius * 0.72, height, materialId);
}

function boxMesh(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, materialId: string): MeshData {
  const x0 = cx - sx / 2;
  const x1 = cx + sx / 2;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const z0 = cz - sz / 2;
  const z1 = cz + sz / 2;
  const positions = [
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1
  ];
  const indices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7
  ];
  return {materialId, positions, normals: positions.map(() => 0), indices};
}

function coneMesh(cx: number, cy: number, z: number, radius: number, height: number, sides: number, materialId: string): MeshData {
  const positions: number[] = [cx, cy, z + height];
  const normals: number[] = [0, 0, 1];
  const indices: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    positions.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, z);
    normals.push(0, 0, 1);
  }
  positions.push(cx, cy, z);
  normals.push(0, 0, -1);
  const centerIndex = sides + 1;
  for (let i = 0; i < sides; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % sides);
    indices.push(0, a, b, centerIndex, b, a);
  }
  return {materialId, positions, normals, indices};
}

function heightAt(x: number, y: number): number {
  return 34 * Math.sin(x * 0.0042) + 28 * Math.cos(y * 0.0037) + 16 * Math.sin((x + y) * 0.006);
}

function createMetadata(scene: CityScene, seed: number): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const object of scene.objects) {
    metadata[object.id] = object.metadata;
  }
  metadata["city-profile"] = {
    id: "city-profile",
    type: "BenchmarkProfile",
    name: "lod-benchmark-landscape",
    description: "Intentionally expensive detailed landscape with plausible but much cheaper lower representations."
  };
  return {
    schema: "xeokit-procedural-city-manifest/1.0",
    seed,
    profile: {
      name: "lod-benchmark-landscape"
    },
    stats: scene.stats,
    objects: scene.objects.map((object) => ({
      id: object.id,
      type: object.type,
      layerId: object.layerId,
      metadata: object.metadata
    })),
    metadata
  };
}

function createReport(scene: CityScene): Record<string, unknown> {
  return {
    profileName: "lod-benchmark-landscape",
    metrics: [
      {
        label: "Detailed representation objects",
        source: scene.objects.length,
        generated: scene.objects.filter((object) => object.metadata.lodRole === "detail").length,
        unit: "objects",
        ok: true
      },
      {
        label: "Reduced representation objects",
        source: scene.objects.length,
        generated: scene.objects.filter((object) => object.metadata.lodRole === "dominant").length,
        unit: "objects",
        ok: true
      }
    ],
    warnings: []
  };
}

function countTriangles(objects: CityObject[]): number {
  return objects.reduce((sum, object) => (
    sum + object.meshes.reduce((meshSum, mesh) => meshSum + Math.floor(mesh.indices.length / 3), 0)
  ), 0);
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`Usage:
  node packages/website/tools/city-generator/build-lod-benchmark-landscape.mjs [options]

Options:
  --seed <value>            Deterministic seed, default 93
  --output <path>           XGF stream output directory
  --metadata <path>         Metadata JSON output path
  --report <path>           Report JSON output path
  --chunk-budget <n>        XGF stream chunk mesh budget, default 520
  --min-chunk-budget <n>    Minimum merged XGF stream chunk budget, default 80
  --grid-cell-size <m>      Stream grid cell size, default ${CELL_SIZE}
`);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveRepoRoot(cwd: string): string {
  if (path.basename(cwd) === "website" && path.basename(path.dirname(cwd)) === "packages") {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}
