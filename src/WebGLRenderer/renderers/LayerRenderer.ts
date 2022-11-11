import {View, constants} from "../../viewer/index";

import {ColorPointsRenderer} from "./ColorPointsRenderer";
import {FastColorTrianglesRenderer} from "./FastColorTrianglesRenderer";
import {ColorEdgesRenderer} from "./ColorEdgesRenderer";
import {SilhouetteTrianglesRenderer} from "./SilhouetteTrianglesRenderer";
import {QualityColorTrianglesRenderer} from "./QualityColorTrianglesRenderer";
import {ColorLinesRenderer} from "./ColorLinesRenderer";
import {RENDER_PASSES} from "../WebGLSceneModel/RENDER_PASSES";
import {FrameContext} from "../FrameContext";
import {Layer} from "../WebGLSceneModel/Layer";

export class LayerRenderer {

    #view: View;
    #gl: WebGL2RenderingContext;
    #frameContext: FrameContext;
    #colorPoints: ColorPointsRenderer;
    #fastColorTriangles: FastColorTrianglesRenderer;
    #colorEdges: ColorEdgesRenderer;
    #silhouetteTriangles: SilhouetteTrianglesRenderer;
    #qualityColorTriangles: QualityColorTrianglesRenderer;
    #colorLines: ColorLinesRenderer;
    #silhouettePoints: SilhouettePointsRenderer;
    #silhouetteLines: SilhouetteLinesRenderer;

    constructor(view: View, frameContext: FrameContext, gl: WebGL2RenderingContext) {
        this.#view = view;
        this.#gl = gl;
        this.#frameContext = frameContext;
        this.#colorPoints = new ColorPointsRenderer(view, gl);
        this.#fastColorTriangles = new FastColorTrianglesRenderer(view, gl);
        this.#qualityColorTriangles = new QualityColorTrianglesRenderer(view, gl);
        this.#colorLines = new ColorLinesRenderer(view, gl);
        this.#silhouettePoints = new SilhouettePointsRenderer(view, gl);
        this.#silhouetteTriangles = new SilhouetteTrianglesRenderer(view, gl);
        this.#silhouetteLines = new SilhouetteLinesRenderer(view, gl);
    }

    render(layer: Layer, renderPass: number, quality: boolean) {
        if (layer.meshCounts.numCulledMeshes === layer.meshCounts.numMeshes || layer.meshCounts.numVisibleMeshes === 0) {
            return;
        }
        switch (layer.primitive) {
            case constants.TrianglesPrimitive:
            case constants.SurfacePrimitive:
            case constants.SolidPrimitive:
                switch (renderPass) {
                    case RENDER_PASSES.COLOR_OPAQUE:
                        if (layer.meshCounts.numTransparentMeshes === layer.meshCounts.numMeshes || layer.meshCounts.numXRayedMeshes === layer.meshCounts.numMeshes) {
                            return;
                        }
                    case RENDER_PASSES.COLOR_TRANSPARENT:
                        if (quality) {
                            this.#qualityColorTriangles.draw(this.#frameContext, layer, renderPass);
                        } else {
                            this.#fastColorTriangles.draw(this.#frameContext, layer, renderPass);
                        }
                        break;
                    case RENDER_PASSES.SILHOUETTE_SELECTED:
                        if (layer.meshCounts.numSelectedMeshes > 0) {
                            this.#silhouetteTriangles.draw(this.#frameContext, layer, renderPass);
                        }
                        break;
                    case RENDER_PASSES.SILHOUETTE_HIGHLIGHTED:
                        if (layer.meshCounts.numHighlightedMeshes > 0) {
                            this.#silhouetteTriangles.draw(this.#frameContext, layer, renderPass);
                        }
                        break;
                    case RENDER_PASSES.SILHOUETTE_XRAYED:
                        if (layer.meshCounts.numXRayedMeshes > 0) {
                            this.#silhouetteTriangles.draw(this.#frameContext, layer, renderPass);
                        }
                        break;
                }
                break;
            case constants.LinesPrimitive:
                switch (renderPass) {
                    case RENDER_PASSES.COLOR_OPAQUE:
                    case RENDER_PASSES.COLOR_TRANSPARENT:
                        this.#colorLines.draw(this.#frameContext, layer, renderPass);
                        break;
                    case RENDER_PASSES.SILHOUETTE_SELECTED:
                    case RENDER_PASSES.SILHOUETTE_HIGHLIGHTED:
                    case RENDER_PASSES.SILHOUETTE_XRAYED:
                        this.#silhouetteLines.draw(this.#frameContext, layer, renderPass);
                        break;
                }
                break;
            case constants.PointsPrimitive:
                switch (renderPass) {
                    case RENDER_PASSES.COLOR_OPAQUE:
                    case RENDER_PASSES.COLOR_TRANSPARENT:
                        this.#colorPoints.draw(this.#frameContext, layer, renderPass);
                        break;
                    case RENDER_PASSES.SILHOUETTE_SELECTED:
                    case RENDER_PASSES.SILHOUETTE_HIGHLIGHTED:
                    case RENDER_PASSES.SILHOUETTE_XRAYED:
                        this.#silhouettePoints.draw(this.#frameContext, layer, renderPass);
                        break;
                }
                break;
        }
    }

    compile() {
        // this.colorPoints.needRebuild();
        // this.colorTriangles.needRebuild();
        // this.colorEdges.needRebuild();
        // this.silhouetteTriangles.needRebuild();
    }

    destroy() {
        // this.colorPoints.destroy();
        // this.colorTriangles.destroy();
        // this.colorEdges.destroy();
        // this.silhouetteTriangles.destroy();
    }
}