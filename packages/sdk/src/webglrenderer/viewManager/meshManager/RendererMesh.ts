import {
  createVec4Float64,
  subVec3,
 type Vec3,
} from "../../../math/vector";
import {
  createMat4Float64,
  transformPoint4,
  type Mat4,
  identityMat4,
} from "../../../math/matrix";
import type {MeshBatchImpl} from "./MeshBatchImpl";
import type {RenderContext} from "../RenderContext";
import {type SceneMesh} from "../../../scene";
import {type GPUTile} from "../gpuMemoryManager/GPUTile";
import {type GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import {type MeshBatchMeshHandle} from "./MeshBatchMeshHandle";

const tempIdentityMat4 = identityMat4(createMat4Float64());
const identityVec4 = createVec4Float64([0, 0, 0, 1]);
const tempVec4a = createVec4Float64();

const NUM_VIEWS = 4;


/**
 * Represents a single mesh within the WebGL renderer, managing its GPU tile assignment,
 * transformation matrix, color, opacity, and various rendering states across multiple views.
 *
 * @remarks
 * - `RendererMesh` is the GPU-side representation of a scene mesh, bridging scene/view state to GPU memory.
 * - Each `RendererMesh` is owned by a {@link RendererObject}, which groups all meshes belonging to a single logical scene object.
 * - `RendererMesh` instances are managed and batched by {@link MeshBatchImpl}, which organizes compatible meshes for efficient GPU upload and draw calls.
 * - The {@link MeshManager} (or MeshBatchRegistry) coordinates the creation, update, and removal of `RendererMesh` instances, responding to scene/view changes and synchronizing with the GPU memory manager.
 * - Maintains a reference to its assigned {@link GPUTile}, which defines the mesh's RTC (Relative To Center) coordinate system for high-precision rendering.
 * - Tracks per-view state such as color, opacity, visibility, highlighting, selection, and x-ray status.
 * - Handles updates to transformation matrices and notifies the GPU memory manager when changes require re-upload.
 * - All tiling, RTC, and GPU memory logic is encapsulated by the memory management layer.
 *
 * @internal
 */
export class RendererMesh {

  /**
   * The GPU tile currently assigned to this mesh.
   *
   * @remarks
   * - This tile defines the mesh's local RTC (Relative To Center) coordinate system for high-precision rendering.
   * - The tile is managed and updated automatically by the GPU memory management layer; it may change if the mesh moves in world space.
   * - RendererMesh does not manage tiling logic directly—tile assignment and RTC matrix updates are fully encapsulated by {@link GPUMemoryManager} and {@link GPUTileManager}.
   * - This reference is used for efficient mesh picking and RTC-space transformations.
   */
  public gpuTile: GPUTile;

  private readonly _renderContext: RenderContext;
  private readonly _sceneMesh: SceneMesh;
  private readonly _meshBatch: MeshBatchImpl;
  private readonly _meshHandle: MeshBatchMeshHandle;
  private readonly _gpuMemoryManager: GPUMemoryManager;
  private readonly _viewStates: {
    colorizing: boolean;
    coloringOpacity?: boolean;
    transparent: boolean;
    objectVisible: boolean;
    meshVisible: boolean;
  }[];

  /**
   * Constructs a RendererMesh instance.
   */
  constructor({
                sceneMesh,
                meshBatch,
                renderContext,
                gpuMemoryManager,
                meshHandle
              }: {
    sceneMesh: SceneMesh;
    meshBatch: MeshBatchImpl;
    renderContext: RenderContext;
    gpuMemoryManager: GPUMemoryManager;
    meshHandle: MeshBatchMeshHandle;
  }) {

    this._renderContext = renderContext;
    this._sceneMesh = sceneMesh;
    this._meshBatch = meshBatch;
    this._gpuMemoryManager = gpuMemoryManager;
    this._meshHandle = meshHandle;
    this.gpuTile = null;

    // Color / opacity -> 0..255
    const rgb = sceneMesh.color ?? [1, 1, 1];
    const r = Math.floor(rgb[0] * 255);
    const g = Math.floor(rgb[1] * 255);
    const b = Math.floor(rgb[2] * 255);
    const a = sceneMesh.opacity != null ? Math.floor(sceneMesh.opacity * 255) : 255;
    const transparent = a < 255;

    this._viewStates = Array.from({length: NUM_VIEWS}, () => ({
      colorizing: false,
      coloringOpacity: false,
      transparent,
      objectVisible: true,
      meshVisible: true
    }));

    this.setMatrix(sceneMesh.globalMatrix);
  }

  /**
   * Sets the transformation matrix for the mesh.
   * Called by {@link RendererObject.setMatrix}.
   */
  setMatrix(matrix: Mat4): void {
    matrix = matrix || tempIdentityMat4;
    const center:Vec3 = <Vec3>transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.gpuTile;
    this.gpuTile = oldTile
      ? this._gpuMemoryManager.moveTile(oldTile, center)
      : this._gpuMemoryManager.getTile(center);
    const tileChanged = !oldTile || oldTile.id !== this.gpuTile.id;
    if (tileChanged) {
      this._meshBatch.setMeshTile(this._meshHandle, this.gpuTile.tileIndex);
    }
    const tileCenter = this.gpuTile.center;
    const relativeMatrix = createMat4Float64(matrix);
    // const worldOrigin = matrix.slice(12, 15); // translation xyz
    // const origin = [];
    //worldToRTCPositions(worldOrigin, worldOrigin, origin);
    // @ts-ignore
    relativeMatrix.set(subVec3(center, tileCenter), 12);
    //relativeMatrix.set(worldOrigin, 12);
    this._meshBatch.setMeshMatrix(this._meshHandle, relativeMatrix);
  }

  /**
   * Sets the color of the mesh.
   * Called by {@link RendererObject.setColor}.
   */
  setColor(color: Vec3) {
    for (let viewIndex = 0, len = this._renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this._viewStates[viewIndex];
      if (!viewState.colorizing) {
        this._meshBatch.setMeshColorInView(viewIndex, this._meshHandle, color);
      }
    }
  }

  /**
   * Sets the opacity of the mesh.
   * Called by {@link RendererObject.setOpacity}.
   */
  setOpacity(opacity: number) {
    for (let viewIndex = 0, len = this._renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this._viewStates[viewIndex];
      if (!viewState.coloringOpacity) {
        this._meshBatch.setMeshOpacityInView(viewIndex, this._meshHandle, opacity);
      }
    }
  }

  /**
   * Sets the object-level visibility of the mesh in a specific view.
   * @param viewIndex
   * @param objectVisible
   */
  setObjectVisible(viewIndex: number, objectVisible: boolean) {
    const viewState = this._viewStates[viewIndex];
    if (viewState.objectVisible === objectVisible) {
      return;
    }
    viewState.objectVisible = objectVisible;
    this._meshBatch.setMeshVisible(viewIndex, this._meshHandle, objectVisible && viewState.meshVisible);
  }

  /**
   * Sets the mesh-level visibility of the mesh in all views.
   * Called by {@link RendererObject.setVisible}.
   */
  setVisible( meshVisible: boolean) {
    for (let viewIndex = 0, len = NUM_VIEWS; viewIndex < len; viewIndex++) {
      const viewState = this._viewStates[viewIndex];
      if (viewState.meshVisible === meshVisible) {
        continue;
      }
      viewState.meshVisible = meshVisible;
      this._meshBatch.setMeshVisible(viewIndex, this._meshHandle, viewState.objectVisible && meshVisible);
    }
  }

  /**
   * Sets the colorization for a specific view.
   * Called by {@link RendererObject.setColorize}.
   */
  setColorInView(viewIndex: number, colorize: Vec3 | null) {
    const viewStates = this._viewStates[viewIndex];
    if (colorize !== null) { // Apply color override
      this._meshBatch.setMeshColorInView(viewIndex, this._meshHandle, colorize);
      viewStates.colorizing = true;
    } else { // Restore original color
      this._meshBatch.setMeshColorInView(viewIndex, this._meshHandle, this._sceneMesh.color);
      viewStates.colorizing = false;
    }
  }

  /**
   * Sets the opacity of the mesh for a specific view.
   * Called by {@link RendererObject.setOpacityInView}.
   */
  setOpacityInView(viewIndex: number, opacity: number | null) {
    const viewStates = this._viewStates[viewIndex];
    if (opacity !== null) { // Apply opacity override
      this._meshBatch.setMeshOpacityInView(viewIndex, this._meshHandle, opacity);
      viewStates.coloringOpacity = true;
    } else { // Restore original opacity
      this._meshBatch.setMeshOpacityInView(viewIndex, this._meshHandle, this._sceneMesh.opacity);
      viewStates.coloringOpacity = false;
    }
  }

  /**
   * Sets the transparency of the mesh for a specific view.
   * Called by Called by {@link RendererObject.setTransparent}.
   */
  setTransparent(viewIndex: number, transparent: boolean) {
    this._meshBatch.setMeshTransparent(viewIndex, this._meshHandle, transparent);
  }

  /**
   * Sets the highlight state of the mesh for a specific view.
   * Called by {@link RendererObject.setHighlighted}.
   */
  setHighlighted(viewIndex: number, highlighted: boolean) {
    const transparent = this._viewStates[viewIndex].transparent; // For restore to opaque vs transparent bin, when un-highlighting
    this._meshBatch.setMeshHighlighted(viewIndex, this._meshHandle, highlighted, transparent);
  }

  /**
   * Sets the x-ray state of the mesh for a specific view.
   * Called by {@link RendererObject.setXRayed}.
   */
  setXRayed(viewIndex: number, xrayed: boolean) {
    const transparent = this._viewStates[viewIndex].transparent; // For restore to opaque vs transparent bin, when un-x-raying
    this._meshBatch.setMeshXRayed(viewIndex, this._meshHandle, xrayed, transparent);
  }

  /**
   * Sets the selection state of the mesh for a specific view.
   * Called by {@link RendererObject.setSelected}.
   */
  setSelected(viewIndex: number, selected: boolean) {
    const transparent = this._viewStates[viewIndex].transparent; // For restore to opaque vs transparent bin, when de-selecting
    this._meshBatch.setMeshSelected(viewIndex, this._meshHandle, selected, transparent);
  }

  /**
   * Sets the clippable state of the mesh for a specific view.
   * Called by {@link RendererObject.setClippable}.
   */
  setClippable(viewIndex: number, clippable: boolean) {
    this._meshBatch.setMeshClippable(viewIndex, this._meshHandle, clippable);
  }

  /**
   * Sets the collidable state of the mesh for a specific view.
   * Called by {@link RendererObject.setCollidable}.
   */
  setCollidable(viewIndex: number, collidable: boolean) {
    // this._meshBatch.setLayerMeshCollidable(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the pickable state of the mesh for a specific view.
   * Called by {@link RendererObject.setPickable}.
   */
  setPickable(viewIndex: number, pickable: boolean) {
    this._meshBatch.setMeshPickable(viewIndex, this._meshHandle, pickable);
  }

  /**
   * Sets the culled state of the mesh for a specific view.
   * Called by {@link RendererObject.setCulled}.
   */
  setCulled(viewIndex: number, culled: boolean) {
    this._meshBatch.setMeshCulled(viewIndex, this._meshHandle, culled);
  }

  /**
   * Destroys the mesh and releases associated resources.
   */
  destroy() {
    this._meshBatch.removeMesh(this._meshHandle);
    if (this.gpuTile) {
      this._gpuMemoryManager.putTile(this.gpuTile);
    }
  }
}
