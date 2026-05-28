/**
 * Per-call options for the v1.0 SVG encoder. All fields optional;
 * caller-supplied values override the defaults in
 * {@link DEFAULT_SVG_EXPORT_OPTIONS}.
 */
export interface SVGExportOptions {

  /**
   * Which world plane the SceneModel is projected onto when
   * flattening to 2D. SVG is inherently 2D so one world axis has to
   * be dropped; the choice depends on which way "up" points in your
   * scene:
   *
   *  - `"XY"` (default) — drop world Z. Right for the typical
   *    floor-plan / drawing case where Z is small or always 0.
   *  - `"XZ"` — drop world Y. Right for Y-up architectural scenes
   *    where you want a plan view from above.
   *  - `"YZ"` — drop world X. Right for elevations / side views.
   *
   * The chosen plane's first axis maps to SVG X, the second maps
   * to SVG Y (with optional {@link flipY}).
   */
  projectionPlane?: "XY" | "XZ" | "YZ";

  /**
   * When `true` (default), the projected Y axis is negated so the
   * drawing reads right-way-up — world +Y appears at the TOP of
   * the SVG, matching how a viewer would expect to see it. Pass
   * `false` to honour SVG's native +Y-down convention without
   * flipping (typical when the source scene is already Y-down).
   */
  flipY?: boolean;

  /**
   * Multiplier from scene units into SVG user-space units. Default
   * `1`. For a millimetre scene meant to print 1:1 to user-units,
   * leave `1`; to render at 1:50 use `0.02`.
   */
  scale?: number;

  /**
   * Padding (in scene units, pre-{@link scale}) around the
   * SceneModel's AABB when computing the SVG `viewBox`. Default
   * `5`. Avoids edge clipping when strokes have visible width.
   */
  padding?: number;

  /**
   * Optional explicit `width` attribute on the root `<svg>`
   * element. When omitted, set to the viewBox width (so the SVG
   * renders at its native scale). Pass a unit string (`"800"`,
   * `"100%"`, `"210mm"`) to control downstream rendering.
   */
  width?: string | number;

  /**
   * Optional explicit `height` attribute. See {@link width}.
   */
  height?: string | number;

  /**
   * Optional background `<rect>` fill. When set, emits a rectangle
   * the size of the viewBox before any geometry, so the output
   * isn't transparent. `[r, g, b]` triplet (channels in `[0, 1]`).
   */
  backgroundColor?: [number, number, number];

  /**
   * Optional override for stroke colour. When set, every emitted
   * line / polygon outline uses this colour regardless of
   * per-mesh / per-material colour.
   */
  strokeColor?: [number, number, number];

  /**
   * Optional override for fill colour. When set, every emitted
   * polygon (triangle) uses this colour regardless of per-mesh
   * colour. Set to `"none"` (the string) to suppress fills
   * entirely and emit triangles as their outlines only.
   */
  fillColor?: [number, number, number] | "none";

  /**
   * Multiplier from `SceneMaterial.lineWidth` (which the SDK
   * treats as pixel units) into SVG `stroke-width` (user-space
   * units). Default `1`. Combined with {@link scale}, gives full
   * control over emitted line weights.
   */
  strokeWidthScale?: number;

  /**
   * Fallback stroke width applied when a mesh / material doesn't
   * declare one. Default `0.5`.
   */
  defaultStrokeWidth?: number;

  /**
   * When `true` (default), wraps the geometry inside a `<g
   * stroke-linecap="round" stroke-linejoin="round">` so all
   * strokes inherit those properties without being repeated on
   * every element.
   */
  roundJoins?: boolean;

  /**
   * When `true`, consecutive line-segment pairs that share an
   * endpoint coalesce into a single `<polyline>`. Smaller output
   * + faster browser parse for drawings with long connected runs;
   * adds a coalescing pass. Default `false` — emits one `<line>`
   * per segment for simpler round-tripping through other tools.
   */
  coalescePolylines?: boolean;
}


/**
 * @private
 */
export const DEFAULT_SVG_EXPORT_OPTIONS: Required<
  Omit<SVGExportOptions, "width" | "height" | "backgroundColor" | "strokeColor" | "fillColor">
> = {
  projectionPlane:     "XY",
  flipY:                true,
  scale:                1,
  padding:              5,
  strokeWidthScale:     1,
  defaultStrokeWidth:   0.5,
  roundJoins:           true,
  coalescePolylines:    false,
};
