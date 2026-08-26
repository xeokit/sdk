import {GaussianSplatsPrimitive} from "../../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {FloatArrayParam} from "../../../../../base/math";
import type {View} from "../../../../viewer";
import type {WebGPUBindGroupLike, WebGPUBufferLike} from "../../core";
import {GPU_BUFFER_USAGE} from "../constants";
import type {InstancedDrawBatch, PackedMeshBatch} from "../drawOps";
import type {MeshManager, RendererMesh} from "../meshManager";
import {RenderContext} from "../RenderContext";
import {packSplats, SPLAT_FLOATS_PER_ITEM, type SplatAttributes} from "../../../../../formats/gaussiansplat/utils/packSplats";
import {sortSplatsByDepth} from "../../../webGL/internal/gpuMemoryManager/sortSplats";
import {BindGroupLayoutManager} from "./BindGroupLayoutManager";

export interface SplatBatchSet {
  batches: InstancedDrawBatch[];
  meshStateByGlobalSlot: Map<number, RendererMesh>;
  slotCount: number;
  splatCount: number;
}

/**
 * Packs SceneModel gaussian splats into WebGPU storage buffers and keeps their
 * sorted item-index buffer current for alpha blending and ID picking.
 *
 * @internal
 */
export class SplatBatchManager {

  private readonly _renderContext: RenderContext;
  private readonly _bindGroupLayoutManager: BindGroupLayoutManager;
  private readonly _meshStateByGlobalSlot = new Map<number, RendererMesh>();
  private _packedData: Float32Array = new Float32Array(0);
  private _centres: Float32Array = new Float32Array(0);
  private _itemIndices: Uint32Array = new Uint32Array(0);
  private _sortedIndices: Uint32Array = new Uint32Array(0);
  private _dataBuffer: WebGPUBufferLike | null = null;
  private _indexBuffer: WebGPUBufferLike | null = null;
  private _bindGroup: WebGPUBindGroupLike | null = null;
  private _batch: InstancedDrawBatch | null = null;
  private _structureKey = "";
  private _cameraKey = "";
  private _slotCount = 0;
  private _splatCount = 0;

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
  }

  public prepare(params: {
    meshManager: MeshManager;
    view: View;
    baseGlobalSlot: number;
  }): SDKResult<SplatBatchSet> {
    const splatMeshes = this._collectVisibleSplatMeshes(params.meshManager, params.view);
    const structureKey = this._createStructureKey(splatMeshes, params.baseGlobalSlot);
    if (structureKey !== this._structureKey) {
      const rebuildResult = this._rebuildBuffers(params.meshManager, splatMeshes, params.baseGlobalSlot);
      if (rebuildResult.ok === false) {
        return rebuildResult;
      }
      this._structureKey = structureKey;
      this._cameraKey = "";
    }

    if (this._splatCount === 0 || !this._batch) {
      return {
        ok: true,
        value: {
          batches: [],
          meshStateByGlobalSlot: this._meshStateByGlobalSlot,
          slotCount: 0,
          splatCount: 0
        }
      };
    }

    const cameraKey = this._createCameraKey(params.view);
    if (cameraKey !== this._cameraKey) {
      this._sortedIndices = sortSplatsByDepth(this._centres, this._itemIndices, params.view.camera.viewMatrix as unknown as Float32Array);
      this._renderContext.device.queue.writeBuffer(this._indexBuffer!, 0, this._sortedIndices);
      this._cameraKey = cameraKey;
    }

    return {
      ok: true,
      value: {
        batches: [this._batch],
        meshStateByGlobalSlot: this._meshStateByGlobalSlot,
        slotCount: this._slotCount,
        splatCount: this._splatCount
      }
    };
  }

  public destroy(): void {
    try {
      this._dataBuffer?.destroy?.();
      this._indexBuffer?.destroy?.();
    } catch {
      // Ignore backend destruction failures during renderer teardown.
    }
    this._dataBuffer = null;
    this._indexBuffer = null;
    this._bindGroup = null;
    this._batch = null;
    this._packedData = new Float32Array(0);
    this._centres = new Float32Array(0);
    this._itemIndices = new Uint32Array(0);
    this._sortedIndices = new Uint32Array(0);
    this._meshStateByGlobalSlot.clear();
    this._structureKey = "";
    this._cameraKey = "";
    this._slotCount = 0;
    this._splatCount = 0;
  }

  private _collectVisibleSplatMeshes(meshManager: MeshManager, view: View): RendererMesh[] {
    const meshes: RendererMesh[] = [];
    for (let i = 0, len = meshManager.meshStates.length; i < len; i++) {
      const meshState = meshManager.meshStates[i];
      if (meshState.geometryState.geometry.primitive !== GaussianSplatsPrimitive) {
        continue;
      }
      if (!meshManager.isMeshVisibleInView(meshState, view) || meshManager.getMeshOpacityInView(meshState, view) <= 0) {
        continue;
      }
      meshes.push(meshState);
    }
    return meshes;
  }

  private _rebuildBuffers(meshManager: MeshManager, meshes: RendererMesh[], baseGlobalSlot: number): SDKResult<void> {
    this._meshStateByGlobalSlot.clear();
    const packedParts: Float32Array[] = [];
    let splatCount = 0;
    for (let i = 0, len = meshes.length; i < len; i++) {
      const meshState = meshes[i];
      const attrs = this._getSplatAttributes(meshState);
      if (!attrs) {
        continue;
      }
      const globalSlot = baseGlobalSlot + this._meshStateByGlobalSlot.size;
      this._meshStateByGlobalSlot.set(globalSlot, meshState);
      const packed = packSplats(attrs, meshManager.getMeshWorldMatrix(meshState) as unknown as FloatArrayParam, globalSlot);
      packedParts.push(packed);
      splatCount += packed.length / SPLAT_FLOATS_PER_ITEM;
    }

    if (splatCount === 0) {
      this.destroy();
      return {ok: true, value: undefined};
    }

    this._packedData = new Float32Array(splatCount * SPLAT_FLOATS_PER_ITEM);
    this._centres = new Float32Array(splatCount * 3);
    this._itemIndices = new Uint32Array(splatCount);
    let dataOffset = 0;
    let centreOffset = 0;
    let itemIndex = 0;
    for (let partIndex = 0, partLen = packedParts.length; partIndex < partLen; partIndex++) {
      const part = packedParts[partIndex];
      this._packedData.set(part, dataOffset);
      const partSplatCount = part.length / SPLAT_FLOATS_PER_ITEM;
      for (let i = 0; i < partSplatCount; i++) {
        const sourceOffset = i * SPLAT_FLOATS_PER_ITEM;
        this._centres[centreOffset++] = part[sourceOffset + 0];
        this._centres[centreOffset++] = part[sourceOffset + 1];
        this._centres[centreOffset++] = part[sourceOffset + 2];
        this._itemIndices[itemIndex] = itemIndex;
        itemIndex++;
      }
      dataOffset += part.length;
    }
    this._sortedIndices = this._itemIndices.slice();
    this._slotCount = this._meshStateByGlobalSlot.size;
    this._splatCount = splatCount;

    try {
      this._dataBuffer?.destroy?.();
      this._indexBuffer?.destroy?.();
      this._dataBuffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-splat-data",
        size: Math.max(4, this._packedData.byteLength),
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      });
      this._indexBuffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-splat-indices",
        size: Math.max(4, this._sortedIndices.byteLength),
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      });
      this._renderContext.device.queue.writeBuffer(this._dataBuffer, 0, this._packedData);
      this._renderContext.device.queue.writeBuffer(this._indexBuffer, 0, this._sortedIndices);
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SplatBatchManager._rebuildBuffers] Failed to create WebGPU splat buffers: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    const bindGroupLayoutResult = this._bindGroupLayoutManager.getSplatBindGroupLayout();
    if (bindGroupLayoutResult.ok === false) {
      return bindGroupLayoutResult;
    }
    try {
      this._bindGroup = this._renderContext.device.createBindGroup({
        label: "xeokit-webgpu-splat-bind-group",
        layout: bindGroupLayoutResult.value,
        entries: [{
          binding: 0,
          resource: {buffer: this._dataBuffer}
        }, {
          binding: 1,
          resource: {buffer: this._indexBuffer}
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SplatBatchManager._rebuildBuffers] Failed to create WebGPU splat bind group: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    const packedBatch = {
      primitive: GaussianSplatsPrimitive,
      label: "xeokit-webgpu-splat-batch",
      segmentKey: "splats",
      splatDataBuffer: this._dataBuffer,
      splatIndexBuffer: this._indexBuffer,
      splatBindGroup: this._bindGroup,
      splatCount: this._splatCount,
      destroy: () => undefined
    } as unknown as PackedMeshBatch;
    this._batch = {packedBatch};

    return {ok: true, value: undefined};
  }

  private _getSplatAttributes(meshState: RendererMesh): SplatAttributes | null {
    const geometry = meshState.geometryState.geometry as any;
    const positionsCompressed = geometry.positionsCompressed ?? geometry.positions;
    const aabb = geometry.aabb;
    const scales = geometry.scales;
    const rotations = geometry.rotations;
    if (!positionsCompressed || !aabb || !scales || !rotations) {
      return null;
    }
    return {
      positionsCompressed,
      aabb,
      scales,
      rotations,
      colorsCompressed: geometry.colorsCompressed ?? geometry.colors
    };
  }

  private _createStructureKey(meshes: RendererMesh[], baseGlobalSlot: number): string {
    let key = `${baseGlobalSlot}|${meshes.length}`;
    for (let i = 0, len = meshes.length; i < len; i++) {
      const meshState = meshes[i];
      key += `|${meshState.mesh.uniqueId}:${meshState.instanceDataVersion}`;
    }
    return key;
  }

  private _createCameraKey(view: View): string {
    const matrix = view.camera.viewMatrix as unknown as ArrayLike<number>;
    let key = "";
    for (let i = 0; i < 16; i++) {
      key += `${matrix[i]},`;
    }
    return key;
  }
}
