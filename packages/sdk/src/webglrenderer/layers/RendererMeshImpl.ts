import {createMat4, createVec4, mulMat4,  transformPoint4, translationMat4c} from "../../matrix";
import type {RendererGeometry, RendererMesh} from "../../scene";
import type {FloatArrayParam} from "../../math";
import type {LayerImpl} from "./LayerImpl";
import type {RenderContext} from "../RenderContext";
import {SceneMesh} from "../../scene";
import {type RenderTile} from "../gpuDataMemory/RenderTile";
import {RendererObjectImpl} from "./RendererObjectImpl";
import {type GPUDataMemoryEditor} from "../gpuDataMemory/GPUDataMemoryEditor";

const identityMat4 = createMat4();
const identityVec4 = createVec4([0, 0, 0, 1]);
const tempVec4a = createVec4();
const tempMat4a = createMat4();
const tempMat4b = createMat4();


/**
 * Represents a mesh in the WebGLRenderer.
 *
 * This class encapsulates the data and behavior of a mesh within the WebGL rendering pipeline.
 * It manages the mesh's geometry, transformation, visibility, and rendering states for multiple views.
 * The mesh is associated with a specific layer and is associated with a tile managed by the `GPUDataMemory` system.
 * The `GPUDataMemory` is part of the `RenderContext`, which is shared across various renderer components.
 *
 * Key responsibilities:
 * - Managing the mesh's transformation matrix and associating it with a tile from `GPUDataMemory`.
 * - Handling rendering states such as visibility, transparency, highlighting, and selection.
 * - Managing color and opacity for the mesh across multiple views.
 * - Interfacing with the layer to update mesh-specific rendering properties.
 *
 * @private
 */

export class RendererMeshImpl implements RendererMesh {

  id: string;

  _renderContext: RenderContext;

  rendererObject: RendererObjectImpl | null;

  rendererGeometry: RendererGeometry;

  sceneMesh: SceneMesh;

  layer: LayerImpl;

  meshIndex: number;

  tile: RenderTile;

  viewStates: any;

  private gpuDataMemoryEditor: GPUDataMemoryEditor;

  /**
   * Constructs a RendererMeshImpl instance.
   */
  constructor(params: {
    id: string;
    sceneMesh: SceneMesh;
    layer: LayerImpl;
    meshIndex: number;
    renderContext: RenderContext;
    rendererGeometry: RendererGeometry;
    gpuDataMemoryEditor: GPUDataMemoryEditor;
  }) {
    const {
      meshIndex,
      renderContext,
      sceneMesh,
      layer,
      id,
      rendererGeometry,
      gpuDataMemoryEditor
    } = params;

    const color = (sceneMesh.color) ? new Uint8Array([Math.floor(sceneMesh.color[0] * 255), Math.floor(sceneMesh.color[1] * 255), Math.floor(sceneMesh.color[2] * 255)]) : [255, 255, 255];
    const opacity = (sceneMesh.opacity !== undefined && sceneMesh.opacity !== null) ? Math.floor(sceneMesh.opacity * 255) : 255;

    this.id = id;
    this._renderContext = renderContext;
    this.rendererObject = null; // Set by the renderer
    this.rendererGeometry = rendererGeometry;
    this.sceneMesh = sceneMesh;
    this.tile = null;
    this.layer = layer;
    this.meshIndex = meshIndex;
    this.gpuDataMemoryEditor = gpuDataMemoryEditor;

    const r = color[0], g = color[1], b = color[2], a = opacity;
    const transparent = (opacity < 255);

    this.viewStates = [];
    for (let i = 0; i < 4; i++) {
      this.viewStates[i] = {
        colorize: [r, g, b, a], // Colorization state
        colorizing: false, // Whether the mesh is being colorized
        transparent // Whether the mesh is transparent
      };
    }

    this.setMatrix(sceneMesh.matrix);
  }

  /**
   * Initializes mesh flags for a specific view.
   */
  initFlags(viewIndex: number, flags: number) {
    this.layer.initMeshFlags(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the visibility of the mesh for a specific view.
   */
  setVisible(viewIndex: number, flags: any) {
    this.layer.setMeshVisible(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the transformation matrix for the mesh.
   */
  setMatrix(matrix: FloatArrayParam): void {
    matrix = matrix || identityMat4;
    const center = transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.tile;
    this.tile = oldTile
      ? this.gpuDataMemoryEditor.moveTile(oldTile, center)
      : this.gpuDataMemoryEditor.getTile(center);
    const tileChanged = !oldTile || oldTile.id !== this.tile.id;
    const tileCenter = this.tile.center;
    const needRTC = (tileCenter[0] !== 0 || tileCenter[1] !== 0 || tileCenter[2] !== 0);
    const rtcMatrix = needRTC
      ? mulMat4(matrix, translationMat4c(-tileCenter[0], -tileCenter[1], -tileCenter[2], tempMat4a), tempMat4b)
      : matrix;
    this.layer.setMeshMatrix(this.meshIndex, rtcMatrix);
    if (tileChanged) {
      this.layer.setMeshTile(this.meshIndex, this.tile.index);
    }
  }

  /**
   * Sets the color of the mesh.
   */
  setColor(color: FloatArrayParam) {
    for (let viewIndex = 0, len = this._renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this.viewStates[viewIndex];
      if (!viewState.colorizing) {
        this.layer.setMeshColor(viewIndex, this.meshIndex, color);
      }
    }
  }

  /**
   * Sets the colorization for a specific view.
   */
  setColorize(viewIndex: number, colorize: FloatArrayParam | null) {
    const viewStates = this.viewStates[viewIndex];
    const meshColorize = viewStates.colorize;
    if (colorize) {
      meshColorize[0] = colorize[0];
      meshColorize[1] = colorize[1];
      meshColorize[2] = colorize[2];
      this.layer.setMeshColor(viewIndex, this.meshIndex, meshColorize);
      viewStates.colorizing = true;
    } else {
      this.layer.setMeshColor(viewIndex, this.meshIndex, this.sceneMesh.color);
      viewStates.colorizing = false;
    }
  }

  /**
   * Sets the opacity of the mesh for a specific view.
   */
  setOpacity(viewIndex: number, opacity: number) {
    const viewStates = this.viewStates[viewIndex];
    viewStates.color[3] = opacity;
    viewStates.colorize[3] = opacity;
    if (this.viewStates[viewIndex].colorizing) {
      this.layer.setMeshColor(viewIndex, this.meshIndex, viewStates.colorize);
    } else {
      this.layer.setMeshColor(viewIndex, this.meshIndex, viewStates.color);
    }
  }

  /**
   * Sets the transparency of the mesh for a specific view.
   */
  setTransparent(viewIndex: number, flags: number) {
    this.layer.setMeshTransparent(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the highlight state of the mesh for a specific view.
   */
  setHighlighted(viewIndex: number, flags: number) {
    this.layer.setMeshHighlighted(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the x-ray state of the mesh for a specific view.
   */
  setXRayed(viewIndex: number, flags: number) {
    this.layer.setMeshXRayed(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the selection state of the mesh for a specific view.
   */
  setSelected(viewIndex: number, flags: number) {
    this.layer.setMeshSelected(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the clippable state of the mesh for a specific view.
   */
  setClippable(viewIndex: number, flags: number) {
    this.layer.setMeshClippable(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the collidable state of the mesh for a specific view.
   */
  setCollidable(viewIndex: number, flags: number) {
    // this.layer.setLayerMeshCollidable(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the pickable state of the mesh for a specific view.
   */
  setPickable(viewIndex: number, flags: number) {
    this.layer.setMeshPickable(viewIndex, this.meshIndex, flags);
  }

  /**
   * Sets the culled state of the mesh for a specific view.
   */
  setCulled(viewIndex: number, flags: number) {
    this.layer.setMeshCulled(viewIndex, this.meshIndex, flags);
  }

  /**
   * Destroys the mesh and releases associated resources.
   */
  destroy() {
    if (this.tile) {
      this.gpuDataMemoryEditor.putTile(this.tile);
    }
  }
}
