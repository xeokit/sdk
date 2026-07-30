import type {TriangleGeometryVBOBuffers} from "./TriangleGeometryVBOBuffers";
import {
  TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT,
  TRIANGLE_GEOMETRY_VBO_PASS_ORDER,
  TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX,
  type TriangleGeometryVBOIndexRange,
  type TriangleGeometryVBOMeshRecord,
  type TriangleGeometryVBOMeshViewState,
  type TriangleGeometryVBOViewState
} from "./TriangleGeometryVBOState";
import {RENDER_PASSES} from "../../../RENDER_PASSES";

type PendingBulkInitialRecord = {
  view: TriangleGeometryVBOViewState;
  record: TriangleGeometryVBOMeshRecord;
};

type BulkDirtyRange = {
  min: number;
  max: number;
};

type BulkViewDirtyRanges = {
  indexRanges: Array<BulkDirtyRange | null>;
  edgeIndexRanges: Array<BulkDirtyRange | null>;
};

/**
 * Builds the per-view index buffers and draw ranges for one triangle VBO batch.
 *
 * Each mesh keeps a fixed slot in every pass and picking region. Hidden or
 * inactive meshes are tombstoned in that slot so the batch can update
 * visibility without compacting the whole VBO.
 *
 * @internal
 */
export class TriangleGeometryVBODrawList {
  private readonly _indexCapacity: number;
  private readonly _edgeIndexCapacity: number;
  private readonly _buffers: TriangleGeometryVBOBuffers;
  private readonly _getNextVertex: () => number;
  private _bulkDepth = 0;
  private readonly _pendingBulkInitialRecords: PendingBulkInitialRecord[] = [];
  private readonly _bulkDirtyRanges = new Map<TriangleGeometryVBOViewState, BulkViewDirtyRanges>();

  constructor(params: {
    indexCapacity: number;
    edgeIndexCapacity: number;
    buffers: TriangleGeometryVBOBuffers;
    getNextVertex: () => number;
  }) {
    this._indexCapacity = params.indexCapacity;
    this._edgeIndexCapacity = params.edgeIndexCapacity;
    this._buffers = params.buffers;
    this._getNextVertex = params.getNextVertex;
  }

  beginBulkAdd(): void {
    this._bulkDepth++;
  }

  endBulkAdd(): void {
    if (this._bulkDepth <= 0) {
      return;
    }
    this._bulkDepth--;
    if (this._bulkDepth > 0) {
      return;
    }
    this._flushPendingBulkInitialRecords();
    this._flushBulkDirtyRanges();
  }

  rebuildViewIndices(
    view: TriangleGeometryVBOViewState,
    viewIndex: number,
    records: ReadonlyMap<number, TriangleGeometryVBOMeshRecord>
  ): void {
    this._clearPendingBulkInitialRecords();
    const indices = view.indices;
    const edgeIndices = view.edgeIndices;
    if (!indices || !edgeIndices) {
      return;
    }
    indices.fill(0);
    edgeIndices.fill(0);
    this._resetViewCounts(view);
    for (const record of records.values()) {
      this.writeRecordViewIndices(view, viewIndex, record);
      this._addRecordCounts(view, record, record.meshViewStates[viewIndex]);
    }
    this.refreshViewRanges(view);
    view.indicesDirty = false;
    this._buffers.markIndexRangeDirty(view, 0, indices.length);
    this._buffers.markEdgeIndexRangeDirty(view, 0, edgeIndices.length);
  }

  addRecordViewIndices(
    view: TriangleGeometryVBOViewState,
    viewIndex: number,
    record: TriangleGeometryVBOMeshRecord,
    refreshRanges = true
  ): void {
    const meshViewState = record.meshViewStates[viewIndex];
    if (this._bulkDepth > 0 && isInitialOpaqueVisible(meshViewState)) {
      this._writeBulkInitialOpaqueRecordViewIndices(view, record);
    } else {
      this._flushPendingBulkInitialRecords();
      this.writeRecordViewIndices(view, viewIndex, record);
    }
    this._addRecordCounts(view, record, record.meshViewStates[viewIndex]);
    if (refreshRanges) {
      this.refreshViewRanges(view);
    }
  }

  removeRecordViewIndices(
    view: TriangleGeometryVBOViewState,
    viewIndex: number,
    record: TriangleGeometryVBOMeshRecord
  ): void {
    this._flushPendingBulkInitialRecords();
    this._subtractRecordCounts(view, record, record.meshViewStates[viewIndex]);
    this.tombstoneRecordViewIndices(view, record);
  }

  setRecordRenderPass(
    view: TriangleGeometryVBOViewState,
    viewIndex: number,
    record: TriangleGeometryVBOMeshRecord,
    renderPass: number
  ): void {
    this._flushPendingBulkInitialRecords();
    const meshViewState = record.meshViewStates[viewIndex];
    if (!meshViewState || meshViewState.renderPass === renderPass) {
      return;
    }
    this._subtractRecordCounts(view, record, meshViewState);
    meshViewState.renderPass = renderPass;
    this._addRecordCounts(view, record, meshViewState);
    this.writeRecordViewIndices(view, viewIndex, record);
    this.refreshViewRanges(view);
  }

  setRecordVisible(
    view: TriangleGeometryVBOViewState,
    viewIndex: number,
    record: TriangleGeometryVBOMeshRecord,
    visible: boolean
  ): void {
    this._flushPendingBulkInitialRecords();
    const meshViewState = record.meshViewStates[viewIndex];
    if (!meshViewState || meshViewState.visible === visible) {
      return;
    }
    this._subtractRecordCounts(view, record, meshViewState);
    meshViewState.visible = visible;
    this._addRecordCounts(view, record, meshViewState);
    this.writeRecordViewIndices(view, viewIndex, record);
    this.refreshViewRanges(view);
  }

  writeRecordViewIndices(
    view: TriangleGeometryVBOViewState,
    viewIndex: number,
    record: TriangleGeometryVBOMeshRecord
  ): void {
    const indices = view.indices;
    const edgeIndices = view.edgeIndices;
    const meshViewState = record.meshViewStates[viewIndex];
    if (!indices || !edgeIndices || !meshViewState) {
      return;
    }
    for (let passRegionIndex = 0; passRegionIndex < TRIANGLE_GEOMETRY_VBO_PASS_ORDER.length; passRegionIndex++) {
      const pass = TRIANGLE_GEOMETRY_VBO_PASS_ORDER[passRegionIndex];
      const active = meshViewState.visible && meshViewState.renderPass === pass;
      this._writeRecordTriangleSlot(view, indices, passRegionIndex, record, active);
      this._writeRecordEdgeSlot(view, edgeIndices, passRegionIndex, record, active);
    }
    this._writeRecordTriangleSlot(view, indices, TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX, record, meshViewState.visible);
    this._writeRecordEdgeSlot(view, edgeIndices, TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX, record, meshViewState.visible);
  }

  private _writeBulkInitialOpaqueRecordViewIndices(
    view: TriangleGeometryVBOViewState,
    record: TriangleGeometryVBOMeshRecord
  ): void {
    const indices = view.indices;
    if (!indices) {
      return;
    }
    const opaqueRegionIndex = getPassRegionIndex(RENDER_PASSES.OPAQUE);
    if (opaqueRegionIndex < 0) {
      return;
    }
    this._writeRecordTriangleSlot(view, indices, opaqueRegionIndex, record, true);
    this._writeRecordTriangleSlot(view, indices, TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX, record, true);
    this._pendingBulkInitialRecords.push({view, record});
  }

  tombstoneRecordViewIndices(view: TriangleGeometryVBOViewState, record: TriangleGeometryVBOMeshRecord): void {
    const indices = view.indices;
    const edgeIndices = view.edgeIndices;
    if (!indices || !edgeIndices) {
      return;
    }
    for (let regionIndex = 0; regionIndex < TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT; regionIndex++) {
      this._writeRecordTriangleSlot(view, indices, regionIndex, record, false);
      this._writeRecordEdgeSlot(view, edgeIndices, regionIndex, record, false);
    }
  }

  refreshViewRanges(view: TriangleGeometryVBOViewState): void {
    for (let passRegionIndex = 0; passRegionIndex < TRIANGLE_GEOMETRY_VBO_PASS_ORDER.length; passRegionIndex++) {
      const pass = TRIANGLE_GEOMETRY_VBO_PASS_ORDER[passRegionIndex];
      const numPrims = view.passPrimCounts[passRegionIndex] || 0;
      const numEdgePrims = view.edgePassPrimCounts[passRegionIndex] || 0;
      setPrimRange(view.passRanges, pass, 0, numPrims);
      setIndexRange(view.indexRanges, pass, passRegionIndex * this._indexCapacity, numPrims > 0 ? this._getNextVertex() : 0);
      setPrimRange(view.edgePassRanges, pass, 0, numEdgePrims);
      setIndexRange(view.edgeIndexRanges, pass, passRegionIndex * this._edgeIndexCapacity, numEdgePrims > 0 ? this._getNextVertex() * 2 : 0);
    }
    view.pickRange.firstPrim = 0;
    view.pickRange.numPrims = view.pickPrimCount;
    view.pickIndexRange.firstIndex = TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX * this._indexCapacity;
    view.pickIndexRange.indexCount = view.pickPrimCount > 0 ? this._getNextVertex() : 0;
    view.pickEdgeRange.firstPrim = 0;
    view.pickEdgeRange.numPrims = view.pickEdgePrimCount;
    view.pickEdgeIndexRange.firstIndex = TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX * this._edgeIndexCapacity;
    view.pickEdgeIndexRange.indexCount = view.pickEdgePrimCount > 0 ? this._getNextVertex() * 2 : 0;
    view.indexCount = view.pickPrimCount * 3;
    view.edgeIndexCount = view.pickEdgePrimCount * 2;
  }

  private _writeRecordTriangleSlot(
    view: TriangleGeometryVBOViewState,
    indices: Uint32Array,
    regionIndex: number,
    record: TriangleGeometryVBOMeshRecord,
    active: boolean
  ): void {
    const slotBase = regionIndex * this._indexCapacity + record.vertexBase;
    const tombstone = record.vertexBase;
    if (active) {
      for (let offset = 0; offset < record.vertexCount; offset++) {
        indices[slotBase + offset] = record.vertexBase + offset;
      }
    } else {
      indices.fill(tombstone, slotBase, slotBase + record.vertexCount);
    }
    this._markIndexRangeDirty(view, regionIndex, slotBase, record.vertexCount);
  }

  private _writeRecordEdgeSlot(
    view: TriangleGeometryVBOViewState,
    edgeIndices: Uint32Array,
    regionIndex: number,
    record: TriangleGeometryVBOMeshRecord,
    active: boolean
  ): void {
    const slotLength = record.vertexCount * 2;
    const slotBase = regionIndex * this._edgeIndexCapacity + record.vertexBase * 2;
    const tombstone = record.vertexBase;
    edgeIndices.fill(tombstone, slotBase, slotBase + slotLength);
    if (active && record.edgeVertexIndices.length > 0) {
      edgeIndices.set(record.edgeVertexIndices, slotBase);
    }
    this._markEdgeIndexRangeDirty(view, regionIndex, slotBase, slotLength);
  }

  private _flushPendingBulkInitialRecords(): void {
    if (this._pendingBulkInitialRecords.length === 0) {
      return;
    }
    const recordsByView = new Map<TriangleGeometryVBOViewState, TriangleGeometryVBOMeshRecord[]>();
    for (const pending of this._pendingBulkInitialRecords) {
      const records = recordsByView.get(pending.view);
      if (records) {
        records.push(pending.record);
      } else {
        recordsByView.set(pending.view, [pending.record]);
      }
    }
    this._pendingBulkInitialRecords.length = 0;
    for (const [view, records] of recordsByView) {
      records.sort((a, b) => a.vertexBase - b.vertexBase);
      let groupStart = 0;
      for (let i = 1; i <= records.length; i++) {
        const previous = records[i - 1];
        const current = records[i];
        if (current && previous.vertexBase + previous.vertexCount === current.vertexBase) {
          continue;
        }
        this._initializeBulkInitialRecordGroup(view, records, groupStart, i);
        groupStart = i;
      }
    }
  }

  private _clearPendingBulkInitialRecords(): void {
    this._pendingBulkInitialRecords.length = 0;
    this._bulkDirtyRanges.clear();
  }

  private _initializeBulkInitialRecordGroup(
    view: TriangleGeometryVBOViewState,
    records: TriangleGeometryVBOMeshRecord[],
    start: number,
    end: number
  ): void {
    const indices = view.indices;
    const edgeIndices = view.edgeIndices;
    if (!indices || !edgeIndices || start >= end) {
      return;
    }
    const firstRecord = records[start];
    const lastRecord = records[end - 1];
    const vertexBase = firstRecord.vertexBase;
    const vertexCount = lastRecord.vertexBase + lastRecord.vertexCount - vertexBase;
    const opaqueRegionIndex = getPassRegionIndex(RENDER_PASSES.OPAQUE);

    for (let regionIndex = 0; regionIndex < TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT; regionIndex++) {
      if (regionIndex === opaqueRegionIndex || regionIndex === TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX) {
        continue;
      }
      const slotBase = regionIndex * this._indexCapacity + vertexBase;
      indices.fill(0, slotBase, slotBase + vertexCount);
      this._markIndexRangeDirty(view, regionIndex, slotBase, vertexCount);
    }

    for (let regionIndex = 0; regionIndex < TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT; regionIndex++) {
      const slotBase = regionIndex * this._edgeIndexCapacity + vertexBase * 2;
      const slotLength = vertexCount * 2;
      edgeIndices.fill(0, slotBase, slotBase + slotLength);
      this._markEdgeIndexRangeDirty(view, regionIndex, slotBase, slotLength);
    }

    if (opaqueRegionIndex < 0) {
      return;
    }
    for (let i = start; i < end; i++) {
      const record = records[i];
      if (record.edgeVertexIndices.length === 0) {
        continue;
      }
      edgeIndices.set(record.edgeVertexIndices, opaqueRegionIndex * this._edgeIndexCapacity + record.vertexBase * 2);
      edgeIndices.set(record.edgeVertexIndices, TRIANGLE_GEOMETRY_VBO_PICK_REGION_INDEX * this._edgeIndexCapacity + record.vertexBase * 2);
    }
  }

  private _markIndexRangeDirty(
    view: TriangleGeometryVBOViewState,
    regionIndex: number,
    base: number,
    count: number
  ): void {
    if (count <= 0) {
      return;
    }
    if (this._bulkDepth <= 0) {
      this._buffers.markIndexRangeDirty(view, base, count);
      return;
    }
    this._expandBulkDirtyRange(this._getBulkViewDirtyRanges(view).indexRanges, regionIndex, base, count);
  }

  private _markEdgeIndexRangeDirty(
    view: TriangleGeometryVBOViewState,
    regionIndex: number,
    base: number,
    count: number
  ): void {
    if (count <= 0) {
      return;
    }
    if (this._bulkDepth <= 0) {
      this._buffers.markEdgeIndexRangeDirty(view, base, count);
      return;
    }
    this._expandBulkDirtyRange(this._getBulkViewDirtyRanges(view).edgeIndexRanges, regionIndex, base, count);
  }

  private _getBulkViewDirtyRanges(view: TriangleGeometryVBOViewState): BulkViewDirtyRanges {
    let ranges = this._bulkDirtyRanges.get(view);
    if (!ranges) {
      ranges = {
        indexRanges: new Array(TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT).fill(null),
        edgeIndexRanges: new Array(TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT).fill(null)
      };
      this._bulkDirtyRanges.set(view, ranges);
    }
    return ranges;
  }

  private _expandBulkDirtyRange(
    ranges: Array<BulkDirtyRange | null>,
    regionIndex: number,
    base: number,
    count: number
  ): void {
    const end = base + count;
    const range = ranges[regionIndex];
    if (range) {
      range.min = Math.min(range.min, base);
      range.max = Math.max(range.max, end);
    } else {
      ranges[regionIndex] = {min: base, max: end};
    }
  }

  private _flushBulkDirtyRanges(): void {
    for (const [view, ranges] of this._bulkDirtyRanges) {
      for (const range of ranges.indexRanges) {
        if (range) {
          this._buffers.markIndexRangeDirty(view, range.min, range.max - range.min);
        }
      }
      for (const range of ranges.edgeIndexRanges) {
        if (range) {
          this._buffers.markEdgeIndexRangeDirty(view, range.min, range.max - range.min);
        }
      }
    }
    this._bulkDirtyRanges.clear();
  }

  private _resetViewCounts(view: TriangleGeometryVBOViewState): void {
    view.passPrimCounts.fill(0);
    view.edgePassPrimCounts.fill(0);
    view.pickPrimCount = 0;
    view.pickEdgePrimCount = 0;
  }

  private _addRecordCounts(
    view: TriangleGeometryVBOViewState,
    record: TriangleGeometryVBOMeshRecord,
    meshViewState: TriangleGeometryVBOMeshViewState | undefined
  ): void {
    this._addRecordCountsWithSign(view, record, meshViewState, 1);
  }

  private _subtractRecordCounts(
    view: TriangleGeometryVBOViewState,
    record: TriangleGeometryVBOMeshRecord,
    meshViewState: TriangleGeometryVBOMeshViewState | undefined
  ): void {
    this._addRecordCountsWithSign(view, record, meshViewState, -1);
  }

  private _addRecordCountsWithSign(
    view: TriangleGeometryVBOViewState,
    record: TriangleGeometryVBOMeshRecord,
    meshViewState: TriangleGeometryVBOMeshViewState | undefined,
    sign: 1 | -1
  ): void {
    if (!meshViewState || !meshViewState.visible) {
      return;
    }
    const edgePrimCount = (record.edgeVertexIndices.length / 2) | 0;
    view.pickPrimCount = Math.max(0, view.pickPrimCount + sign * record.primitiveCount);
    view.pickEdgePrimCount = Math.max(0, view.pickEdgePrimCount + sign * edgePrimCount);
    const passRegionIndex = getPassRegionIndex(meshViewState.renderPass);
    if (passRegionIndex < 0) {
      return;
    }
    view.passPrimCounts[passRegionIndex] = Math.max(0, view.passPrimCounts[passRegionIndex] + sign * record.primitiveCount);
    view.edgePassPrimCounts[passRegionIndex] = Math.max(0, view.edgePassPrimCounts[passRegionIndex] + sign * edgePrimCount);
  }
}

function getPassRegionIndex(renderPass: number): number {
  for (let i = 0; i < TRIANGLE_GEOMETRY_VBO_PASS_ORDER.length; i++) {
    if (TRIANGLE_GEOMETRY_VBO_PASS_ORDER[i] === renderPass) {
      return i;
    }
  }
  return -1;
}

function isInitialOpaqueVisible(meshViewState: TriangleGeometryVBOMeshViewState | undefined): boolean {
  return !!meshViewState && meshViewState.visible && meshViewState.renderPass === RENDER_PASSES.OPAQUE;
}

function setPrimRange(map: Map<number, {firstPrim: number; numPrims: number}>, key: number, firstPrim: number, numPrims: number): void {
  const range = map.get(key);
  if (range) {
    range.firstPrim = firstPrim;
    range.numPrims = numPrims;
  } else {
    map.set(key, {firstPrim, numPrims});
  }
}

function setIndexRange(map: Map<number, TriangleGeometryVBOIndexRange>, key: number, firstIndex: number, indexCount: number): void {
  const range = map.get(key);
  if (range) {
    range.firstIndex = firstIndex;
    range.indexCount = indexCount;
  } else {
    map.set(key, {firstIndex, indexCount});
  }
}
