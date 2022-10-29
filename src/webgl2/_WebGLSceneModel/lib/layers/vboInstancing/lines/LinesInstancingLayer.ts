import {getInstancingRenderers} from "./LinesInstancingRenderers";
import {VBOInstancingLayer, VBOInstancingLayerCfg} from "../VBOInstancingLayer";


/**
 * @private
 */
export class LinesInstancingLayer extends VBOInstancingLayer {
    constructor(params: VBOInstancingLayerCfg) {
        super(params, getInstancingRenderers(params.sceneModel.view));
    }
}
