import {Scene} from "../../../../model/scene";
import {TrianglesPrimitive} from "../../../../base/constants";
import {mergeDuplicateVertices} from "../mergeDuplicateVertices";

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

    const res = mergeDuplicateVertices.apply({resourceId: "g"} as any, m as any);
    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);

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
});
