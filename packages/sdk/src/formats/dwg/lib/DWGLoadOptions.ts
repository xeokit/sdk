/**
 * Per-call options for {@link DWGLoader.load} (and
 * {@link DXFLoader.load} — DXF reuses this shape verbatim, exported
 * from `formats/dxf` as `DXFLoadOptions`). All fields optional;
 * caller-supplied values override the defaults in
 * {@link DEFAULT_DWG_LOAD_OPTIONS}.
 *
 * @private
 */
export interface DWGLoadOptions {

  /**
   * Multiplier from DWG drawing units (whatever the source AutoCAD
   * file declares — feet, mm, inches, etc.) into the SceneModel's
   * coordinate system. Default `1`.
   *
   * For a DWG authored in millimetres meant to sit in a metres
   * scene, use `0.001`. For a feet drawing in metres, use
   * `0.3048`. The loader does NOT consult `DWGHeader.units` — the
   * caller knows the conversion intent better than a static table.
   */
  scale?: number;

  /**
   * Optional override for stroke colour. When set to an `[r, g, b]`
   * triplet (channels in `[0, 1]`), every emitted line mesh uses
   * this colour regardless of per-entity / per-layer colour from
   * the DWG. Useful for "ink one colour" presentations.
   *
   * When **omitted** (the default), the loader honours per-entity
   * colour (resolving `ByLayer` / `ByBlock` against the layer
   * palette), bucketing emitted segments so a multi-colour drawing
   * keeps its CAD-coded ink.
   */
  color?: [number, number, number];

  /**
   * Floor on the pixel width of emitted line meshes. Sub-pixel
   * widths get clamped up so hairlines stay visible after GPU
   * rasterisation. Default `1.0`.
   */
  minLineWidth?: number;

  /**
   * Multiplier from DWG line widths (drawing units) into the pixel
   * widths consumed by `SceneMaterialParams.lineWidth`. DWG widths
   * are typically expressed in millimetres (e.g. `0.25` for a thin
   * line) — `4.0` lands those in a sensible pixel range. Default
   * `4.0`.
   */
  lineWidthScale?: number;

  /**
   * Fallback stroke width (drawing units) when an entity carries
   * no `lineWidth` AND its layer carries none. Default `0.25` —
   * matches AutoCAD's `Default` line-weight convention.
   */
  defaultLineWidth?: number;

  /**
   * Steps used to tessellate `CIRCLE` / `ARC` / `ELLIPSE` entities
   * per full revolution. `64` ≈ 5.6° facets, smooth at typical
   * AECO drawing zoom. Raise to `128` for tight curves on detail
   * drawings; drop to `32` for huge floor plans. Default `64`.
   */
  circleSteps?: number;

  /**
   * How element ids on emitted SceneObjects are formed.
   *
   *  - `"layer"` (default) — one SceneObject per DWG layer. Best
   *    for typical drawing workflows where layers represent the
   *    discipline / element classification.
   *  - `"entity"` — one SceneObject per entity. Best when the
   *    drawing has no useful layer structure and each entity
   *    should be independently pickable.
   *  - `"single"` — all entities collapse into one SceneObject.
   *    Best when the drawing is a backdrop and per-element pick
   *    isn't needed.
   */
  objectIdStrategy?: "layer" | "entity" | "single";

  /**
   * Max INSERT recursion depth. Some DWG files contain circular
   * block references (BLOCK_A inserts BLOCK_B which inserts
   * BLOCK_A); the limit catches them without searching for cycles
   * explicitly. Default `8` — generous for legitimate nesting.
   */
  maxInsertDepth?: number;

  /**
   * When `true` (default), `TEXT` and `MTEXT` entities are
   * rasterised to canvases and emitted as textured triangle quads.
   * Pass `false` to skip text emission entirely.
   *
   * Server-side workflows that don't ship a `<canvas>` (Node) and
   * don't pre-rasterise externally should set this to `false`.
   */
  renderText?: boolean;

  /**
   * Optional override for text fill colour. When set, every
   * emitted text quad rasterises with this colour regardless of
   * the entity's own colour.
   */
  textColor?: [number, number, number];

  /**
   * Fallback fill colour when a text entity resolves to no colour
   * via layer / entity / palette. Default near-black
   * `[0.05, 0.05, 0.05]`.
   */
  textDefaultColor?: [number, number, number];

  /**
   * Fallback CSS font face. AutoCAD `STYLE` definitions don't map
   * cleanly to web fonts, so we ship one default and let callers
   * override per-load. Default `"Arial, Helvetica, sans-serif"`.
   */
  textFont?: string;

  /**
   * Canvas pixels per drawing-unit when rasterising text. Higher
   * = sharper at the cost of texture memory. Default `4`.
   */
  textPxPerUnit?: number;

  /**
   * Optional progress callback. Invoked once per top-level entity
   * with `(index, total)`. Block-expanded entities don't trigger
   * progress events (they're walked recursively within a parent
   * INSERT's tick).
   */
  onProgress?: (entityIndex: number, totalEntities: number) => void;

  /**
   * Optional override for the libredwg-web ESM URL the loader
   * dynamically imports. Defaults to the jsdelivr-hosted build of
   * `@mlightcad/libredwg-web@0.7.1`. Override to self-host (CSP /
   * offline / specific version pin) or to point at a different
   * libredwg distribution.
   *
   * @default `https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.1/+esm`
   */
  libredwgEsmUrl?: string;

  /**
   * Directory containing the libredwg-web `.wasm` blob (and its
   * companion `.js` glue). Passed through to libredwg's
   * `LibreDwg.create(filepath)` as the WASM-locate base URL.
   * Defaults to the same jsdelivr origin as the ESM module. Pair
   * with {@link libredwgEsmUrl} when self-hosting.
   *
   * @default `https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.1/wasm`
   */
  libredwgWasmDir?: string;

  /**
   * Pre-initialised libredwg-web instance — when supplied, the
   * loader skips its built-in CDN fetch + WASM init and uses this
   * object directly. Useful in Node hosts (where dynamic CDN
   * import doesn't work without polyfills) or apps that already
   * host libredwg themselves.
   *
   * Shape: `{lib: LibreDwg, fileType: typeof Dwg_File_Type}`.
   * Anything matching that shape is fine; the loader only reads
   * `lib.dwg_read_data`, `lib.convert`, `lib.dwg_free` and
   * `fileType.DWG`.
   */
  libredwg?: {lib: any; fileType: any};
}


/**
 * @private
 */
export const DEFAULT_DWG_LOAD_OPTIONS: Required<
  Omit<DWGLoadOptions, "color" | "textColor" | "onProgress" | "libredwg">
> = {
  scale:             1,
  minLineWidth:      1.0,
  lineWidthScale:    4.0,
  defaultLineWidth:  0.25,
  circleSteps:       64,
  objectIdStrategy:  "layer",
  maxInsertDepth:    8,
  renderText:        true,
  textDefaultColor:  [0.05, 0.05, 0.05],
  textFont:          "Arial, Helvetica, sans-serif",
  textPxPerUnit:     4,
  libredwgEsmUrl:    "https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.1/+esm",
  libredwgWasmDir:   "https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.1/wasm",
};
