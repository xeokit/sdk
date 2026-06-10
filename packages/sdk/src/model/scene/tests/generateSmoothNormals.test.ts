import {generateSmoothNormals} from "../generateSmoothNormals";

// generateSmoothNormals returns oct-encoded normals as a Uint16Array of length
// 2 × vertexCount. Decode a single vertex (the inverse of octEncodeNormalsToU16)
// back into a unit 3D vector so we can assert on actual normal directions.
function decode(oct: Uint16Array, vertex: number): [number, number, number] {
  let ex = (oct[vertex * 2]     / 65535) * 2 - 1;
  let ey = (oct[vertex * 2 + 1] / 65535) * 2 - 1;
  let nz = 1 - Math.abs(ex) - Math.abs(ey);
  if (nz < 0) {
    const tx = (1 - Math.abs(ey)) * (ex >= 0 ? 1 : -1);
    const ty = (1 - Math.abs(ex)) * (ey >= 0 ? 1 : -1);
    ex = tx;
    ey = ty;
  }
  const inv = 1 / (Math.sqrt(ex * ex + ey * ey + nz * nz) || 1);
  return [ex * inv, ey * inv, nz * inv];
}

describe("generateSmoothNormals", () => {

  it("returns Uint16Array of length 2 × vertexCount", () => {
    const positions = [0, 0, 0,  1, 0, 0,  0, 1, 0];
    const indices = [0, 1, 2];
    const out = generateSmoothNormals(positions, indices)!;
    expect(out).toBeInstanceOf(Uint16Array);
    expect(out.length).toBe(2 * 3);
  });

  it("gives +Z normals for a single CCW triangle in the XY plane", () => {
    // CCW winding when viewed from +Z → face normal points toward +Z.
    const positions = [0, 0, 0,  1, 0, 0,  0, 1, 0];
    const indices = [0, 1, 2];
    const out = generateSmoothNormals(positions, indices)!;
    for (let v = 0; v < 3; v++) {
      const [x, y, z] = decode(out, v);
      expect(x).toBeCloseTo(0, 2);
      expect(y).toBeCloseTo(0, 2);
      expect(z).toBeCloseTo(1, 2);
    }
  });

  it("gives unit-length +Z normals for all 4 vertices of a coplanar quad", () => {
    // Unit quad, 2 triangles, CCW, shared vertices 0 and 2.
    const positions = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];
    const indices = [0, 1, 2,  0, 2, 3];
    const out = generateSmoothNormals(positions, indices)!;
    for (let v = 0; v < 4; v++) {
      const [x, y, z] = decode(out, v);
      expect(x).toBeCloseTo(0, 2);
      expect(y).toBeCloseTo(0, 2);
      expect(z).toBeCloseTo(1, 2);
      const len = Math.sqrt(x * x + y * y + z * z);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it("averages and renormalizes the normal at a vertex shared by two non-coplanar faces", () => {
    // Two equal-area right triangles meeting along the shared edge (v1,v2):
    //   face A in the XY plane (normal +Z),
    //   face B folded up into the YZ plane (normal +X).
    // Both faces wind CCW about their shared vertices, so vertex 1 (shared)
    // receives the area-weighted sum of +Z and +X → normalized (0.707,0,0.707).
    const positions = [
      0, 0, 0,   // 0  - only in face A
      1, 0, 0,   // 1  - shared
      1, 1, 0,   // 2  - shared
      0, 0, 1,   // 3  - only in face B (folded up along +Z)
    ];
    const indices = [
      0, 1, 2,   // face A: normal +Z
      1, 2, 3,   // face B: shares edge (1,2), normal in the +X/+Z quadrant
    ];
    const out = generateSmoothNormals(positions, indices)!;

    // Shared vertices 1 and 2 should be the renormalized average of the two
    // face normals (equal areas), and unit length.
    for (const v of [1, 2]) {
      const [x, y, z] = decode(out, v);
      const len = Math.sqrt(x * x + y * y + z * z);
      expect(len).toBeCloseTo(1, 5);
      // The averaged normal is a 45° blend with no Y component.
      expect(y).toBeCloseTo(0, 2);
      expect(x).toBeGreaterThan(0.1);
      expect(z).toBeGreaterThan(0.1);
    }
  });

  it("returns null for degenerate / malformed input", () => {
    expect(generateSmoothNormals([], [])).toBeNull();
    // Index count not a multiple of 3.
    expect(generateSmoothNormals([0, 0, 0,  1, 0, 0,  0, 1, 0], [0, 1])).toBeNull();
    // Fully degenerate triangle (all vertices coincident) → zero face normal.
    expect(generateSmoothNormals([0, 0, 0,  0, 0, 0,  0, 0, 0], [0, 1, 2])).toBeNull();
  });
});
