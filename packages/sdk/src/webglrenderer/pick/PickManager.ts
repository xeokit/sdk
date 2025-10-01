import {type PickParams, PickResult} from "../../viewer";
import {SDKError} from "../../core";
import {
  addVec3, createMat4, createVec2, createVec3, createVec4,
  cross3Vec3, dotVec4,
  inverseMat4,
  lookAtMat4v,
  mulMat4,
  mulVec4Scalar,
  normalizeVec3, subVec3,
  transformVec4
} from "../../matrix";
import {RendererViewImpl} from "../views/RendererViewImpl";
import {type FloatArrayParam} from "../../math";
import {createRTCViewMat} from "../../rtc";
import {RendererMeshImpl} from "../renderGraph/RendererMeshImpl";
import {RenderContext} from "../RenderContext";
import {RenderBufferManager} from "../views/RenderBufferManager";
import {GPUMemoryReadIF} from "../gpuMemory/GPUMemoryReadIF";
import {RenderGraph} from "../renderGraph/RenderGraph";
import {ViewManager} from "../views/ViewManager";
import {GPUMemory} from "../gpuMemory/GPUMemory";
import {getLayerRendererSet, LayerRendererSet, putLayerRendererSet} from "../render/layerRenderers/LayerRendererSet";
import {RENDER_PASSES} from "../renderGraph/RENDER_PASSES";



const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();

const tempVec4a = createVec4();
const tempVec4b = createVec4();
const tempVec4c = createVec4();
const tempVec4d = createVec4();
const tempVec4e = createVec4();

const tempMat4a = createMat4();
const tempMat4b = createMat4();
const tempMat4c = createMat4();

const pickTemps = {
  pickCanvasPos: createVec2(),
  pickWorldRayDir: createVec3(),
  pickWorldRayOrigin: createVec3(),
  pickViewMatrix: createMat4(),
  pickProjMatrix: createMat4()
};

/**
 *  Manages picking of objects within a {@link WebGLRenderer}.
 * @private
 */
export class PickManager {

  private _pickBufferManager: RenderBufferManager;
  private _pickResult: PickResult;
  private _renderContext: RenderContext;
  private _gpuMemory: GPUMemory;
  private _renderGraph: RenderGraph;
  private _layerRendererSet: LayerRendererSet;

  constructor( cfg: {
    renderContext: RenderContext,
    gpuMemory: GPUMemory,
    renderGraph: RenderGraph,
    viewManager: ViewManager
  } ) {
    this._gpuMemory = cfg.gpuMemory;
    this._renderGraph = cfg.renderGraph;
    this._layerRendererSet = getLayerRendererSet(this._renderContext, this._gpuMemory as GPUMemoryReadIF);
  }

  /**
   * Picks a {@link ViewObject} and/or a 3D position on its surface, given either canvas coordinates or a World-space ray.
   */
  pick( rendererView: RendererViewImpl,
        pickParams: PickParams,
        pickResult = this._pickResult ): PickResult|null {

    if (!this._renderContext) {
      throw new SDKError("Can't pick object with WebGLRenderer - no Viewer and View is attached");
    }

    const view = rendererView.view;
    const camera = view.camera;

    pickResult.reset();

    const {
      pickCanvasPos,
      pickViewMatrix,
      pickProjMatrix,
      pickWorldRayOrigin,
      pickWorldRayDir
    } = pickTemps;

    let rayPick = false;

    if (pickParams.canvasPos) {

      // @ts-ignore
      pickCanvasPos.set(pickParams.canvasPos);
      // @ts-ignore
      pickViewMatrix.set(camera.viewMatrix);
      // @ts-ignore
      pickProjMatrix.set(camera.projMatrix);

      pickResult.canvasPos = pickParams.canvasPos;

    } else {

      // Picking with arbitrary World-space ray
      // Align camera along ray and fire ray through center of canvas

        rayPick = true;

      pickCanvasPos[0] = view.htmlElement.clientWidth * 0.5;
      pickCanvasPos[1] = view.htmlElement.clientHeight * 0.5;

      if (pickParams.rayMatrix) {

        // Ray defined as matrix

        this._gpuMemory.setPickMatrix(view, pickParams.rayMatrix);

        // @ts-ignore
        pickViewMatrix.set(pickParams.rayMatrix);
        // @ts-ignore
        pickProjMatrix.set(camera.orthoProjection.projMatrix);

      } else {

        // Ray defined as origin and direction

        // @ts-ignore
        pickWorldRayOrigin.set(pickParams.rayOrigin || [0, 0, 0]);
        // @ts-ignore
        pickWorldRayDir.set(pickParams.rayDirection || [0, 1, 0]);

        const look = addVec3(pickWorldRayOrigin, pickWorldRayDir, tempVec3a);

        tempVec3b[0] = Math.random();
        tempVec3b[1] = Math.random();
        tempVec3b[2] = Math.random();
        normalizeVec3(tempVec3b);
        cross3Vec3(pickWorldRayDir, tempVec3b, tempVec3c);
        const rayMatrix = lookAtMat4v(pickWorldRayOrigin, look, tempVec3c, tempMat4b);

        this._gpuMemory.setPickMatrix(view, rayMatrix);

        // @ts-ignore
        pickViewMatrix.set(rayMatrix);
        // @ts-ignore
        pickProjMatrix.set(camera.orthoProjection.projMatrix);

        pickResult.origin = pickWorldRayOrigin;
        pickResult.direction = pickWorldRayDir;
      }
    }

    if (pickParams.pickViewObject || pickParams.pickSurface) {

      // Pick a ViewObject

      const rendererObject = this._pickMesh({
        rendererView,
        rayPick,
        pickCanvasPos,
        pickViewMatrix,
        pickProjMatrix,
        pickInvisible: !!pickParams.pickInvisible
      });

      if (rendererObject) {

        const rendererObject = rendererObject.rendererObject;
        const view = rendererView.view;

        pickResult.viewObject = view.objects[rendererObject.id];

        if (pickParams.pickSurface) {

          // Pick 3D position on surface of ViewObject

          // const worldPos = this._pickWorldPos({
          //   rendererView,
          //   rendererObject,
          //   pickCanvasPos,
          //   pickViewMatrix,
          //   pickProjMatrix,
          //   pickInvisible: pickParams.pickInvisible
          // });

          // if (worldPos) {
          //   pickResult.worldPos = worldPos;
          // }
        }
      }
    }

    return pickResult;
  };

  _pickMesh(
    params: {
      rendererView: RendererViewImpl,
      rayPick: boolean,
      pickCanvasPos?: FloatArrayParam,
      pickViewMatrix?: FloatArrayParam,
      pickProjMatrix: FloatArrayParam,
      pickInvisible: boolean
    } ): RendererMeshImpl {

    const {rendererView, rayPick, pickCanvasPos, pickProjMatrix, pickViewMatrix, pickInvisible} = params;

    const view = rendererView.view;
    const viewIndex = view.viewIndex;
    const boundingRect = rendererView.view.htmlElement.getBoundingClientRect();
    const resolutionScale = view.resolutionScale;
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const pickBuffer = this._pickBufferManager.getRenderBuffer("pickMesh", {
      depthTexture: false,
      size: [1, 1]
    });
    pickBuffer.bind();
    pickBuffer.clear();
    renderContext.reset();
    renderContext.rayPicking = rayPick;
    renderContext.backfaces = true;
    renderContext.frontface = true; // "ccw"
    renderContext.pickViewMatrix = pickViewMatrix;
    renderContext.pickProjMatrix = pickProjMatrix;
    renderContext.pickInvisible = !!pickInvisible;
    renderContext.pickClipPos = [
      this._getClipPosX(pickCanvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
      this._getClipPosY(pickCanvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight)
    ];

    gl.viewport(0, 0, 1, 1);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const layers = this._renderGraph.layers;
    for (let i = 0, len = layers.length; i < len; i++) {
      const layer = layers[i];
      const meshCounts = layer.meshCounts[viewIndex];
      if (meshCounts.numVisible === 0 ||
          meshCounts.numCulled === meshCounts.numMeshes ||
          meshCounts.numPickable ===0
      ) {
        continue;
      }
      this._layerRendererSet.prims[layer.primitive]?.pick?.renderLayer(layer, RENDER_PASSES.PICK);
    }

    const pix = pickBuffer.read(0, 0);
    const pickID = pix[0] + (pix[1] << 8) + (pix[2] << 16) + (pix[3] << 24);
    pickBuffer.unbind();
    if (pickID < 0) {
      return null;
    }

    const result = this._extract16BitParts(pickID);


    const rendererMesh = this._renderGraph.
    return <RendererMeshImpl>this._pickIDs.items[pickID];
  }

  _extract16BitParts(unsignedInt) {
    // Ensure input is treated as an unsigned 32-bit integer
    unsignedInt = unsignedInt >>> 0;
    // Extract high 16 bits by shifting right
    const high16 = (unsignedInt >>> 16) & 0xFFFF;
    // Extract low 16 bits by masking
    const low16 = unsignedInt & 0xFFFF;
    return {
      layer: this._renderGraph.layers[high16],
      layerIndex: high16,
      meshIndex: low16
    };
  }


  _pickWorldPos(
    params: {
      rendererView: RendererViewImpl,
      pickCanvasPos: FloatArrayParam,
      pickViewMatrix: FloatArrayParam,
      pickProjMatrix: FloatArrayParam,
      pickInvisible: boolean,
      rendererMesh: RendererMeshImpl
    } ): FloatArrayParam|null {

    // const {rendererView, rendererObject, pickCanvasPos, pickProjMatrix, pickViewMatrix} = params;
    // const view = rendererView.view;
    // const resolutionScale = view.resolutionScale;
    // const _layer = rendererObject._layer;
    // const renderContext = this._renderContext;
    // const gl = renderContext.gl;
    // const canvas = rendererView.view.htmlElement;
    // const boundingRect = canvas.getBoundingClientRect();
    // const pickBuffer = rendererView.renderBufferManager.getRenderBuffer("pickDepth", {
    //   depthTexture: true,
    //   size: [1, 1]
    // });
    // pickBuffer.bind();
    // pickBuffer.clear();
    // renderContext.reset();
    // renderContext.backfaces = true;
    // renderContext.frontface = true; // "ccw"
    // renderContext.pickViewMatrix = pickViewMatrix;
    // renderContext.pickProjMatrix = pickProjMatrix;
    // renderContext.pickInvisible = !!params.pickInvisible;
    // renderContext.pickClipPos = [
    //   this._getClipPosX(params.pickCanvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
    //   this._getClipPosY(params.pickCanvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight)
    // ];
    //
    // gl.viewport(0, 0, 1, 1);
    // gl.depthMask(true);
    // gl.enable(gl.DEPTH_TEST);
    // gl.disable(gl.CULL_FACE);
    // gl.disable(gl.BLEND);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //
    // // _layer.drawPickDepths();
    //
    // const pix = pickBuffer.read(0, 0);
    //
    // pickBuffer.unbind();
    //
    // const screenZ = this._unpackDepth(pix); // Get screen-space Z at the given canvas coords
    //
    // // Calculate clip space coordinates, which will be in range of x=[-1..1] and y=[-1..1], with y=(+1) at top
    //
    // const x = (pickCanvasPos[0] - canvas.clientWidth / 2) / (canvas.clientWidth / 2);
    // const y = -(pickCanvasPos[1] - canvas.clientHeight / 2) / (canvas.clientHeight / 2);
    //
    // // Ensure that unprojection matrix is in RTC space if needed
    //
    // const origin = rendererObject.tile.center;
    // const gotOrigin = (origin[0] !== 0 && origin[1] !== 0 && origin[2] !== 0);
    // let pvMat = gotOrigin
    //   ? mulMat4(pickProjMatrix, createRTCViewMat(pickViewMatrix, origin, tempMat4a), tempMat4b)
    //   : mulMat4(pickProjMatrix, pickViewMatrix, tempMat4b);
    //
    // const pvMatInverse = inverseMat4(pvMat, tempMat4c);
    //
    // tempVec4a[0] = x;
    // tempVec4a[1] = y;
    // tempVec4a[2] = -1;
    // tempVec4a[3] = 1;
    //
    // let world1 = transformVec4(pvMatInverse, tempVec4a);
    // world1 = mulVec4Scalar(world1, 1 / world1[3]);
    //
    // tempVec4b[0] = x;
    // tempVec4b[1] = y;
    // tempVec4b[2] = 1;
    // tempVec4b[3] = 1;
    //
    // let world2 = transformVec4(pvMatInverse, tempVec4b);
    // world2 = mulVec4Scalar(world2, 1 / world2[3]);
    //
    // const dir = subVec3(world2, world1, tempVec4c);
    // const worldPos = addVec3(world1, mulVec4Scalar(dir, screenZ, tempVec4d), tempVec4e);
    //
    // if (gotOrigin) {
    //   addVec3(worldPos, origin);
    // }
    // console.log(worldPos);
    // return worldPos;
    return null;
  }

  _unpackDepth( depthZ ) {
    const vec = [depthZ[0] / 256.0, depthZ[1] / 256.0, depthZ[2] / 256.0, depthZ[3] / 256.0];
    const bitShift = [1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0];
    return 1.0 - dotVec4(vec, bitShift);
  }

  _getClipPosX( pos: number, size: number ) {
    return 2 * (pos / size) - 1;
  }

  _getClipPosY( pos: number, size: number ) {
    return 1 - 2 * (pos / size);
  }

  /**
   * Cleans up resources used by this PickManager.
   */
  destroy() {
    if (this._layerRendererSet) {
      putLayerRendererSet(this._layerRendererSet);
      this._layerRendererSet = null;
    }
  }
}
