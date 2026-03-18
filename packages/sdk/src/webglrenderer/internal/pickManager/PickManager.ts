import {type PickParams, PickResult} from "../../../viewer";
import {SDKInternalException, type SDKResult} from "../../../core";
import {
  createMat4Float64, inverseMat4,
  lookAtMat4v, type Mat4, mulMat4, transformVec4
} from "../../../math/matrix";
import {
  addVec3, createVec2Float64, createVec3Float64, createVec4Float64,
  cross3Vec3, dotVec4, mulVec3Scalar, mulVec4Scalar, normalizeVec3, subVec3, type Vec2, type Vec3
} from "../../../math/vector";
import {ViewRenderState} from "../ViewRenderState";
import {RenderContext} from "../RenderContext";
import {WebGLPickBuffer} from "../../../webglutils/WebGLPickBuffer";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {MeshManager} from "../meshManager/MeshManager";
import {ViewManager} from "../ViewManager";
import {GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import {getDrawOps, DrawOps, putDrawOps} from "../drawOps/DrawOps";
import {SceneMesh} from "../../../scene";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {createRTCViewMat} from "../../../math/rtc";

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
const tempMat4d = createMat4Float64();

const pickTemps = {
  pickCanvasPos: createVec2Float64() as Vec2,
  pickWorldRayDir: createVec3Float64() as Vec3,
  pickWorldRayOrigin: createVec3Float64() as Vec3,
  pickViewMatrix: createMat4Float64() as Mat4,
  pickProjMatrix: createMat4Float64() as Mat4
};

/**
 *  Manages picking of objects within a {@link WebGLRenderer}.
 *
 *  Owned by a {@link ViewManager}.
 *
 *  @internal
 */
export class PickManager {

  private _pickBuffer: WebGLPickBuffer;
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
   * Initializes this PickManager, allocating necessary resources. If initialization fails, an error result is returned.
   */
  init(): SDKResult<void> {
    const drawOpsResult = getDrawOps(this._renderContext, this._gpuMemoryManager as GPUMemoryReader);
    if (drawOpsResult.ok === false) {
      return drawOpsResult;
    }
    this._drawOps = drawOpsResult.value;
    this._pickBuffer = new WebGLPickBuffer(this._renderContext.gl);
    const pickBufferResult = this._pickBuffer.init();
    if (pickBufferResult.ok === false) {
      putDrawOps(this._drawOps);
      this._drawOps = null;
      this._pickBuffer = null;
      return pickBufferResult;
    }
    return {ok: true, value: undefined};
  }

  webglContextRestored(): SDKResult<void> {
    if (!this._drawOps) {
      return {ok: true, value: undefined};
    }
    const result1 = this._drawOps.webglContextRestored();
    if (result1.ok === false) {
      return result1;
    }
    const result2 = this._pickBuffer.webglContextRestored(this._renderContext.gl);
    if (result2.ok === false) {
      return result2;
    }
    return {ok: true, value: undefined};
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

    const pickMeshResult = this._pickMesh({
      rendererView,
      rayPick,
      pickCanvasPos,
      pickViewMatrix,
      pickProjMatrix,
      pickInvisible: !!pickParams.pickInvisible
    });

    if (!pickMeshResult) {
      return {ok: true, value: null};
    }

    const sceneObject = pickMeshResult.sceneMesh.object;

    pickResult.sceneMesh = pickMeshResult.sceneMesh;
    pickResult.worldPos = pickMeshResult.worldPos;
    pickResult.sceneObject = sceneObject;
    pickResult.viewObject = view.objects[sceneObject.id];

    return {ok: true, value: pickResult};
  };

  private _pickMesh(
    params: {
      rendererView: ViewRenderState,
      rayPick: boolean,
      pickCanvasPos?: Vec2,
      pickViewMatrix?: Mat4,
      pickProjMatrix: Mat4,
      pickInvisible: boolean
    }
  ): {
    meshIndex: number;
    batchIndex: number;
    sceneMesh: SceneMesh;
    worldPos: Vec3;
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
    const pickBuffer = this._pickBuffer;

    pickBuffer.bind();
    pickBuffer.clear();

    renderContext.reset();

    // TODO: Hardwired to perspective projection for now - need to support picking with orthographic projection as well
    renderContext.pickZNear = view.camera.perspectiveProjection.near;
    renderContext.pickZFar = view.camera.perspectiveProjection.far;

    renderContext.activeView = view;
    renderContext.rayPicking = rayPick;
    renderContext.backfaces = true;
    renderContext.frontface = true;
    // renderContext.pickViewMatrix = pickViewMatrix;
    renderContext.pickProjMatrix = pickProjMatrix;
    renderContext.pickInvisible = !!pickInvisible;
    renderContext.pickClipPos = [
      this._getClipPosX(pickCanvasPos[0] * resolutionScale.resolutionScale, gl.drawingBufferWidth),
      this._getClipPosY(pickCanvasPos[1] * resolutionScale.resolutionScale, gl.drawingBufferHeight)
    ];

    gl.viewport(0, 0, 1, 1);
    const bg = rendererView.view.transparent ? [0, 0, 0, 0] : [...view.backgroundColor, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.lineWidth(1);
    renderContext.lineWidth = 1;

    const meshBatches = this._meshBatchManager.sortedBatches;
    for (let i = 0, len = meshBatches.length; i < len; i++) {
      const meshBatch = meshBatches[i];
      if (meshBatch.hasMeshesInRenderPass(viewIndex, RENDER_PASSES.PICK)) {
        this._drawOps.prims[meshBatch.primitive]?.pick?.drawBatch(meshBatch);
      }
    }

    const {target0, target1, target2} = pickBuffer.read();

    pickBuffer.unbind();

    const batchIndex = unpackRGBA8ToUint(target0);
    const meshIndex = unpackRGBA8ToUint(target1);
    const depth = this._unpackDepth(target2);

    const sceneMesh = this._meshBatchManager.getMeshAtIndex(batchIndex, meshIndex);
    if (!sceneMesh) {
      return null;
    }

    const gpuTile = this._meshBatchManager.getMeshTile(sceneMesh);
    if (!gpuTile) {
      // TODO: Log error
      return null;
    }

    const canvas = view.htmlElement;

    // Convert the picked canvas position to
    // normalized device coordinates (NDC) for WebGL:

    // Calculate clip space coordinates, which will be in range of x=[-1..1] and y=[-1..1], with y=(+1) at top
    // and z in range of [-1..1] with -1 at near plane and +1 at far plane.
    const x = (pickCanvasPos[0] - canvas.clientWidth / 2) / (canvas.clientWidth / 2);
    const y = -(pickCanvasPos[1] - canvas.clientHeight / 2) / (canvas.clientHeight / 2);

    // Compose the projection-view matrix (pvMat) and its inverse (pvMatInverse).

    const tileOrigin = gpuTile.center;
    const gotOrigin = (tileOrigin[0] !== 0 && tileOrigin[1] !== 0 && tileOrigin[2] !== 0);
    const viewMatrix = gotOrigin ? createRTCViewMat(pickViewMatrix , tileOrigin, tempMat4a) : pickViewMatrix;
    const coordSysMatrix = sceneMesh.model.coordinateSystemMatrix;

    const pvmMat = mulMat4(mulMat4(pickProjMatrix, viewMatrix, tempMat4b), coordSysMatrix, tempMat4d);
    const pvMatInverse = inverseMat4(pvmMat, tempMat4c);

    // Unproject two points from NDC to world space:
    //   - One at near plane (z = -1)
    //   - One at far plane (z = 1)

    tempVec4a[0] = x;
    tempVec4a[1] = y;
    tempVec4a[2] = -1;
    tempVec4a[3] = 1;

    let world1 = transformVec4(pvMatInverse, tempVec4a); // Unproject from NDC to world space
    mulVec4Scalar(world1, 1 / world1[3], world1); // Homogeneous divide to get world coordinates

    tempVec4b[0] = x;
    tempVec4b[1] = y;
    tempVec4b[2] = 1;
    tempVec4b[3] = 1;

    let world2 = transformVec4(pvMatInverse, tempVec4b); // Unproject from NDC to world space
    mulVec4Scalar(world2, 1 / world2[3], world2); // Homogeneous divide to get world coordinates

    // Compute the ray direction from near to far.
    // Use the depth value from the pick buffer to
    // interpolate the world position along the ray.

    const dir = subVec3(world2 as Vec3, world1 as Vec3, tempVec3a);
    const offset = mulVec3Scalar(dir as Vec3, depth, tempVec3b);
    const worldPos = addVec3(world1 as Vec3, offset, tempVec3c);

    // If the mesh is in a relative-to-center (RTC) tile,
    // adjust the world position by the tile origin.

    if (gotOrigin) {
      addVec3(worldPos, tileOrigin, worldPos);
    }

    return {sceneMesh, batchIndex, meshIndex, worldPos};
  }

  _unpackDepth(depthZ) {
    const vec = createVec4Float64([depthZ[0] / 256.0, depthZ[1] / 256.0, depthZ[2] / 256.0, depthZ[3] / 256.0]);
    const bitShift = createVec4Float64([1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0]);
    return dotVec4(vec, bitShift);
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
      this._pickBuffer.destroy();
      this._pickBuffer = null;
      this._drawOps = null;

    }
  }
}

function unpackRGBA8ToUint(bytes: Uint8Array<any>): number {
  return (
    (bytes[0] >>> 0) |
    ((bytes[1] << 8) >>> 0) |
    ((bytes[2] << 16) >>> 0) |
    ((bytes[3] << 24) >>> 0)
  ) >>> 0;
}
