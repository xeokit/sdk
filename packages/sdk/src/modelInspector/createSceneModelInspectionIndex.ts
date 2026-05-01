import type {SceneGeometry, SceneModel} from "../scene";
import {decompressPositions3WithAABB3} from "../math/compression";
import {transformPoint4} from "../math/matrix";
import {createVec4Float64} from "../math/vector";
import {isTriangleMesh} from "./inspections/util";
import type {SceneModelInspectionIndex} from "./SceneModelInspectionIndex";


/**
 * Per-vertex canonical-slot map for a {@link SceneGeometry} —
 * returned by the index's `canonicalSlots` accessor.
 */
export interface VertexCanonicalSlots {
  /** Per-vertex remap: `canonical[v] === v` iff `v` is the first
   *  occurrence of its byte signature; otherwise points at the
   *  canonical to coalesce onto. */
  canonical: Int32Array;
  /** Number of vertex slots that survive de-duplication. */
  uniqueCount: number;
}


/**
 * Build a fresh {@link SceneModelInspectionIndex} for `sceneModel`.
 *
 * Per-row laziness: the returned index is empty up-front. Each
 * accessor builds its column on first call and caches the value
 * in a per-id row. {@link releaseHeavyRows} clears the heavier
 * caches; {@link invalidateGeometry} / {@link invalidateObject}
 * / {@link invalidateReferences} drop the corresponding scopes.
 *
 * Callers normally don't construct this directly — they go
 * through {@link getInspectionIndex} which keeps a WeakMap-cached
 * instance per SceneModel for the duration of the SceneModel's
 * life.
 */
export function createSceneModelInspectionIndex(
  sceneModel: SceneModel,
): SceneModelInspectionIndex {

  const geomRows  = new Map<string, GeomRow>();
  const objRows   = new Map<string, ObjRow>();
  let refTables: RefTables | null = null;

  function geomRow(id: string): GeomRow {
    let row = geomRows.get(id);
    if (!row) { row = {} as GeomRow; geomRows.set(id, row); }
    return row;
  }

  function objRow(id: string): ObjRow {
    let row = objRows.get(id);
    if (!row) { row = {} as ObjRow; objRows.set(id, row); }
    return row;
  }

  return {

    sceneModel,

    // ── Per-geometry rows ───────────────────────────────────────

    contentHash(geometryId) {
      const row = geomRow(geometryId);
      if (row.contentHash === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.contentHash = g ? computeContentHash(g) : "";
      }
      return row.contentHash;
    },

    topologyKey(geometryId) {
      const row = geomRow(geometryId);
      if (row.topologyKey === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.topologyKey = g ? computeTopologyKey(g) : "";
      }
      return row.topologyKey;
    },

    edgeLengthHistogram(geometryId) {
      const row = geomRow(geometryId);
      if (row.edgeLengthHistogram === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.edgeLengthHistogram = (g && isTriangleMesh(g) && g.indices && g.positionsCompressed && g.aabb)
          ? computeEdgeLengthHistogram(g, this.decompressedPositions(geometryId))
          : null;
      }
      return row.edgeLengthHistogram;
    },

    decompressedPositions(geometryId) {
      const row = geomRow(geometryId);
      if (row.decompressedPositions === undefined) {
        const g = sceneModel.geometries[geometryId];
        if (g && g.positionsCompressed && g.aabb) {
          row.decompressedPositions =
            decompressPositions3WithAABB3(g.positionsCompressed, g.aabb) as Float32Array;
        } else {
          row.decompressedPositions = new Float32Array(0);
        }
      }
      return row.decompressedPositions;
    },

    vertexUsageMask(geometryId) {
      const row = geomRow(geometryId);
      if (row.vertexUsageMask === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.vertexUsageMask = g && g.positionsCompressed
          ? computeVertexUsageMask(g)
          : new Uint8Array(0);
      }
      return row.vertexUsageMask;
    },

    canonicalSlots(geometryId) {
      const row = geomRow(geometryId);
      if (row.canonicalSlots === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.canonicalSlots = g ? computeCanonicalSlots(g) : null;
      }
      return row.canonicalSlots;
    },

    undirectedEdgeIncidence(geometryId) {
      const row = geomRow(geometryId);
      if (row.undirectedEdgeIncidence === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.undirectedEdgeIncidence = (g && isTriangleMesh(g) && g.indices)
          ? computeUndirectedEdgeIncidence(g)
          : null;
      }
      return row.undirectedEdgeIncidence;
    },

    edgeToTriangles(geometryId) {
      const row = geomRow(geometryId);
      if (row.edgeToTriangles === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.edgeToTriangles = (g && isTriangleMesh(g) && g.indices)
          ? computeEdgeToTriangles(g)
          : null;
      }
      return row.edgeToTriangles;
    },

    directedEdgeIncidence(geometryId) {
      const row = geomRow(geometryId);
      if (row.directedEdgeIncidence === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.directedEdgeIncidence = (g && isTriangleMesh(g) && g.indices)
          ? computeDirectedEdgeIncidence(g)
          : null;
      }
      return row.directedEdgeIncidence;
    },

    canonicalTriangleKeys(geometryId) {
      const row = geomRow(geometryId);
      if (row.canonicalTriangleKeys === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.canonicalTriangleKeys = (g && isTriangleMesh(g) && g.indices)
          ? computeCanonicalTriangleKeys(g)
          : null;
      }
      return row.canonicalTriangleKeys;
    },

    aabbCentroidMagSq(geometryId) {
      const row = geomRow(geometryId);
      if (row.aabbCentroidMagSq === undefined) {
        const g = sceneModel.geometries[geometryId];
        row.aabbCentroidMagSq = g && g.aabb ? computeAabbCentroidMagSq(g.aabb) : 0;
      }
      return row.aabbCentroidMagSq;
    },

    // ── Per-object rows ─────────────────────────────────────────

    objectWorldAABB(objectId) {
      const row = objRow(objectId);
      if (!row.worldAABB) {
        row.worldAABB = computeObjectWorldAABB(sceneModel, objectId);
      }
      return row.worldAABB;
    },

    // ── Per-scene reverse-reference tables ──────────────────────

    materialReferences() {
      if (!refTables) refTables = computeReferenceTables(sceneModel);
      return refTables.materialReferences;
    },
    textureReferences() {
      if (!refTables) refTables = computeReferenceTables(sceneModel);
      return refTables.textureReferences;
    },
    transformReferences() {
      if (!refTables) refTables = computeReferenceTables(sceneModel);
      return refTables.transformReferences;
    },

    // ── Lifecycle hooks ─────────────────────────────────────────

    invalidateGeometry(geometryId) {
      geomRows.delete(geometryId);
    },

    invalidateObject(objectId) {
      objRows.delete(objectId);
    },

    invalidateReferences() {
      refTables = null;
    },

    invalidateAll() {
      geomRows.clear();
      objRows.clear();
      refTables = null;
    },

    releaseHeavyRows() {
      for (const row of geomRows.values()) {
        row.decompressedPositions     = undefined;
        row.undirectedEdgeIncidence   = undefined;
        row.edgeToTriangles           = undefined;
        row.directedEdgeIncidence     = undefined;
        row.canonicalTriangleKeys     = undefined;
        row.edgeLengthHistogram       = undefined;
      }
    },
  };
}


// ── Internal row shapes ──────────────────────────────────────────

interface GeomRow {
  contentHash?:              string;
  topologyKey?:               string;
  edgeLengthHistogram?:       Uint32Array | null;
  decompressedPositions?:     Float32Array;
  vertexUsageMask?:           Uint8Array;
  canonicalSlots?:            VertexCanonicalSlots | null;
  undirectedEdgeIncidence?:   Map<string, number> | null;
  edgeToTriangles?:           {edges: Map<string, number[]>; degenerate: Uint8Array} | null;
  directedEdgeIncidence?:     Map<string, number> | null;
  canonicalTriangleKeys?:     {keys: Set<string>; duplicateCount: number; kept: Uint8Array} | null;
  aabbCentroidMagSq?:         number;
}

interface ObjRow {
  worldAABB?: Float32Array;
}

interface RefTables {
  materialReferences:  Map<string, string[]>;
  textureReferences:   Map<string, string[]>;
  transformReferences: Map<string, {meshes: string[]; childTransforms: string[]}>;
}


// ── Column builders ──────────────────────────────────────────────

function computeContentHash(geom: SceneGeometry): string {
  return [
    String(geom.primitive),
    fnv1a(geom.positionsCompressed),
    geom.indices            ? fnv1a(geom.indices)            : "x",
    geom.normalsCompressed  ? fnv1a(geom.normalsCompressed)  : "x",
    geom.uvsCompressed      ? fnv1a(geom.uvsCompressed)      : "x",
    geom.aabb               ? Array.from(geom.aabb).join(",") : "x",
  ].join("|");
}


function computeTopologyKey(geom: SceneGeometry): string {
  const vertCount = geom.positionsCompressed
    ? (geom.positionsCompressed.length / 3) | 0
    : 0;
  const triCount = geom.indices ? (geom.indices.length / 3) | 0 : 0;
  return `${geom.primitive}|${vertCount}|${triCount}`;
}


/** 64-bin log₂ histogram of triangle edge lengths. */
function computeEdgeLengthHistogram(
  geom: SceneGeometry,
  positions: Float32Array,
): Uint32Array {
  const NUM_BINS = 64;
  const MIN_LOG2 = -10;
  const MAX_LOG2 = 10;
  const SPAN = MAX_LOG2 - MIN_LOG2;

  const histogram = new Uint32Array(NUM_BINS);
  const indices = geom.indices!;
  const triCount = (indices.length / 3) | 0;

  const tally = (a: number, b: number) => {
    const dx = positions[a * 3]     - positions[b * 3];
    const dy = positions[a * 3 + 1] - positions[b * 3 + 1];
    const dz = positions[a * 3 + 2] - positions[b * 3 + 2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!(len > 0)) return;
    const log = Math.log2(len);
    let bin = ((log - MIN_LOG2) / SPAN * NUM_BINS) | 0;
    if (bin < 0) bin = 0;
    else if (bin >= NUM_BINS) bin = NUM_BINS - 1;
    histogram[bin]++;
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    tally(i0, i1);
    tally(i1, i2);
    tally(i2, i0);
  }
  return histogram;
}


function computeVertexUsageMask(geom: SceneGeometry): Uint8Array {
  const vertCount = (geom.positionsCompressed!.length / 3) | 0;
  const used = new Uint8Array(vertCount);
  if (geom.indices) {
    const idx = geom.indices;
    for (let i = 0; i < idx.length; i++) {
      const v = idx[i];
      if (v >= 0 && v < vertCount) used[v] = 1;
    }
  }
  if (geom.edgeIndices) {
    const e = geom.edgeIndices;
    for (let i = 0; i < e.length; i++) {
      const v = e[i];
      if (v >= 0 && v < vertCount) used[v] = 1;
    }
  }
  return used;
}


function computeEdgeToTriangles(geom: SceneGeometry): {
  edges: Map<string, number[]>;
  degenerate: Uint8Array;
} {
  const indices = geom.indices!;
  const triCount = (indices.length / 3) | 0;
  const edges = new Map<string, number[]>();
  const degenerate = new Uint8Array(triCount);
  const push = (a: number, b: number, t: number) => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const k = `${lo}_${hi}`;
    const arr = edges.get(k);
    if (arr) arr.push(t);
    else edges.set(k, [t]);
  };
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    if (i0 === i1 || i1 === i2 || i0 === i2) {
      degenerate[t] = 1;
      continue;
    }
    push(i0, i1, t);
    push(i1, i2, t);
    push(i2, i0, t);
  }
  return {edges, degenerate};
}


function computeUndirectedEdgeIncidence(geom: SceneGeometry): Map<string, number> {
  const indices = geom.indices!;
  const triCount = (indices.length / 3) | 0;
  const map = new Map<string, number>();
  const tally = (a: number, b: number) => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const k = `${lo}_${hi}`;
    map.set(k, (map.get(k) || 0) + 1);
  };
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    if (i0 === i1 || i1 === i2 || i0 === i2) continue;
    tally(i0, i1);
    tally(i1, i2);
    tally(i2, i0);
  }
  return map;
}


function computeDirectedEdgeIncidence(geom: SceneGeometry): Map<string, number> {
  const indices = geom.indices!;
  const triCount = (indices.length / 3) | 0;
  const map = new Map<string, number>();
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    if (i0 === i1 || i1 === i2 || i0 === i2) continue;
    const k01 = `${i0}_${i1}`;
    const k12 = `${i1}_${i2}`;
    const k20 = `${i2}_${i0}`;
    map.set(k01, (map.get(k01) || 0) + 1);
    map.set(k12, (map.get(k12) || 0) + 1);
    map.set(k20, (map.get(k20) || 0) + 1);
  }
  return map;
}


function computeCanonicalTriangleKeys(geom: SceneGeometry): {
  keys: Set<string>;
  duplicateCount: number;
  kept: Uint8Array;
} {
  const indices = geom.indices!;
  const triCount = (indices.length / 3) | 0;
  const keys = new Set<string>();
  const kept = new Uint8Array(triCount);
  let duplicateCount = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    if (i0 === i1 || i1 === i2 || i0 === i2) {
      // Degenerate — keep, dropDegenerateTriangles is the right
      // owner of that concern.
      kept[t] = 1;
      continue;
    }
    let a = i0, b = i1, c = i2;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (b > c) { const tmp = b; b = c; c = tmp; }
    if (a > b) { const tmp = a; a = b; b = tmp; }
    const k = `${a}_${b}_${c}`;
    if (keys.has(k)) {
      duplicateCount++;
    } else {
      keys.add(k);
      kept[t] = 1;
    }
  }
  return {keys, duplicateCount, kept};
}


function computeAabbCentroidMagSq(aabb: ArrayLike<number>): number {
  const cx = (aabb[0] + aabb[3]) * 0.5;
  const cy = (aabb[1] + aabb[4]) * 0.5;
  const cz = (aabb[2] + aabb[5]) * 0.5;
  return cx * cx + cy * cy + cz * cz;
}


function computeObjectWorldAABB(sceneModel: SceneModel, objectId: string): Float32Array {
  const out = new Float32Array(6);
  out[0] = out[1] = out[2] = Number.POSITIVE_INFINITY;
  out[3] = out[4] = out[5] = Number.NEGATIVE_INFINITY;
  const obj = sceneModel.objects[objectId];
  if (!obj || obj.destroyed) return out;
  const corner = createVec4Float64() as any;
  for (const mesh of obj.meshes) {
    if (!mesh || mesh.destroyed) continue;
    const geom = sceneModel.geometries[mesh.geometryId];
    if (!geom || geom.destroyed || !geom.aabb) continue;
    const a = geom.aabb;
    const wm = mesh.worldMatrix;
    for (let i = 0; i < 8; i++) {
      corner[0] = (i & 1) ? a[3] : a[0];
      corner[1] = (i & 2) ? a[4] : a[1];
      corner[2] = (i & 4) ? a[5] : a[2];
      corner[3] = 1;
      const w = transformPoint4(wm, corner, corner);
      if (w[0] < out[0]) out[0] = w[0]; if (w[0] > out[3]) out[3] = w[0];
      if (w[1] < out[1]) out[1] = w[1]; if (w[1] > out[4]) out[4] = w[1];
      if (w[2] < out[2]) out[2] = w[2]; if (w[2] > out[5]) out[5] = w[2];
    }
  }
  return out;
}


function computeReferenceTables(sceneModel: SceneModel): RefTables {
  const materialReferences = new Map<string, string[]>();
  const textureReferences  = new Map<string, string[]>();
  const transformReferences = new Map<string, {meshes: string[]; childTransforms: string[]}>();

  const ensureT = (id: string) => {
    let r = transformReferences.get(id);
    if (!r) { r = {meshes: [], childTransforms: []}; transformReferences.set(id, r); }
    return r;
  };

  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    if (mesh.destroyed) continue;
    if (mesh.materialId) {
      const arr = materialReferences.get(mesh.materialId);
      if (arr) arr.push(meshId); else materialReferences.set(mesh.materialId, [meshId]);
    }
    if (mesh.parentTransform) {
      ensureT(mesh.parentTransform.id).meshes.push(meshId);
    }
  }
  for (const matId in sceneModel.materials) {
    const mat = sceneModel.materials[matId];
    if (mat.destroyed) continue;
    const slots = [
      mat.colorTexture, mat.metallicRoughnessTexture,
      mat.normalsTexture, mat.emissiveTexture,
      mat.occlusionTexture,
    ];
    for (const t of slots) {
      if (!t) continue;
      const tid = (t as { id?: string }).id;
      if (!tid) continue;
      const arr = textureReferences.get(tid);
      if (arr) arr.push(matId); else textureReferences.set(tid, [matId]);
    }
  }
  for (const tId in sceneModel.transforms) {
    const t = sceneModel.transforms[tId];
    if (t.destroyed) continue;
    if (t.parentTransform) {
      ensureT(t.parentTransform.id).childTransforms.push(tId);
    }
  }
  return {materialReferences, textureReferences, transformReferences};
}


/**
 * 32-bit FNV-1a over the byte view of `arr`. Returned as
 * `length:hash` (hash in base36) so the per-array length is part
 * of the discriminator. Same algorithm as the inline `hashGeometry`
 * in the duplicateGeometries inspection — pulled out so the
 * inspection and any future consumer share one canonical fingerprint.
 */
function fnv1a(arr: ArrayLike<number>): string {
  let bytes: Uint8Array;
  const ta = arr as { buffer?: unknown; byteOffset?: number; byteLength?: number };
  if (ta.buffer instanceof ArrayBuffer && typeof ta.byteLength === "number") {
    bytes = new Uint8Array(ta.buffer, ta.byteOffset || 0, ta.byteLength);
  } else {
    const f = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) f[i] = arr[i];
    bytes = new Uint8Array(f.buffer);
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${arr.length}:${(h >>> 0).toString(36)}`;
}


/**
 * For each vertex slot of a {@link SceneGeometry}, return the
 * index of the first slot it byte-matches across
 * `positionsCompressed` + `normalsCompressed` + `uvsCompressed`.
 *
 * Two slots match only when every populated attribute matches —
 * so vertex splitting for genuine seams / crease edges (different
 * normals on the same position) keeps the slots separate, while
 * truly redundant slots (same position, normal, UV) collapse onto
 * the earlier one.
 *
 * Implementation: per-vertex FNV-1a 32-bit hash over the u16
 * attribute components; `Map<number, number | number[]>` keyed by
 * hash, with a small slot-list for collisions.
 */
function computeCanonicalSlots(
  geom: SceneGeometry,
): VertexCanonicalSlots | null {
  const positions = geom.positionsCompressed;
  if (!positions || positions.length === 0) return null;
  const normals   = geom.normalsCompressed;
  const uvs       = geom.uvsCompressed;
  const vertCount = (positions.length / 3) | 0;

  const canonical = new Int32Array(vertCount);
  const slotByHash = new Map<number, number | number[]>();
  let unique = 0;

  for (let v = 0; v < vertCount; v++) {
    const h = hashVertex(positions, normals, uvs, v);
    const existing = slotByHash.get(h);
    if (existing === undefined) {
      slotByHash.set(h, v);
      canonical[v] = v;
      unique++;
      continue;
    }
    if (typeof existing === "number") {
      if (vertsEqual(positions, normals, uvs, v, existing)) {
        canonical[v] = existing;
      } else {
        slotByHash.set(h, [existing, v]);
        canonical[v] = v;
        unique++;
      }
      continue;
    }
    let found = -1;
    for (let i = 0; i < existing.length; i++) {
      if (vertsEqual(positions, normals, uvs, v, existing[i])) {
        found = existing[i];
        break;
      }
    }
    if (found !== -1) {
      canonical[v] = found;
    } else {
      existing.push(v);
      canonical[v] = v;
      unique++;
    }
  }

  return {canonical, uniqueCount: unique};
}


/** 32-bit FNV-1a over a vertex's u16 attribute components. */
function hashVertex(
  positions: ArrayLike<number>,
  normals:   ArrayLike<number> | undefined,
  uvs:       ArrayLike<number> | undefined,
  slot:      number,
): number {
  let h = 0x811c9dc5;
  const p3 = slot * 3;
  h = Math.imul(h ^ positions[p3],     0x01000193);
  h = Math.imul(h ^ positions[p3 + 1], 0x01000193);
  h = Math.imul(h ^ positions[p3 + 2], 0x01000193);
  if (normals) {
    const n2 = slot * 2;
    h = Math.imul(h ^ normals[n2],     0x01000193);
    h = Math.imul(h ^ normals[n2 + 1], 0x01000193);
  }
  if (uvs) {
    const u2 = slot * 2;
    h = Math.imul(h ^ uvs[u2],     0x01000193);
    h = Math.imul(h ^ uvs[u2 + 1], 0x01000193);
  }
  return h >>> 0;
}


/** Direct byte-equality of two vertex slots across every populated attribute. */
function vertsEqual(
  positions: ArrayLike<number>,
  normals:   ArrayLike<number> | undefined,
  uvs:       ArrayLike<number> | undefined,
  a:         number,
  b:         number,
): boolean {
  const a3 = a * 3, b3 = b * 3;
  if (positions[a3]     !== positions[b3])     return false;
  if (positions[a3 + 1] !== positions[b3 + 1]) return false;
  if (positions[a3 + 2] !== positions[b3 + 2]) return false;
  if (normals) {
    const a2 = a * 2, b2 = b * 2;
    if (normals[a2]     !== normals[b2])     return false;
    if (normals[a2 + 1] !== normals[b2 + 1]) return false;
  }
  if (uvs) {
    const a2 = a * 2, b2 = b * 2;
    if (uvs[a2]     !== uvs[b2])     return false;
    if (uvs[a2 + 1] !== uvs[b2 + 1]) return false;
  }
  return true;
}
