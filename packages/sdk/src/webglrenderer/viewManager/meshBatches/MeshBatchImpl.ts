import type {SceneMesh} from "../../../scene";
import type {FloatArrayParam} from "../../../math";
import {MeshCounts} from "./MeshCounts";
import type {RenderContext} from "../../RenderContext";
import {OBJECT_FLAGS} from "./OBJECT_FLAGS";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {type DTXMemoryEditor} from "../dtxMemory/DTXMemoryEditor";
import {MeshBatch} from "./MeshBatch";
import {MeshBatchMeshHandle} from "./MeshBatchMeshHandle";
import {DTXMemoryMeshHandle} from "../dtxMemory/DTXMemoryMeshHandle";

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
   * The DTXMemoryEditor instance used to manage the GPU data memory for this batch.
   */
  private _dtxMemoryEditor: DTXMemoryEditor;

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
   * Counts of meshes and their visibility states for each view. These are used to build the render flags for the viewManager.
   */
  meshCounts: MeshCounts[];

  /**
   * The index of this batch in the DTXMemory system.
   */
  public readonly dtxMemoryBatchIndex: number;

  /**
   * Creates a new MeshBatchImpl instance.
   * @param batchParams
   */
  constructor( batchParams: {
    renderContext: RenderContext;
    dtxMemoryEditor: DTXMemoryEditor;
    dtxMemoryBatchIndex : number;
    primitive: number;
  } ) {
    const {renderContext, dtxMemoryEditor, primitive} = batchParams;
    this._renderContext = renderContext;
    this._dtxMemoryEditor = dtxMemoryEditor;
    this.dtxMemoryBatchIndex = batchParams.dtxMemoryBatchIndex;
    this.primitive = primitive;
    this.primBaseIndex = 0; // TODO
    this.sortId = `batch-${primitive}`;
    this.numIndices = 0;
    this.numVertices = 0;
    this.saoSupported = false;

    // Preallocate meshCounts for 4 viewManager
    this.meshCounts = Array.from({length: 4}, () => new MeshCounts());
  }

  /**
   * A hash string representing this batch, used for quick comparisons.
   */
  get hash(): string {
    return `${this.primitive}`;
  }

  /**
   * Checks if a mesh can be added to this batch.
   * @param sceneMesh
   */
  canAddMesh( sceneMesh: SceneMesh ): boolean {
    return this._dtxMemoryEditor .hasMemoryForMesh(this.dtxMemoryBatchIndex, sceneMesh);
  }

  /**
   * Adds a mesh to the batch and updates the mesh counts and indices. Returns the tileIndex of the
   * added mesh in the batch's DTX memory.
   * @param sceneMesh
   */
  addMesh( sceneMesh: SceneMesh ): MeshBatchMeshHandle {
    const gpuMeshHandle = this._dtxMemoryEditor.addMesh(this.dtxMemoryBatchIndex, sceneMesh);
    this.numIndices += gpuMeshHandle.numIndices;
    this.numVertices += gpuMeshHandle.numVertices;
    for (const counts of this.meshCounts) {
      counts.numMeshes++;
    }
    return gpuMeshHandle as MeshBatchMeshHandle;
  }

  /**
   * Removes a mesh from the batch and updates the mesh counts and indices. We need to pass the view flags
   * to update the counts correctly, since the flags are stored for the object, not the mesh.
   * @param meshHandle
   * @param viewFlags
   */
  removeMesh(meshHandle : MeshBatchMeshHandle, viewFlags: number[] ): void {
    const gpuMeshHandle = meshHandle as DTXMemoryMeshHandle;
    this._dtxMemoryEditor.removeMesh(gpuMeshHandle );
    for (let viewIndex = 0; viewIndex < 4; viewIndex++) {
      const counts = this.meshCounts[viewIndex];
      const flags = viewFlags[viewIndex];
      if ((flags & OBJECT_FLAGS.VISIBLE) !== 0) counts.numVisible--;
      if ((flags & OBJECT_FLAGS.HIGHLIGHTED) !== 0) counts.numHighlighted--;
      if ((flags & OBJECT_FLAGS.XRAYED) !== 0) counts.numXRayed--;
      if ((flags & OBJECT_FLAGS.SELECTED) !== 0) counts.numSelected--;
      if ((flags & OBJECT_FLAGS.CLIPPABLE) !== 0) counts.numClippable--;
      if ((flags & OBJECT_FLAGS.PICKABLE) !== 0) counts.numPickable--;
      if ((flags & OBJECT_FLAGS.CULLED) !== 0) counts.numCulled--;
      if ((flags & OBJECT_FLAGS.TRANSPARENT) !== 0) counts.numTransparent--;
      counts.numMeshes--;
    }
    this.numIndices -= gpuMeshHandle.numIndices;
    this.numVertices -= gpuMeshHandle.numVertices;
  }

  /**
   * Gets the SceneMesh at the specified index in this batch, if it exists.
   * @param meshIndex
   */
  getMeshAtIndex( meshIndex: number ): SceneMesh | null {
    return this._dtxMemoryEditor.getMeshAtIndex(this.dtxMemoryBatchIndex, meshIndex);
  }

  /**
   * Gets the parameters needed for a drawArrays call for a specific mesh in this batch.
   * @param meshIndex
   */
  getDrawArraysParamsForMesh( meshIndex: number ): { first: number; count: number } | null {
    return this._dtxMemoryEditor.getDrawArraysParamsForMesh(this.dtxMemoryBatchIndex,  meshIndex);
  }

  /**
   * Initializes mesh visibility and interaction counters for a given view,
   * based on initial flags and transparency state.
   *
   * @param viewIndex - Index of the view.
   * @param meshHandle - Index of the mesh within the batch.
   * @param flags - Bitmask of OBJECT_FLAGS representing initial mesh states.
   */
  initMeshFlags(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    const counts = this.meshCounts[viewIndex];
    if ((flags & OBJECT_FLAGS.VISIBLE) !== 0) counts.numVisible++;
    if ((flags & OBJECT_FLAGS.HIGHLIGHTED) !== 0) counts.numHighlighted++;
    if ((flags & OBJECT_FLAGS.XRAYED) !== 0) counts.numXRayed++;
    if ((flags & OBJECT_FLAGS.SELECTED) !== 0) counts.numSelected++;
    if ((flags & OBJECT_FLAGS.CLIPPABLE) !== 0) counts.numClippable++;
    if ((flags & OBJECT_FLAGS.PICKABLE) !== 0) counts.numPickable++;
    if ((flags & OBJECT_FLAGS.CULLED) !== 0) counts.numCulled++;
    if ((flags & OBJECT_FLAGS.TRANSPARENT) !== 0) counts.numTransparent++;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets the render flags for a mesh in a specific view based on its visibility and interaction states.
   * @private
   */
  _setMeshObjectFlags(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    const isPickable = (flags & OBJECT_FLAGS.PICKABLE) !== 0;
    const isClippable = (flags & OBJECT_FLAGS.CLIPPABLE) !== 0;
    const pickFlag = isPickable ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
    const renderFlags = pickFlag | (isClippable << 4);
    this._dtxMemoryEditor.setMeshViewAttribs(meshHandle as DTXMemoryMeshHandle, viewIndex, {
      flags1: renderFlags
    });
  }

  /**
   * Sets per-view mesh visibility state.
   */
  setMeshVisible(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    const visible = (flags & OBJECT_FLAGS.VISIBLE) !== 0;
    this.meshCounts[viewIndex].numVisible += visible? 1 : -1;
    this._dtxMemoryEditor.setMeshCulled( meshHandle as DTXMemoryMeshHandle, viewIndex, !visible);
  }

  /**
   *
   */
  setMeshOpaque(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numTransparent += (flags & OBJECT_FLAGS.TRANSPARENT) ? 1 : -1;
    this._dtxMemoryEditor.setMeshRenderPass( meshHandle as DTXMemoryMeshHandle, viewIndex, RENDER_PASSES.OPAQUE);
  }

  /**
   * Sets transparency per-view for the mesh.
   */
  setMeshTransparent(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numTransparent += (flags & OBJECT_FLAGS.TRANSPARENT) ? 1 : -1;
    this._dtxMemoryEditor.setMeshRenderPass( meshHandle as DTXMemoryMeshHandle, viewIndex, RENDER_PASSES.TRANSPARENT);
  }

  /**
   * Sets per-view mesh highlight state.
   */
  setMeshHighlighted(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numHighlighted += (flags & OBJECT_FLAGS.HIGHLIGHTED) ? 1 : -1;
    this._dtxMemoryEditor.setMeshRenderPass( meshHandle as DTXMemoryMeshHandle, viewIndex, RENDER_PASSES.HIGHLIGHTED);
  }

  /**
   * Sets per-view mesh x-ray state.
   */
  setMeshXRayed(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numXRayed += (flags & OBJECT_FLAGS.XRAYED) ? 1 : -1;
    this._dtxMemoryEditor.setMeshRenderPass( meshHandle as DTXMemoryMeshHandle, viewIndex, RENDER_PASSES.XRAYED);
  }

  /**
   * Sets per-view mesh selected state.
   */
  setMeshSelected(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numSelected += (flags & OBJECT_FLAGS.SELECTED) ? 1 : -1;
    this._dtxMemoryEditor.setMeshRenderPass( meshHandle as DTXMemoryMeshHandle, viewIndex, RENDER_PASSES.SELECTED);
  }

  /**
   * Sets per-view mesh clippable state.
   */
  setMeshClippable(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numClippable += (flags & OBJECT_FLAGS.CLIPPABLE) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh culling state.
   */
  setMeshCulled(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numCulled += (flags & OBJECT_FLAGS.CULLED) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh pickable state.
   */
  setMeshPickable(viewIndex: number, meshHandle: MeshBatchMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numPickable += (flags & OBJECT_FLAGS.PICKABLE) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets a custom color per view for a mesh.
   */
  setMeshColor(viewIndex: number, meshHandle: MeshBatchMeshHandle, color: FloatArrayParam ): void {
    this._dtxMemoryEditor.setMeshViewAttribs(meshHandle as DTXMemoryMeshHandle, viewIndex, {
      color: <number[]>color
    });
  }

  /**
   * Sets the transformation matrix for a mesh.
   */
  setMeshMatrix(meshHandle: MeshBatchMeshHandle, rtcMatrix: FloatArrayParam ): void {
    this._dtxMemoryEditor.setMeshMatrix(meshHandle as DTXMemoryMeshHandle, rtcMatrix);
  }

  /**
   * Sets the tile tileIndex for a mesh.
   */
  setMeshTile(meshHandle: MeshBatchMeshHandle, tileIndex: number ): void {
    this._dtxMemoryEditor.setMeshAttribs(meshHandle as DTXMemoryMeshHandle, {
      tileIndex
    });
  }

  /**
   * Destroys this MeshBatchImpl instance.
   */
  destroy(): void {
    for (const counts of this.meshCounts) {
      counts.numMeshes = 0;
      counts.numVisible = 0;
      counts.numHighlighted = 0;
      counts.numXRayed = 0;
      counts.numSelected = 0;
      counts.numClippable = 0;
      counts.numPickable = 0;
      counts.numCulled = 0;
      counts.numTransparent = 0;
    }
    this.meshCounts.length = 0;
    this._renderContext = null;
    this._dtxMemoryEditor = null;
  }
}
