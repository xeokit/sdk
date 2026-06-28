import {splitCompressedGeometry} from "../splitCompressedGeometry";
import {TrianglesPrimitive, PointsPrimitive, LinesPrimitive} from "../../../base/constants";

// Each vertex v is encoded as position-x = v and color-r = v, so the original
// vertex id is recoverable from any chunk's output — letting us verify triangle
// coverage and attribute-following without reaching into the splitter.

function triParams(numVerts: number, tris: number[][], id = "g") {
  const positionsCompressed: number[] = [];
  const colorsCompressed: number[] = [];
  for (let v = 0; v < numVerts; v++) {
    positionsCompressed.push(v, 0, 0);
    colorsCompressed.push(v, 0, 0, 255);
  }
  return {
    id,
    primitive: TrianglesPrimitive,
    aabb: [0, 0, 0, numVerts, 0, 0] as any,
    positionsCompressed,
    colorsCompressed,
    indices: tris.flat(),
  };
}

/** Recover a chunk's triangles as sorted tuples of *original* vertex ids. */
function chunkTriangles(chunk: any): string[] {
  const pos = chunk.positionsCompressed;
  const origOf = (local: number) => pos[local * 3]; // x = original id
  const out: string[] = [];
  for (let i = 0; i + 2 < chunk.indices.length; i += 3) {
    out.push([origOf(chunk.indices[i]), origOf(chunk.indices[i + 1]), origOf(chunk.indices[i + 2])]
      .sort((a, b) => a - b).join(","));
  }
  return out;
}

describe("splitCompressedGeometry", () => {

  it("returns the input unchanged when within caps", () => {
    const g = triParams(6, [[0, 1, 2], [3, 4, 5]]);
    const out = splitCompressedGeometry(g, 1000, 1000);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(g); // same reference, no work done
  });

  it("splits triangles into chunks within caps, preserving every triangle", () => {
    // 6 independent triangles, 18 vertices, no sharing.
    const tris = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17]];
    const g = triParams(18, tris);

    const maxVerts = 6; // 2 triangles per chunk
    const chunks = splitCompressedGeometry(g, maxVerts, 1000);

    expect(chunks.length).toBe(3);
    for (const c of chunks) {
      expect(c.positionsCompressed.length / 3).toBeLessThanOrEqual(maxVerts);
      expect(c.indices!.length % 3).toBe(0);
      const nVerts = c.positionsCompressed.length / 3;
      for (const i of c.indices!) expect(i).toBeLessThan(nVerts); // in range
    }

    // Ids: every chunk is freshly suffixed (no collision with the original).
    expect(chunks.map(c => c.id)).toEqual(["g__split0", "g__split1", "g__split2"]);

    // Every original triangle appears exactly once across chunks.
    const recovered = chunks.flatMap(chunkTriangles).sort();
    const expected = tris.map(t => [...t].sort((a, b) => a - b).join(",")).sort();
    expect(recovered).toEqual(expected);
  });

  it("duplicates boundary vertices shared across chunks", () => {
    // Fan: vertex 0 is the shared apex of every triangle.
    const tris: number[][] = [];
    for (let i = 1; i < 12; i++) tris.push([0, i, i + 1]);
    const g = triParams(13, tris);

    const chunks = splitCompressedGeometry(g, 6, 1000);
    expect(chunks.length).toBeGreaterThan(1);

    // Apex (orig id 0) must appear in more than one chunk.
    const chunksWithApex = chunks.filter(c => chunkTriangles(c).some(t => t.split(",").includes("0")));
    expect(chunksWithApex.length).toBeGreaterThan(1);

    // Total emitted vertices exceed the original (duplication happened).
    const totalVerts = chunks.reduce((n, c) => n + c.positionsCompressed.length / 3, 0);
    expect(totalVerts).toBeGreaterThan(13);

    // Coverage still exact.
    const recovered = chunks.flatMap(chunkTriangles).sort();
    const expected = tris.map(t => [...t].sort((a, b) => a - b).join(",")).sort();
    expect(recovered).toEqual(expected);
  });

  it("splits on the index cap when vertices are reused", () => {
    // Many triangles, few unique vertices (heavy reuse) so maxIndices binds.
    const tris: number[][] = [];
    for (let i = 0; i < 30; i++) tris.push([0, 1, 2 + (i % 4)]); // only 6 unique verts
    const g = triParams(6, tris);

    const maxIndices = 12; // 4 triangles per chunk
    const chunks = splitCompressedGeometry(g, 1000, maxIndices);

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.indices!.length).toBeLessThanOrEqual(maxIndices);
    expect(chunks.flatMap(chunkTriangles).length).toBe(30); // all triangles kept
  });

  it("carries vertex colours with their vertices", () => {
    const tris = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
    const g = triParams(9, tris);
    const chunks = splitCompressedGeometry(g, 6, 1000);

    for (const c of chunks) {
      const pos = c.positionsCompressed;
      const col = c.colorsCompressed!;
      for (let v = 0; v < pos.length / 3; v++) {
        expect(col[v * 4]).toBe(pos[v * 3]); // color-r == position-x == original id
        expect(col[v * 4 + 3]).toBe(255);
      }
    }
  });

  it("partitions points by vertex with no indices", () => {
    const positionsCompressed: number[] = [];
    for (let v = 0; v < 10; v++) positionsCompressed.push(v, 0, 0);
    const g = {id: "p", primitive: PointsPrimitive, positionsCompressed, aabb: [0, 0, 0, 10, 0, 0] as any};

    const chunks = splitCompressedGeometry(g, 4, 1000);
    expect(chunks.map(c => c.positionsCompressed.length / 3)).toEqual([4, 4, 2]);
    for (const c of chunks) expect(c.indices).toBeUndefined();
    // Concatenated positions equal the original (order preserved).
    expect(chunks.flatMap(c => Array.from(c.positionsCompressed))).toEqual(positionsCompressed);
  });

  it("leaves unsupported primitives unchanged", () => {
    const g = {
      id: "L", primitive: LinesPrimitive,
      positionsCompressed: Array.from({length: 3000}, (_, i) => i),
      indices: Array.from({length: 2000}, (_, i) => i % 1000),
      aabb: [0, 0, 0, 1, 1, 1] as any,
    };
    const out = splitCompressedGeometry(g, 100, 100);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(g);
  });

  it("preserves typed-array kind of the inputs", () => {
    const positionsCompressed = new Uint16Array(18 * 3);
    for (let v = 0; v < 18; v++) positionsCompressed[v * 3] = v;
    const g = {
      id: "t", primitive: TrianglesPrimitive,
      positionsCompressed,
      indices: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]),
      aabb: [0, 0, 0, 18, 0, 0] as any,
    };
    const chunks = splitCompressedGeometry(g, 6, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].positionsCompressed).toBeInstanceOf(Uint16Array);
    expect(chunks[0].indices).toBeInstanceOf(Uint32Array);
  });
});
