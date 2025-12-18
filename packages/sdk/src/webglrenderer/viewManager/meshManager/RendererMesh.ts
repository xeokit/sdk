import {
  createMat4Float64,
  createVec4Float64,
  transformPoint4,
  subVec3,
  type Mat4, Vec3, identityMat4
} from "../../../matrix";
import type {FloatArrayParam} from "../../../math";
import type {MeshBatchImpl} from "./MeshBatchImpl";
import type {RenderContext} from "../RenderContext";
import {type SceneMesh} from "../../../scene";
import {type Tile} from "../gpuMemoryManager/Tile";
import {type GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import {type MeshBatchMeshHandle} from "./MeshBatchMeshHandle";

const tempIdentityMat4 = identityMat4(createMat4Float64());
const identityVec4 = createVec4Float64([0, 0, 0, 1]);
const tempVec4a = createVec4Float64();

const NUM_VIEWS = 4;


/**
 * Represents a mesh in the WebGLRenderer.
 * @private
 */

export class RendererMesh {

  public tile: Tile;

  private readonly _renderContext: RenderContext;
  private readonly _sceneMesh: SceneMesh;
  private readonly _meshBatch: MeshBatchImpl;
  private readonly _meshHandle: MeshBatchMeshHandle;
  private readonly _gpuMemoryManager: GPUMemoryManager;
  private readonly _viewStates: {
    colorize: [number, number, number, number];
    colorizing: boolean;
    transparent: boolean;
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
    this.tile = null;

    // Color / opacity -> 0..255
    const rgb = sceneMesh.color ?? [1, 1, 1];
    const r = Math.floor(rgb[0] * 255);
    const g = Math.floor(rgb[1] * 255);
    const b = Math.floor(rgb[2] * 255);
    const a = sceneMesh.opacity != null ? Math.floor(sceneMesh.opacity * 255) : 255;
    const transparent = a < 255;

    this._viewStates = Array.from({length: NUM_VIEWS}, () => ({
      colorize: [r, g, b, a] as [number, number, number, number],
      colorizing: false,
      transparent,
    }));

    this.setMatrix(sceneMesh.globalMatrix);
  }

  /**
   * Sets the transformation matrix for the mesh.
   * Triggered by SceneMesh.globalMatrix setter.
   */
  setMatrix(matrix: Mat4): void {
    matrix = matrix || tempIdentityMat4;
    const center:Vec3 = <Vec3>transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.tile;
    this.tile = oldTile
      ? this._gpuMemoryManager.moveTile(oldTile, center)
      : this._gpuMemoryManager.getTile(center);
    const tileChanged = !oldTile || oldTile.id !== this.tile.id;
    if (tileChanged) {
      this._meshBatch.setMeshTile(this._meshHandle, this.tile.tileIndex);
    }
    const tileCenter = this.tile.center;
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
   * Triggered by SceneMesh.color setter.
   */
  setColor(color: FloatArrayParam) {
    for (let viewIndex = 0, len = this._renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this._viewStates[viewIndex];
      if (!viewState.colorizing) {
        this._meshBatch.setMeshColor(viewIndex, this._meshHandle, color);
      }
    }
  }

  /**
   * Sets the visibility of the mesh for a specific view.
   * Called by RendererObject.setVisible().
   */
  setVisible(viewIndex: number, renderFlags: boolean) {
    this._meshBatch.setMeshVisible(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the colorization for a specific view.
   * Called by RendererObject.setColorize().
   */
  setColorize(viewIndex: number, colorize: FloatArrayParam | null) {
    const viewStates = this._viewStates[viewIndex];
    const meshColorize = viewStates.colorize;
    if (colorize) {
      meshColorize[0] = colorize[0];
      meshColorize[1] = colorize[1];
      meshColorize[2] = colorize[2];
      this._meshBatch.setMeshColor(viewIndex, this._meshHandle, meshColorize);
      viewStates.colorizing = true;
    } else {
      this._meshBatch.setMeshColor(viewIndex, this._meshHandle, this._sceneMesh.color);
      viewStates.colorizing = false;
    }
  }

  /**
   * Sets the opacity of the mesh for a specific view.
   * Called by RendererObject.setOpacity().
   */
  setOpacity(viewIndex: number, opacity: number) {
    const viewStates = this._viewStates[viewIndex];
    viewStates.colorize[3] = opacity;
    if (this._viewStates[viewIndex].colorizing) {
      this._meshBatch.setMeshColor(viewIndex, this._meshHandle, viewStates.colorize);
    } else {
      this._meshBatch.setMeshColor(viewIndex, this._meshHandle, this._sceneMesh.color);
    }
  }

  /**
   * Sets the transparency of the mesh for a specific view.
   * Called by RendererObject.setTransparency().
   */
  setTransparent(viewIndex: number, transparent: boolean) {
    this._meshBatch.setMeshTransparent(viewIndex, this._meshHandle, transparent);
  }

  /**
   * Sets the highlight state of the mesh for a specific view.
   * Called by RendererObject.setHighlighted().
   */
  setHighlighted(viewIndex: number, highlighted: boolean) {
    const transparent = this._viewStates[viewIndex].transparent; // For restore to opaque vs transparent bin, when un-highlighting
    this._meshBatch.setMeshHighlighted(viewIndex, this._meshHandle, highlighted, transparent);
  }

  /**
   * Sets the x-ray state of the mesh for a specific view.
   * Called by RendererObject.setXRayed().
   */
  setXRayed(viewIndex: number, xrayed: boolean) {
    const transparent = this._viewStates[viewIndex].transparent; // For restore to opaque vs transparent bin, when un-x-raying
    this._meshBatch.setMeshXRayed(viewIndex, this._meshHandle, xrayed, transparent);
  }

  /**
   * Sets the selection state of the mesh for a specific view.
   * Called by RendererObject.setSelected().
   */
  setSelected(viewIndex: number, selected: boolean) {
    const transparent = this._viewStates[viewIndex].transparent; // For restore to opaque vs transparent bin, when de-selecting
    this._meshBatch.setMeshSelected(viewIndex, this._meshHandle, selected, transparent);
  }

  /**
   * Sets the clippable state of the mesh for a specific view.
   * Called by RendererObject.setClippable().
   */
  setClippable(viewIndex: number, clippable: boolean) {
    this._meshBatch.setMeshClippable(viewIndex, this._meshHandle, clippable);
  }

  /**
   * Sets the collidable state of the mesh for a specific view.
   * Called by RendererObject.setCollidable().
   */
  setCollidable(viewIndex: number, collidable: boolean) {
    // this._meshBatch.setLayerMeshCollidable(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the pickable state of the mesh for a specific view.
   * Called by RendererObject.setPickable().
   */
  setPickable(viewIndex: number, pickable: boolean) {
    this._meshBatch.setMeshPickable(viewIndex, this._meshHandle, pickable);
  }

  /**
   * Sets the culled state of the mesh for a specific view.
   * Called by RendererObject.setCulled().
   */
  setCulled(viewIndex: number, culled: boolean) {
    this._meshBatch.setMeshCulled(viewIndex, this._meshHandle, culled);
  }

  /**
   * Destroys the mesh and releases associated resources.
   */
  destroy() {
    this._meshBatch.removeMesh(this._meshHandle);
    if (this.tile) {
      this._gpuMemoryManager.putTile(this.tile);
    }
  }
}
