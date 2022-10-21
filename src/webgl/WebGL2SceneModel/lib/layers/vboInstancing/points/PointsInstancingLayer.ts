import {getPointsInstancingRenderers} from "./PointsInstancingRenderers";
import {VBOInstancingLayer, VBOInstancingLayerCfg} from "../VBOInstancingLayer";

export class PointsInstancingLayer extends VBOInstancingLayer {
    constructor(params: VBOInstancingLayerCfg) {
        super(params, getPointsInstancingRenderers(params.sceneModel.view));
    }
}
