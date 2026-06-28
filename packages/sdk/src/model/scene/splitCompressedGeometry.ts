import {PointsPrimitive, TrianglesPrimitive} from "../../base/constants";
import type {FloatArrayParam, IntArrayParam} from "../../base/math";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";

/**
 * Splits an over-capacity compressed geometry into chunks that each fit within
 * `maxVertices` / `maxIndices`, so the renderer can batch it — a single geometry
 * cannot span a GPU batch.
 *
 * Pure function: works entirely in the compressed domain and carries the shared
 * `aabb` (and `uvsDecompressMatrix` / `origin`) onto every chunk, so the
 * quantized positions stay valid — nothing is re-quantized. Vertices on a chunk
 * boundary are duplicated into each chunk that references them.
 *
 * v1 handles **triangles** (indexed) and **points**. Lines, gaussian splats, and
 * indexless triangle geometry are returned unchanged (single element) — callers
 * should only invoke this when a geometry is actually over capacity.
 *
 * Every chunk gets a fresh `${id}__splitN` id (none reuses the original `id`, so
 * the original never collides with its own pieces in the split lookup maps).
 */
export function splitCompressedGeometry(
  params: SceneGeometryCompressedParams,
  maxVertices: number,
  maxIndices: number,
): SceneGeometryCompressedParams[] {
  const numVertices = (params.positionsCompressed.length / 3) | 0;
  const numIndices = params.indices ? params.indices.length : 0;

  if (numVertices <= maxVertices && numIndices <= maxIndices) {
    return [params];
  }
  if (params.primitive === PointsPrimitive) {
    return splitPoints(params, maxVertices);
  }
  if (params.primitive === TrianglesPrimitive && params.indices) {
    return splitTriangles(params, maxVertices, maxIndices);
  }
  return [params];
}

/** Clones `values` into the same array kind as `source` (typed array or plain). */
function like(source: IntArrayParam | FloatArrayParam | undefined, values: number[]): any {
  if (source && ArrayBuffer.isView(source)) {
    return new (source.constructor as any)(values);
  }
  return values;
}

function gather(source: IntArrayParam | FloatArrayParam, from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i++) out.push(source[i]);
  return out;
}

function subId(id: string, i: number): string {
  return `${id}__split${i}`;
}

function splitPoints(
  params: SceneGeometryCompressedParams,
  maxVertices: number,
): SceneGeometryCompressedParams[] {
  const pos = params.positionsCompressed;
  const colors = params.colorsCompressed;
  const numVertices = (pos.length / 3) | 0;
  const out: SceneGeometryCompressedParams[] = [];

  for (let start = 0, chunk = 0; start < numVertices; start += maxVertices, chunk++) {
    const end = Math.min(start + maxVertices, numVertices);
    out.push({
      ...params,
      id: subId(params.id, chunk),
      positionsCompressed: like(pos, gather(pos, start * 3, end * 3)),
      colorsCompressed: colors ? like(colors, gather(colors, start * 4, end * 4)) : undefined,
      indices: undefined,
      edgeIndices: undefined,
    });
  }
  return out;
}

interface TriChunk {
  remap: Map<number, number>;
  positions: number[];
  normals: number[] | null;
  uvs: number[] | null;
  colors: number[] | null;
  indices: number[];
}

function splitTriangles(
  params: SceneGeometryCompressedParams,
  maxVertices: number,
  maxIndices: number,
): SceneGeometryCompressedParams[] {
  const pos = params.positionsCompressed;
  const idx = params.indices!;
  const normals = params.normalsCompressed;
  const uvs = params.uvsCompressed;
  const colors = params.colorsCompressed;
  const edges = params.edgeIndices;

  // Triangle index runs are multiples of 3.
  const maxTriIndices = Math.max(3, maxIndices - (maxIndices % 3));

  const newChunk = (): TriChunk => ({
    remap: new Map(),
    positions: [],
    normals: normals ? [] : null,
    uvs: uvs ? [] : null,
    colors: colors ? [] : null,
    indices: [],
  });

  const local = (chunk: TriChunk, v: number): number => {
    let l = chunk.remap.get(v);
    if (l === undefined) {
      l = chunk.remap.size;
      chunk.remap.set(v, l);
      chunk.positions.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      if (chunk.normals) chunk.normals.push(normals![v * 2], normals![v * 2 + 1]);
      if (chunk.uvs) chunk.uvs.push(uvs![v * 2], uvs![v * 2 + 1]);
      if (chunk.colors) chunk.colors.push(colors![v * 4], colors![v * 4 + 1], colors![v * 4 + 2], colors![v * 4 + 3]);
    }
    return l;
  };

  const chunks: TriChunk[] = [];
  let cur: TriChunk | null = null;

  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (!cur) cur = newChunk();
    let added = 0;
    if (!cur.remap.has(a)) added++;
    if (b !== a && !cur.remap.has(b)) added++;
    if (c !== a && c !== b && !cur.remap.has(c)) added++;
    if (cur.remap.size > 0 &&
        (cur.remap.size + added > maxVertices || cur.indices.length + 3 > maxTriIndices)) {
      chunks.push(cur);
      cur = newChunk();
    }
    cur.indices.push(local(cur, a), local(cur, b), local(cur, c));
  }
  if (cur && cur.remap.size > 0) chunks.push(cur);

  return chunks.map((chunk, i) => {
    let edgeIndices: IntArrayParam | undefined;
    if (edges) {
      // Keep edges whose both endpoints landed in this chunk (remapped). Edges
      // straddling a chunk boundary are dropped.
      const out: number[] = [];
      for (let e = 0; e + 1 < edges.length; e += 2) {
        const a = chunk.remap.get(edges[e]);
        const b = chunk.remap.get(edges[e + 1]);
        if (a !== undefined && b !== undefined) out.push(a, b);
      }
      edgeIndices = out.length ? like(edges, out) : undefined;
    }
    return {
      ...params,
      id: subId(params.id, i),
      positionsCompressed: like(pos, chunk.positions),
      indices: like(idx, chunk.indices),
      normalsCompressed: chunk.normals ? like(normals, chunk.normals) : undefined,
      uvsCompressed: chunk.uvs ? like(uvs, chunk.uvs) : undefined,
      colorsCompressed: chunk.colors ? like(colors, chunk.colors) : undefined,
      edgeIndices,
    };
  });
}
