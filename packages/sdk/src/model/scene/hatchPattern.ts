/**
 * Shared hatch-pattern helpers — used by {@link model!scene.SceneMaterial | SceneMaterial}'s
 * per-material override. Hatches are the engineering / CAD
 * analog of {@link linePattern}: they paint a regular set of
 * parallel ink lines over a triangle-surface mesh to indicate
 * a material class (concrete, steel, brick, masonry, …) on a
 * cross-section or elevation drawing.
 *
 * Each pattern is up to four "line families". A family is
 * `(angle, spacing, lineWidth)` — a set of parallel lines at
 * the given clockwise-from-horizontal angle, spaced `spacing`
 * pixels apart, with each line `lineWidth` pixels thick.
 * Crosshatch = two families at perpendicular angles; ISO 128
 * concrete fill = one family at 45°; ANSI31 = single family
 * at 45°; etc.
 *
 * Pattern is applied in screen space — fragment-coordinate
 * distance to the nearest family line. The hatch ink colour
 * (RGBA, also per-material) is blended over the lit surface
 * colour at the very end of shading; pre-lighting albedo and
 * Lambert / IBL shading are unaffected.
 *
 * @module scene/hatchPattern
 * @internal
 */

import {type Vec3} from "../../base/math/vector";

/**
 * Named hatch-pattern presets, mirroring common ANSI / ISO
 * cross-section fills.
 *
 * Line-family presets:
 *   - `"solid"`         — no hatch, surface is filled normally.
 *   - `"lines"`         — single horizontal line family.
 *   - `"cross"`         — horizontal + vertical (orthogonal grid).
 *   - `"diagonalLines"` — single 45° line family (ISO 128
 *                          concrete coarse, ANSI31 cast iron).
 *   - `"diagonalCross"` — 45° + −45° (ANSI32 steel,
 *                          ANSI34 plastic).
 *
 * Dedicated ANSI / ISO conventions:
 *   - `"ansi31"` — cast iron (single 45° diagonal, close-spaced).
 *   - `"ansi32"` — steel (45° + −45° crosshatch).
 *   - `"ansi33"` — bronze / brass (alternating dense and sparse
 *                  diagonal lines).
 *   - `"ansi36"` — masonry / brick (running-bond brick pattern).
 *   - `"ansi37"` — insulation (wavy diagonal lines).
 *   - `"ansi38"` — dots (uniformly-spaced dot grid).
 *   - `"isoConcreteFine"`   — fine 45° diagonal hatch.
 *   - `"isoConcreteCoarse"` — coarser 45° + −45° crosshatch
 *                              (heavy concrete fill).
 */
export type HatchStyle =
  | "solid"
  | "lines"
  | "cross"
  | "diagonalLines"
  | "diagonalCross"
  | "ansi31"
  | "ansi32"
  | "ansi33"
  | "ansi36"
  | "ansi37"
  | "ansi38"
  | "isoConcreteFine"
  | "isoConcreteCoarse";

/**
 * Coordinate space in which a hatch pattern's `spacing` and
 * `lineWidth` are measured.
 *
 * - `"screen"` (default) — units are screen-space pixels. The
 *   hatch tracks the camera: zooming in does not change the
 *   number of ink lines visible per surface unit, but those
 *   lines stay anchored to the screen rather than the geometry.
 *   Right for UI overlays, callout fills, and views where the
 *   hatch is part of the rendering style rather than the model.
 *
 * - `"world"` — units are world-space (the same units as the
 *   geometry's positions). The hatch is locked to the world XY
 *   plane and visible as the surface's intersection with a set
 *   of parallel world-space planes. Right for engineering plan
 *   views, cross sections, and architectural elevations where
 *   the hatch represents a physical material property
 *   (concrete fill at 200mm spacing, brickwork course at 250mm,
 *   etc.) and must stay consistent as the camera moves.
 *
 * - `"tangent"` — units are world-space, but the hatch axes
 *   follow the local surface frame (built from per-fragment
 *   derivatives of `vWorldPos`). Right for curved or tilted
 *   surfaces where a fixed world-XY hatch would skew or
 *   compress unnaturally — the hatch reads as if printed on
 *   the surface like a material decal. Slight per-face frame
 *   ambiguity at sharp corners is the documented trade-off.
 */
export type HatchSpace = "screen" | "world" | "tangent";

/**
 * Type of a single hatch line family.
 *
 * - `"line"` (default) — straight parallel lines along the
 *   family's tangent direction.
 * - `"dot"` — uniformly-spaced dots on a rotated grid. The
 *   family's `spacing` is the grid pitch and `lineWidth` is
 *   the dot diameter; `angle` rotates the grid.
 * - `"wavy"` — sinusoidally-perturbed parallel lines. Used by
 *   ANSI37 insulation and similar conventions. `amplitude`
 *   sets the wave height (perpendicular to the line) and
 *   `wavelength` sets the period along the line.
 * - `"brick"` — offset rectangle pattern (masonry / ANSI36).
 *   `spacing` is the brick width, `brickHeight` is the brick
 *   height, `lineWidth` is the mortar thickness, and
 *   `courseOffset` shifts each row from the previous (typically
 *   `spacing / 2`).
 */
export type HatchFamilyType = "line" | "dot" | "wavy" | "brick";

/**
 * One family in a {@link HatchParams}. A family represents
 * an infinite repeating pattern primitive — by default parallel
 * lines, but also dots, wavy lines, or a brick lattice depending
 * on {@link type}.
 *
 * Length-valued fields (`spacing`, `lineWidth`, `phase`,
 * `amplitude`, `wavelength`, `brickHeight`, `courseOffset`)
 * are all measured in the units indicated by the parent
 * {@link HatchParams.space} — pixels for `"screen"` (default),
 * world units for `"world"` and `"tangent"`.
 */
export interface HatchFamily {
  /**
   * Family type — `"line"` (default), `"dot"`, `"wavy"`, or
   * `"brick"`. See {@link HatchFamilyType}.
   */
  type?: HatchFamilyType;
  /**
   * For `line` / `wavy` / `brick`: direction perpendicular to
   * the line direction, in degrees clockwise from horizontal.
   * For `dot`: rotation of the dot grid.
   */
  angle: number;
  /**
   * For `line` / `wavy`: distance between adjacent lines.
   * For `dot`: grid pitch (same on both axes).
   * For `brick`: brick width along the row direction.
   * Must be > 0.
   */
  spacing: number;
  /**
   * For `line` / `wavy`: line thickness.
   * For `dot`: dot diameter.
   * For `brick`: mortar thickness.
   */
  lineWidth: number;
  /**
   * Shift the pattern start position by this many units along
   * the family's primary axis. Defaults to `0`. Useful for
   * aligning a hatch to a feature edge (wall corner, centerline
   * start).
   */
  phase?: number;
  /**
   * **Wavy only.** Peak displacement perpendicular to the line
   * direction. `0` collapses to a straight line. Defaults to
   * `lineWidth` (so the wave height matches the line thickness
   * — a recognisable "fluttery" insulation hatch).
   */
  amplitude?: number;
  /**
   * **Wavy only.** Distance along the line direction for one
   * complete wave. Defaults to `spacing × 2`.
   */
  wavelength?: number;
  /**
   * **Brick only.** Brick height (perpendicular to the row
   * direction). Defaults to `spacing × 0.5` — a 2:1 brick
   * aspect ratio matching typical engineering masonry.
   */
  brickHeight?: number;
  /**
   * **Brick only.** Shift between consecutive rows along the
   * row direction. Defaults to `spacing × 0.5` — a half-brick
   * stagger producing standard running-bond brickwork.
   */
  courseOffset?: number;
}

/**
 * Custom hatch-pattern parameters — alternative to the named
 * {@link HatchStyle} presets.
 */
export interface HatchParams {
  /** Up to {@link MAX_HATCH_FAMILIES} line families. */
  families: HatchFamily[];
  /** Ink RGB colour. Defaults to black. */
  color?: Vec3;
  /** Ink opacity in `[0, 1]`. Defaults to `1`. */
  opacity?: number;
  /**
   * Coordinate space for `spacing` and `lineWidth`. Defaults to
   * `"screen"` (pixel units, camera-locked). Set to `"world"`
   * for hatches that stay anchored to the geometry — typical
   * for engineering plan / section views where the hatch
   * represents a physical material property at a real-world
   * pitch. See {@link HatchSpace}.
   */
  space?: HatchSpace;
}

/**
 * Maximum number of line families a single hatch pattern can
 * carry. Four covers every standard ANSI / ISO line-based
 * cross-section fill.
 */
export const MAX_HATCH_FAMILIES = 4;

/**
 * Built-in hatch families per preset. Spacings + line widths
 * are in pixels (screen-space hatch), picked to read cleanly
 * at typical UI scales.
 */
export const HATCH_STYLE_PRESETS: { [K in HatchStyle]: readonly HatchFamily[] } = {
  solid:             [],
  lines:             [{angle: 0,  spacing: 10, lineWidth: 1}],
  cross:             [{angle: 0,  spacing: 10, lineWidth: 1}, {angle: 90, spacing: 10, lineWidth: 1}],
  diagonalLines:     [{angle: 45, spacing: 10, lineWidth: 1}],
  diagonalCross:     [{angle: 45, spacing: 10, lineWidth: 1}, {angle: -45, spacing: 10, lineWidth: 1}],

  // ── ANSI cross-section fills ──
  ansi31:            [{angle: 45, spacing: 8,  lineWidth: 1}],
  ansi32:            [{angle: 45, spacing: 8,  lineWidth: 1}, {angle: -45, spacing: 8,  lineWidth: 1}],
  // Bronze / brass — two staggered diagonal line sets, one
  // tightly spaced and one half-offset. Implemented as two
  // families with the second using a half-spacing phase shift.
  ansi33:            [
    {angle: 45, spacing: 12, lineWidth: 1},
    {angle: 45, spacing: 12, lineWidth: 1, phase: 6},
  ],
  ansi36:            [{type: "brick", angle: 0, spacing: 20, brickHeight: 10, lineWidth: 1.5, courseOffset: 10}],
  ansi37:            [
    {type: "wavy", angle: 45,  spacing: 14, lineWidth: 1.5, amplitude: 3, wavelength: 18},
    {type: "wavy", angle: -45, spacing: 14, lineWidth: 1.5, amplitude: 3, wavelength: 18},
  ],
  ansi38:            [{type: "dot", angle: 0, spacing: 10, lineWidth: 2.5}],

  // ── ISO concrete-fill conventions ──
  isoConcreteFine:   [{angle: 45, spacing: 6,  lineWidth: 1}],
  isoConcreteCoarse: [
    {angle:  45, spacing: 6,  lineWidth: 1},
    {angle: -45, spacing: 6,  lineWidth: 1},
  ],
};

/**
 * Number of floats each {@link HatchFamily} occupies in the
 * normalised representation. Two RGBA32F texels' worth — the
 * first holds `(cos, sin, spacing, lineWidth)` and the second
 * holds `(typeId, phase, param1, param2)`, with the meaning of
 * `param1` / `param2` depending on the family type.
 */
export const HATCH_FAMILY_FLOAT_STRIDE = 8;

/**
 * Canonical representation of a hatch pattern, suitable for
 * forwarding to a downstream consumer (or for inspection by
 * tools).
 *
 * Layout:
 * - `families` is exactly `MAX_HATCH_FAMILIES × HATCH_FAMILY_FLOAT_STRIDE`
 *   floats long, zero-padded after `count`. Each family occupies
 *   8 consecutive slots:
 *
 *     ```
 *     [cos(θ), sin(θ), spacing, lineWidth,
 *      typeId, phase,  param1,  param2   ]
 *     ```
 *
 *   `typeId` is `0`=line, `1`=dot, `2`=wavy, `3`=brick. `param1`
 *   and `param2` encode the type-specific extras (amplitude /
 *   wavelength for wavy; brickHeight / courseOffset for brick).
 * - `count` is the number of in-use families (`0..4`). `0` means
 *   "no hatch" — consumers short-circuit and render the surface
 *   without overlay.
 * - `color` is exactly 4 floats long: `(r, g, b, opacity)`,
 *   `opacity = 0` collapses to no-visible-hatch.
 */
export interface NormalisedHatchPattern {
  families: Float32Array<any>;
  count: number;
  color: Float32Array<any>;
  /**
   * Coordinate-space flag — `0` for `"screen"`, `1` for
   * `"world"`, `2` for `"tangent"`. Plain number rather than
   * the named-string type so downstream consumers (GPU encoder,
   * shader) can read it as an integer flag without a string
   * compare.
   */
  space: number;
}

/**
 * Build an empty (solid) {@link NormalisedHatchPattern}. The
 * Float32Arrays are freshly allocated so callers may mutate them
 * without aliasing a shared buffer.
 */
export function emptyHatchPattern(): NormalisedHatchPattern {
  const color = new Float32Array(4);
  color[3] = 1.0;   // default opacity — irrelevant when count = 0 but cheap to keep sane
  return {
    families: new Float32Array(MAX_HATCH_FAMILIES * HATCH_FAMILY_FLOAT_STRIDE),
    count: 0,
    color,
    space: 0,       // 0 = screen, 1 = world, 2 = tangent
  };
}

function familyTypeId(type: HatchFamilyType | undefined): number {
  switch (type) {
    case "dot":   return 1;
    case "wavy":  return 2;
    case "brick": return 3;
    case "line":
    case undefined:
    default:      return 0;
  }
}

/**
 * Normalise either a {@link HatchStyle} preset name or a
 * {@link HatchParams} into the canonical representation. The
 * supplied `out` is filled in-place and returned for chaining;
 * pass a freshly-allocated buffer (see {@link emptyHatchPattern})
 * on first use and reuse it on subsequent updates.
 *
 * Invalid input — unknown preset, non-finite or non-positive
 * spacing, more than {@link MAX_HATCH_FAMILIES} families — is
 * treated as "solid" so a typo doesn't silently emit a mangled
 * hatch.
 */
export function normaliseHatchPattern(
  value: HatchStyle | HatchParams | null | undefined,
  out: NormalisedHatchPattern,
): NormalisedHatchPattern {
  let families: readonly HatchFamily[];
  let color: Vec3 | undefined;
  let opacity: number | undefined;
  let space: HatchSpace = "screen";

  if (value === null || value === undefined) {
    families = [];
  } else if (typeof value === "string") {
    const preset = HATCH_STYLE_PRESETS[value as HatchStyle];
    families = preset ?? [];
  } else if (typeof value === "object" && Array.isArray((value as HatchParams).families)) {
    const params = value as HatchParams;
    families = validateFamilies(params.families) ? params.families : [];
    color = params.color;
    opacity = params.opacity;
    if (params.space === "world")   space = "world";
    if (params.space === "tangent") space = "tangent";
  } else {
    families = [];
  }

  out.families.fill(0);
  let count = 0;
  for (let i = 0; i < families.length && i < MAX_HATCH_FAMILIES; i++) {
    const fam   = families[i];
    const rad   = fam.angle * Math.PI / 180;
    const phase = fam.phase ?? 0;
    const type  = familyTypeId(fam.type);
    // Type-specific params packed into the last two slots:
    //   - line  → (0, 0)
    //   - dot   → (0, 0)        (cos/sin/spacing/radius cover dots)
    //   - wavy  → (amplitude, wavelength)
    //   - brick → (brickHeight, courseOffset)
    let p1 = 0;
    let p2 = 0;
    if (type === 2) {
      p1 = fam.amplitude  ?? fam.lineWidth;
      p2 = fam.wavelength ?? fam.spacing * 2;
    } else if (type === 3) {
      p1 = fam.brickHeight  ?? fam.spacing * 0.5;
      p2 = fam.courseOffset ?? fam.spacing * 0.5;
    }
    // First texel — common across all family types: the rotation
    // basis (precomputed so the GPU doesn't have to evaluate trig
    // per-fragment), the primary spacing, and the primary
    // line/dot/mortar thickness.
    const base = i * HATCH_FAMILY_FLOAT_STRIDE;
    out.families[base + 0] = Math.cos(rad);
    out.families[base + 1] = Math.sin(rad);
    out.families[base + 2] = fam.spacing;
    out.families[base + 3] = fam.lineWidth;
    // Second texel — type discriminator, common phase offset,
    // and two type-specific extras.
    out.families[base + 4] = type;
    out.families[base + 5] = phase;
    out.families[base + 6] = p1;
    out.families[base + 7] = p2;
    count++;
  }
  out.count = count;

  const r = (color && color[0] !== undefined) ? color[0] : 0;
  const g = (color && color[1] !== undefined) ? color[1] : 0;
  const b = (color && color[2] !== undefined) ? color[2] : 0;
  const a = (opacity !== undefined) ? opacity : 1;
  out.color[0] = clamp01(r);
  out.color[1] = clamp01(g);
  out.color[2] = clamp01(b);
  out.color[3] = clamp01(a);
  out.space = space === "world" ? 1 : space === "tangent" ? 2 : 0;

  return out;
}

function validateFamilies(families: HatchFamily[]): boolean {
  if (families.length > MAX_HATCH_FAMILIES) return false;
  for (const f of families) {
    if (!Number.isFinite(f.angle) || !Number.isFinite(f.spacing) || !Number.isFinite(f.lineWidth)) return false;
    if (f.spacing <= 0 || f.lineWidth < 0) return false;
    // Optional fields — only validate when supplied so the
    // common case (`{angle, spacing, lineWidth}`) stays cheap.
    if (f.phase        !== undefined && !Number.isFinite(f.phase))        return false;
    if (f.amplitude    !== undefined && (!Number.isFinite(f.amplitude)    || f.amplitude    < 0)) return false;
    if (f.wavelength   !== undefined && (!Number.isFinite(f.wavelength)   || f.wavelength   <= 0)) return false;
    if (f.brickHeight  !== undefined && (!Number.isFinite(f.brickHeight)  || f.brickHeight  <= 0)) return false;
    if (f.courseOffset !== undefined && !Number.isFinite(f.courseOffset)) return false;
  }
  return true;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
