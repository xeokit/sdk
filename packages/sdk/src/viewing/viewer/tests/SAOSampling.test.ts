import {
  getSAODebugModeId,
  isRawSAODebugMode,
  normalizeSAODebugMode
} from "../SAOSampling";

describe("SAOSampling", () => {
  test("normalizes SAO debug modes to shader IDs", () => {
    expect(normalizeSAODebugMode(undefined)).toBe(false);
    expect(normalizeSAODebugMode(false)).toBe(false);
    expect(normalizeSAODebugMode(true)).toBe("finalFactor");
    expect(normalizeSAODebugMode("linearDepth")).toBe("linearDepth");
    expect(normalizeSAODebugMode("normal")).toBe("normal");
    expect(normalizeSAODebugMode("rawOcclusion")).toBe("rawOcclusion");
    expect(normalizeSAODebugMode("blurredOcclusion")).toBe("blurredOcclusion");
    expect(normalizeSAODebugMode("finalFactor")).toBe("finalFactor");

    expect(getSAODebugModeId(false)).toBe(0);
    expect(getSAODebugModeId(true)).toBe(5);
    expect(getSAODebugModeId("linearDepth")).toBe(1);
    expect(getSAODebugModeId("normal")).toBe(2);
    expect(getSAODebugModeId("rawOcclusion")).toBe(3);
    expect(getSAODebugModeId("blurredOcclusion")).toBe(4);
    expect(getSAODebugModeId("finalFactor")).toBe(5);
  });

  test("identifies debug modes that need the raw occlusion pass", () => {
    expect(isRawSAODebugMode("linearDepth")).toBe(true);
    expect(isRawSAODebugMode("normal")).toBe(true);
    expect(isRawSAODebugMode("rawOcclusion")).toBe(true);
    expect(isRawSAODebugMode("blurredOcclusion")).toBe(false);
    expect(isRawSAODebugMode("finalFactor")).toBe(false);
    expect(isRawSAODebugMode(false)).toBe(false);
  });
});
