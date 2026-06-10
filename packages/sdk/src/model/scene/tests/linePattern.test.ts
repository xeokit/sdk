import {
  MAX_LINE_PATTERN_ENTRIES,
  LINE_STYLE_PRESETS,
  emptyLinePattern,
  normaliseLinePattern,
} from "../linePattern";
import {
  isDefaultLayer,
  isDefaultLayerModel,
  isDefaultLayerObject,
} from "../isDefaultLayer";

describe("linePattern", () => {

  it("emptyLinePattern() is a solid, fixed-size, freshly-allocated pattern", () => {
    const p = emptyLinePattern();
    expect(p.entries).toBeInstanceOf(Float32Array);
    expect(p.entries).toHaveLength(MAX_LINE_PATTERN_ENTRIES);
    expect(p.len).toBe(0);
    expect(p.period).toBe(0);
    expect(Array.from(p.entries)).toEqual(new Array(MAX_LINE_PATTERN_ENTRIES).fill(0));

    // Freshly allocated — two calls don't alias the same buffer.
    expect(p.entries).not.toBe(emptyLinePattern().entries);
  });

  it("normaliseLinePattern() expands a LINE_STYLE_PRESETS entry into dash entries", () => {
    const out = emptyLinePattern();
    const dashed = LINE_STYLE_PRESETS.dashed; // [3.0, 2.0]
    const result = normaliseLinePattern("dashed", out);

    expect(result).toBe(out); // filled in-place and returned for chaining
    expect(result.len).toBe(dashed.length);
    expect(Array.from(result.entries.slice(0, result.len))).toEqual([...dashed]);
    // Zero-padded after len.
    expect(Array.from(result.entries.slice(result.len))).toEqual(
      new Array(MAX_LINE_PATTERN_ENTRIES - result.len).fill(0),
    );
    // period is the sum of in-use entries.
    expect(result.period).toBeCloseTo(dashed.reduce((a, b) => a + b, 0), 6);
  });

  it("normaliseLinePattern() treats the 'solid' preset as a solid pattern", () => {
    const out = emptyLinePattern();
    normaliseLinePattern("solid", out);
    expect(out.len).toBe(0);
    expect(out.period).toBe(0);
  });

  it("normaliseLinePattern() collapses unknown presets and bad input to solid", () => {
    const out = emptyLinePattern();
    normaliseLinePattern("bogus" as any, out);
    expect(out.len).toBe(0);
    expect(out.period).toBe(0);

    normaliseLinePattern([1, -2, 3], out);
    expect(out.len).toBe(0); // negative entry invalidates the whole pattern

    normaliseLinePattern([Infinity], out);
    expect(out.len).toBe(0); // non-finite entry invalidates the whole pattern
  });

  it("normaliseLinePattern() clamps a too-long custom pattern to MAX_LINE_PATTERN_ENTRIES", () => {
    const out = emptyLinePattern();
    // 12 entries, all valid (each 1.0); only the first 8 should survive.
    const tooLong = new Array(MAX_LINE_PATTERN_ENTRIES + 4).fill(1.0);
    normaliseLinePattern(tooLong, out);

    expect(out.len).toBe(MAX_LINE_PATTERN_ENTRIES);
    expect(out.entries).toHaveLength(MAX_LINE_PATTERN_ENTRIES);
    expect(out.period).toBeCloseTo(MAX_LINE_PATTERN_ENTRIES * 1.0, 6);
  });
});

describe("isDefaultLayer", () => {

  it("isDefaultLayer() is true for undefined and the canonical 'default' id", () => {
    expect(isDefaultLayer(undefined)).toBe(true);
    expect(isDefaultLayer("default")).toBe(true);
  });

  it("isDefaultLayer() is false for a named layer id", () => {
    expect(isDefaultLayer("overlay")).toBe(false);
    expect(isDefaultLayer("")).toBe(false);
  });

  it("isDefaultLayerModel() reads the model's layerId", () => {
    expect(isDefaultLayerModel({layerId: undefined} as any)).toBe(true);
    expect(isDefaultLayerModel({layerId: "default"} as any)).toBe(true);
    expect(isDefaultLayerModel({layerId: "overlay"} as any)).toBe(false);
  });

  it("isDefaultLayerObject() uses the object's layerId, else the parent model's", () => {
    // Object's own layerId wins when set.
    expect(isDefaultLayerObject({layerId: "default", model: {layerId: "overlay"}} as any)).toBe(true);
    expect(isDefaultLayerObject({layerId: "overlay", model: {layerId: "default"}} as any)).toBe(false);

    // Falls back to the parent model's layerId when the object's is unset.
    expect(isDefaultLayerObject({layerId: undefined, model: {layerId: "default"}} as any)).toBe(true);
    expect(isDefaultLayerObject({layerId: undefined, model: {layerId: "overlay"}} as any)).toBe(false);
    expect(isDefaultLayerObject({layerId: undefined, model: {layerId: undefined}} as any)).toBe(true);
  });
});
