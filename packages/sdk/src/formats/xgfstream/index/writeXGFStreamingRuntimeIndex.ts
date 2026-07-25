import type {XGFChunkManifest} from "../chunk/XGFChunkManifest";
import type {XGFStreamingIndex} from "./XGFStreamingIndex";
import type {
  XGFStreamingRuntimeAABBQuantization,
  XGFStreamingRuntimeChunk,
  XGFStreamingRuntimeIndex,
  XGFStreamingRuntimeSubstream
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
  const aabbQuantization = createAABBQuantization(createRuntimeQuantizationAABB(index));
  const indexVersion = (index.streams && index.streams.length > 0) || index.coordinateSystem ? "1.2.0" : "1.1.0";
  return {
    format: "XGFStreamingRuntimeIndex",
    indexVersion,
    strings,
    aabbQuantization,
    chunks: index.chunks.map(manifest => writeRuntimeChunk(manifest, intern, aabbQuantization)),
    streams: index.streams?.map(stream => writeRuntimeSubstream(stream, intern, aabbQuantization)),
    root: index.rootChunkIds?.map(intern),
    aabb: index.aabb?.slice(),
    coordinateSystem: index.coordinateSystem ? JSON.parse(JSON.stringify(index.coordinateSystem)) : undefined,
    metadata: index.metadata ? JSON.parse(JSON.stringify(index.metadata)) : undefined
  };
}

function writeRuntimeSubstream(
  stream: NonNullable<XGFStreamingIndex["streams"]>[number],
  intern: (value: string) => number,
  aabbQuantization: XGFStreamingRuntimeAABBQuantization | undefined
): XGFStreamingRuntimeSubstream {
  const tuple: XGFStreamingRuntimeSubstream = [
    intern(stream.id),
    intern(stream.uri),
    stream.aabb ? stream.aabb.slice() : null,
    stream.origin ? stream.origin.slice() : null
  ];
  if (stream.priority !== undefined || stream.metadata !== undefined) {
    tuple[4] = stream.priority ?? null;
  }
  if (stream.metadata !== undefined) {
    tuple[5] = JSON.parse(JSON.stringify(stream.metadata));
  }
  return tuple;
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

function createRuntimeQuantizationAABB(index: XGFStreamingIndex): number[] | undefined {
  const aabbs = [
    index.aabb,
    ...(index.streams || []).map((stream) => stream.aabb)
  ].filter((aabb): aabb is number[] => !!aabb && aabb.length === 6);
  if (aabbs.length === 0) {
    return undefined;
  }
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const aabb of aabbs) {
    result[0] = Math.min(result[0], aabb[0]);
    result[1] = Math.min(result[1], aabb[1]);
    result[2] = Math.min(result[2], aabb[2]);
    result[3] = Math.max(result[3], aabb[3]);
    result[4] = Math.max(result[4], aabb[4]);
    result[5] = Math.max(result[5], aabb[5]);
  }
  return result;
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
