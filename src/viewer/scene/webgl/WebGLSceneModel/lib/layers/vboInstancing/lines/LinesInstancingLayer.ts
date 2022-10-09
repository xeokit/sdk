import {getInstancingRenderers} from "./LinesInstancingRenderers";
import {VBOInstancingLayer, VBOInstancingLayerCfg} from "../VBOInstancingLayer";


/**
 * @private
 */
export class LinesInstancingLayer extends VBOInstancingLayer {
    constructor(cfg: VBOInstancingLayerCfg) {
        super(cfg, getInstancingRenderers(cfg.sceneModel.view));
    }
}
