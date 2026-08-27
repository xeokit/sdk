import {
  computeShadowCascadeSplits,
  fitShadowCascadeToCamera,
  stabilizeShadowOrthoBounds
} from "../shadows";

describe("shadow math", () => {
  test("computes PSSM cascade split distances into a caller-provided target", () => {
    const target = new Float32Array(5);
    const splits = computeShadowCascadeSplits({
      nearDistance: 0.1,
      farDistance: 100,
      cascadeCount: 4,
      lambda: 0,
      target
    });

    expect(splits).toBe(target);
    expect(target[0]).toBeCloseTo(0.1);
    expect(target[1]).toBeCloseTo(25.075);
    expect(target[2]).toBeCloseTo(50.05);
    expect(target[3]).toBeCloseTo(75.025);
    expect(target[4]).toBeCloseTo(100);
  });

  test("stabilizes orthographic shadow bounds on an anchor-aligned texel grid", () => {
    const bounds = stabilizeShadowOrthoBounds({
      left: -0.4,
      right: 1.6,
      bottom: -0.1,
      top: 0.9,
      resolution: 100,
      anchorX: 0.13,
      anchorY: -0.07
    });

    const width = bounds.right - bounds.left;
    const height = bounds.top - bounds.bottom;
    const centerX = (bounds.left + bounds.right) * 0.5;
    const centerY = (bounds.bottom + bounds.top) * 0.5;

    expect(width).toBeCloseTo(height);
    expect(width).toBeGreaterThan(2);
    expect(bounds.left).toBeLessThanOrEqual(-0.4);
    expect(bounds.right).toBeGreaterThanOrEqual(1.6);
    expect(bounds.bottom).toBeLessThanOrEqual(-0.1);
    expect(bounds.top).toBeGreaterThanOrEqual(0.9);
    expect(bounds.texelWorldSize).toBeCloseTo(width / 100);
    expect((centerX - 0.13) / bounds.texelWorldSize).toBeCloseTo(Math.round((centerX - 0.13) / bounds.texelWorldSize));
    expect((centerY + 0.07) / bounds.texelWorldSize).toBeCloseTo(Math.round((centerY + 0.07) / bounds.texelWorldSize));
  });

  test("fits a cascade to perspective camera frustum corners in world light space", () => {
    const fit = fitShadowCascadeToCamera({
      projection: {type: "perspective", fovDegrees: 90},
      canvasWidth: 100,
      canvasHeight: 100,
      nearDistance: 1,
      farDistance: 3,
      lightViewMatrix: identityMat4(),
      cameraInverseViewMatrix: identityMat4(),
      resolution: 1000,
      padding: 1
    });

    expect(fit.left).toBeCloseTo(-3.006);
    expect(fit.right).toBeCloseTo(3.006);
    expect(fit.bottom).toBeCloseTo(-3.006);
    expect(fit.top).toBeCloseTo(3.006);
    expect(fit.near).toBeCloseTo(1);
    expect(fit.far).toBeCloseTo(6);
    expect(fit.depthRange).toBeCloseTo(5);
    expect(fit.texelWorldSize).toBeCloseTo(0.006012);
  });

  test("intersects fitted cascade bounds with an optional world-space scene AABB", () => {
    const fit = fitShadowCascadeToCamera({
      projection: {type: "perspective", fovDegrees: 90},
      canvasWidth: 100,
      canvasHeight: 100,
      nearDistance: 1,
      farDistance: 3,
      lightViewMatrix: identityMat4(),
      cameraInverseViewMatrix: identityMat4(),
      resolution: 1000,
      padding: 1,
      sceneAABB: [-1, -2, -2, 1, 2, -1]
    });

    expect(fit.left).toBeCloseTo(-2.004);
    expect(fit.right).toBeCloseTo(2.004);
    expect(fit.bottom).toBeCloseTo(-2.004);
    expect(fit.top).toBeCloseTo(2.004);
    expect(fit.near).toBeCloseTo(1);
    expect(fit.far).toBeCloseTo(5);
    expect(fit.depthRange).toBeCloseTo(4);
    expect(fit.texelWorldSize).toBeCloseTo(0.004008);
  });
});

function identityMat4(): number[] {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}
