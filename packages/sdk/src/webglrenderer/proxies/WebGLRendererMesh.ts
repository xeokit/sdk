import {createMat4, createVec4, mulMat4,  transformPoint4, translationMat4c} from "../../matrix";
import type {RendererGeometry, RendererMesh, RendererObject, RendererTextureSet, SceneObject} from "../../scene";
import type {FloatArrayParam} from "../../math";
import type {Layer} from "../layer/Layer";
import type {RenderContext} from "../RenderContext";
import {SceneMesh} from "../../scene";
import {type DTXTile} from "../dtx/DTXTile";
import {WebGLRendererObject} from "./WebGLRendererObject";


const identityMat4 = createMat4();
const identityVec4 = createVec4([0, 0, 0, 1]);
const tempVec4a = createVec4();
const tempVec4b = createVec4();
const tempVec4c = createVec4();
const tempMat4a = createMat4();
const tempMat4b = createMat4();

/**
 * @private
 */
export class WebGLRendererMesh implements RendererMesh {

  id: string;
  renderContext: RenderContext;
  rendererObject: WebGLRendererObject | null;
  rendererGeometry: RendererGeometry;
  sceneMesh: SceneMesh;
  layer: Layer;
  meshIndex: number;
  tile: DTXTile;
  color: FloatArrayParam;
  opacity: number;
  viewStates: any;


  constructor(params: {
    meshIndex: number;
    renderContext: RenderContext;
    sceneMesh: SceneMesh;
    layer: Layer;
    id: string;
    rendererGeometry: RendererGeometry;
  }) {
    const {
      meshIndex,
      renderContext,
      sceneMesh,
      layer,
      id,
      rendererGeometry,
    } = params;

    const color = (sceneMesh.color) ? new Uint8Array([Math.floor(sceneMesh.color[0] * 255), Math.floor(sceneMesh.color[1] * 255), Math.floor(sceneMesh.color[2] * 255)]) : [255, 255, 255];
    const opacity = (sceneMesh.opacity !== undefined && sceneMesh.opacity !== null) ? Math.floor(sceneMesh.opacity * 255) : 255;

    this.renderContext = renderContext;
    this.rendererGeometry = rendererGeometry;
    this.id = id;
    this.sceneMesh = sceneMesh;
    this.tile = null;
    this.layer = layer;
    this.opacity = opacity;
    this.meshIndex = meshIndex;

    const r = color[0], g = color[1], b = color[2], a = opacity;
    this.color = [r, g, b, a];

    this.viewStates = new Array(4);
    const isTransparent = (opacity < 255);
    for (let i = 0; i < 4; i++) {
      this.viewStates[i] = {
        colorize: [r, g, b, a],
        colorizing: false,
        transparent: isTransparent
      };
    }

    this.setMatrix(sceneMesh.matrix);
  }

  initFlags(viewIndex: number, flags: number) {
    this.layer.initMeshFlags(viewIndex, this.meshIndex, flags);
  }

  setVisible(viewIndex: number, flags: any) {
    this.layer.setMeshVisible(viewIndex, this.meshIndex, flags);
  }

  setMatrix(matrix: FloatArrayParam): void {
    matrix = matrix || identityMat4;
    const center = transformPoint4(matrix, identityVec4, tempVec4a);
    const oldTile = this.tile;
    this.tile = oldTile
      ? this.renderContext.dtxMemory.moveTile(oldTile, center)
      : this.renderContext.dtxMemory.getTile(center);
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

  setColor(color: FloatArrayParam) {
    this.color[0] = color[0];
    this.color[1] = color[1];
    this.color[2] = color[2];
    for (let viewIndex = 0, len = this.renderContext.viewer.viewList.length; viewIndex < len; viewIndex++) {
      const viewState = this.viewStates[viewIndex];
      if (!viewState.colorizing) {
        this.layer.setMeshColor(viewIndex, this.meshIndex, color);
      }
    }
  }

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
      this.layer.setMeshColor(viewIndex, this.meshIndex, meshColorize);
      viewStates.colorizing = false;
    }
  }

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

  setTransparent(viewIndex: number, flags: number) {
    this.layer.setMeshTransparent(viewIndex, this.meshIndex, flags);
  }

  setHighlighted(viewIndex: number, flags: number) {
    this.layer.setMeshHighlighted(viewIndex, this.meshIndex, flags);
  }

  setXRayed(viewIndex: number, flags: number) {
    this.layer.setMeshXRayed(viewIndex, this.meshIndex, flags);
  }

  setSelected(viewIndex: number, flags: number) {
    this.layer.setMeshSelected(viewIndex, this.meshIndex, flags);
  }

  setClippable(viewIndex: number, flags: number) {
    this.layer.setMeshClippable(viewIndex, this.meshIndex, flags);
  }

  setCollidable(viewIndex: number, flags: number) {
// this.layer.setLayerMeshCollidable(viewIndex, this.meshIndex, flags);
  }

  setPickable(viewIndex: number, flags: number) {
    this.layer.setMeshPickable(viewIndex, this.meshIndex, flags);
  }

  setCulled(viewIndex: number, flags: number) {
    this.layer.setMeshCulled(viewIndex, this.meshIndex, flags);
  }

  destroy() {
    if (this.tile) {
      this.renderContext.dtxMemory.putTile(this.tile);
    }
  }
}
