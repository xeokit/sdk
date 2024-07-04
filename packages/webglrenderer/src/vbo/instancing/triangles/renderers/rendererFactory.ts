import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBORendererSet} from "../../../VBORendererSet";
import {VBOTrianglesInstancingLambertRenderer} from "./VBOTrianglesInstancingLambertRenderer";
import {VBOTrianglesInstancingSilhouetteRenderer} from "./VBOTrianglesInstancingSilhouetteRenderer";
import {VBORenderer} from "../../../VBORenderer";
import {VBOTrianglesInstancingPickMeshRenderer} from "./VBOTrianglesInstancingPickMeshRenderer";

/**
 * @private
 */
class RendererFactory extends VBORendererSet {

    createLambertRenderer(): VBORenderer {
        return new VBOTrianglesInstancingLambertRenderer(this.renderContext);
    }

    createSilhouetteRenderer(): VBORenderer {
        return new VBOTrianglesInstancingSilhouetteRenderer(this.renderContext);
    }

    createPickMeshRenderer(): VBORenderer {
        return new VBOTrianglesInstancingPickMeshRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBORendererSet => {
    return new RendererFactory(webglRenderer);
}));
