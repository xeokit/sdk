import { FloatArrayParam } from "../../../math";
import { RenderContext } from "../../RenderContext";
import type { RendererTextureSet } from "../../../scene";
import { SceneGeometry } from "../../../scene";
import type { WebGLRendererModel } from "../../WebGLRendererModel";

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
