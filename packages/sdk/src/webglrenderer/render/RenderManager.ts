
import {WEBGL_INFO} from "../../webglutils";
import {RenderContext} from "../RenderContext";
import {MeshBatches} from "../meshBatches/MeshBatches";
import {getDrawOps, DrawOps, putDrawOps} from "../drawOps/DrawOps";
import {RendererViewImpl} from "../views/RendererViewImpl";
import {DTXMemoryReader} from "../dtxMemory/DTXMemoryReader";
import {MeshBatch} from "../meshBatches/MeshBatch";


/**
 * Manages the drawing operations for WebGL rendering.
 * The `DrawManager` class handles rendering meshBatches, views, and extensions,
 * ensuring proper GPU state and efficient rendering of opaque and transparent objects.
 */
export class RenderManager {

  private _renderContext: RenderContext;
  private _meshBatches: MeshBatches;
  private _drawOps: DrawOps;
  private _extensionHandles: any;
  private _logarithmicDepthBufferEnabled: boolean;
  private _alphaDepthMask: Boolean;

  /**
   * Creates a DrawManager with the given rendering context, GPU read interface, and draw graph.
   *
   * @param renderContext - The rendering context.
   * @param dtxMemoryReader - The GPU dtxMemory read interface. Provides data textures that contain model data to load into shaders.
   * @param meshBatches - The draw graph to draw.
   */
  constructor(renderContext: RenderContext, dtxMemoryReader: DTXMemoryReader, meshBatches: MeshBatches) {
    this._renderContext = renderContext;
    this._meshBatches = meshBatches;
    this._drawOps = getDrawOps(this._renderContext, dtxMemoryReader);
    this._extensionHandles = {};
    this._logarithmicDepthBufferEnabled = false;
    this._alphaDepthMask = false;
    this._activateExtensions();
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
   * Renders the RenderGraph in the provided RendererViewImpl.
   * @param params
   */
  render(params: {
    rendererView: RendererViewImpl;
    clear: boolean;
  } ): void {

    const {rendererView, clear} = params;

    const view = rendererView.view;
    const viewIndex = view.viewIndex;
    const gl = this._renderContext.gl;
    const renderContext = this._renderContext;
    const drawOps = this._drawOps.prims;

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
    renderContext.view = view;
    renderContext.pbrEnabled = rendererView.pbrEnabled;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const bg = rendererView.canvasTransparent ? [0, 0, 0, 0] : [...view.backgroundColor, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.lineWidth(1);
    renderContext.lineWidth = 1;

    const drawWithSAO = rendererView.saoEnabled && view.sao.possible;
    renderContext.saoOcclusionTexture = drawWithSAO
      ? rendererView.renderBufferManager.getRenderBuffer("saoOcclusion")?.getTexture() ?? null
      : null;

    if (clear !== false) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    const edgeMat = view.edges;
    const hlMat = view.highlightMaterial;
    const slMat = view.selectedMaterial;
    const xrMat = view.xrayMaterial;

    const batches = this._meshBatches.batches;

    for (let i = 0, len = batches.length; i < len; i++) {
      const batch = batches[i];
      const counts = batch.meshCounts[viewIndex];

      if (counts.numVisible === 0 || counts.numCulled === counts.numMeshes) {
        continue;
      }

      const opaque = counts.numTransparent < counts.numMeshes;
      const trans = counts.numTransparent > 0;
      const xr = counts.numXRayed > 0;
      const hl = counts.numHighlighted > 0;
      const sl = counts.numSelected > 0;

      if (opaque) {
        if (drawWithSAO && batch.saoSupported) {
          bins.normalDrawSAO.push(batch);
        }
        else {
          drawOps[batch.primitive]?.opaque.draw(batch);
        }
      }

      if (rendererView.transparentEnabled && trans) {
        bins.normalFillTransparent.push(batch);
      }

      if (xr && xrMat.fill) {
        (xrMat.fillAlpha < 1.0 ? bins.xrayedSilhouetteTransparent : bins.xrayedSilhouetteOpaque).push(batch);
      }
      if (hl && hlMat.fill) {
        (hlMat.fillAlpha < 1.0 ? bins.highlightedSilhouetteTransparent : bins.highlightedSilhouetteOpaque).push(batch);
      }
      if (sl && slMat.fill) {
        (slMat.fillAlpha < 1.0 ? bins.selectedSilhouetteTransparent : bins.selectedSilhouetteOpaque).push(batch);
      }

      if (rendererView.edgesEnabled && edgeMat.applied) {
        if (opaque) {
          bins.edgesColorOpaque.push(batch);
        }
        if (trans) {
          bins.edgesColorTransparent.push(batch);
        }
        (slMat.edgeAlpha < 1.0 ? bins.selectedEdgesTransparent : bins.selectedEdgesOpaque).push(batch);
        if (xr) {
          (xrMat.edgeAlpha < 1.0 ? bins.xrayEdgesTransparent : bins.xrayEdgesOpaque).push(batch);
        }
        (hlMat.edgeAlpha < 1.0 ? bins.highlightedEdgesTransparent : bins.highlightedEdgesOpaque).push(batch);
      }
    }

    for (let i = 0; i < bins.normalDrawSAO.length; i++) {
      //  renderers?.colorSAOOpaqueRenderer.bins.normalDrawSAO[i].drawColorSAOOpaque();
    }

    bins.edgesColorOpaque.forEach(batch => {
      drawOps[batch.primitive].opaqueEdges?.draw(batch);
    });

    bins.xrayedSilhouetteOpaque.forEach(batch => {
      drawOps[batch.primitive].xrayed?.draw(batch);
    });

    bins.xrayEdgesOpaque.forEach(batch => {
      drawOps[batch.primitive].xrayedEdges?.draw(batch);
    });

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
      if (rendererView.canvasTransparent) {
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      renderContext.backfaces = false;

      if (!this._alphaDepthMask) {
        gl.depthMask(false);
      }

      bins.xrayEdgesTransparent.forEach(batch => {
        drawOps[batch.primitive].xrayedEdges?.draw(batch);
      });

      bins.xrayedSilhouetteTransparent.forEach(batch => {
        drawOps[batch.primitive].xrayed?.draw(batch);
      });

      if (bins.edgesColorTransparent.length || bins.normalFillTransparent.length) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      bins.edgesColorTransparent.forEach(batch => {
        drawOps[batch.primitive].transparentEdges?.draw(batch);
      });

      bins.normalFillTransparent.forEach(batch => {
        drawOps[batch.primitive].transparent?.draw(batch);
      });

      gl.disable(gl.BLEND);
      if (!this._alphaDepthMask) {
        gl.depthMask(true);
      }
    }

    // Helper to clear depth and draw silhouette + edges
    const drawSilAndEdges = (
      silBin: MeshBatch[],
      edgesBin: MeshBatch[],
      drawSil: ( l: MeshBatch ) => void,
      drawEdges: ( l: MeshBatch ) => void
    ) => {
      if (silBin.length || edgesBin.length) {
        renderContext.lastProgramId = -1;
        gl.clear(gl.DEPTH_BUFFER_BIT);
        for (let i = 0; i < edgesBin.length; i++) drawEdges(edgesBin[i]);
        for (let i = 0; i < silBin.length; i++) drawSil(silBin[i]);
      }
    };

    drawSilAndEdges(bins.highlightedSilhouetteOpaque, bins.highlightedEdgesOpaque,
      b => drawOps[b.primitive].highlighted?.draw(b),
      b => drawOps[b.primitive].highlightedEdges?.draw(b));

    drawSilAndEdges(bins.selectedSilhouetteOpaque, bins.selectedEdgesOpaque,
      b => drawOps[b.primitive].selected?.draw(b),
      b => drawOps[b.primitive].selectedEdges?.draw(b));

    // TODO: Switch on blending if needed


    drawSilAndEdges(bins.highlightedSilhouetteTransparent, bins.highlightedEdgesTransparent,
        b => drawOps[b.primitive].highlighted?.draw(b),
        b => drawOps[b.primitive].highlightedEdges?.draw(b));

    drawSilAndEdges(bins.selectedSilhouetteTransparent, bins.selectedEdgesTransparent,
      b => drawOps[b.primitive].selected?.draw(b),
      b => drawOps[b.primitive].selectedEdges?.draw(b));

    // Cleanup GPU state
    for (let i = 0, texUnits = WEBGL_INFO.MAX_TEXTURE_UNITS; i < texUnits; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
    }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    for (let i = 0, attribs = WEBGL_INFO.MAX_VERTEX_ATTRIBS; i < attribs; i++) {
      gl.disableVertexAttribArray(i);
    }
  }

  destroy() {
    if (this._drawOps) {
        putDrawOps(this._drawOps);
        this._drawOps = null;
    }
  }
}
