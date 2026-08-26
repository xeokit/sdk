import {type SDKResult} from "../../../../../base/core";
import {
  createMat4Float64,
  mulMat4,
  transformVec4,
  type Mat4
} from "../../../../../base/math/matrix";
import {
  createVec2Float64,
  createVec3Float64,
  createVec4Float64,
  type Vec2,
  type Vec3
} from "../../../../../base/math/vector";
import type {PickParams} from "../../../../viewer/PickParams";
import {PickResult} from "../../../../viewer/PickResult";
import type {View} from "../../../../viewer/View";
import type {SceneMesh} from "../../../../../model/scene";
import {MeshManager, type RendererMesh} from "../meshManager";
import type {RenderContext} from "../RenderContext";
import {WebGPUSnapBuffer, WebGPUSnapBufferCache} from "../webGPU";
import {isWorldPosClipped} from "../sectionPlanes";

const DEFAULT_SNAP_RADIUS = 10;
const SNAP_DEPTH_EPSILON = 1e-4;

const tempModelViewMatrix = createMat4Float64();
const tempModelViewProjectionMatrix = createMat4Float64();
const tempDepthModelViewMatrix = createMat4Float64();
const tempDepthModelViewProjectionMatrix = createMat4Float64();
const tempVertex = createVec4Float64();
const tempClip = createVec4Float64();
const tempCanvasA = createVec2Float64();
const tempCanvasB = createVec2Float64();
const tempCanvasC = createVec2Float64();
const tempWorldHomogeneous = createVec4Float64();
const tempLocalPos = createVec3Float64();
const tempWorldPos = createVec3Float64();
const tempSnappedCanvas = createVec2Float64();

interface SnapCandidate {
  sceneMesh: SceneMesh;
  snappedToVertex: boolean;
  snappedToEdge: boolean;
  distanceSq: number;
  depth: number;
  localPos: Vec3;
  worldPos: Vec3;
  canvasPos: Vec2;
}

interface GPUVertexSnapMeshHit {
  meshState: RendererMesh;
  globalSlot: number;
}

type GPUVertexSnapCallback = (
  snapBuffer: WebGPUSnapBuffer,
  canvasPos: ArrayLike<number>
) => Promise<SDKResult<GPUVertexSnapMeshHit | null>>;

/**
 * Owns WebGPU snap-picking support.
 *
 * This first WebGPU implementation uses decoded renderer-side triangle data so
 * it can preserve the renderer's synchronous pick contract. The class mirrors
 * WebGL's SnapManager boundary, including radius-keyed snap buffers, and can
 * switch its internals to a WebGPU snap render/readback pass without changing
 * callers.
 *
 * @internal
 */
export class SnapManager {

  private readonly _meshManager: MeshManager;
  private readonly _snapBufferCache: WebGPUSnapBufferCache;
  private readonly _snapResult = new PickResult();

  constructor(params: {
    renderContext: RenderContext;
    meshManager: MeshManager;
  }) {
    this._meshManager = params.meshManager;
    this._snapBufferCache = new WebGPUSnapBufferCache(params.renderContext);
  }

  public snapPick(view: View, pickParams: PickParams): SDKResult<PickResult | null> {
    if (!pickParams.canvasPos) {
      return {
        ok: true,
        value: null
      };
    }

    const wantVertex = pickParams.snapToVertex === true;
    const wantEdge = pickParams.snapToEdge === true;
    if (!wantVertex && !wantEdge) {
      return {
        ok: true,
        value: null
      };
    }

    const snapRadius = Math.max(1, pickParams.snapRadius ?? DEFAULT_SNAP_RADIUS);
    const snapBufferResult = this._snapBufferCache.get(snapRadius);
    if (snapBufferResult.ok === false) {
      return snapBufferResult;
    }
    const best = this._findSnapCandidate({
      view,
      canvasPos: pickParams.canvasPos,
      snapRadius,
      wantVertex,
      wantEdge,
      pickInvisible: !!pickParams.pickInvisible
    });
    if (!best) {
      return {
        ok: true,
        value: null
      };
    }

    const result = this._snapResult;
    result.reset();
    result.view = view;
    result.canvasPos = pickParams.canvasPos;
    result.sceneMesh = best.sceneMesh;
    result.sceneObject = best.sceneMesh.object ?? null;
    result.viewObject = best.sceneMesh.object ? view.objects?.[best.sceneMesh.object.id] ?? null : null;
    result.worldPos = best.worldPos;
    result.snappedCanvasPos = best.canvasPos;
    result.snappedToVertex = best.snappedToVertex;
    result.snappedToEdge = best.snappedToEdge;

    return {
      ok: true,
      value: result
    };
  }

  public async snapVertexGPUAsync(
    view: View,
    pickParams: PickParams,
    snapVertexGPUAsync: GPUVertexSnapCallback
  ): Promise<SDKResult<PickResult | null>> {
    if (!pickParams.canvasPos || pickParams.snapToVertex !== true || pickParams.snapToEdge === true || pickParams.pickInvisible) {
      return this.snapPick(view, pickParams);
    }

    const snapRadius = Math.max(1, pickParams.snapRadius ?? DEFAULT_SNAP_RADIUS);
    const snapBufferResult = this._snapBufferCache.get(snapRadius);
    if (snapBufferResult.ok === false) {
      return snapBufferResult;
    }

    const gpuHitResult = await snapVertexGPUAsync(snapBufferResult.value, pickParams.canvasPos);
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

    const best = this._findMeshSnapCandidate(gpuHit.meshState, {
      view,
      canvasPos: pickParams.canvasPos,
      wantVertex: true,
      wantEdge: false,
      pickInvisible: false
    });
    if (!best || best.distanceSq > snapRadius * snapRadius) {
      return {
        ok: true,
        value: null
      };
    }

    const result = new PickResult();
    result.view = view;
    result.canvasPos = pickParams.canvasPos;
    result.sceneMesh = best.sceneMesh;
    result.sceneObject = best.sceneMesh.object ?? null;
    result.viewObject = best.sceneMesh.object ? view.objects?.[best.sceneMesh.object.id] ?? null : null;
    result.worldPos = best.worldPos;
    result.snappedCanvasPos = best.canvasPos;
    result.snappedToVertex = true;
    result.snappedToEdge = false;

    return {
      ok: true,
      value: result
    };
  }

  public async snapEdgeGPUAsync(
    view: View,
    pickParams: PickParams,
    snapEdgeGPUAsync: GPUVertexSnapCallback
  ): Promise<SDKResult<PickResult | null>> {
    if (!pickParams.canvasPos || pickParams.snapToEdge !== true || pickParams.pickInvisible) {
      return this.snapPick(view, pickParams);
    }

    const snapRadius = Math.max(1, pickParams.snapRadius ?? DEFAULT_SNAP_RADIUS);
    const snapBufferResult = this._snapBufferCache.get(snapRadius);
    if (snapBufferResult.ok === false) {
      return snapBufferResult;
    }

    const gpuHitResult = await snapEdgeGPUAsync(snapBufferResult.value, pickParams.canvasPos);
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

    const best = this._findMeshSnapCandidate(gpuHit.meshState, {
      view,
      canvasPos: pickParams.canvasPos,
      wantVertex: pickParams.snapToVertex === true,
      wantEdge: true,
      pickInvisible: false
    });
    if (!best || best.distanceSq > snapRadius * snapRadius) {
      return {
        ok: true,
        value: null
      };
    }

    const result = new PickResult();
    result.view = view;
    result.canvasPos = pickParams.canvasPos;
    result.sceneMesh = best.sceneMesh;
    result.sceneObject = best.sceneMesh.object ?? null;
    result.viewObject = best.sceneMesh.object ? view.objects?.[best.sceneMesh.object.id] ?? null : null;
    result.worldPos = best.worldPos;
    result.snappedCanvasPos = best.canvasPos;
    result.snappedToVertex = best.snappedToVertex;
    result.snappedToEdge = best.snappedToEdge;

    return {
      ok: true,
      value: result
    };
  }

  public destroy(): void {
    this._snapBufferCache.destroy();
  }

  private _findSnapCandidate(params: {
    view: View;
    canvasPos: Vec2;
    snapRadius: number;
    wantVertex: boolean;
    wantEdge: boolean;
    pickInvisible: boolean;
  }): SnapCandidate | null {
    const meshStates = this._meshManager.meshStates;
    let best: SnapCandidate | null = null;
    const maxDistanceSq = params.snapRadius * params.snapRadius;

    for (let i = 0, len = meshStates.length; i < len; i++) {
      const meshState = meshStates[i];
      if (!this._meshManager.isMeshPickableInView(meshState, params.view, params.pickInvisible)) {
        continue;
      }
      const candidate = this._findMeshSnapCandidate(meshState, params);
      if (!candidate || candidate.distanceSq > maxDistanceSq) {
        continue;
      }
      if (
        !best ||
        candidate.distanceSq < best.distanceSq ||
        (candidate.distanceSq === best.distanceSq && candidate.snappedToVertex && !best.snappedToVertex) ||
        (candidate.distanceSq === best.distanceSq && candidate.depth < best.depth)
      ) {
        best = candidate;
      }
    }

    return best;
  }

  private _findMeshSnapCandidate(
    meshState: RendererMesh,
    params: {
      view: View;
      canvasPos: Vec2;
      wantVertex: boolean;
      wantEdge: boolean;
      pickInvisible: boolean;
    }
  ): SnapCandidate | null {
    const positions = meshState.geometryState.positions;
    const indices = meshState.geometryState.indices;
    const edgeIndices = meshState.geometryState.edgeIndices;
    const matrix = this._getModelViewProjectionMatrix(
      meshState,
      params.view,
      tempModelViewMatrix,
      tempModelViewProjectionMatrix
    );
    let best: SnapCandidate | null = null;

    if (params.wantVertex) {
      const visitedVertices = new Set<number>();
      for (let i = 0, len = indices.length; i < len; i++) {
        const vertexIndex = indices[i];
        if (visitedVertices.has(vertexIndex)) {
          continue;
        }
        visitedVertices.add(vertexIndex);
        const offset = vertexIndex * 3;
        const depth = this._projectVertex(matrix, positions, offset, params.view, tempCanvasA);
        if (depth === null) {
          continue;
        }
        const candidate = this._makeVertexCandidate(meshState, params.view, positions, offset, tempCanvasA, depth, params.canvasPos);
        best = this._chooseVisibleSnapCandidate(best, candidate, params);
      }
    }

    if (params.wantEdge && edgeIndices) {
      for (let i = 0, len = edgeIndices.length; i + 1 < len; i += 2) {
        const offsetA = edgeIndices[i] * 3;
        const offsetB = edgeIndices[i + 1] * 3;
        const depthA = this._projectVertex(matrix, positions, offsetA, params.view, tempCanvasA);
        const depthB = this._projectVertex(matrix, positions, offsetB, params.view, tempCanvasB);
        if (depthA === null || depthB === null) {
          continue;
        }
        best = this._chooseVisibleSnapCandidate(best, this._makeEdgeCandidate(meshState, params.view, positions, offsetA, offsetB, tempCanvasA, tempCanvasB, depthA, depthB, params.canvasPos), params);
      }
    }

    return best;
  }

  private _makeVertexCandidate(
    meshState: RendererMesh,
    view: View,
    positions: Float32Array,
    offset: number,
    canvasPos: Vec2,
    depth: number,
    pickCanvasPos: Vec2
  ): SnapCandidate {
    tempLocalPos[0] = positions[offset];
    tempLocalPos[1] = positions[offset + 1];
    tempLocalPos[2] = positions[offset + 2];
    const worldPos = this._getWorldPosition(meshState, tempLocalPos);
    return {
      sceneMesh: meshState.mesh,
      snappedToVertex: true,
      snappedToEdge: false,
      distanceSq: this._distanceSq(pickCanvasPos, canvasPos),
      depth,
      localPos: createVec3Float64(tempLocalPos),
      worldPos: createVec3Float64(worldPos),
      canvasPos: createVec2Float64(canvasPos)
    };
  }

  private _makeEdgeCandidate(
    meshState: RendererMesh,
    view: View,
    positions: Float32Array,
    offsetA: number,
    offsetB: number,
    canvasA: Vec2,
    canvasB: Vec2,
    depthA: number,
    depthB: number,
    pickCanvasPos: Vec2
  ): SnapCandidate {
    const t = this._closestSegmentT(pickCanvasPos, canvasA, canvasB);
    tempSnappedCanvas[0] = canvasA[0] + (canvasB[0] - canvasA[0]) * t;
    tempSnappedCanvas[1] = canvasA[1] + (canvasB[1] - canvasA[1]) * t;
    tempLocalPos[0] = positions[offsetA] + (positions[offsetB] - positions[offsetA]) * t;
    tempLocalPos[1] = positions[offsetA + 1] + (positions[offsetB + 1] - positions[offsetA + 1]) * t;
    tempLocalPos[2] = positions[offsetA + 2] + (positions[offsetB + 2] - positions[offsetA + 2]) * t;
    const worldPos = this._getWorldPosition(meshState, tempLocalPos);
    return {
      sceneMesh: meshState.mesh,
      snappedToVertex: false,
      snappedToEdge: true,
      distanceSq: this._distanceSq(pickCanvasPos, tempSnappedCanvas),
      depth: depthA + (depthB - depthA) * t,
      localPos: createVec3Float64(tempLocalPos),
      worldPos: createVec3Float64(worldPos),
      canvasPos: createVec2Float64(tempSnappedCanvas)
    };
  }

  private _chooseSnapCandidate(best: SnapCandidate | null, candidate: SnapCandidate): SnapCandidate {
    if (!best) {
      return candidate;
    }
    if (candidate.distanceSq < best.distanceSq) {
      return candidate;
    }
    if (candidate.distanceSq === best.distanceSq && candidate.snappedToVertex && !best.snappedToVertex) {
      return candidate;
    }
    if (candidate.distanceSq === best.distanceSq && candidate.depth < best.depth) {
      return candidate;
    }
    return best;
  }

  private _chooseVisibleSnapCandidate(
    best: SnapCandidate | null,
    candidate: SnapCandidate,
    params: {
      view: View;
      pickInvisible: boolean;
    }
  ): SnapCandidate | null {
    if (isWorldPosClipped(params.view, candidate.worldPos, this._isCandidateClippable(candidate, params.view))) {
      return best;
    }
    if (!this._isCandidateVisible(candidate, params)) {
      return best;
    }
    return this._chooseSnapCandidate(best, candidate);
  }

  private _isCandidateClippable(candidate: SnapCandidate, view: View): boolean {
    const sceneObject = candidate.sceneMesh.object;
    if (!sceneObject) {
      return true;
    }
    return view.objects?.[sceneObject.id]?.clippable !== false;
  }

  private _isCandidateVisible(
    candidate: SnapCandidate,
    params: {
      view: View;
      pickInvisible: boolean;
    }
  ): boolean {
    const nearestDepth = this._findNearestDepthAtCanvas(candidate.canvasPos, params);
    return nearestDepth === null || candidate.depth <= nearestDepth + SNAP_DEPTH_EPSILON;
  }

  private _findNearestDepthAtCanvas(
    canvasPos: Vec2,
    params: {
      view: View;
      pickInvisible: boolean;
    }
  ): number | null {
    const meshStates = this._meshManager.meshStates;
    let nearestDepth = Number.POSITIVE_INFINITY;

    for (let meshIndex = 0, meshLen = meshStates.length; meshIndex < meshLen; meshIndex++) {
      const meshState = meshStates[meshIndex];
      if (!this._meshManager.isMeshPickableInView(meshState, params.view, params.pickInvisible)) {
        continue;
      }
      const matrix = this._getModelViewProjectionMatrix(
        meshState,
        params.view,
        tempDepthModelViewMatrix,
        tempDepthModelViewProjectionMatrix
      );
      const positions = meshState.geometryState.positions;
      const indices = meshState.geometryState.indices;

      for (let i = 0, len = indices.length; i < len; i += 3) {
        const offsetA = indices[i] * 3;
        const offsetB = indices[i + 1] * 3;
        const offsetC = indices[i + 2] * 3;
        const depthA = this._projectVertex(matrix, positions, offsetA, params.view, tempCanvasA);
        const depthB = this._projectVertex(matrix, positions, offsetB, params.view, tempCanvasB);
        const depthC = this._projectVertex(matrix, positions, offsetC, params.view, tempCanvasC);
        if (depthA === null || depthB === null || depthC === null) {
          continue;
        }
        const barycentric = this._getBarycentricCanvasCoords(canvasPos, tempCanvasA, tempCanvasB, tempCanvasC);
        if (!barycentric) {
          continue;
        }
        const depth = barycentric[0] * depthA + barycentric[1] * depthB + barycentric[2] * depthC;
        tempLocalPos[0] = positions[offsetA] * barycentric[0] + positions[offsetB] * barycentric[1] + positions[offsetC] * barycentric[2];
        tempLocalPos[1] = positions[offsetA + 1] * barycentric[0] + positions[offsetB + 1] * barycentric[1] + positions[offsetC + 1] * barycentric[2];
        tempLocalPos[2] = positions[offsetA + 2] * barycentric[0] + positions[offsetB + 2] * barycentric[1] + positions[offsetC + 2] * barycentric[2];
        if (isWorldPosClipped(params.view, this._getWorldPosition(meshState, tempLocalPos), this._meshManager.isMeshClippableInView(meshState, params.view))) {
          continue;
        }
        if (depth < nearestDepth) {
          nearestDepth = depth;
        }
      }
    }

    return Number.isFinite(nearestDepth) ? nearestDepth : null;
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
    const tolerance = 1e-6;
    if (u < -tolerance || v < -tolerance || u + v > 1 + tolerance) {
      return null;
    }
    return [1 - u - v, v, u];
  }

  private _getModelViewProjectionMatrix(
    meshState: RendererMesh,
    view: View,
    modelViewMatrix: Mat4,
    modelViewProjectionMatrix: Mat4
  ): Mat4 {
    const modelMatrix = this._meshManager.getMeshWorldMatrix(meshState);
    const viewMatrix = view.camera.viewMatrix as Mat4;
    const projMatrix = view.camera.projMatrix as Mat4;
    mulMat4(viewMatrix, modelMatrix, modelViewMatrix);
    mulMat4(projMatrix, modelViewMatrix, modelViewProjectionMatrix);
    return modelViewProjectionMatrix;
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

  private _getWorldPosition(meshState: RendererMesh, localPos: Vec3): Vec3 {
    tempVertex[0] = localPos[0];
    tempVertex[1] = localPos[1];
    tempVertex[2] = localPos[2];
    tempVertex[3] = 1;
    transformVec4(this._meshManager.getMeshWorldMatrix(meshState), tempVertex, tempWorldHomogeneous);
    const w = tempWorldHomogeneous[3] || 1;
    tempWorldPos[0] = tempWorldHomogeneous[0] / w;
    tempWorldPos[1] = tempWorldHomogeneous[1] / w;
    tempWorldPos[2] = tempWorldHomogeneous[2] / w;
    return tempWorldPos;
  }

  private _closestSegmentT(point: Vec2, a: Vec2, b: Vec2): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 1e-12) {
      return 0;
    }
    const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lenSq;
    return Math.max(0, Math.min(1, t));
  }

  private _distanceSq(a: Vec2, b: Vec2): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return dx * dx + dy * dy;
  }
}
