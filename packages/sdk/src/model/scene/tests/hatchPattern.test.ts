import {
  MAX_HATCH_FAMILIES,
  HATCH_STYLE_PRESETS,
  HATCH_FAMILY_FLOAT_STRIDE,
  emptyHatchPattern,
  normaliseHatchPattern,
} from "../hatchPattern";

describe("hatchPattern helpers", () => {

  it("emptyHatchPattern() builds a well-formed, zeroed solid pattern", () => {
    const p = emptyHatchPattern();

    // count = 0 means "no hatch".
    expect(p.count).toBe(0);

    // families is a fully-zeroed fixed-size float buffer.
    expect(p.families).toBeInstanceOf(Float32Array);
    expect(p.families).toHaveLength(MAX_HATCH_FAMILIES * HATCH_FAMILY_FLOAT_STRIDE);
    expect(Array.from(p.families).every((v) => v === 0)).toBe(true);

    // color is (r, g, b, opacity); opacity defaults to 1.
    expect(p.color).toBeInstanceOf(Float32Array);
    expect(p.color).toHaveLength(4);
    expect(Array.from(p.color)).toEqual([0, 0, 0, 1]);

    // space flag defaults to 0 = screen.
    expect(p.space).toBe(0);

    // Fresh allocations — not aliased between calls.
    const q = emptyHatchPattern();
    expect(q.families).not.toBe(p.families);
    expect(q.color).not.toBe(p.color);
  });

  it("normaliseHatchPattern() encodes a named preset with the expected family count and stride", () => {
    // "cross" = horizontal + vertical line families.
    const out = emptyHatchPattern();
    const ret = normaliseHatchPattern("cross", out);

    // Filled in-place and returned for chaining.
    expect(ret).toBe(out);

    const preset = HATCH_STYLE_PRESETS.cross;
    expect(out.count).toBe(preset.length);
    expect(out.count).toBe(2);

    // Buffer is always the fixed full size regardless of in-use count.
    expect(out.families).toHaveLength(MAX_HATCH_FAMILIES * HATCH_FAMILY_FLOAT_STRIDE);

    // Family 0: angle 0 → cos=1, sin=0, spacing=10, lineWidth=1.
    const f0 = HATCH_FAMILY_FLOAT_STRIDE * 0;
    expect(out.families[f0 + 0]).toBeCloseTo(1, 6);   // cos(0)
    expect(out.families[f0 + 1]).toBeCloseTo(0, 6);   // sin(0)
    expect(out.families[f0 + 2]).toBe(10);            // spacing
    expect(out.families[f0 + 3]).toBe(1);             // lineWidth
    expect(out.families[f0 + 4]).toBe(0);             // typeId = line

    // Family 1: angle 90 → cos=0, sin=1.
    const f1 = HATCH_FAMILY_FLOAT_STRIDE * 1;
    expect(out.families[f1 + 0]).toBeCloseTo(0, 6);   // cos(90deg)
    expect(out.families[f1 + 1]).toBeCloseTo(1, 6);   // sin(90deg)
    expect(out.families[f1 + 2]).toBe(10);

    // Trailing (unused) families remain zeroed.
    const f2 = HATCH_FAMILY_FLOAT_STRIDE * 2;
    for (let i = f2; i < out.families.length; i++) {
      expect(out.families[i]).toBe(0);
    }
  });

  it("normaliseHatchPattern() encodes type-specific params for wavy/brick presets", () => {
    // ansi37 = two wavy families; ansi36 = one brick family.
    const wavy = normaliseHatchPattern("ansi37", emptyHatchPattern());
    expect(wavy.count).toBe(2);
    // typeId 2 = wavy; param1 = amplitude (3), param2 = wavelength (18).
    expect(wavy.families[4]).toBe(2);
    expect(wavy.families[6]).toBe(3);
    expect(wavy.families[7]).toBe(18);

    const brick = normaliseHatchPattern("ansi36", emptyHatchPattern());
    expect(brick.count).toBe(1);
    // typeId 3 = brick; param1 = brickHeight (10), param2 = courseOffset (10).
    expect(brick.families[4]).toBe(3);
    expect(brick.families[6]).toBe(10);
    expect(brick.families[7]).toBe(10);
  });

  it("normaliseHatchPattern() treats > MAX_HATCH_FAMILIES families as solid (whole input rejected)", () => {
    const tooMany = {
      families: Array.from({length: MAX_HATCH_FAMILIES + 3}, (_, i) => ({
        angle: i * 10,
        spacing: 10,
        lineWidth: 1,
      })),
    };

    const out = normaliseHatchPattern(tooMany, emptyHatchPattern());

    // validateFamilies() rejects the over-long array outright, so the input
    // falls back to "solid" (count 0) rather than being clamped to the cap.
    expect(out.count).toBe(0);
    expect(out.count).toBeLessThanOrEqual(MAX_HATCH_FAMILIES);
    expect(Array.from(out.families).every((v) => v === 0)).toBe(true);
  });

  it("normaliseHatchPattern() caps the encoded count at MAX_HATCH_FAMILIES for a valid full set", () => {
    // Exactly MAX families passes validation and fills the whole buffer.
    const full = {
      families: Array.from({length: MAX_HATCH_FAMILIES}, (_, i) => ({
        angle: i * 30,
        spacing: 8,
        lineWidth: 1,
      })),
    };
    const out = normaliseHatchPattern(full, emptyHatchPattern());
    expect(out.count).toBe(MAX_HATCH_FAMILIES);
    expect(out.count).toBeLessThanOrEqual(MAX_HATCH_FAMILIES);
  });

  it("normaliseHatchPattern() preserves the packed-buffer length invariant across all presets", () => {
    const expectedLen = MAX_HATCH_FAMILIES * HATCH_FAMILY_FLOAT_STRIDE;
    const out = emptyHatchPattern();

    for (const style of Object.keys(HATCH_STYLE_PRESETS) as (keyof typeof HATCH_STYLE_PRESETS)[]) {
      normaliseHatchPattern(style, out);

      // Buffer length never changes; count tracks the in-use families and is
      // capped at the family limit.
      expect(out.families).toHaveLength(expectedLen);
      expect(out.count).toBe(HATCH_STYLE_PRESETS[style].length);
      expect(out.count).toBeLessThanOrEqual(MAX_HATCH_FAMILIES);

      // Every in-use family occupies exactly HATCH_FAMILY_FLOAT_STRIDE slots;
      // slots beyond `count * stride` must be zero (re-zeroed each call).
      const used = out.count * HATCH_FAMILY_FLOAT_STRIDE;
      for (let i = used; i < expectedLen; i++) {
        expect(out.families[i]).toBe(0);
      }
    }
  });

  it("normaliseHatchPattern() maps color/opacity/space and clamps colour to [0,1]", () => {
    const out = normaliseHatchPattern(
      {
        families: [{angle: 0, spacing: 10, lineWidth: 1}],
        color: [2, -1, 0.5],   // out of range → clamped
        opacity: 0.25,
        space: "world",
      },
      emptyHatchPattern(),
    );

    expect(Array.from(out.color)).toEqual([1, 0, 0.5, 0.25]);
    expect(out.space).toBe(1);   // 1 = world
  });

  it("normaliseHatchPattern() treats null/undefined/unknown-preset as solid", () => {
    expect(normaliseHatchPattern(null, emptyHatchPattern()).count).toBe(0);
    expect(normaliseHatchPattern(undefined, emptyHatchPattern()).count).toBe(0);
    expect(normaliseHatchPattern("nope" as any, emptyHatchPattern()).count).toBe(0);
  });
});
