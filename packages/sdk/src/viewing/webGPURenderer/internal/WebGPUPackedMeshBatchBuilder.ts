import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {View} from "../../viewer";
import type {WebGPUBufferLike} from "../core";
import {GPU_BUFFER_USAGE} from "./constants";
import type {WebGPUDrawItem, WebGPUPackedMeshBatch} from "./types";
import {WebGPUInstanceBufferManager, type WebGPUInstanceBufferFrame} from "./WebGPUInstanceBufferManager";
import {WebGPUMeshManager} from "./WebGPUMeshManager";
import {WebGPURenderContext} from "./WebGPURenderContext";

/**
 * Builds one packed indexed draw payload for a classified render bin.
 *
 * @internal
 */
export class WebGPUPackedMeshBatchBuilder {

  private readonly _renderContext: WebGPURenderContext;

  constructor(renderContext: WebGPURenderContext) {
    this._renderContext = renderContext;
  }

  public build(params: {
    drawItems: WebGPUDrawItem[];
    label: string;
    view: View;
    meshManager: WebGPUMeshManager;
    instanceBufferManager: WebGPUInstanceBufferManager;
    instanceFrame: WebGPUInstanceBufferFrame;
  }): SDKResult<WebGPUPackedMeshBatch | null> {
    const {drawItems} = params;
    const meshCount = drawItems.length;
    if (meshCount === 0) {
      return {
        ok: true,
        value: null
      };
    }

    let totalVertices = 0;
    let totalIndices = 0;
    for (let i = 0; i < meshCount; i++) {
      const geometryState = drawItems[i].meshState.geometryState;
      totalVertices += geometryState.positions.length / 3;
      totalIndices += geometryState.indices.length;
    }

    if (totalVertices > 0xFFFFFFFF) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[WebGPUPackedMeshBatchBuilder.build] Packed batch '${params.label}' exceeds the uint32 index range.`
      };
    }

    let vertexBuffer: WebGPUBufferLike | null = null;
    let normalBuffer: WebGPUBufferLike | null = null;
    let meshIndexBuffer: WebGPUBufferLike | null = null;
    let indexBuffer: WebGPUBufferLike | null = null;

    try {
      const firstInstance = params.instanceBufferManager.appendDrawItems({
        frame: params.instanceFrame,
        drawItems,
        start: 0,
        count: meshCount,
        view: params.view,
        meshManager: params.meshManager
      });
      const positions = new Float32Array(totalVertices * 3);
      const normals = new Float32Array(totalVertices * 3);
      const meshIndices = new Uint32Array(totalVertices);
      const indexFormat = totalVertices > 65535 ? "uint32" : "uint16";
      const indices = indexFormat === "uint32"
        ? new Uint32Array(totalIndices)
        : new Uint16Array(totalIndices);

      let vertexOffset = 0;
      let indexOffset = 0;
      for (let meshIndex = 0; meshIndex < meshCount; meshIndex++) {
        const geometryState = drawItems[meshIndex].meshState.geometryState;
        const vertexCount = geometryState.positions.length / 3;
        const meshInstanceIndex = firstInstance + meshIndex;

        positions.set(geometryState.positions, vertexOffset * 3);
        normals.set(geometryState.normals, vertexOffset * 3);
        meshIndices.fill(meshInstanceIndex, vertexOffset, vertexOffset + vertexCount);
        for (let i = 0, len = geometryState.indices.length; i < len; i++) {
          indices[indexOffset + i] = geometryState.indices[i] + vertexOffset;
        }

        vertexOffset += vertexCount;
        indexOffset += geometryState.indices.length;
      }

      vertexBuffer = this._renderContext.createGPUBuffer(
        `xeokit-webgpu-packed-positions:${params.label}`,
        positions,
        GPU_BUFFER_USAGE.VERTEX
      );
      normalBuffer = this._renderContext.createGPUBuffer(
        `xeokit-webgpu-packed-normals:${params.label}`,
        normals,
        GPU_BUFFER_USAGE.VERTEX
      );
      meshIndexBuffer = this._renderContext.createGPUBuffer(
        `xeokit-webgpu-packed-mesh-indices:${params.label}`,
        meshIndices,
        GPU_BUFFER_USAGE.VERTEX
      );
      indexBuffer = this._renderContext.createGPUBuffer(
        `xeokit-webgpu-packed-indices:${params.label}`,
        indices,
        GPU_BUFFER_USAGE.INDEX
      );

      return {
        ok: true,
        value: {
          vertexBuffer,
          normalBuffer,
          meshIndexBuffer,
          indexBuffer,
          indexFormat,
          indexCount: indices.length,
          destroy: () => {
            vertexBuffer.destroy?.();
            normalBuffer.destroy?.();
            meshIndexBuffer.destroy?.();
            indexBuffer.destroy?.();
          }
        }
      };
    } catch (e) {
      vertexBuffer?.destroy?.();
      normalBuffer?.destroy?.();
      meshIndexBuffer?.destroy?.();
      indexBuffer?.destroy?.();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUPackedMeshBatchBuilder.build] Failed to build packed mesh batch '${params.label}': ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }
}
