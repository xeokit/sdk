import type {View} from "@xeokit/viewer";
import type {WebGLRendererModel} from "./WebGLRendererModel";
import type {RendererTextureSet} from "@xeokit/scene";

/**
 * @private
 */
export interface LayerParams { // Params for Layer constructor
    gl: WebGL2RenderingContext;
    view: View;
    rendererModel: WebGLRendererModel;
    primitive: number;
    layerIndex: number;
    textureSet?: RendererTextureSet;
}