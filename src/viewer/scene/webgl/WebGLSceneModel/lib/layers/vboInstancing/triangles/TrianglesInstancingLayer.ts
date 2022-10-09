import {getTrianglesInstancingRenderers} from "./TrianglesInstancingRenderers";
import {VBOInstancingLayer, VBOInstancingLayerCfg} from "../VBOInstancingLayer";

export class TrianglesInstancingLayer extends VBOInstancingLayer {
    constructor(cfg: VBOInstancingLayerCfg) {
        super(cfg, getTrianglesInstancingRenderers(cfg.sceneModel.view));
    }
}
