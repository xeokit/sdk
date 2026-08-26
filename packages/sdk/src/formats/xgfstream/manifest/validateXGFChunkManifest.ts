import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";

/**
 * Validates one XGF chunk manifest JSON object.
 */
export function validateXGFChunkManifest(value: any): SDKResult<XGFChunkManifest> {
  if (!isObject(value)) {
    return invalid("[XGFChunkManifest] Expected JSON object");
  }
  if (value.format !== "XGF") {
    return invalid("[XGFChunkManifest] Expected format 'XGF'");
  }
  if (value.manifestVersion !== "1.0.0") {
    return invalid("[XGFChunkManifest] Expected manifestVersion '1.0.0'");
  }
  if (value.xgfVersion !== "2.0.0") {
    return invalid("[XGFChunkManifest] Expected xgfVersion '2.0.0'");
  }
  if (!isNonEmptyString(value.id)) {
    return invalid("[XGFChunkManifest] Expected non-empty string id");
  }
  if (value.uri !== undefined && typeof value.uri !== "string") {
    return invalid("[XGFChunkManifest] Expected uri to be a string when provided");
  }
  if (value.role !== "full" && value.role !== "assetLibrary" && value.role !== "referencesOnly") {
    return invalid("[XGFChunkManifest] Expected role 'full', 'assetLibrary' or 'referencesOnly'");
  }
  const dependenciesResult = validateIdGroups(value.dependencies, "[XGFChunkManifest.dependencies]", true);
  if (dependenciesResult.ok === false) return invalid(dependenciesResult.error);
  const assetsResult = validateIdGroups(value.assets, "[XGFChunkManifest.assets]", false);
  if (assetsResult.ok === false) return invalid(assetsResult.error);
  const countsResult = validateCounts(value.counts);
  if (countsResult.ok === false) return invalid(countsResult.error);
  if (value.aabb !== undefined && (!Array.isArray(value.aabb) || value.aabb.length !== 6 || !value.aabb.every(isFiniteNumber))) {
    return invalid("[XGFChunkManifest] Expected aabb to contain six finite numbers");
  }
  if (value.priority !== undefined && !isFiniteNumber(value.priority)) {
    return invalid("[XGFChunkManifest] Expected priority to be a finite number when provided");
  }
  if (value.lod !== undefined && typeof value.lod !== "number" && typeof value.lod !== "string") {
    return invalid("[XGFChunkManifest] Expected lod to be a number or string when provided");
  }
  if (typeof value.lod === "number" && !isFiniteNumber(value.lod)) {
    return invalid("[XGFChunkManifest] Expected lod number to be finite");
  }
  if (value.layerId !== undefined && !isNonEmptyString(value.layerId)) {
    return invalid("[XGFChunkManifest] Expected layerId to be a non-empty string when provided");
  }
  return {ok: true, value: value as XGFChunkManifest};
}

function validateIdGroups(value: any, path: string, includeChunks: boolean): SDKResult<void> {
  if (!isObject(value)) {
    return invalid(`${path} must be an object`);
  }
  if (includeChunks) {
    if (!Array.isArray(value.chunks) || !value.chunks.every(isChunkDependency)) {
      return invalid(`${path}.chunks must contain dependency objects with id and/or uri`);
    }
  }
  for (const key of ["geometries", "materials", "textures"]) {
    if (!Array.isArray(value[key]) || !value[key].every(isNonEmptyString)) {
      return invalid(`${path}.${key} must contain string ids`);
    }
  }
  return {ok: true, value: undefined};
}

function validateCounts(value: any): SDKResult<void> {
  if (!isObject(value)) {
    return invalid("[XGFChunkManifest.counts] must be an object");
  }
  for (const key of ["transforms", "geometries", "materials", "textures", "meshes", "objects"]) {
    if (!Number.isInteger(value[key]) || value[key] < 0) {
      return invalid(`[XGFChunkManifest.counts] ${key} must be a non-negative integer`);
    }
  }
  return {ok: true, value: undefined};
}

function isChunkDependency(value: any): boolean {
  return isObject(value)
    && (value.id === undefined || typeof value.id === "string")
    && (value.uri === undefined || typeof value.uri === "string")
    && (!!value.id || !!value.uri);
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

function invalid<T>(error: string): SDKResult<T> {
  return {
    ok: false,
    type: SDKErrorType.InvalidInput,
    error
  };
}
