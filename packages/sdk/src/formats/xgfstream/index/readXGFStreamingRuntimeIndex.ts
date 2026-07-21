import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {XGFChunkDependency} from "../chunk/XGFChunkDependency";
import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "./XGFStreamingIndex";
import type {XGFStreamingRuntimeChunk, XGFStreamingRuntimeIndex} from "./XGFStreamingRuntimeIndex";
import {readXGFStreamingIndex} from "./readXGFStreamingIndex";

const ROLES: XGFChunkManifest["role"][] = ["full", "assetLibrary", "referencesOnly"];

/**
 * Validates and expands a compact runtime XGF stream index into the
 * human-readable {@link XGFStreamingIndex} shape.
 */
export function readXGFStreamingRuntimeIndex(json: any): SDKResult<XGFStreamingIndex> {
  if (!isObject(json)) {
    return invalid("[XGFStreamingRuntimeIndex] Expected JSON object");
  }
  if (json.format !== "XGFStreamingRuntimeIndex") {
    return invalid("[XGFStreamingRuntimeIndex] Expected format 'XGFStreamingRuntimeIndex'");
  }
  if (json.indexVersion !== "1.0.0") {
    return invalid("[XGFStreamingRuntimeIndex] Expected indexVersion '1.0.0'");
  }
  if (!Array.isArray(json.chunks)) {
    return invalid("[XGFStreamingRuntimeIndex] Expected chunks array");
  }

  const chunks: XGFChunkManifest[] = [];
  for (let i = 0; i < json.chunks.length; i++) {
    const result = readRuntimeChunk(json.chunks[i]);
    if (result.ok === false) {
      return invalid(`[XGFStreamingRuntimeIndex.chunks.${i}] ${result.error}`);
    }
    chunks.push(result.value);
  }

  return readXGFStreamingIndex({
    format: "XGFStreamingIndex",
    indexVersion: "1.0.0",
    chunks,
    rootChunkIds: json.root,
    aabb: json.aabb,
    metadata: json.metadata
  });
}

function readRuntimeChunk(value: any): SDKResult<XGFChunkManifest> {
  if (!Array.isArray(value) || value.length < 6) {
    return invalid("Expected compact chunk tuple");
  }
  const chunk = value as XGFStreamingRuntimeChunk;
  const [id, uri, roleCode, dependencies, aabb, counts, priority, lod] = chunk;
  if (!isNonEmptyString(id)) {
    return invalid("Expected non-empty chunk id");
  }
  if (uri !== null && uri !== undefined && typeof uri !== "string") {
    return invalid("Expected chunk uri to be string or null");
  }
  if (!Number.isInteger(roleCode) || !ROLES[roleCode]) {
    return invalid("Expected valid chunk role code");
  }
  if (!Array.isArray(dependencies)) {
    return invalid("Expected dependency array");
  }
  if (aabb !== null && aabb !== undefined && (!Array.isArray(aabb) || aabb.length !== 6 || !aabb.every(isFiniteNumber))) {
    return invalid("Expected aabb to contain six finite numbers or null");
  }
  if (!Array.isArray(counts) || counts.length !== 6 || !counts.every(isNonNegativeInteger)) {
    return invalid("Expected counts tuple of six non-negative integers");
  }
  if (priority !== undefined && priority !== null && !isFiniteNumber(priority)) {
    return invalid("Expected priority to be finite when provided");
  }
  if (lod !== undefined && lod !== null && typeof lod !== "number" && typeof lod !== "string") {
    return invalid("Expected lod to be number, string or null");
  }
  if (typeof lod === "number" && !isFiniteNumber(lod)) {
    return invalid("Expected numeric lod to be finite");
  }
  const manifest: XGFChunkManifest = {
    format: "XGF",
    manifestVersion: "1.0.0",
    xgfVersion: "2.0.0",
    id,
    uri: uri || undefined,
    role: ROLES[roleCode],
    dependencies: {
      chunks: dependencies.map(readDependency),
      geometries: [],
      materials: [],
      textures: []
    },
    assets: {
      geometries: [],
      materials: [],
      textures: []
    },
    counts: {
      transforms: counts[0],
      geometries: counts[1],
      materials: counts[2],
      textures: counts[3],
      meshes: counts[4],
      objects: counts[5]
    },
    aabb: aabb || undefined,
    priority: priority ?? undefined,
    lod: lod ?? undefined
  };
  return {ok: true, value: manifest};
}

function readDependency(value: string | [string | null, string | null]): XGFChunkDependency {
  if (typeof value === "string") {
    return {id: value};
  }
  return {
    id: value[0] || undefined,
    uri: value[1] || undefined
  };
}

function isObject(value: any): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: any): boolean {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: any): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: any): boolean {
  return Number.isInteger(value) && value >= 0;
}

function invalid<T>(error: string): SDKResult<T> {
  return {
    ok: false,
    type: SDKErrorType.InvalidInput,
    error
  };
}
