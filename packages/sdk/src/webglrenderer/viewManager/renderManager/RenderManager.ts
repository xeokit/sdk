import {WEBGL_INFO} from "../../../webglutils";
import {RenderContext} from "../../RenderContext";
import {MeshBatches} from "../meshBatches/MeshBatches";
import {getDrawOps, DrawOps, putDrawOps} from "../drawOps/DrawOps";
import {RendererView} from "../RendererView";
import {DTXMemoryReader} from "../dtxMemory/DTXMemoryReader";
import {MeshBatch} from "../meshBatches/MeshBatch";


/**
 * Manages the drawing operations for WebGL rendering.
 * The `DrawManager` class handles rendering meshBatches, viewManager, and extensions,
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
     * Creates a DrawManager with the given rendering context, GPU read interface, and drawBatch graph.
     *
        * @param cfg.renderContext The rendering context.
     * @param cfg.dtxMemoryReader The GPU memory reader.
     * @param cfg.meshBatches The mesh batches.
     */
    constructor(cfg: {
        renderContext: RenderContext,
        dtxMemoryReader: DTXMemoryReader,
        meshBatches: MeshBatches
    }) {
        this._renderContext = cfg.renderContext;
        this._meshBatches = cfg.meshBatches;
        this._drawOps = getDrawOps(this._renderContext, cfg.dtxMemoryReader);
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
     * Renders the RenderGraph in the provided RendererView.
     * @param rendererView
     * @param options
     */
    render(
        rendererView: RendererView,
        options: {
        clear: boolean;
    }): void {

        const { clear} = options;

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
            ? rendererView.renderBuffers.getRenderBuffer("saoOcclusion")?.getTexture() ?? null
            : null;

        if (clear !== false) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        const edgeMaterial = view.edges;
        const highlightMaterial = view.highlightMaterial;
        const selectedMaterial = view.selectedMaterial;
        const xrayMaterial = view.xrayMaterial;

        const meshBatches = this._meshBatches.sortedBatches;

        meshBatches.forEach(meshBatch => {
            
            const meshCounts = meshBatch.meshCounts[viewIndex];

            if (meshCounts.numVisible === 0 || 
                meshCounts.numCulled === meshCounts.numMeshes) {
                return;
            }

            const opaque = meshCounts.numTransparent < meshCounts.numMeshes;
            const transparent = meshCounts.numTransparent > 0;
            const xray = meshCounts.numXRayed > 0;
            const highlight = meshCounts.numHighlighted > 0;
            const select = meshCounts.numSelected > 0;

            if (opaque) {
                if (drawWithSAO && meshBatch.saoSupported) {
                    bins.normalDrawSAO.push(meshBatch);
                } else {
                    drawOps[meshBatch.primitive]?.opaque?.drawBatch(meshBatch);
                }
            }

            if (rendererView.transparentEnabled && transparent) {
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

            if (rendererView.edgesEnabled && edgeMaterial.applied) {
                if (opaque) {
                    bins.edgesColorOpaque.push(meshBatch);
                }
                if (transparent) {
                    bins.edgesColorTransparent.push(meshBatch);
                }
                (selectedMaterial.edgeAlpha < 1.0 ? bins.selectedEdgesTransparent : bins.selectedEdgesOpaque).push(meshBatch);
                if (xray) {
                    (xrayMaterial.edgeAlpha < 1.0 ? bins.xrayEdgesTransparent : bins.xrayEdgesOpaque).push(meshBatch);
                }
                (highlightMaterial.edgeAlpha < 1.0 ? bins.highlightedEdgesTransparent : bins.highlightedEdgesOpaque).push(meshBatch);
            }
        });

        for (let i = 0; i < bins.normalDrawSAO.length; i++) {
            //  renderers?.colorSAOOpaqueRenderer.bins.normalDrawSAO[i].drawColorSAOOpaque();
        }

        bins.edgesColorOpaque.forEach(meshBatch => {
            drawOps[meshBatch.primitive].opaqueEdges?.draw(meshBatch);
        });

        bins.xrayedSilhouetteOpaque.forEach(meshBatch => {
            drawOps[meshBatch.primitive].xrayed?.draw(meshBatch);
        });

        bins.xrayEdgesOpaque.forEach(meshBatch => {
            drawOps[meshBatch.primitive].xrayedEdges?.draw(meshBatch);
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

            bins.xrayEdgesTransparent.forEach(meshBatch => {
                drawOps[meshBatch.primitive].xrayedEdges?.draw(meshBatch);
            });

            bins.xrayedSilhouetteTransparent.forEach(meshBatch => {
                drawOps[meshBatch.primitive].xrayed?.draw(meshBatch);
            });

            if (bins.edgesColorTransparent.length || bins.normalFillTransparent.length) {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }

            bins.edgesColorTransparent.forEach(meshBatch => {
                drawOps[meshBatch.primitive].transparentEdges?.draw(meshBatch);
            });

            bins.normalFillTransparent.forEach(meshBatch => {
                drawOps[meshBatch.primitive].transparent?.draw(meshBatch);
            });

            gl.disable(gl.BLEND);
            if (!this._alphaDepthMask) {
                gl.depthMask(true);
            }
        }

        // Helper to clear depth and drawBatch silhouette + edges
        const drawSilAndEdges = (
            silBin: MeshBatch[],
            edgesBin: MeshBatch[],
            drawSil: (l: MeshBatch) => void,
            drawEdges: (l: MeshBatch) => void
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
