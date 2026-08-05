import {TrianglesPrimitive} from "../../../../../../base/constants";
import {RENDER_PASSES} from "../../../RENDER_PASSES";
import {TriangleGeometryVBOBatch} from "../TriangleGeometryVBOBatch";

type RecordedUpload = {
  target: number;
  offset: number;
  data: number[];
  type: string;
};

type DebugMeshRecord = {
  vertexBase: number;
  vertexCount: number;
  edgeVertexIndices: Uint32Array;
};

type DebugTriangleGeometryVBOBatch = {
  _meshRecords: Map<number, DebugMeshRecord>;
  _freeVertexSpans: Array<{ base: number; count: number }>;
  _nextVertex: number;
  _positions: Float32Array | null;
  _geometryVertexIndices: Uint32Array | null;
  _views: Array<{
    indices: Uint32Array | null;
    edgeIndices: Uint32Array | null;
    passPrimCounts: number[];
    edgePassPrimCounts: number[];
    pickPrimCount: number;
    pickEdgePrimCount: number;
    edgeIndexCount: number;
  }>;
};

const TEST_PASS_ORDER = [
  RENDER_PASSES.OPAQUE,
  RENDER_PASSES.TRANSPARENT,
  RENDER_PASSES.HIGHLIGHTED,
  RENDER_PASSES.SELECTED,
  RENDER_PASSES.XRAYED
];
const TEST_PICK_REGION_INDEX = TEST_PASS_ORDER.length;

function triangleIndexRegionBase(maxPrims: number, regionIndex: number): number {
  return maxPrims * 3 * regionIndex;
}

function edgeIndexRegionBase(maxPrims: number, regionIndex: number): number {
  return maxPrims * 6 * regionIndex;
}

function createMatrix(tx: number, ty: number, tz: number): Float64Array {
  return new Float64Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1
  ]);
}

function createMockGL(uploads: RecordedUpload[]): WebGL2RenderingContext {
  let nextId = 1;
  const gl: Record<string, unknown> = {
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    DYNAMIC_DRAW: 0x88E8,
    FLOAT: 0x1406,
    UNSIGNED_BYTE: 0x1401,
    UNSIGNED_INT: 0x1405,
    createBuffer: () => ({id: nextId++}),
    bindBuffer: () => undefined,
    bufferData: () => undefined,
    bufferSubData: (target: number, offset: number, data: ArrayLike<number>) => {
      uploads.push({
        target,
        offset,
        data: Array.from(data),
        type: data.constructor.name
      });
    },
    deleteBuffer: () => undefined,
    createVertexArray: () => ({id: nextId++}),
    bindVertexArray: () => undefined,
    deleteVertexArray: () => undefined,
    enableVertexAttribArray: () => undefined,
    vertexAttribPointer: () => undefined,
    vertexAttribIPointer: () => undefined
  };
  return gl as unknown as WebGL2RenderingContext;
}

function getStoredVertex(batch: TriangleGeometryVBOBatch, meshIndex: number, localVertexIndex: number): [number, number, number, number] {
  const internals = batch as unknown as DebugTriangleGeometryVBOBatch;
  const record = internals._meshRecords.get(meshIndex);
  expect(record).toBeDefined();
  expect(internals._positions).not.toBeNull();
  expect(localVertexIndex).toBeGreaterThanOrEqual(0);
  expect(localVertexIndex).toBeLessThan(record!.vertexCount);
  const offset = (record!.vertexBase + localVertexIndex) * 4;
  const positions = internals._positions!;
  return [
    positions[offset],
    positions[offset + 1],
    positions[offset + 2],
    positions[offset + 3]
  ];
}

function getStoredGeometryVertexIndices(batch: TriangleGeometryVBOBatch, meshIndex: number): number[] {
  const internals = batch as unknown as DebugTriangleGeometryVBOBatch;
  const record = internals._meshRecords.get(meshIndex);
  expect(record).toBeDefined();
  expect(internals._geometryVertexIndices).not.toBeNull();
  const start = record!.vertexBase;
  const end = start + record!.vertexCount;
  return Array.from(internals._geometryVertexIndices!.subarray(start, end));
}

function createTriangleMesh() {
  return {
    geometry: {
      primitive: TrianglesPrimitive,
      aabb: new Float32Array([0, 0, 0, 1, 1, 0]),
      positionsCompressed: new Uint16Array([
        0, 0, 0,
        65535, 0, 0,
        0, 65535, 0
      ]),
      indices: new Uint32Array([0, 1, 2])
    }
  };
}

function createQuadMesh() {
  return {
    geometry: {
      primitive: TrianglesPrimitive,
      aabb: new Float32Array([0, 0, 0, 1, 1, 0]),
      positionsCompressed: new Uint16Array([
        0, 0, 0,
        65535, 0, 0,
        65535, 65535, 0,
        0, 65535, 0
      ]),
      indices: new Uint32Array([
        0, 1, 2,
        0, 2, 3
      ]),
      edgeIndices: new Uint32Array([
        0, 1,
        1, 2,
        2, 3,
        3, 0
      ])
    }
  };
}

function getDebugInternals(batch: TriangleGeometryVBOBatch): DebugTriangleGeometryVBOBatch {
  return batch as unknown as DebugTriangleGeometryVBOBatch;
}

describe("TriangleGeometryVBOBatch RTC precision", () => {

  it("stores and uploads tile-relative positions, not huge world-space translations", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 8,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    const meshIndex = 7;
    const tileIndex = 42;
    const mesh = {
      geometry: {
        primitive: TrianglesPrimitive,
        aabb: new Float32Array([0, 0, 0, 10, 10, 0]),
        positionsCompressed: new Uint16Array([
          0, 0, 0,
          65535, 0, 0,
          0, 65535, 0
        ]),
        indices: new Uint32Array([0, 1, 2])
      }
    };

    const worldMatrix = createMatrix(1_000_000_000, -2_000_000_000, 30_000_000);
    const addResult = batch.addMesh({
      meshIndex,
      sceneMesh: mesh as any,
      tileIndex: 0,
      matrix: worldMatrix,
      color: [255, 255, 255],
      opacity: 255
    });
    expect(addResult.ok).toBe(true);

    batch.setMeshTile(meshIndex, tileIndex);
    batch.setMeshMatrix(meshIndex, createMatrix(0, 0, 0));

    const first = getStoredVertex(batch, meshIndex, 0);
    const second = getStoredVertex(batch, meshIndex, 1);
    expect(getStoredGeometryVertexIndices(batch, meshIndex)).toEqual([0, 1, 2]);

    expect(first).toEqual([0, 0, 0, tileIndex]);
    expect(second[0]).toBeCloseTo(10 * 65535 / 65536, 5);
    expect(second[1]).toBe(0);
    expect(second[2]).toBe(0);
    expect(second[3]).toBe(tileIndex);

    for (const vertex of [first, second]) {
      expect(Math.abs(vertex[0])).toBeLessThan(1_000);
      expect(Math.abs(vertex[1])).toBeLessThan(1_000);
      expect(Math.abs(vertex[2])).toBeLessThan(1_000);
    }

    uploads.length = 0;
    expect(batch.uploadChanges()).toBe(true);

    const positionUpload = uploads.find(upload => upload.type === "Float32Array");
    expect(positionUpload).toBeDefined();
    expect(positionUpload!.data.slice(0, 8)).toEqual([
      0, 0, 0, tileIndex,
      10 * 65535 / 65536, 0, 0, tileIndex
    ]);
    for (let i = 0; i < positionUpload!.data.length; i += 4) {
      expect(Math.abs(positionUpload!.data[i])).toBeLessThan(1_000);
      expect(Math.abs(positionUpload!.data[i + 1])).toBeLessThan(1_000);
      expect(Math.abs(positionUpload!.data[i + 2])).toBeLessThan(1_000);
      expect(positionUpload!.data[i + 3]).toBe(tileIndex);
    }
  });

  it("builds a pick draw state from every visible triangle render-pass partition", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 8,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    expect(batch.addMesh({
      meshIndex: 1,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(0, 0, 0),
      color: [255, 0, 0],
      opacity: 255
    }).ok).toBe(true);

    expect(batch.addMesh({
      meshIndex: 2,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(0, 0, 0),
      color: [0, 255, 0],
      opacity: 255
    }).ok).toBe(true);

    batch.setMeshRenderPass(1, 0, RENDER_PASSES.SELECTED);
    batch.setMeshRenderPass(2, 0, RENDER_PASSES.XRAYED);
    expect(batch.uploadChanges()).toBe(true);

    expect(batch.getDrawState(0, RENDER_PASSES.OPAQUE, "hybrid")).toBeNull();
    const pickState = batch.getPickDrawState(0, "hybrid");
    expect(pickState).not.toBeNull();
    expect(pickState!.firstIndex).toBe(triangleIndexRegionBase(8, TEST_PICK_REGION_INDEX));
    expect(pickState!.indexCount).toBe(6);
    expect(pickState!.primRange).toEqual({firstPrim: 0, numPrims: 2});

    batch.setMeshVisible(2, 0, false);
    expect(batch.uploadChanges()).toBe(true);
    const visiblePickState = batch.getPickDrawState(0, "hybrid");
    expect(visiblePickState).not.toBeNull();
    expect(visiblePickState!.indexCount).toBe(6);
    expect(visiblePickState!.primRange).toEqual({firstPrim: 0, numPrims: 1});
  });

  it("tombstones fixed slots on visibility changes without full index-buffer rebuilds", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 2,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    expect(batch.addMesh({
      meshIndex: 1,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(0, 0, 0),
      color: [255, 0, 0],
      opacity: 255
    }).ok).toBe(true);
    expect(batch.addMesh({
      meshIndex: 2,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(1, 0, 0),
      color: [0, 255, 0],
      opacity: 255
    }).ok).toBe(true);
    expect(batch.uploadChanges()).toBe(true);

    uploads.length = 0;
    batch.setMeshVisible(2, 0, false);
    expect(batch.uploadChanges()).toBe(true);

    const internals = getDebugInternals(batch);
    const pickBase = triangleIndexRegionBase(2, TEST_PICK_REGION_INDEX);
    expect(Array.from(internals._views[0].indices!.subarray(pickBase, pickBase + 6))).toEqual([0, 1, 2, 3, 3, 3]);

    const indexUploads = uploads.filter(upload => upload.target === 0x8893 && upload.type === "Uint32Array");
    expect(indexUploads.length).toBeGreaterThan(0);
    expect(indexUploads.every(upload => upload.data.length <= 6)).toBe(true);
    expect(uploads.some(upload => upload.type === "Float32Array")).toBe(false);
  });

  it("maintains draw-range counts incrementally across pass, visibility and deletion changes", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 8,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    expect(batch.addMesh({
      meshIndex: 1,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(0, 0, 0),
      color: [255, 0, 0],
      opacity: 255
    }).ok).toBe(true);
    expect(batch.addMesh({
      meshIndex: 2,
      sceneMesh: createQuadMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(1, 0, 0),
      color: [0, 255, 0],
      opacity: 255
    }).ok).toBe(true);

    const view = getDebugInternals(batch)._views[0];
    const opaqueIndex = TEST_PASS_ORDER.indexOf(RENDER_PASSES.OPAQUE);
    const selectedIndex = TEST_PASS_ORDER.indexOf(RENDER_PASSES.SELECTED);
    expect(view.passPrimCounts[opaqueIndex]).toBe(3);
    expect(view.edgePassPrimCounts[opaqueIndex]).toBe(4);
    expect(view.pickPrimCount).toBe(3);
    expect(view.pickEdgePrimCount).toBe(4);

    batch.setMeshRenderPass(2, 0, RENDER_PASSES.SELECTED);
    expect(view.passPrimCounts[opaqueIndex]).toBe(1);
    expect(view.passPrimCounts[selectedIndex]).toBe(2);
    expect(view.edgePassPrimCounts[opaqueIndex]).toBe(0);
    expect(view.edgePassPrimCounts[selectedIndex]).toBe(4);
    expect(batch.getRenderPassPrimitiveRange(0, RENDER_PASSES.OPAQUE)).toEqual({firstPrim: 0, numPrims: 1});
    expect(batch.getRenderPassPrimitiveRange(0, RENDER_PASSES.SELECTED)).toEqual({firstPrim: 0, numPrims: 2});

    batch.setMeshVisible(1, 0, false);
    expect(view.passPrimCounts[opaqueIndex]).toBe(0);
    expect(view.passPrimCounts[selectedIndex]).toBe(2);
    expect(view.pickPrimCount).toBe(2);
    expect(view.pickEdgePrimCount).toBe(4);

    batch.removeMesh(2);
    expect(view.passPrimCounts[opaqueIndex]).toBe(0);
    expect(view.passPrimCounts[selectedIndex]).toBe(0);
    expect(view.edgePassPrimCounts[selectedIndex]).toBe(0);
    expect(view.pickPrimCount).toBe(0);
    expect(view.pickEdgePrimCount).toBe(0);
  });

  it("defers draw-range refreshes during bulk mesh add", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 4,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    batch.beginBulkMeshAdd();
    expect(batch.addMesh({
      meshIndex: 1,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(0, 0, 0),
      color: [255, 0, 0],
      opacity: 255
    }).ok).toBe(true);
    expect(batch.addMesh({
      meshIndex: 2,
      sceneMesh: createQuadMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(1, 0, 0),
      color: [0, 255, 0],
      opacity: 255
    }).ok).toBe(true);

    expect(batch.getPickPrimitiveRange(0)).toEqual({firstPrim: 0, numPrims: 0});
    batch.endBulkMeshAdd();

    expect(batch.getPickPrimitiveRange(0)).toEqual({firstPrim: 0, numPrims: 3});
    const state = batch.getPickDrawState(0, "hybrid");
    expect(state).not.toBeNull();
    expect(state!.indexCount).toBe(9);
  });

  it("builds a snap-edge draw state from feature-edge indices", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 8,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    expect(batch.addMesh({
      meshIndex: 3,
      sceneMesh: createQuadMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(0, 0, 0),
      color: [255, 255, 255],
      opacity: 255
    }).ok).toBe(true);

    batch.setMeshRenderPass(3, 0, RENDER_PASSES.SELECTED);
    expect(batch.uploadChanges()).toBe(true);

    const internals = getDebugInternals(batch);
    const record = internals._meshRecords.get(3);
    expect(record).toBeDefined();
    expect(Array.from(record!.edgeVertexIndices)).toEqual([0, 1, 1, 2, 2, 5, 5, 0]);
    const selectedEdgeBase = edgeIndexRegionBase(8, TEST_PASS_ORDER.indexOf(RENDER_PASSES.SELECTED));
    const pickEdgeBase = edgeIndexRegionBase(8, TEST_PICK_REGION_INDEX);
    expect(Array.from(internals._views[0].edgeIndices!.subarray(selectedEdgeBase, selectedEdgeBase + 8))).toEqual([0, 1, 1, 2, 2, 5, 5, 0]);
    expect(Array.from(internals._views[0].edgeIndices!.subarray(pickEdgeBase, pickEdgeBase + 8))).toEqual([0, 1, 1, 2, 2, 5, 5, 0]);

    const edgeState = batch.getPickEdgeDrawState(0, "hybrid");
    expect(edgeState).not.toBeNull();
    expect(edgeState!.firstIndex).toBe(pickEdgeBase);
    expect(edgeState!.indexCount).toBe(12);
    expect(edgeState!.primRange).toEqual({firstPrim: 0, numPrims: 4});
    expect(batch.getPickEdgePrimitiveRange(0)).toEqual({firstPrim: 0, numPrims: 4});
    expect(batch.getEdgeDrawState(0, RENDER_PASSES.OPAQUE, "hybrid")).toBeNull();
    const selectedEdgeState = batch.getEdgeDrawState(0, RENDER_PASSES.SELECTED, "hybrid");
    expect(selectedEdgeState).not.toBeNull();
    expect(selectedEdgeState!.firstIndex).toBe(selectedEdgeBase);
    expect(selectedEdgeState!.indexCount).toBe(12);
    expect(selectedEdgeState!.primRange).toEqual({firstPrim: 0, numPrims: 4});

    batch.setMeshVisible(3, 0, false);
    expect(batch.uploadChanges()).toBe(true);
    expect(batch.getPickEdgeDrawState(0, "hybrid")).toBeNull();
    expect(batch.getEdgeDrawState(0, RENDER_PASSES.SELECTED, "hybrid")).toBeNull();
    expect(batch.getPickEdgePrimitiveRange(0)).toEqual({firstPrim: 0, numPrims: 0});
  });

  it("builds lean-static tile draw states for edge and pick regions", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 8,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    expect(batch.addMesh({
      meshIndex: 4,
      sceneMesh: createQuadMesh() as any,
      tileIndex: 7,
      matrix: createMatrix(0, 0, 0),
      color: [255, 255, 255],
      opacity: 255
    }).ok).toBe(true);

    batch.setMeshRenderPass(4, 0, RENDER_PASSES.SELECTED);
    expect(batch.uploadChanges()).toBe(true);

    const selectedEdgeBase = edgeIndexRegionBase(8, TEST_PASS_ORDER.indexOf(RENDER_PASSES.SELECTED));
    const selectedEdgeTileState = batch.getTileDrawStates(0, RENDER_PASSES.SELECTED, "lean-static", "edges");
    expect(selectedEdgeTileState).not.toBeNull();
    expect(selectedEdgeTileState!.primRange).toEqual({firstPrim: 0, numPrims: 4});
    expect(selectedEdgeTileState!.tileDrawStates).toEqual([{
      tileIndex: 7,
      spans: [{
        firstIndex: selectedEdgeBase,
        indexCount: 8,
        primCount: 4
      }]
    }]);

    const pickTriangleBase = triangleIndexRegionBase(8, TEST_PICK_REGION_INDEX);
    const pickTriangleTileState = batch.getPickTileDrawStates(0, "lean-static", "triangles");
    expect(pickTriangleTileState).not.toBeNull();
    expect(pickTriangleTileState!.primRange).toEqual({firstPrim: 0, numPrims: 2});
    expect(pickTriangleTileState!.tileDrawStates).toEqual([{
      tileIndex: 7,
      spans: [{
        firstIndex: pickTriangleBase,
        indexCount: 6,
        primCount: 2
      }]
    }]);

    const pickEdgeBase = edgeIndexRegionBase(8, TEST_PICK_REGION_INDEX);
    const pickEdgeTileState = batch.getPickTileDrawStates(0, "lean-static", "edges");
    expect(pickEdgeTileState).not.toBeNull();
    expect(pickEdgeTileState!.primRange).toEqual({firstPrim: 0, numPrims: 4});
    expect(pickEdgeTileState!.tileDrawStates).toEqual([{
      tileIndex: 7,
      spans: [{
        firstIndex: pickEdgeBase,
        indexCount: 8,
        primCount: 4
      }]
    }]);
  });

  it("reuses a deleted mesh vertex span without reallocating the fixed VBO", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 2,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    expect(batch.addMesh({
      meshIndex: 1,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(0, 0, 0),
      color: [255, 0, 0],
      opacity: 255
    }).ok).toBe(true);
    expect(batch.addMesh({
      meshIndex: 2,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(1, 0, 0),
      color: [0, 255, 0],
      opacity: 255
    }).ok).toBe(true);
    expect(batch.canAddMesh(createTriangleMesh() as any)).toBe(false);

    const internals = getDebugInternals(batch);
    expect(internals._meshRecords.get(1)!.vertexBase).toBe(0);
    expect(internals._meshRecords.get(2)!.vertexBase).toBe(3);
    expect(internals._nextVertex).toBe(6);

    batch.removeMesh(1);
    expect(batch.canAddMesh(createTriangleMesh() as any)).toBe(true);
    expect(internals._freeVertexSpans).toEqual([{base: 0, count: 3}]);

    expect(batch.addMesh({
      meshIndex: 3,
      sceneMesh: createTriangleMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(2, 0, 0),
      color: [0, 0, 255],
      opacity: 255
    }).ok).toBe(true);

    expect(internals._meshRecords.get(3)!.vertexBase).toBe(0);
    expect(internals._nextVertex).toBe(6);
    expect(internals._freeVertexSpans).toEqual([]);
    expect(batch.uploadChanges()).toBe(true);
    const pickState = batch.getPickDrawState(0, "hybrid");
    expect(pickState).not.toBeNull();
    expect(pickState!.indexCount).toBe(6);
    expect(pickState!.primRange).toEqual({firstPrim: 0, numPrims: 2});
  });

  it("coalesces deleted spans and trims the high-water cursor at the tail", () => {
    const uploads: RecordedUpload[] = [];
    const gl = createMockGL(uploads);
    const batch = new TriangleGeometryVBOBatch({
      gl,
      batchIndex: 0,
      maxPrims: 3,
      maxViews: 1
    });
    expect(batch.allocate().ok).toBe(true);

    for (const meshIndex of [1, 2, 3]) {
      expect(batch.addMesh({
        meshIndex,
        sceneMesh: createTriangleMesh() as any,
        tileIndex: 0,
        matrix: createMatrix(meshIndex, 0, 0),
        color: [255, 255, 255],
        opacity: 255
      }).ok).toBe(true);
    }

    const internals = getDebugInternals(batch);
    expect(internals._nextVertex).toBe(9);

    batch.removeMesh(2);
    expect(internals._nextVertex).toBe(9);
    expect(internals._freeVertexSpans).toEqual([{base: 3, count: 3}]);

    batch.removeMesh(3);
    expect(internals._nextVertex).toBe(3);
    expect(internals._freeVertexSpans).toEqual([]);

    expect(batch.canAddMesh(createQuadMesh() as any)).toBe(true);
    expect(batch.addMesh({
      meshIndex: 4,
      sceneMesh: createQuadMesh() as any,
      tileIndex: 0,
      matrix: createMatrix(4, 0, 0),
      color: [255, 255, 255],
      opacity: 255
    }).ok).toBe(true);
    expect(internals._meshRecords.get(4)!.vertexBase).toBe(3);
    expect(internals._nextVertex).toBe(9);
  });
});
