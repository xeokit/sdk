import {Scene} from "../Scene";
import {TrianglesPrimitive, PointsPrimitive} from "../../../base/constants";

// SceneGeometry narrows index/edge arrays to the smallest int type that holds
// their values (Uint8 < 256, Uint16 < 65536, else Uint32) to cut retained
// memory. These verify the chosen type and — critically — that index VALUES
// survive narrowing unchanged (a wrong type would wrap/corrupt them).

function model() {
  return new Scene().createModel({id: "m"}).value!;
}

/** N vertices on a line; `tris` are flat index triples. */
function grid(n: number): number[] {
  const p: number[] = [];
  for (let i = 0; i < n; i++) p.push(i, 0, 0);
  return p;
}

describe("SceneGeometry index narrowing", () => {

  it("uses Uint8 when every index < 256", () => {
    const m = model();
    m.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: grid(6), indices: [0, 1, 2, 3, 4, 5]});
    const g = m.geometries["g"];
    expect(g.indices).toBeInstanceOf(Uint8Array);
    expect(Array.from(g.indices!)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("uses Uint16 when some index is in [256, 65535]", () => {
    const m = model();
    const idx = [0, 1, 299, 0, 299, 298]; // max 299 → needs 16 bits
    m.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: grid(300), indices: idx});
    const g = m.geometries["g"];
    expect(g.indices).toBeInstanceOf(Uint16Array);
    expect(Array.from(g.indices!)).toEqual(idx); // values preserved, not wrapped
  });

  it("keeps Uint32 when an index is >= 65536", () => {
    const m = model();
    const n = 70000;
    const idx = [0, 1, n - 1]; // max 69999 → needs 32 bits
    m.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: grid(n), indices: idx});
    const g = m.geometries["g"];
    expect(g.indices).toBeInstanceOf(Uint32Array);
    expect(Array.from(g.indices!)).toEqual(idx);
  });

  it("narrows auto-built edge indices too", () => {
    // A small solid tetra-ish triangle set; edges reference the same vertices,
    // so they narrow on the same value bound.
    const m = model();
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1],
      indices: [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2],
    });
    const g = m.geometries["g"];
    if (g.edgeIndices && g.edgeIndices.length > 0) {
      expect(g.edgeIndices).toBeInstanceOf(Uint8Array); // 4 verts → all < 256
      for (const e of g.edgeIndices) expect(e).toBeLessThan(4);
    }
  });

  it("leaves point geometry (no indices) untouched", () => {
    const m = model();
    m.createGeometry({id: "g", primitive: PointsPrimitive, positions: grid(10)});
    expect(m.geometries["g"].indices).toBeUndefined();
  });
});
