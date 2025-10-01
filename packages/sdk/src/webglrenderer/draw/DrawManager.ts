import {RENDER_PASSES} from "../renderGraph/RENDER_PASSES";
import {WEBGL_INFO} from "../../webglutils";
import {RenderContext} from "../RenderContext";
import {RenderGraph} from "../renderGraph/RenderGraph";
import {getLayerRendererSet, LayerRendererSet, putLayerRendererSet} from "../render/layerRenderers/LayerRendererSet";
import {RendererViewImpl} from "../views/RendererViewImpl";
import {GPUMemoryReadIF} from "../gpuMemory/GPUMemoryReadIF";
import {RenderLayer} from "../renderGraph/RenderLayer";


/**
 * Manages the drawing operations for WebGL rendering.
 * The `DrawManager` class handles rendering renderGraph, views, and extensions,
 * ensuring proper GPU state and efficient rendering of opaque and transparent objects.
 */
export class DrawManager {

  private _renderContext: RenderContext;
  private _renderGraph: RenderGraph;
  private _layerRendererSet: LayerRendererSet;
  private _extensionHandles: any;
  private _logarithmicDepthBufferEnabled: boolean;
  private _alphaDepthMask: Boolean;

  /**
   * Creates a DrawManager with the given rendering context, GPU read interface, and draw graph.
   *
   * @param renderContext - The rendering context.
   * @param gpuMemoryReadIF - The GPU gpuMemory read interface. Provides data textures that contain model data to load into shaders.
   * @param renderGraph - The draw graph to draw.
   */
  constructor( renderContext: RenderContext, gpuMemoryReadIF: GPUMemoryReadIF, renderGraph: RenderGraph) {
    this._renderContext = renderContext;
    this._renderGraph = renderGraph;
    this._layerRendererSet = getLayerRendererSet(this._renderContext, gpuMemoryReadIF);
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
  draw(params: {
    rendererView: RendererViewImpl;
    clear: boolean;
  } ): void {

    const {rendererView, clear} = params;

    const view = rendererView.view;
    const viewIndex = view.viewIndex;
    const gl = this._renderContext.gl;
    const ctx = this._renderContext;
    const primRenderers = this._layerRendererSet.prims;

    const bins = {
      normalDrawSAO: [] as RenderLayer[],
      edgesColorOpaque: [] as RenderLayer[],
      normalFillTransparent: [] as RenderLayer[],
      edgesColorTransparent: [] as RenderLayer[],
      xrayedSilhouetteOpaque: [] as RenderLayer[],
      xrayEdgesOpaque: [] as RenderLayer[],
      xrayedSilhouetteTransparent: [] as RenderLayer[],
      xrayEdgesTransparent: [] as RenderLayer[],
      highlightedSilhouetteOpaque: [] as RenderLayer[],
      highlightedEdgesOpaque: [] as RenderLayer[],
      highlightedSilhouetteTransparent: [] as RenderLayer[],
      highlightedEdgesTransparent: [] as RenderLayer[],
      selectedSilhouetteOpaque: [] as RenderLayer[],
      selectedEdgesOpaque: [] as RenderLayer[],
      selectedSilhouetteTransparent: [] as RenderLayer[],
      selectedEdgesTransparent: [] as RenderLayer[]
    };

    ctx.reset();
    ctx.view = view;
    ctx.pbrEnabled = rendererView.pbrEnabled;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const bg = rendererView.canvasTransparent ? [0, 0, 0, 0] : [...view.backgroundColor, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.lineWidth(1);
    ctx.lineWidth = 1;

    const drawWithSAO = rendererView.saoEnabled && view.sao.possible;
    ctx.saoOcclusionTexture = drawWithSAO
      ? rendererView.renderBufferManager.getRenderBuffer("saoOcclusion")?.getTexture() ?? null
      : null;

    if (clear !== false) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const edgeMat = view.edges;
    const hlMat = view.highlightMaterial;
    const slMat = view.selectedMaterial;
    const xrMat = view.xrayMaterial;

    const layers = this._renderGraph.layers;
    for (let i = 0, len = layers.length; i < len; i++) {
      const layer = layers[i];
      const counts = layer.meshCounts[viewIndex];

      if (counts.numVisible === 0 || counts.numCulled === counts.numMeshes) continue;

      const opaque = counts.numTransparent < counts.numMeshes;
      const trans = counts.numTransparent > 0;
      const xr = counts.numXRayed > 0;
      const hl = counts.numHighlighted > 0;
      const sl = counts.numSelected > 0;

      if (opaque) {
        if (drawWithSAO && layer.saoSupported) bins.normalDrawSAO.push(layer);
        else {
          primRenderers[layer.primitive]?.color.renderLayer(layer, RENDER_PASSES.DRAW_OPAQUE);
        }
      }

      if (rendererView.transparentEnabled && trans) bins.normalFillTransparent.push(layer);

      if (xr && xrMat.fill) (xrMat.fillAlpha < 1.0 ? bins.xrayedSilhouetteTransparent : bins.xrayedSilhouetteOpaque).push(layer);
      if (hl && hlMat.fill) (hlMat.fillAlpha < 1.0 ? bins.highlightedSilhouetteTransparent : bins.highlightedSilhouetteOpaque).push(layer);
      if (sl && slMat.fill) (slMat.fillAlpha < 1.0 ? bins.selectedSilhouetteTransparent : bins.selectedSilhouetteOpaque).push(layer);

      if (rendererView.edgesEnabled && edgeMat.applied) {
        if (opaque) bins.edgesColorOpaque.push(layer);
        if (trans) bins.edgesColorTransparent.push(layer);
        (slMat.edgeAlpha < 1.0 ? bins.selectedEdgesTransparent : bins.selectedEdgesOpaque).push(layer);
        if (xr) (xrMat.edgeAlpha < 1.0 ? bins.xrayEdgesTransparent : bins.xrayEdgesOpaque).push(layer);
        (hlMat.edgeAlpha < 1.0 ? bins.highlightedEdgesTransparent : bins.highlightedEdgesOpaque).push(layer);
      }
    }

    // Draw Opaque
    for (let i = 0; i < bins.normalDrawSAO.length; i++) {
      //  renderers?.colorSAOOpaqueRenderer.bins.normalDrawSAO[i].drawColorSAOOpaque();
    }
    for (let i = 0; i < bins.edgesColorOpaque.length; i++) {
      const layer = bins.edgesColorOpaque[i]
      primRenderers[layer.primitive].colorEdges?.renderLayer(layer, RENDER_PASSES.DRAW_OPAQUE);
    }
    for (let i = 0; i < bins.xrayedSilhouetteOpaque.length; i++) {
      const layer = bins.xrayedSilhouetteOpaque[i]
      primRenderers[layer.primitive].silhouette?.renderLayer(layer, RENDER_PASSES.SILHOUETTE_XRAYED);
    }
    for (let i = 0; i < bins.xrayEdgesOpaque.length; i++) {
      const layer = bins.xrayEdgesOpaque[i]
      primRenderers[layer.primitive].silhouetteEdges?.renderLayer(layer, RENDER_PASSES.SILHOUETTE_XRAYED);
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
      if (rendererView.canvasTransparent) {
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      ctx.backfaces = false;
      if (!this._alphaDepthMask) gl.depthMask(false);

      for (const layer of bins.xrayEdgesTransparent) {
        primRenderers[layer.primitive].silhouetteEdges?.renderLayer(layer, RENDER_PASSES.SILHOUETTE_XRAYED);
      }

      for (const layer of bins.xrayedSilhouetteTransparent) {
        primRenderers[layer.primitive].silhouetteEdges?.renderLayer(layer, RENDER_PASSES.SILHOUETTE_XRAYED);
      }

      if (bins.edgesColorTransparent.length || bins.normalFillTransparent.length) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      for (const layer of bins.edgesColorTransparent) {
        primRenderers[layer.primitive].colorEdges?.renderLayer(layer, RENDER_PASSES.DRAW_TRANSPARENT);
      }

      for (const layer of bins.normalFillTransparent) {
        primRenderers[layer.primitive].color?.renderLayer(layer, RENDER_PASSES.DRAW_TRANSPARENT);
      }

      gl.disable(gl.BLEND);
      if (!this._alphaDepthMask) gl.depthMask(true);
    }

    // Helper to clear depth and draw silhouette + edges
    const drawSilAndEdges = (
      silBin: RenderLayer[],
      edgesBin: RenderLayer[],
      drawSil: ( l: RenderLayer ) => void,
      drawEdges: ( l: RenderLayer ) => void
    ) => {
      if (silBin.length || edgesBin.length) {
        ctx.lastProgramId = -1;
        gl.clear(gl.DEPTH_BUFFER_BIT);
        for (let i = 0; i < edgesBin.length; i++) drawEdges(edgesBin[i]);
        for (let i = 0; i < silBin.length; i++) drawSil(silBin[i]);
      }
    };

    drawSilAndEdges(bins.highlightedSilhouetteOpaque, bins.highlightedEdgesOpaque,
      l => primRenderers[l.primitive].silhouette?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED),
      l => primRenderers[l.primitive].silhouetteEdges?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED));

    drawSilAndEdges(bins.highlightedSilhouetteTransparent, bins.highlightedEdgesTransparent,
      l => primRenderers[l.primitive].silhouette?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED),
      l => primRenderers[l.primitive].silhouetteEdges?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED));

    drawSilAndEdges(bins.selectedSilhouetteOpaque, bins.selectedEdgesOpaque,
      l => primRenderers[l.primitive].silhouette?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED),
      l => primRenderers[l.primitive].silhouetteEdges?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED));

    drawSilAndEdges(bins.selectedSilhouetteTransparent, bins.selectedEdgesTransparent,
      l => primRenderers[l.primitive].silhouette?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED),
      l => primRenderers[l.primitive].silhouetteEdges?.renderLayer(l, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED));

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
  if (this._layerRendererSet) {
    putLayerRendererSet(this._layerRendererSet);
    this._layerRendererSet = null;
  }
  }
}
