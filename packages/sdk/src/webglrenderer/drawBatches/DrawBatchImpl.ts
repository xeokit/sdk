import type {SceneMesh} from "../../scene";
import type {FloatArrayParam} from "../../math";
import {MeshCounts} from "./MeshCounts";
import type {RenderContext} from "../RenderContext";
import {OBJECT_FLAGS} from "./OBJECT_FLAGS";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {type GPUMemoryWriteIF} from "../gpuMemory/GPUMemoryWriteIF";
import {DrawBatch} from "./DrawBatch";
import {GPUMemoryMeshHandle} from "../gpuMemory/GPUMemoryMeshHandle";

/**
 * A DrawBatchImpl manages a batch of SceneMeshes that use the same primitive type.
 *
 * @private
 */
export class DrawBatchImpl implements DrawBatch {

  /**
   * The render context associated with this batch.
   */
  private _renderContext: RenderContext;

  /**
   * The GPUMemoryWriteIF instance used to manage the GPU data gpuMemory for this batch.
   */
  private _gpuMemoryWriteIF: GPUMemoryWriteIF;

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
   * Counts of meshes and their visibility states for each view. These are used to build the render flags for the views.
   */
  meshCounts: MeshCounts[];

  /**
   * The index of this batch in the GPUMemory system.
   */
  public readonly gpuMemoryBatchIndex: number;

  /**
   * Creates a new DrawBatchImpl instance.
   * @param batchParams
   */
  constructor( batchParams: {
    renderContext: any;
    gpuMemoryWriteIF: GPUMemoryWriteIF;
    gpuMemoryBatchIndex : number;
    primitive: number;
  } ) {
    const {renderContext, gpuMemoryWriteIF, primitive} = batchParams;
    this._renderContext = renderContext;
    this._gpuMemoryWriteIF = gpuMemoryWriteIF;
    this.gpuMemoryBatchIndex = batchParams.gpuMemoryBatchIndex;
    this.primitive = primitive;
    this.primBaseIndex = 0; // TODO
    this.sortId = `batch-${primitive}`;
    this.numIndices = 0;
    this.numVertices = 0;
    this.saoSupported = false;

    // Preallocate meshCounts for 4 views
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
    return this._gpuMemoryWriteIF .hasMemoryForMesh(this.gpuMemoryBatchIndex, sceneMesh);
  }

  /**
   * Adds a mesh to the batch and updates the mesh counts and indices. Returns the tileIndex of the
   * added mesh in the batch's DTX gpuMemory.
   * @param sceneMesh
   */
  addMesh( sceneMesh: SceneMesh ): GPUMemoryMeshHandle {
    const meshHandle = this._gpuMemoryWriteIF.addMesh(this.gpuMemoryBatchIndex, sceneMesh);
    this.numIndices += meshHandle.numIndices;
    this.numVertices += meshHandle.numVertices;
    for (const counts of this.meshCounts) {
      counts.numMeshes++;
    }
    return meshHandle;
  }

  /**
   * Removes a mesh from the batch and updates the mesh counts and indices. We need to pass the view flags
   * to update the counts correctly, since the flags are stored for the object, not the mesh.
   * @param meshHandle
   * @param viewFlags
   */
  removeMesh( meshHandle : GPUMemoryMeshHandle, viewFlags: number[] ): void {
    this._gpuMemoryWriteIF.removeMesh(meshHandle);
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
    this.numIndices -= meshHandle.numIndices;
    this.numVertices -= meshHandle.numVertices;
  }

  /**
   * Initializes mesh visibility and interaction counters for a given view,
   * based on initial flags and transparency state.
   *
   * @param viewIndex - Index of the view.
   * @param meshHandle - Index of the mesh within the batch.
   * @param flags - Bitmask of OBJECT_FLAGS representing initial mesh states.
   */
  initMeshFlags( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
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
  _setMeshObjectFlags( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    const viewer = this._renderContext.viewer;
    const view = viewer.viewList[viewIndex];

    const isVisible = (flags & OBJECT_FLAGS.VISIBLE) !== 0;
    const isXRayed = (flags & OBJECT_FLAGS.XRAYED) !== 0;
    const isHighlighted = (flags & OBJECT_FLAGS.HIGHLIGHTED) !== 0;
    const isSelected = (flags & OBJECT_FLAGS.SELECTED) !== 0;
    const isPickable = (flags & OBJECT_FLAGS.PICKABLE) !== 0;
    const isCulled = (flags & OBJECT_FLAGS.CULLED) !== 0;
    const isClippable = (flags & OBJECT_FLAGS.CLIPPABLE) !== 0;
    const isTransparent = (flags & OBJECT_FLAGS.TRANSPARENT) !== 0;

    const notRenderable = !isVisible || isCulled;

    // Color flag (early return path fast)
    let colorFlag = RENDER_PASSES.NOT_RENDERED;
    if (!notRenderable) {
      const glowBlocked = (isHighlighted && !view.highlightMaterial.glowThrough) ||
        (isSelected && !view.selectedMaterial.glowThrough);
      if (!isXRayed && !glowBlocked) {
        colorFlag = isTransparent ? RENDER_PASSES.COLOR_TRANSPARENT : RENDER_PASSES.COLOR_OPAQUE;
      }
    }

    // Silhouette flag
    let silhouetteFlag = RENDER_PASSES.NOT_RENDERED;
    if (!notRenderable) {
      if (isSelected) {
        silhouetteFlag = RENDER_PASSES.SILHOUETTE_SELECTED;
      } else if (isHighlighted) {
        silhouetteFlag = RENDER_PASSES.SILHOUETTE_HIGHLIGHTED;
      } else if (isXRayed) {
        silhouetteFlag = RENDER_PASSES.SILHOUETTE_XRAYED;
      }
    }

    // Pick flag
    const pickFlag = (!notRenderable && isPickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;

    // Combine all flags into final bitfield
    const renderFlags =
      colorFlag | // What to do for the color pass - NOT_RENDERED, COLOR_OPAQUE, COLOR_TRANSPARENT
      (silhouetteFlag << 4) | // What to do for the silhouette pass - NOT_RENDERED, SILHOUETTE_SELECTED, SILHOUETTE_HIGHLIGHTED, SILHOUETTE_XRAYED
      (pickFlag << 8) | // What to do for the pick pass - NOT_RENDERED, PICK
      (isClippable ? (1 << 12) : 0); // Whether the object is clippable (1) or not (0)

    // Apply attributes
    this._gpuMemoryWriteIF.setMeshViewAttribs(meshHandle, viewIndex, {
      flags1: renderFlags
    });
  }

  /**
   * Sets per-view mesh visibility state.
   */
  setMeshVisible( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numVisible += (flags & OBJECT_FLAGS.VISIBLE) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh highlight state.
   */
  setMeshHighlighted( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numHighlighted += (flags & OBJECT_FLAGS.HIGHLIGHTED) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh x-ray state.
   */
  setMeshXRayed( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numXRayed += (flags & OBJECT_FLAGS.XRAYED) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh selected state.
   */
  setMeshSelected( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numSelected += (flags & OBJECT_FLAGS.SELECTED) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh clippable state.
   */
  setMeshClippable( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numClippable += (flags & OBJECT_FLAGS.CLIPPABLE) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh culling state.
   */
  setMeshCulled( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numCulled += (flags & OBJECT_FLAGS.CULLED) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets per-view mesh pickable state.
   */
  setMeshPickable( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numPickable += (flags & OBJECT_FLAGS.PICKABLE) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets transparency per-view for the mesh.
   */
  setMeshTransparent( viewIndex: number, meshHandle: GPUMemoryMeshHandle, flags: number ): void {
    this.meshCounts[viewIndex].numTransparent += (flags & OBJECT_FLAGS.TRANSPARENT) ? 1 : -1;
    this._setMeshObjectFlags(viewIndex, meshHandle, flags);
  }

  /**
   * Sets a custom color per view for a mesh.
   */
  setMeshColor( viewIndex: number, meshHandle: GPUMemoryMeshHandle, color: FloatArrayParam ): void {
    this._gpuMemoryWriteIF.setMeshViewAttribs(meshHandle, viewIndex, {
      color: <number[]>color
    });
  }

  /**
   * Sets the transformation matrix for a mesh.
   */
  setMeshMatrix( meshHandle: GPUMemoryMeshHandle, rtcMatrix: FloatArrayParam ): void {
    this._gpuMemoryWriteIF.setMeshMatrix(meshHandle, rtcMatrix);
  }

  /**
   * Sets the tile tileIndex for a mesh.
   */
  setMeshTile( meshHandle: GPUMemoryMeshHandle, tileIndex: number ): void {
    this._gpuMemoryWriteIF.setMeshAttribs(meshHandle, {
      tileIndex
    });
  }

  /**
   * Destroys this DrawBatchImpl instance.
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
    this._gpuMemoryWriteIF = null;
  }
}
