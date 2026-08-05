import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {Mat4} from "../../../../../base/math/matrix";
import type {Vec3} from "../../../../../base/math/vector";
import type {SceneMesh} from "../../../../../model/scene";
import {RENDER_PASSES, type RenderPassValue} from "../../RENDER_PASSES";
import type {PrimRange} from "../geometry/PrimRange";
import {TriangleGeometryVBOBuffers} from "./triangleGeometry/TriangleGeometryVBOBuffers";
import {TriangleGeometryVBODrawList} from "./triangleGeometry/TriangleGeometryVBODrawList";
import {
  clampTriangleGeometryVBOByte,
  copyTriangleGeometryVBOMatrix,
  createTriangleGeometryVBOViewState,
  getTriangleGeometryEdgeIndexCount,
  getTriangleGeometryEdgeSlotCapacity,
  getTriangleGeometryPrimitiveCount,
  TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX,
  TRIANGLE_GEOMETRY_VBO_PASS_ORDER,
  type TriangleGeometryVBOMeshRecord,
  type TriangleGeometryVBOViewState
} from "./triangleGeometry/TriangleGeometryVBOState";
import {TriangleGeometryVBOSpanAllocator} from "./triangleGeometry/TriangleGeometryVBOSpanAllocator";
import {
  deleteTriangleGeometryVBOVAOs,
  getTriangleGeometryVBOVAO,
  type TriangleGeometryVBOTopology,
  type TriangleGeometryVBOVAOLayout
} from "./triangleGeometry/TriangleGeometryVBOVAOCache";
import type {MeshManagerStepStats} from "../../meshManager/MeshManagerStepStats";

/**
 * Public handle returned to the VBO geometry storage for one mesh in a VBO batch.
 *
 * @internal
 */
export type TriangleGeometryVBOMeshHandle = {
  meshIndex: number;
};

/**
 * Everything a draw technique needs to issue one VBO-backed draw call.
 *
 * @internal
 */
export type TriangleGeometryVBODrawState = {
  vao: WebGLVertexArrayObject;
  firstIndex: number;
  indexCount: number;
  primRange: PrimRange;
};

/**
 * VBO draw state for one RTC tile. Each span points at one or more contiguous
 * active mesh slots inside the pass region of the existing element buffer.
 *
 * @internal
 */
export type TriangleGeometryVBOTileDrawState = {
  tileIndex: number;
  spans: Array<{
    firstIndex: number;
    indexCount: number;
    primCount: number;
  }>;
};

/**
 * Batch-owned VBO sibling for triangle geometry.
 *
 * This facade remains the renderer-facing VBO resource. Internally it delegates
 * fixed buffer ownership, pass/pick draw-list maintenance, and VAO setup to
 * smaller helpers so mesh lifecycle logic stays readable.
 *
 * @internal
 */
export class TriangleGeometryVBOBatch {
  private gl: WebGL2RenderingContext;
  private readonly _batchIndex: number;
  private readonly _maxPrims: number;
  private readonly _maxViews: number;
  private readonly _vertexCapacity: number;
  private readonly _indexCapacity: number;
  private readonly _edgeIndexCapacity: number;
  private readonly _views: TriangleGeometryVBOViewState[] = [];
  private readonly _meshRecords = new Map<number, TriangleGeometryVBOMeshRecord>();
  private readonly _buffers = new TriangleGeometryVBOBuffers();
  private readonly _vertexSpans: TriangleGeometryVBOSpanAllocator;
  private readonly _drawList: TriangleGeometryVBODrawList;
  private _bulkMeshAddDepth = 0;
  private _bulkMeshAddRangesDirty = false;
  private _geometryVertexToVBO = new Uint32Array(0);
  private _geometryVertexLookupStamps = new Uint32Array(0);
  private _geometryVertexLookupStamp = 1;

  constructor(params: {
    gl: WebGL2RenderingContext;
    batchIndex: number;
    maxPrims: number;
    maxViews: number;
  }) {
    this.gl = params.gl;
    this._batchIndex = params.batchIndex;
    this._maxPrims = Math.max(1, params.maxPrims | 0);
    this._maxViews = Math.max(1, params.maxViews | 0);
    this._vertexCapacity = this._maxPrims * 3;
    this._indexCapacity = this._maxPrims * 3;
    this._edgeIndexCapacity = this._maxPrims * 6;
    this._vertexSpans = new TriangleGeometryVBOSpanAllocator(this._vertexCapacity);
    this._drawList = new TriangleGeometryVBODrawList({
      indexCapacity: this._indexCapacity,
      edgeIndexCapacity: this._edgeIndexCapacity,
      buffers: this._buffers,
      getNextVertex: () => this._vertexSpans.nextVertex
    });
    for (let i = 0; i < this._maxViews; i++) {
      this._views.push(createTriangleGeometryVBOViewState());
    }
  }

  allocate(): SDKResult<void> {
    const cpuResult = this._buffers.allocateCPU({
      vertexCapacity: this._vertexCapacity,
      indexCapacity: this._indexCapacity,
      edgeIndexCapacity: this._edgeIndexCapacity,
      views: this._views
    });
    if (cpuResult.ok === false) {
      return cpuResult;
    }
    return this._allocateGPUResources();
  }

  setWebGLContext(gl: WebGL2RenderingContext): void {
    this.gl = gl;
  }

  webglContextRestored(): SDKResult<void> {
    this._deleteGPUResources();
    const result = this._allocateGPUResources();
    if (result.ok === false) {
      return result;
    }
    this._buffers.markAllDirty(this._vertexSpans.nextVertex, this._views);
    this.uploadChanges();
    return {ok: true, value: undefined};
  }

  canAddMesh(sceneMesh: SceneMesh): boolean {
    const primitiveCount = getTriangleGeometryPrimitiveCount(sceneMesh);
    const vertexCount = primitiveCount * 3;
    return primitiveCount > 0
      && this._vertexSpans.hasAvailable(vertexCount)
      && getTriangleGeometryEdgeIndexCount(sceneMesh) <= getTriangleGeometryEdgeSlotCapacity(sceneMesh);
  }

  beginBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    this._bulkMeshAddDepth++;
    this._drawList.beginBulkAdd();
    if (stats) {
      stats.vboBulkScopes++;
    }
  }

  endBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    if (this._bulkMeshAddDepth <= 0) {
      return;
    }
    this._bulkMeshAddDepth--;
    const indexStart = stats ? performance.now() : 0;
    this._drawList.endBulkAdd();
    if (stats) {
      stats.vboWriteIndexSlotsMs += performance.now() - indexStart;
    }
    if (this._bulkMeshAddDepth === 0 && this._bulkMeshAddRangesDirty) {
      this._refreshAllViewRanges(stats);
      this._bulkMeshAddRangesDirty = false;
    }
  }

  addMesh(params: {
    meshIndex: number;
    sceneMesh: SceneMesh;
    tileIndex: number;
    matrix: Mat4;
    color: Vec3;
    opacity: number;
    stats?: MeshManagerStepStats | null;
  }): SDKResult<TriangleGeometryVBOMeshHandle> {
    const stats = params.stats;
    const addStart = stats ? performance.now() : 0;
    if (stats) {
      stats.vboAddMeshCalls++;
      if (this._bulkMeshAddDepth > 0) {
        stats.vboBulkAddMeshCalls++;
      }
    }
    const primitiveCount = getTriangleGeometryPrimitiveCount(params.sceneMesh);
    if (primitiveCount <= 0) {
      if (stats) {
        stats.vboAddMeshMs += performance.now() - addStart;
      }
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[TriangleGeometryVBOBatch.addMesh] Expected a triangle mesh with indices"
      };
    }
    const vertexCount = primitiveCount * 3;
    if (this._meshRecords.has(params.meshIndex)) {
      if (stats) {
        stats.vboAddMeshMs += performance.now() - addStart;
      }
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[TriangleGeometryVBOBatch.addMesh] Mesh ${params.meshIndex} already exists in batch ${this._batchIndex}`
      };
    }
    if (getTriangleGeometryEdgeIndexCount(params.sceneMesh) > getTriangleGeometryEdgeSlotCapacity(params.sceneMesh)) {
      if (stats) {
        stats.vboAddMeshMs += performance.now() - addStart;
      }
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `[TriangleGeometryVBOBatch.addMesh] Batch ${this._batchIndex} has no VBO edge-index slot space for ${primitiveCount} triangle(s)`
      };
    }
    const vertexBase = this._vertexSpans.allocate(vertexCount);
    if (vertexBase < 0) {
      if (stats) {
        stats.vboAddMeshMs += performance.now() - addStart;
      }
      return {
        ok: false,
        type: SDKErrorType.MemoryAllocationFailed,
        error: `[TriangleGeometryVBOBatch.addMesh] Batch ${this._batchIndex} has no VBO space for ${primitiveCount} triangle(s)`
      };
    }

    const colors: Uint8Array[] = [];
    const opacities = new Uint8Array(this._maxViews);
    const pickables = new Uint8Array(this._maxViews);
    const clippables = new Uint8Array(this._maxViews);
    for (let viewIndex = 0; viewIndex < this._maxViews; viewIndex++) {
      colors.push(new Uint8Array([
        clampTriangleGeometryVBOByte(params.color[0], 255),
        clampTriangleGeometryVBOByte(params.color[1], 255),
        clampTriangleGeometryVBOByte(params.color[2], 255)
      ]));
      opacities[viewIndex] = clampTriangleGeometryVBOByte(params.opacity, 255);
      pickables[viewIndex] = 1;
      clippables[viewIndex] = 1;
    }

    const record: TriangleGeometryVBOMeshRecord = {
      meshIndex: params.meshIndex,
      sceneMesh: params.sceneMesh,
      vertexBase,
      vertexCount,
      primitiveCount,
      edgeVertexIndices: new Uint32Array(0),
      tileIndex: params.tileIndex | 0,
      matrix: copyTriangleGeometryVBOMatrix(params.matrix),
      colors,
      opacities,
      pickables,
      clippables,
      meshViewStates: this._views.map(() => ({
        renderPass: RENDER_PASSES.OPAQUE,
        visible: true
      }))
    };
    this._meshRecords.set(params.meshIndex, record);

    this._writeMeshGeometry(record, stats);
    for (let viewIndex = 0; viewIndex < this._maxViews; viewIndex++) {
      const view = this._views[viewIndex];
      const colorStart = stats ? performance.now() : 0;
      this._writeMeshViewAttributes(record, viewIndex);
      if (stats) {
        stats.vboWriteColorsMs += performance.now() - colorStart;
      }
      const indexStart = stats ? performance.now() : 0;
      this._drawList.addRecordViewIndices(view, viewIndex, record, false);
      if (stats) {
        stats.vboWriteIndexSlotsMs += performance.now() - indexStart;
      }
      if (this._bulkMeshAddDepth === 0) {
        this._refreshViewRanges(view, stats);
      }
    }
    if (this._bulkMeshAddDepth > 0) {
      this._bulkMeshAddRangesDirty = true;
    }
    if (stats) {
      stats.vboAddMeshMs += performance.now() - addStart;
    }

    return {ok: true, value: {meshIndex: params.meshIndex}};
  }

  removeMesh(meshIndex: number): void {
    const record = this._meshRecords.get(meshIndex);
    if (!record) {
      return;
    }
    for (let viewIndex = 0; viewIndex < this._views.length; viewIndex++) {
      this._drawList.removeRecordViewIndices(this._views[viewIndex], viewIndex, record);
    }
    this._meshRecords.delete(meshIndex);
    this._vertexSpans.release(record.vertexBase, record.vertexCount);
    for (let viewIndex = 0; viewIndex < this._views.length; viewIndex++) {
      this._drawList.refreshViewRanges(this._views[viewIndex]);
    }
  }

  setMeshMatrix(meshIndex: number, matrix: Mat4): void {
    const record = this._meshRecords.get(meshIndex);
    if (!record) {
      return;
    }
    record.matrix.set(matrix as any);
    this._writeMeshGeometry(record);
  }

  setMeshTile(meshIndex: number, tileIndex: number): void {
    const record = this._meshRecords.get(meshIndex);
    if (!record || record.tileIndex === (tileIndex | 0)) {
      return;
    }
    record.tileIndex = tileIndex | 0;
    this._writeMeshGeometry(record);
  }

  setMeshPlacement(meshIndex: number, tileIndex: number, matrix: Mat4): void {
    const record = this._meshRecords.get(meshIndex);
    if (!record) {
      return;
    }
    const nextTileIndex = tileIndex | 0;
    let dirty = record.tileIndex !== nextTileIndex;
    record.tileIndex = nextTileIndex;
    for (let i = 0; i < 16; i++) {
      if (record.matrix[i] !== (matrix as any)[i]) {
        dirty = true;
        break;
      }
    }
    if (!dirty) {
      return;
    }
    record.matrix.set(matrix as any);
    this._writeMeshGeometry(record);
  }

  setMeshViewAttribs(
    meshIndex: number,
    viewIndex: number,
    params: {
      color?: Vec3;
      opacity?: number;
      pickable?: boolean;
      clippable?: boolean;
    }
  ): void {
    const record = this._meshRecords.get(meshIndex);
    const view = this._views[viewIndex];
    if (!record || !view) {
      return;
    }
    let dirty = false;
    if (params.color) {
      const color = record.colors[viewIndex];
      const r = clampTriangleGeometryVBOByte(params.color[0], color[0]);
      const g = clampTriangleGeometryVBOByte(params.color[1], color[1]);
      const b = clampTriangleGeometryVBOByte(params.color[2], color[2]);
      dirty = dirty || color[0] !== r || color[1] !== g || color[2] !== b;
      color[0] = r;
      color[1] = g;
      color[2] = b;
    }
    if (params.opacity !== undefined) {
      const opacity = clampTriangleGeometryVBOByte(params.opacity, record.opacities[viewIndex]);
      dirty = dirty || record.opacities[viewIndex] !== opacity;
      record.opacities[viewIndex] = opacity;
    }
    if (params.pickable !== undefined) {
      const pickable = params.pickable ? 1 : 0;
      dirty = dirty || record.pickables[viewIndex] !== pickable;
      record.pickables[viewIndex] = pickable;
    }
    if (params.clippable !== undefined) {
      const clippable = params.clippable ? 1 : 0;
      dirty = dirty || record.clippables[viewIndex] !== clippable;
      record.clippables[viewIndex] = clippable;
    }
    if (dirty) {
      this._writeMeshViewAttributes(record, viewIndex);
    }
  }

  setMeshRenderPass(meshIndex: number, viewIndex: number, renderPass: RenderPassValue): void {
    const record = this._meshRecords.get(meshIndex);
    const meshViewState = record?.meshViewStates[viewIndex];
    const view = this._views[viewIndex];
    if (!record || !meshViewState || !view || meshViewState.renderPass === renderPass) {
      return;
    }
    this._drawList.setRecordRenderPass(view, viewIndex, record, renderPass);
  }

  setMeshVisible(meshIndex: number, viewIndex: number, visible: boolean): void {
    const record = this._meshRecords.get(meshIndex);
    const meshViewState = record?.meshViewStates[viewIndex];
    const view = this._views[viewIndex];
    if (!record || !meshViewState || !view || meshViewState.visible === visible) {
      return;
    }
    this._drawList.setRecordVisible(view, viewIndex, record, visible);
  }

  getDrawState(viewIndex: number, renderPass: RenderPassValue, layout: TriangleGeometryVBOVAOLayout): TriangleGeometryVBODrawState | null {
    const view = this._views[viewIndex];
    if (!view) {
      return null;
    }
    const primRange = view.passRanges.get(renderPass) ?? {firstPrim: 0, numPrims: 0};
    const indexRange = view.indexRanges.get(renderPass) ?? {firstIndex: 0, indexCount: 0};
    if (primRange.numPrims <= 0 || indexRange.indexCount <= 0) {
      return null;
    }
    const vao = this._getVAO(view, layout, "triangles");
    if (!vao) {
      return null;
    }
    return {
      vao,
      firstIndex: indexRange.firstIndex,
      indexCount: indexRange.indexCount,
      primRange
    };
  }

  getTileDrawStates(
    viewIndex: number,
    renderPass: RenderPassValue,
    layout: "hybrid" | "lean-static",
    topology: TriangleGeometryVBOTopology = "triangles"
  ): {
    vao: WebGLVertexArrayObject;
    primRange: PrimRange;
    tileDrawStates: TriangleGeometryVBOTileDrawState[];
  } | null {
    const view = this._views[viewIndex];
    if (!view) {
      return null;
    }
    const passRegionIndex = TRIANGLE_GEOMETRY_VBO_PASS_ORDER.indexOf(renderPass);
    const primRange = topology === "edges"
      ? (view.edgePassRanges.get(renderPass) ?? {firstPrim: 0, numPrims: 0})
      : (view.passRanges.get(renderPass) ?? {firstPrim: 0, numPrims: 0});
    if (passRegionIndex < 0 || primRange.numPrims <= 0) {
      return null;
    }
    const vao = this._getVAO(view, layout, topology);
    if (!vao) {
      return null;
    }
    const records = Array.from(this._meshRecords.values())
      .filter((record) => {
        const meshViewState = record.meshViewStates[viewIndex];
        return meshViewState?.visible && meshViewState.renderPass === renderPass;
      })
      .sort((a, b) => a.vertexBase - b.vertexBase);
    if (records.length === 0) {
      return null;
    }
    const tileDrawStates = this._buildTileDrawStates(records, topology, passRegionIndex);
    return {
      vao,
      primRange,
      tileDrawStates
    };
  }

  getPickTileDrawStates(
    viewIndex: number,
    layout: "hybrid" | "lean-static",
    topology: TriangleGeometryVBOTopology = "triangles"
  ): {
    vao: WebGLVertexArrayObject;
    primRange: PrimRange;
    tileDrawStates: TriangleGeometryVBOTileDrawState[];
  } | null {
    const view = this._views[viewIndex];
    if (!view) {
      return null;
    }
    const primRange = topology === "edges" ? view.pickEdgeRange : view.pickRange;
    if (primRange.numPrims <= 0) {
      return null;
    }
    const vao = this._getVAO(view, layout, topology);
    if (!vao) {
      return null;
    }
    const records = Array.from(this._meshRecords.values())
      .filter((record) => record.meshViewStates[viewIndex]?.visible)
      .sort((a, b) => a.vertexBase - b.vertexBase);
    if (records.length === 0) {
      return null;
    }
    const tileDrawStates = this._buildTileDrawStates(records, topology, TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX);
    return {
      vao,
      primRange,
      tileDrawStates
    };
  }

  getPickDrawState(viewIndex: number, layout: "hybrid"): TriangleGeometryVBODrawState | null {
    const view = this._views[viewIndex];
    if (!view) {
      return null;
    }
    if (view.pickRange.numPrims <= 0 || view.pickIndexRange.indexCount <= 0) {
      return null;
    }
    const vao = this._getVAO(view, layout, "triangles");
    if (!vao) {
      return null;
    }
    return {
      vao,
      firstIndex: view.pickIndexRange.firstIndex,
      indexCount: view.pickIndexRange.indexCount,
      primRange: view.pickRange
    };
  }

  getPickEdgeDrawState(viewIndex: number, layout: "hybrid"): TriangleGeometryVBODrawState | null {
    const view = this._views[viewIndex];
    if (!view) {
      return null;
    }
    if (view.pickEdgeRange.numPrims <= 0 || view.pickEdgeIndexRange.indexCount <= 0) {
      return null;
    }
    const vao = this._getVAO(view, layout, "edges");
    if (!vao) {
      return null;
    }
    return {
      vao,
      firstIndex: view.pickEdgeIndexRange.firstIndex,
      indexCount: view.pickEdgeIndexRange.indexCount,
      primRange: view.pickEdgeRange
    };
  }

  getEdgeDrawState(viewIndex: number, renderPass: RenderPassValue, layout: "hybrid"): TriangleGeometryVBODrawState | null {
    const view = this._views[viewIndex];
    if (!view) {
      return null;
    }
    const primRange = view.edgePassRanges.get(renderPass) ?? {firstPrim: 0, numPrims: 0};
    const indexRange = view.edgeIndexRanges.get(renderPass) ?? {firstIndex: 0, indexCount: 0};
    if (primRange.numPrims <= 0 || indexRange.indexCount <= 0) {
      return null;
    }
    const vao = this._getVAO(view, layout, "edges");
    if (!vao) {
      return null;
    }
    return {
      vao,
      firstIndex: indexRange.firstIndex,
      indexCount: indexRange.indexCount,
      primRange
    };
  }

  getRenderPassPrimitiveRange(viewIndex: number, renderPass: RenderPassValue): PrimRange | null {
    return this._views[viewIndex]?.passRanges.get(renderPass) ?? null;
  }

  getRenderPassPrimitiveRanges(viewIndex: number): Map<number, PrimRange> | null {
    return this._views[viewIndex]?.passRanges ?? null;
  }

  getRenderPassEdgePrimitiveRanges(viewIndex: number): Map<number, PrimRange> | null {
    return this._views[viewIndex]?.edgePassRanges ?? null;
  }

  getPickPrimitiveRange(viewIndex: number): PrimRange | null {
    return this._views[viewIndex]?.pickRange ?? null;
  }

  getPickEdgePrimitiveRange(viewIndex: number): PrimRange | null {
    return this._views[viewIndex]?.pickEdgeRange ?? null;
  }

  getNumDrawablePrims(viewIndex: number): number {
    return this._views[viewIndex]?.pickRange.numPrims ?? 0;
  }

  uploadChanges(): boolean {
    return this._buffers.uploadChanges({
      gl: this.gl,
      views: this._views,
      rebuildViewIndices: (view, viewIndex) => {
        this._drawList.rebuildViewIndices(view, viewIndex, this._meshRecords);
      }
    });
  }

  getAllocatedBytes(): number {
    return this._buffers.getAllocatedBytes({
      vertexCapacity: this._vertexCapacity,
      indexCapacity: this._indexCapacity,
      edgeIndexCapacity: this._edgeIndexCapacity,
      maxViews: this._maxViews
    });
  }

  getUsedBytes(): number {
    return this._buffers.getUsedBytes({
      activeVertices: this._getUsedVertexCapacity(),
      maxViews: this._maxViews,
      views: this._views
    });
  }

  destroy(): void {
    this._deleteGPUResources();
    this._buffers.destroyCPU(this._views);
    this._meshRecords.clear();
    this._vertexSpans.clear();
    this._geometryVertexToVBO = new Uint32Array(0);
    this._geometryVertexLookupStamps = new Uint32Array(0);
    this._geometryVertexLookupStamp = 1;
  }

  private _allocateGPUResources(): SDKResult<void> {
    return this._buffers.allocateGPU({
      gl: this.gl,
      vertexCapacity: this._vertexCapacity,
      indexCapacity: this._indexCapacity,
      edgeIndexCapacity: this._edgeIndexCapacity,
      views: this._views
    });
  }

  private _deleteGPUResources(): void {
    for (const view of this._views) {
      deleteTriangleGeometryVBOVAOs(this.gl, view);
    }
    this._buffers.deleteGPUResources(this.gl, this._views);
  }

  private _refreshViewRanges(view: TriangleGeometryVBOViewState, stats?: MeshManagerStepStats | null): void {
    const start = stats ? performance.now() : 0;
    this._drawList.refreshViewRanges(view);
    if (stats) {
      stats.vboRefreshRangesMs += performance.now() - start;
      stats.vboRefreshRangesCalls++;
    }
  }

  private _refreshAllViewRanges(stats?: MeshManagerStepStats | null): void {
    for (const view of this._views) {
      this._refreshViewRanges(view, stats);
    }
  }

  private _writeMeshGeometry(record: TriangleGeometryVBOMeshRecord, stats?: MeshManagerStepStats | null): void {
    const start = stats ? performance.now() : 0;
    const positions = this._buffers.positions;
    const meshIndices = this._buffers.meshIndices;
    const geometryVertexIndices = this._buffers.geometryVertexIndices;
    if (!positions || !meshIndices || !geometryVertexIndices) {
      return;
    }
    const geometry = record.sceneMesh.geometry;
    const compressed = geometry.positionsCompressed;
    const indices = geometry.indices;
    const aabb = geometry.aabb;
    if (!compressed || !indices || !aabb) {
      return;
    }
    const offsetX = aabb[0];
    const offsetY = aabb[1];
    const offsetZ = aabb[2];
    const scaleX = (aabb[3] - aabb[0]) / 65536;
    const scaleY = (aabb[4] - aabb[1]) / 65536;
    const scaleZ = (aabb[5] - aabb[2]) / 65536;
    const matrix = record.matrix;
    const lookupStamp = this._beginGeometryVertexLookup((compressed.length / 3) | 0);
    const geometryVertexToVBO = this._geometryVertexToVBO;
    const geometryVertexLookupStamps = this._geometryVertexLookupStamps;
    let writeVertex = record.vertexBase;
    const vertexStart = stats ? performance.now() : 0;
    for (let prim = 0; prim < record.primitiveCount; prim++) {
      const indexBase = prim * 3;
      for (let local = 0; local < 3; local++) {
        const geometryVertexIndex = indices[indexBase + local];
        const compressedOffset = geometryVertexIndex * 3;
        const x = offsetX + scaleX * compressed[compressedOffset];
        const y = offsetY + scaleY * compressed[compressedOffset + 1];
        const z = offsetZ + scaleZ * compressed[compressedOffset + 2];
        const positionOffset = writeVertex * 4;
        positions[positionOffset] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        positions[positionOffset + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        positions[positionOffset + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
        positions[positionOffset + 3] = record.tileIndex;
        meshIndices[writeVertex] = record.meshIndex;
        geometryVertexIndices[writeVertex] = geometryVertexIndex;
        if (geometryVertexLookupStamps[geometryVertexIndex] !== lookupStamp) {
          geometryVertexLookupStamps[geometryVertexIndex] = lookupStamp;
          geometryVertexToVBO[geometryVertexIndex] = writeVertex;
        }
        writeVertex++;
      }
    }
    if (stats) {
      stats.vboPackVerticesMs += performance.now() - vertexStart;
    }
    const edgeIndices = geometry.edgeIndices;
    const edgeStart = stats ? performance.now() : 0;
    if (edgeIndices && edgeIndices.length > 0) {
      const edgeVertexIndices = new Uint32Array(edgeIndices.length);
      let edgeOffset = 0;
      for (let edge = 0; edge + 1 < edgeIndices.length; edge += 2) {
        const aIndex = edgeIndices[edge];
        const bIndex = edgeIndices[edge + 1];
        if (geometryVertexLookupStamps[aIndex] !== lookupStamp || geometryVertexLookupStamps[bIndex] !== lookupStamp) {
          continue;
        }
        edgeVertexIndices[edgeOffset++] = geometryVertexToVBO[aIndex];
        edgeVertexIndices[edgeOffset++] = geometryVertexToVBO[bIndex];
      }
      record.edgeVertexIndices = edgeOffset === edgeVertexIndices.length
        ? edgeVertexIndices
        : edgeVertexIndices.slice(0, edgeOffset);
    } else {
      record.edgeVertexIndices = new Uint32Array(0);
    }
    if (stats) {
      stats.vboPackEdgesMs += performance.now() - edgeStart;
    }
    this._buffers.markPositionDirty(record.vertexBase, record.vertexCount);
    this._buffers.markMeshIndexDirty(record.vertexBase, record.vertexCount);
    this._buffers.markGeometryVertexIndexDirty(record.vertexBase, record.vertexCount);
    if (stats) {
      stats.vboWriteGeometryMs += performance.now() - start;
      stats.vboWriteGeometryCalls++;
    }
  }

  private _beginGeometryVertexLookup(vertexCount: number): number {
    if (vertexCount > this._geometryVertexToVBO.length) {
      const capacity = Math.max(vertexCount, this._geometryVertexToVBO.length * 2, 16);
      this._geometryVertexToVBO = new Uint32Array(capacity);
      this._geometryVertexLookupStamps = new Uint32Array(capacity);
      this._geometryVertexLookupStamp = 1;
    }
    if (this._geometryVertexLookupStamp > 0xffffffff) {
      this._geometryVertexLookupStamps.fill(0);
      this._geometryVertexLookupStamp = 1;
    }
    return this._geometryVertexLookupStamp++;
  }

  private _writeMeshViewAttributes(record: TriangleGeometryVBOMeshRecord, viewIndex: number): void {
    const view = this._views[viewIndex];
    const colors = view?.colors;
    const renderFlags = view?.renderFlags;
    if (!view || !colors || !renderFlags) {
      return;
    }
    const color = record.colors[viewIndex];
    const opacity = record.opacities[viewIndex];
    const start = record.vertexBase * 4;
    const end = start + record.vertexCount * 4;
    for (let offset = start; offset < end; offset += 4) {
      colors[offset] = color[0];
      colors[offset + 1] = color[1];
      colors[offset + 2] = color[2];
      colors[offset + 3] = opacity;
      renderFlags[offset] = record.pickables[viewIndex];
      renderFlags[offset + 1] = record.clippables[viewIndex];
      renderFlags[offset + 2] = 0;
      renderFlags[offset + 3] = 0;
    }
    this._buffers.markColorDirty(view, record.vertexBase, record.vertexCount);
    this._buffers.markRenderFlagDirty(view, record.vertexBase, record.vertexCount);
  }

  private _getVAO(
    view: TriangleGeometryVBOViewState,
    layout: TriangleGeometryVBOVAOLayout,
    topology: TriangleGeometryVBOTopology
  ): WebGLVertexArrayObject | null {
    return getTriangleGeometryVBOVAO({
      gl: this.gl,
      view,
      layout,
      topology,
      positionBuffer: this._buffers.positionBuffer,
      meshIndexBuffer: this._buffers.meshIndexBuffer,
      geometryVertexIndexBuffer: this._buffers.geometryVertexIndexBuffer
    });
  }

  private _buildTileDrawStates(
    records: TriangleGeometryVBOMeshRecord[],
    topology: TriangleGeometryVBOTopology,
    regionIndex: number
  ): TriangleGeometryVBOTileDrawState[] {
    const regionBase = regionIndex * (topology === "edges" ? this._edgeIndexCapacity : this._indexCapacity);
    const byTile = new Map<number, TriangleGeometryVBOTileDrawState>();
    for (const record of records) {
      const indexCount = topology === "edges" ? record.edgeVertexIndices.length : record.vertexCount;
      if (indexCount <= 0) {
        continue;
      }
      const tileIndex = record.tileIndex | 0;
      let tileState = byTile.get(tileIndex);
      if (!tileState) {
        tileState = {tileIndex, spans: []};
        byTile.set(tileIndex, tileState);
      }
      const firstIndex = regionBase + (topology === "edges" ? record.vertexBase * 2 : record.vertexBase);
      const primCount = topology === "edges" ? indexCount / 2 : record.primitiveCount;
      const prev = tileState.spans[tileState.spans.length - 1];
      if (prev && prev.firstIndex + prev.indexCount === firstIndex) {
        prev.indexCount += indexCount;
        prev.primCount += primCount;
      } else {
        tileState.spans.push({
          firstIndex,
          indexCount,
          primCount
        });
      }
    }
    return Array.from(byTile.values()).filter((state) => state.spans.length > 0);
  }

  private _getUsedVertexCapacity(): number {
    let count = 0;
    for (const record of this._meshRecords.values()) {
      count += record.vertexCount;
    }
    return count;
  }

  private get _positions(): Float32Array | null {
    return this._buffers.positions;
  }

  private get _meshIndices(): Uint32Array | null {
    return this._buffers.meshIndices;
  }

  private get _geometryVertexIndices(): Uint32Array | null {
    return this._buffers.geometryVertexIndices;
  }

  private get _freeVertexSpans(): Array<{ base: number; count: number }> {
    return this._vertexSpans.freeVertexSpans;
  }

  private get _nextVertex(): number {
    return this._vertexSpans.nextVertex;
  }
}
