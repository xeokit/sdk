import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {XGFStreamingIndex} from "./XGFStreamingIndex";
import {validateXGFChunkManifest} from "../manifest/validateXGFChunkManifest";

/**
 * Validates and reads a human-readable XGF stream index JSON object.
 */
export function readXGFStreamingIndex(json: any): SDKResult<XGFStreamingIndex> {
  if (!isObject(json)) {
    return invalid("[XGFStreamingIndex] Expected JSON object");
  }
  if (json.format !== "XGFStreamingIndex") {
    return invalid("[XGFStreamingIndex] Expected format 'XGFStreamingIndex'");
  }
  if (json.indexVersion !== "1.0.0") {
    return invalid("[XGFStreamingIndex] Expected indexVersion '1.0.0'");
  }
  if (!Array.isArray(json.chunks)) {
    return invalid("[XGFStreamingIndex] Expected chunks array");
  }
  const seenChunkIds = new Set<string>();
  for (let i = 0; i < json.chunks.length; i++) {
    const result = validateXGFChunkManifest(json.chunks[i]);
    if (result.ok === false) {
      return invalid(`[XGFStreamingIndex.chunks.${i}] ${result.error}`);
    }
    const id = result.value.id;
    if (seenChunkIds.has(id)) {
      return invalid(`[XGFStreamingIndex] Duplicate chunk id '${id}'`);
    }
    seenChunkIds.add(id);
  }
  if (json.rootChunkIds !== undefined) {
    if (!Array.isArray(json.rootChunkIds) || !json.rootChunkIds.every(isNonEmptyString)) {
      return invalid("[XGFStreamingIndex] rootChunkIds must contain string ids when provided");
    }
    for (const id of json.rootChunkIds) {
      if (!seenChunkIds.has(id)) {
        return invalid(`[XGFStreamingIndex] rootChunkIds references missing chunk '${id}'`);
      }
    }
  }
  if (json.aabb !== undefined && (!Array.isArray(json.aabb) || json.aabb.length !== 6 || !json.aabb.every(isFiniteNumber))) {
    return invalid("[XGFStreamingIndex] Expected aabb to contain six finite numbers");
  }
  if (json.metadata !== undefined && !isObject(json.metadata)) {
    return invalid("[XGFStreamingIndex] metadata must be an object when provided");
  }
  return {ok: true, value: json as XGFStreamingIndex};
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
