/**
 * Per-call options for {@link SVGLoader.load}. All fields optional;
 * caller-supplied values override the defaults in
 * {@link DEFAULT_SVG_LOAD_OPTIONS}.
 */
export interface SVGLoadOptions {

  /**
   * Multiplier from SVG user-space units (1 unit = the value of the
   * `width`/`height`/`viewBox` attributes) into the SceneModel's
   * coordinate system. Default `1` — leaves coordinates in SVG
   * native units. For a drawing meant to sit in a millimetre scene
   * with SVG authored at 1 unit = 1 mm, leave at `1`; for SVG
   * authored at 1 unit = 1 inch, use `25.4`.
   */
  scale?: number;

  /**
   * When `true` (default), Y coordinates are negated so the SVG
   * (which uses +Y-down) renders the right way up in a scene with
   * +Y-up. Pass `false` if the host scene is +Y-down, or if you
   * want the SVG to appear mirrored vertically for some other
   * reason.
   */
  flipY?: boolean;

  /**
   * Optional override for stroke colour. When set to an `[r, g, b]`
   * triplet (channels in `[0, 1]`), every emitted line mesh uses
   * this colour regardless of the SVG's own `stroke` attribute —
   * useful for "ink one colour" presentations.
   *
   * When **omitted** (the default), the loader honours per-element
   * stroke colours from the SVG `stroke` attribute, bucketing
   * emitted segments by colour.
   */
  color?: [number, number, number];

  /**
   * Optional override for fill colour. When set to an `[r, g, b]`
   * triplet, every emitted fill mesh uses this colour regardless
   * of the SVG's `fill` attribute.
   */
  fillColor?: [number, number, number];

  /**
   * Floor on the pixel width of emitted line meshes. Sub-pixel SVG
   * strokes would otherwise vanish under GPU rasterisation. Default
   * `1.0`.
   */
  minLineWidth?: number;

  /**
   * Multiplier from SVG `stroke-width` (user-space units) into the
   * pixel widths consumed by `SceneMaterialParams.lineWidth`.
   * Default `1.0`. SVGs that author hairlines at 0.25 user-units
   * benefit from raising this to ~3 so they meet {@link minLineWidth}
   * naturally rather than being clamped.
   */
  lineWidthScale?: number;

  /**
   * Steps used to tessellate each cubic / quadratic bezier segment
   * into line pieces. Higher = smoother curves, more line indices.
   * `16` is a reasonable default for hand-drawn / CAD-export SVGs;
   * raise to `32` for logos and icon sets dominated by curves.
   * Default `16`.
   */
  bezierSteps?: number;

  /**
   * Steps used to tessellate `<circle>` and `<ellipse>` elements,
   * and the elliptical-arc commands (`A`/`a`) in paths. `36` = 10°
   * facets, indistinguishable from smooth at typical zoom. Default
   * `36`.
   */
  circleSteps?: number;

  /**
   * When `true` (default), `<path>`, `<rect>`, `<circle>`,
   * `<ellipse>`, and `<polygon>` elements with a non-`none` `fill`
   * attribute are tessellated to triangles via earcut and emitted
   * as `TrianglesPrimitive` meshes. Pass `false` to skip fill
   * emission (strokes only).
   */
  renderFills?: boolean;

  /**
   * Z-offset applied to filled triangle meshes so they sit *behind*
   * stroked line meshes from the same drawing. Without this, the
   * filled region's depth-buffer write swallows stroke fragments
   * along the shared boundary (z-fighting). Default `-0.05` (in
   * scene units post-{@link scale}).
   */
  fillZOffset?: number;

  /**
   * How element ids on emitted SceneObjects are formed.
   *
   *  - `"group"` (default) — one SceneObject per top-level `<g>`.
   *    Elements outside any group go into a synthetic SceneObject
   *    named `<sceneModelId>-root`. Best for hand-authored SVGs
   *    where `<g id="walls">` etc. is the user's logical grouping.
   *  - `"element"` — one SceneObject per geometric element. Best
   *    for SVGs exported from CAD where individual entities should
   *    be independently pickable and the file has no useful groups.
   */
  objectIdStrategy?: "group" | "element";

  /**
   * Default stroke colour applied when an element (and all its
   * ancestors) carry no `stroke` attribute. SVG itself defaults to
   * `none` for stroke — but the typical user expectation when
   * importing an SVG into a viewer is "show me the drawing", so
   * the loader defaults to black. Set to `null` to honour SVG's
   * own default (no stroke at all when unspecified).
   */
  defaultStroke?: [number, number, number] | null;

  /**
   * Default fill colour applied when an element (and all its
   * ancestors) carry no `fill` attribute. SVG itself defaults
   * `fill` to black; the loader follows that to match browser
   * rendering. Set to `null` to suppress fills on un-styled
   * elements.
   */
  defaultFill?: [number, number, number] | null;

  /**
   * Optional progress callback. Invoked once per top-level element
   * group after extraction with `(elementIndex, totalElements)`.
   */
  onProgress?: (elementIndex: number, totalElements: number) => void;

  /**
   * When `true` (default), `<text>` elements are rasterised onto an
   * in-memory canvas per label and emitted as textured triangle
   * quads — room labels, dimensions, drawing-title text, etc. Pass
   * `false` to skip text emission entirely.
   *
   * Each `<text>` becomes one quad regardless of how many `<tspan>`
   * children it contains; per-tspan letter-spacing is lost but the
   * overall label reads correctly. Hosts that need per-tspan
   * kerning precision should pre-rasterise externally.
   */
  renderText?: boolean;

  /**
   * Optional override for text fill colour. When set, every emitted
   * text quad rasterises with this colour regardless of the SVG's
   * own `fill` attribute / CSS class.
   */
  textColor?: [number, number, number];

  /**
   * Fallback fill colour when a `<text>` element resolves to no
   * `fill` (no attribute, no class declaration, parent style also
   * null). Default near-black `[0.05, 0.05, 0.05]`.
   */
  textDefaultColor?: [number, number, number];

  /**
   * Fallback CSS font face when a `<text>` element's class doesn't
   * specify `font-family`. Default
   * `"Arial, Helvetica, sans-serif"`.
   */
  textFont?: string;

  /**
   * Fallback font size (SVG user-units) when a `<text>` element
   * carries no `font-size` attribute or class. Default `12`.
   */
  textDefaultSize?: number;

  /**
   * Canvas pixels per SVG user-unit when rasterising text. Higher =
   * sharper text at the cost of texture memory. `4` reads cleanly
   * at typical drawing-zoom; raise to `8` for high-DPI displays,
   * drop to `2` for huge drawings with hundreds of labels. Default
   * `4`.
   */
  textPxPerUnit?: number;
}


/**
 * @private
 */
export const DEFAULT_SVG_LOAD_OPTIONS: Required<
  Omit<SVGLoadOptions, "color" | "fillColor" | "onProgress" | "defaultStroke" | "defaultFill" | "textColor">
> = {
  scale:            1,
  flipY:            true,
  minLineWidth:     1.0,
  lineWidthScale:   1.0,
  bezierSteps:      16,
  circleSteps:      36,
  renderFills:      true,
  fillZOffset:     -0.05,
  objectIdStrategy: "group",
  renderText:       true,
  textDefaultColor: [0.05, 0.05, 0.05],
  textFont:         "Arial, Helvetica, sans-serif",
  textDefaultSize:  12,
  textPxPerUnit:    4,
};
