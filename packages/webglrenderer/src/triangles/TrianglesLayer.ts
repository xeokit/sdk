import {Layer} from "../Layer";
import {RendererSet} from "../RendererSet";
import {RENDER_PASSES} from "../RENDER_PASSES";

/**
 * @private
 */
export class TrianglesLayer extends Layer {

    draw(rendererSet: RendererSet) {
        switch (this.renderContext.renderPass) {
            case RENDER_PASSES.COLOR_OPAQUE:
            case RENDER_PASSES.COLOR_TRANSPARENT:
                rendererSet.trianglesFastColorRenderer.draw(this);
                break;
            case RENDER_PASSES.SILHOUETTE_SELECTED:
                rendererSet.trianglesSilhouetteRenderer.draw(this);
                break;
            case RENDER_PASSES.EDGES_COLOR_OPAQUE:
            case RENDER_PASSES.EDGES_COLOR_TRANSPARENT:
                rendererSet.trianglesEdgesColorRenderer.draw(this);
                break;

            // TODO: other modes
        }
    }
}