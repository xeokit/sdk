import {createMat4, createVec4, mulMat4, transformPoint4, translationMat4c} from "../../matrix";
import type {RendererGeometry, RendererMesh} from "../../scene";
import type {FloatArrayParam} from "../../math";
import type {Layer} from "./Layer";
import type {RenderContext} from "../RenderContext";
import {SceneMesh} from "../../scene";
import {type Tile} from "../memory/Tile";
import {RendererObjectImpl} from "./RendererObjectImpl";
import {type GPUMemoryEditIF} from "../memory/GPUMemoryEditIF";

const identityMat4 = createMat4();
const identityVec4 = createVec4([0, 0, 0, 1]);
const tempVec4a = createVec4();
const tempMat4a = createMat4();
const tempMat4b = createMat4();

const NUM_VIEWS = 4;


/**
 * Represents a mesh in the WebGLRenderer.
 *
 * This class encapsulates the data and behavior of a mesh within the WebGL rendering pipeline.
 * It manages the mesh's geometry, transformation, visibility, and rendering states for multiple views.
 * The mesh is associated with a specific _layer and is associated with a tile managed by the `GPUMemory` system.
 * The `GPUMemory` is part of the `RenderContext`, which is shared across various renderer components.
 *
 * Key responsibilities:
 * - Managing the mesh's transformation matrix and associating it with a tile from `GPUMemory`.
 * - Handling rendering states such as visibility, transparency, highlighting, and selection.
 * - Managing color and opacity for the mesh across multiple views.
 * - Interfacing with the _layer to update mesh-specific rendering properties.
 *
 * @private
 */

export class RendererMeshImpl implements RendererMesh {

  rendererObject: RendererObjectImpl;
  tile: Tile;

  private readonly _sceneMesh: SceneMesh;
  private readonly _meshIndex: number;

  private readonly _layer: Layer;
  private readonly _renderContext: RenderContext;
  private readonly _viewStates: any;
  private readonly _gpuMemoryEditIF: GPUMemoryEditIF;

  /**
   * Constructs a RendererMeshImpl instance.
   */
  constructor( {
                 sceneMesh,
                 layer,
                 renderContext,
                 gpuMemoryEditIF,
               }: {
    sceneMesh: SceneMesh;
    layer: Layer;
    renderContext: RenderContext;
    gpuMemoryEditIF: GPUMemoryEditIF;
  } ) {

    this._renderContext = renderContext;
    this._sceneMesh = sceneMesh;
    this._layer = layer;
    this._meshIndex = layer.addMesh(sceneMesh);
    this._gpuMemoryEditIF = gpuMemoryEditIF;
    this.rendererObject = null; // set by renderer
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

    this.setMatrix(sceneMesh.matrix);
  }


  /**
   * Initializes mesh flags for a specific view.
   */
  initFlags( viewIndex: number, flags: number ) {
    this._layer.initMeshFlags(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the visibility of the mesh for a specific view.
   */
  setVisible( viewIndex: number, flags: number ) {
    this._layer.setMeshVisible(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the transformation matrix for the mesh.
   */
  setMatrix( matrix: FloatArrayParam ): void {
    matrix = matrix || identityMat4;
    const center = transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.tile;
    this.tile = oldTile
      ? this._gpuMemoryEditIF.moveTile(oldTile, center)
      : this._gpuMemoryEditIF.getTile(center);
    const tileChanged = !oldTile || oldTile.id !== this.tile.id;
    const tileCenter = this.tile.center;
    const needRTC = (tileCenter[0] !== 0 || tileCenter[1] !== 0 || tileCenter[2] !== 0);
    const rtcMatrix = needRTC
      ? mulMat4(matrix, translationMat4c(-tileCenter[0], -tileCenter[1], -tileCenter[2], tempMat4a), tempMat4b)
      : matrix;
    this._layer.setMeshMatrix(this._meshIndex, rtcMatrix);
    if (tileChanged) {
      this._layer.setMeshTile(this._meshIndex, this.tile.tileIndex);
    }
  }

  /**
   * Sets the color of the mesh.
   */
  setColor( color: FloatArrayParam ) {
    for (let viewIndex = 0, len = this._renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this._viewStates[viewIndex];
      if (!viewState.colorizing) {
        this._layer.setMeshColor(viewIndex, this._meshIndex, color);
      }
    }
  }

  /**
   * Sets the colorization for a specific view.
   */
  setColorize( viewIndex: number, colorize: FloatArrayParam|null ) {
    const _viewStates = this._viewStates[viewIndex];
    const meshColorize = _viewStates.colorize;
    if (colorize) {
      meshColorize[0] = colorize[0];
      meshColorize[1] = colorize[1];
      meshColorize[2] = colorize[2];
      this._layer.setMeshColor(viewIndex, this._meshIndex, meshColorize);
      _viewStates.colorizing = true;
    } else {
      this._layer.setMeshColor(viewIndex, this._meshIndex, this._sceneMesh.color);
      _viewStates.colorizing = false;
    }
  }

  /**
   * Sets the opacity of the mesh for a specific view.
   */
  setOpacity( viewIndex: number, opacity: number ) {
    const _viewStates = this._viewStates[viewIndex];
    _viewStates.color[3] = opacity;
    _viewStates.colorize[3] = opacity;
    if (this._viewStates[viewIndex].colorizing) {
      this._layer.setMeshColor(viewIndex, this._meshIndex, _viewStates.colorize);
    } else {
      this._layer.setMeshColor(viewIndex, this._meshIndex, _viewStates.color);
    }
  }

  /**
   * Sets the transparency of the mesh for a specific view.
   */
  setTransparent( viewIndex: number, flags: number ) {
    this._layer.setMeshTransparent(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the highlight state of the mesh for a specific view.
   */
  setHighlighted( viewIndex: number, flags: number ) {
    this._layer.setMeshHighlighted(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the x-ray state of the mesh for a specific view.
   */
  setXRayed( viewIndex: number, flags: number ) {
    this._layer.setMeshXRayed(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the selection state of the mesh for a specific view.
   */
  setSelected( viewIndex: number, flags: number ) {
    this._layer.setMeshSelected(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the clippable state of the mesh for a specific view.
   */
  setClippable( viewIndex: number, flags: number ) {
    this._layer.setMeshClippable(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the collidable state of the mesh for a specific view.
   */
  setCollidable( viewIndex: number, flags: number ) {
    // this._layer.setLayerMeshCollidable(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the pickable state of the mesh for a specific view.
   */
  setPickable( viewIndex: number, flags: number ) {
    this._layer.setMeshPickable(viewIndex, this._meshIndex, flags);
  }

  /**
   * Sets the culled state of the mesh for a specific view.
   */
  setCulled( viewIndex: number, flags: number ) {
    this._layer.setMeshCulled(viewIndex, this._meshIndex, flags);
  }

  /**
   * Destroys the mesh and releases associated resources.
   */
  destroy() {
    this._layer.removeMesh(this._sceneMesh, this.rendererObject.flags);
    if (this.tile) {
      this._gpuMemoryEditIF.putTile(this.tile);
    }
  }
}
