import {getEffectiveResolutionScale} from "../resolutionScale";

function viewWithResolutionScale(applied: boolean, resolutionScale: number) {
  return {
    resolutionScale: {
      applied,
      resolutionScale,
    },
  } as any;
}

describe("getEffectiveResolutionScale", () => {
  test("returns 1 when resolution scaling is not active", () => {
    expect(getEffectiveResolutionScale(viewWithResolutionScale(false, 0.5))).toBe(1.0);
  });

  test("returns the configured scale when resolution scaling is active", () => {
    expect(getEffectiveResolutionScale(viewWithResolutionScale(true, 0.5))).toBe(0.5);
  });

  test("clamps active resolution scaling to the renderer minimum", () => {
    expect(getEffectiveResolutionScale(viewWithResolutionScale(true, 0.01))).toBe(0.05);
  });
});
