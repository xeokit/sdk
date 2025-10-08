import {DrawTechnique} from "./DrawTechnique";
import {RenderPassValue} from "./RENDER_PASSES";
import {MeshBatch} from "../meshBatches/MeshBatch";

/**
 * A draw operation associated with a specific rendering technique.
 */
export class DrawOp {

    private _technique: DrawTechnique;
    private _renderPass: RenderPassValue;

    constructor(technique: DrawTechnique, renderPass: RenderPassValue) {
        this._technique = technique;
        this._renderPass = renderPass;
    }

    public draw(meshBatch: MeshBatch) {
        this._technique.draw(meshBatch, this._renderPass);
    }
}