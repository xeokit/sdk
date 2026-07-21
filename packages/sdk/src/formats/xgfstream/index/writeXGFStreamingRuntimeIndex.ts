import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "./XGFStreamingIndex";
import type {XGFStreamingRuntimeChunk, XGFStreamingRuntimeIndex} from "./XGFStreamingRuntimeIndex";

const ROLE_CODES: Record<XGFChunkManifest["role"], number> = {
  full: 0,
  assetLibrary: 1,
  referencesOnly: 2
};

/**
 * Writes a compact runtime representation of an XGF stream index.
 */
export function writeXGFStreamingRuntimeIndex(index: XGFStreamingIndex): XGFStreamingRuntimeIndex {
  return {
    format: "XGFStreamingRuntimeIndex",
    indexVersion: "1.0.0",
    roles: ["full", "assetLibrary", "referencesOnly"],
    counts: ["transforms", "geometries", "materials", "textures", "meshes", "objects"],
    chunks: index.chunks.map(writeRuntimeChunk),
    root: index.rootChunkIds?.slice(),
    aabb: index.aabb?.slice(),
    metadata: index.metadata ? JSON.parse(JSON.stringify(index.metadata)) : undefined
  };
}

function writeRuntimeChunk(manifest: XGFChunkManifest): XGFStreamingRuntimeChunk {
  const chunk: XGFStreamingRuntimeChunk = [
    manifest.id,
    manifest.uri || null,
    ROLE_CODES[manifest.role],
    manifest.dependencies.chunks.map(dependency =>
      dependency.id && !dependency.uri
        ? dependency.id
        : [dependency.id || null, dependency.uri || null]
    ),
    manifest.aabb ? manifest.aabb.slice() : null,
    [
      manifest.counts.transforms,
      manifest.counts.geometries,
      manifest.counts.materials,
      manifest.counts.textures,
      manifest.counts.meshes,
      manifest.counts.objects
    ]
  ];
  if (manifest.priority !== undefined || manifest.lod !== undefined) {
    chunk[6] = manifest.priority ?? null;
  }
  if (manifest.lod !== undefined) {
    chunk[7] = manifest.lod;
  }
  return chunk;
}
