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
  if (json.indexVersion !== "1.0.0" && json.indexVersion !== "1.1.0") {
    return invalid("[XGFStreamingRuntimeIndex] Expected indexVersion '1.0.0' or '1.1.0'");
  }
  if (!Array.isArray(json.chunks)) {
    return invalid("[XGFStreamingRuntimeIndex] Expected chunks array");
  }
  const runtimeIndex = json as XGFStreamingRuntimeIndex;
  if (json.indexVersion === "1.1.0") {
    if (!Array.isArray(json.strings) || !json.strings.every(isNonEmptyString)) {
      return invalid("[XGFStreamingRuntimeIndex] Expected strings table with non-empty strings");
    }
    if (json.aabbQuantization !== undefined) {
      const quantizationResult = validateAABBQuantization(runtimeIndex.aabbQuantization);
      if (quantizationResult.ok === false) {
        return quantizationResult;
      }
    }
  }

  const chunks: XGFChunkManifest[] = [];
  for (let i = 0; i < json.chunks.length; i++) {
    const result = json.indexVersion === "1.1.0"
      ? readRuntimeChunkV11(json.chunks[i], runtimeIndex)
      : readRuntimeChunk(json.chunks[i]);
    if (result.ok === false) {
      return invalid(`[XGFStreamingRuntimeIndex.chunks.${i}] ${result.error}`);
    }
    chunks.push(result.value);
  }
  const rootResult = readRootChunkIds(runtimeIndex);
  if (rootResult.ok === false) {
    return rootResult;
  }

  return readXGFStreamingIndex({
    format: "XGFStreamingIndex",
    indexVersion: "1.0.0",
    chunks,
    rootChunkIds: rootResult.value,
    aabb: json.aabb,
    metadata: json.metadata
  });
}

function readRuntimeChunk(value: any): SDKResult<XGFChunkManifest> {
  if (!Array.isArray(value) || value.length < 6) {
    return invalid("Expected compact chunk tuple");
  }
  const chunk = value as [
    string,
    string | null,
    number,
    Array<string | [string | null, string | null]>,
    number[] | null,
    [number, number, number, number, number, number],
    number | null | undefined,
    number | string | null | undefined
  ];
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

function readRuntimeChunkV11(value: any, index: XGFStreamingRuntimeIndex): SDKResult<XGFChunkManifest> {
  if (!Array.isArray(value) || value.length < 6) {
    return invalid("Expected compact chunk tuple");
  }
  const chunk = value as XGFStreamingRuntimeChunk;
  const [idRef, uriRef, roleCode, dependencies, encodedAABB, counts, priority, lod] = chunk;
  const idResult = readStringRef(idRef, index, "chunk id");
  if (idResult.ok === false) {
    return idResult;
  }
  const uriResult = uriRef === null || uriRef === undefined
    ? {ok: true as const, value: undefined}
    : readStringRef(uriRef, index, "chunk uri");
  if (uriResult.ok === false) {
    return uriResult;
  }
  if (!Number.isInteger(roleCode) || !ROLES[roleCode]) {
    return invalid("Expected valid chunk role code");
  }
  if (!Array.isArray(dependencies)) {
    return invalid("Expected dependency array");
  }
  const aabbResult = readRuntimeAABB(encodedAABB, index);
  if (aabbResult.ok === false) {
    return aabbResult;
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
  const dependencyResults: XGFChunkDependency[] = [];
  for (const dependency of dependencies) {
    const dependencyResult = readDependencyV11(dependency, index);
    if (dependencyResult.ok === false) {
      return dependencyResult;
    }
    dependencyResults.push(dependencyResult.value);
  }
  const manifest: XGFChunkManifest = {
    format: "XGF",
    manifestVersion: "1.0.0",
    xgfVersion: "2.0.0",
    id: idResult.value,
    uri: uriResult.value,
    role: ROLES[roleCode],
    dependencies: {
      chunks: dependencyResults,
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
    aabb: aabbResult.value,
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

function readDependencyV11(
  value: string | number | [string | number | null, string | number | null],
  index: XGFStreamingRuntimeIndex
): SDKResult<XGFChunkDependency> {
  if (typeof value === "string" || typeof value === "number") {
    const idResult = readStringRef(value, index, "dependency id");
    return idResult.ok === false ? idResult : {ok: true, value: {id: idResult.value}};
  }
  if (!Array.isArray(value) || value.length !== 2) {
    return invalid("Expected dependency string reference or tuple");
  }
  const idResult = value[0] === null || value[0] === undefined
    ? {ok: true as const, value: undefined}
    : readStringRef(value[0], index, "dependency id");
  if (idResult.ok === false) {
    return idResult;
  }
  const uriResult = value[1] === null || value[1] === undefined
    ? {ok: true as const, value: undefined}
    : readStringRef(value[1], index, "dependency uri");
  if (uriResult.ok === false) {
    return uriResult;
  }
  return {
    ok: true,
    value: {
      id: idResult.value,
      uri: uriResult.value
    }
  };
}

function readRuntimeAABB(value: any, index: XGFStreamingRuntimeIndex): SDKResult<number[] | undefined> {
  if (value === null || value === undefined) {
    return {ok: true, value: undefined};
  }
  const quantization = index.aabbQuantization;
  if (!Array.isArray(value) || value.length !== 6 || !value.every(isFiniteNumber)) {
    return invalid("Expected aabb to contain six finite numbers or null");
  }
  if (!quantization) {
    return {ok: true, value: value.slice()};
  }
  const decoded = new Array(6);
  for (let axis = 0; axis < 3; axis++) {
    decoded[axis] = quantization.origin[axis] + value[axis] * quantization.scale[axis];
    decoded[axis + 3] = quantization.origin[axis] + value[axis + 3] * quantization.scale[axis];
  }
  return {ok: true, value: decoded};
}

function readRootChunkIds(index: XGFStreamingRuntimeIndex): SDKResult<string[] | undefined> {
  if (index.root === undefined) {
    return {ok: true, value: undefined};
  }
  if (!Array.isArray(index.root)) {
    return invalid("[XGFStreamingRuntimeIndex] Expected root array");
  }
  if (index.indexVersion === "1.0.0") {
    return index.root.every(isNonEmptyString)
      ? {ok: true, value: index.root as string[]}
      : invalid("[XGFStreamingRuntimeIndex] Expected root ids to be strings");
  }
  const rootChunkIds: string[] = [];
  for (const root of index.root) {
    const result = readStringRef(root, index, "root chunk id");
    if (result.ok === false) {
      return result;
    }
    rootChunkIds.push(result.value);
  }
  return {ok: true, value: rootChunkIds};
}

function readStringRef(value: any, index: XGFStreamingRuntimeIndex, name: string): SDKResult<string> {
  if (typeof value === "string") {
    return isNonEmptyString(value) ? {ok: true, value} : invalid(`Expected non-empty ${name}`);
  }
  if (!Number.isInteger(value) || value < 0 || !index.strings || value >= index.strings.length) {
    return invalid(`Expected valid ${name} string reference`);
  }
  return {ok: true, value: index.strings[value]};
}

function validateAABBQuantization(value: any): SDKResult<void> {
  if (!isObject(value)) {
    return invalid("[XGFStreamingRuntimeIndex] Expected aabbQuantization object");
  }
  if (value.bits !== 16) {
    return invalid("[XGFStreamingRuntimeIndex] Expected aabbQuantization.bits to be 16");
  }
  if (!Array.isArray(value.origin) || value.origin.length !== 3 || !value.origin.every(isFiniteNumber)) {
    return invalid("[XGFStreamingRuntimeIndex] Expected aabbQuantization.origin with three finite numbers");
  }
  if (!Array.isArray(value.scale) || value.scale.length !== 3 || !value.scale.every(isPositiveFiniteNumber)) {
    return invalid("[XGFStreamingRuntimeIndex] Expected aabbQuantization.scale with three positive finite numbers");
  }
  return {ok: true, value: undefined};
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

function isPositiveFiniteNumber(value: any): boolean {
  return isFiniteNumber(value) && value > 0;
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
