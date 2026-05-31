/**
 * Per-call options for {@link PDFLoader.load}. All fields optional;
 * caller-supplied values override the defaults in
 * {@link DEFAULT_PDF_LOAD_OPTIONS}.
 */
export interface PDFLoadOptions {

  /**
   * Multiplier from PDF user-space units (1 unit = 1/72 inch) into
   * the SceneModel's coordinate system. Default `1` — leaves
   * coordinates in PDF native units. For a drawing meant to sit in
   * a millimetre scene, multiply by `25.4 / 72 ≈ 0.353`.
   */
  scale?: number;

  /**
   * One-based page indices to import. Default: every page in the
   * document. Out-of-range entries are silently skipped.
   */
  pages?: number[];

  /**
   * Strategy for laying out a multi-page PDF in scene space. All
   * layouts use {@link pageGap} as the inter-page spacing along
   * whichever axis the strategy advances:
   *
   *   - `"row"` (default) — pages along +X, bottom-aligned at y=0.
   *   - `"column"` — pages along +Y, left-aligned at x=0.
   *   - `"grid"` — `{@link gridColumns}`-wide grid; cell size derived
   *     from the *first page's* width/height (works cleanly for
   *     uniform sheet sets, less so for mixed sizes).
   *   - `"stack"` — pages at the same X/Y, separated by `pageGap`
   *     along +Z. Useful for sheet sets where only the top page
   *     should be visible by default.
   */
  layout?: "row" | "column" | "grid" | "stack";

  /**
   * Pages per row when {@link layout} is `"grid"`. Default `4`. Ignored
   * for other layouts.
   */
  gridColumns?: number;

  /**
   * Inter-page spacing (in scene units, *post-{@link scale}*) along
   * whichever axis the active {@link layout} advances. Default `50`.
   */
  pageGap?: number;

  /**
   * Optional override for stroke colour. When set to an `[r, g, b]`
   * triplet (channels in `[0, 1]`), every emitted line mesh uses
   * this colour regardless of the PDF's own `setStrokeRGBColor` /
   * `setStrokeGray` ops — useful for "ink one colour" presentations.
   *
   * When **omitted** (the default), the loader honours per-stroke
   * colours from the PDF graphics state, bucketing emitted segments
   * by colour so a multicolour CAD drawing renders with its original
   * discipline-coded ink.
   */
  color?: [number, number, number];

  /**
   * Multiplier from PDF user-space line widths (points) into the
   * pixel widths consumed by {@link SceneMaterialParams.lineWidth}.
   * Default `1.5` — a typical AECO ~0.25-point hairline lands at
   * ~0.4 pixels, then clamped up to {@link minLineWidth}.
   */
  lineWidthScale?: number;

  /**
   * Floor on the pixel width of emitted line meshes. Sub-pixel PDF
   * strokes (very common in CAD output) would otherwise vanish under
   * GPU rasterisation. Default `1.0`.
   */
  minLineWidth?: number;

  /**
   * Steps used to tessellate each cubic-bezier segment into line
   * pieces. Higher = smoother curves, more line indices. `12` is a
   * reasonable trade-off for AECO plan sheets; raise to `24` for
   * pages dominated by curved architectural geometry, lower to `6`
   * for very large floor plans where curves are mostly straight.
   * Default `12`.
   */
  bezierSteps?: number;

  /**
   * Optional progress callback. Invoked once per page after extraction
   * with `(pageIndex, totalPages)`. Useful for surfacing progress in
   * UI dialogs (the `LoaderProgressDialog` understands this shape).
   */
  onPageProgress?: (pageIndex: number, totalPages: number) => void;

  /**
   * When `true` (default), raster `paintImageXObject` /
   * `paintJpegXObject` ops emit textured triangle quads sized by the
   * image's current CTM — so scanned PDFs and Revit/AutoCAD raster
   * exports still produce visible geometry instead of an empty
   * SceneModel. Pass `false` to skip image emission (vector strokes
   * only).
   */
  renderImages?: boolean;

  /**
   * When `true` (default), `fill` / `eoFill` / `*FillStroke` ops
   * tessellate each closed sub-path into triangles (via earcut) and
   * emit `TrianglesPrimitive` meshes — so room poché, hatch fills,
   * and filled symbols actually render. Pass `false` to skip fill
   * emission (strokes only).
   */
  renderFills?: boolean;

  /**
   * Optional override for fill colour. When set to an `[r, g, b]`
   * triplet (channels in `[0, 1]`), every emitted fill mesh uses
   * this colour regardless of the PDF's `setFillRGBColor` /
   * `setFillGray` ops.
   *
   * When **omitted** (the default), the loader honours per-region
   * fill colours from the PDF graphics state, bucketing emitted
   * triangles by colour.
   */
  fillColor?: [number, number, number];

  /**
   * Z-offset applied to filled triangle meshes so they sit *behind*
   * stroked line meshes in the same drawing. Without this, the
   * filled region's depth-buffer write swallows stroke fragments
   * along the shared boundary (z-fighting) and walls drop out of
   * the rendered plan. Negative values push fills further back.
   * Default `-0.05` (in scene units post-{@link scale}).
   */
  fillZOffset?: number;

  /**
   * How to tessellate fills whose path contains more than one
   * sub-path. PDF allows a single `fill` / `eoFill` op to paint a
   * compound region — typically an outer outline plus one or more
   * inner outlines that **carve holes** out of it (a room with a
   * column cutout, wall poché with a door opening, the inside of a
   * donut symbol).
   *
   * Strategies:
   *
   *  - `"holes"` (default) — resolve sub-path nesting by
   *    point-in-polygon containment: each top-level sub-path becomes
   *    one outer ring, its directly-contained sub-paths become
   *    holes, sub-paths nested deeper become their own outer rings
   *    (the "island in a hole" case). Each outer-plus-holes group
   *    is tessellated in one earcut call via its `holeIndices`
   *    parameter. Correct for the common AECO case (room outlines
   *    with cutouts) AND for compound glyph paths (logos converted
   *    to outlines, where letter outlines + counters arrive in one
   *    fill op and may be interleaved).
   *  - `"separate"` — tessellate each sub-path independently as a
   *    standalone filled polygon. Correct for fills that paint
   *    multiple disjoint shapes in one op, but renders shapes that
   *    have *actual holes* as solid blobs (the inner sub-path is
   *    filled on top of the outer, producing big black patches).
   *  - `"skip"` — drop multi-subpath fills entirely. The safest
   *    fallback when neither heuristic suits the source PDF; you
   *    lose those fills but no spurious geometry is emitted.
   *
   * Has no effect on fills whose path has exactly one sub-path
   * (those tessellate the same way under every strategy).
   */
  multiSubpathFills?: "holes" | "separate" | "skip";

  /**
   * When `true` (default), positioned text from
   * {@link PDFPageLike.getTextContent} is rasterised to canvases and
   * emitted as textured triangle quads — room labels, dimensions,
   * sheet titles, etc. Pass `false` to skip text emission entirely
   * (useful when caller only wants the geometric drawing).
   */
  renderText?: boolean;

  /**
   * Optional override for text colour. When set, every emitted text
   * quad rasterises with this colour regardless of the PDF's text
   * fill state. Default `undefined` — text uses the
   * {@link textDefaultColor} fallback (we don't currently parse the
   * PDF graphics-state fill colour for text; tracked as future work).
   */
  textColor?: [number, number, number];

  /**
   * CSS font face used when rasterising text. pdf.js's `fontName`
   * field on `PDFTextItem` is an internal id (e.g. `g_d0_f1`) not a
   * real font name, so the loader can't reliably map per-item fonts
   * to system fonts. A single sensible default (the typical CAD
   * sans-serif look) is applied to every text item. Default
   * `"Arial, Helvetica, sans-serif"`.
   */
  textFont?: string;

  /**
   * Fallback colour when {@link textColor} is unset. Default near-black
   * `[0.05, 0.05, 0.05]`.
   */
  textDefaultColor?: [number, number, number];

  /**
   * Canvas pixels per PDF user-space unit when rasterising text. Higher
   * = sharper text at the cost of texture-atlas memory + per-item GPU
   * uploads. `4` reads cleanly at typical AECO sheet zoom; raise to
   * `8` for high-DPI displays, drop to `2` for huge sheets with
   * hundreds of labels. Default `4`.
   */
  textPxPerUnit?: number;

  /**
   * Optional override for the pdfjs-dist ESM URL the loader
   * dynamically imports. Defaults to the jsdelivr-hosted build of
   * `pdfjs-dist@4.0.379`. Override to self-host (CSP / offline /
   * specific version pin) or to point at a different distribution.
   *
   * @default `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs`
   */
  pdfjsEsmUrl?: string;

  /**
   * URL of the pdf.js worker script (`pdf.worker.min.mjs`). Pdf.js
   * spins up a Web Worker for parsing; the worker URL must match
   * the main module's version exactly (mismatched versions are
   * pdf.js's #1 runtime failure mode). The default points at the
   * same jsdelivr origin / version stem as {@link pdfjsEsmUrl}; if
   * you override either, override BOTH to keep them aligned.
   *
   * @default `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`
   */
  pdfjsWorkerSrc?: string;

  /**
   * Pre-initialised pdf.js namespace — when supplied, the loader
   * skips its built-in CDN fetch + worker wiring and uses this
   * object directly. Useful in Node hosts (where dynamic CDN
   * import doesn't work without polyfills) or apps that already
   * host pdf.js themselves.
   *
   * Must expose `getDocument` + `OPS`. Setting
   * `GlobalWorkerOptions.workerSrc` on the supplied namespace is
   * the caller's responsibility when injecting.
   */
  pdfjs?: any;

  /**
   * Encloses each emitted page in an inside-out thin 3D box so
   * the drawing has a pickable surface behind it. Same chrome
   * pattern the drawings module's `buildDrawingPanel` uses for
   * 2D drawings: inside-out winding means the camera-facing wall
   * is back-face-culled and the opposite wall shows through as a
   * translucent backdrop, with the page geometry reading crisply
   * against it.
   *
   * Useful when the host needs clicks in empty regions of the
   * page to resolve to a pick (the box's SceneObject, with id
   * `${pageObjectId}__box`) instead of missing into the
   * background.
   *
   *  - `false` (default) — no box.
   *  - `true` — emits a box with the defaults below.
   *  - object — overrides individual fields:
   *    - `color` (default `[0.96, 0.97, 0.99]` — matches the
   *       drawings-panel default off-white)
   *    - `opacity` (default `0.55`)
   *    - `depth` — box half-thickness along Z, in scene units
   *       post-{@link scale}. The box spans `z = ±depth` around
   *       the page plane. Default `0.05`.
   *    - `margin` — extra padding around the page extent in
   *       scene units post-{@link scale}. Default `0`.
   *    - `clippable` — whether section planes affect the box.
   *       Default `false` (matches the drawings-panel chrome).
   */
  backingBox?: boolean | {
    color?:     [number, number, number];
    opacity?:   number;
    depth?:     number;
    margin?:    number;
    clippable?: boolean;
  };
}


/**
 * @private
 */
export const DEFAULT_PDF_LOAD_OPTIONS: Required<Omit<PDFLoadOptions, "pages" | "onPageProgress" | "color" | "fillColor" | "textColor" | "pdfjs">> = {
  scale:            1,
  layout:           "row",
  gridColumns:      4,
  pageGap:          50,
  lineWidthScale:   1.5,
  minLineWidth:     1.0,
  bezierSteps:      12,
  renderImages:     true,
  renderFills:      true,
  fillZOffset:     -0.05,
  multiSubpathFills: "holes",
  renderText:       true,
  textFont:         "Arial, Helvetica, sans-serif",
  textDefaultColor: [0.05, 0.05, 0.05],
  textPxPerUnit:    4,
  pdfjsEsmUrl:    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs",
  pdfjsWorkerSrc: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs",
  backingBox:     false,
};
