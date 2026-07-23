import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "./XGFStreamingIndex";
import type {
  XGFStreamingRuntimeAABBQuantization,
  XGFStreamingRuntimeChunk,
  XGFStreamingRuntimeIndex
} from "./XGFStreamingRuntimeIndex";

const ROLE_CODES: Record<XGFChunkManifest["role"], number> = {
  full: 0,
  assetLibrary: 1,
  referencesOnly: 2
};

const AABB_QUANTIZATION_BITS = 16;
const AABB_QUANTIZATION_MAX = (1 << AABB_QUANTIZATION_BITS) - 1;

/**
 * Writes a compact runtime representation of an XGF stream index.
 */
export function writeXGFStreamingRuntimeIndex(index: XGFStreamingIndex): XGFStreamingRuntimeIndex {
  const strings: string[] = [];
  const stringIndexes = new Map<string, number>();
  const intern = (value: string): number => {
    const existing = stringIndexes.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const next = strings.length;
    strings.push(value);
    stringIndexes.set(value, next);
    return next;
  };
  const aabbQuantization = createAABBQuantization(index.aabb);
  return {
    format: "XGFStreamingRuntimeIndex",
    indexVersion: "1.1.0",
    strings,
    aabbQuantization,
    chunks: index.chunks.map(manifest => writeRuntimeChunk(manifest, intern, aabbQuantization)),
    root: index.rootChunkIds?.map(intern),
    aabb: index.aabb?.slice(),
    metadata: index.metadata ? JSON.parse(JSON.stringify(index.metadata)) : undefined
  };
}

function writeRuntimeChunk(
  manifest: XGFChunkManifest,
  intern: (value: string) => number,
  aabbQuantization: XGFStreamingRuntimeAABBQuantization | undefined
): XGFStreamingRuntimeChunk {
  const chunk: XGFStreamingRuntimeChunk = [
    intern(manifest.id),
    manifest.uri ? intern(manifest.uri) : null,
    ROLE_CODES[manifest.role],
    manifest.dependencies.chunks.map(dependency =>
      dependency.id && !dependency.uri
        ? intern(dependency.id)
        : [dependency.id ? intern(dependency.id) : null, dependency.uri ? intern(dependency.uri) : null]
    ),
    encodeAABB(manifest.aabb, aabbQuantization),
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

function createAABBQuantization(aabb: number[] | undefined): XGFStreamingRuntimeAABBQuantization | undefined {
  if (!aabb || aabb.length !== 6) {
    return undefined;
  }
  const scale: [number, number, number] = [
    createAABBScale(aabb[3] - aabb[0]),
    createAABBScale(aabb[4] - aabb[1]),
    createAABBScale(aabb[5] - aabb[2])
  ];
  return {
    bits: AABB_QUANTIZATION_BITS,
    origin: [aabb[0], aabb[1], aabb[2]],
    scale
  };
}

function createAABBScale(extent: number): number {
  return Number.isFinite(extent) && extent > 0 ? extent / AABB_QUANTIZATION_MAX : 1;
}

function encodeAABB(
  aabb: number[] | undefined,
  quantization: XGFStreamingRuntimeAABBQuantization | undefined
): number[] | null {
  if (!aabb) {
    return null;
  }
  if (!quantization) {
    return aabb.slice();
  }
  const encoded = new Array(6);
  for (let axis = 0; axis < 3; axis++) {
    encoded[axis] = quantizeAABBValue(aabb[axis], quantization.origin[axis], quantization.scale[axis], Math.floor);
    encoded[axis + 3] = quantizeAABBValue(aabb[axis + 3], quantization.origin[axis], quantization.scale[axis], Math.ceil);
  }
  return encoded;
}

function quantizeAABBValue(
  value: number,
  origin: number,
  scale: number,
  rounding: (value: number) => number
): number {
  const quantized = rounding((value - origin) / scale);
  return Math.max(0, Math.min(AABB_QUANTIZATION_MAX, quantized));
}
