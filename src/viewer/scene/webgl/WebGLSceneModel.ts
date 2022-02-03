import {SceneModel} from "../SceneModel";
import {FloatArrayType} from "../../math";
import {Scene} from "../Scene";
import {SceneObject} from "../SceneObject";
import {RenderFlags} from "./RenderFlags";
import {FrameContext} from "./FrameContext";

export class WebGLSceneModel extends SceneModel {

    readonly renderFlags: RenderFlags;

    numPortions:number;
    numVisibleLayerPortions: number;
    numCulledLayerPortions: number;
    numTransparentLayerPortions: number;
    numXRayedLayerPortions: number;
    numEdgesLayerPortions: number;
    numSelectedLayerPortions: number;
    numHighlightedLayerPortions: number;
    private _layerList: any[];

    constructor(scene: Scene, cfg: any) {
        super(scene, cfg);
        this.renderFlags = new RenderFlags();
    }

    // Build

    createGeometry(cfg: {
        id: string;
        primitive: string;
        origin?: FloatArrayType;
        positions?: FloatArrayType;
        positionsCompressed?: FloatArrayType;
        positionsDecodeMatrix?: FloatArrayType;
        normals?: FloatArrayType;
        normalsCompressed?: FloatArrayType;
        uvs?: FloatArrayType;
        uvsCompressed?: FloatArrayType;
        colors?: FloatArrayType;
        colorsCompressed?: FloatArrayType;
        indices?: number[];
        edgeIndices?: number[]
    }): void {
    }

    createMesh(cfg: {
        id?: string;
        geometryId?: string;
        materialId?: string;
        primitive?: string;
        origin?: FloatArrayType;
        positions?: FloatArrayType;
        positionsCompressed?: FloatArrayType;
        positionsDecompressMatrix?: FloatArrayType;
        normals?: FloatArrayType;
        normalsCompressed?: FloatArrayType;
        uvs?: FloatArrayType;
        uvsCompressed?: FloatArrayType;
        colors?: FloatArrayType;
        colorsCompressed?: FloatArrayType;
        indices?: number[];
        edgeIndices?: number[];
        position?: FloatArrayType;
        scale?: FloatArrayType;
        quaternion?: FloatArrayType;
        rotation?: FloatArrayType;
        matrix?: FloatArrayType
    }): void {
    }

    createSceneObject(cfg: { id?: string; meshIds: string[] }): SceneObject {
        return undefined;
    }

    finalize(): void {
    }

    // Render


    /** @private */
    rebuildRenderFlags() {
        this.renderFlags.reset();
        this._updateRenderFlagsVisibleLayers();
        if (this.renderFlags.numLayers > 0 && this.renderFlags.numVisibleLayers === 0) {
            this.renderFlags.culled = true;
            return;
        }
        this._updateRenderFlags();
    }

    /**
     * @private
     */
    _updateRenderFlagsVisibleLayers() {
        const renderFlags = this.renderFlags;
        renderFlags.numLayers = this._layerList.length;
        renderFlags.numVisibleLayers = 0;
        for (let layerIndex = 0, len = this._layerList.length; layerIndex < len; layerIndex++) {
            const layer = this._layerList[layerIndex];
            const layerVisible = this._getActiveSectionPlanesForLayer(layer);
            if (layerVisible) {
                renderFlags.visibleLayers[renderFlags.numVisibleLayers++] = layerIndex;
            }
        }
    }

    /** @private */
    _getActiveSectionPlanesForLayer(layer:any) {

        // const renderFlags = this.renderFlags;
        // const sectionPlanes = this.scene._sectionPlanesState.sectionPlanes;
        // const numSectionPlanes = sectionPlanes.length;
        // const baseIndex = layer.layerIndex * numSectionPlanes;
        //
        // if (numSectionPlanes > 0) {
        //     for (let i = 0; i < numSectionPlanes; i++) {
        //
        //         const sectionPlane = sectionPlanes[i];
        //
        //         if (!sectionPlane.active) {
        //             renderFlags.sectionPlanesActivePerLayer[baseIndex + i] = false;
        //
        //         } else {
        //             renderFlags.sectionPlanesActivePerLayer[baseIndex + i] = true;
        //             renderFlags.sectioned = true;
        //         }
        //     }
        // }

        return true;
    }

    _updateRenderFlags() {

        if (this.numVisibleLayerPortions === 0) {
            return;
        }

        if (this.numCulledLayerPortions === this.numPortions) {
            return;
        }

        const renderFlags = this.renderFlags;

        renderFlags.colorOpaque = (this.numTransparentLayerPortions < this.numPortions);

        if (this.numTransparentLayerPortions > 0) {
            renderFlags.colorTransparent = true;
        }

        if (this.numXRayedLayerPortions > 0) {
            const xrayMaterial = this.viewer.viewList[0].xrayMaterial.state;
            if (xrayMaterial.fill) {
                if (xrayMaterial.fillAlpha < 1.0) {
                    renderFlags.xrayedSilhouetteTransparent = true;
                } else {
                    renderFlags.xrayedSilhouetteOpaque = true;
                }
            }
            if (xrayMaterial.edges) {
                if (xrayMaterial.edgeAlpha < 1.0) {
                    renderFlags.xrayedEdgesTransparent = true;
                } else {
                    renderFlags.xrayedEdgesOpaque = true;
                }
            }
        }

        if (this.numEdgesLayerPortions > 0) {
            const edgeMaterial = this.viewer.viewList[0].edgeMaterial.state;
            if (edgeMaterial.edges) {
                renderFlags.edgesOpaque = (this.numTransparentLayerPortions < this.numPortions);
                if (this.numTransparentLayerPortions > 0) {
                    renderFlags.edgesTransparent = true;
                }
            }
        }

        if (this.numSelectedLayerPortions > 0) {
            const selectedMaterial = this.viewer.viewList[0].selectedMaterial.state;
            if (selectedMaterial.fill) {
                if (selectedMaterial.fillAlpha < 1.0) {
                    renderFlags.selectedSilhouetteTransparent = true;
                } else {
                    renderFlags.selectedSilhouetteOpaque = true;
                }
            }
            if (selectedMaterial.edges) {
                if (selectedMaterial.edgeAlpha < 1.0) {
                    renderFlags.selectedEdgesTransparent = true;
                } else {
                    renderFlags.selectedEdgesOpaque = true;
                }
            }
        }

        if (this.numHighlightedLayerPortions > 0) {
            const highlightMaterial = this.viewer.viewList[0].highlightMaterial.state;
            if (highlightMaterial.fill) {
                if (highlightMaterial.fillAlpha < 1.0) {
                    renderFlags.highlightedSilhouetteTransparent = true;
                } else {
                    renderFlags.highlightedSilhouetteOpaque = true;
                }
            }
            if (highlightMaterial.edges) {
                if (highlightMaterial.edgeAlpha < 1.0) {
                    renderFlags.highlightedEdgesTransparent = true;
                } else {
                    renderFlags.highlightedEdgesOpaque = true;
                }
            }
        }
    }

    // -------------- RENDERING ---------------------------------------------------------------------------------------

    /** @private */
    drawColorOpaque(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawColorOpaque(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawColorTransparent(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawColorTransparent(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawDepth(frameCtx: FrameContext) { // Dedicated to SAO because it skips transparent objects
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawDepth(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawNormals(frameCtx: FrameContext) { // Dedicated to SAO because it skips transparent objects
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawNormals(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawSilhouetteXRayed(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawSilhouetteXRayed(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawSilhouetteHighlighted(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawSilhouetteHighlighted(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawSilhouetteSelected(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawSilhouetteSelected(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawEdgesColorOpaque(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawEdgesColorOpaque(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawEdgesColorTransparent(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawEdgesColorTransparent(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawEdgesXRayed(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawEdgesXRayed(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawEdgesHighlighted(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawEdgesHighlighted(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawEdgesSelected(frameCtx: FrameContext) {
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawEdgesSelected(renderFlags, frameCtx);
        }
    }

    /**
     * @private
     */
    drawOcclusion(frameCtx: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawOcclusion(renderFlags, frameCtx);
        }
    }

    /**
     * @private
     */
    drawShadow(frameCtx: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawShadow(renderFlags, frameCtx);
        }
    }

    /** @private */
    drawPickMesh(frameCtx: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawPickMesh(renderFlags, frameCtx);
        }
    }

    /**
     * Called by PerformanceMesh.drawPickDepths()
     * @private
     */
    drawPickDepths(frameCtx: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawPickDepths(renderFlags, frameCtx);
        }
    }

    /**
     * Called by PerformanceMesh.drawPickNormals()
     * @private
     */
    drawPickNormals(frameCtx: FrameContext) {
        if (this.numVisibleLayerPortions === 0) {
            return;
        }
        const renderFlags = this.renderFlags;
        for (let i = 0, len = renderFlags.visibleLayers.length; i < len; i++) {
            const layerIndex = renderFlags.visibleLayers[i];
            this._layerList[layerIndex].drawPickNormals(renderFlags, frameCtx);
        }
    }


    destroy() {
        super.destroy();
    }
}