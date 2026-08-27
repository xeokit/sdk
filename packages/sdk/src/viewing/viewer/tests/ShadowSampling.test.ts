import {
  clampShadowPcfKernelSize,
  getShadowDebugModeId,
  getShadowPcfRadius,
  normalizeShadowDebugMode
} from "../ShadowSampling";

describe("ShadowSampling", () => {
  test("clamps PCF kernel size to supported odd widths", () => {
    expect(clampShadowPcfKernelSize(-1)).toBe(1);
    expect(clampShadowPcfKernelSize(NaN)).toBe(1);
    expect(clampShadowPcfKernelSize(1)).toBe(1);
    expect(clampShadowPcfKernelSize(2)).toBe(3);
    expect(clampShadowPcfKernelSize(4)).toBe(5);
    expect(clampShadowPcfKernelSize(6)).toBe(7);
    expect(clampShadowPcfKernelSize(8)).toBe(7);
  });

  test("converts PCF kernel size to shader radius", () => {
    expect(getShadowPcfRadius(undefined)).toBe(1);
    expect(getShadowPcfRadius(undefined, 1)).toBe(0);
    expect(getShadowPcfRadius(1)).toBe(0);
    expect(getShadowPcfRadius(3)).toBe(1);
    expect(getShadowPcfRadius(5)).toBe(2);
    expect(getShadowPcfRadius(7)).toBe(3);
  });

  test("normalizes shadow debug modes to shader IDs", () => {
    expect(normalizeShadowDebugMode(undefined)).toBe(false);
    expect(normalizeShadowDebugMode(false)).toBe(false);
    expect(normalizeShadowDebugMode(true)).toBe("factor");
    expect(normalizeShadowDebugMode("factor")).toBe("factor");
    expect(normalizeShadowDebugMode("depth")).toBe("rawDepth");
    expect(normalizeShadowDebugMode("rawDepth")).toBe("rawDepth");
    expect(normalizeShadowDebugMode("cascade")).toBe("cascade");
    expect(normalizeShadowDebugMode("refDepth")).toBe("refDepth");
    expect(normalizeShadowDebugMode("bias")).toBe("bias");
    expect(normalizeShadowDebugMode("blockerDepth")).toBe("blockerDepth");
    expect(normalizeShadowDebugMode("filterRadius")).toBe("filterRadius");
    expect(normalizeShadowDebugMode("visibility")).toBe("visibility");

    expect(getShadowDebugModeId(false)).toBe(0);
    expect(getShadowDebugModeId(true)).toBe(1);
    expect(getShadowDebugModeId("factor")).toBe(1);
    expect(getShadowDebugModeId("depth")).toBe(2);
    expect(getShadowDebugModeId("rawDepth")).toBe(2);
    expect(getShadowDebugModeId("cascade")).toBe(3);
    expect(getShadowDebugModeId("refDepth")).toBe(4);
    expect(getShadowDebugModeId("bias")).toBe(5);
    expect(getShadowDebugModeId("blockerDepth")).toBe(6);
    expect(getShadowDebugModeId("filterRadius")).toBe(7);
    expect(getShadowDebugModeId("visibility")).toBe(8);
  });
});
