import type { WebGLRendererModel } from "../../WebGLRendererModel";
import type { RendererTextureSet } from "../../../scene";
import { FloatArrayParam } from "../../../math";
import { RenderContext } from "../../RenderContext";
import { SceneGeometry } from "../../../scene";

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
