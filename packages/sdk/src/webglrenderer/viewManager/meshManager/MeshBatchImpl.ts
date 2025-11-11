import type {SceneMesh} from "../../../scene";
import type {FloatArrayParam} from "../../../math";
import type {RenderContext} from "../RenderContext";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {type GPUMemoryEditor} from "../gpuMemoryManager/GPUMemoryEditor";
import {MeshBatch} from "./MeshBatch";
import {MeshBatchMeshHandle} from "./MeshBatchMeshHandle";
import {GPUMemoryMeshHandle} from "../gpuMemoryManager/GPUMemoryMeshHandle";
import {GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";

/**
 * A MeshBatchImpl manages a batch of SceneMeshes that use the same primitive type.
 *
 * @private
 */
export class MeshBatchImpl implements MeshBatch {

  /**
   * The render context associated with this batch.
   */
  private _renderContext: RenderContext;

  /**
   * The GPUMemoryEditor instance used to manage the GPU data memory for this batch.
   */
  private _gpuMemoryEditor: GPUMemoryEditor;

  /**
   * Primitive type of the meshes in this batch.
   */
  primitive: number;

  /**
   * Base primitive tileIndex for this batch.
   */
  primBaseIndex: number;

  /**
   * A unique identifier for sorting this batch in the renderer.
   */
  sortId: string;

  /**
   * Whether this batch supports Screen Space Ambient Occlusion (SSAO) rendering.
   */
  saoSupported: boolean;

  /**
   * The total number of indices in all meshes of this batch. This is used with WebGL render calls to determine how many indices to render
   * when drawing this batch.
   */
  numIndices: number;

  /**
   * The total number of vertices in all meshes of this batch. This is used for various calculations and optimizations related to rendering.
   */
  numVertices: number;

  /**
   * The index of this batch in the GPUMemoryManager system.
   */
  public readonly gpuMemoryBatchIndex: number;

  /**
   * Creates a new MeshBatchImpl instance.
   * @param batchParams
   */
  constructor( batchParams: {
    renderContext: RenderContext;
    gpuMemoryEditor: GPUMemoryEditor;
    gpuMemoryBatchIndex : number;
    primitive: number;
  } ) {
    const {renderContext, gpuMemoryEditor, primitive} = batchParams;
    this._renderContext = renderContext;
    this._gpuMemoryEditor = gpuMemoryEditor;
    this.gpuMemoryBatchIndex = batchParams.gpuMemoryBatchIndex;
    this.primitive = primitive;
    this.primBaseIndex = 0; // TODO
    this.sortId = `batch-${primitive}`;
    this.numIndices = 0;
    this.numVertices = 0;
    this.saoSupported = false;
  }

  /**
   * A hash string representing this batch, used for quick comparisons.
   */
  get hash(): string {
    return `${this.primitive}`;
  }

  /**
   * Determines if there are any meshes in this batch that should be rendered in the specified render pass for the given view.
   * @param viewIndex
   * @param renderPass
   */
  hasMeshesInRenderPass(viewIndex: number, renderPass: RENDER_PASSES ): boolean {
    return (<GPUMemoryReader>this._gpuMemoryEditor).dataTextures.batches[this.gpuMemoryBatchIndex]
        ?.views[viewIndex]
        ?.renderPassDrawRanges.get(<number>renderPass)
        ?.numPrims! > 0; // Single point-of-truth for mesh counts
  }

  /**
   * Checks if a mesh can be added to this batch.
   * @param sceneMesh
   */
  canAddMesh( sceneMesh: SceneMesh ): boolean {
    return this._gpuMemoryEditor .hasMemoryForMesh(this.gpuMemoryBatchIndex, sceneMesh);
  }

  /**
   * Adds a mesh to the batch and updates the mesh counts and indices. Returns the tileIndex of the
   * added mesh in the batch's DTX memory.
   * @param sceneMesh
   */
  addMesh( sceneMesh: SceneMesh ): MeshBatchMeshHandle {
    const gpuMeshHandle = this._gpuMemoryEditor.addMesh(this.gpuMemoryBatchIndex, sceneMesh);
    this.numIndices += gpuMeshHandle.numIndices;
    this.numVertices += gpuMeshHandle.numVertices;
    return gpuMeshHandle as MeshBatchMeshHandle;
  }

  /**
   * Removes a mesh from the batch and updates the mesh counts and indices. We need to pass the view flags
   * to update the counts correctly, since the flags are stored for the object, not the mesh.
   * @param meshHandle
   */
  removeMesh(meshHandle : MeshBatchMeshHandle ): void {
    const gpuMeshHandle = meshHandle as GPUMemoryMeshHandle;
    this._gpuMemoryEditor.removeMesh(gpuMeshHandle );
    this.numIndices -= gpuMeshHandle.numIndices;
    this.numVertices -= gpuMeshHandle.numVertices;
  }

  /**
   * Gets the SceneMesh at the specified index in this batch, if it exists.
   * @param meshIndex
   */
  getMeshAtIndex( meshIndex: number ): SceneMesh | null {
    return this._gpuMemoryEditor.getMeshAtIndex(this.gpuMemoryBatchIndex, meshIndex);
  }

  /**
   * Gets the parameters needed for a drawArrays call for a specific mesh in this batch.
   * @param meshIndex
   */
  getDrawArraysParamsForMesh( meshIndex: number ): { first: number; count: number } | null {
    return this._gpuMemoryEditor.getDrawArraysParamsForMesh(this.gpuMemoryBatchIndex,  meshIndex);
  }

  /**
   * Sets the render flags for a mesh in a specific view based on its visibility and interaction states.
   * @private
   */
  _setMeshObjectFlags(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    // const isPickable = (renderFlags & RENDER_FLAGS.PICKABLE) !== 0;
    // const isClippable = (renderFlags & RENDER_FLAGS.CLIPPABLE) !== 0;
    // const pickFlag = isPickable ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
    // const renderFlags2 = pickFlag | (isClippable << 4);
    // this._gpuMemoryEditor.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
    //   renderFlags: renderFlags2
    // });
  }

  /**
   * Sets per-view mesh visibility state.
   */
  setMeshVisible(viewIndex: number, meshHandle: MeshBatchMeshHandle, visible: boolean ): void {
    this._gpuMemoryEditor.setMeshVisible( meshHandle as GPUMemoryMeshHandle, viewIndex, visible);
  }

  /**
   *
   */
  setMeshOpaque(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this._gpuMemoryEditor.setMeshRenderPass( meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.OPAQUE);
  }

  /**
   * Sets transparency per-view for the mesh.
   */
  setMeshTransparent(viewIndex: number, meshHandle: MeshBatchMeshHandle, transparent: boolean ): void {
    if (transparent) {
      this._gpuMemoryEditor.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.TRANSPARENT);
    } else {
        this._gpuMemoryEditor.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.OPAQUE);
    }
  }

  /**
   * Sets per-view mesh highlight state.
   */
  setMeshHighlighted(viewIndex: number, meshHandle: MeshBatchMeshHandle, highlighted: boolean , transparent: boolean): void {
    if (highlighted) {
      this._gpuMemoryEditor.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.HIGHLIGHTED);
    } else {
      this._gpuMemoryEditor.setMeshRenderPass(meshHandle, viewIndex,
          transparent?RENDER_PASSES.TRANSPARENT:RENDER_PASSES.OPAQUE);
    }
  }

  /**
   * Sets per-view mesh x-ray state.
   */
  setMeshXRayed(viewIndex: number, meshHandle: MeshBatchMeshHandle, xrayed: boolean, transparent: boolean ): void {
    if (xrayed) {
      this._gpuMemoryEditor.setMeshRenderPass(meshHandle, viewIndex, RENDER_PASSES.XRAYED);
    } else {
        this._gpuMemoryEditor.setMeshRenderPass(meshHandle, viewIndex,
            transparent?RENDER_PASSES.TRANSPARENT:RENDER_PASSES.OPAQUE);
    }
  }

  /**
   * Sets per-view mesh selected state.
   */
  setMeshSelected(viewIndex: number, meshHandle: MeshBatchMeshHandle, selected: boolean ,  transparent: boolean): void {
    if (selected) {
      this._gpuMemoryEditor.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.SELECTED);
    } else {
      this._gpuMemoryEditor.setMeshRenderPass(meshHandle, viewIndex,
          transparent?RENDER_PASSES.TRANSPARENT:RENDER_PASSES.OPAQUE);
    }
  }

  /**
   * Sets per-view mesh clippable state.
   */
  setMeshClippable(viewIndex: number, meshHandle: MeshBatchMeshHandle, clippable: boolean): void {
   // this.meshCounts[viewIndex].numClippable += clippable ? 1 : -1;
    //this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
  }

  /**
   * Sets per-view mesh culling state.
   */
  setMeshCulled(viewIndex: number, meshHandle: MeshBatchMeshHandle, culled: boolean ): void {
   // this.meshCounts[viewIndex].numCulled += culled ? 1 : -1;
   // this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
  }

  /**
   * Sets per-view mesh pickable state.
   */
  setMeshPickable(viewIndex: number, meshHandle: MeshBatchMeshHandle, pickable: boolean ): void {
   // this.meshCounts[viewIndex].numPickable += pickable ? 1 : -1;
   // this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
  }

  /**
   * Sets a custom color per view for a mesh.
   */
  setMeshColor(viewIndex: number, meshHandle: MeshBatchMeshHandle, color: FloatArrayParam ): void {
    this._gpuMemoryEditor.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
      color: <number[]>color
    });
  }

  /**
   * Sets the transformation matrix for a mesh.
   */
  setMeshMatrix(meshHandle: MeshBatchMeshHandle, rtcMatrix: FloatArrayParam ): void {
    this._gpuMemoryEditor.setMeshMatrix(meshHandle as GPUMemoryMeshHandle, rtcMatrix);
  }

  /**
   * Sets the tile tileIndex for a mesh.
   */
  setMeshTile(meshHandle: MeshBatchMeshHandle, tileIndex: number ): void {
    this._gpuMemoryEditor.setMeshAttribs(meshHandle as GPUMemoryMeshHandle, {
      tileIndex
    });
  }

  /**
   * Destroys this MeshBatchImpl instance.
   */
  destroy(): void {
    this._renderContext = null;
    this._gpuMemoryEditor = null;
  }
}
