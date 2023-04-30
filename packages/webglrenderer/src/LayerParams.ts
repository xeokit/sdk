import type {View} from "@xeokit/viewer";
import type {RendererModelImpl} from "./RendererModelImpl";
import type {RendererTextureSet} from "@xeokit/scene";

/**
 * @private
 */
export interface LayerParams { // Params for Layer constructor
    gl: WebGL2RenderingContext;
    view: View;
    rendererModel: RendererModelImpl;
    primitive: number;
    layerIndex: number;
    textureSet?: RendererTextureSet;
}