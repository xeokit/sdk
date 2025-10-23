import {
  createMat4,
  createVec4,
  transformPoint4,
  subVec3
} from "../../../matrix";
import type {SceneMeshRendererProxy} from "../../../scene";
import type {FloatArrayParam} from "../../../math";
import type {MeshBatchImpl} from "./MeshBatchImpl";
import type {RenderContext} from "../../RenderContext";
import {SceneMesh} from "../../../scene";
import {type Tile} from "../gpuMemoryManager/Tile";
import {type GPUMemoryEditor} from "../gpuMemoryManager/GPUMemoryEditor";
import {RendererObject} from "./RendererObject";
import {MeshBatchMeshHandle} from "./MeshBatchMeshHandle";
import {worldToRTCPositions} from "../../../rtc";

const tempIdentityMat4 = createMat4();
const identityVec4 = createVec4([0, 0, 0, 1]);
const tempVec4a = createVec4();
const tempMat4a = createMat4();
const tempMat4b = createMat4();

const NUM_VIEWS = 4;


/**
 * Represents a mesh in the WebGLRenderer.
 *
 * This class encapsulates the data and behavior of a mesh within the WebGL rendering pipeline.
 * It manages the mesh's geometry, transformation, visibility, and rendering states for multiple viewManager.
 * The mesh is associated with a specific meshBatch and is associated with a tile managed by the `GPUMemoryBatch` system.
 * The `GPUMemoryBatch` is part of the `RenderContext`, which is shared across various renderer components.
 *
 * Key responsibilities:
 * - Managing the mesh's transformation matrix and associating it with a tile from `GPUMemoryBatch`.
 * - Handling rendering states such as visibility, transparency, highlighting, and selection.
 * - Managing color and opacity for the mesh across multiple viewManager.
 * - Interfacing with the _meshBatch to update mesh-specific rendering properties.
 *
 * @private
 */

export class RendererMesh implements SceneMeshRendererProxy {

  public rendererObject: RendererObject; // Set in MeshBatches._addObject
  public tile: Tile;

  private readonly _sceneMesh: SceneMesh;
  private readonly _meshHandle: MeshBatchMeshHandle;
  private readonly _meshBatch: MeshBatchImpl;
  private readonly _renderContext: RenderContext;
  private readonly _viewStates: any;
  private readonly _gpuMemoryEditor: GPUMemoryEditor;

  /**
   * Constructs a RendererMesh instance.
   */
  constructor( {
                 sceneMesh,
                 meshBatch,
                 renderContext,
                 gpuMemoryEditor,
               }: {
    sceneMesh: SceneMesh;
    meshBatch: MeshBatchImpl;
    renderContext: RenderContext;
    gpuMemoryEditor: GPUMemoryEditor;
  } ) {

    this.rendererObject = null;
    this._renderContext = renderContext;
    this._sceneMesh = sceneMesh;
    this._meshBatch = meshBatch;
    this._meshHandle = meshBatch.addMesh(sceneMesh);
    this._gpuMemoryEditor = gpuMemoryEditor;
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
   * Initializes mesh flags for a specific view.
   */
  initFlags( viewIndex: number, renderFlags: number ) {
    this._meshBatch.initMeshFlags(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the transformation matrix for the mesh.
   * Called by SceneMesh.matrix setter.
   */
  setMatrix( matrix: FloatArrayParam ): void {
    matrix = matrix || tempIdentityMat4;
    const center = transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.tile;
    this.tile = oldTile
      ? this._gpuMemoryEditor.moveTile(oldTile, center)
      : this._gpuMemoryEditor.getTile(center);
    const tileChanged = !oldTile || oldTile.id !== this.tile.id;
    if (tileChanged) {
      this._meshBatch.setMeshTile(this._meshHandle, this.tile.tileIndex);
    }
    const tileCenter = this.tile.center;
    const relativeMatrix = createMat4(matrix);

    // const worldOrigin = matrix.slice(12, 15); // translation xyz
    // const origin = [];
    //worldToRTCPositions(worldOrigin, worldOrigin, origin);

    relativeMatrix.set(subVec3(center,tileCenter), 12);

    //relativeMatrix.set(worldOrigin, 12);

    this._meshBatch.setMeshMatrix(this._meshHandle, relativeMatrix);
    this._renderContext.setAllViewsDirty(); // Since caller is SceneMesh, where we're at this API boundary
  }

  /**
   * Sets the color of the mesh.
   * Called by SceneMesh.color setter.
   */
  setColor( color: FloatArrayParam ) {
    for (let viewIndex = 0, len = this._renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this._viewStates[viewIndex];
      if (!viewState.colorizing) {
        this._meshBatch.setMeshColor(viewIndex, this._meshHandle, color);
      }
    }
    this._renderContext.setAllViewsDirty()
  }

  /**
   * Sets the visibility of the mesh for a specific view.
   * Called by RendererObject.setVisible().
   */
  setVisible( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshVisible(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the colorization for a specific view.
   * Called by RendererObject.setColorize().
   */
  setColorize( viewIndex: number, colorize: FloatArrayParam|null ) {
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
  setOpacity( viewIndex: number, opacity: number ) {
    const viewStates = this._viewStates[viewIndex];
    viewStates.color[3] = opacity;
    viewStates.colorize[3] = opacity;
    if (this._viewStates[viewIndex].colorizing) {
      this._meshBatch.setMeshColor(viewIndex, this._meshHandle, viewStates.colorize);
    } else {
      this._meshBatch.setMeshColor(viewIndex, this._meshHandle, viewStates.color);
    }
  }

  /**
   * Sets the transparency of the mesh for a specific view.
   * Called by RendererObject.setTransparency().
   */
  setTransparent( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshTransparent(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the highlight state of the mesh for a specific view.
   * Called by RendererObject.setHighlighted().
   */
  setHighlighted( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshHighlighted(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the x-ray state of the mesh for a specific view.
   * Called by RendererObject.setXRayed().
   */
  setXRayed( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshXRayed(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the selection state of the mesh for a specific view.
   * Called by RendererObject.setSelected().
   */
  setSelected( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshSelected(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the clippable state of the mesh for a specific view.
   * Called by RendererObject.setClippable().
   */
  setClippable( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshClippable(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the collidable state of the mesh for a specific view.
   * Called by RendererObject.setCollidable().
   */
  setCollidable( viewIndex: number, renderFlags: number ) {
    // this._meshBatch.setLayerMeshCollidable(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the pickable state of the mesh for a specific view.
   * Called by RendererObject.setPickable().
   */
  setPickable( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshPickable(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Sets the culled state of the mesh for a specific view.
   * Called by RendererObject.setCulled().
   */
  setCulled( viewIndex: number, renderFlags: number ) {
    this._meshBatch.setMeshCulled(viewIndex, this._meshHandle, renderFlags);
  }

  /**
   * Destroys the mesh and releases associated resources.
   */
  destroy() {
    this._meshBatch.removeMesh(this._meshHandle, this.rendererObject.renderFlags);
    if (this.tile) {
      this._gpuMemoryEditor.putTile(this.tile);
    }
  }
}
