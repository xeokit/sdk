import {DrawTechnique} from "./DrawTechnique";
import {type RenderPassValue} from "../RENDER_PASSES";
import {type MeshBatch} from "../meshManager/MeshBatch";

/**
 * A draw operation (DrawOp) binds a {@link DrawTechnique} to a specific render pass.
 *
 * DrawOp is intentionally lightweight: it contains no rendering logic of its own.
 * Instead, it forwards draw calls to its {@link DrawTechnique}, supplying the
 * appropriate {@link RenderPassValue}.
 *
 * @internal
 */
export class DrawOp {

  /**
   * The draw technique that performs the actual rendering.
   */
  public readonly technique: DrawTechnique;

  /**
   * The render pass in which this draw operation is executed.
   */
  public readonly renderPass: RenderPassValue;

  /**
   * Creates a new DrawOp.
   *
   * @param technique - Draw technique responsible for issuing draw calls.
   * @param renderPass - Render pass to apply when drawing.
   */
  constructor(technique: DrawTechnique, renderPass: RenderPassValue) {
    this.technique = technique;
    this.renderPass = renderPass;
  }

  /**
   * Draws all meshes contained in the given {@link MeshBatch}.
   *
   * @param meshBatch - Batch of meshes to render.
   */
  public drawBatch(meshBatch: MeshBatch): void {
    this.technique.drawBatch(meshBatch, this.renderPass);
  }

  /**
   * Draws a single mesh from the given {@link MeshBatch}.
   *
   * @param meshBatch - Batch containing the mesh.
   * @param meshIndex - Index of the mesh within the batch.
   */
  public drawMesh(meshBatch: MeshBatch, meshIndex: number): void {
    this.technique.drawMesh(meshBatch, meshIndex, this.renderPass);
  }
}

