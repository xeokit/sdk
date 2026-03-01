import {WEBGL_INFO} from "../../../webglutils";
import {type RenderContext} from "../RenderContext";
import {type MeshManager} from "../meshManager/MeshManager";
import {type DrawOps, getDrawOps, putDrawOps} from "../drawOps/DrawOps";
import {type ViewRenderState} from "../ViewRenderState";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {type MeshBatch} from "../meshManager/MeshBatch";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {SDKInternalException, type SDKResult} from "../../../core";
import {RENDER_BINS} from "../RENDER_BINS";


/**
 * Renders mesh batches.
 *
 * Owned by a {@link ViewManager}.
 *
 * `RenderManager` is responsible for:
 * - Translating {@link MeshBatch} state into concrete WebGL draw calls
 * - Managing GPU state (depth, blending, culling) across render phases
 * - Executing multi-pass rendering (opaque, transparent, edges, x-ray, highlight, selection)
 * - Binding draw programs via {@link DrawOps}
 *
 * ### Rendering model
 * Rendering is performed in phases:
 * 1. Opaque geometry
 * 2. Opaque edges
 * 3. X-ray / highlighted / selected silhouettes (opaque)
 * 4. Transparent geometry & edges (with blending)
 * 5. X-ray / highlighted / selected silhouettes (transparent)
 *
 * Meshes are grouped into bins per phase to ensure correct ordering and
 * minimal GPU state changes.
 *
 * @remarks
 * - Uses a shared {@link DrawOps} pool to reduce shader/program churn.
 * - Assumes a maximum of 4 views (indexed via `View.viewIndex`).
 * - GPU state cleanup is performed explicitly at the end of each render.
 *
 * @internal
 */
export class RenderManager {

  /**
   * Active drawing operations (shader programs + draw routines).
   *
   * Populated during {@link init} and returned to the pool during {@link destroy}.
   *
   * Used internally, but made public to support diagnostics and testing.
   */
  public drawOps: DrawOps;

  /** Shared render context (WebGL state + global flags). */
  private _renderContext: RenderContext;

  /** Provides access to mesh batches and render-pass classification. */
  private _meshManager: MeshManager;

  /** WebGL extension handles enabled for this renderer. */
  private _extensionHandles: any;

  /** Whether logarithmic depth buffer rendering is enabled. */
  private _logarithmicDepthBufferEnabled: boolean;

  /** Whether alpha-tested geometry writes to the depth buffer. */
  private _alphaDepthMask: boolean;

  /** Read-only interface into GPU memory (geometry, attributes, indices). */
  private _gpuMemoryReader: GPUMemoryReader;

  /** Whether {@link init} has completed successfully. */
  private _initialized: boolean;


  /**
   * Creates a {@link RenderManager}.
   *
   * @param cfg.renderContext - Shared render context (WebGL state, flags, configs).
   * @param cfg.gpuMemoryReader - Read-only access to GPU memory.
   * @param cfg._meshManager - Provides sorted mesh batches and render-pass queries.
   */
  constructor(cfg: {
    renderContext: RenderContext,
    gpuMemoryReader: GPUMemoryReader,
    meshManager: MeshManager
  }) {
    this._renderContext = cfg.renderContext;
    this._gpuMemoryReader = cfg.gpuMemoryReader;
    this._meshManager = cfg.meshManager;
    this._initialized = false;
  }

  /**
   * Initializes draw operations and activates supported WebGL extensions.
   *
   * @returns {@link SDKResult} indicating success or failure.
   *
   * @remarks
   * - Must be called before {@link render}
   * - Draw operations are pooled; this may reuse previously created programs
   */
  public init(): SDKResult<void> {
    if (!this.drawOps) {
      const result = getDrawOps(this._renderContext, this._gpuMemoryReader);
      if (result.ok === false) {
        return result;
      }
      this.drawOps = result.value;
    }
    this._extensionHandles = {};
    this._logarithmicDepthBufferEnabled = false;
    this._alphaDepthMask = false;
    this._activateExtensions();
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Reinitializes draw operations after a WebGL context restore.
   */
  webglContextRestored(): SDKResult<void> {
    return this.drawOps
      ? this.drawOps.webglContextRestored()
      : {
        ok: true,
        value: undefined
      };
  }

  private _activateExtensions() {
    if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) {
      this._extensionHandles.OES_element_index_uint = this._renderContext.gl.getExtension("OES_element_index_uint");
    }
    if (this._logarithmicDepthBufferEnabled && WEBGL_INFO.SUPPORTED_EXTENSIONS["EXT_frag_depth"]) {
      this._extensionHandles.EXT_frag_depth = this._renderContext.gl.getExtension('EXT_frag_depth');
    }
    if (WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"]) {
      this._extensionHandles.WEBGL_depth_texture = this._renderContext.gl.getExtension('WEBGL_depth_texture');
    }
  }


  /**
   * Renders a single {@link ViewRenderState}.
   *
   * This method:
   * - Configures global WebGL state
   * - Classifies mesh batches into render bins
   * - Executes multi-pass rendering in correct order
   * - Cleans up GPU state after rendering
   *
   * @param rendererView - Renderer-side state for the target view.
   * @param options.clear - Whether to clear color/depth buffers before rendering.
   *
   * @throws {@link SDKInternalException} If called before {@link init}.
   */
  public render(
    rendererView: ViewRenderState,
    options: {
      clear: boolean;
    }): SDKResult<any> {

    if (!this.drawOps) {
      throw new SDKInternalException("[RenderManager.render] RenderManager not initialized");
    }

    const {view} = rendererView;
    const {clear} = options;
    const viewIndex = view.viewIndex;
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const edgeMaterial = view.edges;
    const highlightMaterial = view.highlightMaterial;
    const selectedMaterial = view.selectedMaterial;
    const xrayMaterial = view.xrayMaterial;
    const meshBatches = this._meshManager.sortedBatches;
    const drawOps = this.drawOps.prims;

    const drawInspector = (renderContext.renderInspector && renderContext.renderInspector.enabled) ? renderContext.renderInspector : null;

    drawInspector?.frameStarted(view);

    const bins = {
      normalDrawSAO: [] as MeshBatch[],
      edgesColorOpaque: [] as MeshBatch[],
      normalFillTransparent: [] as MeshBatch[],
      edgesColorTransparent: [] as MeshBatch[],
      xrayedSilhouetteOpaque: [] as MeshBatch[],
      xrayEdgesOpaque: [] as MeshBatch[],
      xrayedSilhouetteTransparent: [] as MeshBatch[],
      xrayEdgesTransparent: [] as MeshBatch[],
      highlightedSilhouetteOpaque: [] as MeshBatch[],
      highlightedEdgesOpaque: [] as MeshBatch[],
      highlightedSilhouetteTransparent: [] as MeshBatch[],
      highlightedEdgesTransparent: [] as MeshBatch[],
      selectedSilhouetteOpaque: [] as MeshBatch[],
      selectedEdgesOpaque: [] as MeshBatch[],
      selectedSilhouetteTransparent: [] as MeshBatch[],
      selectedEdgesTransparent: [] as MeshBatch[]
    };

    renderContext.reset();
    renderContext.activeView = view;
    renderContext.pbrEnabled = false; // rendererView.view.pbrEnabled;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const bg = rendererView.view.transparent ? [0, 0, 0, 0] : [...view.backgroundColor, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.lineWidth(1);
    renderContext.lineWidth = 1;

    const drawWithSAO = rendererView.view.sao.applied && view.sao.possible;
    renderContext.saoOcclusionTexture = drawWithSAO
      ? rendererView.renderBuffers.getRenderBuffer("saoOcclusion")?.getTexture() ?? null
      : null;

    if (clear !== false) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    const enableOpaqueBin = (!drawInspector || drawInspector.getRenderBinEnabled(RENDER_BINS.OPAQUE));

    if (enableOpaqueBin) {
      drawInspector?.renderBinStarted(RENDER_BINS.OPAQUE);
    }

    for (const meshBatch of meshBatches) {

      const opaque = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.OPAQUE);
      const transparent = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.TRANSPARENT);
      const xray = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.XRAYED);
      const highlight = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.HIGHLIGHTED);
      const select = meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.SELECTED);

      if (opaque) {
        if (drawWithSAO && meshBatch.saoSupported) {
          bins.normalDrawSAO.push(meshBatch);
        } else {
          if (enableOpaqueBin) {
            drawOps[meshBatch.primitive]?.opaque?.drawBatch(meshBatch);
          }
        }
      }
      if (transparent) {
        bins.normalFillTransparent.push(meshBatch);
      }
      if (xray && xrayMaterial.fill) {
        (xrayMaterial.fillAlpha < 1.0
          ? bins.xrayedSilhouetteTransparent
          : bins.xrayedSilhouetteOpaque).push(meshBatch);
      }
      if (highlight && highlightMaterial.fill) {
        (highlightMaterial.fillAlpha < 1.0
          ? bins.highlightedSilhouetteTransparent
          : bins.highlightedSilhouetteOpaque).push(meshBatch);
      }
      if (select && selectedMaterial.fill) {
        (selectedMaterial.fillAlpha < 1.0
          ? bins.selectedSilhouetteTransparent
          : bins.selectedSilhouetteOpaque).push(meshBatch);
      }

      if (edgeMaterial.applied) {
        if (opaque) {
          bins.edgesColorOpaque.push(meshBatch);
        }
        if (transparent) {
          bins.edgesColorTransparent.push(meshBatch);
        }
        if (xray) {
          (xrayMaterial.edgeAlpha < 1.0 ? bins.xrayEdgesTransparent : bins.xrayEdgesOpaque).push(meshBatch);
        }
        if (highlight) {
          (highlightMaterial.edgeAlpha < 1.0 ? bins.highlightedEdgesTransparent : bins.highlightedEdgesOpaque).push(meshBatch);
        }
        if (select) {
          (selectedMaterial.edgeAlpha < 1.0 ? bins.selectedEdgesTransparent : bins.selectedEdgesOpaque).push(meshBatch);
        }
      }
    }

    for (let i = 0; i < bins.normalDrawSAO.length; i++) {
      //  renderers?.colorSAOOpaqueRenderer.bins.normalDrawSAO[i].drawColorSAOOpaque();
    }

    if (!drawInspector || drawInspector.getRenderBinEnabled(RENDER_BINS.EDGES_OPAQUE)) {
      drawInspector?.renderBinStarted(RENDER_BINS.EDGES_OPAQUE);
      bins.edgesColorOpaque.forEach(meshBatch => {
        drawOps[meshBatch.primitive].opaqueEdges?.drawBatch(meshBatch);
      });
    }

    if (!drawInspector || (drawInspector.getRenderBinEnabled(RENDER_BINS.XRAYED_SILHOUETTE_OPAQUE))) {
      drawInspector?.renderBinStarted(RENDER_BINS.XRAYED_SILHOUETTE_OPAQUE);
      bins.xrayedSilhouetteOpaque.forEach(meshBatch => {
        drawOps[meshBatch.primitive].xrayed?.drawBatch(meshBatch);
      });
    }

    if (!drawInspector || (drawInspector.getRenderBinEnabled(RENDER_BINS.XRAYED_EDGES_OPAQUE))) {
      drawInspector?.renderBinStarted(RENDER_BINS.XRAYED_EDGES_OPAQUE);
      bins.xrayEdgesOpaque.forEach(meshBatch => {
        drawOps[meshBatch.primitive].xrayedEdges?.drawBatch(meshBatch);
      });
    }

    //  for (let i = 0; i < bins.xrayEdgesOpaque.length; i++) bins.xrayEdgesOpaque[i].drawEdgesXRayed();

    // Draw Translucent
    if (
      bins.normalFillTransparent.length ||
      bins.edgesColorTransparent.length ||
      bins.xrayedSilhouetteTransparent.length ||
      bins.xrayEdgesTransparent.length
    ) {
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      if (rendererView.view.transparent) {
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      renderContext.backfaces = false;

      if (!this._alphaDepthMask) {
        gl.depthMask(false);
      }

      if (!drawInspector || drawInspector.getRenderBinEnabled(RENDER_BINS.XRAYED_EDGES_TRANSPARENT)) {
        drawInspector?.renderBinStarted(RENDER_BINS.XRAYED_EDGES_TRANSPARENT);
        bins.xrayEdgesTransparent.forEach(meshBatch => {
          drawOps[meshBatch.primitive].xrayedEdges?.drawBatch(meshBatch);
        });
      }

      if (!drawInspector || drawInspector.getRenderBinEnabled(RENDER_BINS.XRAYED_SILHOUETTE_TRANSPARENT)) {
        drawInspector?.renderBinStarted(RENDER_BINS.XRAYED_SILHOUETTE_TRANSPARENT);
        bins.xrayedSilhouetteTransparent.forEach(meshBatch => {
          drawOps[meshBatch.primitive].xrayed?.drawBatch(meshBatch);
        });
      }

      if (bins.edgesColorTransparent.length || bins.normalFillTransparent.length) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      if (!drawInspector || drawInspector.getRenderBinEnabled(RENDER_BINS.EDGES_TRANSPARENT)) {
        drawInspector?.renderBinStarted(RENDER_BINS.EDGES_TRANSPARENT);
        bins.edgesColorTransparent.forEach(meshBatch => {
          drawOps[meshBatch.primitive].transparentEdges?.drawBatch(meshBatch);
        });
      }

      if (!drawInspector || drawInspector.getRenderBinEnabled(RENDER_BINS.TRANSPARENT)) {
        drawInspector?.renderBinStarted(RENDER_BINS.TRANSPARENT);
        bins.normalFillTransparent.forEach(meshBatch => {
          drawOps[meshBatch.primitive].transparent?.drawBatch(meshBatch);
        });
      }

      gl.disable(gl.BLEND);
      if (!this._alphaDepthMask) {
        gl.depthMask(true);
      }
    }

    gl.disable(gl.CULL_FACE);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    if (bins.highlightedSilhouetteOpaque.length) {
      drawInspector?.renderBinStarted(RENDER_BINS.HIGHLIGHTED_SILHOUETTE_OPAQUE);
      bins.highlightedSilhouetteOpaque.forEach(meshBatch => {
        drawOps[meshBatch.primitive].highlighted?.drawBatch(meshBatch);
      });
    }

    if (bins.highlightedEdgesOpaque.length) {
      //drawInspector?.renderBinStarted(RENDER_BINS.HIGHLIGHTED_EDGES_OPAQUE);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      bins.highlightedEdgesOpaque.forEach(meshBatch => {
        drawOps[meshBatch.primitive].highlightedEdges?.drawBatch(meshBatch);
      });
    }

    if (bins.selectedSilhouetteOpaque.length) {
      bins.selectedSilhouetteOpaque.forEach(meshBatch => {
        drawOps[meshBatch.primitive].selected?.drawBatch(meshBatch);
      });
    }

    if (bins.selectedEdgesOpaque.length) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      bins.selectedEdgesOpaque.forEach(meshBatch => {
        drawOps[meshBatch.primitive].selectedEdges?.drawBatch(meshBatch);
      });
    }

    gl.enable(gl.BLEND);

    if (bins.highlightedSilhouetteTransparent.length) {
      drawInspector?.renderBinStarted(RENDER_BINS.HIGHLIGHTED_SILHOUETTE_TRANSPARENT);
      bins.highlightedSilhouetteTransparent.forEach(meshBatch => {
        drawOps[meshBatch.primitive].highlighted?.drawBatch(meshBatch);
      });
    }

    if (bins.highlightedEdgesTransparent.length) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      bins.highlightedEdgesTransparent.forEach(meshBatch => {
        drawOps[meshBatch.primitive].highlightedEdges?.drawBatch(meshBatch);
      });
    }

    if (bins.selectedSilhouetteTransparent.length) {
      drawInspector?.renderBinStarted(RENDER_BINS.HIGHLIGHTED_SILHOUETTE_TRANSPARENT);
      bins.selectedSilhouetteTransparent.forEach(meshBatch => {
        drawOps[meshBatch.primitive].selected?.drawBatch(meshBatch);
      });
    }

    if (bins.selectedEdgesTransparent.length) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      bins.selectedEdgesTransparent.forEach(meshBatch => {
        drawOps[meshBatch.primitive].selectedEdges?.drawBatch(meshBatch);
      });
    }

    // Cleanup GPU state
    for (let i = 0, texUnits = WEBGL_INFO.MAX_TEXTURE_UNITS; i < texUnits; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
    }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    for (let i = 0, attribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; i < attribs; i++) {
      gl.disableVertexAttribArray(i);
    }

    drawInspector?.frameEnded();

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * @private
   */
  public destroy() {
    if (this.drawOps) {
      putDrawOps(this.drawOps);
      this.drawOps = null;
    }
    this._extensionHandles = null;
    this._renderContext = null;
    this._gpuMemoryReader = null;
  }
}
