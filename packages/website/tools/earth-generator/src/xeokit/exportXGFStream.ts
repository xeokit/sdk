import fs from "node:fs/promises";
import path from "node:path";
import {XGFStreamExporter} from "@xeokit/sdk/formats/xgfstream";
import {dirBytes, emptyDir, exists, writeFileAny} from "../util/files";

export interface ExportResult {
  files: number;
  chunks: number;
  bytes: number;
}

export async function exportXGFStream(
  sceneModel: any,
  outDir: string,
  chunkSize: number,
  coordinateSystem: any,
  chunkGroupByObjectId?: (objectId: string) => string | undefined
): Promise<ExportResult> {
  await emptyDir(outDir);
  const stream = await new XGFStreamExporter().write({sceneModel}, {
    coordinateSystem,
    partition: "grid",
    chunkMetric: "objects",
    chunkSize,
    assetId: "earth-assets",
    assetLibraryChunkSize: 16,
    sharedAssetMinLibraryUses: 2,
    sharedAssetMode: "global",
    sharedAssetShardSize: 512,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    chunkGroupByObjectId,
    yieldIntervalMs: 80
  });
  for (const [uri, data] of Object.entries(stream.files)) {
    await writeFileAny(path.join(outDir, uri), data);
  }
  await validateStreamFiles(outDir, stream.index);
  return {
    files: Object.keys(stream.files).length,
    chunks: stream.manifests.filter((manifest: any) => manifest.role !== "asset-library").length,
    bytes: await dirBytes(outDir)
  };
}

async function validateStreamFiles(outDir: string, index: any): Promise<void> {
  if (!(await exists(path.join(outDir, "index.json")))) throw new Error("Missing index.json");
  if (!(await exists(path.join(outDir, "index.runtime.json")))) throw new Error("Missing index.runtime.json");
  const manifests = index.chunks || [];
  if (!manifests.some((m: any) => m.role !== "asset-library")) throw new Error("XGF Stream contains no reference chunks");
  for (const manifest of manifests) {
    if (!manifest.uri) continue;
    const filePath = path.join(outDir, manifest.uri);
    if (!(await exists(filePath))) throw new Error(`index.json references missing file ${manifest.uri}`);
    if ((await fs.stat(filePath)).size <= 0) throw new Error(`Generated XGF file is empty: ${manifest.uri}`);
  }
}
