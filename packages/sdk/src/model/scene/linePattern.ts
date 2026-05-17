/**
 * Shared line-pattern helpers — used by both {@link model!scene.SceneMaterial | SceneMaterial}
 * (per-material override) and the View's lines material (View-
 * level fallback). Kept in `scene/` because `SceneMaterial` can't
 * reach into the viewer package (wrong direction of the
 * dependency arrow); viewer re-exports the public type.
 *
 * @module scene/linePattern
 * @internal
 */

/**
 * Named dash/gap conventions for line-primitive meshes.
 *
 * Each preset is a repeating `[dash, gap, dash, gap, …]`
 * sequence whose entries are measured in **line-width units** —
 * each value is multiplied by the current line width when the
 * pattern is applied. A `"dashed"` line at `lineWidth = 1` and a
 * `"dashed"` line at `lineWidth = 8` therefore have identical
 * visual proportions, just scaled.
 *
 * Mirrors the standard engineering / architectural conventions
 * (ISO 128, AutoCAD `ACAD.lin`):
 *
 *   - `"solid"`      — continuous (no pattern).
 *   - `"dashed"`     — visible-but-hidden / construction lines.
 *   - `"dotted"`     — fine reference / phantom lines.
 *   - `"dashDot"`    — centre / symmetry / axis lines.
 *   - `"dashDotDot"` — phantom / future-construction lines.
 *
 * Custom patterns can be set as a plain `number[]` (up to 8
 * entries, alternating dash/gap, units of line-width).
 */
export type LineStyle = "solid" | "dashed" | "dotted" | "dashDot" | "dashDotDot";

/**
 * Maximum number of `[dash, gap, …]` entries a single pattern
 * can carry. Caps both the storage size of a normalised pattern
 * and the bound of any consumer's pattern walk. Eight entries
 * cover every standard ISO 128 / AutoCAD linetype.
 */
export const MAX_LINE_PATTERN_ENTRIES = 8;

/**
 * Built-in patterns, in line-width units. Values were picked to
 * read cleanly at both `lineWidth = 1` and `lineWidth ≥ 4`; they
 * correspond roughly to ISO 128's type-A/B/C/E linetype families.
 */
export const LINE_STYLE_PRESETS: { [K in LineStyle]: readonly number[] } = {
  solid:      [],
  dashed:     [3.0, 2.0],
  dotted:     [0.5, 1.5],
  dashDot:    [3.0, 1.5, 0.5, 1.5],
  dashDotDot: [3.0, 1.5, 0.5, 1.5, 0.5, 1.5],
};

/**
 * A normalised representation of a line pattern, suitable for
 * forwarding to a renderer (or for inspection by tools).
 *
 * - `entries` is always exactly {@link MAX_LINE_PATTERN_ENTRIES}
 *   long, zero-padded after `len` — so consumers can blindly
 *   read the whole array without a length check.
 * - `len === 0` means "solid" (no pattern); consumers should
 *   short-circuit the pattern walk in that case and fall through
 *   to whatever view-level fallback they implement (or render a
 *   continuous line if none).
 * - `period` is the sum of in-use entries (`entries[0..len-1]`),
 *   the natural modulus base when walking the pattern along a
 *   segment. `0` when `len === 0`.
 */
export interface NormalisedLinePattern {
  entries: Float32Array<any>;
  len: number;
  period: number;
}

/**
 * Build an empty (solid) {@link NormalisedLinePattern}. The
 * Float32Array is freshly allocated so callers may mutate it
 * without aliasing a shared buffer.
 */
export function emptyLinePattern(): NormalisedLinePattern {
  return {
    entries: new Float32Array(MAX_LINE_PATTERN_ENTRIES),
    len: 0,
    period: 0,
  };
}

/**
 * Normalise either a {@link LineStyle} preset name or a raw
 * `number[]` into the canonical representation. The supplied
 * `out` is filled in-place and returned for chaining; pass a
 * freshly-allocated buffer (see {@link emptyLinePattern}) on
 * first use and reuse it on subsequent updates.
 *
 * Invalid input — unknown preset, non-finite or negative
 * entries — collapses to a solid pattern (`len = 0`). Easier
 * to debug than silently emitting a mangled stipple.
 */
export function normaliseLinePattern(
  value: LineStyle | number[] | null | undefined,
  out: NormalisedLinePattern,
): NormalisedLinePattern {
  // Determine the source array first; commit to `out` last so a
  // bad input leaves the previous state in place if we want
  // (currently we DO overwrite on bad input — see below).
  let entries: readonly number[];
  if (value === null || value === undefined) {
    entries = [];
  } else if (typeof value === "string") {
    const preset = LINE_STYLE_PRESETS[value as LineStyle];
    if (!preset) {
      entries = [];
    } else {
      entries = preset;
    }
  } else if (Array.isArray(value)) {
    const cleaned: number[] = [];
    let valid = true;
    for (let i = 0; i < value.length && i < MAX_LINE_PATTERN_ENTRIES; i++) {
      const v = value[i];
      if (!Number.isFinite(v) || v < 0) {
        valid = false;
        break;
      }
      cleaned.push(v);
    }
    entries = valid ? cleaned : [];
  } else {
    entries = [];
  }

  out.entries.fill(0);
  let period = 0;
  let len = 0;
  for (let i = 0; i < entries.length && i < MAX_LINE_PATTERN_ENTRIES; i++) {
    out.entries[i] = entries[i];
    period += entries[i];
    len = i + 1;
  }
  // Zero-period patterns are degenerate (a modulo-by-period
  // walk would divide by zero); treat as solid.
  if (period <= 0) {
    len = 0;
    period = 0;
  }
  out.len = len;
  out.period = period;
  return out;
}
