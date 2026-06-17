/**
 * PDF parser + SceneModel emitter — v1.0.
 *
 * Owns the entire PDF → SceneModel pipeline for v1.0: dynamically
 * imports `pdfjs-dist` from a CDN (URL configured on the loader via
 * {@link PDFLoaderParams.pdfjsEsmUrl} / `pdfjsWorkerSrc`; a
 * pre-initialised pdf.js namespace can be injected via
 * {@link PDFLoaderParams.pdfjs} to skip the CDN), walks each page's
 * operator list + text content, and emits SceneModel entities.
 * {@link PDFLoader} is a one-line façade that delegates here.
 *
 * What the loader emits:
 *  - **Vector strokes** — every `stroke` / `closeStroke` /
 *    `fillStroke` / `closeFillStroke` op flushes the accumulated
 *    sub-paths as polylines, bucketed by `(colour, lineWidth, dash)`
 *    so discipline-coded ink + line-weight hierarchy survives.
 *  - **Filled regions** — `fill` / `eoFill` / `*FillStroke` ops
 *    tessellate each path's sub-paths into triangles via earcut.
 *    Multi-sub-path fills resolve nesting via point-in-polygon
 *    containment (room outlines with cutouts, donut symbols,
 *    glyph outlines + counters); see
 *    {@link PDFLoadOptions.multiSubpathFills} for the strategy
 *    switch (`"holes"` default, `"separate"`, `"skip"`).
 *  - **Cubic / quadratic beziers** — tessellated to line segments
 *    with {@link PDFLoadOptions.bezierSteps} pieces per curve.
 *  - **`rectangle` op** — emitted as a closed 4-edge sub-path.
 *  - **Image XObjects** — `paintImageXObject` / `paintJpegXObject` /
 *    `paintImageMaskXObject` / `paintInlineImageXObject` emit
 *    textured triangle quads positioned by the image's CTM.
 *  - **Positioned text** — read via `page.getTextContent` and
 *    emitted as textured quads (rasterised through an OffscreenCanvas
 *    text atlas). Text item transforms include rotation / scale.
 *  - **CTM stack** — `q` / `Q` save/restore a deep copy of the full
 *    graphics state (CTM + colours + lineWidth + dashArray).
 *    `cm` premultiplies: `CTM' = M_cm × CTM_old` per PDF spec.
 *
 * Per-style bucketing produces one SceneGeometry + SceneMaterial +
 * SceneMesh per `(colour, lineWidth, dash)` tuple for strokes, per
 * colour for fills, per image for image quads, and one atlas-shared
 * mesh per page for text.
 *
 * Each page becomes one SceneObject. Multi-page documents create one
 * SceneObject per page, ids prefixed with the SceneModel id, laid
 * out by {@link PDFLoadOptions.layout} (`"row"`, `"column"`,
 * `"grid"`, `"stack"`).
 *
 * Not yet supported (PDF features the loader treats as no-ops):
 *  - **Clipping paths** (`W`, `W*`) — ignored. Content drawn under
 *    a clip is emitted in full; if a PDF relies on clipping to mask
 *    out parts of a path or image, the masked region will leak.
 *  - **Patterns + shadings** (`sh`, tiling / shading fills).
 *  - **Per-text fill colour** — text rasterises with the
 *    {@link PDFLoadOptions.textColor} override or
 *    {@link PDFLoadOptions.textDefaultColor} fallback; pdf.js's
 *    `getTextContent` doesn't expose per-item fill colour.
 *  - **Page rotation / crop box** — `page.getViewport({scale: 1})`
 *    accounts for rotation in the *viewport size* it reports, but
 *    the loader doesn't recompute coordinates for non-identity
 *    rotation. PDFs with non-zero `/Rotate` may land in an unexpected
 *    frame; the workaround is to apply a transform to the SceneModel.
 *  - **Soft masks, transparency groups, blend modes** — ignored.
 */
import {LinesPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {type SDKResult, SDKErrorType} from "../../../../base/core";
import type {SceneModel} from "../../../../model/scene";
// Reuse the in-tree earcut port (used by section caps + drawing
// fills) rather than re-vendoring; PDF fill tessellation is a small
// fraction of those callers' loads.
import {earcut} from "../../../cityjson/versions/v1_0/earcut";

import {
  DEFAULT_PDF_LOAD_OPTIONS,
  DEFAULT_PDFJS_ESM_URL,
  DEFAULT_PDFJS_WORKER_SRC,
  type PDFLoadOptions,
  type PDFLoaderParams,
} from "../../PDFLoadOptions";


// ─── pdf.js shape types ───────────────────────────────────────────
//
// Subset of the `pdfjs-dist` namespace consumed below. The SDK
// fetches pdf.js itself (CDN-by-default, overridable via
// `PDFLoaderParams.pdfjsEsmUrl`); these types describe what we expect
// to receive back from `pdfjs.getDocument(...).promise` and the
// resulting page handles. External callers don't need to know about
// them.

/**
 * Open PDF document. Page indices are 1-based throughout pdf.js;
 * the loader follows that convention.
 *
 * @internal
 */
interface PDFDocumentLike {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PDFPageLike>;
  /**
   * Release pdf.js's internal page caches + the worker entry for
   * this document. The loader calls this when extraction finishes
   * (success or error) so demo callers don't have to manage it.
   */
  destroy(): Promise<void>;
}

/**
 * @internal
 */
interface PDFPageLike {
  /**
   * Native page dimensions before any scale is applied. The loader
   * calls `getViewport({scale: 1})` to read the page's user-space
   * width / height — these become the bounds the wireframe
   * coordinates fall inside.
   */
  getViewport(params: {scale: number}): PDFViewportLike;

  /**
   * Operator-list dump of the page's content stream. The loader
   * walks `fnArray`/`argsArray` in lockstep to rebuild path geometry.
   */
  getOperatorList(): Promise<PDFOperatorListLike>;

  /**
   * Positioned text strings on the page. pdf.js handles all the font
   * decoding and CTM composition — items come back in user space with
   * baseline-left placement.
   */
  getTextContent(params?: PDFGetTextContentParams): Promise<PDFTextContentLike>;

  /**
   * Per-page object store — pdf.js's resolved image XObjects, named
   * graphics-state objects, etc. The loader reads it after
   * {@link getOperatorList} resolves so any image referenced from
   * `paintImageXObject` / `paintJpegXObject` ops can be retrieved
   * by its object id. Synchronous `get` is acceptable because
   * `getOperatorList` resolves only once the catalogue has been
   * filled.
   */
  readonly objs: PDFObjectsLike;
}

/**
 * Subset of pdf.js's `PDFObjects` consumed by the loader.
 *
 * @internal
 */
interface PDFObjectsLike {
  /**
   * Returns the resolved object for `objId`, or `undefined` if the
   * id is unknown. In pdf.js the return shape varies by object kind;
   * for raster images the loader recognises two forms:
   *  - `{data, width, height, kind}` — raw pixel buffer (RGB_24BPP /
   *    RGBA_32BPP / GRAYSCALE_1BPP, per pdf.js's `ImageKind` enum)
   *  - `{bitmap: ImageBitmap}` — pre-decoded ImageBitmap (newer pdf.js
   *    versions deliver JPEGs this way)
   */
  get(objId: string): PDFImageObjectLike | undefined;
}

/**
 * Shape of the image objects pdf.js places in `page.objs`. The
 * loader probes for the two forms in turn.
 *
 * @internal
 */
interface PDFImageObjectLike {
  /** Raw-pixel form. */
  data?: Uint8Array | Uint8ClampedArray;
  width?: number;
  height?: number;
  /** pdf.js `ImageKind` enum value (1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP). */
  kind?: number;
  /** Pre-decoded form delivered by some pdf.js paths. */
  bitmap?: ImageBitmap;
}

/**
 * Optional settings for {@link PDFPageLike.getTextContent}.
 *
 * @internal
 */
interface PDFGetTextContentParams {
  /**
   * When `true`, pdf.js collapses whitespace and merges adjacent
   * fragments. Default-on in pdf.js but the loader doesn't care
   * either way; pass `false` if you need glyph-accurate positions.
   */
  normalizeWhitespace?: boolean;
  /**
   * When `false`, pdf.js skips the implicit space inference between
   * adjacent items on the same baseline. Default: pdf.js's own default.
   */
  disableCombineTextItems?: boolean;
}

/**
 * Page text-content result. pdf.js places each positioned string in
 * `items`; the loader iterates that list to emit text quads.
 *
 * @internal
 */
interface PDFTextContentLike {
  items: ReadonlyArray<PDFTextItem | PDFTextMarkedContent>;
  /**
   * Map of font id → font metadata. Not used by the loader (we render
   * text through the host browser's canvas, not pdf.js's font tables)
   * but included so adapter shape matches pdf.js exactly.
   */
  styles?: { [fontId: string]: any };
}

/**
 * One positioned string. pdf.js intermixes these with marked-content
 * markers (`type: "beginMarkedContent" | "endMarkedContent" | …`); the
 * loader skips anything without a `str` field.
 *
 * @internal
 */
interface PDFTextItem {
  /** Text content. */
  str: string;
  /**
   * Affine `[a, b, c, d, e, f]` placing the text on the page in
   * user-space: `e, f` is the baseline left position, `a` / `d`
   * carry the effective font size (with rotation in `b, c`).
   */
  transform: number[];
  /** Horizontal extent of the rendered string, user-space units. */
  width: number;
  /** Effective font size — approximately ascent-line of the run. */
  height: number;
  /** Font reference. pdf.js gives names like `g_d0_f1` rather than real font names. */
  fontName?: string;
  /** Line-break marker — pdf.js sets this on the last item of a logical line. */
  hasEOL?: boolean;
  /** `"ltr"` or `"rtl"`. */
  dir?: string;
}

/**
 * Marked-content markers that show up in the same `items` array as
 * text strings. Distinguished by the absence of `str` — the loader
 * skips them.
 *
 * @internal
 */
interface PDFTextMarkedContent {
  type: string;
  id?: string | null;
  tag?: string | null;
}

/**
 * @internal
 */
interface PDFViewportLike {
  readonly width: number;
  readonly height: number;
}

/**
 * Operator list — a flat fnArray + argsArray pair, walked in tandem.
 * `fnArray[i]` is the numeric op code; `argsArray[i]` is its args
 * (shape depends on the op).
 *
 * @internal
 */
interface PDFOperatorListLike {
  readonly fnArray: ReadonlyArray<number>;
  readonly argsArray: ReadonlyArray<any>;
}

/**
 * Subset of pdf.js's `OPS` table the loader actually consumes.
 * All other operators are read off the list and ignored, so adding
 * a new op here only matters if the loader grows to support it.
 *
 * `constructPath` is the one PDF.js groups several path-construction
 * sub-ops under; its args carry the inner sub-op list and the
 * coordinate stream.
 *
 * @internal
 */
interface PDFOperatorCodes {
  // Path construction (top-level)
  readonly constructPath: number;
  readonly rectangle: number;

  // Path construction sub-ops (inside constructPath args[0])
  readonly moveTo: number;
  readonly lineTo: number;
  readonly curveTo: number;
  readonly curveTo2: number;
  readonly curveTo3: number;
  readonly closePath: number;

  // Path painting — the loader emits accumulated path on any of these.
  readonly stroke: number;
  readonly closeStroke: number;
  readonly fill: number;
  readonly eoFill: number;
  readonly fillStroke: number;
  readonly eoFillStroke: number;
  readonly closeFillStroke: number;
  readonly closeEOFillStroke: number;
  readonly endPath: number;

  // Graphics state.
  readonly save: number;
  readonly restore: number;
  readonly transform: number;

  // Stroke styling — optional because v1 adapters didn't need them
  // and we'd rather degrade to uniform colour than refuse a load.
  readonly setStrokeRGBColor?: number;
  readonly setStrokeGray?: number;
  readonly setLineWidth?: number;
  readonly setDash?: number;

  // Fill styling — same optionality rationale. CMYK is included
  // because Revit / ArchiCAD exports sometimes use it for printed
  // sheet output even when stroke colours are in DeviceRGB.
  readonly setFillRGBColor?: number;
  readonly setFillGray?: number;
  readonly setFillCMYKColor?: number;

  // Image painting. Optional because not every adapter implementer
  // needs raster-PDF support; when an op code is undefined the loader
  // never matches against it and just skips image XObjects.
  readonly paintImageXObject?: number;
  readonly paintJpegXObject?: number;
  readonly paintImageMaskXObject?: number;
  readonly paintInlineImageXObject?: number;
}


// ─── pdf.js loader (cached) ───────────────────────────────────────
//
// Dynamic ESM import + worker-URL setup is expensive (network +
// worker spin-up). Cache by `(esmUrl, workerSrc)` so repeated loads
// against the same source don't redo the work.
const _pdfjsCache = new Map<string, Promise<PdfJsHandle>>();

interface PdfJsHandle {
  getDocument: (params: any) => {promise: Promise<PDFDocumentLike>};
  OPS: PDFOperatorCodes;
}

async function loadPdfJs(opts: PDFLoadOptions & PDFLoaderParams): Promise<PdfJsHandle> {
  if (opts.pdfjs && typeof opts.pdfjs.getDocument === "function" && opts.pdfjs.OPS) {
    return opts.pdfjs as PdfJsHandle;
  }
  const esmUrl    = opts.pdfjsEsmUrl    ?? DEFAULT_PDFJS_ESM_URL;
  const workerSrc = opts.pdfjsWorkerSrc ?? DEFAULT_PDFJS_WORKER_SRC;
  const key = `${esmUrl}|${workerSrc}`;
  let p = _pdfjsCache.get(key);
  if (!p) {
    p = (async () => {
      const mod: any = await import(/* webpackIgnore: true */ esmUrl);
      if (!mod.getDocument || !mod.OPS) {
        throw new Error(`pdfjs module at '${esmUrl}' is missing expected exports (getDocument, OPS)`);
      }
      // Pdf.js requires the worker URL to be set on the global
      // options object BEFORE any getDocument() call. Mismatched
      // main / worker versions are pdf.js's #1 runtime failure mode;
      // we hand-wire the worker URL from the same CDN+version stem.
      if (mod.GlobalWorkerOptions) {
        mod.GlobalWorkerOptions.workerSrc = workerSrc;
      }
      return {getDocument: mod.getDocument.bind(mod), OPS: mod.OPS} as PdfJsHandle;
    })();
    // Drop the cached failure on reject so a retry can try again.
    p.catch(() => _pdfjsCache.delete(key));
    _pdfjsCache.set(key, p);
  }
  return p;
}


/**
 * Result returned by {@link PDFLoader.load} on success.
 */
export interface PDFLoadResult {
  /** SceneModel populated with one object per imported page. */
  sceneModel: SceneModel;
  /** Per-page imported dimensions in scene units (post-scale). */
  pages: Array<{
    pageNumber: number;
    width: number;
    height: number;
    /**
     * Page-local origin in world space, as `[x, y, z]`. The layout
     * strategy ({@link PDFLoadOptions.layout}) decides which axes
     * advance per page; unused axes stay `0`.
     */
    offset: [number, number, number];
    /** Number of line segments emitted for this page. */
    segmentCount: number;
    /** Number of fill triangles emitted for this page. */
    triangleCount: number;
    /** Number of image XObjects emitted as textured quads. */
    imageCount: number;
    /** Number of positioned text strings emitted as textured quads. */
    textCount: number;
  }>;
}


/**
 * Inputs handed to {@link PDFLoader.load} — `fileData` is the
 * PDF byte stream (ArrayBuffer or Uint8Array), `sceneModel` is the
 * target the loader populates.
 *
 * @internal
 */
export interface PDFLoadInput {
  fileData: ArrayBuffer | Uint8Array<any>;
  sceneModel: SceneModel;
}


/**
 * Full pipeline: PDF bytes → SceneModel.
 *
 * Validates input, dynamically loads pdf.js (CDN by default —
 * configurable / pre-init-injectable via options), walks each page,
 * and emits the SceneModel entities. Returns an `SDKResult` so the
 * wrapping {@link PDFLoader} can pass it through unchanged.
 */
export async function parse(input: PDFLoadInput, options: PDFLoadOptions & PDFLoaderParams = {}): Promise<SDKResult<PDFLoadResult>> {

    if (!input || !input.sceneModel) {
      return {ok: false, type: SDKErrorType.InvalidInput, error: "[pdf.parse] sceneModel is required"};
    }
    if (input.sceneModel.destroyed) {
      return {ok: false, type: SDKErrorType.InvalidOperation, error: "[pdf.parse] SceneModel already destroyed"};
    }
    if (!input.fileData) {
      return {ok: false, type: SDKErrorType.InvalidInput, error: "[pdf.parse] fileData is required"};
    }

    const opts = {...DEFAULT_PDF_LOAD_OPTIONS, ...options};
    const data = input.fileData instanceof Uint8Array
      ? input.fileData.buffer.slice(input.fileData.byteOffset, input.fileData.byteOffset + input.fileData.byteLength) as ArrayBuffer
      : input.fileData;

    let pdfjs: PdfJsHandle;
    try {
      pdfjs = await loadPdfJs(options);
    } catch (e: any) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[pdf.parse] pdf.js init failed: ${e?.message ?? e}`,
      };
    }

    let pdf: PDFDocumentLike | null = null;
    try {
      pdf = await pdfjs.getDocument({data}).promise;

      const allPages = pdf.numPages;
      const pageIndices: number[] = options.pages && options.pages.length > 0
        ? options.pages.filter((p) => p >= 1 && p <= allPages)
        : Array.from({length: allPages}, (_, i) => i + 1);

      const OPS = pdfjs.OPS;
      const pages: PDFLoadResult["pages"] = [];

      // Layout state. `firstPage*` seeds the grid cell size (uniform
      // AECO sheet sets pack tightly; mixed-size sets get dead space
      // between cells). `rowAccumX` / `columnAccumY` track the
      // cumulative footprint of previously-laid-out pages so mixed-
      // size docs pack exactly without overlap under `row` / `column`.
      let firstPageWidth  = 0;
      let firstPageHeight = 0;
      let rowAccumX    = 0;
      let columnAccumY = 0;

      for (let i = 0; i < pageIndices.length; i++) {
        const pageNumber = pageIndices[i];
        const page = await pdf.getPage(pageNumber);

        const view = page.getViewport({scale: 1});
        const pageWidth  = view.width  * opts.scale;
        const pageHeight = view.height * opts.scale;

        if (i === 0) {
          firstPageWidth  = pageWidth;
          firstPageHeight = pageHeight;
        }

        // Compute this page's origin in world space based on the
        // layout strategy. Unused axes stay at 0; `pageGap` is the
        // spacing along whichever axis the strategy advances.
        const pageOffset = computePageOffset(
          i,
          firstPageWidth,
          firstPageHeight,
          opts.layout,
          opts.gridColumns,
          opts.pageGap,
          rowAccumX,
          columnAccumY,
        );
        // Advance accumulators by THIS page's footprint + gap so the
        // next iteration's offset starts after this page, even when
        // page sizes vary across the doc.
        rowAccumX    += pageWidth  + opts.pageGap;
        columnAccumY += pageHeight + opts.pageGap;
        const offX = pageOffset[0];
        const offY = pageOffset[1];
        const offZ = pageOffset[2];

        const opList = await page.getOperatorList();
        const {segments, triangles, images} = extractDrawables(
          opList, OPS, opts.bezierSteps, opts.renderImages, opts.renderFills,
          opts.multiSubpathFills,
        );

        const pageObjectMeshIds: string[] = [];
        const objectId = `${input.sceneModel.id}-page-${pageNumber}`;

        // ── Filled regions ───────────────────────────────────────
        // Fills emit BEFORE strokes so the z-offset push-back pairs
        // with stroke fragments along shared boundaries without
        // z-fighting; SceneMesh.position carries the offset.
        const fillBuckets = bucketTrianglesByColor(triangles, options.fillColor);
        let fillBucketIdx = 0;
        for (const [, bucket] of fillBuckets) {
          const tris = bucket.triangles;
          const suffix = `fill-${fillBucketIdx++}`;
          const geometryId = `${objectId}-${suffix}-geom`;
          const materialId = `${objectId}-${suffix}-mat`;
          const meshId     = `${objectId}-${suffix}-mesh`;

          const positions = new Float32Array(tris.length * 3 * 3);
          const indices   = new Uint32Array(tris.length * 3);
          for (let t = 0; t < tris.length; t++) {
            const p = tris[t];
            const o = t * 9;
            positions[o + 0] = p[0] * opts.scale; positions[o + 1] = p[1] * opts.scale; positions[o + 2] = 0;
            positions[o + 3] = p[2] * opts.scale; positions[o + 4] = p[3] * opts.scale; positions[o + 5] = 0;
            positions[o + 6] = p[4] * opts.scale; positions[o + 7] = p[5] * opts.scale; positions[o + 8] = 0;
            const i0 = t * 3;
            indices[i0]     = i0;
            indices[i0 + 1] = i0 + 1;
            indices[i0 + 2] = i0 + 2;
          }

          const gRes = input.sceneModel.createGeometry({
            id: geometryId,
            primitive: TrianglesPrimitive,
            positions: positions as any,
            indices:   indices as any,
          });
          if (gRes.ok === false) {
            console.warn(`[PDFLoader] page ${pageNumber} fill: ${gRes.error}`);
            continue;
          }

          const matRes = input.sceneModel.createMaterial({
            id: materialId,
            color: bucket.color,
          });
          if (matRes.ok === false) {
            console.warn(`[PDFLoader] page ${pageNumber} fill: ${matRes.error}`);
            continue;
          }

          const mRes = input.sceneModel.createMesh({
            id: meshId,
            geometryId,
            materialId,
            // Push fills behind strokes along Z; otherwise depth-tied
            // stroke fragments on the same boundary dropout.
            position: [offX, offY, offZ + opts.fillZOffset],
            color: bucket.color,
          });
          if (mRes.ok === false) {
            console.warn(`[PDFLoader] page ${pageNumber} fill: ${mRes.error}`);
            continue;
          }

          pageObjectMeshIds.push(meshId);
        }

        // ── Vector strokes ───────────────────────────────────────
        // Bucket segments by (colour, lineWidth) so each style group
        // becomes its own geometry+material+mesh. Honours PDF's own
        // discipline-coded ink unless `opts.color` is supplied as an
        // override.
        const buckets = bucketSegmentsByStyle(
          segments,
          options.color,
          opts.lineWidthScale,
          opts.minLineWidth,
        );
        let bucketIdx = 0;
        for (const [, bucket] of buckets) {
          const segs = bucket.segments;
          const suffix = `lines-${bucketIdx++}`;
          const geometryId = `${objectId}-${suffix}-geom`;
          const materialId = `${objectId}-${suffix}-mat`;
          const meshId     = `${objectId}-${suffix}-mesh`;

          const positions = new Float32Array(segs.length * 2 * 3);
          const indices   = new Uint32Array(segs.length * 2);
          for (let s = 0; s < segs.length; s++) {
            const p = segs[s];
            const o = s * 6;
            positions[o + 0] = p[0] * opts.scale;
            positions[o + 1] = p[1] * opts.scale;
            positions[o + 2] = 0;
            positions[o + 3] = p[2] * opts.scale;
            positions[o + 4] = p[3] * opts.scale;
            positions[o + 5] = 0;
            const i0 = s * 2;
            indices[i0]     = i0;
            indices[i0 + 1] = i0 + 1;
          }

          const gRes = input.sceneModel.createGeometry({
            id: geometryId,
            primitive: LinesPrimitive,
            positions: positions as any,
            indices:   indices as any,
          });
          if (gRes.ok === false) {
            return {ok: false, type: gRes.type, error: `[pdf.parse] page ${pageNumber}: ${gRes.error}`};
          }

          const matRes = input.sceneModel.createMaterial({
            id: materialId,
            color: bucket.color,
            lineWidth: bucket.lineWidth,
            // Only pass linePattern when non-empty — undefined defers
            // to the SceneMaterial default ("solid") rather than
            // forcing an explicit no-op pattern through the renderer.
            ...(bucket.linePattern.length > 0 ? {linePattern: bucket.linePattern} : {}),
          });
          if (matRes.ok === false) {
            return {ok: false, type: matRes.type, error: `[pdf.parse] page ${pageNumber}: ${matRes.error}`};
          }

          const mRes = input.sceneModel.createMesh({
            id: meshId,
            geometryId,
            materialId,
            position: [offX, offY, offZ],
            color: bucket.color,
          });
          if (mRes.ok === false) {
            return {ok: false, type: mRes.type, error: `[pdf.parse] page ${pageNumber}: ${mRes.error}`};
          }

          pageObjectMeshIds.push(meshId);
        }

        // ── Image XObjects → textured quads ───────────────────────
        let imageEmitted = 0;
        for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
          const img = images[imgIdx];

          // Resolve the source: paintImageXObject / paintJpegXObject /
          // paintImageMaskXObject → page.objs.get; paintInlineImageXObject
          // → image object inlined directly in the operator args.
          const obj = img.source.kind === "ref"
            ? page.objs.get(img.source.objId)
            : img.source.obj;

          // Masks need their own pixel-data path (1-bit unpack tinted
          // with the captured fillColor). Regular images go through
          // resolveImage to land on RGB → RGBA / ImageBitmap.
          const pixels = img.isMask
            ? resolveImageMask(obj, img.fillColor)
            : resolveImage(obj);
          if (!pixels) continue;       // unsupported kind / no data

          const texId  = `${objectId}-img-${imgIdx}-tex`;
          const matId  = `${objectId}-img-${imgIdx}-mat`;
          const geomId = `${objectId}-img-${imgIdx}-geom`;
          const meshId = `${objectId}-img-${imgIdx}-mesh`;

          // Texture upload. Two branches: a pre-decoded ImageBitmap goes
          // through `image`; a raw pixel buffer goes through `imageData`
          // (with PDF's top-down row order corrected by `flipY: true`).
          const texParams: any = {
            id: texId,
            flipY: true,
            // Drawings are pixel-art-ish at sheet scale; nearest filter
            // keeps line strokes crisp instead of muddy under bilinear.
            magFilter: undefined,
            minFilter: undefined,
          };
          if (pixels.bitmap) {
            texParams.image = pixels.bitmap;
          } else {
            texParams.imageData = {
              data:   pixels.data!,
              width:  pixels.width!,
              height: pixels.height!,
            };
          }
          const tRes = input.sceneModel.createTexture(texParams);
          if (tRes.ok === false) {
            // Skip this image but don't fail the whole load — some
            // PDFs reference image kinds the SceneModel rejects
            // (e.g. very large dimensions). Log and continue.
            console.warn(`[PDFLoader] page ${pageNumber} image ${imgIdx}: ${tRes.error}`);
            continue;
          }

          const mat = input.sceneModel.createMaterial({
            id: matId,
            colorTextureId: texId,
            // Masks have transparent backgrounds. MASK (not BLEND)
            // because the renderer only enables GL blending for
            // LinesPrimitive batches — triangle quads with
            // alphaMode:"BLEND" lose the alpha channel and read as
            // opaque black. The shader's MASK path discards
            // sub-cutoff fragments, which is what we want for
            // image masks (binary 1-bit alpha is already crisp).
            ...(img.isMask
              ? {alphaMode: "MASK" as const, alphaCutoff: 0.5}
              : {}),
          });
          if (mat.ok === false) {
            console.warn(`[PDFLoader] page ${pageNumber} image ${imgIdx}: ${mat.error}`);
            continue;
          }

          // Transform unit-square corners (0,0)(1,0)(1,1)(0,1) by the
          // image's CTM into page user space, then scale into scene
          // units. UVs map the texture across the quad; flipY on the
          // texture upload accounts for PDF's top-row-first storage.
          const m = img.ctm;
          const corners = [
            [0, 0], [1, 0], [1, 1], [0, 1],
          ].map(([x, y]) => [
            (m[0] * x + m[2] * y + m[4]) * opts.scale,
            (m[1] * x + m[3] * y + m[5]) * opts.scale,
          ]);
          const positions = new Float32Array([
            corners[0][0], corners[0][1], 0,
            corners[1][0], corners[1][1], 0,
            corners[2][0], corners[2][1], 0,
            corners[3][0], corners[3][1], 0,
          ]);
          const uvs = new Float32Array([
            0, 0,  1, 0,  1, 1,  0, 1,
          ]);
          // Two triangles, CCW so the front face points +Z (towards
          // the camera in the demo's default frame).
          const indices = new Uint32Array([0, 1, 2,  0, 2, 3]);

          const gRes = input.sceneModel.createGeometry({
            id: geomId,
            primitive: TrianglesPrimitive,
            positions: positions as any,
            uvs:       uvs       as any,
            indices:   indices   as any,
          });
          if (gRes.ok === false) {
            console.warn(`[PDFLoader] page ${pageNumber} image ${imgIdx}: ${gRes.error}`);
            continue;
          }

          const meshRes = input.sceneModel.createMesh({
            id: meshId,
            geometryId: geomId,
            materialId: matId,
            position: [offX, offY, offZ],
          });
          if (meshRes.ok === false) {
            console.warn(`[PDFLoader] page ${pageNumber} image ${imgIdx}: ${meshRes.error}`);
            continue;
          }

          pageObjectMeshIds.push(meshId);
          imageEmitted++;
        }

        // ── Text → atlas-packed batched quads ────────────────────
        // All positioned text on this page lands in ONE shared atlas
        // texture, with one batched geometry holding every label's
        // quad. Result: 1 texture + 1 material + 1 mesh per page
        // instead of N each — important for sheets with hundreds of
        // labels (schedules, drawing notes, BIM annotation tags).
        let textEmitted = 0;
        if (opts.renderText) {
          const tc = await page.getTextContent();
          const items = tc.items ?? [];
          const textColor = options.textColor ?? opts.textDefaultColor;

          // Pass 1 — filter valid items + compute per-item canvas
          // pixel dimensions. Items without `str` (marked-content
          // markers, EOL sentinels, zero-width spaces) are dropped.
          const valid: Array<{
            item: PDFTextItem;
            fontSize: number;
            pxW: number;
            pxH: number;
            atlasX: number;
            atlasY: number;
          }> = [];
          for (let ti = 0; ti < items.length; ti++) {
            const it = items[ti] as PDFTextItem;
            if (typeof it.str !== "string" || it.str.length === 0) continue;
            const tr = it.transform;
            const matrixSize = Math.hypot(tr[1] ?? 0, tr[3] ?? 1);
            const fontSize = it.height && it.height > 0 ? it.height : matrixSize;
            if (fontSize <= 0 || !isFinite(fontSize)) continue;
            if (it.width <= 0 || !isFinite(it.width)) continue;

            const pxW = Math.max(1, Math.ceil(it.width * opts.textPxPerUnit));
            const pxH = Math.max(1, Math.ceil(fontSize * 1.2 * opts.textPxPerUnit));
            valid.push({item: it, fontSize, pxW, pxH, atlasX: 0, atlasY: 0});
          }

          if (valid.length > 0) {
            // Pass 2 — shelf-pack items into atlas rows.
            const atlasDims = packTextAtlas(valid);

            // Pass 3 — rasterise every label into one OffscreenCanvas.
            const atlas = rasterizeTextAtlas(
              valid,
              atlasDims.width,
              atlasDims.height,
              opts.textPxPerUnit,
              opts.textFont,
              textColor,
            );

            if (atlas) {
              const texId  = `${objectId}-text-atlas-tex`;
              const matId  = `${objectId}-text-atlas-mat`;
              const geomId = `${objectId}-text-atlas-geom`;
              const meshId = `${objectId}-text-atlas-mesh`;

              // Pull the canvas's RGBA bytes out via getImageData and
              // upload via the imageData path. Going `image: canvas`
              // straight to the texture loses the alpha channel on
              // some renderer paths (transparent background → opaque
              // black, glyph contrast collapses to "black box"). The
              // explicit byte buffer survives intact.
              let pixelData: Uint8ClampedArray | null = null;
              try {
                const ctx = atlas.getContext("2d");
                if (ctx) {
                  pixelData = ctx.getImageData(0, 0, atlasDims.width, atlasDims.height).data;
                }
              } catch (err) {
                console.warn(`[PDFLoader] page ${pageNumber} text atlas: getImageData failed: ${err}`);
              }

              const tRes = pixelData
                ? input.sceneModel.createTexture({
                    id: texId,
                    imageData: {
                      data:   pixelData,
                      width:  atlasDims.width,
                      height: atlasDims.height,
                    },
                    flipY: true,
                  })
                : {ok: false as const, type: SDKErrorType.InvalidOperation, error: "no pixel data"};
              if (tRes.ok === false) {
                console.warn(`[PDFLoader] page ${pageNumber} text atlas: ${tRes.error}`);
              } else {
                const matRes = input.sceneModel.createMaterial({
                  id: matId,
                  colorTextureId: texId,
                  // MASK (not BLEND) — the renderer only enables GL
                  // blending for LinesPrimitive batches; triangles
                  // with alphaMode:"BLEND" silently lose the alpha
                  // channel and read as opaque black quads. MASK
                  // routes through the fragment shader's
                  // anti-aliased alpha-discard path, which gives
                  // ~1-pixel AA edges without needing GL_BLEND on
                  // the triangle pass.
                  alphaMode: "MASK",
                  alphaCutoff: 0.5,
                });
                if (matRes.ok === false) {
                  console.warn(`[PDFLoader] page ${pageNumber} text atlas: ${matRes.error}`);
                } else {
                  // Pass 4 — build batched geometry. Every label
                  // contributes 4 vertices + 2 triangles + UVs into
                  // its atlas region.
                  const N = valid.length;
                  const positions = new Float32Array(N * 4 * 3);
                  const uvs       = new Float32Array(N * 4 * 2);
                  const indices   = new Uint32Array(N * 6);

                  for (let i = 0; i < N; i++) {
                    const t = valid[i];
                    const it = t.item;
                    const tr = it.transform;

                    // Quad corners — same direction-vector math as
                    // before, accounts for rotated text matrices.
                    const ex = tr[4], fy = tr[5];
                    const dirLen = Math.hypot(tr[0], tr[1]) || 1;
                    const upLen  = Math.hypot(tr[2], tr[3]) || 1;
                    const dirX = tr[0] / dirLen, dirY = tr[1] / dirLen;
                    const upX  = tr[2] / upLen,  upY  = tr[3] / upLen;
                    const ascent  = t.fontSize * 0.8;
                    const descent = t.fontSize * 0.2;
                    const totalUp = ascent + descent;
                    const blX = ex - descent * upX;
                    const blY = fy - descent * upY;
                    const brX = blX + it.width * dirX;
                    const brY = blY + it.width * dirY;
                    const trX = brX + totalUp  * upX;
                    const trY = brY + totalUp  * upY;
                    const tlX = blX + totalUp  * upX;
                    const tlY = blY + totalUp  * upY;

                    const vOff = i * 4 * 3;
                    positions[vOff +  0] = blX * opts.scale; positions[vOff +  1] = blY * opts.scale; positions[vOff +  2] = 0;
                    positions[vOff +  3] = brX * opts.scale; positions[vOff +  4] = brY * opts.scale; positions[vOff +  5] = 0;
                    positions[vOff +  6] = trX * opts.scale; positions[vOff +  7] = trY * opts.scale; positions[vOff +  8] = 0;
                    positions[vOff +  9] = tlX * opts.scale; positions[vOff + 10] = tlY * opts.scale; positions[vOff + 11] = 0;

                    // Atlas UVs. NOTE: SceneTexture `flipY` is currently a
                    // no-op — `TextureAtlas.ts` hard-codes
                    // `UNPACK_FLIP_Y_WEBGL = false` regardless of the
                    // texture parameter. So canvas row 0 ends up at
                    // texture v=0, NOT v=1. UVs are computed to match
                    // the actual upload (top of canvas at v=0, bottom
                    // at v=1) so the quad's TL (world high-Y) reads the
                    // canvas top (ascender area) and BL the bottom
                    // (descender area). If the renderer ever wires
                    // `flipY` through, flip these back to `1 - ...`.
                    const u0 = t.atlasX / atlasDims.width;
                    const u1 = (t.atlasX + t.pxW) / atlasDims.width;
                    const vTop = t.atlasY / atlasDims.height;
                    const vBot = (t.atlasY + t.pxH) / atlasDims.height;

                    const uvOff = i * 4 * 2;
                    uvs[uvOff + 0] = u0; uvs[uvOff + 1] = vBot;  // bl ↔ (0,0)
                    uvs[uvOff + 2] = u1; uvs[uvOff + 3] = vBot;  // br ↔ (1,0)
                    uvs[uvOff + 4] = u1; uvs[uvOff + 5] = vTop;  // tr ↔ (1,1)
                    uvs[uvOff + 6] = u0; uvs[uvOff + 7] = vTop;  // tl ↔ (0,1)

                    const iOff = i * 6;
                    const base = i * 4;
                    indices[iOff + 0] = base;
                    indices[iOff + 1] = base + 1;
                    indices[iOff + 2] = base + 2;
                    indices[iOff + 3] = base;
                    indices[iOff + 4] = base + 2;
                    indices[iOff + 5] = base + 3;
                  }

                  const gRes = input.sceneModel.createGeometry({
                    id: geomId,
                    primitive: TrianglesPrimitive,
                    positions: positions as any,
                    uvs:       uvs       as any,
                    indices:   indices   as any,
                  });
                  if (gRes.ok === false) {
                    console.warn(`[PDFLoader] page ${pageNumber} text atlas: ${gRes.error}`);
                  } else {
                    const mRes = input.sceneModel.createMesh({
                      id: meshId,
                      geometryId: geomId,
                      materialId: matId,
                      // Text sits in front of strokes (z=0) and fills
                      // (z=fillZOffset<0); mirror the fill offset.
                      position: [offX, offY, offZ - opts.fillZOffset],
                    });
                    if (mRes.ok === false) {
                      console.warn(`[PDFLoader] page ${pageNumber} text atlas: ${mRes.error}`);
                    } else {
                      pageObjectMeshIds.push(meshId);
                      textEmitted = N;
                    }
                  }
                }
              }
            }
          }
        }

        // Wrap every emission from this page in a single SceneObject so
        // demos can address the page as one selectable unit.
        if (pageObjectMeshIds.length > 0) {
          const oRes = input.sceneModel.createObject({
            id: objectId,
            meshIds: pageObjectMeshIds,
          });
          if (oRes.ok === false) {
            return {ok: false, type: oRes.type, error: `[pdf.parse] page ${pageNumber}: ${oRes.error}`};
          }
        }

        // Optional backing box — inside-out 3D box that gives the
        // page a pickable surface behind the drawing. See
        // `PDFLoadOptions.backingBox`. Mirrors the chrome pattern
        // `buildDrawingPanel` uses: an inside-out thin box around
        // the drawing plane, sized off the union of every emitted
        // page mesh's geometry AABB (NOT the PDF's sheet
        // dimensions, which commonly extend well beyond the
        // content for margin / non-zero MediaBox origin).
        //
        // Emitted as its own SceneObject (id `${objectId}__box`)
        // so the host can toggle / style / pick it independently
        // of the page's drawn meshes.
        if (opts.backingBox && pageObjectMeshIds.length > 0) {
          const boxSpec = typeof opts.backingBox === "object" ? opts.backingBox : {};
          const boxColor     = boxSpec.color     ?? [0.96, 0.97, 0.99];
          const boxOpacity   = boxSpec.opacity   ?? 0.55;
          const boxDepth     = boxSpec.depth     ?? 0.05;
          const boxMargin    = boxSpec.margin    ?? 0;
          const boxClippable = boxSpec.clippable ?? false;

          // Union the local-space XY bounds of every page mesh's
          // geometry. The aabb on each SceneGeometry was computed
          // during createGeometry from its positions, so this
          // exactly tracks where the emitted content actually
          // lives — independent of any sheet-edge assumptions.
          let cMinX =  Infinity, cMinY =  Infinity;
          let cMaxX = -Infinity, cMaxY = -Infinity;
          const meshes = (input.sceneModel as any).meshes;
          for (const meshId of pageObjectMeshIds) {
            const mesh = meshes[meshId];
            if (!mesh || !mesh.geometry || !mesh.geometry.aabb) continue;
            const a = mesh.geometry.aabb;
            if (a[0] < cMinX) cMinX = a[0];
            if (a[1] < cMinY) cMinY = a[1];
            if (a[3] > cMaxX) cMaxX = a[3];
            if (a[4] > cMaxY) cMaxY = a[4];
          }

          if (cMinX !== Infinity) {
            const boxObjectId   = `${objectId}__box`;
            const boxGeometryId = `${boxObjectId}-geom`;
            const boxMaterialId = `${boxObjectId}-mat`;
            const boxMeshId     = `${boxObjectId}-mesh`;

            // 8 corners in page-local coords. The mesh's
            // `position` carries the page-layout offset later,
            // exactly as the drawn meshes do.
            //
            //   0..3 = bottom face (z = -depth, behind drawing)
            //   4..7 = top    face (z = +depth, in front of drawing)
            //
            // bit 0 → x choice (0 → bx0, 1 → bx1)
            // bit 1 → y choice
            // bit 2 → z choice (0 → bz0, 1 → bz1)
            const bx0 = cMinX - boxMargin, bx1 = cMaxX + boxMargin;
            const by0 = cMinY - boxMargin, by1 = cMaxY + boxMargin;
            const bz0 = -boxDepth,         bz1 =  boxDepth;
            const boxPositions = new Float32Array([
              bx0, by0, bz0,  bx1, by0, bz0,  bx1, by1, bz0,  bx0, by1, bz0,
              bx0, by0, bz1,  bx1, by0, bz1,  bx1, by1, bz1,  bx0, by1, bz1,
            ]);

            // Inside-out winding — each triangle wound so its
            // computed normal `(b-a)×(c-a)` points INTO the box.
            // Verified per face (with bx1>bx0, by1>by0, bz1>bz0):
            //   bottom (z=bz0):  cross = +Z (into box)
            //   top    (z=bz1):  cross = -Z
            //   y=by0:           cross = +Y
            //   y=by1:           cross = -Y
            //   x=bx0:           cross = +X
            //   x=bx1:           cross = -X
            // With the renderer's transparent pass (engaged by
            // `opacity < 1`) enabling `gl.CULL_FACE`, the
            // camera-facing wall's back face is culled and the
            // opposite wall reads as a translucent backdrop —
            // same effect `buildDrawingPanel` produces.
            const boxIndices = new Uint32Array([
              0, 1, 2,   0, 2, 3,   // bottom face (z=bz0)
              4, 6, 5,   4, 7, 6,   // top    face (z=bz1)
              0, 5, 1,   0, 4, 5,   // y=by0 face
              3, 2, 6,   3, 6, 7,   // y=by1 face
              0, 3, 7,   0, 7, 4,   // x=bx0 face
              1, 6, 2,   1, 5, 6,   // x=bx1 face
            ]);

            const boxGRes = input.sceneModel.createGeometry({
              id: boxGeometryId,
              primitive: TrianglesPrimitive,
              positions: boxPositions as any,
              indices:   boxIndices as any,
            });
            if (boxGRes.ok === false) {
              console.warn(`[PDFLoader] page ${pageNumber} backing box: ${boxGRes.error}`);
            } else {
              const boxMRes = input.sceneModel.createMaterial({
                id:    boxMaterialId,
                color: boxColor,
              });
              if (boxMRes.ok === false) {
                console.warn(`[PDFLoader] page ${pageNumber} backing box: ${boxMRes.error}`);
              } else {
                const boxMeshRes = input.sceneModel.createMesh({
                  id:         boxMeshId,
                  geometryId: boxGeometryId,
                  materialId: boxMaterialId,
                  position:   [offX, offY, offZ],
                  color:      boxColor,
                  opacity:    boxOpacity,
                });
                if (boxMeshRes.ok === false) {
                  console.warn(`[PDFLoader] page ${pageNumber} backing box: ${boxMeshRes.error}`);
                } else {
                  const boxORes = input.sceneModel.createObject({
                    id:        boxObjectId,
                    meshIds:   [boxMeshId],
                    clippable: boxClippable,
                  });
                  if (boxORes.ok === false) {
                    console.warn(`[PDFLoader] page ${pageNumber} backing box: ${boxORes.error}`);
                  }
                }
              }
            }
          }
        }

        pages.push({
          pageNumber,
          width:  pageWidth,
          height: pageHeight,
          offset: [offX, offY, offZ],
          segmentCount:  segments.length,        // pre-bucketing
          triangleCount: triangles.length,
          imageCount:    imageEmitted,
          textCount:     textEmitted,
        });

        options.onPageProgress?.(i + 1, pageIndices.length);
      }

      return {ok: true, value: {sceneModel: input.sceneModel, pages}};

    } catch (err: any) {
      return {
        ok: false,
        type: SDKErrorType.Unknown,
        error: `[pdf.parse] ${err?.message ?? String(err)}`,
      };
    } finally {
      if (pdf) {
        try { await pdf.destroy(); } catch { /* best-effort */ }
      }
    }
}


// ─────────────────────────────────────────────────────────────────
// Operator-list walker — internal.
// ─────────────────────────────────────────────────────────────────

/**
 * One image XObject encountered during the walk, plus the CTM, fill
 * colour, and inline-vs-referenced source resolution captured at
 * paint time.
 *
 * Three flavours pdf.js delivers under the image-painting ops:
 *  - `paintImageXObject` / `paintJpegXObject` — args = `[objId, w, h]`,
 *    pixel data fetched via `page.objs.get(objId)`. Painted with image
 *    colour data; `isMask` = false.
 *  - `paintImageMaskXObject` — args = `[objId]` (or `[imgObj, ...]`),
 *    1-bit mask data. Painted with the *current fill colour* as the
 *    visible ink — alpha comes from the mask. `isMask` = true.
 *  - `paintInlineImageXObject` — args = `[imgObj]` (resolved inline
 *    in the operator stream; not via `objs.get`). `isMask` = false.
 */
interface ImageEmission {
  source: ImageSource;
  ctm: [number, number, number, number, number, number];
  /** True for `paintImageMaskXObject` — masked emission uses fillColor as ink. */
  isMask: boolean;
  /** Captured stroking/filling colour at the time of paint. Only consumed when `isMask`. */
  fillColor: [number, number, number];
}

type ImageSource =
  | { kind: "ref";    objId: string }
  | { kind: "inline"; obj: PDFImageObjectLike };

/**
 * Mutable graphics-state record carried on a stack so PDF's `q` (save)
 * and `Q` (restore) ops can checkpoint the full state, not just CTM.
 *  - `ctm` — current transformation matrix `[a, b, c, d, e, f]` such that
 *    `x' = a*x + c*y + e; y' = b*x + d*y + f`.
 *  - `strokeColor` — RGB triplet in `[0, 1]`, defaulting to black.
 *    Updated by `setStrokeRGBColor` / `setStrokeGray`.
 *  - `lineWidth` — PDF user-space line width. Updated by `setLineWidth`.
 *    Default `1` matches PDF spec.
 */
interface GfxState {
  ctm: [number, number, number, number, number, number];
  strokeColor: [number, number, number];
  fillColor:   [number, number, number];
  lineWidth: number;
  /**
   * Dash pattern in PDF user-space units (points). Empty array
   * means "solid line". The list comes from the `d` op verbatim;
   * PDF spec lets it be arbitrary length, the loader clamps to
   * {@link MAX_LINE_PATTERN_ENTRIES} when emitting material patterns.
   */
  dashArray: number[];
}

/**
 * One styled segment in the page's user-space coordinate frame.
 *
 * @internal
 */
export interface StyledSegment {
  /** `[x0, y0, x1, y1]`. */
  pts: [number, number, number, number];
  /** Stroke colour active when the segment was emitted, `[r, g, b]` in 0..1. */
  color: [number, number, number];
  /** PDF user-space line width active when the segment was emitted. */
  lineWidth: number;
  /**
   * Dash pattern in PDF user-space units (points), shared by reference
   * across segments that came in under the same graphics state — the
   * walker swaps the reference on every `setDash` op, so equality
   * compares cheaply at bucket time.
   */
  dashArray: ReadonlyArray<number>;
}

/**
 * One filled triangle in the page's user-space coordinate frame.
 * Triangle vertices are already CTM-transformed; the loader just
 * applies its own `scale` + page offset on emission.
 *
 * @internal
 */
export interface StyledTriangle {
  pts: [number, number, number, number, number, number]; // x0,y0,x1,y1,x2,y2
  color: [number, number, number];
}

/**
 * Walks one page's operator list and returns
 *  - the styled line segments resolved from stroke ops,
 *  - the image XObjects scheduled for textured-quad emission
 * — all expressed in user space (the page's native PDF coordinate
 * frame, y-up, origin bottom-left). The caller applies further
 * scale + page-offset transforms.
 */
function extractDrawables(
  opList: {fnArray: ReadonlyArray<number>; argsArray: ReadonlyArray<any>},
  OPS: PDFOperatorCodes,
  bezierSteps: number,
  renderImages: boolean,
  renderFills: boolean,
  multiSubpathFills: "holes" | "separate" | "skip" = "holes",
): {
  segments: StyledSegment[];
  triangles: StyledTriangle[];
  images: ImageEmission[];
} {

  // Graphics-state stack — full state, not just CTM. `q` pushes a deep
  // copy of the top; `Q` pops. PDF's initial state has identity CTM,
  // black stroke + fill, 1-unit line width, and a solid line pattern.
  const stack: GfxState[] = [{
    ctm:         [1, 0, 0, 1, 0, 0],
    strokeColor: [0, 0, 0],
    fillColor:   [0, 0, 0],
    lineWidth:   1,
    dashArray:   [],
  }];

  // Current path being constructed — a flat array of sub-paths,
  // each sub-path is a flat [x0,y0, x1,y1, ...] polyline in user space.
  // Closed sub-paths set `closed[i] = true` so emission appends the
  // back-edge to the first vertex.
  let currentPath: Array<number[]> = [];
  let closed: boolean[] = [];
  let subX = 0, subY = 0;
  let hasCurrentPoint = false;

  const segments: StyledSegment[] = [];
  const triangles: StyledTriangle[] = [];
  const images: ImageEmission[] = [];

  const startSubPath = (x: number, y: number): void => {
    currentPath.push([x, y]);
    closed.push(false);
    subX = x;
    subY = y;
    hasCurrentPoint = true;
  };

  const appendToSubPath = (x: number, y: number): void => {
    if (!hasCurrentPoint) {
      startSubPath(x, y);
      return;
    }
    currentPath[currentPath.length - 1].push(x, y);
    subX = x;
    subY = y;
  };

  const tessellateCubic = (
    p0x: number, p0y: number,
    c1x: number, c1y: number,
    c2x: number, c2y: number,
    p1x: number, p1y: number,
  ): void => {
    // Uniform sampling — straight-segment approximation. `bezierSteps`
    // pieces per curve; first sample is `t=1/steps` so we don't
    // duplicate the start point already in the polyline.
    for (let i = 1; i <= bezierSteps; i++) {
      const t = i / bezierSteps;
      const u = 1 - t;
      const uu = u * u, uuu = uu * u;
      const tt = t * t, ttt = tt * t;
      const x = uuu * p0x + 3 * uu * t * c1x + 3 * u * tt * c2x + ttt * p1x;
      const y = uuu * p0y + 3 * uu * t * c1y + 3 * u * tt * c2y + ttt * p1y;
      appendToSubPath(x, y);
    }
  };

  // Find a point that is GUARANTEED to lie strictly inside a simple
  // closed ring AND is close to the ring's boundary (not at its
  // geometric centre). Used by `emitFills` as the containment probe
  // for sub-path nesting resolution.
  //
  // Why not the vertex-average centroid OR the scanline-midpoint?
  // Both can land inside a SIBLING ring that happens to sit at this
  // ring's geometric centre — the textbook case is the outline of
  // an "o" glyph, whose centre coincides exactly with its inner
  // counter. PNPOLY then reports "outer ring is inside counter",
  // depth resolution flips, the letter drops out.
  //
  // Algorithm: scan-line the ring at a non-round bbox Y fraction
  // (so vertex coincidences are statistically negligible), sort
  // the X crossings, and take a point a tiny inset from the
  // leftmost crossing. That point lies strictly inside the ring
  // (anywhere in `(xs[0], xs[1])` is interior for a simple polygon)
  // but well away from any sibling ring that occupies the centre.
  const findInsidePoint = (ring: number[]): [number, number] => {
    const n = ring.length / 2;
    if (n < 3) return [ring[0], ring[1]];
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = ring[i * 2 + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const y = minY + (maxY - minY) * 0.5731;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = ring[i * 2],     y0 = ring[i * 2 + 1];
      const j = (i + 1) % n;
      const x1 = ring[j * 2],     y1 = ring[j * 2 + 1];
      if ((y0 > y) !== (y1 > y)) {
        const t = (y - y0) / (y1 - y0);
        xs.push(x0 + t * (x1 - x0));
      }
    }
    if (xs.length >= 2) {
      xs.sort((a, b) => a - b);
      // Step 0.1% of the first-pair span inward from the leftmost
      // crossing. This keeps the probe near the ring boundary —
      // critical for glyph outlines whose geometric centre is
      // claimed by an inner counter (the "o"/"p" failure mode).
      const inset = (xs[1] - xs[0]) * 0.001;
      return [xs[0] + inset, y];
    }
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += ring[i * 2]; cy += ring[i * 2 + 1]; }
    return [cx / n, cy / n];
  };

  // Crossing-number ray-cast point-in-polygon test on a flat
  // [x0,y0,x1,y1,…] ring. Used by `emitFills` to resolve sub-path
  // containment for compound fills.
  const pointInRing = (px: number, py: number, ring: number[]): boolean => {
    let inside = false;
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[i * 2],     yi = ring[i * 2 + 1];
      const xj = ring[j * 2],     yj = ring[j * 2 + 1];
      const crosses =
        ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (crosses) inside = !inside;
    }
    return inside;
  };

  // Tessellate `flatVerts` with optional `holeIndices` (earcut's
  // hole-rings spec — each entry is a vertex index where a hole
  // sub-ring starts) and append the resulting triangles to the
  // emission list. Degenerate paths (collinear / zero-area) are
  // skipped silently rather than crashing the whole load.
  const tessellate = (
    flatVerts: number[],
    holeIndices: number[] | undefined,
    color: [number, number, number],
  ): void => {
    let tris: number[];
    try {
      tris = earcut(flatVerts, holeIndices);
    } catch {
      return;
    }
    for (let t = 0; t < tris.length; t += 3) {
      const i0 = tris[t]     * 2;
      const i1 = tris[t + 1] * 2;
      const i2 = tris[t + 2] * 2;
      triangles.push({
        pts: [
          flatVerts[i0], flatVerts[i0 + 1],
          flatVerts[i1], flatVerts[i1 + 1],
          flatVerts[i2], flatVerts[i2 + 1],
        ],
        color: [color[0], color[1], color[2]],
      });
    }
  };

  const emitFills = (): void => {
    if (currentPath.length === 0) return;
    const top = stack[stack.length - 1];
    const ctm = top.ctm;
    const a = ctm[0], b = ctm[1], c = ctm[2], d = ctm[3], e = ctm[4], f = ctm[5];
    const color: [number, number, number] = [
      top.fillColor[0], top.fillColor[1], top.fillColor[2],
    ];

    // Filter sub-paths to those with >=3 vertices (need for a tri).
    // PDF spec: open subpaths are implicitly closed for filling, so we
    // don't require closed[i].
    const usable: number[][] = [];
    for (const verts of currentPath) {
      if (verts.length / 2 >= 3) usable.push(verts);
    }
    if (usable.length === 0) return;

    // Single sub-path — no hole/separation ambiguity. Tessellate it
    // directly, ignoring the multiSubpathFills strategy.
    if (usable.length === 1) {
      const verts = usable[0];
      const flat = new Array<number>(verts.length);
      for (let v = 0; v < verts.length; v += 2) {
        flat[v]     = a * verts[v] + c * verts[v + 1] + e;
        flat[v + 1] = b * verts[v] + d * verts[v + 1] + f;
      }
      tessellate(flat, undefined, color);
      return;
    }

    // Multi-subpath path. PDF compound fills are most commonly an
    // outer ring + one or more holes (room outline with column
    // cutout, donut symbol, wall poché with door opening); the
    // legacy "tessellate each sub-path standalone" path produced
    // solid black blobs because the inner ring was drawn on top of
    // the outer instead of carving it out. The "holes" strategy
    // fixes this by passing the inner sub-paths as earcut hole
    // indices. "separate" preserves the legacy behaviour (correct
    // for multi-disjoint-shape fills, wrong for shapes with holes);
    // "skip" drops the fill entirely.

    if (multiSubpathFills === "skip") return;

    if (multiSubpathFills === "separate") {
      for (const verts of usable) {
        const flat = new Array<number>(verts.length);
        for (let v = 0; v < verts.length; v += 2) {
          flat[v]     = a * verts[v] + c * verts[v + 1] + e;
          flat[v + 1] = b * verts[v] + d * verts[v + 1] + f;
        }
        tessellate(flat, undefined, color);
      }
      return;
    }

    // multiSubpathFills === "holes" — resolve sub-path topology by
    // containment. Glyph outlines (Matterport logo "e" / "p" etc.)
    // and complex symbols often put the inner counter before the
    // outer outline in path order, or interleave multiple letter
    // outlines + counters in one fill op. A naive "first is outer,
    // rest are holes" pass inverts those.
    //
    // Algorithm: for each sub-path, find which other sub-paths
    // contain its centroid. `depth` is the number of containing
    // sub-paths; `parent` is the smallest of them.
    //   even depth → filled region (outer ring of its nesting level)
    //   odd  depth → hole of its parent
    // Each filled region (depth 0, 2, 4, …) is tessellated as one
    // earcut call with its direct (depth-+1) children as holes.
    // Even-odd / non-zero winding semantics are not distinguished
    // here; PDFs that rely on non-zero winding to fill same-wound
    // nested rings as solid blobs (unusual) need
    // `multiSubpathFills: "separate"`.

    const N = usable.length;
    // Use a point GUARANTEED to lie strictly inside each ring as the
    // containment probe. Vertex-average centroids fail for non-convex
    // rings like glyph outlines (the average lands inside the
    // counter, not inside the donut strip), which cascades into
    // every-ring-is-a-hole-of-every-other classifications and
    // letters vanishing wholesale.
    const probes = new Array<[number, number]>(N);
    for (let i = 0; i < N; i++) probes[i] = findInsidePoint(usable[i]);
    // |signed area| as a containment tie-breaker — smaller area is a
    // tighter (more immediate) container when multiple sub-paths
    // contain the same centroid.
    const areas = new Array<number>(N);
    for (let i = 0; i < N; i++) {
      const v = usable[i];
      let s = 0;
      const n = v.length / 2;
      for (let k = 0, j = n - 1; k < n; j = k++) {
        s += v[j * 2] * v[k * 2 + 1] - v[k * 2] * v[j * 2 + 1];
      }
      areas[i] = Math.abs(s) * 0.5;
    }

    const depth = new Array<number>(N).fill(0);
    const parent = new Array<number>(N).fill(-1);
    for (let i = 0; i < N; i++) {
      let parentArea = Infinity;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        if (pointInRing(probes[i][0], probes[i][1], usable[j])) {
          depth[i]++;
          if (areas[j] < parentArea) {
            parentArea = areas[j];
            parent[i] = j;
          }
        }
      }
    }

    // Group: each even-depth sub-path is an outer ring; its direct
    // odd-depth children are its holes. Sub-paths with depth ≥ 2
    // (an "island within a hole") become their own outer rings.
    const groupHoles = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
      if ((depth[i] & 1) === 0) groupHoles.set(i, []);
    }
    for (let i = 0; i < N; i++) {
      if ((depth[i] & 1) === 1 && parent[i] !== -1 && groupHoles.has(parent[i])) {
        groupHoles.get(parent[i])!.push(i);
      }
    }

    for (const [outerIdx, holeIdxs] of groupHoles) {
      const subs = [usable[outerIdx], ...holeIdxs.map((h) => usable[h])];
      let totalVerts = 0;
      for (const sv of subs) totalVerts += sv.length / 2;
      const flat = new Array<number>(totalVerts * 2);
      const holeIndices: number[] = [];
      let writeOffset = 0;
      let vertexCursor = 0;
      for (let s = 0; s < subs.length; s++) {
        if (s > 0) holeIndices.push(vertexCursor);
        const verts = subs[s];
        for (let v = 0; v < verts.length; v += 2) {
          flat[writeOffset++] = a * verts[v] + c * verts[v + 1] + e;
          flat[writeOffset++] = b * verts[v] + d * verts[v + 1] + f;
          vertexCursor++;
        }
      }
      tessellate(flat, holeIndices.length ? holeIndices : undefined, color);
    }
  };

  const emitPath = (): void => {
    if (currentPath.length === 0) return;
    const top = stack[stack.length - 1];
    const ctm = top.ctm;
    const a = ctm[0], b = ctm[1], c = ctm[2], d = ctm[3], e = ctm[4], f = ctm[5];
    const color: [number, number, number] = [
      top.strokeColor[0], top.strokeColor[1], top.strokeColor[2],
    ];
    // PDF spec: "the line width shall be a number expressed in
    // user space units." A 6-unit width under a 0.12 cm CTM is
    // 0.72 page-space points, not 6. Use sqrt(|det|) as the
    // effective uniform scale — exact for uniform scale + rotation,
    // an OK average for skews (rare in CAD drawings).
    const ctmScale = Math.sqrt(Math.abs(a * d - b * c)) || 1;
    const lineWidth = top.lineWidth * ctmScale;
    // Dash entries are also in user space — scale them by the same
    // factor so the dash-to-lineWidth *ratio* (which bucketing reads
    // to derive `linePattern`) stays CTM-invariant. One allocation
    // per emit, shared by reference across every segment emitted in
    // this call — matches the dashArray-sharing pattern.
    const dashArray: ReadonlyArray<number> = top.dashArray.length === 0
      ? top.dashArray
      : top.dashArray.map((v) => v * ctmScale);
    for (let pIdx = 0; pIdx < currentPath.length; pIdx++) {
      const verts = currentPath[pIdx];
      const isClosed = closed[pIdx];
      const n = verts.length / 2;
      if (n < 2) continue;
      // Transform once into user-space-after-CTM and append segments.
      let prevX = a * verts[0] + c * verts[1] + e;
      let prevY = b * verts[0] + d * verts[1] + f;
      for (let v = 1; v < n; v++) {
        const x = a * verts[v * 2] + c * verts[v * 2 + 1] + e;
        const y = b * verts[v * 2] + d * verts[v * 2 + 1] + f;
        segments.push({pts: [prevX, prevY, x, y], color, lineWidth, dashArray});
        prevX = x;
        prevY = y;
      }
      if (isClosed) {
        const x0 = a * verts[0] + c * verts[1] + e;
        const y0 = b * verts[0] + d * verts[1] + f;
        segments.push({pts: [prevX, prevY, x0, y0], color, lineWidth, dashArray});
      }
    }
    currentPath = [];
    closed = [];
    hasCurrentPoint = false;
  };

  const fn = opList.fnArray;
  const args = opList.argsArray;
  for (let i = 0; i < fn.length; i++) {
    const op = fn[i];

    if (op === OPS.save) {
      const top = stack[stack.length - 1];
      stack.push({
        ctm: [top.ctm[0], top.ctm[1], top.ctm[2], top.ctm[3], top.ctm[4], top.ctm[5]],
        strokeColor: [top.strokeColor[0], top.strokeColor[1], top.strokeColor[2]],
        fillColor:   [top.fillColor[0],   top.fillColor[1],   top.fillColor[2]],
        lineWidth: top.lineWidth,
        // Reference-share the dash array across save/restore — it's
        // immutable from the consumer's POV; `setDash` swaps in a
        // fresh array rather than mutating the existing one.
        dashArray: top.dashArray,
      });
      continue;
    }
    if (op === OPS.restore) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (op === OPS.transform) {
      // PDF `cm` op: new CTM = M × old CTM (M premultiplied).
      const m = args[i] as [number, number, number, number, number, number];
      const top = stack[stack.length - 1];
      const o = top.ctm;
      const a1 = m[0], b1 = m[1], c1 = m[2], d1 = m[3], e1 = m[4], f1 = m[5];
      const a2 = o[0], b2 = o[1], c2 = o[2], d2 = o[3], e2 = o[4], f2 = o[5];
      top.ctm = [
        a1 * a2 + b1 * c2,
        a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2,
        c1 * b2 + d1 * d2,
        e1 * a2 + f1 * c2 + e2,
        e1 * b2 + f1 * d2 + f2,
      ];
      continue;
    }
    if (op === OPS.setStrokeRGBColor) {
      // args = [r, g, b]. pdf.js 4.x normalises to 0..1; older versions
      // give 0..255. Detect via "any value > 1 → treat as 0..255".
      const a = args[i] as [number, number, number];
      const max = Math.max(a[0], a[1], a[2]);
      const div = max > 1 ? 255 : 1;
      stack[stack.length - 1].strokeColor = [a[0] / div, a[1] / div, a[2] / div];
      continue;
    }
    if (op === OPS.setStrokeGray) {
      const a = args[i] as [number];
      const g = a[0] > 1 ? a[0] / 255 : a[0];
      stack[stack.length - 1].strokeColor = [g, g, g];
      continue;
    }
    if (op === OPS.setLineWidth) {
      const a = args[i] as [number];
      // PDF spec: a width of 0 means "thinnest device-renderable line".
      // Map that to the SceneMaterial.lineWidth `0` sentinel by leaving
      // a small positive value; the loader's `minLineWidth` clamp later
      // ensures something visible is drawn.
      stack[stack.length - 1].lineWidth = a[0] > 0 ? a[0] : 0.1;
      continue;
    }
    if (op === OPS.setDash) {
      // PDF `d` op: args = [dashArray, dashPhase]. We honour the array
      // and ignore the phase (SceneMaterial.linePattern has no phase
      // control — patterns always restart at each segment).
      const a = args[i] as [ReadonlyArray<number>, number];
      const arr = a[0];
      // Reference-fresh copy so later setDash calls swap (not mutate)
      // the reference seen by already-tagged segments. Empty array
      // means "solid", per PDF spec.
      stack[stack.length - 1].dashArray = arr && arr.length > 0
        ? Array.from(arr)
        : [];
      continue;
    }
    if (op === OPS.setFillRGBColor) {
      const a = args[i] as [number, number, number];
      const max = Math.max(a[0], a[1], a[2]);
      const div = max > 1 ? 255 : 1;
      stack[stack.length - 1].fillColor = [a[0] / div, a[1] / div, a[2] / div];
      continue;
    }
    if (op === OPS.setFillGray) {
      const a = args[i] as [number];
      const g = a[0] > 1 ? a[0] / 255 : a[0];
      stack[stack.length - 1].fillColor = [g, g, g];
      continue;
    }
    if (op === OPS.setFillCMYKColor) {
      // PDF CMYK: each in 0..1 (sometimes 0..255). Convert to RGB via
      // the standard non-ICC formula:
      //   R = (1 − C)(1 − K),  G = (1 − M)(1 − K),  B = (1 − Y)(1 − K)
      const a = args[i] as [number, number, number, number];
      const div = Math.max(a[0], a[1], a[2], a[3]) > 1 ? 255 : 1;
      const c = a[0] / div, mC = a[1] / div, y = a[2] / div, k = a[3] / div;
      const km = 1 - k;
      stack[stack.length - 1].fillColor = [
        (1 - c) * km,
        (1 - mC) * km,
        (1 - y) * km,
      ];
      continue;
    }

    if (op === OPS.rectangle) {
      const r = args[i] as [number, number, number, number]; // [x, y, w, h]
      const x = r[0], y = r[1], w = r[2], h = r[3];
      currentPath.push([x, y, x + w, y, x + w, y + h, x, y + h]);
      closed.push(true);
      subX = x;
      subY = y;
      hasCurrentPoint = true;
      continue;
    }

    if (op === OPS.constructPath) {
      // args[i] = [subOps: number[], coords: number[], minMax?]
      const ca = args[i] as [number[], number[], any?];
      const subOps = ca[0];
      const coords = ca[1];
      let ci = 0;
      for (let so = 0; so < subOps.length; so++) {
        const sub = subOps[so];
        if (sub === OPS.moveTo) {
          const x = coords[ci++], y = coords[ci++];
          startSubPath(x, y);
        } else if (sub === OPS.lineTo) {
          const x = coords[ci++], y = coords[ci++];
          appendToSubPath(x, y);
        } else if (sub === OPS.curveTo) {
          const c1x = coords[ci++], c1y = coords[ci++];
          const c2x = coords[ci++], c2y = coords[ci++];
          const x   = coords[ci++], y   = coords[ci++];
          tessellateCubic(subX, subY, c1x, c1y, c2x, c2y, x, y);
        } else if (sub === OPS.curveTo2) {
          // "v": cp1 = current point.
          const c2x = coords[ci++], c2y = coords[ci++];
          const x   = coords[ci++], y   = coords[ci++];
          tessellateCubic(subX, subY, subX, subY, c2x, c2y, x, y);
        } else if (sub === OPS.curveTo3) {
          // "y": cp2 = end point.
          const c1x = coords[ci++], c1y = coords[ci++];
          const x   = coords[ci++], y   = coords[ci++];
          tessellateCubic(subX, subY, c1x, c1y, x, y, x, y);
        } else if (sub === OPS.closePath) {
          const ci_last = currentPath.length - 1;
          if (ci_last >= 0) closed[ci_last] = true;
        } else if (sub === OPS.rectangle) {
          const x = coords[ci++], y = coords[ci++];
          const w = coords[ci++], h = coords[ci++];
          currentPath.push([x, y, x + w, y, x + w, y + h, x, y + h]);
          closed.push(true);
          subX = x;
          subY = y;
          hasCurrentPoint = true;
        }
      }
      continue;
    }

    // ── Paint ops ─────────────────────────────────────────────
    // Categorise the current op against PDF's paint matrix:
    //   stroke-only:  S, s
    //   fill-only:    f, F, f* (eoFill)
    //   fill+stroke:  B, B*, b, b*
    //   discard:      n (endPath)
    // The `close-` prefixed variants (s, b, b*) implicitly close the
    // last sub-path before painting; mark it closed once and the
    // emission helpers see a clean polygon.
    const isCloseVariant =
      op === OPS.closeStroke ||
      op === OPS.closeFillStroke ||
      op === OPS.closeEOFillStroke;
    const wantsStroke =
      op === OPS.stroke ||
      op === OPS.closeStroke ||
      op === OPS.fillStroke ||
      op === OPS.eoFillStroke ||
      op === OPS.closeFillStroke ||
      op === OPS.closeEOFillStroke;
    const wantsFill = renderFills && (
      op === OPS.fill ||
      op === OPS.eoFill ||
      op === OPS.fillStroke ||
      op === OPS.eoFillStroke ||
      op === OPS.closeFillStroke ||
      op === OPS.closeEOFillStroke
    );

    if (wantsStroke || wantsFill) {
      if (isCloseVariant) {
        const last = currentPath.length - 1;
        if (last >= 0) closed[last] = true;
      }
      if (wantsFill) emitFills();
      if (wantsStroke) emitPath();
      currentPath = [];
      closed = [];
      hasCurrentPoint = false;
      continue;
    }

    if (op === OPS.fill || op === OPS.eoFill || op === OPS.endPath) {
      // Fill ops with `renderFills: false`, or `endPath`'s
      // "drop without painting" — discard the path.
      currentPath = [];
      closed = [];
      hasCurrentPoint = false;
      continue;
    }

    if (renderImages) {
      const top = stack[stack.length - 1];
      const ctmCopy: ImageEmission["ctm"] = [
        top.ctm[0], top.ctm[1], top.ctm[2], top.ctm[3], top.ctm[4], top.ctm[5],
      ];
      const fillCopy: [number, number, number] = [
        top.fillColor[0], top.fillColor[1], top.fillColor[2],
      ];

      // paintImageXObject + paintJpegXObject + paintImageMaskXObject:
      // args[0] is the pdf.js object id; pixel data lives behind
      // `page.objs.get(objId)`.
      if (
        op === OPS.paintImageXObject ||
        op === OPS.paintJpegXObject ||
        op === OPS.paintImageMaskXObject
      ) {
        const a = args[i];
        const objId = Array.isArray(a) ? a[0] : a;
        if (typeof objId === "string") {
          images.push({
            source: {kind: "ref", objId},
            ctm: ctmCopy,
            isMask: op === OPS.paintImageMaskXObject,
            fillColor: fillCopy,
          });
        }
        continue;
      }

      // paintInlineImageXObject: args[0] is the resolved image object
      // directly (pdf.js inlines BI/EI content into the operator
      // stream instead of going through `page.objs`).
      if (op === OPS.paintInlineImageXObject) {
        const a = args[i];
        const obj = Array.isArray(a) ? a[0] : a;
        if (obj && typeof obj === "object") {
          images.push({
            source: {kind: "inline", obj: obj as PDFImageObjectLike},
            ctm: ctmCopy,
            isMask: false,
            fillColor: fillCopy,
          });
        }
        continue;
      }
    }

    // Every other op (font, line dash, text positioning, …) is
    // intentionally skipped — the v2 loader emits strokes, fills,
    // and raster image XObjects.
  }

  return {segments, triangles, images};
}


// ─────────────────────────────────────────────────────────────────
// Style bucketing.
// ─────────────────────────────────────────────────────────────────

interface StyleBucket {
  color: [number, number, number];
  /** Pixel line width passed to SceneMaterial.lineWidth (post-scale, post-clamp). */
  lineWidth: number;
  /**
   * Dash multipliers in SceneMaterial line-width units (PDF dash entry
   * divided by PDF line width, since dashes in PDF are in points and
   * SceneMaterial's pattern is relative to its own lineWidth). Empty
   * array = solid line. Clamped to {@link MAX_LINE_PATTERN_ENTRIES}.
   */
  linePattern: number[];
  segments: Array<[number, number, number, number]>;
}

/**
 * Cap on `SceneMaterial.linePattern` entries — mirrors the SDK's
 * `MAX_LINE_PATTERN_ENTRIES` (8). Inlined to avoid importing the
 * model layer just for one constant.
 */
const MAX_LINE_PATTERN_ENTRIES = 8;

/**
 * Groups segments by `(colour, lineWidth, dashPattern)`. Returns one
 * bucket per unique style, each carrying the segments that came in
 * with that style. PDF stroke widths are converted from user-space
 * points into pixel widths via `widthScale`, then floored at
 * `minPxWidth` so sub-pixel hairlines stay visible after rasterisation.
 *
 * PDF dash arrays are in user-space points; SceneMaterial's
 * `linePattern` is in line-width units. Conversion is `dashEntry /
 * pdfLineWidth` — the ratio of dash size to line width, which the
 * renderer multiplies back by its own pixel width when drawing.
 *
 * When `overrideColor` is supplied, every segment lands with that
 * colour (line-width + dash buckets still split, so weight hierarchy
 * and dash discipline survive the colour flatten).
 */
function bucketSegmentsByStyle(
  segments: StyledSegment[],
  overrideColor: [number, number, number] | undefined,
  widthScale: number,
  minPxWidth: number,
): Map<string, StyleBucket> {

  const out = new Map<string, StyleBucket>();

  for (const seg of segments) {
    const color = overrideColor ?? seg.color;
    const pxWidth = Math.max(minPxWidth, seg.lineWidth * widthScale);

    // Convert dash entries from PDF points → line-width units. The
    // PDF line width (not the post-clamp pixel width) is the natural
    // divisor — preserves the dash-to-width ratio PDF authors wrote.
    const pdfWidth = seg.lineWidth > 0 ? seg.lineWidth : 1;
    const linePattern: number[] = [];
    for (let k = 0; k < seg.dashArray.length && k < MAX_LINE_PATTERN_ENTRIES; k++) {
      linePattern.push(seg.dashArray[k] / pdfWidth);
    }

    // Quantise to keep bucket count bounded — 8-bit colour channels,
    // 2-decimal widths, 2-decimal dash multipliers.
    const cr = Math.round(color[0] * 255);
    const cg = Math.round(color[1] * 255);
    const cb = Math.round(color[2] * 255);
    const wq = Math.round(pxWidth * 100);
    const dq = linePattern.length === 0
      ? "s"
      : linePattern.map((v) => Math.round(v * 100)).join("/");
    const key = `${cr},${cg},${cb},${wq},${dq}`;

    let bucket = out.get(key);
    if (!bucket) {
      bucket = {
        color: [cr / 255, cg / 255, cb / 255],
        lineWidth: wq / 100,
        linePattern: linePattern.map((v) => Math.round(v * 100) / 100),
        segments: [],
      };
      out.set(key, bucket);
    }
    bucket.segments.push(seg.pts);
  }

  return out;
}


interface TriangleBucket {
  color: [number, number, number];
  triangles: Array<[number, number, number, number, number, number]>;
}

/**
 * Same bucket-by-style pattern as {@link bucketSegmentsByStyle},
 * but keyed only on fill colour — fills don't carry a per-region
 * line width. `overrideColor` collapses every triangle into one
 * bucket if the caller wants "single ink" output.
 */
function bucketTrianglesByColor(
  tris: StyledTriangle[],
  overrideColor: [number, number, number] | undefined,
): Map<string, TriangleBucket> {

  const out = new Map<string, TriangleBucket>();
  for (const t of tris) {
    const color = overrideColor ?? t.color;
    const cr = Math.round(color[0] * 255);
    const cg = Math.round(color[1] * 255);
    const cb = Math.round(color[2] * 255);
    const key = `${cr},${cg},${cb}`;
    let bucket = out.get(key);
    if (!bucket) {
      bucket = {color: [cr / 255, cg / 255, cb / 255], triangles: []};
      out.set(key, bucket);
    }
    bucket.triangles.push(t.pts);
  }
  return out;
}


// ─────────────────────────────────────────────────────────────────
// Image-data normalisation.
// ─────────────────────────────────────────────────────────────────

/** Shape we hand to {@link SceneModel.createTexture}. */
type NormalisedImage =
  | {bitmap: ImageBitmap; data?: undefined; width?: undefined; height?: undefined}
  | {bitmap?: undefined; data: Uint8ClampedArray; width: number; height: number};

/**
 * Coerces whatever pdf.js placed in `page.objs` for a given image
 * id into one of the two shapes the SceneModel texture path
 * accepts. Returns `undefined` for unsupported kinds (1-bit masks,
 * paletted images, anything missing dimensions or buffers).
 *
 * pdf.js's `ImageKind` is small:
 *   - 1 = GRAYSCALE_1BPP  (packed mask bits — skipped)
 *   - 2 = RGB_24BPP       (3 bytes per pixel; expanded to RGBA below)
 *   - 3 = RGBA_32BPP      (already RGBA; copied through)
 *
 * Newer pdf.js paths sometimes pre-decode into an `ImageBitmap`;
 * when that shape is present we use it verbatim.
 */
function resolveImage(obj: PDFImageObjectLike | undefined): NormalisedImage | null {
  if (!obj) return null;
  if (obj.bitmap) return {bitmap: obj.bitmap};

  const data = obj.data, w = obj.width, h = obj.height;
  if (!data || !w || !h) return null;

  // kind === 3 means already RGBA — wrap (don't copy if we can avoid).
  if (obj.kind === 3) {
    return {
      data: data instanceof Uint8ClampedArray
        ? data
        : new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      width: w,
      height: h,
    };
  }

  // kind === 2 means RGB triplets — expand to RGBA inline.
  if (obj.kind === 2 || (data.length === w * h * 3)) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
      out[q + 0] = data[p + 0];
      out[q + 1] = data[p + 1];
      out[q + 2] = data[p + 2];
      out[q + 3] = 255;
    }
    return {data: out, width: w, height: h};
  }

  // RGBA buffer with non-3 kind (some pdf.js versions encode JPEGs
  // pre-decoded as 4-byte RGBA without setting kind=3 explicitly).
  if (data.length === w * h * 4) {
    return {
      data: data instanceof Uint8ClampedArray
        ? data
        : new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      width: w,
      height: h,
    };
  }

  // Unknown / unsupported kind (1-bit masks, JBIG2, paletted, etc.) —
  // skip rather than emit garbage.
  return null;
}


/**
 * Coerces a pdf.js 1-bit mask object into an RGBA buffer tinted with
 * `fillColor` — opaque pixels paint the fill colour, transparent ones
 * are alpha=0 so what's behind shows through.
 *
 * PDF spec 8.9.6.4: "Sample values in [a mask] image data shall be
 * interpreted as follows: 0 shall mark the page with the current
 * colour; 1 shall leave the previous contents unchanged." So bit `0`
 * = opaque, bit `1` = transparent. pdf.js doesn't invert these — the
 * raw `data` we get already follows the spec.
 *
 * Masks come in two pdf.js shapes:
 *  - `kind === 1` (GRAYSCALE_1BPP) — bits packed MSB-first per row,
 *    rows aligned to bytes. This is the standard PDF mask form.
 *  - `bitmap` (ImageBitmap) — pdf.js sometimes pre-renders masks to
 *    an alpha bitmap. Not handled here yet (the fill-colour tint
 *    isn't trivially derivable from an opaque ImageBitmap); fall
 *    back to skipping these for now.
 */
function resolveImageMask(
  obj: PDFImageObjectLike | undefined,
  fillColor: [number, number, number],
): NormalisedImage | null {

  if (!obj || !obj.data || !obj.width || !obj.height) return null;

  // GRAYSCALE_1BPP: each row has ceil(w / 8) bytes, MSB-first.
  // Generally `obj.kind === 1` but be defensive — some pdf.js paths
  // skip setting kind on mask objects.
  const w = obj.width, h = obj.height;
  const data = obj.data;
  const bytesPerRow = (w + 7) >> 3;
  if (data.length < bytesPerRow * h) return null;       // truncated mask

  const fr = Math.round(fillColor[0] * 255);
  const fg = Math.round(fillColor[1] * 255);
  const fb = Math.round(fillColor[2] * 255);

  const out = new Uint8ClampedArray(w * h * 4);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const rowOff = y * bytesPerRow;
    for (let x = 0; x < w; x++) {
      const byte = data[rowOff + (x >> 3)];
      const bit = (byte >> (7 - (x & 7))) & 1;
      // PDF spec: 0 = opaque (paint with fillColor), 1 = transparent.
      if (bit === 0) {
        out[o    ] = fr;
        out[o + 1] = fg;
        out[o + 2] = fb;
        out[o + 3] = 255;
      } else {
        out[o + 3] = 0;
      }
      o += 4;
    }
  }
  return {data: out, width: w, height: h};
}


// ─────────────────────────────────────────────────────────────────
// Text atlas — pack many labels into one shared OffscreenCanvas.
// ─────────────────────────────────────────────────────────────────

/**
 * Item shape `packTextAtlas` + `rasterizeTextAtlas` consume. `pxW`
 * and `pxH` are the canvas-pixel dimensions reserved for the label;
 * `atlasX` / `atlasY` are filled in by `packTextAtlas`.
 */
interface AtlasItem {
  item: PDFTextItem;
  fontSize: number;
  pxW: number;
  pxH: number;
  atlasX: number;
  atlasY: number;
}

/** Maximum atlas width in pixels — above this we wrap to a new row. */
const ATLAS_MAX_WIDTH = 2048;

/**
 * Shelf-pack `items` into an atlas no wider than {@link ATLAS_MAX_WIDTH}.
 * Sorts tallest-first so each row's height is dominated by its
 * tallest occupant — wastes minimal vertical space. Mutates each
 * item's `atlasX` / `atlasY` with its assigned position. Returns
 * the overall atlas dimensions.
 *
 * Big-O `O(N log N)` from the sort + `O(N)` packing. Plenty fast for
 * the typical AECO sheet's hundreds-to-low-thousands of labels.
 */
function packTextAtlas(items: AtlasItem[]): {width: number; height: number} {
  // Sort tallest-first into a working copy so we don't disturb the
  // caller's positional order (which the emission loop relies on).
  const sorted = items.slice().sort((a, b) => b.pxH - a.pxH);
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;
  let atlasW = 0;
  let atlasH = 0;
  for (const it of sorted) {
    if (cursorX > 0 && cursorX + it.pxW > ATLAS_MAX_WIDTH) {
      // Doesn't fit on the current row — wrap.
      cursorY += rowH;
      cursorX = 0;
      rowH = 0;
    }
    it.atlasX = cursorX;
    it.atlasY = cursorY;
    cursorX += it.pxW;
    if (it.pxH > rowH) rowH = it.pxH;
    if (cursorX > atlasW) atlasW = cursorX;
    if (cursorY + rowH > atlasH) atlasH = cursorY + rowH;
  }
  // Atlas must be at least 1×1 (an empty atlas would refuse texture
  // upload). Caller already filters on `items.length > 0` so this
  // floor is defensive only.
  return {width: Math.max(1, atlasW), height: Math.max(1, atlasH)};
}

/**
 * Rasterises every `AtlasItem`'s text into a shared OffscreenCanvas
 * sized `atlasW × atlasH`. Items must already have valid `atlasX` /
 * `atlasY` (set by {@link packTextAtlas}).
 *
 * Returns `null` when the environment lacks `OffscreenCanvas` — the
 * loader logs and skips the page's text rather than crashing.
 */
function rasterizeTextAtlas(
  items: AtlasItem[],
  atlasW: number,
  atlasH: number,
  pxPerUnit: number,
  fontFace: string,
  color: [number, number, number],
): OffscreenCanvas | null {
  if (typeof OffscreenCanvas === "undefined") return null;

  let canvas: OffscreenCanvas;
  try {
    canvas = new OffscreenCanvas(atlasW, atlasH);
  } catch {
    return null;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background stays transparent (default) so the BLEND material can
  // composite over fills + strokes.
  const fillCss =
    `rgb(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)})`;
  ctx.fillStyle = fillCss;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  for (const t of items) {
    const fontPx = Math.max(1, t.fontSize * pxPerUnit);
    ctx.font = `${fontPx}px ${fontFace}`;
    // Baseline sits `ascent` pixels below the row's top — matches the
    // emission code's `ascent / (ascent + descent) = 0.8 / 1.2` UV
    // split so glyphs land where the quad expects them.
    const ascentPx = t.fontSize * pxPerUnit;
    ctx.fillText(t.item.str, t.atlasX, t.atlasY + ascentPx);
  }

  return canvas;
}


// ─────────────────────────────────────────────────────────────────
// Multi-page layout strategies.
// ─────────────────────────────────────────────────────────────────

/**
 * Returns the world-space `[x, y, z]` origin where page `index`
 * should sit, given its dimensions and the active layout strategy.
 *
 * The grid layout uses the *first page's* width/height as the cell
 * size — uniform AECO sheet sets pack tightly; mixed-size sets get
 * a bit of dead space between cells. Documented limitation; an
 * adaptive grid would need a two-pass measure of every page first.
 */
function computePageOffset(
  index: number,
  firstPageWidth: number,
  firstPageHeight: number,
  layout: "row" | "column" | "grid" | "stack",
  gridColumns: number,
  gap: number,
  // Accumulators for mixed-size docs: cumulative width / height of
  // all previously-laid-out pages PLUS the inter-page gap, so
  // sheets pack exactly without overlap regardless of orientation.
  rowAccumX: number,
  columnAccumY: number,
): [number, number, number] {
  switch (layout) {
    case "row":    return [rowAccumX,    0,            0];
    case "column": return [0,            columnAccumY, 0];
    case "grid": {
      // Cell size is seeded by the FIRST page (documented limitation —
      // an adaptive grid would need a two-pass measure of every page
      // first). Uniform AECO sheet sets pack tightly; mixed-size sets
      // get dead space between cells.
      const cols = Math.max(1, gridColumns | 0);
      const col = index % cols;
      const row = Math.floor(index / cols);
      return [
        col * (firstPageWidth  + gap),
        row * (firstPageHeight + gap),
        0,
      ];
    }
    case "stack": return [0, 0, index * gap];
    default:      return [rowAccumX, 0, 0];
  }
}
