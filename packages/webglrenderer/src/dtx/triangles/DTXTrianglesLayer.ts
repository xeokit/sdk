import {DTXLayer} from "../DTXLayer";
import {DTXTrianglesRendererSet, getRenderers} from "./DTXTrianglesRendererSet";
import {DTXLayerParams} from "../DTXLayerParams";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import {Layer} from "../../Layer";

/**
 * @private
 */
export class DTXTrianglesLayer extends DTXLayer implements Layer {

    #rendererSet: DTXTrianglesRendererSet;

    constructor(layerParams: DTXLayerParams) {
        super(layerParams);
        this.#rendererSet = getRenderers(this.rendererModel.webglRenderer);
    }

    drawColorOpaque() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        this.updateBackfaceCull();
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.draw(this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawColorTranslucent() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === 0 ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        this.updateBackfaceCull();
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.draw(this, RENDER_PASSES.COLOR_TRANSPARENT);
        }
    }

    drawDepth() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        this.updateBackfaceCull();
        // if (this.#rendererSet.depthRenderer) {
        //     this.#rendererSet.depthRenderer.draw(this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        // }
    }

    drawNormals() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        this.updateBackfaceCull();
        // if (this.#rendererSet.normalsRenderer) {
        //     this.#rendererSet.normalsRenderer.draw(this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        // }
    }

    drawSilhouetteXRayed() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numXRayed === 0) {
            return;
        }
        this.updateBackfaceCull();
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.draw(this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numHighlighted === 0) {
            return;
        }
        this.updateBackfaceCull();
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.draw(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numSelected === 0) {
            return;
        }
        this.updateBackfaceCull();
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.draw(this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesColorOpaque() {
        // if (this.model.scene.logarithmicDepthBufferEnabled) {
        //     if (!this.model.scene._loggedWarning) {
        //         console.log("Edge enhancement for SceneModel data texture layers currently disabled with logarithmic depth buffer");
        //         this.model.scene._loggedWarning = true;
        //     }
        //     return;
        // }
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0 || this.meshCounts.numEdges === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.draw(this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        }
    }

    drawEdgesColorTranslucent() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numEdges === 0 ||
            this.meshCounts.numTransparent === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.draw( this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        }
    }

    drawEdgesHighlighted() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.draw( this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        }
    }

    drawEdgesSelected() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numSelected === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.draw( this, RENDER_PASSES.EDGES_SELECTED);
        }
    }

    drawEdgesXRayed() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.edgesColorRenderer) {
            this.#rendererSet.edgesColorRenderer.draw( this, RENDER_PASSES.EDGES_XRAYED);
        }
    }

    // ---------------------- OCCLUSION CULL RENDERING -----------------------------------

    drawOcclusion() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0) {
            return;
        }
        // this.updateBackfaceCull();
        // if (this.#rendererSet.occlusionRenderer) {
        //     this.#rendererSet.occlusionRenderer.draw( this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    // ---------------------- SHADOW BUFFER RENDERING -----------------------------------

    drawShadow() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0) {
            return;
        }
        // this.updateBackfaceCull();
        // if (this.#rendererSet.shadowRenderer) {
        //     this.#rendererSet.shadowRenderer.draw( this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    setPickMatrices(pickViewMatrix, pickProjMatrix) {
        // if (this.meshCounts.numVisible === 0) {
        //     return;
        // }
        // this._dtxState.texturePickCameraMatrices.updateViewMatrix(pickViewMatrix, pickProjMatrix);
    }

    drawPickMesh() {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        // this.updateBackfaceCull();
        // if (this.#rendererSet.pickMeshRenderer) {
        //     this.#rendererSet.pickMeshRenderer.draw( this, RENDER_PASSES.PICK);
        // }
    }

    drawPickDepths() {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        // this.updateBackfaceCull();
        // if (this.#rendererSet.pickDepthRenderer) {
        //     this.#rendererSet.pickDepthRenderer.draw( this, RENDER_PASSES.PICK);
        // }
    }

    drawSnapInit() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
            return;
        }
        // this.updateBackfaceCull();
        // if (this.#rendererSet.snapInitRenderer) {
        //     this.#rendererSet.snapInitRenderer.draw( this, RENDER_PASSES.PICK);
        // }
    }

    drawSnap() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
            return;
        }
        // this.updateBackfaceCull();
        // if (this.#rendererSet.snapRenderer) {
        //     this.#rendererSet.snapRenderer.draw( this, RENDER_PASSES.PICK);
        // }
    }

    drawPickNormals() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
            return;
        }
        // this.updateBackfaceCull();
        // if (this.#rendererSet.pickNormalsRenderer) {
        //     this.#rendererSet.pickNormalsRenderer.draw( this, RENDER_PASSES.PICK);
        // }
    }
}
