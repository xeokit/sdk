import type {SDKResult} from "../../../base/core";
import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import {validateXGFChunkManifest} from "./validateXGFChunkManifest";

/**
 * Validates and reads one XGF chunk manifest JSON object.
 */
export function readXGFChunkManifest(json: any): SDKResult<XGFChunkManifest> {
  return validateXGFChunkManifest(json);
}
