import {Scene} from "../../../../model/scene";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {splitSceneGeometry} from "../../internal/splitSceneGeometry";
import {compactUnusedVertices} from "../compactUnusedVertices";
import {downgradeNonWatertight} from "../downgradeNonWatertight";
import {dropDuplicateTriangles} from "../dropDuplicateTriangles";
import {mergeDuplicateVertices} from "../mergeDuplicateVertices";
import {tightenAabb} from "../tightenAabb";

// SceneGeometry stores positions/normals as quantised uint16 but UVs as float
// (RG32F). The coalesce fix compacts every attribute into a smaller array; a
// regression allocated the UV array as uint16, truncating fractional and
// tiling (> 1) UVs to integers and scrambling the texture mapping into noise.
describe("mergeDuplicateVertices", () => {

  it("preserves float UV values (including tiling > 1) when coalescing", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    // v3 is byte-identical to v0 (same position + UV) so it coalesces; the
    // surviving UVs must keep their fractional and > 1 tiling values.
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 0, 0],
      uvs:       [0.5, 1.5,  1.0, 0.0,  0.25, 0.75,  0.5, 1.5],
      indices:   [0, 1, 2,  0, 2, 3],
    });
    const geom = m.geometries["g"];
    expect(geom.uvsCompressed).toBeInstanceOf(Float32Array);
    expect(m.stats.numVertices).toBe(4);
    const updated: string[] = [];
    m.scene.events.onSceneGeometryUpdated.subscribe((_scene, g) => updated.push(g.id));

    const res = mergeDuplicateVertices.apply({resourceId: "g"} as any, m as any);
    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(m.stats.numVertices).toBe(3);
    expect(updated).toEqual(["g"]);

    // Still float, and the fractional / tiling values survived (uint16 would
    // have truncated 0.5 -> 0 and 1.5 -> 1).
    expect(geom.uvsCompressed).toBeInstanceOf(Float32Array);
    const uv = Array.from(geom.uvsCompressed as Float32Array).map(v => +v.toFixed(3));
    expect(uv).toContain(1.5);
    expect(uv).toContain(0.5);

    // Indices were remapped onto the compacted slots (v3 -> v0).
    const maxIndex = Math.max(...Array.from(geom.indices as ArrayLike<number>));
    expect(maxIndex).toBeLessThan((geom.positionsCompressed!.length / 3));
  });

  it("does not coalesce vertices that only differ by color", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 0, 0],
      colors:    [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1,  1, 1, 0, 1],
      indices:   [0, 1, 2,  3, 1, 2],
    });
    const geom = m.geometries["g"];
    expect(geom.colorsCompressed!.length).toBe(16);

    const res = mergeDuplicateVertices.apply({resourceId: "g"} as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(false);
    expect(geom.positionsCompressed!.length).toBe(12);
    expect(geom.colorsCompressed!.length).toBe(16);
  });

  it("preserves compressed colors when coalescing true duplicate vertices", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 0, 0],
      colors:    [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1,  1, 0, 0, 1],
      indices:   [0, 1, 2,  0, 2, 3],
    });
    const geom = m.geometries["g"];

    const res = mergeDuplicateVertices.apply({resourceId: "g"} as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(geom.positionsCompressed!.length).toBe(9);
    expect(Array.from(geom.colorsCompressed!)).toEqual([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]);
  });
});

describe("geometry mutation bookkeeping", () => {

  it("updates triangle stats and emits when duplicate triangles are dropped", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  1, 1, 0],
      indices:   [0, 1, 2,  0, 2, 1],
    });
    expect(m.stats.numTriangles).toBe(2);
    const updated: string[] = [];
    m.scene.events.onSceneGeometryUpdated.subscribe((_scene, g) => updated.push(g.id));

    const res = dropDuplicateTriangles.apply({resourceId: "g"} as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(m.stats.numTriangles).toBe(1);
    expect(updated).toEqual(["g"]);
  });

  it("updates primitive counts and emits when a solid is downgraded", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "g",
      primitive: SolidPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  1, 1, 0],
      indices:   [0, 1, 2],
    });
    expect(m.containsPrimitive(SolidPrimitive)).toBe(true);
    expect(m.containsPrimitive(SurfacePrimitive)).toBe(false);
    const updated: string[] = [];
    m.scene.events.onSceneGeometryUpdated.subscribe((_scene, g) => updated.push(g.id));

    const res = downgradeNonWatertight.apply({resourceId: "g"} as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(m.containsPrimitive(SolidPrimitive)).toBe(false);
    expect(m.containsPrimitive(SurfacePrimitive)).toBe(true);
    expect(updated).toEqual(["g"]);
  });

  it("emits without changing stats when only compressed bounds are tightened", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometryCompressed({
      id: "g",
      primitive: TrianglesPrimitive,
      positionsCompressed: [0, 0, 0,  32768, 0, 0,  0, 32768, 0],
      aabb: [0, 0, 0, 10, 10, 10],
      indices: [0, 1, 2],
    });
    const stats = {...m.stats};
    const updated: string[] = [];
    m.scene.events.onSceneGeometryUpdated.subscribe((_scene, g) => updated.push(g.id));

    const res = tightenAabb.apply({resourceId: "g"} as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(m.stats.numVertices).toBe(stats.numVertices);
    expect(m.stats.numTriangles).toBe(stats.numTriangles);
    expect(updated).toEqual(["g"]);
  });
});

describe("compactUnusedVertices", () => {

  it("preserves compressed colors when dropping unused vertex slots", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  1, 1, 0,  2, 2, 0],
      colors:    [1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1,  1, 1, 0, 1],
      indices:   [0, 1, 2],
    });
    const geom = m.geometries["g"];

    const res = compactUnusedVertices.apply({resourceId: "g"} as any, m as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(geom.positionsCompressed!.length).toBe(9);
    expect(Array.from(geom.colorsCompressed!)).toEqual([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]);
  });
});

describe("splitSceneGeometry", () => {

  it("preserves compressed colors on both split outputs", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [
        0, 0, 0,  1, 0, 0,  1, 1, 0,
        2, 0, 0,  3, 0, 0,  3, 1, 0,
      ],
      colors: [
        1, 0, 0, 1,  0, 1, 0, 1,  0, 0, 1, 1,
        1, 1, 0, 1,  1, 0, 1, 1,  0, 1, 1, 1,
      ],
      indices: [0, 1, 2,  3, 4, 5],
    });

    const res = splitSceneGeometry({
      sceneGeometry: m.geometries["g"],
      geometryIdA: "g_a",
      geometryIdB: "g_b",
    });

    expect(res.ok).toBe(true);
    const {geometryA, geometryB} = (res as any).value;
    expect(geometryA.colorsCompressed).toBeInstanceOf(Uint8Array);
    expect(geometryB.colorsCompressed).toBeInstanceOf(Uint8Array);
    expect(Array.from(geometryA.colorsCompressed!)).toEqual([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]);
    expect(Array.from(geometryB.colorsCompressed!)).toEqual([
      255, 255, 0, 255,
      255, 0, 255, 255,
      0, 255, 255, 255,
    ]);
  });

  it("cleans up the first output when creating the second output fails", () => {
    const m = new Scene().createModel({id: "m"}).value!;
    m.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [
        0, 0, 0,  1, 0, 0,  1, 1, 0,
        2, 0, 0,  3, 0, 0,  3, 1, 0,
      ],
      indices: [0, 1, 2,  3, 4, 5],
    });

    const res = splitSceneGeometry({
      sceneGeometry: m.geometries["g"],
      geometryIdA: "g_split",
      geometryIdB: "g_split",
    });

    expect(res.ok).toBe(false);
    expect(m.geometries["g_split"]).toBeUndefined();
  });
});
