import {getPointsInstancingRenderers} from "./PointsInstancingRenderers";
import {VBOInstancingLayer, VBOInstancingLayerCfg} from "../VBOInstancingLayer";

export class PointsInstancingLayer extends VBOInstancingLayer {
    constructor(cfg: VBOInstancingLayerCfg) {
        super(cfg, getPointsInstancingRenderers(cfg.sceneModel.view));
    }
}
