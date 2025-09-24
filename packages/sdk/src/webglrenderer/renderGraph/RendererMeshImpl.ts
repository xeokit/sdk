import {
  createMat4,
  createVec4,
  mulMat4,
  transformPoint4,

  identityMat4, setMat4Translation, translateMat4v, translationMat4c
} from "../../matrix";
import type {RendererMesh} from "../../scene";
import type {FloatArrayParam} from "../../math";
import type {RenderLayerImpl} from "./RenderLayerImpl";
import type {RenderContext} from "../RenderContext";
import {SceneMesh} from "../../scene";
import {type Tile} from "../gpuMemory/Tile";
import {type GPUMemoryWriteIF} from "../gpuMemory/GPUMemoryWriteIF";
import {RendererObjectImpl} from "./RendererObjectImpl";
import {createRTCModelMat} from "../../rtc";
import {GPUMemoryMeshHandle} from "../gpuMemory/GPUMemoryMeshHandle";

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
 * It manages the mesh's geometry, transformation, visibility, and rendering states for multiple views.
 * The mesh is associated with a specific _layer and is associated with a tile managed by the `GPUMemoryLayer` system.
 * The `GPUMemoryLayer` is part of the `RenderContext`, which is shared across various renderer components.
 *
 * Key responsibilities:
 * - Managing the mesh's transformation matrix and associating it with a tile from `GPUMemoryLayer`.
 * - Handling rendering states such as visibility, transparency, highlighting, and selection.
 * - Managing color and opacity for the mesh across multiple views.
 * - Interfacing with the _layer to update mesh-specific rendering properties.
 *
 * @private
 */

export class RendererMeshImpl implements RendererMesh {

  public rendererObject: RendererObjectImpl;
  public tile: Tile;

  private readonly _sceneMesh: SceneMesh;
  private readonly _meshHandle: GPUMemoryMeshHandle;
  private readonly _layer: RenderLayerImpl;
  private readonly _renderContext: RenderContext;
  private readonly _viewStates: any;
  private readonly _gpuMemoryWriteIF: GPUMemoryWriteIF;

  /**
   * Constructs a RendererMeshImpl instance.
   */
  constructor( {
                 sceneMesh,
                 layer,
                 renderContext,
                 gpuMemoryWriteIF,
               }: {
    sceneMesh: SceneMesh;
    layer: RenderLayerImpl;
    renderContext: RenderContext;
    gpuMemoryWriteIF: GPUMemoryWriteIF;
  } ) {

    this.rendererObject = null;
    this._renderContext = renderContext;
    this._sceneMesh = sceneMesh;
    this._layer = layer;
    this._meshHandle = layer.addMesh(sceneMesh);
    this._gpuMemoryWriteIF = gpuMemoryWriteIF;
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
    this._layer.initMeshFlags(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the visibility of the mesh for a specific view.
   */
  setVisible( viewIndex: number, flags: number ) {
    this._layer.setMeshVisible(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the transformation matrix for the mesh.
   */
  setMatrix( matrix: FloatArrayParam ): void {


     function deriveRTCTileCenterAndRelativeMatrix(matrix: FloatArrayParam): {
      rtcTileCenter: FloatArrayParam;
      relativeMatrix: FloatArrayParam;
    } {
      const rtcTileCenter = new Float64Array(3);
      const relativeMatrix = createMat4();

      // Extract translation from the matrix
      const translation = [matrix[12], matrix[13], matrix[14]];

      // Calculate the RTC tile center
      rtcTileCenter[0] = Math.round(translation[0] / 200) * 200;
      rtcTileCenter[1] = Math.round(translation[1] / 200) * 200;
      rtcTileCenter[2] = Math.round(translation[2] / 200) * 200;

      // Compute the relative transformation matrix
      setMat4Translation(matrix, [0, 0, 0], relativeMatrix); // Copy rotation and scale
      translateMat4v([-rtcTileCenter[0], -rtcTileCenter[1], -rtcTileCenter[2]], relativeMatrix);

      return { rtcTileCenter, relativeMatrix };
    }


    matrix = matrix || tempIdentityMat4;
    const center = transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.tile;
    this.tile = oldTile
      ? this._gpuMemoryWriteIF.moveTile(oldTile, center)
      : this._gpuMemoryWriteIF.getTile(center);
    const tileChanged = !oldTile || oldTile.id !== this.tile.id;
    const tileCenter = this.tile.center;
    const needRTC = (tileCenter[0] !== 0 || tileCenter[1] !== 0 || tileCenter[2] !== 0);

    // const rtcMatrix = needRTC
    //   ? mulMat4(matrix, translationMat4c(-tileCenter[0], -tileCenter[1], -tileCenter[2], identityMat4()), identityMat4())
    //   : matrix;

    const rtcMatrix = needRTC
      ? createRTCModelMat(matrix, tileCenter, identityMat4())
      : matrix;

//const {rtcTileCenter, relativeMatrix} = deriveRTCTileCenterAndRelativeMatrix(matrix);

    this._layer.setMeshMatrix(this._meshHandle, rtcMatrix.slice());
    if (tileChanged) {
      this._layer.setMeshTile(this._meshHandle, this.tile.tileIndex);
    }
  }

  /**
   * Sets the color of the mesh.
   */
  setColor( color: FloatArrayParam ) {
    for (let viewIndex = 0, len = this._renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this._viewStates[viewIndex];
      if (!viewState.colorizing) {
        this._layer.setMeshColor(viewIndex, this._meshHandle, color);
      }
    }
  }

  /**
   * Sets the colorization for a specific view.
   */
  setColorize( viewIndex: number, colorize: FloatArrayParam|null ) {
    const viewStates = this._viewStates[viewIndex];
    const meshColorize = viewStates.colorize;
    if (colorize) {
      meshColorize[0] = colorize[0];
      meshColorize[1] = colorize[1];
      meshColorize[2] = colorize[2];
      this._layer.setMeshColor(viewIndex, this._meshHandle, meshColorize);
      viewStates.colorizing = true;
    } else {
      this._layer.setMeshColor(viewIndex, this._meshHandle, this._sceneMesh.color);
      viewStates.colorizing = false;
    }
  }

  /**
   * Sets the opacity of the mesh for a specific view.
   */
  setOpacity( viewIndex: number, opacity: number ) {
    const viewStates = this._viewStates[viewIndex];
    viewStates.color[3] = opacity;
    viewStates.colorize[3] = opacity;
    if (this._viewStates[viewIndex].colorizing) {
      this._layer.setMeshColor(viewIndex, this._meshHandle, viewStates.colorize);
    } else {
      this._layer.setMeshColor(viewIndex, this._meshHandle, viewStates.color);
    }
  }

  /**
   * Sets the transparency of the mesh for a specific view.
   */
  setTransparent( viewIndex: number, flags: number ) {
    this._layer.setMeshTransparent(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the highlight state of the mesh for a specific view.
   */
  setHighlighted( viewIndex: number, flags: number ) {
    this._layer.setMeshHighlighted(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the x-ray state of the mesh for a specific view.
   */
  setXRayed( viewIndex: number, flags: number ) {
    this._layer.setMeshXRayed(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the selection state of the mesh for a specific view.
   */
  setSelected( viewIndex: number, flags: number ) {
    this._layer.setMeshSelected(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the clippable state of the mesh for a specific view.
   */
  setClippable( viewIndex: number, flags: number ) {
    this._layer.setMeshClippable(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the collidable state of the mesh for a specific view.
   */
  setCollidable( viewIndex: number, flags: number ) {
    // this._layer.setLayerMeshCollidable(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the pickable state of the mesh for a specific view.
   */
  setPickable( viewIndex: number, flags: number ) {
    this._layer.setMeshPickable(viewIndex, this._meshHandle, flags);
  }

  /**
   * Sets the culled state of the mesh for a specific view.
   */
  setCulled( viewIndex: number, flags: number ) {
    this._layer.setMeshCulled(viewIndex, this._meshHandle, flags);
  }

  /**
   * Destroys the mesh and releases associated resources.
   */
  destroy() {
    this._layer.removeMesh(this._meshHandle, this.rendererObject.flags);
    if (this.tile) {
      this._gpuMemoryWriteIF.putTile(this.tile);
    }
  }
}
