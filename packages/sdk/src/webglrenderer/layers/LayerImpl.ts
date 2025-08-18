import type {SceneMesh} from "../../scene";
import type {FloatArrayParam} from "../../math";
import {MeshCounts} from "./MeshCounts";
import type {RenderContext} from "../RenderContext";
import {OBJECT_FLAGS} from "./OBJECT_FLAGS";
import {RENDER_PASSES} from "./RENDER_PASSES";
import {PointsPrimitive} from "../../constants";
import {type Layer} from "./Layer";
import {type GPUDataMemoryEditor} from "../gpuDataMemory/GPUDataMemoryEditor";


/**
 * A Layer manages a batch of SceneMeshes that use the same primitive type.
 *
 * @private
 */
export class LayerImpl implements Layer  {

  /**
   * The render context associated with this layer.
   */
  renderContext: RenderContext;

  /**
   * Primitive type of the meshes in this layer.
   */
  primitive: number;

  /**
   * Base primitive index for this layer.
   */
  primitiveBase: number;

  /**
   * A unique identifier for sorting this layer in the renderer.
   */
  sortId: string;

  /**
   * Whether this layer supports Screen Space Ambient Occlusion (SSAO) rendering.
   */
  saoSupported: boolean;

  /**
   * The total number of indices in all meshes of this layer. This is used with WebGL draw calls to determine how many indices to render
   * when drawing this layer.
   */
  numIndices: number;

  /**
   * Counts of meshes and their visibility states for each view. These are used to build the render flags for the views.
   */
  meshCounts: MeshCounts[];

  /**
   * The GPUDataMemoryEditor instance used to manage the GPU data memory for this layer.
   * @private
   */
  private _gpuDataMemoryEditor: GPUDataMemoryEditor;

  constructor(layerParams: {
    renderContext: any;
    gpuDataMemoryEditor:GPUDataMemoryEditor;
    primitive: number;
  }) {
    const {renderContext, gpuDataMemoryEditor, primitive} = layerParams;
    this.renderContext = renderContext;
    this._gpuDataMemoryEditor = gpuDataMemoryEditor;
    this.primitive = primitive;
    this.primitiveBase = 0; // TODO
    this.sortId = `Layer-${primitive}`;
    this.numIndices = 0;
    this.saoSupported = false;

    // Preallocate meshCounts for 4 views
    this.meshCounts = Array.from({length: 4}, () => new MeshCounts());
  }

  get hash(): string {
    return `${this.primitive}`;
  }

  /**
   * Checks if a mesh can be added to this layer.
   * @param sceneMesh
   */
  canAddMesh(sceneMesh: SceneMesh): boolean {
    return true;
  }

  /**
   * Adds a mesh to the layer and updates the mesh counts and indices. Returns the index of the
   * added mesh in the layer's DTX memory.
   * @param sceneMesh
   */
  addMesh(sceneMesh: SceneMesh): number {
    const meshIndex = this._gpuDataMemoryEditor.addMesh(sceneMesh);
    const geometry = sceneMesh.geometry;
    this.numIndices += geometry.primitive === PointsPrimitive
      ? geometry.positionsCompressed.length / 3
      : geometry.indices.length;
    for (const counts of this.meshCounts) {
      counts.numMeshes++;
    }
    return meshIndex;
  }

  /**
   * Removes a mesh from the layer and updates the mesh counts and indices. We need to pass the view flags
   * to update the counts correctly, since the flags are stored for the object, not the mesh.
   * @param sceneMesh
   * @param viewFlags
   */
  removeMesh(sceneMesh: SceneMesh, viewFlags: number[]): void {
    this._gpuDataMemoryEditor.removeMesh(sceneMesh);
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
    const geometry = sceneMesh.geometry;
    this.numIndices -= geometry.primitive === PointsPrimitive
      ? geometry.positionsCompressed.length / 3
      : geometry.indices.length;
  }

  /**
   * Initializes mesh visibility and interaction counters for a given view,
   * based on initial flags and transparency state.
   *
   * @param viewIndex - Index of the view.
   * @param meshIndex - Index of the mesh within the layer.
   * @param flags - Bitmask of OBJECT_FLAGS representing initial mesh states.
   */
  initMeshFlags(viewIndex: number, meshIndex: number, flags: number): void {
    const counts = this.meshCounts[viewIndex];
    if ((flags & OBJECT_FLAGS.VISIBLE) !== 0) counts.numVisible++;
    if ((flags & OBJECT_FLAGS.HIGHLIGHTED) !== 0) counts.numHighlighted++;
    if ((flags & OBJECT_FLAGS.XRAYED) !== 0) counts.numXRayed++;
    if ((flags & OBJECT_FLAGS.SELECTED) !== 0) counts.numSelected++;
    if ((flags & OBJECT_FLAGS.CLIPPABLE) !== 0) counts.numClippable++;
    if ((flags & OBJECT_FLAGS.PICKABLE) !== 0) counts.numPickable++;
    if ((flags & OBJECT_FLAGS.CULLED) !== 0) counts.numCulled++;
    if ((flags & OBJECT_FLAGS.TRANSPARENT) !== 0) counts.numTransparent++;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets the render flags for a mesh in a specific view based on its visibility and interaction states.
   * @private
   */
  #setMeshObjectFlags(viewIndex: number, meshIndex: number, flags: number): void {
    const viewer = this.renderContext.viewer;
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
        colorFlag = isTransparent ? RENDER_PASSES.DRAW_TRANSPARENT : RENDER_PASSES.DRAW_OPAQUE;
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
      colorFlag |
      (silhouetteFlag << 4) |
      (pickFlag << 8) |
      (isClippable ? (1 << 12) : 0);

    // Apply attributes
    this._gpuDataMemoryEditor.setMeshViewAttributes(meshIndex, viewIndex, {
      flags: renderFlags
    });
  }

  /**
   * Sets per-view mesh visibility state.
   */
  setMeshVisible(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numVisible += (flags & OBJECT_FLAGS.VISIBLE) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh highlight state.
   */
  setMeshHighlighted(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numHighlighted += (flags & OBJECT_FLAGS.HIGHLIGHTED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh x-ray state.
   */
  setMeshXRayed(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numXRayed += (flags & OBJECT_FLAGS.XRAYED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh selected state.
   */
  setMeshSelected(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numSelected += (flags & OBJECT_FLAGS.SELECTED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh clippable state.
   */
  setMeshClippable(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numClippable += (flags & OBJECT_FLAGS.CLIPPABLE) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh culling state.
   */
  setMeshCulled(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numCulled += (flags & OBJECT_FLAGS.CULLED) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets per-view mesh pickable state.
   */
  setMeshPickable(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numPickable += (flags & OBJECT_FLAGS.PICKABLE) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets transparency per-view for the mesh.
   */
  setMeshTransparent(viewIndex: number, meshIndex: number, flags: number): void {
    this.meshCounts[viewIndex].numTransparent += (flags & OBJECT_FLAGS.TRANSPARENT) ? 1 : -1;
    this.#setMeshObjectFlags(viewIndex, meshIndex, flags);
  }

  /**
   * Sets a custom color per view for a mesh.
   */
  setMeshColor(viewIndex: number, meshIndex: number, color: FloatArrayParam): void {
    this._gpuDataMemoryEditor.setMeshViewAttributes(meshIndex, viewIndex, {
      color: <number[]>color
    });
  }

  /**
   * Sets the transformation matrix for a mesh.
   */
  setMeshMatrix(meshIndex: number, rtcMatrix: FloatArrayParam): void {
    this._gpuDataMemoryEditor.setMeshMatrix(meshIndex, rtcMatrix);
  }

  /**
   * Sets the tile index for a mesh.
   */
  setMeshTile(meshIndex: number, tileIndex: number): void {
    this._gpuDataMemoryEditor.setMeshAttributes(meshIndex, {
      tileIndex
    });
  }

  /**
   * Destroys this Layer instance.
   */
  destroy(): void {
    // Hook for cleanup if needed
  }
}
