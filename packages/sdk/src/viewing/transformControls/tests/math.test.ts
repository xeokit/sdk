import {composeRotateAroundPivot, composeScaleAroundPivot} from "../math/pivotTransforms";
import {rayPlane, closestPointOnLineToRay, rayAABB, canvasPosToRay} from "../math/rayGeometry";
import {axisFromLabel} from "../math/axes";
import {identityMat4, createMat4Float64, transformPoint3, type Mat4} from "../../../base/math/matrix";
import type {Vec3} from "../../../base/math/vector";

const approx = (v: ArrayLike<number>) => Array.from(v).map(n => +n.toFixed(6));

describe("pivotTransforms", () => {
  it("composeRotateAroundPivot rotates 90° about Z around a non-origin pivot", () => {
    const T = composeRotateAroundPivot([0, 0, 1], Math.PI / 2, [2, 0, 0]);
    // Point at pivot + (1,0,0); a +90° Z-rotation maps the (1,0,0) offset to (0,1,0).
    const out = transformPoint3(T, [3, 0, 0] as Vec3, [0, 0, 0] as Vec3);
    expect(approx(out)).toEqual([2, 1, 0]);
  });

  it("composeScaleAroundPivot scales by 2 around a non-origin pivot", () => {
    const T = composeScaleAroundPivot([2, 2, 2], [1, 1, 1]);
    // Point at pivot + (1,0,0) -> offset doubles to (2,0,0) -> absolute (3,1,1).
    const out = transformPoint3(T, [2, 1, 1] as Vec3, [0, 0, 0] as Vec3);
    expect(approx(out)).toEqual([3, 1, 1]);
  });
});

describe("rayGeometry", () => {
  it("rayPlane hits the XY plane", () => {
    expect(approx(rayPlane([0, 0, 5], [0, 0, -1], [0, 0, 0], [0, 0, 1])!)).toEqual([0, 0, 0]);
  });

  it("rayPlane returns null when parallel", () => {
    expect(rayPlane([0, 0, 5], [1, 0, 0], [0, 0, 0], [0, 0, 1])).toBeNull();
  });

  it("closestPointOnLineToRay finds the foot on the line", () => {
    // Line = X-axis; ray drops down through x=2 -> closest line point is (2,0,0).
    expect(approx(closestPointOnLineToRay([0, 0, 0], [1, 0, 0], [2, 5, 0], [0, -1, 0])!)).toEqual([2, 0, 0]);
  });

  it("rayAABB returns the entry distance", () => {
    // Ray from z=5 down the -Z axis enters the unit box at z=1 -> t=4.
    expect(rayAABB([0, 0, 5], [0, 0, -1], [-1, -1, -1, 1, 1, 1])).toBeCloseTo(4, 6);
  });

  it("rayAABB returns null on a miss", () => {
    expect(rayAABB([5, 5, 5], [0, 0, -1], [-1, -1, -1, 1, 1, 1])).toBeNull();
  });

  it("canvasPosToRay unprojects the canvas centre through identity matrices", () => {
    const I = identityMat4(createMat4Float64());
    const ray = canvasPosToRay([50, 50], 100, 100, I, I)!;
    expect(approx(ray.origin)).toEqual([0, 0, -1]);
    expect(approx(ray.dir)).toEqual([0, 0, 1]);
  });
});

describe("axisFromLabel", () => {
  it("returns canonical axes in world space", () => {
    expect(axisFromLabel("X", "world", identityMat4(createMat4Float64()))).toEqual([1, 0, 0]);
    expect(axisFromLabel("Y", "world", identityMat4(createMat4Float64()))).toEqual([0, 1, 0]);
    expect(axisFromLabel("Z", "world", identityMat4(createMat4Float64()))).toEqual([0, 0, 1]);
  });

  it("returns [0,0,0] for an unknown label", () => {
    expect(axisFromLabel("?", "world", identityMat4(createMat4Float64()))).toEqual([0, 0, 0]);
  });

  it("rotates the axis by rotationWorld in local space", () => {
    // Column-major 90°-about-Z rotation: local X -> (0,1,0).
    const r = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as unknown as Mat4;
    expect(approx(axisFromLabel("X", "local", r))).toEqual([0, 1, 0]);
  });
});
