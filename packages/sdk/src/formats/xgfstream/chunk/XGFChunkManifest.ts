import type {XGFChunkDependency} from "./XGFChunkDependency";
import type {XGFChunkRole} from "./XGFChunkRole";

/**
 * Human-readable manifest metadata for one XGF stream chunk.
 */
export interface XGFChunkManifest {
  /** Payload format for this chunk. */
  format: "XGF";
  /** Manifest schema version. */
  manifestVersion: "1.0.0";
  /** XGF payload version. */
  xgfVersion: "2.0.0";
  /** Stable chunk ID within the stream index. */
  id: string;
  /** Stream-relative URI of the chunk's XGF payload. */
  uri?: string;
  /** Chunk role controlling what content the XGF payload creates. */
  role: XGFChunkRole;
  /** Other chunks and assets required before this chunk can load. */
  dependencies: {
    chunks: XGFChunkDependency[];
    geometries: string[];
    materials: string[];
    textures: string[];
  };
  /** Asset IDs created by this chunk. */
  assets: {
    geometries: string[];
    materials: string[];
    textures: string[];
  };
  /** Role-adjusted component counts for the chunk payload. */
  counts: {
    transforms: number;
    geometries: number;
    materials: number;
    textures: number;
    meshes: number;
    objects: number;
  };
  /** Aggregate world-space AABB for scheduling and culling. */
  aabb?: number[];
  /** Optional scheduler priority. Lower values load first. */
  priority?: number;
  /** Optional level-of-detail label or number. */
  lod?: number | string;
}
