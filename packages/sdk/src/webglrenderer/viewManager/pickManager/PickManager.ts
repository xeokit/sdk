import {type PickParams, PickResult} from "../../../viewer";
import {SDKInternalException, type SDKResult} from "../../../core";
import {
  createMat4Float64,
  inverseMat4,
  lookAtMat4v,
  mulMat4,
  transformVec4
} from "../../../math/matrix";
import {
  addVec3, createVec2Float64, createVec3Float64, createVec4Float64,
  cross3Vec3, dotVec4,
  mulVec4Scalar,
  normalizeVec3, subVec3
} from "../../../math/vector";
import {ViewRenderState} from "../ViewRenderState";
import {type FloatArrayParam} from "../../../math";
import {createRTCViewMat} from "../../../math/rtc";
import {RendererMesh} from "../meshManager/RendererMesh";
import {RenderContext} from "../RenderContext";
import {RenderBuffers} from "../RenderBuffers";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {MeshManager} from "../meshManager/MeshManager";
import {ViewManager} from "../ViewManager";
import {GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import {getDrawOps, DrawOps, putDrawOps} from "../drawOps/DrawOps";
import {SceneMesh} from "../../../scene";
import {RENDER_PASSES} from "../RENDER_PASSES";

const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();

const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();
const tempVec4c = createVec4Float64();
const tempVec4d = createVec4Float64();
const tempVec4e = createVec4Float64();

const tempMat4a = createMat4Float64();
const tempMat4b = createMat4Float64();
const tempMat4c = createMat4Float64();

const pickTemps = {
  pickCanvasPos: createVec2Float64(),
  pickWorldRayDir: createVec3Float64(),
  pickWorldRayOrigin: createVec3Float64(),
  pickViewMatrix: createMat4Float64(),
  pickProjMatrix: createMat4Float64()
};

/**
 *  Manages picking of objects within a {@link WebGLRenderer}.
 *
 *  Owned by a {@link ViewManager}.
 *
 *  @internal
 */
export class PickManager {

  private _renderBufferManager: RenderBuffers;
  private _pickResult: PickResult;
  private _renderContext: RenderContext;
  private _gpuMemoryManager: GPUMemoryManager;
  private _meshBatchManager: MeshManager;
  private _drawOps: DrawOps = null;


  constructor(cfg: {
    renderContext: RenderContext;
    gpuMemoryManager: GPUMemoryManager;
    meshManager: MeshManager
  }) {
    this._gpuMemoryManager = cfg.gpuMemoryManager;
    this._meshBatchManager = cfg.meshManager;
    this._renderContext = cfg.renderContext;
    this._pickResult = new PickResult();
  }

  /**
   *
   */
  init(): SDKResult<void> {
    const drawOpsResult = getDrawOps(this._renderContext, this._gpuMemoryManager as GPUMemoryReader);
    if (drawOpsResult.ok === false) {
      return drawOpsResult;
    }
    this._drawOps = drawOpsResult.value;
    return {ok: true, value: undefined};
  }

  webglContextRestored(): SDKResult<void> {
    return this._drawOps ? this._drawOps.webglContextRestored() : {ok: true, value: undefined};
  }

  /**
   * Picks a {@link ViewObject} and/or a 3D position on its surface,
   * given either canvas coordinates or a World-space ray.
   */
  pick(rendererView: ViewRenderState, pickParams: PickParams): SDKResult<PickResult> {

    if (!this._drawOps) {
      throw new SDKInternalException("[PickManager.pick] PickManager not initialized");
    }

    const view = rendererView.view;
    const camera = view.camera;

    const pickResult = this._pickResult;
    pickResult.reset();
    pickResult.view = view;

    const {
      pickCanvasPos,
      pickViewMatrix,
      pickProjMatrix,
      pickWorldRayOrigin,
      pickWorldRayDir
    } = pickTemps;

    let rayPick = false;

    if (pickParams.canvasPos) {

      // Picking at canvas coordinates

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

        this._gpuMemoryManager.setViewPickMatrix(view, pickParams.rayMatrix);

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

        this._gpuMemoryManager.setViewPickMatrix(view, rayMatrix);

        // @ts-ignore
        pickViewMatrix.set(rayMatrix);
        // @ts-ignore
        pickProjMatrix.set(camera.orthoProjection.projMatrix);

        pickResult.origin = pickWorldRayOrigin;
        pickResult.direction = pickWorldRayDir;
      }
    }

    if (pickParams.pickViewObject || pickParams.pickSurface) {

      const pickMeshResult = this._pickMesh({
        rendererView,
        rayPick,
        pickCanvasPos,
        pickViewMatrix,
        pickProjMatrix,
        pickInvisible: !!pickParams.pickInvisible
      });

      if (!pickMeshResult) {
        return { ok: true, value: null };
      }

      pickResult.sceneMesh = pickMeshResult.sceneMesh;

      // if (pickParams.pickSurface) {
      //
      //   const worldPos = this._pickWorldPos({
      //     rendererView,
      //     meshIndex: pickMeshResult.meshIndex,
      //     batchIndex: pickMeshResult.batchIndex,
      //     sceneMesh: pickMeshResult.sceneMesh,
      //     pickCanvasPos,
      //     pickViewMatrix,
      //     pickProjMatrix,
      //     pickInvisible: pickParams.pickInvisible
      //   });
      //
      //   if (!worldPos) {
      //     return false
      //   }
      //
      //     pickResult.worldPos = worldPos;
      // }
    }

    return { ok: true, value: pickResult };
  };

  _pickMesh(
    params: {
      rendererView: ViewRenderState,
      rayPick: boolean,
      pickCanvasPos?: FloatArrayParam,
      pickViewMatrix?: FloatArrayParam,
      pickProjMatrix: FloatArrayParam,
      pickInvisible: boolean
    }
  ): {
    meshIndex: number;
    batchIndex: number;
    sceneMesh: SceneMesh;
  } | null {

    if (!this._drawOps) {
      throw new SDKInternalException("[PickManager.pick] PickManager not initialized");
    }

    const {
      rendererView,
      rayPick,
      pickCanvasPos,
      pickProjMatrix,
      pickViewMatrix,
      pickInvisible
    } = params;

    // Validate required objects
    if (!rendererView || !pickCanvasPos || !pickViewMatrix || !pickProjMatrix) {
      return null;
    }

    const view = rendererView.view;
    const viewIndex = view.viewIndex;
    const resolutionScale = view.resolutionScale;
    const renderContext = this._renderContext;
    const gl = renderContext.gl;
    const pickBuffer = rendererView.renderBuffers.getRenderBuffer("pickMesh", {
      depthTexture: false,
      size: [1, 1]
    });

    // Bind and clear pick buffer
    pickBuffer.bind();
    pickBuffer.clear();

    // Set up render context for picking
    renderContext.reset();
    renderContext.activeView = view;
    renderContext.rayPicking = rayPick;
    renderContext.backfaces = true;
    renderContext.frontface = true;
    renderContext.pickViewMatrix = pickViewMatrix;
    renderContext.pickProjMatrix = pickProjMatrix;
    renderContext.pickInvisible = !!pickInvisible;
    renderContext.pickClipPos = [
      this._getClipPosX(pickCanvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
      this._getClipPosY(pickCanvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight)
    ];

    // Set WebGL state for picking
    gl.viewport(0, 0, 1, 1);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw all mesh batches that are pickable in this view
    const meshBatches = this._meshBatchManager.sortedBatches;
    for (let i = 0, len = meshBatches.length; i < len; i++) {
      const meshBatch = meshBatches[i];
      if (meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.PICK)) {
        this._drawOps[meshBatch.primitive]?.pick?.drawBatch(meshBatch);
      }
    }

    // Read pick result
    const pix = pickBuffer.read(0, 0);
    pickBuffer.unbind();

    if (!pix || pix.length < 4) {
      return null;
    }

    const pickID = pix[0] + (pix[1] << 8) + (pix[2] << 16) + (pix[3] << 24);
    if (pickID < 0) {
      return null;
    }

    const unsignedPickId = pickID >>> 0;
    const batchIndex = (unsignedPickId >>> 16) & 0xFFFF;
    const meshIndex = unsignedPickId & 0xFFFF;

    const sceneMesh = this._meshBatchManager.getMeshAtIndex(batchIndex, meshIndex);
    if (!sceneMesh) {
      return null;
    }

    return { sceneMesh, batchIndex, meshIndex };
  }

  private _pickWorldPos(
    params: {
      rendererView: ViewRenderState,
      sceneMesh: SceneMesh,
      batchIndex: number,
      meshIndex: number,
      pickCanvasPos: FloatArrayParam,
      pickViewMatrix: FloatArrayParam,
      pickProjMatrix: FloatArrayParam,
      pickInvisible: boolean
    }): FloatArrayParam | null {
    return null;
    //
    // const {rendererView, batchIndex, meshIndex, sceneMesh, pickCanvasPos, pickProjMatrix, pickViewMatrix} = params;
    // const view = rendererView.view;
    // const resolutionScale = view.resolutionScale;
    // const meshBatch = this._meshBatchManager.getBatch(batchIndex);
    // const renderContext = this._renderContext;
    // const gl = renderContext.gl;
    // const canvas = rendererView.view.htmlElement;
    // const boundingRect = canvas.getBoundingClientRect();
    // const pickBuffer = rendererView.renderBuffers.getRenderBuffer("pickDepth", {
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
    // this._drawOps.prims[meshBatch.primitive]?.depth?.drawMesh(meshBatch, meshIndex);
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
    // const origin = (sceneMesh.sceneMeshRendererProxy as RendererMesh).tile.center; // HACK: Cast to RendererMesh is a bit dirty
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
    // return worldPos;
  }

  _unpackDepth(depthZ) {
    const vec = createVec4Float64([depthZ[0] / 256.0, depthZ[1] / 256.0, depthZ[2] / 256.0, depthZ[3] / 256.0]);
    const bitShift = createVec4Float64([1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0]);
    return 1.0 - dotVec4(vec, bitShift);
  }

  _getClipPosX(pos: number, size: number) {
    return 2 * (pos / size) - 1;
  }

  _getClipPosY(pos: number, size: number) {
    return 1 - 2 * (pos / size);
  }

  /**
   * Cleans up resources used by this PickManager.
   */
  destroy() {
    if (this._drawOps) {
      putDrawOps(this._drawOps);
      this._gpuMemoryManager = null;
      this._meshBatchManager = null;
      this._renderContext = null;
      this._renderBufferManager = null;
      this._drawOps = null;

    }
  }


}
