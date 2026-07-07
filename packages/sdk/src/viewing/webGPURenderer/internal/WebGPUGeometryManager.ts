import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {IntArrayParam} from "../../../base/math";
import {decompressPositions3WithAABB3, octDecodeNormalsU16} from "../../../base/math/compression";
import type {SceneGeometry} from "../../../model/scene";
import {generateSmoothNormals} from "../../../model/scene/generateSmoothNormals";
import {GPU_BUFFER_USAGE} from "./constants";
import type {WebGPUGeometryState} from "./types";
import {WebGPURenderContext} from "./WebGPURenderContext";

/**
 * Owns GPU geometry buffers and geometry lifetime.
 *
 * @internal
 */
export class WebGPUGeometryManager {

  private readonly _renderContext: WebGPURenderContext;
  private _geometryStates: {[geometryUniqueId: string]: WebGPUGeometryState} = {};

  constructor(renderContext: WebGPURenderContext) {
    this._renderContext = renderContext;
  }

  public getOrCreateGeometryState(sceneGeometry: SceneGeometry): SDKResult<WebGPUGeometryState> {
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
        error: `[WebGPUGeometryManager.getOrCreateGeometryState] SceneGeometry '${sceneGeometry.uniqueId}' is missing positions, indices, or AABB.`
      };
    }

    const positions = decompressPositions3WithAABB3(
      sceneGeometry.positionsCompressed,
      sceneGeometry.aabb,
      new Float32Array(sceneGeometry.positionsCompressed.length)
    ) as Float32Array;
    const indexData = this._createIndexData(sceneGeometry.indices);
    const normals = this._createNormalData(sceneGeometry, positions, sceneGeometry.indices);
    const vertexBuffer = this._renderContext.createGPUBuffer(
      `xeokit-webgpu-positions:${sceneGeometry.uniqueId}`,
      positions,
      GPU_BUFFER_USAGE.VERTEX
    );
    const normalBuffer = this._renderContext.createGPUBuffer(
      `xeokit-webgpu-normals:${sceneGeometry.uniqueId}`,
      normals,
      GPU_BUFFER_USAGE.VERTEX
    );
    const indexBuffer = this._renderContext.createGPUBuffer(
      `xeokit-webgpu-indices:${sceneGeometry.uniqueId}`,
      indexData.data,
      GPU_BUFFER_USAGE.INDEX
    );
    const geometryState: WebGPUGeometryState = {
      geometry: sceneGeometry,
      vertexBuffer,
      normalBuffer,
      indexBuffer,
      indexFormat: indexData.indexFormat,
      indexCount: indexData.data.length,
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
    try {
      geometryState.vertexBuffer.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    try {
      geometryState.normalBuffer.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    try {
      geometryState.indexBuffer.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
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

  private _createNormalData(
    sceneGeometry: SceneGeometry,
    positions: Float32Array,
    indices: IntArrayParam
  ): Float32Array {
    const expectedCompressedLength = (positions.length / 3) * 2;
    if (sceneGeometry.normalsCompressed && sceneGeometry.normalsCompressed.length === expectedCompressedLength) {
      return octDecodeNormalsU16(
        sceneGeometry.normalsCompressed,
        new Float32Array(positions.length)
      ) as Float32Array;
    }

    const generatedNormals = generateSmoothNormals(positions, indices);
    if (generatedNormals) {
      return octDecodeNormalsU16(
        generatedNormals,
        new Float32Array(positions.length)
      ) as Float32Array;
    }

    const normals = new Float32Array(positions.length);
    for (let i = 0, len = normals.length; i < len; i += 3) {
      normals[i + 1] = 1;
    }
    return normals;
  }
}
