import type {SceneMesh} from "../../../scene";
import type {FloatArrayParam} from "../../../math";
import {MeshCounts} from "./MeshCounts";
import type {RenderContext} from "../../RenderContext";
import {RENDER_FLAGS} from "./RENDER_FLAGS";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {type GPUMemoryEditor} from "../gpuMemoryManager/GPUMemoryEditor";
import {MeshBatch} from "./MeshBatch";
import {MeshBatchMeshHandle} from "./MeshBatchMeshHandle";
import {GPUMemoryMeshHandle} from "../gpuMemoryManager/GPUMemoryMeshHandle";

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
   * Counts of meshes and their visibility states for each view. These are used to build the render flags for the viewManager.
   */
  meshCounts: MeshCounts[];

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
    const gpuMeshHandle = meshHandle as GPUMemoryMeshHandle;
    this._gpuMemoryEditor.removeMesh(gpuMeshHandle );
    for (let viewIndex = 0; viewIndex < 4; viewIndex++) {
      const counts = this.meshCounts[viewIndex];
      const renderFlags = viewFlags[viewIndex];
      if ((renderFlags & RENDER_FLAGS.VISIBLE) !== 0) counts.numVisible--;
      if ((renderFlags & RENDER_FLAGS.HIGHLIGHTED) !== 0) counts.numHighlighted--;
      if ((renderFlags & RENDER_FLAGS.XRAYED) !== 0) counts.numXRayed--;
      if ((renderFlags & RENDER_FLAGS.SELECTED) !== 0) counts.numSelected--;
      if ((renderFlags & RENDER_FLAGS.CLIPPABLE) !== 0) counts.numClippable--;
      if ((renderFlags & RENDER_FLAGS.PICKABLE) !== 0) counts.numPickable--;
      if ((renderFlags & RENDER_FLAGS.CULLED) !== 0) counts.numCulled--;
      if ((renderFlags & RENDER_FLAGS.TRANSPARENT) !== 0) counts.numTransparent--;
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
   * Initializes mesh visibility and interaction counters for a given view,
   * based on initial flags and transparency state.
   *
   * @param viewIndex - Index of the view.
   * @param meshHandle - Index of the mesh within the batch.
   * @param renderFlags - Bitmask of RENDER_FLAGS representing initial mesh states.
   */
  initMeshFlags(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    const counts = this.meshCounts[viewIndex];
    if ((renderFlags & RENDER_FLAGS.VISIBLE) !== 0) counts.numVisible++;
    if ((renderFlags & RENDER_FLAGS.HIGHLIGHTED) !== 0) counts.numHighlighted++;
    if ((renderFlags & RENDER_FLAGS.XRAYED) !== 0) counts.numXRayed++;
    if ((renderFlags & RENDER_FLAGS.SELECTED) !== 0) counts.numSelected++;
    if ((renderFlags & RENDER_FLAGS.CLIPPABLE) !== 0) counts.numClippable++;
    if ((renderFlags & RENDER_FLAGS.PICKABLE) !== 0) counts.numPickable++;
    if ((renderFlags & RENDER_FLAGS.CULLED) !== 0) counts.numCulled++;
    if ((renderFlags & RENDER_FLAGS.TRANSPARENT) !== 0) counts.numTransparent++;
    this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
  }

  /**
   * Sets the render flags for a mesh in a specific view based on its visibility and interaction states.
   * @private
   */
  _setMeshObjectFlags(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    const isPickable = (renderFlags & RENDER_FLAGS.PICKABLE) !== 0;
    const isClippable = (renderFlags & RENDER_FLAGS.CLIPPABLE) !== 0;
    const pickFlag = isPickable ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
    const renderFlags2 = pickFlag | (isClippable << 4);
    this._gpuMemoryEditor.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
      renderFlags: renderFlags2
    });
  }

  /**
   * Sets per-view mesh visibility state.
   */
  setMeshVisible(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    const visible = (renderFlags & RENDER_FLAGS.VISIBLE) !== 0;
    this.meshCounts[viewIndex].numVisible += visible? 1 : -1;
    this._gpuMemoryEditor.setMeshVisible( meshHandle as GPUMemoryMeshHandle, viewIndex, visible);
  }

  /**
   *
   */
  setMeshOpaque(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numTransparent += (renderFlags & RENDER_FLAGS.TRANSPARENT) ? 1 : -1;
    this._gpuMemoryEditor.setMeshRenderPass( meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.OPAQUE);
  }

  /**
   * Sets transparency per-view for the mesh.
   */
  setMeshTransparent(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numTransparent += (renderFlags & RENDER_FLAGS.TRANSPARENT) ? 1 : -1;
    this._gpuMemoryEditor.setMeshRenderPass( meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.TRANSPARENT);
  }

  /**
   * Sets per-view mesh highlight state.
   */
  setMeshHighlighted(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numHighlighted += (renderFlags & RENDER_FLAGS.HIGHLIGHTED) ? 1 : -1;
    this._gpuMemoryEditor.setMeshRenderPass( meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.HIGHLIGHTED);
  }

  /**
   * Sets per-view mesh x-ray state.
   */
  setMeshXRayed(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numXRayed += (renderFlags & RENDER_FLAGS.XRAYED) ? 1 : -1;
    this._gpuMemoryEditor.setMeshRenderPass( meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.XRAYED);
  }

  /**
   * Sets per-view mesh selected state.
   */
  setMeshSelected(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numSelected += (renderFlags & RENDER_FLAGS.SELECTED) ? 1 : -1;
    this._gpuMemoryEditor.setMeshRenderPass( meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.SELECTED);
  }

  /**
   * Sets per-view mesh clippable state.
   */
  setMeshClippable(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numClippable += (renderFlags & RENDER_FLAGS.CLIPPABLE) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
  }

  /**
   * Sets per-view mesh culling state.
   */
  setMeshCulled(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numCulled += (renderFlags & RENDER_FLAGS.CULLED) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
  }

  /**
   * Sets per-view mesh pickable state.
   */
  setMeshPickable(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number ): void {
    this.meshCounts[viewIndex].numPickable += (renderFlags & RENDER_FLAGS.PICKABLE) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
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
    this._gpuMemoryEditor = null;
  }
}
