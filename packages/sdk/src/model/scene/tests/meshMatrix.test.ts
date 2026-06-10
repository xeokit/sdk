import {buildMat4} from "../buildMat4";
import {getMeshWorldMatrix} from "../getMeshWorldMatrix";

// A right-handed Z-up basis (column-major), matching CoordinateSystem's default.
const Z_UP_BASIS = [1, 0, 0, 0, 0, 1, 0, 1, 0];

// Minimal CoordinateSystem stub — getMeshWorldMatrix/createCoordinateSystemTransform
// only read basis/origin/units/scaleToMeters off it.
function coordSystem(overrides: any = {}): any {
  return {basis: Z_UP_BASIS, origin: [0, 0, 0], units: "meters", scaleToMeters: 1, ...overrides};
}

describe("buildMat4", () => {

  it("returns the identity matrix for no transform params", () => {
    const m = buildMat4({});
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (let i = 0; i < 16; i++) {
      expect(m[i]).toBeCloseTo(identity[i], 6);
    }
  });

  it("returns the identity matrix for unit scale and zero translation", () => {
    const m = buildMat4({position: [0, 0, 0], scale: [1, 1, 1]});
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (let i = 0; i < 16; i++) {
      expect(m[i]).toBeCloseTo(identity[i], 6);
    }
  });

  it("places a pure translation in elements [12,13,14]", () => {
    const m = buildMat4({position: [10, 20, 30]});
    // Rotation/scale block stays identity.
    expect(m[0]).toBeCloseTo(1, 6);
    expect(m[5]).toBeCloseTo(1, 6);
    expect(m[10]).toBeCloseTo(1, 6);
    // Translation column.
    expect(m[12]).toBeCloseTo(10, 6);
    expect(m[13]).toBeCloseTo(20, 6);
    expect(m[14]).toBeCloseTo(30, 6);
    expect(m[15]).toBeCloseTo(1, 6);
  });

  it("places a pure uniform scale on the diagonal", () => {
    const m = buildMat4({scale: [2, 3, 4]});
    expect(m[0]).toBeCloseTo(2, 6);
    expect(m[5]).toBeCloseTo(3, 6);
    expect(m[10]).toBeCloseTo(4, 6);
    expect(m[15]).toBeCloseTo(1, 6);
    // No translation.
    expect(m[12]).toBeCloseTo(0, 6);
    expect(m[13]).toBeCloseTo(0, 6);
    expect(m[14]).toBeCloseTo(0, 6);
  });

  it("accepts rotation as an [x,y,z,w] quaternion", () => {
    // Identity quaternion → identity rotation block.
    const m = buildMat4({quaternion: [0, 0, 0, 1]});
    expect(m[0]).toBeCloseTo(1, 6);
    expect(m[5]).toBeCloseTo(1, 6);
    expect(m[10]).toBeCloseTo(1, 6);
  });
});

describe("getMeshWorldMatrix", () => {

  const translation = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1];

  it("returns the mesh's own matrix when there is no parent transform", () => {
    const mesh: any = {matrix: translation};
    const result = getMeshWorldMatrix(mesh);
    expect(result).toBe(mesh.matrix);
  });

  it("returns an equivalent transform for an identity-equivalent target coordinate system", () => {
    const mesh: any = {
      matrix: translation,
      model: {coordinateSystem: coordSystem()},
    };
    // Same basis/origin/units/scale on both sides → the coord transform is identity,
    // so the world matrix is unchanged.
    const result = getMeshWorldMatrix(mesh, coordSystem());
    for (let i = 0; i < 16; i++) {
      expect(result[i]).toBeCloseTo(translation[i], 6);
    }
  });
});
