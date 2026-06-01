import {type PickParams, PickResult} from "../../../viewer";
import {SDKInternalException, type SDKResult} from "../../../../base/core";
import {createMat4Float64, inverseMat4, type Mat4, transformVec4} from "../../../../base/math/matrix";
import {
  createVec2Float64, createVec3Float64, createVec4Float64,
  type Vec2, type Vec3,
} from "../../../../base/math/vector";
import {ViewRenderState} from "../ViewRenderState";
import {RenderContext} from "../RenderContext";
import {WebGLSnapBufferCache, WebGLSnapBuffer} from "../webGL/WebGLSnapBuffer";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {MeshManager} from "../meshManager/MeshManager";
import {GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import {getDrawOps, DrawOps, putDrawOps} from "../drawOps/DrawOps";
import {RENDER_PASSES} from "../RENDER_PASSES";

const tempVec3a = createVec3Float64();
const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();
const tempMat4a = createMat4Float64();

/**
 * Default snap radius in canvas pixels — matches V2's default. The
 * snap framebuffer is `(2 * radius + 1)²`, so the maximum search
 * region around the cursor is ±30 px.
 */
const DEFAULT_SNAP_RADIUS = 30;


/**
 * Manages snap-to-vertex / snap-to-edge picking inside a
 * {@link WebGLRenderer}.
 *
 * Owned by the {@link ViewManager}; sits alongside
 * {@link PickManager}. Where pick is "what's at this cursor pixel",
 * snap is "what's the nearest snap target within `snapRadius`
 * pixels of the cursor". Both walk the same pickable mesh
 * population — the snap pipeline draws each pickable batch through
 * the snap-init technique (triangles → depth + view-position
 * baseline) and then through one or both snap techniques (vertices
 * as 1-pixel points, edges as `gl.LINES`), all into a small
 * `(2 * radius + 1)²` `RGBA32F` framebuffer.
 *
 * On read-back the manager scans every texel of the buffer for the
 * one closest to the centre (the cursor) and reconstructs world
 * position from view-space via `inverse(viewMatrix) * vec4(view, 1)`.
 * Vertex hits beat edge hits when both are present at the same
 * distance.
 *
 * Simplified first cut compared with V2:
 *   - Single `RGBA32F` MRT (V2 uses `RGBA32I + RGBA32I + RGBA8UI`
 *     with integer coordinate scaling for RTC precision).
 *   - View-space output (V2 emits scaled world position with a
 *     per-layer origin).
 *   - Two read-backs (vertex pass first, then edge pass) instead of
 *     V2's sign-of-W layer trick.
 *
 * @internal
 */
export class SnapManager {

  private readonly _renderContext: RenderContext;
  private readonly _gpuMemoryManager: GPUMemoryManager;
  private readonly _meshBatchManager: MeshManager;
  private _drawOps: DrawOps | null = null;
  private _snapBufferCache: WebGLSnapBufferCache | null = null;

  /** Reused across `snapPick` calls to avoid per-click allocation. */
  private readonly _readback: { buffer: Float32Array<any> | null; dim: number } = {
    buffer: null,
    dim:    0,
  };

  /** Reused snap result — pick-style transient. */
  private readonly _snapResult = new PickResult();

  constructor(cfg: {
    renderContext: RenderContext;
    gpuMemoryManager: GPUMemoryManager;
    meshManager: MeshManager;
  }) {
    this._renderContext     = cfg.renderContext;
    this._gpuMemoryManager  = cfg.gpuMemoryManager;
    this._meshBatchManager  = cfg.meshManager;
  }

  /**
   * Allocates the shared {@link DrawOps} and the per-radius snap
   * buffer cache. Returns `NotSupported` when the WebGL context
   * lacks `EXT_color_buffer_float` (snap can't run without a
   * renderable `RGBA32F` colour attachment).
   */
  init(): SDKResult<void> {
    const drawOpsResult = getDrawOps(this._renderContext, this._gpuMemoryManager as GPUMemoryReader);
    if (drawOpsResult.ok === false) return drawOpsResult;
    this._drawOps = drawOpsResult.value;
    this._snapBufferCache = new WebGLSnapBufferCache(this._renderContext.gl);
    return {ok: true, value: undefined};
  }

  webglContextRestored(): SDKResult<void> {
    if (!this._drawOps || !this._snapBufferCache) return {ok: true, value: undefined};
    const r1 = this._drawOps.webglContextRestored();
    if (r1.ok === false) return r1;
    return this._snapBufferCache.webglContextRestored(this._renderContext.gl);
  }

  /**
   * Run snap-to-vertex / snap-to-edge against the cursor.
   *
   * Caller is responsible for having already activated `rendererView`
   * and rendered at least one frame; this method binds its own
   * snap framebuffer and uses the existing GPU mesh data textures.
   *
   * Returns `null` (with `ok: true`) when nothing was snapped — the
   * caller should fall back to the regular pick result. Returns the
   * shared transient {@link PickResult} when a snap target was hit,
   * with `worldPos`, `snappedToVertex` / `snappedToEdge`, and
   * `snappedCanvasPos` populated; the existing `viewObject` /
   * `sceneObject` from the prior pick (if any) should be merged in
   * by the caller before returning to the user.
   */
  snapPick(rendererView: ViewRenderState, params: PickParams): SDKResult<PickResult | null> {
    if (!this._drawOps || !this._snapBufferCache) {
      throw new SDKInternalException("[SnapManager.snapPick] SnapManager not initialized");
    }
    if (!params.canvasPos) {
      // Snap requires a cursor position — no canvasPos means the
      // caller is doing a ray-pick, which doesn't have a snap concept.
      return {ok: true, value: null};
    }

    const wantVertex = params.snapToVertex !== false;
    const wantEdge   = params.snapToEdge   !== false;
    if (!wantVertex && !wantEdge) {
      return {ok: true, value: null};
    }

    const snapRadius = Math.max(1, (params.snapRadius ?? DEFAULT_SNAP_RADIUS) | 0);
    const dim = 2 * snapRadius + 1;

    const bufRes = this._snapBufferCache.get(snapRadius);
    if (bufRes.ok === false) return bufRes;
    const snapBuffer = bufRes.value;

    const view = rendererView.view;
    const viewIndex = view.viewIndex;
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const meshBatches = this._meshBatchManager.sortedBatches;

    // ── Set up the render context for the snap pipeline ────────
    renderContext.reset();
    renderContext.activeView = view;
    renderContext.rayPicking = false;
    renderContext.backfaces = true;
    renderContext.frontface = true;
    renderContext.pickInvisible = !!params.pickInvisible;
    // Picking near/far still drives the existing pipeline's depth
    // bounds even though our shaders only emit view position.
    renderContext.pickZNear = view.camera.perspectiveProjection.near;
    renderContext.pickZFar  = view.camera.perspectiveProjection.far;

    // Cursor → clip-space NDC for the snap viewport remap. Same
    // formula PickManager uses for its 1×1 case; the snap viewport
    // gives the cursor a (2r+1)² window of pixels around it.
    const resolutionScale = view.resolutionScale;
    renderContext.snapClipPos = createVec2Float64([
      this._clipPosX(params.canvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
      this._clipPosY(params.canvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight),
    ]);
    renderContext.snapBufferSize = createVec2Float64([dim, dim]);

    // ── Bind + clear the snap FBO ──────────────────────────────
    snapBuffer.bind();
    gl.viewport(0, 0, dim, dim);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    snapBuffer.clear();
    gl.lineWidth(1);
    renderContext.lineWidth = 1;

    const trianglePrim = meshBatches.length > 0 ? meshBatches[0].primitive : 0;
    const triOps = this._drawOps.prims[trianglePrim];
    void triOps; // placate TS — we look up per-batch below

    // ── Snap-init pass — triangles populate depth so subsequent
    //    vertex/edge passes z-test against real surface geometry.
    //    Init's fragment shader writes alpha=2.0; the snap passes
    //    write alpha=1.0; the read-back filters on `alpha === 1.0`,
    //    so init's surface texels can't masquerade as vertex/edge
    //    hits without us having to mask out colour writes (some
    //    drivers short-circuit fragments — and their depth-write
    //    side effect — when the colour mask is fully off).
    for (let i = 0, len = meshBatches.length; i < len; i++) {
      const meshBatch = meshBatches[i];
      if (!meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.SNAP_INIT)) continue;
      this._drawOps.prims[meshBatch.primitive]?.snapInit?.drawBatch(meshBatch);
    }

    // ── Vertex snap pass (run first so it gets the priority
    //    layer in the read-back; vertices win over edges on tie).
    let vertexHit: Float32Array<any> | null = null;
    if (wantVertex) {
      gl.depthMask(false);
      for (let i = 0, len = meshBatches.length; i < len; i++) {
        const meshBatch = meshBatches[i];
        if (!meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.SNAP)) continue;
        this._drawOps.prims[meshBatch.primitive]?.snapVertex?.drawBatch(meshBatch);
      }
      gl.depthMask(true);
      vertexHit = this._readNearestHit(snapBuffer, dim, snapRadius);
    }

    // ── Edge snap pass (only run if we don't have a vertex hit
    //    OR we want both — for the simplified first cut, vertex
    //    short-circuits the edge pass to avoid a second read-back).
    //    No inter-pass clear needed: vertexHit === null means the
    //    read-back found zero `alpha === 1.0` texels in the buffer,
    //    so the edge pass starts on a clean slate (init's alpha = 2.0
    //    surface texels are filtered out by the read-back).
    let edgeHit: Float32Array<any> | null = null;
    if (wantEdge && !vertexHit) {
      gl.depthMask(false);
      for (let i = 0, len = meshBatches.length; i < len; i++) {
        const meshBatch = meshBatches[i];
        if (!meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.SNAP)) continue;
        this._drawOps.prims[meshBatch.primitive]?.snapEdge?.drawBatch(meshBatch);
      }
      gl.depthMask(true);
      edgeHit = this._readNearestHit(snapBuffer, dim, snapRadius);
    }

    snapBuffer.unbind();

    const hit = vertexHit ?? edgeHit;
    if (!hit) {
      return {ok: true, value: null};
    }

    // ── Reconstruct world-space snap target ────────────────────
    // The shader emitted view-space position; we left-multiply by
    // the camera's inverse-view to recover world. RTC tile origins
    // are folded into viewMatrix already, so this is precise to
    // float32 — adequate for the simplified first cut.
    const viewMat = view.camera.viewMatrix;
    const invView = inverseMat4(viewMat as Mat4, tempMat4a);
    tempVec4a[0] = hit[0];
    tempVec4a[1] = hit[1];
    tempVec4a[2] = hit[2];
    tempVec4a[3] = 1.0;
    const worldHomog = transformVec4(invView, tempVec4a, tempVec4b);
    const w = worldHomog[3] || 1;
    tempVec3a[0] = worldHomog[0] / w;
    tempVec3a[1] = worldHomog[1] / w;
    tempVec3a[2] = worldHomog[2] / w;

    // ── Project back to canvas to populate snappedCanvasPos ────
    // world → clip = projMatrix * viewMatrix * (worldPos, 1).
    // Result is in CSS pixels (drawing buffer divided by the view's
    // resolution scale), top-left origin — matches the canvasPos
    // coordinates the caller passed in.
    const snappedCanvasPos: Vec2 = createVec2Float64();
    tempVec4a[0] = tempVec3a[0];
    tempVec4a[1] = tempVec3a[1];
    tempVec4a[2] = tempVec3a[2];
    tempVec4a[3] = 1.0;
    const viewHomog = transformVec4(viewMat as Mat4, tempVec4a, tempVec4b);
    const clipHomog = transformVec4(view.camera.projMatrix as Mat4, viewHomog, tempVec4a);
    const wClip = clipHomog[3] || 1;
    const ndcX = clipHomog[0] / wClip;
    const ndcY = clipHomog[1] / wClip;
    const cssWidth  = gl.drawingBufferWidth  / resolutionScale.resolutionScale;
    const cssHeight = gl.drawingBufferHeight / resolutionScale.resolutionScale;
    snappedCanvasPos[0] = (ndcX + 1) * 0.5 * cssWidth;
    snappedCanvasPos[1] = (1 - ndcY) * 0.5 * cssHeight;

    const result = this._snapResult;
    result.reset();
    result.view = view;
    result.canvasPos = params.canvasPos;
    result.worldPos = createVec3Float64([tempVec3a[0], tempVec3a[1], tempVec3a[2]]);
    result.snappedToVertex = vertexHit !== null;
    result.snappedToEdge   = edgeHit   !== null;
    result.snappedCanvasPos = snappedCanvasPos;
    return {ok: true, value: result};
  }

  /**
   * Read back the snap framebuffer and return the `[viewX, viewY,
   * viewZ, _]` slice for the nearest non-empty texel to the centre.
   * `null` when the buffer is entirely empty.
   *
   * Brute-force linear scan — same shape as V2's read-back.
   */
  private _readNearestHit(snapBuffer: WebGLSnapBuffer, dim: number, snapRadius: number): Float32Array<any> | null {
    // (Re-)allocate the readback scratch when the radius changes.
    const len = dim * dim * 4;
    if (!this._readback.buffer || this._readback.dim !== dim) {
      this._readback.buffer = new Float32Array(len);
      this._readback.dim = dim;
    }
    const pixels = snapBuffer.read(this._readback.buffer);

    let bestIndex = -1;
    let bestDist2 = Infinity;
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const idx = (y * dim + x) * 4;
        // alpha = 1.0 → vertex/edge snap hit. alpha = 2.0 → init's
        // surface texel (depth baseline). alpha = 0.0 → cleared /
        // empty. We only care about snap hits.
        if (pixels[idx + 3] !== 1.0) continue;
        const dx = x - snapRadius;
        const dy = y - snapRadius;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist2) {
          bestDist2 = d2;
          bestIndex = idx;
        }
      }
    }
    if (bestIndex < 0) return null;
    return pixels.subarray(bestIndex, bestIndex + 4);
  }

  private _clipPosX(pos: number, size: number): number {
    return 2 * (pos / size) - 1;
  }

  private _clipPosY(pos: number, size: number): number {
    return 1 - 2 * (pos / size);
  }

  destroy(): void {
    if (this._drawOps) {
      putDrawOps(this._drawOps);
      this._drawOps = null;
    }
    if (this._snapBufferCache) {
      this._snapBufferCache.destroy();
      this._snapBufferCache = null;
    }
    this._readback.buffer = null;
  }
}
