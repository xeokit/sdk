import {computeCovariance3D} from "../utils/computeCovariance3D";

const r6 = (v: number[]) => v.map(n => +n.toFixed(6));

describe("computeCovariance3D", () => {
  it("identity rotation gives a diagonal covariance of squared scales", () => {
    // q = identity [0,0,0,1], scale [2,1,3] -> Σ = diag(4, 1, 9).
    const cov = computeCovariance3D([2, 1, 3], [0, 0, 0, 1]);
    expect(r6(cov)).toEqual([4, 0, 0, 1, 0, 9]); // [σxx, σxy, σxz, σyy, σyz, σzz]
  });

  it("is symmetric-PSD: trace equals sum of squared scales, rotation-invariant", () => {
    // trace(Σ) = trace(Rᵀ S² R) = trace(S²) = Σ scaleᵢ², independent of rotation.
    const scale = [2, 1, 3];
    const sumSq = 4 + 1 + 9;
    // a 90°-about-Z quat (x,y,z,w) = (0,0,sin45,cos45)
    const s = Math.SQRT1_2;
    const cov = computeCovariance3D(scale, [0, 0, s, s]);
    const trace = cov[0] + cov[3] + cov[5]; // σxx + σyy + σzz
    expect(+trace.toFixed(5)).toBe(sumSq);
  });

  it("90° about Z swaps the x/y variances", () => {
    // Rotating the (2,1,1)-scaled gaussian 90° about Z sends the large x-extent
    // onto y: σxx and σyy swap (4 <-> 1), σzz stays 1, off-diagonals ~0.
    const s = Math.SQRT1_2;
    const cov = computeCovariance3D([2, 1, 1], [0, 0, s, s]);
    expect(+cov[0].toFixed(4)).toBeCloseTo(1, 4); // σxx
    expect(+cov[3].toFixed(4)).toBeCloseTo(4, 4); // σyy
    expect(+cov[5].toFixed(4)).toBeCloseTo(1, 4); // σzz
    expect(+cov[1].toFixed(4)).toBeCloseTo(0, 4); // σxy
  });

  it("normalises a non-unit quaternion", () => {
    // Scaling the quaternion must not change the result (it gets normalised).
    const a = computeCovariance3D([2, 1, 3], [0, 0, 0, 1]);
    const b = computeCovariance3D([2, 1, 3], [0, 0, 0, 5]);
    expect(r6(b)).toEqual(r6(a));
  });
});
