import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOTrianglesInstancingDrawRenderer} from "./VBOTrianglesInstancingDrawRenderer";
import {VBOTrianglesInstancingSilhouetteRenderer} from "./VBOTrianglesInstancingSilhouetteRenderer";
import {VBORenderer} from "../../../VBORenderer";
import {VBOTrianglesInstancingPickMeshRenderer} from "./VBOTrianglesInstancingPickMeshRenderer";
import {VBOTrianglesInstancingEdgesDrawRenderer} from "./VBOTrianglesInstancingEdgesDrawRenderer";
import {VBOTrianglesInstancingEdgesSilhouetteRenderer} from "./VBOTrianglesInstancingEdgesSilhouetteRenderer";


/**
 * @private
 */
class RendererFactory extends VBORendererSet {

    createDrawRenderer(): VBORenderer {
        return new VBOTrianglesInstancingDrawRenderer(this.renderContext);
    }

    createSilhouetteRenderer(): VBORenderer {
        return new VBOTrianglesInstancingSilhouetteRenderer(this.renderContext);
    }

    createPickMeshRenderer(): VBORenderer {
        return new VBOTrianglesInstancingPickMeshRenderer(this.renderContext);
    }

    createEdgesColorRenderer(): VBORenderer {
        return new VBOTrianglesInstancingEdgesDrawRenderer(this.renderContext);
    }

    createEdgesSilhouetteRenderer(): VBORenderer {
        return new VBOTrianglesInstancingEdgesSilhouetteRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
    return new RendererFactory(webglRenderer);
}));
