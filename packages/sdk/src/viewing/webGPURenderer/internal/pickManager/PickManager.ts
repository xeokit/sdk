import {type SDKResult} from "../../../../base/core";
import {
  createMat4Float64,
  mulMat4,
  transformVec4,
  type Mat4
} from "../../../../base/math/matrix";
import {createVec2Float64, createVec4Float64, type Vec2} from "../../../../base/math/vector";
import {createVec3Float64, type Vec3} from "../../../../base/math/vector";
import type {PickParams} from "../../../viewer/PickParams";
import {PickResult} from "../../../viewer/PickResult";
import type {View} from "../../../viewer/View";
import type {SceneMesh} from "../../../../model/scene";
import {MeshManager, type RendererMesh} from "../meshManager";
import type {SnapManager} from "../snapManager";
import type {RenderContext} from "../RenderContext";
import {WebGPUPickBuffer, WebGPUSnapBuffer} from "../webGPU";
import {isWorldPosClipped} from "../sectionPlanes";

const tempModelViewMatrix = createMat4Float64();
const tempModelViewProjectionMatrix = createMat4Float64();
const tempVertex = createVec4Float64();
const tempClip = createVec4Float64();
const tempPickCanvas = createVec2Float64();
const tempCanvasA = createVec2Float64();
const tempCanvasB = createVec2Float64();
const tempCanvasC = createVec2Float64();
const tempLocalPos = createVec3Float64();
const tempWorldPos = createVec3Float64();
const tempViewPos = createVec3Float64();
const tempWorldHomogeneous = createVec4Float64();
const tempViewHomogeneous = createVec4Float64();

interface MeshPickHit {
  sceneMesh: SceneMesh;
  depth: number;
  indices: Int32Array;
  localPos: Vec3;
  worldPos: Vec3;
  viewPos: Vec3;
}

interface GPUPickMeshHit {
  meshState: RendererMesh;
  globalSlot: number;
}

type GPUPickMeshCallback = (
  pickBuffer: WebGPUPickBuffer,
  canvasPos: ArrayLike<number>
) => Promise<SDKResult<GPUPickMeshHit | null>>;

type GPUVertexSnapCallback = (
  snapBuffer: WebGPUSnapBuffer,
  canvasPos: ArrayLike<number>
) => Promise<SDKResult<GPUPickMeshHit | null>>;

type GPUEdgeSnapCallback = GPUVertexSnapCallback;

/**
 * Owns WebGPU renderer-backed picking.
 *
 * WebGPU buffer readback is asynchronous in browsers, while the current
 * renderer pick API is synchronous. This first WebGPU pick path therefore uses
 * the renderer's decoded triangle data and view state directly. PickManager
 * also owns the async GPU object-pick and vertex-snap bridge used internally
 * when callers can await WebGPU readback.
 *
 * @internal
 */
export class PickManager {

  private readonly _meshManager: MeshManager;
  private readonly _snapManager: SnapManager;
  private readonly _pickBuffer: WebGPUPickBuffer;
  private readonly _pickResult = new PickResult();
  private _gpuPickQueue: Promise<void> = Promise.resolve();

  constructor(params: {
    renderContext: RenderContext;
    meshManager: MeshManager;
    snapManager: SnapManager;
  }) {
    this._meshManager = params.meshManager;
    this._snapManager = params.snapManager;
    this._pickBuffer = new WebGPUPickBuffer(params.renderContext);
  }

  public pick(view: View, pickParams: PickParams): SDKResult<PickResult> {
    void this._snapManager;

    const pickCanvasPos = this._getPickCanvasPos(view, pickParams);
    if (!pickCanvasPos) {
      return {
        ok: true,
        value: null
      };
    }
    const pickBufferResult = this._pickBuffer.ensureSize(1, 1);
    if (pickBufferResult.ok === false) {
      return pickBufferResult;
    }

    const surfaceHit = this._pickMesh({
      view,
      pickCanvasPos,
      pickInvisible: !!pickParams.pickInvisible
    });
    const wantsSnap = this._wantsSnap(pickParams);
    const snapResult = wantsSnap ? this._snapManager.snapPick(view, pickParams) : null;
    if (snapResult?.ok === false) {
      return snapResult;
    }
    const snap = snapResult?.value ?? null;

    if (!surfaceHit?.sceneMesh.object && !snap?.sceneMesh?.object) {
      return {
        ok: true,
        value: null
      };
    }

    const pickResult = this._pickResult;
    pickResult.reset();
    pickResult.view = view;
    pickResult.canvasPos = pickCanvasPos;

    if (surfaceHit?.sceneMesh.object) {
      const sceneObject = surfaceHit.sceneMesh.object;
      pickResult.sceneMesh = surfaceHit.sceneMesh;
      pickResult.sceneObject = sceneObject;
      pickResult.viewObject = view.objects?.[sceneObject.id] ?? null;
      pickResult.indices = surfaceHit.indices;
      pickResult.localPos = surfaceHit.localPos;
      pickResult.worldPos = surfaceHit.worldPos;
      pickResult.viewPos = surfaceHit.viewPos;
    }

    if (snap?.sceneMesh?.object) {
      pickResult.sceneMesh = snap.sceneMesh;
      pickResult.sceneObject = snap.sceneMesh.object;
      pickResult.viewObject = view.objects?.[snap.sceneMesh.object.id] ?? null;
      pickResult.worldPos = snap.worldPos;
      pickResult.snappedToVertex = snap.snappedToVertex;
      pickResult.snappedToEdge = snap.snappedToEdge;
      pickResult.snappedCanvasPos = snap.snappedCanvasPos;
    }

    return {
      ok: true,
      value: pickResult
    };
  }

  public async pickGPUAsync(
    view: View,
    pickParams: PickParams,
    pickMeshGPUAsync: GPUPickMeshCallback,
    snapVertexGPUAsync?: GPUVertexSnapCallback,
    snapEdgeGPUAsync?: GPUEdgeSnapCallback
  ): Promise<SDKResult<PickResult>> {
    const run = () => this._pickGPUAsyncNow(view, pickParams, pickMeshGPUAsync, snapVertexGPUAsync, snapEdgeGPUAsync);
    const result = this._gpuPickQueue.then(run, run);
    this._gpuPickQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async _pickGPUAsyncNow(
    view: View,
    pickParams: PickParams,
    pickMeshGPUAsync: GPUPickMeshCallback,
    snapVertexGPUAsync?: GPUVertexSnapCallback,
    snapEdgeGPUAsync?: GPUEdgeSnapCallback
  ): Promise<SDKResult<PickResult>> {
    const pickCanvasPos = this._getPickCanvasPos(view, pickParams);
    if (!pickCanvasPos) {
      return {
        ok: true,
        value: null
      };
    }

    if (pickParams.pickInvisible || (this._wantsSnap(pickParams) && !snapVertexGPUAsync && !snapEdgeGPUAsync)) {
      return this.pick(view, pickParams);
    }

    if (pickParams.snapToEdge === true && snapEdgeGPUAsync) {
      const snapResult = await this._snapManager.snapEdgeGPUAsync(view, pickParams, snapEdgeGPUAsync);
      if (snapResult.ok === false) {
        return snapResult;
      }
      if (snapResult.value) {
        return {
          ok: true,
          value: snapResult.value
        };
      }
    }

    if (pickParams.snapToVertex === true && snapVertexGPUAsync) {
      const snapResult = await this._snapManager.snapVertexGPUAsync(view, pickParams, snapVertexGPUAsync);
      if (snapResult.ok === false) {
        return snapResult;
      }
      if (snapResult.value) {
        return {
          ok: true,
          value: snapResult.value
        };
      }
    }

    const gpuHitResult = await pickMeshGPUAsync(this._pickBuffer, pickCanvasPos);
    if (gpuHitResult.ok === false) {
      return gpuHitResult;
    }
    const gpuHit = gpuHitResult.value;
    if (!gpuHit || !this._meshManager.isMeshPickableInView(gpuHit.meshState, view, false)) {
      return {
        ok: true,
        value: null
      };
    }

    const surfaceHit = this._pickMeshTriangles(gpuHit.meshState, view, pickCanvasPos);
    const sceneMesh = surfaceHit?.sceneMesh ?? gpuHit.meshState.mesh;
    if (!sceneMesh.object) {
      return {
        ok: true,
        value: null
      };
    }

    const pickResult = new PickResult();
    pickResult.view = view;
    pickResult.canvasPos = pickCanvasPos;
    pickResult.sceneMesh = sceneMesh;
    pickResult.sceneObject = sceneMesh.object;
    pickResult.viewObject = view.objects?.[sceneMesh.object.id] ?? null;
    if (surfaceHit) {
      pickResult.indices = surfaceHit.indices;
      pickResult.localPos = surfaceHit.localPos;
      pickResult.worldPos = surfaceHit.worldPos;
      pickResult.viewPos = surfaceHit.viewPos;
    }

    return {
      ok: true,
      value: pickResult
    };
  }

  public destroy(): void {
    this._pickBuffer.destroy();
  }

  private _pickMesh(params: {
    view: View;
    pickCanvasPos: Vec2;
    pickInvisible: boolean;
  }): MeshPickHit | null {
    const meshStates = this._meshManager.meshStates;
    let bestHit: MeshPickHit | null = null;

    for (let i = 0, len = meshStates.length; i < len; i++) {
      const meshState = meshStates[i];
      if (!this._meshManager.isMeshPickableInView(meshState, params.view, params.pickInvisible)) {
        continue;
      }
      const meshHit = this._pickMeshTriangles(meshState, params.view, params.pickCanvasPos);
      if (!meshHit) {
        continue;
      }
      if (!bestHit || meshHit.depth < bestHit.depth) {
        bestHit = meshHit;
      }
    }

    return bestHit;
  }

  private _pickMeshTriangles(meshState: RendererMesh, view: View, pickCanvasPos: Vec2): MeshPickHit | null {
    const positions = meshState.geometryState.positions;
    const indices = meshState.geometryState.indices;
    const matrix = this._getModelViewProjectionMatrix(meshState, view);
    let bestDepth = Number.POSITIVE_INFINITY;
    const bestIndices = new Int32Array(3);
    const bestLocalPos = createVec3Float64();
    const bestWorldPos = createVec3Float64();
    const bestViewPos = createVec3Float64();

    for (let i = 0, len = indices.length; i < len; i += 3) {
      const indexA = indices[i];
      const indexB = indices[i + 1];
      const indexC = indices[i + 2];
      const ia = indexA * 3;
      const ib = indexB * 3;
      const ic = indexC * 3;

      const aDepth = this._projectVertex(matrix, positions, ia, view, tempCanvasA);
      const bDepth = this._projectVertex(matrix, positions, ib, view, tempCanvasB);
      const cDepth = this._projectVertex(matrix, positions, ic, view, tempCanvasC);
      if (aDepth === null || bDepth === null || cDepth === null) {
        continue;
      }
      const barycentric = this._getBarycentricCanvasCoords(pickCanvasPos, tempCanvasA, tempCanvasB, tempCanvasC);
      if (!barycentric) {
        continue;
      }
      const depth = barycentric[0] * aDepth + barycentric[1] * bDepth + barycentric[2] * cDepth;
      if (depth < bestDepth) {
        bestIndices[0] = indexA;
        bestIndices[1] = indexB;
        bestIndices[2] = indexC;
        this._interpolateLocalPosition(positions, ia, ib, ic, barycentric, tempLocalPos);
        this._transformPickPosition(meshState, view, tempLocalPos, tempWorldPos, tempViewPos);
        if (isWorldPosClipped(view, tempWorldPos, this._meshManager.isMeshClippableInView(meshState, view))) {
          continue;
        }
        bestDepth = depth;
        bestLocalPos[0] = tempLocalPos[0];
        bestLocalPos[1] = tempLocalPos[1];
        bestLocalPos[2] = tempLocalPos[2];
        bestWorldPos[0] = tempWorldPos[0];
        bestWorldPos[1] = tempWorldPos[1];
        bestWorldPos[2] = tempWorldPos[2];
        bestViewPos[0] = tempViewPos[0];
        bestViewPos[1] = tempViewPos[1];
        bestViewPos[2] = tempViewPos[2];
      }
    }

    if (!Number.isFinite(bestDepth)) {
      return null;
    }

    return {
      sceneMesh: meshState.mesh,
      depth: bestDepth,
      indices: bestIndices,
      localPos: bestLocalPos,
      worldPos: bestWorldPos,
      viewPos: bestViewPos
    };
  }

  private _getModelViewProjectionMatrix(meshState: RendererMesh, view: View): Mat4 {
    const modelMatrix = this._meshManager.getMeshWorldMatrix(meshState);
    const viewMatrix = view.camera.viewMatrix as Mat4;
    const projMatrix = view.camera.projMatrix as Mat4;
    mulMat4(viewMatrix, modelMatrix, tempModelViewMatrix);
    mulMat4(projMatrix, tempModelViewMatrix, tempModelViewProjectionMatrix);
    return tempModelViewProjectionMatrix;
  }

  private _projectVertex(
    modelViewProjectionMatrix: Mat4,
    positions: Float32Array,
    positionOffset: number,
    view: View,
    canvasPos: Vec2
  ): number | null {
    tempVertex[0] = positions[positionOffset];
    tempVertex[1] = positions[positionOffset + 1];
    tempVertex[2] = positions[positionOffset + 2];
    tempVertex[3] = 1;
    transformVec4(modelViewProjectionMatrix, tempVertex, tempClip);
    const w = tempClip[3];
    if (w <= 0) {
      return null;
    }

    const boundary = view.boundary ?? [0, 0, view.htmlElement?.clientWidth ?? 1, view.htmlElement?.clientHeight ?? 1];
    const width = Math.max(1, boundary[2] || 1);
    const height = Math.max(1, boundary[3] || 1);
    const ndcX = tempClip[0] / w;
    const ndcY = tempClip[1] / w;
    canvasPos[0] = (ndcX * 0.5 + 0.5) * width;
    canvasPos[1] = (0.5 - ndcY * 0.5) * height;
    return tempClip[2] / w;
  }

  private _getBarycentricCanvasCoords(point: Vec2, a: Vec2, b: Vec2, c: Vec2): [number, number, number] | null {
    const v0x = c[0] - a[0];
    const v0y = c[1] - a[1];
    const v1x = b[0] - a[0];
    const v1y = b[1] - a[1];
    const v2x = point[0] - a[0];
    const v2y = point[1] - a[1];

    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < 1e-12) {
      return null;
    }

    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    if (u < 0 || v < 0 || u + v > 1) {
      return null;
    }
    return [1 - u - v, v, u];
  }

  private _interpolateLocalPosition(
    positions: Float32Array,
    ia: number,
    ib: number,
    ic: number,
    barycentric: [number, number, number],
    dest: Vec3
  ): Vec3 {
    const wa = barycentric[0];
    const wb = barycentric[1];
    const wc = barycentric[2];
    dest[0] = positions[ia] * wa + positions[ib] * wb + positions[ic] * wc;
    dest[1] = positions[ia + 1] * wa + positions[ib + 1] * wb + positions[ic + 1] * wc;
    dest[2] = positions[ia + 2] * wa + positions[ib + 2] * wb + positions[ic + 2] * wc;
    return dest;
  }

  private _transformPickPosition(meshState: RendererMesh, view: View, localPos: Vec3, worldPos: Vec3, viewPos: Vec3): void {
    tempVertex[0] = localPos[0];
    tempVertex[1] = localPos[1];
    tempVertex[2] = localPos[2];
    tempVertex[3] = 1;

    transformVec4(this._meshManager.getMeshWorldMatrix(meshState), tempVertex, tempWorldHomogeneous);
    const worldW = tempWorldHomogeneous[3] || 1;
    worldPos[0] = tempWorldHomogeneous[0] / worldW;
    worldPos[1] = tempWorldHomogeneous[1] / worldW;
    worldPos[2] = tempWorldHomogeneous[2] / worldW;

    transformVec4(view.camera.viewMatrix as Mat4, tempWorldHomogeneous, tempViewHomogeneous);
    const viewW = tempViewHomogeneous[3] || 1;
    viewPos[0] = tempViewHomogeneous[0] / viewW;
    viewPos[1] = tempViewHomogeneous[1] / viewW;
    viewPos[2] = tempViewHomogeneous[2] / viewW;
  }

  private _getPickCanvasPos(view: View, pickParams: PickParams): Vec2 | null {
    if (pickParams.canvasPos) {
      return pickParams.canvasPos;
    }
    if (!pickParams.rayPick) {
      return null;
    }

    const boundary = view.boundary ?? [0, 0, view.htmlElement?.clientWidth ?? 1, view.htmlElement?.clientHeight ?? 1];
    tempPickCanvas[0] = Math.max(1, boundary[2] || 1) * 0.5;
    tempPickCanvas[1] = Math.max(1, boundary[3] || 1) * 0.5;
    return tempPickCanvas;
  }

  private _wantsSnap(pickParams: PickParams): boolean {
    return !!pickParams.canvasPos &&
      (pickParams.snapToVertex === true || pickParams.snapToEdge === true);
  }
}
