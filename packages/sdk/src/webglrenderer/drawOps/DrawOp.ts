import {DrawTechnique} from "./DrawTechnique";
import {RenderPassValue} from "./RENDER_PASSES";
import {DrawBatch} from "../drawBatches/DrawBatch";

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

    public draw(batch: DrawBatch) {
        this._technique.draw(batch, this._renderPass);
    }
}