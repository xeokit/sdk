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
  if (json.indexVersion !== "1.0.0" && json.indexVersion !== "1.1.0" && json.indexVersion !== "1.2.0") {
    return invalid("[XGFStreamingIndex] Expected indexVersion '1.0.0', '1.1.0' or '1.2.0'");
  }
  if (json.chunks !== undefined && !Array.isArray(json.chunks)) {
    return invalid("[XGFStreamingIndex] Expected chunks array");
  }
  const chunks = json.chunks || [];
  const seenChunkIds = new Set<string>();
  for (let i = 0; i < chunks.length; i++) {
    const result = validateXGFChunkManifest(chunks[i]);
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
  if (json.streams !== undefined) {
    if (!Array.isArray(json.streams)) {
      return invalid("[XGFStreamingIndex] Expected streams array");
    }
    const seenStreamIds = new Set<string>();
    for (let i = 0; i < json.streams.length; i++) {
      const result = validateSubstreamManifest(json.streams[i]);
      if (result.ok === false) {
        return invalid(`[XGFStreamingIndex.streams.${i}] ${result.error}`);
      }
      const id = result.value.id;
      if (seenStreamIds.has(id)) {
        return invalid(`[XGFStreamingIndex] Duplicate stream id '${id}'`);
      }
      seenStreamIds.add(id);
    }
  }
  if (json.aabb !== undefined && (!Array.isArray(json.aabb) || json.aabb.length !== 6 || !json.aabb.every(isFiniteNumber))) {
    return invalid("[XGFStreamingIndex] Expected aabb to contain six finite numbers");
  }
  if (json.coordinateSystem !== undefined) {
    const result = validateCoordinateSystem(json.coordinateSystem);
    if (result.ok === false) {
      return invalid(`[XGFStreamingIndex.coordinateSystem] ${result.error}`);
    }
  }
  if (json.metadata !== undefined && !isObject(json.metadata)) {
    return invalid("[XGFStreamingIndex] metadata must be an object when provided");
  }
  return {
    ok: true,
    value: {
      ...json,
      chunks
    } as XGFStreamingIndex
  };
}

function validateSubstreamManifest(value: any): SDKResult<{id: string; uri: string}> {
  if (!isObject(value)) {
    return invalid("Expected stream manifest object");
  }
  if (!isNonEmptyString(value.id)) {
    return invalid("Expected non-empty stream id");
  }
  if (!isNonEmptyString(value.uri)) {
    return invalid("Expected non-empty stream uri");
  }
  if (!Array.isArray(value.aabb) || value.aabb.length !== 6 || !value.aabb.every(isFiniteNumber)) {
    return invalid("Expected stream aabb to contain six finite numbers");
  }
  if (value.origin !== undefined && (!Array.isArray(value.origin) || value.origin.length !== 3 || !value.origin.every(isFiniteNumber))) {
    return invalid("Expected stream origin to contain three finite numbers when provided");
  }
  if (value.priority !== undefined && !isFiniteNumber(value.priority)) {
    return invalid("Expected stream priority to be finite when provided");
  }
  if (value.metadata !== undefined && !isObject(value.metadata)) {
    return invalid("Expected stream metadata to be an object when provided");
  }
  return {ok: true, value: value as {id: string; uri: string}};
}

function validateCoordinateSystem(value: any): SDKResult<void> {
  if (!isObject(value)) {
    return invalid("Expected coordinateSystem object");
  }
  if (value.basis !== undefined && (!Array.isArray(value.basis) || value.basis.length !== 9 || !value.basis.every(isFiniteNumber))) {
    return invalid("Expected basis to contain nine finite numbers when provided");
  }
  if (value.origin !== undefined && (!Array.isArray(value.origin) || value.origin.length !== 3 || !value.origin.every(isFiniteNumber))) {
    return invalid("Expected origin to contain three finite numbers when provided");
  }
  if (value.units !== undefined && typeof value.units !== "string") {
    return invalid("Expected units to be a string when provided");
  }
  if (value.scaleToMeters !== undefined && !isFiniteNumber(value.scaleToMeters)) {
    return invalid("Expected scaleToMeters to be finite when provided");
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

function invalid<T>(error: string): SDKResult<T> {
  return {
    ok: false,
    type: SDKErrorType.InvalidInput,
    error
  };
}
