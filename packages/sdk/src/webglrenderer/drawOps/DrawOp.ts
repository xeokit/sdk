import {DrawTechnique} from "./DrawTechnique";
import {RenderPassValue} from "./RENDER_PASSES";
import {MeshBatch} from "../meshBatches/MeshBatch";

/**
 * A drawBatch operation associated with a specific rendering technique.
 */
export class DrawOp {

    private _technique: DrawTechnique;
    private _renderPass: RenderPassValue;

    constructor(technique: DrawTechnique, renderPass: RenderPassValue) {
        this._technique = technique;
        this._renderPass = renderPass;
    }

    public drawBatch(meshBatch: MeshBatch) {
        this._technique.draw(meshBatch, this._renderPass);
    }

    public drawMesh(meshBatch: MeshBatch, meshIndex: number) {
        this._technique.drawMesh(meshBatch, meshIndex, this._renderPass);
    }
}