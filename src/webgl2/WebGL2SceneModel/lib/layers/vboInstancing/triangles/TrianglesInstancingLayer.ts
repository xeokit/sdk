import {getTrianglesInstancingRenderers} from "./TrianglesInstancingRenderers";
import {VBOInstancingLayer, VBOInstancingLayerCfg} from "../VBOInstancingLayer";

export class TrianglesInstancingLayer extends VBOInstancingLayer {
    constructor(params: VBOInstancingLayerCfg) {
        super(params, getTrianglesInstancingRenderers(params.sceneModel.view));
    }
}
