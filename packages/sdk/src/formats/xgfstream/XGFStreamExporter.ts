import {ModelExporter} from "../ModelExporter";
import type {ModelEncodeParams} from "../ModelEncodeParams";
import type {ModelExportOptions} from "../ModelExportOptions";
import type {SceneModel} from "../../model/scene";
import {XGFStreamingExporter} from "./XGFStreamingExporter";
import type {XGFAssetLibraryExportSpec} from "./export/XGFAssetLibraryExportSpec";
import type {XGFStreamingChunkExportSpec} from "./export/XGFStreamingChunkExportSpec";
import type {XGFChunkManifest} from "./chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "./index/XGFStreamingIndex";
import type {XGFStreamingRuntimeIndex} from "./index/XGFStreamingRuntimeIndex";

/**
 * Strategy used by {@link XGFStreamExporter} to partition SceneObjects into
 * references-only stream chunks.
 */
export type XGFStreamPartitionMode = "object-order" | "grid";

/**
 * Cost metric used when partitioning a SceneModel into stream chunks.
 */
export type XGFStreamChunkMetric = "objects" | "meshes" | "geometry-bytes";

/**
 * Export options for {@link XGFStreamExporter}.
 */
export interface XGFStreamExportOptions extends ModelExportOptions {
  /** Chunk partitioning strategy. Defaults to `"grid"`. */
  partition?: XGFStreamPartitionMode;
  /** Target object count for object-order partitioning, and fallback budget for grid partitioning. Defaults to `500`. */
  chunkSize?: number;
  /** Cost metric for grid partitioning. Defaults to `"objects"`. */
  chunkMetric?: XGFStreamChunkMetric;
  /** Target per-chunk budget for the selected metric. Defaults to `chunkSize`. */
  chunkBudget?: number;
  /** Minimum chunk budget before adjacent small grid groups are merged. */
  minChunkBudget?: number;
  /** Explicit grid cell size. When omitted, the exporter estimates one. */
  gridCellSize?: number;
  /** Directory, relative to the stream root, where chunk XGFs are written. */
  chunkDir?: string;
  /** URI prefix written into generated manifests. */
  baseUri?: string;
  /** Base ID used for generated asset-library chunks. */
  assetId?: string;
  /** Maximum number of shared assets per generated asset-library chunk. */
  assetLibraryChunkSize?: number;
  /** Minimum reuse count before an asset is moved into a shared library. */
  sharedAssetMinLibraryUses?: number;
  /** Human-readable stream index filename. Defaults to `"index.json"`. */
  index?: string;
  /** Optional compact runtime index filename. */
  runtimeIndex?: string;
  /** Experimental: write each references-only chunk as one SceneObject containing all chunk meshes. */
  collapseChunkObjects?: boolean;
}

/**
 * File map returned by {@link XGFStreamExporter.write}.
 */
export interface XGFStreamFileMap {
  /** Generated files keyed by stream-relative URI. */
  files: Record<string, ArrayBuffer | XGFChunkManifest | XGFStreamingIndex | XGFStreamingRuntimeIndex>;
  /** Human-readable stream index. */
  index: XGFStreamingIndex;
  /** Chunk manifests embedded in the stream index. */
  manifests: XGFChunkManifest[];
}

/**
 * Exports a SceneModel as an XGF Stream dataset: an index plus multiple XGF v2
 * asset-library and references-only chunk files.
 */
export class XGFStreamExporter extends ModelExporter {
  constructor() {
    super({
      format: "XGFStream",
      fileDataType: "filemap",
      encoders: {
        "1.0.0": encodeXGFStream
      },
      defaultVersion: "1.0.0"
    });
  }
}

async function encodeXGFStream(params: ModelEncodeParams, options: XGFStreamExportOptions = {}): Promise<XGFStreamFileMap> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    throw new Error("[XGFStreamExporter.write] params.sceneModel expected");
  }

  const chunkSize = positiveInteger(options.chunkSize, 500);
  const partition = options.partition || "grid";
  const chunkMetric = options.chunkMetric || "objects";
  const chunkBudget = positiveNumber(options.chunkBudget, chunkSize);
  const minChunkBudget = positiveNumber(options.minChunkBudget, Math.max(1, chunkBudget * 0.25));
  const gridCellSize = options.gridCellSize !== undefined ? positiveNumber(options.gridCellSize, 0) : undefined;
  const baseUri = trimSlashes(options.baseUri || "");
  const chunkDirName = trimSlashes(options.chunkDir || "chunks");
  const assetId = options.assetId || "assets";
  const indexName = options.index || "index.json";

  const objectIds = Object.keys(sceneModel.objects).sort();
  if (objectIds.length === 0) {
    throw new Error("[XGFStreamExporter.write] SceneModel contains no objects");
  }

  const chunks = createChunkSpecs({
    sceneModel,
    objectIds,
    partition,
    chunkSize,
    chunkMetric,
    chunkBudget,
    minChunkBudget,
    gridCellSize,
    baseUri,
    chunkDirName,
    assetId
  });
  const assetLibraries = createAssetLibrarySpecs({
    sceneModel,
    chunks,
    objectIds,
    assetId,
    assetLibraryChunkSize: positiveInteger(options.assetLibraryChunkSize, 0),
    sharedAssetMinLibraryUses: positiveInteger(options.sharedAssetMinLibraryUses, 2),
    baseUri,
    chunkDirName
  });

  const result = await new XGFStreamingExporter().write({
    sceneModel,
    assetLibraries,
    chunks,
    indexUri: joinUri(baseUri, indexName),
    runtimeIndexUri: options.runtimeIndex ? joinUri(baseUri, options.runtimeIndex) : undefined,
    collapseChunkObjects: options.collapseChunkObjects === true
  });
  if (result.ok === false) {
    throw new Error(result.error);
  }
  return result.value;
}

function createChunkSpecs(params: {
  sceneModel: SceneModel;
  objectIds: string[];
  partition: XGFStreamPartitionMode;
  chunkSize: number;
  chunkMetric: XGFStreamChunkMetric;
  chunkBudget: number;
  minChunkBudget: number;
  gridCellSize?: number;
  baseUri: string;
  chunkDirName: string;
  assetId: string;
}): XGFStreamingChunkExportSpec[] {
  if (params.partition === "object-order") {
    return createObjectOrderChunkSpecs(params);
  }
  if (params.partition === "grid") {
    return createGridChunkSpecs(params);
  }
  throw new Error(`[XGFStreamExporter.write] Unsupported partition '${params.partition}'`);
}

function createObjectOrderChunkSpecs(params: {
  objectIds: string[];
  chunkSize: number;
  baseUri: string;
  chunkDirName: string;
  assetId: string;
}): XGFStreamingChunkExportSpec[] {
  const chunks: XGFStreamingChunkExportSpec[] = [];
  for (let offset = 0, chunkIndex = 0; offset < params.objectIds.length; offset += params.chunkSize, chunkIndex++) {
    const id = numberedChunkId(chunkIndex);
    chunks.push(createChunkSpec(id, params.objectIds.slice(offset, offset + params.chunkSize), chunkIndex, params.baseUri, params.chunkDirName, params.assetId));
  }
  return chunks;
}

function createGridChunkSpecs(params: {
  sceneModel: SceneModel;
  objectIds: string[];
  chunkMetric: XGFStreamChunkMetric;
  chunkBudget: number;
  minChunkBudget: number;
  gridCellSize?: number;
  baseUri: string;
  chunkDirName: string;
  assetId: string;
}): XGFStreamingChunkExportSpec[] {
  const records: any[] = [];
  const unboundedObjectIds: string[] = [];
  const modelAABB = collapseAABB3();
  for (const objectId of params.objectIds) {
    const sceneObject = params.sceneModel.objects[objectId];
    const aabb = computeObjectAABB(sceneObject);
    if (!aabb) {
      unboundedObjectIds.push(objectId);
      continue;
    }
    expandAABB3(modelAABB, aabb);
    records.push({
      id: objectId,
      aabb,
      center: aabbCenter(aabb),
      cost: estimateObjectCost(sceneObject, params.chunkMetric)
    });
  }
  if (records.length === 0) {
    return createObjectOrderChunkSpecs({
      objectIds: params.objectIds,
      chunkSize: Math.max(1, Math.floor(params.chunkBudget)),
      baseUri: params.baseUri,
      chunkDirName: params.chunkDirName,
      assetId: params.assetId
    });
  }

  const totalCost = sumRecordCost(records);
  const cellSize = params.gridCellSize || autoGridCellSize(modelAABB, totalCost, params.chunkBudget);
  const buckets = new Map<string, {coord: number[]; records: any[]}>();
  for (const record of records) {
    const coord = gridCoord(record.center, modelAABB, cellSize);
    const key = coord.join(",");
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {coord, records: []};
      buckets.set(key, bucket);
    }
    bucket.records.push(record);
  }

  let spatialGroups: any[] = [];
  for (const bucket of Array.from(buckets.values()).sort(compareBucket)) {
    for (const group of splitOversizedGroup(bucket.records, params.chunkBudget)) {
      spatialGroups.push(createSpatialGroup(bucket.coord, group));
    }
  }
  spatialGroups = mergeUndersizedGroups(spatialGroups, params.minChunkBudget, params.chunkBudget);

  const chunks: XGFStreamingChunkExportSpec[] = [];
  let chunkIndex = 0;
  for (const group of spatialGroups) {
    const suffix = group.coord.map((value: number, axis: number) => `${"xyz"[axis]}${signedCoord(value)}`).join("-");
    const part = countCoordOccurrence(chunks, suffix);
    const id = `${numberedChunkId(chunkIndex)}-${suffix}${part > 0 ? `-${part}` : ""}`;
    chunks.push(createChunkSpec(id, group.records.map((record: any) => record.id).sort(), chunkIndex, params.baseUri, params.chunkDirName, params.assetId));
    chunkIndex++;
  }
  const unboundedChunkSize = Math.max(1, Math.floor(params.chunkBudget));
  for (let offset = 0; offset < unboundedObjectIds.length; offset += unboundedChunkSize) {
    const id = `${numberedChunkId(chunkIndex)}-unbounded`;
    chunks.push(createChunkSpec(id, unboundedObjectIds.slice(offset, offset + unboundedChunkSize), chunkIndex, params.baseUri, params.chunkDirName, params.assetId));
    chunkIndex++;
  }
  return chunks;
}

function createChunkSpec(id: string, objectIds: string[], priority: number, baseUri: string, chunkDirName: string, assetId: string): XGFStreamingChunkExportSpec {
  return {
    id,
    uri: joinUri(baseUri, chunkDirName, `${id}.xgf`),
    objectIds,
    assetLibraryIds: [assetId],
    priority
  };
}

function createAssetLibrarySpecs(params: {
  sceneModel: SceneModel;
  chunks: XGFStreamingChunkExportSpec[];
  objectIds: string[];
  assetId: string;
  assetLibraryChunkSize: number;
  sharedAssetMinLibraryUses: number;
  baseUri: string;
  chunkDirName: string;
}): XGFAssetLibraryExportSpec[] {
  if (!params.assetLibraryChunkSize || params.assetLibraryChunkSize >= params.chunks.length) {
    for (const chunk of params.chunks) {
      chunk.assetLibraryIds = [params.assetId];
    }
    return [{
      id: params.assetId,
      uri: joinUri(params.baseUri, params.chunkDirName, `${params.assetId}.xgf`),
      objectIds: params.objectIds
    }];
  }

  const groups: any[] = [];
  for (let offset = 0, libraryIndex = 0; offset < params.chunks.length; offset += params.assetLibraryChunkSize, libraryIndex++) {
    const chunksInGroup = params.chunks.slice(offset, offset + params.assetLibraryChunkSize);
    const libraryObjectIds = new Set<string>();
    for (const chunk of chunksInGroup) {
      for (const objectId of chunk.objectIds) {
        libraryObjectIds.add(objectId);
      }
    }
    groups.push({
      id: `${params.assetId}-${String(libraryIndex).padStart(3, "0")}`,
      uri: joinUri(params.baseUri, params.chunkDirName, `${params.assetId}-${String(libraryIndex).padStart(3, "0")}.xgf`),
      priority: libraryIndex + 1,
      chunks: chunksInGroup,
      assets: collectAssetIds(params.sceneModel, Array.from(libraryObjectIds))
    });
  }

  const sharedAssets = collectSharedAssets(groups, params.sharedAssetMinLibraryUses);
  const hasSharedAssets = hasAnyAsset(sharedAssets);
  const sharedLibraryId = `${params.assetId}-shared`;
  const libraries: XGFAssetLibraryExportSpec[] = [];
  if (hasSharedAssets) {
    libraries.push({
      id: sharedLibraryId,
      uri: joinUri(params.baseUri, params.chunkDirName, `${sharedLibraryId}.xgf`),
      geometryIds: Array.from(sharedAssets.geometries).sort(),
      materialIds: Array.from(sharedAssets.materials).sort(),
      textureIds: Array.from(sharedAssets.textures).sort(),
      priority: 0
    });
  }

  for (const group of groups) {
    const localAssets = subtractAssets(group.assets, sharedAssets);
    const groupLibraryIds = hasSharedAssets ? [sharedLibraryId] : [];
    if (hasAnyAsset(localAssets)) {
      libraries.push({
        id: group.id,
        uri: group.uri,
        geometryIds: Array.from(localAssets.geometries).sort(),
        materialIds: Array.from(localAssets.materials).sort(),
        textureIds: Array.from(localAssets.textures).sort(),
        priority: group.priority
      });
      groupLibraryIds.push(group.id);
    }
    for (const chunk of group.chunks) {
      chunk.assetLibraryIds = groupLibraryIds.slice();
    }
  }
  return libraries;
}

function collectAssetIds(sceneModel: SceneModel, objectIds: string[]) {
  const assets = {
    geometries: new Set<string>(),
    materials: new Set<string>(),
    textures: new Set<string>()
  };
  for (const objectId of objectIds) {
    const object = sceneModel.objects[objectId];
    if (!object) {
      continue;
    }
    for (const mesh of object.meshes || []) {
      if (mesh.geometry) {
        assets.geometries.add(mesh.geometry.id);
      }
      if (mesh.material) {
        assets.materials.add(mesh.material.id);
        addMaterialTextureIds(mesh.material, assets.textures);
      }
    }
  }
  return assets;
}

function addMaterialTextureIds(material: any, textures: Set<string>): void {
  addTextureId(textures, material.colorTexture);
  addTextureId(textures, material.metallicRoughnessTexture);
  addTextureId(textures, material.normalsTexture);
  addTextureId(textures, material.occlusionTexture);
  addTextureId(textures, material.emissiveTexture);
}

function addTextureId(textures: Set<string>, texture: any): void {
  if (texture) {
    textures.add(texture.id);
  }
}

function collectSharedAssets(groups: any[], minUses: number) {
  return {
    geometries: idsWithMinUses(countGroupUses(groups, "geometries"), minUses),
    materials: idsWithMinUses(countGroupUses(groups, "materials"), minUses),
    textures: idsWithMinUses(countGroupUses(groups, "textures"), minUses)
  };
}

function countGroupUses(groups: any[], kind: "geometries" | "materials" | "textures"): Map<string, number> {
  const uses = new Map<string, number>();
  for (const group of groups) {
    for (const id of group.assets[kind]) {
      uses.set(id, (uses.get(id) || 0) + 1);
    }
  }
  return uses;
}

function idsWithMinUses(uses: Map<string, number>, minUses: number): Set<string> {
  const ids = new Set<string>();
  for (const [id, count] of uses) {
    if (count >= minUses) {
      ids.add(id);
    }
  }
  return ids;
}

function subtractAssets(assets: any, excluded: any) {
  return {
    geometries: subtractSet(assets.geometries, excluded.geometries),
    materials: subtractSet(assets.materials, excluded.materials),
    textures: subtractSet(assets.textures, excluded.textures)
  };
}

function subtractSet(source: Set<string>, excluded: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of source) {
    if (!excluded.has(id)) {
      result.add(id);
    }
  }
  return result;
}

function hasAnyAsset(assets: any): boolean {
  return assets.geometries.size > 0 || assets.materials.size > 0 || assets.textures.size > 0;
}

function numberedChunkId(chunkIndex: number): string {
  return `chunk-${String(chunkIndex).padStart(5, "0")}`;
}

function computeObjectAABB(sceneObject: any): number[] | null {
  if (!sceneObject || !Array.isArray(sceneObject.meshes) || sceneObject.meshes.length === 0) {
    return null;
  }
  const out = collapseAABB3();
  let found = false;
  for (const mesh of sceneObject.meshes) {
    const geom = mesh.geometry;
    if (!geom || !geom.aabb) {
      continue;
    }
    expandAABB3(out, transformAABB3(geom.aabb, mesh.worldMatrix));
    found = true;
  }
  return found ? out : null;
}

function estimateObjectCost(sceneObject: any, metric: XGFStreamChunkMetric): number {
  if (metric === "objects") {
    return 1;
  }
  const meshes = sceneObject?.meshes || [];
  if (metric === "meshes") {
    return Math.max(1, meshes.length);
  }
  const geometryIds = new Set<string>();
  let bytes = 0;
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    if (!geometry || geometryIds.has(geometry.id)) {
      continue;
    }
    geometryIds.add(geometry.id);
    bytes += arrayByteLength(geometry.positionsCompressed);
    bytes += arrayByteLength(geometry.colorsCompressed);
    bytes += arrayByteLength(geometry.normalsCompressed);
    bytes += arrayByteLength(geometry.uvsCompressed);
    bytes += arrayByteLength(geometry.indices);
    bytes += arrayByteLength(geometry.edgeIndices);
    bytes += arrayByteLength(geometry.scales);
    bytes += arrayByteLength(geometry.rotations);
    bytes += arrayByteLength(geometry.aabb);
  }
  return Math.max(1, bytes);
}

function arrayByteLength(value: any): number {
  return value && typeof value.byteLength === "number" ? value.byteLength : 0;
}

function transformAABB3(local: number[], matrix: ArrayLike<number>): number[] {
  const minX = local[0], minY = local[1], minZ = local[2];
  const maxX = local[3], maxY = local[4], maxZ = local[5];
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const ex = (maxX - minX) * 0.5;
  const ey = (maxY - minY) * 0.5;
  const ez = (maxZ - minZ) * 0.5;
  const m00 = matrix[0], m01 = matrix[4], m02 = matrix[8], m03 = matrix[12];
  const m10 = matrix[1], m11 = matrix[5], m12 = matrix[9], m13 = matrix[13];
  const m20 = matrix[2], m21 = matrix[6], m22 = matrix[10], m23 = matrix[14];
  const wcx = m00 * cx + m01 * cy + m02 * cz + m03;
  const wcy = m10 * cx + m11 * cy + m12 * cz + m13;
  const wcz = m20 * cx + m21 * cy + m22 * cz + m23;
  const wex = Math.abs(m00) * ex + Math.abs(m01) * ey + Math.abs(m02) * ez;
  const wey = Math.abs(m10) * ex + Math.abs(m11) * ey + Math.abs(m12) * ez;
  const wez = Math.abs(m20) * ex + Math.abs(m21) * ey + Math.abs(m22) * ez;
  return [wcx - wex, wcy - wey, wcz - wez, wcx + wex, wcy + wey, wcz + wez];
}

function collapseAABB3(): number[] {
  return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
}

function expandAABB3(out: number[], aabb: number[]): number[] {
  out[0] = Math.min(out[0], aabb[0]);
  out[1] = Math.min(out[1], aabb[1]);
  out[2] = Math.min(out[2], aabb[2]);
  out[3] = Math.max(out[3], aabb[3]);
  out[4] = Math.max(out[4], aabb[4]);
  out[5] = Math.max(out[5], aabb[5]);
  return out;
}

function aabbCenter(aabb: number[]): number[] {
  return [(aabb[0] + aabb[3]) * 0.5, (aabb[1] + aabb[4]) * 0.5, (aabb[2] + aabb[5]) * 0.5];
}

function autoGridCellSize(modelAABB: number[], totalCost: number, chunkBudget: number): number {
  const x = Math.max(modelAABB[3] - modelAABB[0], 1);
  const y = Math.max(modelAABB[4] - modelAABB[1], 1);
  const z = Math.max(modelAABB[5] - modelAABB[2], 1);
  const targetChunks = Math.max(1, Math.ceil(totalCost / chunkBudget));
  return Math.max(Math.cbrt((x * y * z) / targetChunks), 1);
}

function gridCoord(center: number[], modelAABB: number[], cellSize: number): number[] {
  return [
    Math.floor((center[0] - modelAABB[0]) / cellSize),
    Math.floor((center[1] - modelAABB[1]) / cellSize),
    Math.floor((center[2] - modelAABB[2]) / cellSize)
  ];
}

function splitOversizedGroup(records: any[], chunkBudget: number): any[][] {
  if (records.length <= 1 || sumRecordCost(records) <= chunkBudget) {
    return [records];
  }
  const axis = longestCenterAxis(records);
  const sorted = records.slice().sort((a, b) => a.center[axis] - b.center[axis] || a.id.localeCompare(b.id));
  const mid = Math.ceil(sorted.length / 2);
  return splitOversizedGroup(sorted.slice(0, mid), chunkBudget).concat(splitOversizedGroup(sorted.slice(mid), chunkBudget));
}

function createSpatialGroup(coord: number[], records: any[]) {
  const aabb = collapseAABB3();
  for (const record of records) {
    expandAABB3(aabb, record.aabb);
  }
  return {coord, records, cost: sumRecordCost(records), aabb, center: aabbCenter(aabb)};
}

function mergeUndersizedGroups(groups: any[], minChunkBudget: number, chunkBudget: number): any[] {
  if (groups.length < 2 || minChunkBudget <= 1) {
    return groups;
  }
  const merged: any[] = [];
  const used = new Set<number>();
  const bySmallest = groups
    .map((group, index) => ({group, index}))
    .sort((a, b) => a.group.cost - b.group.cost || compareBucket(a.group, b.group));
  for (const item of bySmallest) {
    if (used.has(item.index)) {
      continue;
    }
    const group = item.group;
    if (group.cost >= minChunkBudget) {
      used.add(item.index);
      merged.push(group);
      continue;
    }
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < groups.length; i++) {
      if (i === item.index || used.has(i) || group.cost + groups[i].cost > chunkBudget) {
        continue;
      }
      const score = centerDistanceSquared(group.center, groups[i].center);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    used.add(item.index);
    if (bestIndex !== -1) {
      used.add(bestIndex);
      merged.push(mergeSpatialGroups(group, groups[bestIndex]));
    } else {
      merged.push(group);
    }
  }
  return merged.sort(compareBucket);
}

function mergeSpatialGroups(a: any, b: any) {
  const aabb = collapseAABB3();
  expandAABB3(aabb, a.aabb);
  expandAABB3(aabb, b.aabb);
  return {coord: a.coord, records: a.records.concat(b.records), cost: a.cost + b.cost, aabb, center: aabbCenter(aabb)};
}

function centerDistanceSquared(a: number[], b: number[]): number {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return x * x + y * y + z * z;
}

function sumRecordCost(records: any[]): number {
  return records.reduce((sum, record) => sum + record.cost, 0);
}

function longestCenterAxis(records: any[]): number {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const record of records) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], record.center[i]);
      max[i] = Math.max(max[i], record.center[i]);
    }
  }
  const extents = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (extents[1] > extents[0] && extents[1] >= extents[2]) return 1;
  if (extents[2] > extents[0] && extents[2] > extents[1]) return 2;
  return 0;
}

function compareBucket(a: any, b: any): number {
  return a.coord[0] - b.coord[0] || a.coord[1] - b.coord[1] || a.coord[2] - b.coord[2];
}

function signedCoord(value: number): string {
  return value < 0 ? `m${Math.abs(value)}` : String(value).padStart(3, "0");
}

function countCoordOccurrence(chunks: XGFStreamingChunkExportSpec[], suffix: string): number {
  return chunks.reduce((count, chunk) => chunk.id.includes(suffix) ? count + 1 : count, 0);
}

function positiveInteger(value: number | undefined, defaultValue: number): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("[XGFStreamExporter.write] Expected a non-negative integer option");
  }
  return n;
}

function positiveNumber(value: number | undefined, defaultValue: number): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("[XGFStreamExporter.write] Expected a positive number option");
  }
  return n;
}

function trimSlashes(value: string): string {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function joinUri(...parts: Array<string | undefined>): string {
  return parts
    .filter((part) => part !== undefined && String(part).length > 0)
    .map((part) => trimSlashes(part!))
    .filter((part) => part.length > 0)
    .join("/");
}
