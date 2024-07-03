import {WebGLRenderer} from "../../../../WebGLRenderer";
import {RendererSetFactory, VBOInstancingRendererSet} from "../../VBOInstancingRendererSet";
import {VBOInstancingRenderer} from "../../VBOInstancingRenderer";
import {VBOTrianglesInstancingColorRenderer} from "./VBOTrianglesInstancingColorRenderer";

/**
 * @private
 */
class RendererFactory extends VBOInstancingRendererSet {
    createColorRenderer(): VBOInstancingRenderer {
        return new VBOTrianglesInstancingColorRenderer(this.renderContext);
    }
}

/**
 * @private
 */
export const rendererFactory = new RendererSetFactory(((webglRenderer: WebGLRenderer): VBOInstancingRendererSet => {
    return new RendererFactory(webglRenderer);
}));
