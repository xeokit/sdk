import {DrawTechnique} from "./DrawTechnique";
import {type RenderPassValue} from "../RENDER_PASSES";
import {type MeshBatch} from "../meshManager/MeshBatch";

/**
 * A draw operation (draw op) applies a specific draw technique to a specific render pass.
 */
export class DrawOp {

    private _technique: DrawTechnique;
    private _renderPass: RenderPassValue;

    constructor(technique: DrawTechnique, renderPass: RenderPassValue) {
        this._technique = technique;
        this._renderPass = renderPass;
    }

    public drawBatch(meshBatch: MeshBatch) {
        this._technique.drawBatch(meshBatch, this._renderPass);
    }

    public drawMesh(meshBatch: MeshBatch, meshIndex: number) {
        this._technique.drawMesh(meshBatch, meshIndex, this._renderPass);
    }
}
