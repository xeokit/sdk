import type {View} from "./View";
import {
  type LineStyle,
  type NormalisedLinePattern,
  emptyLinePattern,
  normaliseLinePattern,
} from "../../model/scene/linePattern";

// Re-export the shared types so callers that only depend on the
// viewer surface area don't have to reach into `scene/`.
export type {LineStyle} from "../../model/scene/linePattern";

/**
 * How a polyline joint between two consecutive line segments
 * should be drawn by the thick-line renderer.
 *
 * - `"miter"` — extend each segment's quad along the angle
 *   bisector to a sharp miter point (clamped at ~4 × halfWidth
 *   so acute angles don't spike). The default; matches every
 *   prior SDK release.
 * - `"round"` — leave the joint un-mitered: each segment's
 *   endpoint quad extends one halfWidth along its own direction
 *   (the same way a free endpoint does), so the rounded-rect
 *   SDF paints a half-disc at every joined side. Two
 *   overlapping half-discs from the two neighbouring segments
 *   together form a circular joint of diameter `lineWidth`.
 */
export type LineJoinStyle = "miter" | "round";

/**
 * Configures the appearance of "lines" geometry primitives.
 *
 * * Located at {@link View#linesMaterial}.
 */
class LinesMaterial  {

  /**
   * The View to which this LinesMaterial belongs.
   */
  public readonly view: View;

  private _lineWidth: number;
  private _joinStyle: LineJoinStyle;
  private _linePattern: NormalisedLinePattern;
  private _linePatternUserValue: LineStyle | number[];

  /**
   * @private
   */
  constructor(view: View, options: {
    lineWidth?: number,
    joinStyle?: LineJoinStyle,
    linePattern?: LineStyle | number[],
  } = {}) {
    this.view = view;
    this._lineWidth = (options.lineWidth !== undefined && options.lineWidth !== null) ? options.lineWidth : 1;
    this._joinStyle = options.joinStyle ?? "miter";
    this._linePattern = emptyLinePattern();
    this._linePatternUserValue = "solid";
    if (options.linePattern !== undefined && options.linePattern !== null) {
      this._linePatternUserValue = options.linePattern;
      normaliseLinePattern(options.linePattern, this._linePattern);
    }
  }

  /**
   * Sets line width.
   *
   * Default value is ````1```` pixels.
   */
  set lineWidth(value: number) {
    this._lineWidth = value || 1;
    this.view.needsRender();
  }

  /**
   * Gets the line width.
   *
   * Default value is ````1```` pixels.
   */
  get lineWidth(): number {
    return this._lineWidth;
  }

  /**
   * Sets how polyline joints are drawn — `"miter"` (default) for
   * sharp mitered corners, `"round"` for circular joints formed
   * by the round-cap SDF on each side. Changes take effect on
   * the next frame.
   *
   * See {@link LineJoinStyle} for the full enumeration.
   */
  set joinStyle(value: LineJoinStyle) {
    if (value !== "miter" && value !== "round") {
      return;
    }
    if (this._joinStyle === value) return;
    this._joinStyle = value;
    this.view.needsRender();
  }

  /**
   * Gets the polyline join style. Default is `"miter"`.
   */
  get joinStyle(): LineJoinStyle {
    return this._joinStyle;
  }

  /**
   * Sets the View-level line-pattern (dash / gap) style.
   * Accepts either a named preset from {@link LineStyle} or a
   * custom `[dash, gap, dash, gap, …]` array (up to 8 entries,
   * units of line-width). Setting `"solid"` or an empty array
   * clears the pattern.
   *
   * Per-material `linePattern` on {@link model!scene.SceneMaterial | SceneMaterial} overrides
   * this view-level value for any mesh that carries the
   * material — so engineering drawings can mix conventions
   * (hidden / centre / phantom) inside a single view.
   *
   * Pattern entries are expressed in line-width units — a
   * `"dashed"` line at `lineWidth = 1` and at `lineWidth = 8`
   * have identical proportions, just scaled.
   */
  set linePattern(value: LineStyle | number[]) {
    this._linePatternUserValue = value;
    normaliseLinePattern(value, this._linePattern);
    this.view.needsRender();
  }

  /**
   * Gets the View-level line-pattern style. Returns the
   * originally-set preset name or `number[]` value — *not* the
   * normalised internal form. Default is `"solid"`.
   */
  get linePattern(): LineStyle | number[] {
    return this._linePatternUserValue;
  }

  /** @internal — read by `DrawTechnique._bind`. */
  get _linePatternUniformEntries(): Float32Array {
    return this._linePattern.entries;
  }

  /** @internal — read by `DrawTechnique._bind`. */
  get _linePatternUniformLen(): number {
    return this._linePattern.len;
  }

  /** @internal — read by `DrawTechnique._bind`. */
  get _linePatternUniformPeriod(): number {
    return this._linePattern.period;
  }
}

export {LinesMaterial};
