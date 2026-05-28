/**
 * SVG parser + SceneModel emitter — v1.0.
 *
 * Owns the entire SVG → SceneModel pipeline for the v1.0 schema:
 * validates input, parses the SVG text via the browser's native
 * {@link DOMParser}, walks the resulting tree to bucket geometry
 * per SceneObject, and emits `createGeometry` / `createMaterial` /
 * `createMesh` / `createObject` calls into the target SceneModel.
 * {@link SVGLoader} is a one-line wrapper that delegates here.
 *
 * Pipeline:
 *   1. Validate input (fileData, sceneModel).
 *   2. `new DOMParser().parseFromString(fileData, "image/svg+xml")`
 *      → DOM document; checked for `<parsererror>` then walked
 *      into a private {@link SVGNode} tree (lean shape the
 *      remainder of this module operates on — keeps the walker
 *      DOM-independent and easy to unit-test).
 *   3. Find the `<svg>` root, parse `viewBox` / `width` / `height`
 *      attributes, build the outer CTM that maps viewBox → render
 *      units. Apply optional Y-flip so SVG (+Y down) renders the
 *      right way up in a +Y-up scene.
 *   4. Pre-pass: gather every `<style>` block's class-selector
 *      declarations into a {@link ClassMap} for downstream cascade.
 *   5. Walk the tree depth-first. Each element composes its
 *      `transform` attribute into the CTM, merges its
 *      attribute / class / inline `style="..."` cascade against
 *      the parent style, and (for geometry elements) tessellates
 *      to line segments / triangles into a {@link GeometryCollector}.
 *      `<text>` elements rasterise to a canvas + emit a quad's
 *      world-space corners. `<g>` recurses; the top-level group's
 *      `id` becomes the SceneObject id its descendants land on.
 *   6. Bucket collector entries into one {@link ObjectBucket} per
 *      SceneObject, with sub-buckets per (colour, line-width,
 *      opacity, dash-array) for strokes and per (colour, opacity)
 *      for fills. Text emissions stay per-element.
 *   7. For each bucket: createGeometry + createMaterial +
 *      createMesh + createObject in the target SceneModel; one
 *      mesh per (style-bucket | text-quad), one object per layer
 *      (or element / single, per options).
 *
 * ## Browser requirement
 *
 * Uses the browser's native {@link DOMParser}. Node hosts that need
 * SVG import should install a DOMParser polyfill onto `globalThis`
 * before calling (e.g. `linkedom`, `xmldom`).
 */

import {LinesPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {SceneModel} from "../../../../model/scene";

import type {SVGLoadOptions} from "../../SVGLoadOptions";
import {DEFAULT_SVG_LOAD_OPTIONS} from "../../SVGLoadOptions";
// Earcut is the in-tree fill tessellator the PDF and SVG loaders
// share; kept reused here to keep the SDK's polygon-tessellation
// surface single-rooted.
import {earcut} from "../../../cityjson/versions/v1_0/earcut";


// ─── Public API ───────────────────────────────────────────────────

/** Inputs handed to {@link parse}. */
export interface SVGParseInput {
  /** SVG source as a UTF-8 string. */
  fileData:   string;
  /** Target SceneModel — must be unfinalised. */
  sceneModel: SceneModel;
}


/**
 * Lean SVG-tree shape the walker operates on. Private to this
 * module — {@link domToSVGNode} converts a {@link DOMParser}
 * `Element` tree into this shape before the walk. Kept as a
 * separate type (rather than walking DOM nodes directly) so the
 * walker is DOM-independent and easy to unit-test.
 */
interface SVGNode {
  name:        string;
  attributes?: Record<string, string>;
  children?:   SVGNode[];
  value?:      string;
}

/** Result returned by {@link parse} on success — same shape SVGLoader exposes. */
export interface SVGParseLoadResult {
  sceneModel:     SceneModel;
  viewBox:        { x: number; y: number; width: number; height: number };
  segmentCount:   number;
  triangleCount:  number;
  textCount:      number;
  sceneObjectIds: string[];
}

/**
 * Full SVG → SceneModel pipeline. Validates input, calls the
 * injected adapter, walks the parsed tree, and emits SceneModel
 * entities. Returns an `SDKResult` directly so the wrapping loader
 * can pass it through unchanged.
 */
export async function parse(
  input: SVGParseInput,
  options: SVGLoadOptions = {},
): Promise<SDKResult<SVGParseLoadResult>> {

  if (!input || !input.sceneModel) {
    return err(SDKErrorType.InvalidInput, "[svg.parse] sceneModel is required");
  }
  if (input.sceneModel.destroyed) {
    return err(SDKErrorType.InvalidOperation, "[svg.parse] SceneModel already destroyed");
  }
  if (typeof input.fileData !== "string" || input.fileData.length === 0) {
    return err(SDKErrorType.InvalidInput, "[svg.parse] fileData must be a non-empty SVG string");
  }
  if (typeof DOMParser === "undefined") {
    return err(
      SDKErrorType.InvalidOperation,
      "[svg.parse] DOMParser is not available — running outside a browser? " +
      "Install a DOMParser polyfill onto globalThis (e.g. `linkedom` or `xmldom`) before calling.",
    );
  }

  let root: SVGNode;
  try {
    const doc = new DOMParser().parseFromString(input.fileData, "image/svg+xml");
    const perr = doc.querySelector("parsererror");
    if (perr) throw new Error(perr.textContent?.trim() || "DOMParser reported a parsererror");
    root = domToSVGNode(doc.documentElement);
  } catch (e: any) {
    return err(SDKErrorType.InvalidInput, `[svg.parse] SVG parse failed: ${e?.message ?? e}`);
  }

  if (!root || !root.name) {
    return err(SDKErrorType.InvalidInput, "[svg.parse] No <svg> element found in parsed tree");
  }

  // Tree → buckets. Pure step; reused below + by alternative emitters.
  const {viewBox, buckets, resolvedOpts: opts} = parseSVGTree(root, options);

  // ── Emit buckets into the SceneModel ───────────────────────────
  const sceneObjectIds: string[] = [];
  let segmentCount  = 0;
  let triangleCount = 0;
  let textCount     = 0;

  for (let bIdx = 0; bIdx < buckets.length; bIdx++) {
    const bucket = buckets[bIdx];
    const objectId = `${input.sceneModel.id}-${bucket.id}`;
    const meshIds: string[] = [];

    // Fills first, so the z-offset on filled meshes sits them
    // behind strokes that share their outline boundary (same
    // pattern PDFLoader uses).
    let fillIdx = 0;
    for (const [, fb] of bucket.fillBuckets) {
      if (fb.triangles.length === 0) continue;
      const suffix = `fill-${fillIdx++}`;
      const meshId = `${objectId}-${suffix}-mesh`;
      const geomId = `${objectId}-${suffix}-geom`;
      const matId  = `${objectId}-${suffix}-mat`;

      const tris = fb.triangles;
      const positions = new Float32Array(tris.length * 3 * 3);
      const indices   = new Uint32Array(tris.length * 3);
      for (let t = 0; t < tris.length; t++) {
        const p = tris[t];
        const o = t * 9;
        positions[o    ] = p[0] * opts.scale; positions[o + 1] = p[1] * opts.scale; positions[o + 2] = 0;
        positions[o + 3] = p[2] * opts.scale; positions[o + 4] = p[3] * opts.scale; positions[o + 5] = 0;
        positions[o + 6] = p[4] * opts.scale; positions[o + 7] = p[5] * opts.scale; positions[o + 8] = 0;
        const i0 = t * 3;
        indices[i0    ] = i0;
        indices[i0 + 1] = i0 + 1;
        indices[i0 + 2] = i0 + 2;
      }

      const gRes = input.sceneModel.createGeometry({
        id: geomId, primitive: TrianglesPrimitive,
        positions: positions as any, indices: indices as any,
      });
      if (gRes.ok === false) return err(gRes.type, `[svg.parse] ${objectId} fill: ${gRes.error}`);

      const mRes = input.sceneModel.createMaterial({id: matId, color: fb.color});
      if (mRes.ok === false) return err(mRes.type, `[svg.parse] ${objectId} fill: ${mRes.error}`);

      const meshRes = input.sceneModel.createMesh({
        id: meshId, geometryId: geomId, materialId: matId,
        position: [0, 0, opts.fillZOffset],
        color: fb.color,
        // SceneMesh.opacity carries fill-opacity. Skipping the
        // field when fully opaque avoids forcing those meshes
        // through the renderer's transparent bin unnecessarily.
        ...(fb.opacity < 1 ? {opacity: fb.opacity} : {}),
      });
      if (meshRes.ok === false) return err(meshRes.type, `[svg.parse] ${objectId} fill: ${meshRes.error}`);
      meshIds.push(meshId);
      triangleCount += tris.length;
    }

    // Strokes — bucketed by (colour, width) within this object.
    let strokeIdx = 0;
    for (const [, sb] of bucket.strokeBuckets) {
      if (sb.segments.length === 0) continue;
      const suffix = `lines-${strokeIdx++}`;
      const meshId = `${objectId}-${suffix}-mesh`;
      const geomId = `${objectId}-${suffix}-geom`;
      const matId  = `${objectId}-${suffix}-mat`;

      const segs = sb.segments;
      const positions = new Float32Array(segs.length * 2 * 3);
      const indices   = new Uint32Array(segs.length * 2);
      for (let s = 0; s < segs.length; s++) {
        const p = segs[s];
        const o = s * 6;
        positions[o    ] = p[0] * opts.scale; positions[o + 1] = p[1] * opts.scale; positions[o + 2] = 0;
        positions[o + 3] = p[2] * opts.scale; positions[o + 4] = p[3] * opts.scale; positions[o + 5] = 0;
        const i0 = s * 2;
        indices[i0    ] = i0;
        indices[i0 + 1] = i0 + 1;
      }

      const gRes = input.sceneModel.createGeometry({
        id: geomId, primitive: LinesPrimitive,
        positions: positions as any, indices: indices as any,
      });
      if (gRes.ok === false) return err(gRes.type, `[svg.parse] ${objectId} strokes: ${gRes.error}`);

      const lineWidth = Math.max(opts.minLineWidth, sb.lineWidth * opts.lineWidthScale);
      // SceneMaterial.linePattern expects dash entries in LINE-WIDTH
      // units; SVG stroke-dasharray is in user-space units. Divide
      // to convert. Clamp the array to 8 entries — SceneMaterial's
      // documented cap. Patterns that overflow get truncated rather
      // than wrap-around averaged.
      let linePattern: number[] | undefined;
      if (sb.dasharray && sb.dasharray.length > 0 && sb.lineWidth > 0) {
        const lwUnits = sb.dasharray.map(d => d / sb.lineWidth);
        linePattern = lwUnits.slice(0, 8);
      }
      const mRes = input.sceneModel.createMaterial({
        id: matId, color: sb.color, lineWidth,
        ...(linePattern ? {linePattern} : {}),
      });
      if (mRes.ok === false) return err(mRes.type, `[svg.parse] ${objectId} strokes: ${mRes.error}`);

      const meshRes = input.sceneModel.createMesh({
        id: meshId, geometryId: geomId, materialId: matId, color: sb.color,
        ...(sb.opacity < 1 ? {opacity: sb.opacity} : {}),
      });
      if (meshRes.ok === false) return err(meshRes.type, `[svg.parse] ${objectId} strokes: ${meshRes.error}`);
      meshIds.push(meshId);
      segmentCount += segs.length;
    }

    // Text quads — one mesh per label. Emitted AFTER strokes so
    // they composite on top; no shared atlas — keeps the loader's
    // dependency surface small at the cost of one texture per label.
    let textIdx = 0;
    for (const tx of bucket.texts) {
      const suffix = `text-${textIdx++}`;
      const meshId = `${objectId}-${suffix}-mesh`;
      const geomId = `${objectId}-${suffix}-geom`;
      const matId  = `${objectId}-${suffix}-mat`;
      const texId  = `${objectId}-${suffix}-tex`;

      const ctx2d = tx.canvas.getContext("2d");
      if (!ctx2d) continue;
      const imgData = ctx2d.getImageData(0, 0, tx.canvas.width, tx.canvas.height);

      const tRes = input.sceneModel.createTexture({
        id: texId,
        // `flipY` is currently a no-op in TextureAtlas.ts (it
        // hard-codes UNPACK_FLIP_Y_WEBGL = false regardless of
        // this parameter — see the PDFLoader text-emission comment
        // for the same observation). Canvas row 0 ends up at
        // texture V=0; the UV layout below maps TL→V=0 and BL→V=1
        // accordingly. Kept `flipY: true` here so a future renderer
        // wiring of the flag would invert the texture cleanly —
        // re-test by flipping the V values below.
        flipY: true,
        imageData: {data: imgData.data, width: imgData.width, height: imgData.height},
      });
      if (tRes.ok === false) {
        console.warn(`[svg.parse] ${objectId} text "${tx.text.slice(0, 24)}": ${tRes.error}`);
        continue;
      }

      const matRes = input.sceneModel.createMaterial({
        id: matId,
        colorTextureId: texId,
        // Text is mostly transparent — MASK with a low cutoff keeps
        // anti-aliased edges visible. SceneMaterial's BLEND mode is
        // wired through line-primitive batches in the WebGLRenderer
        // only; triangle quads need MASK or alphaCutoff (see
        // PDFLoader.ts for the same reasoning).
        alphaMode: "MASK",
        alphaCutoff: 0.05,
      });
      if (matRes.ok === false) {
        console.warn(`[svg.parse] ${objectId} text: ${matRes.error}`);
        continue;
      }

      // Quad vertices in world space; UV V is inverted relative to
      // the BL→BR→TR→TL vertex order because `flipY` doesn't reach
      // the texture upload (see the createTexture comment above).
      // Mapping:
      //   BL (world bottom) → UV (0, 1) → samples canvas BOTTOM
      //                                    (text descenders)
      //   BR (world bottom) → UV (1, 1)
      //   TR (world top)    → UV (1, 0) → samples canvas TOP
      //                                    (text ascenders)
      //   TL (world top)    → UV (0, 0)
      // This matches PDFLoader's per-label quad layout.
      const c = tx.corners;
      const positions = new Float32Array([
        c[0][0] * opts.scale, c[0][1] * opts.scale, 0,
        c[1][0] * opts.scale, c[1][1] * opts.scale, 0,
        c[2][0] * opts.scale, c[2][1] * opts.scale, 0,
        c[3][0] * opts.scale, c[3][1] * opts.scale, 0,
      ]);
      const uvs     = new Float32Array([0, 1,  1, 1,  1, 0,  0, 0]);
      const indices = new Uint32Array([0, 1, 2,  0, 2, 3]);

      const gRes = input.sceneModel.createGeometry({
        id: geomId, primitive: TrianglesPrimitive,
        positions: positions as any, uvs: uvs as any, indices: indices as any,
      });
      if (gRes.ok === false) {
        console.warn(`[svg.parse] ${objectId} text: ${gRes.error}`);
        continue;
      }

      const meshRes = input.sceneModel.createMesh({
        id: meshId, geometryId: geomId, materialId: matId,
        ...(tx.opacity < 1 ? {opacity: tx.opacity} : {}),
      });
      if (meshRes.ok === false) {
        console.warn(`[svg.parse] ${objectId} text: ${meshRes.error}`);
        continue;
      }
      meshIds.push(meshId);
      textCount++;
    }

    if (meshIds.length === 0) continue;

    const oRes = input.sceneModel.createObject({id: objectId, meshIds});
    if (oRes.ok === false) return err(oRes.type, `[svg.parse] ${objectId}: ${oRes.error}`);
    sceneObjectIds.push(objectId);

    opts.onProgress?.(bIdx + 1, buckets.length);
  }

  return {
    ok: true,
    value: {
      sceneModel: input.sceneModel,
      viewBox,
      segmentCount,
      triangleCount,
      textCount,
      sceneObjectIds,
    },
  };
}


function err<T>(type: SDKErrorType, message: string): SDKResult<T> {
  return {ok: false, type, error: message};
}


// ─── Lower-level entry: tree → buckets only ───────────────────────

export interface SVGParseResult {
  /** SVG viewBox (user-space units). Becomes the loader's viewBox. */
  viewBox: { x: number; y: number; width: number; height: number };
  /**
   * Bucketed geometry, one {@link ObjectBucket} per SceneObject the
   * loader will create. Walk order = source-document order, modulo
   * the {@link SVGLoadOptions.objectIdStrategy} grouping rule.
   */
  buckets: ObjectBucket[];
  /**
   * Fully-resolved options shape the emit loop needs: `scale`,
   * `fillZOffset`, `minLineWidth`, `lineWidthScale`, `onProgress`
   * are all referenced in the per-bucket emit loop.
   */
  resolvedOpts: ResolvedOpts;
}

/**
 * Parse an SVG node tree into per-SceneObject geometry buckets.
 *
 * The adapter's output root can be either the `<svg>` element
 * itself or a wrapping document node — we walk to find `<svg>`
 * internally. Returns the empty result when no `<svg>` is found.
 */
export function parseSVGTree(root: SVGNode, options: SVGLoadOptions = {}): SVGParseResult {

  const opts: ResolvedOpts = resolveOptions(options);

  const svg = findSvg(root);
  if (!svg) {
    return {viewBox: {x: 0, y: 0, width: 0, height: 0}, buckets: [], resolvedOpts: opts};
  }

  // ── viewBox → user-units outer transform ───────────────────────
  // `viewBox` defines the user-coordinate window; `width`/`height`
  // give the rendered size. We map viewBox into [0, width] × [0,
  // height] so emitted coordinates are in the SVG's "rendered"
  // size — which is the most common downstream expectation.
  const vbAttr = svg.attributes?.viewBox?.trim();
  const widthAttr  = parseLength(svg.attributes?.width);
  const heightAttr = parseLength(svg.attributes?.height);
  let vbX = 0, vbY = 0, vbW: number, vbH: number;
  if (vbAttr) {
    const parts = vbAttr.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(isFinite)) {
      [vbX, vbY, vbW, vbH] = parts;
    } else {
      vbW = widthAttr ?? 0;
      vbH = heightAttr ?? 0;
    }
  } else {
    vbW = widthAttr ?? 0;
    vbH = heightAttr ?? 0;
  }
  const renderW = widthAttr  ?? vbW!;
  const renderH = heightAttr ?? vbH!;
  // When viewBox dimensions are missing we fall back to identity.
  const sx = vbW! > 0 ? renderW / vbW! : 1;
  const sy = vbH! > 0 ? renderH / vbH! : 1;
  // Outer CTM: translate viewBox origin to 0, then scale into render units.
  let rootCtm: Affine = [sx, 0, 0, sy, -vbX * sx, -vbY * sy];

  if (opts.flipY) {
    // SVG y goes top-down; world y typically goes bottom-up. Flip
    // and translate by render height so the drawing sits in
    // [0, w] × [0, h] in world space with the SVG's top-left at
    // (0, h) and bottom-left at the origin.
    const flip: Affine = [1, 0, 0, -1, 0, renderH];
    rootCtm = multiplyAffine(flip, rootCtm);
  }

  // ── Pre-pass: gather CSS class declarations ──────────────────
  const classMap = collectClassStyles(svg);

  // ── Walk + collect ───────────────────────────────────────────
  const collector = new GeometryCollector();
  walkNode(svg, rootCtm, initialStyle(opts), collector, opts, /*depth*/0, /*groupIdHint*/undefined, classMap);

  return {
    viewBox: {x: vbX, y: vbY, width: vbW!, height: vbH!},
    buckets: collector.buckets(),
    resolvedOpts: opts,
  };
}


// ─── Bucket types (cross the parse → emit boundary) ───────────────

/** RGB triple, each channel in `[0, 1]`. */
export type RGB = [number, number, number];

/**
 * Per-SceneObject collection of (style → segments) and (color →
 * triangles). We bucket BEFORE we emit so each unique style
 * combination becomes exactly one mesh + material + geometry, which
 * is what the WebGLRenderer batches efficiently. Text quads aren't
 * bucketed — each label is its own texture so they emit one mesh
 * per `<text>` element.
 */
export interface ObjectBucket {
  id: string;
  strokeBuckets: Map<string, {
    color: RGB; lineWidth: number; opacity: number;
    dasharray: number[] | null;
    segments: [number, number, number, number][];
  }>;
  fillBuckets:   Map<string, {
    color: RGB; opacity: number;
    triangles: [number, number, number, number, number, number][];
  }>;
  texts:         TextEmission[];
}

/**
 * One rasterised text label, captured during walk and emitted as a
 * textured quad after the walk completes. We hold the raw canvas
 * here rather than the ImageData so the texture upload step can
 * pick whichever path (`image` for ImageBitmap, `imageData` for
 * pixel buffer) the SceneModel accepts.
 */
export interface TextEmission {
  text: string;                      // for diagnostic ids only
  canvas: HTMLCanvasElement;         // RGBA, premultiplied by drawing the text on transparent bg
  corners: [number, number][];       // 4 world-space corners, order: BL, BR, TR, TL
  opacity: number;                   // 0..1 — multiplies the text texture's alpha
}

/**
 * Fully-resolved options shape used internally — every field has
 * a concrete value. `colorOverride` / `fillColorOverride` capture
 * the caller's optional global overrides; when set they short-
 * circuit the per-element `stroke` / `fill` attribute in
 * {@link mergeStyle}.
 */
export type ResolvedOpts = Required<typeof DEFAULT_SVG_LOAD_OPTIONS> & {
  defaultStroke: RGB | null;
  defaultFill: RGB | null;
  colorOverride: RGB | null;
  fillColorOverride: RGB | null;
  textColorOverride: RGB | null;
  onProgress: (i: number, total: number) => void;
};

function resolveOptions(options: SVGLoadOptions): ResolvedOpts {
  return {
    ...DEFAULT_SVG_LOAD_OPTIONS,
    defaultStroke: options.defaultStroke === null ? null
                   : options.defaultStroke ?? [0, 0, 0],
    defaultFill:   options.defaultFill   === null ? null
                   : options.defaultFill   ?? null,
    colorOverride:     options.color     ?? null,
    fillColorOverride: options.fillColor ?? null,
    textColorOverride: options.textColor ?? null,
    onProgress:        options.onProgress ?? (() => {}),
    ...options,
  } as ResolvedOpts;
}


// ─── Collector (bucketing) ────────────────────────────────────────

class GeometryCollector {
  private readonly _buckets = new Map<string, ObjectBucket>();

  private _bucket(id: string): ObjectBucket {
    let b = this._buckets.get(id);
    if (!b) {
      b = {id, strokeBuckets: new Map(), fillBuckets: new Map(), texts: []};
      this._buckets.set(id, b);
    }
    return b;
  }

  addStroke(
    objectId: string, color: RGB, lineWidth: number, opacity: number,
    dasharray: number[] | null, segments: [number, number, number, number][],
  ): void {
    if (segments.length === 0) return;
    const b = this._bucket(objectId);
    const key = strokeStyleKey(color, lineWidth, opacity, dasharray);
    let sb = b.strokeBuckets.get(key);
    if (!sb) { sb = {color, lineWidth, opacity, dasharray, segments: []}; b.strokeBuckets.set(key, sb); }
    for (const s of segments) sb.segments.push(s);
  }

  addFill(
    objectId: string, color: RGB, opacity: number,
    triangles: [number, number, number, number, number, number][],
  ): void {
    if (triangles.length === 0) return;
    const b = this._bucket(objectId);
    const key = fillStyleKey(color, opacity);
    let fb = b.fillBuckets.get(key);
    if (!fb) { fb = {color, opacity, triangles: []}; b.fillBuckets.set(key, fb); }
    for (const t of triangles) fb.triangles.push(t);
  }

  addText(objectId: string, t: TextEmission): void {
    this._bucket(objectId).texts.push(t);
  }

  buckets(): ObjectBucket[] {
    return Array.from(this._buckets.values());
  }
}

function colorKey(c: RGB): string { return `${c[0].toFixed(3)},${c[1].toFixed(3)},${c[2].toFixed(3)}`; }
function strokeStyleKey(c: RGB, lw: number, op: number, dash: number[] | null): string {
  const dashKey = dash ? dash.map(d => d.toFixed(3)).join(",") : "";
  return `${colorKey(c)}|${lw.toFixed(3)}|${op.toFixed(3)}|${dashKey}`;
}
function fillStyleKey(c: RGB, op: number): string {
  return `${colorKey(c)}|${op.toFixed(3)}`;
}


// ─── Tree walker ──────────────────────────────────────────────────

interface Style {
  stroke: RGB | null;
  fill: RGB | null;
  strokeWidth: number;
  /** `0..1` — element fill opacity. Multiplicative through parent inheritance. */
  fillOpacity: number;
  /** `0..1` — element stroke opacity. Multiplicative through parent inheritance. */
  strokeOpacity: number;
  /**
   * SVG `stroke-dasharray` parsed into a `[dash, gap, dash, gap, …]`
   * sequence in **user-space units** (the loader converts to
   * line-width units at emit time). `null` = solid line. `"none"`
   * in the source maps to `null`.
   */
  dasharray: number[] | null;
}

function initialStyle(opts: ResolvedOpts): Style {
  return {
    stroke: opts.colorOverride ?? opts.defaultStroke,
    fill:   opts.fillColorOverride ?? opts.defaultFill,
    strokeWidth: 1,
    fillOpacity:   1,
    strokeOpacity: 1,
    dasharray: null,
  };
}

function walkNode(
  node: SVGNode,
  ctm: Affine,
  parentStyle: Style,
  collector: GeometryCollector,
  opts: ResolvedOpts,
  depth: number,
  groupIdHint: string | undefined,
  classMap: ClassMap,
): void {

  const attrs = node.attributes ?? {};

  // Compose CTM with the element's own transform (if any).
  let nodeCtm = ctm;
  if (attrs.transform) {
    const localM = parseTransformAttr(attrs.transform);
    nodeCtm = multiplyAffine(ctm, localM);
  }

  // Inherit + override styles.
  const style = mergeStyle(parentStyle, attrs, opts, classMap);

  // Which SceneObject this element's geometry lands in.
  const objectId = pickObjectId(node, attrs, depth, opts, groupIdHint);

  switch (node.name) {

    case "svg":
    case "defs":      // walk children but emit nothing
    case "symbol":
      for (const c of node.children ?? []) walkNode(c, nodeCtm, style, collector, opts, depth, objectId, classMap);
      return;

    case "g": {
      // Children of a top-level group share the group's object id;
      // pass it down so nested geometry collapses into one object.
      const childGroup = depth === 0 ? objectId : groupIdHint;
      for (const c of node.children ?? []) walkNode(c, nodeCtm, style, collector, opts, depth + 1, childGroup, classMap);
      return;
    }

    case "path":      emitPath(attrs.d ?? "", nodeCtm, style, collector, opts, objectId); break;
    case "rect":      emitRect(attrs, nodeCtm, style, collector, opts, objectId); break;
    case "circle":    emitCircle(attrs, nodeCtm, style, collector, opts, objectId); break;
    case "ellipse":   emitEllipse(attrs, nodeCtm, style, collector, opts, objectId); break;
    case "line":      emitLine(attrs, nodeCtm, style, collector, objectId); break;
    case "polyline":  emitPoints(attrs.points ?? "", false, nodeCtm, style, collector, opts, objectId); break;
    case "polygon":   emitPoints(attrs.points ?? "", true,  nodeCtm, style, collector, opts, objectId); break;
    case "text":      emitText(node, nodeCtm, style, collector, opts, classMap, objectId); break;

    default:
      // Unrecognised element — descend in case it contains
      // geometry, but emit nothing for the element itself.
      for (const c of node.children ?? []) walkNode(c, nodeCtm, style, collector, opts, depth + 1, groupIdHint, classMap);
  }
}

function pickObjectId(
  node: SVGNode,
  attrs: Record<string, string>,
  depth: number,
  opts: ResolvedOpts,
  groupIdHint?: string,
): string {
  if (opts.objectIdStrategy === "element") {
    return attrs.id ? safeId(attrs.id) : `${node.name}-${(globalElementCounter.next++)}`;
  }
  // "group" strategy
  if (groupIdHint) return groupIdHint;
  if (depth === 0 && node.name === "g") return attrs.id ? safeId(attrs.id) : `g-${(globalElementCounter.next++)}`;
  return "root";
}

// A monotonic counter for synthetic SceneObject ids. Module-scoped
// is fine because SceneModel.createObject collisions would only
// happen across simultaneously-running loads sharing one SceneModel,
// which the load itself disallows.
const globalElementCounter = { next: 0 };

function safeId(raw: string): string {
  // Collapse anything that might break SceneObject id constraints —
  // we don't know what they all are, so be conservative.
  return raw.replace(/[^A-Za-z0-9_\-]/g, "_");
}


// ─── Style + colour cascade ───────────────────────────────────────

function mergeStyle(parent: Style, attrs: Record<string, string>, opts: ResolvedOpts, classMap: ClassMap): Style {
  // CSS-class-derived properties are at the bottom of the per-element
  // cascade — overridden by any explicit attribute and by inline
  // `style="..."`. Multiple classes layer in source order
  // (last-declared wins).
  const classDecls: Record<string, string> = {};
  if (attrs.class) {
    for (const cls of attrs.class.split(/\s+/)) {
      const decls = classMap.get(cls);
      if (decls) Object.assign(classDecls, decls);
    }
  }
  // Inline `style="..."` overrides classes and presentation attrs.
  const inlineStyle = parseStyleString(attrs.style);

  // Per SVG spec, presentation attributes (`stroke="..."`) outrank
  // class-derived but are outranked by inline `style="..."`. So:
  //   inline > attribute > class > parent.
  const pick = (prop: string): string | undefined =>
       inlineStyle[prop]
    ?? attrs[prop]
    ?? classDecls[prop];

  const strokeStr        = pick("stroke");
  const fillStr          = pick("fill");
  const strokeWidthStr   = pick("stroke-width");
  const fillOpacityStr   = pick("fill-opacity");
  const strokeOpacityStr = pick("stroke-opacity");
  const opacityStr       = pick("opacity");
  const dasharrayStr     = pick("stroke-dasharray");

  // Caller-supplied colour overrides win over any per-element
  // stroke/fill — same semantics as PDFLoader. A null override means
  // "no override", not "force null".
  const rawStroke = strokeStr === undefined ? parent.stroke
                  : strokeStr === "none"   ? null
                                           : parseColor(strokeStr) ?? parent.stroke;
  const rawFill   = fillStr === undefined   ? parent.fill
                  : fillStr === "none"     ? null
                                           : parseColor(fillStr) ?? parent.fill;

  // Opacity propagation per SVG 1.1 §14.5: each component multiplies.
  // `opacity` is the group shorthand — it multiplies BOTH fill and
  // stroke opacity. So the cascade is:
  //   final.fill-opacity   = parent.fill-opacity   × element.fill-opacity   × element.opacity
  //   final.stroke-opacity = parent.stroke-opacity × element.stroke-opacity × element.opacity
  // Per spec, the parent's own `opacity` is NOT inherited — only
  // its already-baked fill/stroke opacity is. We follow that here
  // so siblings of a partially-transparent `<g opacity="0.5">`
  // don't double-up.
  const fillOpacityOwn   = clamp01(parseFloatOr(fillOpacityStr,   1));
  const strokeOpacityOwn = clamp01(parseFloatOr(strokeOpacityStr, 1));
  const opacityOwn       = clamp01(parseFloatOr(opacityStr,       1));
  const fillOpacity   = parent.fillOpacity   * fillOpacityOwn   * opacityOwn;
  const strokeOpacity = parent.strokeOpacity * strokeOpacityOwn * opacityOwn;

  // stroke-dasharray: `none` clears (back to solid); any other
  // value is parsed into a number list. If omitted, the parent's
  // dash is inherited (SVG spec).
  const dasharray = dasharrayStr === undefined ? parent.dasharray
                  : dasharrayStr === "none"   ? null
                                              : parseDashArray(dasharrayStr) ?? parent.dasharray;

  return {
    stroke:      opts.colorOverride     && rawStroke !== null ? opts.colorOverride     : rawStroke,
    fill:        opts.fillColorOverride && rawFill   !== null ? opts.fillColorOverride : rawFill,
    strokeWidth: strokeWidthStr !== undefined ? (parseFloat(strokeWidthStr) || parent.strokeWidth)
                                              : parent.strokeWidth,
    fillOpacity,
    strokeOpacity,
    dasharray,
  };
}

function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }

function parseFloatOr(s: string | undefined, fallback: number): number {
  if (s === undefined) return fallback;
  const n = parseFloat(s);
  return isFinite(n) ? n : fallback;
}

function parseDashArray(s: string): number[] | null {
  // Comma- or whitespace-separated lengths. Empty list → solid.
  const parts = s.trim().split(/[\s,]+/).filter(Boolean).map(parseFloat);
  if (parts.length === 0 || parts.some(p => !isFinite(p) || p < 0)) return null;
  // SVG spec: if the count is odd, the list is repeated to make it
  // even ("5" → [5, 5], "5 2 1" → [5, 2, 1, 5, 2, 1]). Easier to
  // duplicate up-front than handle in the shader.
  if (parts.length % 2 === 1) return [...parts, ...parts];
  return parts;
}


// ─── Text rasterisation ───────────────────────────────────────────

/**
 * Gather all text descendants of a `<text>` node into one string.
 *
 * Walks children (including `<tspan>`) depth-first, concatenating
 * any `value` payloads. Per-tspan letter-spacing is lost — the
 * whole label renders as one canvas with consistent metrics.
 * Tspans embedded mid-string get joined inline (no separators),
 * matching how the source SVG renders them.
 *
 * The adapter must surface text-node content via `SVGNode.value`
 * either on a synthetic `#text`-named child or on a `<tspan>`
 * element's `value`. The DOMParser recipe in the example does this.
 */
function gatherText(node: SVGNode): string {
  let out = "";
  if (node.value) out += node.value;
  if (node.children) {
    for (const c of node.children) out += gatherText(c);
  }
  return out;
}

function emitText(
  node: SVGNode, ctm: Affine, style: Style, collector: GeometryCollector,
  opts: ResolvedOpts, classMap: ClassMap, objectId: string,
): void {

  if (!opts.renderText) return;
  if (typeof document === "undefined") return;        // not in a browser; text path needs canvas

  const text = gatherText(node).trim();
  if (text.length === 0) return;

  const attrs = node.attributes ?? {};
  // Resolve font-size + font-family from the same cascade
  // mergeStyle uses, but for properties that aren't captured in Style.
  const cssProps = collectCascadedProps(["font-size", "font-family"], attrs, classMap);
  const fontSize = parseFontSize(cssProps["font-size"]) ?? opts.textDefaultSize;
  const fontFamily = cssProps["font-family"] ?? opts.textFont;

  // Fill colour — text uses `fill` (not `stroke`) per SVG convention.
  // `style.fill` is already cascaded; fall back to defaults if null.
  const fillRgb: RGB =
    opts.textColorOverride ??
    style.fill ??
    opts.textDefaultColor;

  // Render to a scratch canvas at `textPxPerUnit × fontSize` pixel height.
  const pxFont = fontSize * opts.textPxPerUnit;
  const fontStr = `${pxFont}px ${fontFamily}`;

  // Measurement uses a throwaway 2D context — cheaper than realising
  // the final canvas just to measure.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return;
  measure.font = fontStr;
  const tm = measure.measureText(text);
  const ascentPx  = tm.actualBoundingBoxAscent  || pxFont * 0.80;
  const descentPx = tm.actualBoundingBoxDescent || pxFont * 0.20;
  const widthPx   = Math.max(1, Math.ceil(tm.width));
  const heightPx  = Math.max(1, Math.ceil(ascentPx + descentPx));

  const canvas = document.createElement("canvas");
  canvas.width  = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.font = fontStr;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgbToCssColor(fillRgb);
  // Baseline sits `ascentPx` from the canvas top. Drawing at x=0
  // anchors the text's left edge to canvas left.
  ctx.fillText(text, 0, ascentPx);

  // Convert canvas px back into SVG user-units so the quad's world
  // size matches the source drawing's intent.
  const wText = widthPx   / opts.textPxPerUnit;
  const wAsc  = ascentPx  / opts.textPxPerUnit;
  const wDsc  = descentPx / opts.textPxPerUnit;

  // SVG-local quad with anchor at (0, 0) = baseline-left.
  // SVG y goes DOWN, so "above baseline" is negative y and "below"
  // is positive. The CTM-applied corner positions account for the
  // root flipY transform automatically.
  // Corner order: BL → BR → TR → TL (matches PDFLoader image quads).
  const localCorners: [number, number][] = [
    [0,     wDsc],   // BL — below baseline
    [wText, wDsc],   // BR
    [wText, -wAsc],  // TR — above baseline
    [0,    -wAsc],   // TL
  ];
  const worldCorners = localCorners.map(([x, y]) => applyAffine(ctm, x, y));

  collector.addText(objectId, {text, canvas, corners: worldCorners, opacity: style.fillOpacity});
}

/**
 * Walk the (inline → attribute → class) cascade for a set of
 * property names. Returns a single map of `{prop: value}`. Used
 * for properties that aren't in the lean {@link Style} shape
 * (font-size, font-family) but still need the cascade resolution.
 */
function collectCascadedProps(
  names: string[], attrs: Record<string, string>, classMap: ClassMap,
): Record<string, string> {
  const out: Record<string, string> = {};
  const classDecls: Record<string, string> = {};
  if (attrs.class) {
    for (const cls of attrs.class.split(/\s+/)) {
      const decls = classMap.get(cls);
      if (decls) Object.assign(classDecls, decls);
    }
  }
  const inlineStyle = parseStyleString(attrs.style);
  for (const n of names) {
    const v = inlineStyle[n] ?? attrs[n] ?? classDecls[n];
    if (v !== undefined) out[n] = v;
  }
  return out;
}

function parseFontSize(s: string | undefined): number | undefined {
  if (!s) return undefined;
  // SVG `font-size` accepts `<number>` or `<length>` (units `px`,
  // `pt`, `em`, …). We honour `px` (1:1) and bare numbers; anything
  // else is dropped to the default and a warning is sensible but
  // omitted here to keep the loader quiet on noisy files.
  const m = /^([\d.]+)\s*(px|pt|em)?$/.exec(s.trim());
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return undefined;
  // pt ≈ 1.333 px at typical SVG scale; em treated as 1.0 (no
  // inherited size context here — that's the cost of not running
  // a real CSS engine).
  if (m[2] === "pt") return n * 1.333;
  return n;
}

function rgbToCssColor(c: RGB): string {
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
}


// ─── CSS class map (pre-pass) ─────────────────────────────────────

/** className → declarations map, e.g. `"cls-3" → {fill: "#fff", stroke: "none"}`. */
type ClassMap = Map<string, Record<string, string>>;

function collectClassStyles(root: SVGNode): ClassMap {
  const map: ClassMap = new Map();
  visit(root);
  return map;

  function visit(n: SVGNode): void {
    if (n.name === "style") {
      const css = readStyleText(n);
      if (css) parseCss(css, map);
    } else if (n.children) {
      for (const c of n.children) visit(c);
    }
  }
}

function readStyleText(node: SVGNode): string {
  // svgson hands text content through `.value`; some adapters (the
  // DOMParser recipe in the module docs) use that convention too.
  // If `value` is missing, scan children for a `#text` / text node
  // and concatenate. Either path produces the raw CSS string.
  if (node.value) return node.value;
  if (!node.children) return "";
  let out = "";
  for (const c of node.children) {
    if (c.value) out += c.value;
  }
  return out;
}

/**
 * Minimal CSS parser: class-selector rules only. Comma-grouped
 * selectors are expanded (`.a, .b { x:1 }` → `.a` and `.b` both
 * carry `{x:1}`). Type / id / descendant / pseudo selectors are
 * silently skipped — they're rare in SVG exports and the geometry
 * still loads fine with attribute defaults.
 */
function parseCss(css: string, map: ClassMap): void {
  // Strip `/* ... */` comments so we don't choke on minified blocks
  // that pack them inline.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Match each `selector-list { declarations }` rule.
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(stripped)) !== null) {
    const selectors = m[1].split(",").map(s => s.trim());
    const decls     = parseStyleString(m[2]);
    if (Object.keys(decls).length === 0) continue;
    for (const sel of selectors) {
      if (sel.startsWith(".") && /^\.[A-Za-z_][\w-]*$/.test(sel)) {
        const cls = sel.slice(1);
        const existing = map.get(cls);
        if (existing) Object.assign(existing, decls);
        else          map.set(cls, {...decls});
      }
      // else: non-class selector — ignore.
    }
  }
}

function parseStyleString(s: string | undefined): Record<string, string> {
  if (!s) return {};
  const out: Record<string, string> = {};
  for (const decl of s.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
  }
  return out;
}


const NAMED_COLORS: Record<string, RGB> = {
  black:   [0, 0, 0],          white: [1, 1, 1],
  red:     [1, 0, 0],          green: [0, 0.5, 0],
  blue:    [0, 0, 1],          yellow: [1, 1, 0],
  cyan:    [0, 1, 1],          magenta: [1, 0, 1],
  grey:    [0.5, 0.5, 0.5],    gray:    [0.5, 0.5, 0.5],
  silver:  [0.75, 0.75, 0.75], navy:    [0, 0, 0.5],
  orange:  [1, 0.647, 0],      purple:  [0.5, 0, 0.5],
  pink:    [1, 0.753, 0.796],  brown:   [0.647, 0.165, 0.165],
  none:    [0, 0, 0],          transparent: [0, 0, 0],
};

function parseColor(str: string): RGB | null {
  const s = str.trim().toLowerCase();
  if (!s || s === "none" || s === "transparent") return null;
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ];
    }
    return null;
  }
  if (s.startsWith("rgb")) {
    const m = s.match(/rgba?\s*\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map(p => p.trim());
    if (parts.length < 3) return null;
    const c = (p: string) => {
      if (p.endsWith("%")) return Math.max(0, Math.min(1, parseFloat(p) / 100));
      return Math.max(0, Math.min(1, parseFloat(p) / 255));
    };
    return [c(parts[0]), c(parts[1]), c(parts[2])];
  }
  return NAMED_COLORS[s] ?? null;
}


// ─── Affine matrix (column-vector style, [a, b, c, d, e, f]) ──────
//
//   x' = a·x + c·y + e
//   y' = b·x + d·y + f
//
// Matches SVG's `transform="matrix(a b c d e f)"` operand order.

type Affine = [number, number, number, number, number, number];

const IDENTITY_AFFINE: Affine = [1, 0, 0, 1, 0, 0];

function multiplyAffine(m1: Affine, m2: Affine): Affine {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function applyAffine(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseTransformAttr(t: string): Affine {
  // Parses a space-or-comma-separated chain of
  //   translate(x[, y]) | scale(sx[, sy]) | rotate(a[, cx, cy])
  //   | matrix(a b c d e f) | skewX(a) | skewY(a)
  // Other operations / malformed pieces are silently skipped.
  let result: Affine = IDENTITY_AFFINE;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const op = m[1];
    const args = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (args.some(a => !isFinite(a))) continue;
    let step: Affine = IDENTITY_AFFINE;
    switch (op) {
      case "matrix":
        if (args.length === 6) step = args as Affine;
        break;
      case "translate":
        step = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
        break;
      case "scale": {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        step = [sx, 0, 0, sy, 0, 0];
        break;
      }
      case "rotate": {
        const rad = (args[0] ?? 0) * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const cx  = args[1] ?? 0, cy = args[2] ?? 0;
        // rotate around (cx, cy) = translate(cx,cy) · rotate · translate(-cx,-cy)
        const rot: Affine = [cos, sin, -sin, cos, 0, 0];
        const t1: Affine  = [1, 0, 0, 1, cx, cy];
        const t2: Affine  = [1, 0, 0, 1, -cx, -cy];
        step = multiplyAffine(t1, multiplyAffine(rot, t2));
        break;
      }
      case "skewX":
      case "skewY":
        // Rare in CAD-export SVGs; left as no-op.
        break;
    }
    result = multiplyAffine(result, step);
  }
  return result;
}


// ─── Element-specific emitters ────────────────────────────────────

function emitLine(attrs: Record<string, string>, ctm: Affine, style: Style, collector: GeometryCollector, objectId: string): void {
  if (!style.stroke || style.strokeOpacity === 0) return;
  const x1 = parseFloat(attrs.x1 ?? "0"), y1 = parseFloat(attrs.y1 ?? "0");
  const x2 = parseFloat(attrs.x2 ?? "0"), y2 = parseFloat(attrs.y2 ?? "0");
  const [ax, ay] = applyAffine(ctm, x1, y1);
  const [bx, by] = applyAffine(ctm, x2, y2);
  collector.addStroke(objectId, style.stroke, style.strokeWidth, style.strokeOpacity, style.dasharray, [[ax, ay, bx, by]]);
}

function emitRect(attrs: Record<string, string>, ctm: Affine, style: Style, collector: GeometryCollector, opts: ResolvedOpts, objectId: string): void {
  const x = parseFloat(attrs.x ?? "0"), y = parseFloat(attrs.y ?? "0");
  const w = parseFloat(attrs.width ?? "0"), h = parseFloat(attrs.height ?? "0");
  if (!(w > 0 && h > 0)) return;
  const corners: [number, number][] = [
    applyAffine(ctm, x,     y),
    applyAffine(ctm, x + w, y),
    applyAffine(ctm, x + w, y + h),
    applyAffine(ctm, x,     y + h),
  ];
  emitClosedShape(corners, style, collector, opts, objectId);
}

function emitCircle(attrs: Record<string, string>, ctm: Affine, style: Style, collector: GeometryCollector, opts: ResolvedOpts, objectId: string): void {
  const cx = parseFloat(attrs.cx ?? "0"), cy = parseFloat(attrs.cy ?? "0");
  const r  = parseFloat(attrs.r  ?? "0");
  if (!(r > 0)) return;
  emitClosedShape(circlePoints(cx, cy, r, r, opts.circleSteps, ctm), style, collector, opts, objectId);
}

function emitEllipse(attrs: Record<string, string>, ctm: Affine, style: Style, collector: GeometryCollector, opts: ResolvedOpts, objectId: string): void {
  const cx = parseFloat(attrs.cx ?? "0"), cy = parseFloat(attrs.cy ?? "0");
  const rx = parseFloat(attrs.rx ?? "0"), ry = parseFloat(attrs.ry ?? "0");
  if (!(rx > 0 && ry > 0)) return;
  emitClosedShape(circlePoints(cx, cy, rx, ry, opts.circleSteps, ctm), style, collector, opts, objectId);
}

function emitPoints(pointsStr: string, closed: boolean, ctm: Affine, style: Style, collector: GeometryCollector, opts: ResolvedOpts, objectId: string): void {
  const nums = pointsStr.split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length < 4 || nums.length % 2 !== 0) return;
  const pts: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) {
    if (!isFinite(nums[i]) || !isFinite(nums[i + 1])) return;
    pts.push(applyAffine(ctm, nums[i], nums[i + 1]));
  }
  if (closed) emitClosedShape(pts, style, collector, opts, objectId);
  else        emitOpenPolyline(pts, style, collector, objectId);
}


function circlePoints(cx: number, cy: number, rx: number, ry: number, steps: number, ctm: Affine): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(applyAffine(ctm, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
  }
  return pts;
}

function emitOpenPolyline(pts: [number, number][], style: Style, collector: GeometryCollector, objectId: string): void {
  if (!style.stroke || style.strokeOpacity === 0 || pts.length < 2) return;
  const segs: [number, number, number, number][] = [];
  for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
  collector.addStroke(objectId, style.stroke, style.strokeWidth, style.strokeOpacity, style.dasharray, segs);
}

function emitClosedShape(pts: [number, number][], style: Style, collector: GeometryCollector, opts: ResolvedOpts, objectId: string): void {
  if (pts.length < 3) return;
  // Stroke (outline) — same segments regardless of fill state.
  if (style.stroke && style.strokeOpacity > 0) {
    const segs: [number, number, number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      segs.push([a[0], a[1], b[0], b[1]]);
    }
    collector.addStroke(objectId, style.stroke, style.strokeWidth, style.strokeOpacity, style.dasharray, segs);
  }
  // Fill — tessellate with earcut.
  if (style.fill && style.fillOpacity > 0 && opts.renderFills) {
    const flat: number[] = [];
    for (const p of pts) { flat.push(p[0], p[1]); }
    const tri = earcut(flat);
    const triangles: [number, number, number, number, number, number][] = [];
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], c = tri[i + 2];
      triangles.push([flat[a * 2], flat[a * 2 + 1], flat[b * 2], flat[b * 2 + 1], flat[c * 2], flat[c * 2 + 1]]);
    }
    collector.addFill(objectId, style.fill, style.fillOpacity, triangles);
  }
}


// ─── Path data parser ─────────────────────────────────────────────

function emitPath(d: string, ctm: Affine, style: Style, collector: GeometryCollector, opts: ResolvedOpts, objectId: string): void {
  if (!d) return;
  const subpaths = parsePathToSubpaths(d, opts.bezierSteps, opts.circleSteps);
  if (subpaths.length === 0) return;

  // Stroke each sub-path as an open or closed polyline depending
  // on whether the command stream ended with Z/z.
  if (style.stroke && style.strokeOpacity > 0) {
    const segs: [number, number, number, number][] = [];
    for (const sp of subpaths) {
      for (let i = 1; i < sp.points.length; i++) {
        const a = sp.points[i - 1], b = sp.points[i];
        const [ax, ay] = applyAffine(ctm, a[0], a[1]);
        const [bx, by] = applyAffine(ctm, b[0], b[1]);
        segs.push([ax, ay, bx, by]);
      }
      if (sp.closed && sp.points.length >= 2) {
        const a = sp.points[sp.points.length - 1], b = sp.points[0];
        const [ax, ay] = applyAffine(ctm, a[0], a[1]);
        const [bx, by] = applyAffine(ctm, b[0], b[1]);
        segs.push([ax, ay, bx, by]);
      }
    }
    collector.addStroke(objectId, style.stroke, style.strokeWidth, style.strokeOpacity, style.dasharray, segs);
  }

  // Fill: tessellate each CLOSED sub-path independently. v1 doesn't
  // implement hole-detection across sub-paths — compound paths
  // render as overlapping fills. Acceptable for AECO drawings;
  // PDFLoader does the same as a starting point.
  if (style.fill && style.fillOpacity > 0 && opts.renderFills) {
    for (const sp of subpaths) {
      if (!sp.closed || sp.points.length < 3) continue;
      const flat: number[] = [];
      for (const p of sp.points) {
        const [x, y] = applyAffine(ctm, p[0], p[1]);
        flat.push(x, y);
      }
      const tri = earcut(flat);
      if (tri.length === 0) continue;
      const triangles: [number, number, number, number, number, number][] = [];
      for (let i = 0; i < tri.length; i += 3) {
        const a = tri[i], b = tri[i + 1], c = tri[i + 2];
        triangles.push([flat[a * 2], flat[a * 2 + 1], flat[b * 2], flat[b * 2 + 1], flat[c * 2], flat[c * 2 + 1]]);
      }
      collector.addFill(objectId, style.fill, style.fillOpacity, triangles);
    }
  }
}

interface SubPath { points: [number, number][]; closed: boolean }

function parsePathToSubpaths(d: string, bezierSteps: number, arcSteps: number): SubPath[] {
  const tokens = tokenisePathData(d);
  const subpaths: SubPath[] = [];

  // Position state.
  let cx = 0, cy = 0;           // current point
  let startX = 0, startY = 0;   // sub-path start (for Z)
  let lastCmd = "";
  let lastCtrlX = 0, lastCtrlY = 0;  // S/T smoothing reflection state
  let cur: SubPath | null = null;
  const open = () => { cur = {points: [], closed: false}; subpaths.push(cur); };
  const push = (x: number, y: number) => { if (!cur) open(); cur!.points.push([x, y]); };

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i++];
    if (typeof t === "string") {
      runCmd(t);
      continue;
    }
    // Implicit-repeat: re-use the previous command's letter with
    // the new numeric arguments. The lastCmd convention follows
    // the SVG spec — after `M x y` followed by more pairs, the
    // implicit command is `L` (not `M`).
    if (!lastCmd) {
      // Orphan number with no prior command — malformed path; skip
      // this token instead of looping forever.
      continue;
    }
    const implicit = lastCmd === "M" ? "L" : lastCmd === "m" ? "l" : lastCmd;
    // Re-inject the number we just consumed so runCmd's `num()`
    // helper can read it.
    i--;
    runCmd(implicit);
  }

  return subpaths;

  function num(): number {
    const v = tokens[i++];
    return typeof v === "number" ? v : NaN;
  }

  function runCmd(cmd: string): void {
    switch (cmd) {

      case "M": case "m": {
        const rel = cmd === "m";
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        // A new M closes whatever was open without explicit Z.
        cur = null;
        open();
        push(x, y);
        cx = x; cy = y; startX = x; startY = y;
        lastCmd = cmd;
        break;
      }

      case "L": case "l": {
        const rel = cmd === "l";
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        push(x, y);
        cx = x; cy = y;
        lastCmd = cmd;
        break;
      }

      case "H": case "h": {
        const rel = cmd === "h";
        let x = num();
        if (rel) x += cx;
        push(x, cy);
        cx = x;
        lastCmd = cmd;
        break;
      }

      case "V": case "v": {
        const rel = cmd === "v";
        let y = num();
        if (rel) y += cy;
        push(cx, y);
        cy = y;
        lastCmd = cmd;
        break;
      }

      case "C": case "c": {
        const rel = cmd === "c";
        let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
        tessellateCubic(cx, cy, x1, y1, x2, y2, x, y, bezierSteps, push);
        lastCtrlX = x2; lastCtrlY = y2;
        cx = x; cy = y;
        lastCmd = cmd;
        break;
      }

      case "S": case "s": {
        const rel = cmd === "s";
        let x2 = num(), y2 = num(), x = num(), y = num();
        if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
        // Reflect previous C/S control point across current point.
        const prev = lastCmd.toLowerCase();
        const x1 = prev === "c" || prev === "s" ? 2 * cx - lastCtrlX : cx;
        const y1 = prev === "c" || prev === "s" ? 2 * cy - lastCtrlY : cy;
        tessellateCubic(cx, cy, x1, y1, x2, y2, x, y, bezierSteps, push);
        lastCtrlX = x2; lastCtrlY = y2;
        cx = x; cy = y;
        lastCmd = cmd;
        break;
      }

      case "Q": case "q": {
        const rel = cmd === "q";
        let x1 = num(), y1 = num(), x = num(), y = num();
        if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
        tessellateQuad(cx, cy, x1, y1, x, y, bezierSteps, push);
        lastCtrlX = x1; lastCtrlY = y1;
        cx = x; cy = y;
        lastCmd = cmd;
        break;
      }

      case "T": case "t": {
        const rel = cmd === "t";
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        const prev = lastCmd.toLowerCase();
        const x1 = prev === "q" || prev === "t" ? 2 * cx - lastCtrlX : cx;
        const y1 = prev === "q" || prev === "t" ? 2 * cy - lastCtrlY : cy;
        tessellateQuad(cx, cy, x1, y1, x, y, bezierSteps, push);
        lastCtrlX = x1; lastCtrlY = y1;
        cx = x; cy = y;
        lastCmd = cmd;
        break;
      }

      case "A": case "a": {
        const rel = cmd === "a";
        const rx = num(), ry = num(), rot = num();
        const largeArc = num() !== 0, sweep = num() !== 0;
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        // Convert SVG arc to cubic-bezier sequence, then tessellate.
        const cubics = arcToCubics(cx, cy, x, y, rx, ry, rot, largeArc, sweep);
        for (const c of cubics) {
          tessellateCubic(cx, cy, c[0], c[1], c[2], c[3], c[4], c[5], Math.max(2, Math.floor(bezierSteps / 2)), push);
          cx = c[4]; cy = c[5];
        }
        cx = x; cy = y;
        lastCmd = cmd;
        break;
      }

      case "Z": case "z": {
        if (cur && cur.points.length > 0) {
          cur.closed = true;
          cx = startX; cy = startY;
        }
        cur = null;
        lastCmd = cmd;
        break;
      }

      default:
        // Unknown command letter — drop one token and continue so
        // we don't lock up on a malformed path.
        break;
    }
  }
}

function tokenisePathData(d: string): (string | number)[] {
  // Splits `d` into an interleaved (letter | number) stream. Numbers
  // can run together without separator (`M0.5.5L1,1` is valid SVG);
  // the regex matches a single number literal or a single command letter.
  const out: (string | number)[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.\d+|\.\d+|\d+)(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) out.push(m[1]);
    else      out.push(parseFloat(m[2]));
  }
  return out;
}

function tessellateCubic(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  steps: number, push: (x: number, y: number) => void,
): void {
  // Caller has already pushed (x0, y0); we add steps points ending at (x3, y3).
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    const x = u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3;
    const y = u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3;
    push(x, y);
  }
}

function tessellateQuad(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  steps: number, push: (x: number, y: number) => void,
): void {
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    const x = u*u*x0 + 2*u*t*x1 + t*t*x2;
    const y = u*u*y0 + 2*u*t*y1 + t*t*y2;
    push(x, y);
  }
}


/**
 * Convert an SVG endpoint-parameterised elliptical arc into a
 * sequence of cubic-bezier segments. Follows the algorithm in SVG
 * 1.1 Implementation Notes §F.6 — converting endpoint to centre
 * parameterisation, then approximating each ≤90° slice with one
 * cubic. Returns `[[x1, y1, x2, y2, x, y], …]`, i.e. the C1/C2/end
 * triples for successive cubics whose start is the previous end (or
 * the arc start for the first).
 */
function arcToCubics(
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, xRot: number,
  largeArc: boolean, sweep: boolean,
): number[][] {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx === 0 || ry === 0) {
    // Degenerate arc → straight line.
    return [[x1, y1, x2, y2, x2, y2]];
  }

  const rad = xRot * Math.PI / 180;
  const cosR = Math.cos(rad), sinR = Math.sin(rad);

  // Compute (x1', y1') — midpoint in rotated frame.
  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
  const x1p =  cosR * dx2 + sinR * dy2;
  const y1p = -sinR * dx2 + cosR * dy2;

  // Ensure radii are large enough.
  let rxSq = rx * rx, rySq = ry * ry;
  const x1pSq = x1p * x1p, y1pSq = y1p * y1p;
  const radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    const sqrt = Math.sqrt(radiiCheck);
    rx *= sqrt; ry *= sqrt;
    rxSq = rx * rx; rySq = ry * ry;
  }

  // Compute (cx', cy').
  const sign = largeArc === sweep ? -1 : 1;
  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  sq = Math.max(0, sq);
  const coef = sign * Math.sqrt(sq);
  const cxp =  coef *  rx * y1p / ry;
  const cyp =  coef * -ry * x1p / rx;

  // (cx, cy) in original frame.
  const cx = cosR * cxp - sinR * cyp + (x1 + x2) / 2;
  const cy = sinR * cxp + cosR * cyp + (y1 + y2) / 2;

  // Angles.
  const vec = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux*ux + uy*uy) * (vx*vx + vy*vy));
    let ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };
  const theta1 = vec(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vec((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0)  delta += 2 * Math.PI;

  // Split into ≤90° slices.
  const segs = Math.ceil(Math.abs(delta) / (Math.PI / 2));
  const slice = delta / segs;
  const cubics: number[][] = [];
  for (let i = 0; i < segs; i++) {
    const a0 = theta1 + i * slice;
    const a1 = a0 + slice;
    const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    // Control-point distance for arc-to-cubic of a unit circle slice.
    const alpha = 4 / 3 * Math.tan((a1 - a0) / 4);

    const p1x = rx * (cos0 - alpha * sin0);
    const p1y = ry * (sin0 + alpha * cos0);
    const p2x = rx * (cos1 + alpha * sin1);
    const p2y = ry * (sin1 - alpha * cos1);
    const p3x = rx * cos1;
    const p3y = ry * sin1;

    // Rotate + translate back into original frame.
    const xform = (px: number, py: number): [number, number] => [
      cosR * px - sinR * py + cx,
      sinR * px + cosR * py + cy,
    ];
    const [c1x, c1y] = xform(p1x, p1y);
    const [c2x, c2y] = xform(p2x, p2y);
    const [ex, ey]   = xform(p3x, p3y);
    cubics.push([c1x, c1y, c2x, c2y, ex, ey]);
  }
  // Snap final endpoint to the requested arc end to avoid float drift.
  if (cubics.length > 0) {
    cubics[cubics.length - 1][4] = x2;
    cubics[cubics.length - 1][5] = y2;
  }
  return cubics;
}


// ─── Misc helpers ─────────────────────────────────────────────────

function findSvg(node: SVGNode): SVGNode | null {
  if (node.name === "svg") return node;
  for (const c of node.children ?? []) {
    const r = findSvg(c);
    if (r) return r;
  }
  return null;
}

function parseLength(s: string | undefined): number | undefined {
  if (!s) return undefined;
  // Strip any CSS unit suffix; the loader doesn't honour units —
  // it treats them all as user-units (1 SVG unit = 1 scene unit
  // pre-{@link SVGLoadOptions.scale}).
  const n = parseFloat(s);
  return isFinite(n) ? n : undefined;
}


/**
 * Walk a DOMParser-produced `Element` tree into the lean
 * {@link SVGNode} shape the rest of the parser operates on.
 *
 * Per-element rules:
 *  - `<text>` and `<tspan>`: child *text nodes* are included as
 *    synthetic `{name: "#text", value}` children so the text
 *    rasteriser's {@link gatherText} can concatenate them. Other
 *    elements take only element children — keeps the tree free
 *    of whitespace noise.
 *  - `<style>`: text content is captured into `value` so the
 *    CSS-class pre-pass can parse it. Browsers fold all child
 *    text nodes of a `<style>` into `textContent`, so we don't
 *    have to walk childNodes here.
 *  - Every element: every attribute on the source element is
 *    copied into the `attributes` map verbatim.
 */
function domToSVGNode(el: Element): SVGNode {
  const attributes: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    attributes[a.name] = a.value;
  }
  const tag = el.tagName.toLowerCase();
  const includeText = (tag === "text" || tag === "tspan");
  const children: SVGNode[] = [];
  if (includeText) {
    // Walk full childNodes so #text content survives.
    const cn = el.childNodes;
    for (let i = 0; i < cn.length; i++) {
      const c = cn[i];
      if (c.nodeType === 1 /* ELEMENT_NODE */) {
        children.push(domToSVGNode(c as Element));
      } else if (c.nodeType === 3 /* TEXT_NODE */) {
        children.push({name: "#text", value: c.nodeValue || ""});
      }
    }
  } else {
    const ec = el.children;
    for (let i = 0; i < ec.length; i++) {
      children.push(domToSVGNode(ec[i]));
    }
  }
  const node: SVGNode = {name: tag, attributes, children};
  if (tag === "style") node.value = el.textContent || "";
  return node;
}
