import type {View} from "@xeokit/viewer";
import type {WebGLRendererModel} from "./../../WebGLRendererModel";
import type {RendererTextureSet} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math";
import {RenderContext} from "./../../RenderContext";
import {SceneGeometry} from "@xeokit/scene";

/**
 * @private
 */
export interface VBOInstancingLayerParams {
    renderContext: RenderContext;
    rendererModel: WebGLRendererModel;
    sceneGeometry: SceneGeometry;
    layerIndex: number;
    textureSet?: RendererTextureSet;
    origin:FloatArrayParam;
}
