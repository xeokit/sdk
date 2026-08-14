import {SDKErrorType, type SDKResult} from "../../../../base/core";
import {decompressPositions3WithAABB3} from "../../../../base/math/compression";
import type {SceneGeometry} from "../../../../model/scene";
import type {RendererGeometry} from "./RendererGeometry";

/**
 * Owns CPU-side geometry decode state for WebGPU packed triangle batching.
 *
 * @internal
 */
export class GeometryBufferManager {

  private _geometryStates: {[geometryUniqueId: string]: RendererGeometry} = {};

  constructor() {
  }

  public getOrCreateGeometryState(sceneGeometry: SceneGeometry): SDKResult<RendererGeometry> {
    const existing = this._geometryStates[sceneGeometry.uniqueId];
    if (existing) {
      return {
        ok: true,
        value: existing
      };
    }

    if (!sceneGeometry.aabb || !sceneGeometry.positionsCompressed || !sceneGeometry.indices) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[GeometryBufferManager.getOrCreateGeometryState] SceneGeometry '${sceneGeometry.uniqueId}' is missing positions, indices, or AABB.`
      };
    }

    const positions = decompressPositions3WithAABB3(
      sceneGeometry.positionsCompressed,
      sceneGeometry.aabb,
      new Float32Array(sceneGeometry.positionsCompressed.length)
    ) as Float32Array;
    const indexData = this._createIndexData(sceneGeometry.indices);
    const edgeIndexData = sceneGeometry.edgeIndices && sceneGeometry.edgeIndices.length > 0
      ? this._createIndexData(sceneGeometry.edgeIndices)
      : null;
    const geometryState: RendererGeometry = {
      geometry: sceneGeometry,
      positions,
      indices: indexData.data,
      edgeIndices: edgeIndexData?.data ?? null,
      indexFormat: indexData.indexFormat,
      indexCount: indexData.data.length,
      edgeIndexCount: edgeIndexData?.data.length ?? 0,
      numMeshes: 0
    };
    this._geometryStates[sceneGeometry.uniqueId] = geometryState;

    return {
      ok: true,
      value: geometryState
    };
  }

  public destroyGeometryState(sceneGeometry: SceneGeometry): void {
    const geometryState = this._geometryStates[sceneGeometry.uniqueId];
    if (!geometryState) {
      return;
    }
    delete this._geometryStates[sceneGeometry.uniqueId];
  }

  public destroyAll(): void {
    for (const geometryUniqueId of Object.keys(this._geometryStates)) {
      this.destroyGeometryState(this._geometryStates[geometryUniqueId].geometry);
    }
    this._geometryStates = {};
  }

  private _createIndexData(indices: ArrayLike<number>): {
    data: Uint16Array | Uint32Array;
    indexFormat: "uint16" | "uint32";
  } {
    let maxIndex = 0;
    for (let i = 0, len = indices.length; i < len; i++) {
      if (indices[i] > maxIndex) {
        maxIndex = indices[i];
      }
    }
    if (maxIndex > 65535) {
      return {
        data: indices instanceof Uint32Array ? indices : new Uint32Array(indices),
        indexFormat: "uint32"
      };
    }
    return {
      data: indices instanceof Uint16Array ? indices : new Uint16Array(indices),
      indexFormat: "uint16"
    };
  }

}
