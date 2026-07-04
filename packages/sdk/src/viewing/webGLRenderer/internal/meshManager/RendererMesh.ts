import {
  createVec4Float64,
  subVec3,
  type Vec3,
} from "../../../../base/math/vector";
import {
  createMat4Float64,
  transformPoint4,
  type Mat4,
  identityMat4,
} from "../../../../base/math/matrix";
import {quantizeColor3} from "../../../../base/math/compression";
import type {MeshBatchImpl} from "./MeshBatchImpl";
import type {RenderContext} from "../RenderContext";
import {type GPUTile} from "../gpuMemoryManager/GPUTile";
import {type GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import {type MeshBatchMeshHandle} from "./MeshBatchMeshHandle";
import {SDKInternalException} from "../../../../base/core";
import {SceneMesh} from "../../../../model/scene";

const tempIdentityMat4 = identityMat4(createMat4Float64());
const identityVec4 = createVec4Float64([0, 0, 0, 1]);
const tempVec4a = createVec4Float64();
// Scratch [0..255] color buffer reused by the colour-restore paths so
// the per-view attribute texture (Uint8 storage) gets pre-quantised
// values rather than truncated-to-zero [0..1] floats.
const tempQuantizedRGB: Vec3 = [0, 0, 0];

const enum ViewStateBits {
  Colorizing = 1 << 0,
  ColoringOpacity = 1 << 1,
  Transparent = 1 << 2,
  ObjectVisible = 1 << 3,
  MeshVisible = 1 << 4,
}

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

  public gpuTile: GPUTile;

  private readonly _sceneMesh: SceneMesh;
  private readonly _meshBatch: MeshBatchImpl;
  private readonly _meshHandle: MeshBatchMeshHandle;
  private readonly _gpuMemoryManager: GPUMemoryManager;
  private readonly _numViews: number;
  private _viewFlags0: number;
  private readonly _viewFlags: Uint8Array<any> | null;

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
    this._sceneMesh = sceneMesh;
    this._meshBatch = meshBatch;
    this._gpuMemoryManager = gpuMemoryManager;
    this._meshHandle = meshHandle;
    this.gpuTile = null;
    // GPU portions are created with objectVisible=true and meshVisible=true.
    // CPU flags must match so that the first setObjectVisible(false) is not treated as a no-op.
    const initialFlags = ViewStateBits.ObjectVisible | ViewStateBits.MeshVisible;
    this._numViews = renderContext.memoryConfigs.maxViews;
    this._viewFlags0 = initialFlags;
    this._viewFlags = this._numViews > 1 ? new Uint8Array(this._numViews) : null;
    this._viewFlags?.fill(initialFlags);
    this.setMatrix(sceneMesh.worldMatrix);
    this.setOpacity(sceneMesh.effectiveOpacity);
  }

  private _hasFlag(viewIndex: number, flag: ViewStateBits): boolean {
    const viewFlags = this._viewFlags;
    const flags = viewFlags ? viewFlags[viewIndex] : this._viewFlags0;
    return (flags & flag) !== 0;
  }

  private _setFlag(viewIndex: number, flag: ViewStateBits, enabled: boolean): void {
    const viewFlags = this._viewFlags;
    if (!viewFlags) {
      if (enabled) {
        this._viewFlags0 |= flag;
      } else {
        this._viewFlags0 &= ~flag;
      }
      return;
    }
    if (enabled) {
      viewFlags[viewIndex] |= flag;
    } else {
      viewFlags[viewIndex] &= ~flag;
    }
  }

  private _assertViewIndex(viewIndex: number, method: string): void {
    if (viewIndex < 0 || viewIndex >= this._numViews) {
      throw new SDKInternalException(`[RendererMesh.${method}] No view state for view index ${viewIndex}`);
    }
  }

  isObjectVisible(viewIndex: number): boolean {
    this._assertViewIndex(viewIndex, "isObjectVisible");
    return this._hasFlag(viewIndex, ViewStateBits.ObjectVisible);
  }

  /**
   * Sets the transformation matrix for the mesh, updating the assigned GPU tile as needed based on the new center position.
   * @param matrix
   */
  setMatrix(matrix: Mat4): void {
    matrix = matrix || tempIdentityMat4;
    const center: Vec3 = <Vec3>transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.gpuTile;
    this.gpuTile = oldTile
      ? this._gpuMemoryManager.moveTile(oldTile, center)
      : this._gpuMemoryManager.getTile(center);

    if (!oldTile || oldTile.id !== this.gpuTile.id) {
      this._meshBatch.setMeshTile(this._meshHandle, this.gpuTile.tileIndex);
    }

    const relativeMatrix = createMat4Float64(matrix) as any;
    relativeMatrix.set(subVec3(center, this.gpuTile.center), 12);
    this._meshBatch.setMeshMatrix(this._meshHandle, relativeMatrix);
  }

  /**
   * Sets the color of the mesh, updating the color in all views that are not currently overridden by view-specific colorization.
   * The incoming color is in normalised [0..1] range (the SceneMesh /
   * SceneMaterial convention); the per-view attribute texture stores
   * bytes 0..255, so we quantise here before forwarding.
   * @param color
   */
  setColor(color: Vec3) {
    const q = quantizeColor3(color, tempQuantizedRGB);
    for (let viewIndex = 0, len = this._numViews; viewIndex < len; viewIndex++) {
      if (!this._hasFlag(viewIndex, ViewStateBits.Colorizing)) {
        this._meshBatch.setMeshColorInView(viewIndex, this._meshHandle, q);
      }
    }
  }

  /**
   * Re-uploads this mesh's emissive colour factor — the shared (view-independent)
   * MeshAttributeTexture record — when its material's `emissiveColor` changes.
   */
  setEmissiveColor(emissiveColor: Vec3) {
    this._meshBatch.setMeshEmissiveColor(this._meshHandle, [emissiveColor[0], emissiveColor[1], emissiveColor[2]]);
  }

  /**
   * Sets the opacity of the mesh, updating the transparent state as needed.
   * @param opacity
   */
  setOpacity(opacity: number) {
    const transparent = opacity < 1.0;
    for (let viewIndex = 0, len = this._numViews; viewIndex < len; viewIndex++) {
      if (!this._hasFlag(viewIndex, ViewStateBits.ColoringOpacity)) {
        this._meshBatch.setMeshOpacityInView(viewIndex, this._meshHandle, opacity);
      }
      if (this._hasFlag(viewIndex, ViewStateBits.Transparent) !== transparent) {
        this._setFlag(viewIndex, ViewStateBits.Transparent, transparent);
        this._meshBatch.setMeshTransparent(viewIndex, this._meshHandle, transparent);
      }
    }
  }

  /**
   * Sets the visibility of the mesh for a specific view, taking into account both the mesh's
   * own visibility and the object's visibility in that view.
   * @param viewIndex
   * @param objectVisible
   */
  setObjectVisible(viewIndex: number, objectVisible: boolean) {
    this._assertViewIndex(viewIndex, "setObjectVisible");

    if (this._hasFlag(viewIndex, ViewStateBits.ObjectVisible) === objectVisible) {
      return;
    }

    this._setFlag(viewIndex, ViewStateBits.ObjectVisible, objectVisible);

    const meshVisible = this._hasFlag(viewIndex, ViewStateBits.MeshVisible);
    this._meshBatch.setMeshVisible(viewIndex, this._meshHandle, objectVisible && meshVisible);
  }

  /**
   * Sets the visibility of the mesh for all views.
   * @param meshVisible
   */
  setVisible(meshVisible: boolean) {
    for (let viewIndex = 0, len = this._numViews; viewIndex < len; viewIndex++) {
      if (this._hasFlag(viewIndex, ViewStateBits.MeshVisible) === meshVisible) {
        continue;
      }
      this._setFlag(viewIndex, ViewStateBits.MeshVisible, meshVisible);
      const objectVisible = this._hasFlag(viewIndex, ViewStateBits.ObjectVisible);
      this._meshBatch.setMeshVisible(viewIndex, this._meshHandle, objectVisible && meshVisible);
    }
  }

  /**
   * Sets the colorization for a specific view.
   * Called by {@link RendererObject.setColorize}.
   *
   * The incoming `colorize` value is already quantised to bytes 0..255
   * by `RendererObject.setColorize` (its caller). The restore branch
   * (`colorize === null`) uploads `sceneMesh.effectiveColor`, which is
   * in normalised [0..1] range and must be quantised here — otherwise
   * the per-view attribute texture (Uint8 storage) truncates the
   * fractional values to `0`, painting the mesh black the moment the
   * colorize tint is cleared.
   */
  setColorInView(viewIndex: number, colorize: Vec3 | null) {
    this._assertViewIndex(viewIndex, "setColorInView");
    if (colorize !== null) {
      this._meshBatch.setMeshColorInView(viewIndex, this._meshHandle, colorize);
      this._setFlag(viewIndex, ViewStateBits.Colorizing, true);
    } else {
      this._meshBatch.setMeshColorInView(viewIndex, this._meshHandle, quantizeColor3(this._sceneMesh.effectiveColor, tempQuantizedRGB));
      this._setFlag(viewIndex, ViewStateBits.Colorizing, false);
    }
  }

  /**
   * Sets the opacity of the mesh for a specific view.
   * Called by {@link RendererObject.setOpacityInView}.
   */
  setOpacityInView(viewIndex: number, opacity: number | null) {
    this._assertViewIndex(viewIndex, "setOpacityInView");
    if (opacity !== null) {
      this._meshBatch.setMeshOpacityInView(viewIndex, this._meshHandle, opacity);
      this._setFlag(viewIndex, ViewStateBits.ColoringOpacity, true);
    } else {
      this._meshBatch.setMeshOpacityInView(viewIndex, this._meshHandle, this._sceneMesh.effectiveOpacity);
      this._setFlag(viewIndex, ViewStateBits.ColoringOpacity, false);
    }
  }

  /**
   * Sets the highlight state of the mesh for a specific view.
   * Called by {@link RendererObject.setHighlighted}.
   */
  setHighlighted(viewIndex: number, highlighted: boolean) {
    this._assertViewIndex(viewIndex, "setHighlighted");
    this._meshBatch.setMeshHighlighted(
      viewIndex,
      this._meshHandle,
      highlighted,
      this._hasFlag(viewIndex, ViewStateBits.Transparent)
    );
  }

  /**
   * Sets the x-ray state of the mesh for a specific view.
   * Called by {@link RendererObject.setXRayed}.
   */
  setXRayed(viewIndex: number, xrayed: boolean) {
    this._assertViewIndex(viewIndex, "setXRayed");
    this._meshBatch.setMeshXRayed(
      viewIndex,
      this._meshHandle,
      xrayed,
      this._hasFlag(viewIndex, ViewStateBits.Transparent)
    );
  }

  /**
   * Sets the selection state of the mesh for a specific view.
   * Called by {@link RendererObject.setSelected}.
   */
  setSelected(viewIndex: number, selected: boolean) {
    this._assertViewIndex(viewIndex, "setSelected");
    this._meshBatch.setMeshSelected(
      viewIndex,
      this._meshHandle,
      selected,
      this._hasFlag(viewIndex, ViewStateBits.Transparent)
    );
  }

  /**
   * Sets the clippable state of the mesh for a specific view.
   * Called by {@link RendererObject.setClippable}.
   */
  setClippable(viewIndex: number, clippable: boolean) {
    this._assertViewIndex(viewIndex, "setClippable");
    this._meshBatch.setMeshClippable(viewIndex, this._meshHandle, clippable);
  }

  /**
   * Sets the collidable state of the mesh for a specific view.
   * Called by {@link RendererObject.setCollidable}.
   */
  setCollidable(viewIndex: number, collidable: boolean) {
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
