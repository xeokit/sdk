import {Scene} from "../Scene";
import {CoordinateSystem} from "../CoordinateSystem";
import {createCoordinateSystemTransform} from "../createCoordinateSystemTransform";
import {createMat4Float64, type Mat4} from "../../../base/math/matrix";
import {type Vec3} from "../../../base/math/vector";

// Apply a column-major 4x4 transform to a 3D point (w = 1).
function transformPoint(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8]  * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9]  * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

describe("CoordinateSystem", () => {

  it("has a right-handed Z-up basis and meter defaults out of the box", () => {
    const cs = new Scene().coordinateSystem;

    // Default basis: [right, up, forward] = X-right, Z-up, Y-forward.
    expect(Array.from(cs.basis)).toEqual([1, 0, 0, 0, 0, 1, 0, 1, 0]);
    expect(Array.from(cs.worldRight)).toEqual([1, 0, 0]);
    expect(Array.from(cs.worldUp)).toEqual([0, 0, 1]);
    expect(Array.from(cs.worldForward)).toEqual([0, 1, 0]);

    // Z is the up axis.
    expect(cs.zUp).toBe(true);
    expect(cs.yUp).toBe(false);
    expect(cs.xUp).toBe(false);

    expect(cs.units).toBe("meters");
    expect(Array.from(cs.origin)).toEqual([0, 0, 0]);
  });

  it("derives world axes and up-flags from params", () => {
    // Y-up basis: right=X, up=Y, forward=-Z.
    const cs = new CoordinateSystem(new Scene(), undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [10, 20, 30],
      units: "millimeters",
    });

    expect(Array.from(cs.worldRight)).toEqual([1, 0, 0]);
    expect(Array.from(cs.worldUp)).toEqual([0, 1, 0]);
    expect(Array.from(cs.worldForward)).toEqual([0, 0, 1]);

    expect(cs.yUp).toBe(true);
    expect(cs.zUp).toBe(false);
    expect(cs.units).toBe("millimeters");
    expect(Array.from(cs.origin)).toEqual([10, 20, 30]);
  });

  it("round-trips through toParams / fromParams", () => {
    const cs = new CoordinateSystem(new Scene(), undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [1, 2, 3],
      units: "feet",
      scaleToMeters: 0.3048,
    });

    const params = cs.toParams();
    expect(params.units).toBe("feet");
    expect(params.scaleToMeters).toBeCloseTo(0.3048, 6);
    expect(params.origin).toEqual([1, 2, 3]);
    expect(params.basis).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    const cs2 = new CoordinateSystem(new Scene());
    cs2.fromParams(params);
    expect(cs2.units).toBe("feet");
    expect(Array.from(cs2.origin)).toEqual([1, 2, 3]);
    expect(Array.from(cs2.basis)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(Array.from(cs2.worldRight)).toEqual([1, 0, 0]);
    expect(Array.from(cs2.worldUp)).toEqual([0, 1, 0]);
    expect(Array.from(cs2.worldForward)).toEqual([0, 0, 1]);
    expect(cs2.yUp).toBe(true);
    expect(cs2.zUp).toBe(false);
  });
});

describe("createCoordinateSystemTransform", () => {

  it("produces an identity transform between two identical coordinate systems", () => {
    const scene = new Scene();
    const a = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [5, 6, 7],
      units: "meters",
      scaleToMeters: 1,
    });
    const b = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [5, 6, 7],
      units: "meters",
      scaleToMeters: 1,
    });

    const mat = createCoordinateSystemTransform(a, b, createMat4Float64());
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (let i = 0; i < 16; i++) {
      expect(mat[i]).toBeCloseTo(identity[i], 10);
    }
  });

  it("applies a pure unit scale when only the units differ", () => {
    // a authored in millimeters, b in meters, same axis-aligned basis and origin.
    const scene = new Scene();
    const a = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: "millimeters",
      scaleToMeters: 0.001,
    });
    const b = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    });

    const mat = createCoordinateSystemTransform(a, b, createMat4Float64());

    // 1000 mm in `a` maps to 1 m in `b`.
    const out = transformPoint(mat, [1000, 2000, 3000]);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(2, 6);
    expect(out[2]).toBeCloseTo(3, 6);
  });

  it("re-maps axes when the source basis differs (Y-up -> Z-up)", () => {
    // a: Y-up (right=X, up=Y, forward=Z).
    // b: Z-up (right=X, up=Z, forward=Y) — the SDK default.
    const scene = new Scene();
    const a = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    });
    const b = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    });

    const mat = createCoordinateSystemTransform(a, b, createMat4Float64());

    // The transform maps coords expressed in a's basis into b's basis:
    //   p_b = transpose(B_b) * B_a * p_a.
    // a's "up" (its Y axis, point [0,1,0]) is world up; expressed in b (Z-up)
    // that should land on b's up axis -> [0,0,1].
    const up = transformPoint(mat, [0, 1, 0]);
    expect(up[0]).toBeCloseTo(0, 6);
    expect(up[1]).toBeCloseTo(0, 6);
    expect(up[2]).toBeCloseTo(1, 6);

    // a's "forward" (its Z axis, point [0,0,1]) is world forward; in b (forward=Y)
    // that should land on b's forward axis -> [0,1,0].
    const fwd = transformPoint(mat, [0, 0, 1]);
    expect(fwd[0]).toBeCloseTo(0, 6);
    expect(fwd[1]).toBeCloseTo(1, 6);
    expect(fwd[2]).toBeCloseTo(0, 6);

    // X (right) is shared -> unchanged.
    const right = transformPoint(mat, [1, 0, 0]);
    expect(right[0]).toBeCloseTo(1, 6);
    expect(right[1]).toBeCloseTo(0, 6);
    expect(right[2]).toBeCloseTo(0, 6);
  });

  it("translates by the scaled origin delta", () => {
    // Same basis/units; b's origin is offset, so a point at a's origin lands at
    // the negated origin delta in b.
    const scene = new Scene();
    const a = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [10, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    });
    const b = new CoordinateSystem(scene, undefined, {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    });

    const mat = createCoordinateSystemTransform(a, b, createMat4Float64());

    const out = transformPoint(mat, [0, 0, 0]);
    expect(out[0]).toBeCloseTo(10, 6);
    expect(out[1]).toBeCloseTo(0, 6);
    expect(out[2]).toBeCloseTo(0, 6);
  });
});
