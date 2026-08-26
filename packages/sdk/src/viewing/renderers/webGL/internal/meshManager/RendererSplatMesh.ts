import type {SceneMesh} from "../../../../../model/scene";
import type {Mat4} from "../../../../../base/math/matrix";
import type {PortionHandle} from "../gpuMemoryManager/dataTextures/PortionDataTexture";
import type {SplatBatch} from "../gpuMemoryManager/SplatBatch";

/**
 * Renderer-side handle for a gaussian-splat {@link SceneMesh} — the splat
 * analogue of `RendererMesh`, but minimal: the splat records live in the shared
 * {@link SplatBatch} texture, so this just ties the SceneMesh to its batch
 * portion so it can be streamed out on destroy.
 */
export class RendererSplatMesh {
  constructor(
    public readonly sceneMesh: SceneMesh,
    private readonly _splatBatch: SplatBatch,
    private readonly _handle: PortionHandle,
    /** Stable id identifying this mesh's splats in the pick pass. */
    public readonly pickId: number,
  ) {}

  /**
   * Re-bakes this mesh's splats with a new world matrix (live re-transform).
   * Called when the SceneMesh's matrix changes.
   */
  setMatrix(worldMatrix: Mat4): void {
    const geom = this.sceneMesh.geometry;
    if (!geom.scales || !geom.rotations || !geom.aabb) return;
    this._splatBatch.updateSplats(this._handle, {
      positionsCompressed: geom.positionsCompressed,
      aabb: geom.aabb,
      scales: geom.scales,
      rotations: geom.rotations,
      colorsCompressed: geom.colorsCompressed,
    }, worldMatrix, this.pickId);
  }

  /** Streams this mesh's splats out of the batch. */
  destroy(): void {
    this._splatBatch.removeSplats(this._handle);
  }
}
