import {DrawOp} from "./DrawOp";
import type {RenderPassValue} from "../RENDER_PASSES";
import type {MeshBatch} from "../meshManager/MeshBatch";
import type {GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";

/**
 * Selects between DTX and VBO geometry draw ops using the batch's constructed
 * geometry storage kind.
 *
 * This is used for geometry-only passes such as snap and edge rendering, where
 * runtime render-path preference should not cross the construction-time DTX/VBO
 * resource boundary.
 *
 * @internal
 */
export class TriangleGeometryStorageDrawOp extends DrawOp {
  private readonly _gpuMemoryReader: GPUMemoryReader;
  private readonly _dtxDrawOp: DrawOp;
  private readonly _vboGeometryDrawOp: DrawOp;

  constructor(params: {
    gpuMemoryReader: GPUMemoryReader;
    dtxDrawOp: DrawOp;
    vboGeometryDrawOp: DrawOp;
    renderPass: RenderPassValue;
  }) {
    super(params.dtxDrawOp.technique, params.renderPass);
    this._gpuMemoryReader = params.gpuMemoryReader;
    this._dtxDrawOp = params.dtxDrawOp;
    this._vboGeometryDrawOp = params.vboGeometryDrawOp;
  }

  public drawBatch(meshBatch: MeshBatch): void {
    this._selectDrawOp(meshBatch).drawBatch(meshBatch);
  }

  public drawMesh(meshBatch: MeshBatch, meshIndex: number): void {
    this._selectDrawOp(meshBatch).drawMesh(meshBatch, meshIndex);
  }

  private _selectDrawOp(meshBatch: MeshBatch): DrawOp {
    const batchResources = this._gpuMemoryReader.gpuResources.batches[meshBatch.gpuMemoryBatchIndex];
    return batchResources?.geometryStorage === "vbo"
      ? this._vboGeometryDrawOp
      : this._dtxDrawOp;
  }
}
