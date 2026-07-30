import {DrawOp} from "./DrawOp";
import type {RenderPassValue} from "../RENDER_PASSES";
import type {MeshBatch} from "../meshManager/MeshBatch";
import type {RenderContext} from "../RenderContext";
import type {GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";

/**
 * Runtime selector for triangle surface DrawTechnique geometry bindings.
 *
 * Both variants use the same high-level DrawTechnique shaders and DTX-backed
 * mesh/material/view state. The VBO variant replaces only the primitive/index/
 * position geometry binding with TriangleGeometryVBOBatch attributes.
 *
 * @internal
 */
export class TriangleSurfaceDrawOp extends DrawOp {
  private readonly _renderContext: RenderContext;
  private readonly _gpuMemoryReader: GPUMemoryReader;
  private readonly _dtxDrawOp: DrawOp;
  private readonly _vboGeometryDrawOp: DrawOp;

  constructor(params: {
    renderContext: RenderContext;
    gpuMemoryReader: GPUMemoryReader;
    dtxDrawOp: DrawOp;
    vboGeometryDrawOp: DrawOp;
    renderPass: RenderPassValue;
  }) {
    super(params.dtxDrawOp.technique, params.renderPass);
    this._renderContext = params.renderContext;
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
    const view = this._renderContext.activeView;
    const batchResources = this._gpuMemoryReader.gpuResources.batches[meshBatch.gpuMemoryBatchIndex];
    if (batchResources?.geometryStorage !== "vbo") {
      return this._dtxDrawOp;
    }
    const triangleGeometryVBO = batchResources?.triangleGeometryVBO;
    if (!triangleGeometryVBO?.getDrawState(view.viewIndex, this.renderPass, "hybrid")) {
      this._renderContext.renderInspector?.vboGeometryTriangles({
        blockedBatches: 1,
        blockedPrims: 0
      });
      return this._vboGeometryDrawOp;
    }
    return this._vboGeometryDrawOp;
  }
}
