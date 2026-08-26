import {LinesPrimitive, TrianglesPrimitive} from "../../../../../../base/constants";
import type {SceneMesh, SceneModelLifecycle, SceneModelMemoryPolicy, SceneModelUpdateHint} from "../../../../../../model/scene";
import {GPUMemoryCheckResult} from "../../gpuMemoryManager";
import {MeshManager} from "../MeshManager";

function createManager(memoryConfigs: any = {}) {
  let nextBatchIndex = 0;
  const gpuMemoryManager = {
    createBatch: jest.fn(() => ({ok: true, value: nextBatchIndex++})),
    hasMemoryForMesh: jest.fn(() => GPUMemoryCheckResult.OK),
  };

  const manager = new MeshManager({memoryConfigs} as any, gpuMemoryManager as any);

  return {manager, gpuMemoryManager};
}

function createMesh({
  primitive,
  normals = false,
  uvs = false,
  bin,
  updateHint,
  lifecycle,
  memoryPolicy,
  modelId,
  batchId,
  billboard,
}: {
  primitive: number;
  normals?: boolean;
  uvs?: boolean;
  bin?: string;
  updateHint?: SceneModelUpdateHint;
  lifecycle?: SceneModelLifecycle;
  memoryPolicy?: SceneModelMemoryPolicy;
  modelId?: string;
  batchId?: string;
  billboard?: "none" | "spherical";
}): SceneMesh {
  return {
    model: {
      id: modelId,
      updateHint,
      lifecycle,
      memoryPolicy,
    },
    geometry: {
      primitive,
      normalsCompressed: normals ? new Int8Array(3) : undefined,
      uvsCompressed: uvs ? new Uint16Array(2) : undefined,
    },
    bin,
    batchId,
    billboard: billboard ?? "none",
  } as unknown as SceneMesh;
}

describe("MeshManager batch lookup", () => {
  test("scans only compatible batch buckets", () => {
    const {manager, gpuMemoryManager} = createManager();
    const getMeshBatch = (manager as any)._getMeshBatch.bind(manager);

    manager.enableStepStats(true);

    expect(getMeshBatch(createMesh({primitive: LinesPrimitive})).ok).toBe(true);
    expect(getMeshBatch(createMesh({primitive: TrianglesPrimitive, normals: true})).ok).toBe(true);
    expect(getMeshBatch(createMesh({primitive: TrianglesPrimitive, bin: "overlay"})).ok).toBe(true);
    expect(getMeshBatch(createMesh({primitive: TrianglesPrimitive})).ok).toBe(true);

    manager.resetStepStats();
    gpuMemoryManager.hasMemoryForMesh.mockClear();

    const result = getMeshBatch(createMesh({primitive: TrianglesPrimitive}));

    expect(result.ok).toBe(true);
    expect(gpuMemoryManager.createBatch).toHaveBeenCalledTimes(4);
    expect(gpuMemoryManager.hasMemoryForMesh).toHaveBeenCalledTimes(1);
    expect(manager.getStepStats()).toMatchObject({
      batchScanIters: 1,
      newBatches: 0,
    });
  });

  test("uses static SceneModel updateHint for VBO triangle geometry storage", () => {
    const {manager, gpuMemoryManager} = createManager();
    const getMeshBatch = (manager as any)._getMeshBatch.bind(manager);

    expect(getMeshBatch(createMesh({primitive: TrianglesPrimitive, updateHint: "static"})).ok).toBe(true);
    expect(gpuMemoryManager.createBatch).toHaveBeenLastCalledWith(expect.objectContaining({
      primitive: TrianglesPrimitive,
      geometryStorage: "vbo"
    }));

    expect(getMeshBatch(createMesh({primitive: LinesPrimitive})).ok).toBe(true);
    expect(gpuMemoryManager.createBatch).toHaveBeenLastCalledWith(expect.objectContaining({
      primitive: LinesPrimitive,
      geometryStorage: "dtx"
    }));
  });

  test("uses DTX triangle geometry storage for billboarded static triangle meshes", () => {
    const {manager, gpuMemoryManager} = createManager();
    const getMeshBatch = (manager as any)._getMeshBatch.bind(manager);

    expect(getMeshBatch(createMesh({
      primitive: TrianglesPrimitive,
      updateHint: "static",
      billboard: "spherical"
    })).ok).toBe(true);
    expect(gpuMemoryManager.createBatch).toHaveBeenLastCalledWith(expect.objectContaining({
      primitive: TrianglesPrimitive,
      geometryStorage: "dtx"
    }));
  });

  test("uses dynamic SceneModel updateHint for DTX triangle geometry storage", () => {
    const {manager, gpuMemoryManager} = createManager();
    const getMeshBatch = (manager as any)._getMeshBatch.bind(manager);

    expect(getMeshBatch(createMesh({primitive: TrianglesPrimitive, updateHint: "dynamic"})).ok).toBe(true);
    expect(gpuMemoryManager.createBatch).toHaveBeenLastCalledWith(expect.objectContaining({
      primitive: TrianglesPrimitive,
      geometryStorage: "dtx"
    }));
  });

  test("uses DTX triangle geometry storage for auto or missing SceneModel updateHint", () => {
    const {manager, gpuMemoryManager} = createManager();
    const getMeshBatch = (manager as any)._getMeshBatch.bind(manager);

    expect(getMeshBatch(createMesh({primitive: TrianglesPrimitive, updateHint: "auto"})).ok).toBe(true);
    expect(gpuMemoryManager.createBatch).toHaveBeenLastCalledWith(expect.objectContaining({
      primitive: TrianglesPrimitive,
      geometryStorage: "dtx"
    }));

    expect(getMeshBatch(createMesh({primitive: TrianglesPrimitive, updateHint: undefined})).ok).toBe(true);
    expect(gpuMemoryManager.createBatch).toHaveBeenLastCalledWith(expect.objectContaining({
      primitive: TrianglesPrimitive,
      geometryStorage: "dtx"
    }));
  });

  test("does not split compatible renderer batches by SceneModel batch ID", () => {
    const {manager, gpuMemoryManager} = createManager();
    const getMeshBatch = (manager as any)._getMeshBatch.bind(manager);
    const base = {
      primitive: TrianglesPrimitive,
      lifecycle: "streaming" as const,
      memoryPolicy: "compact" as const,
      modelId: "stream-model"
    };

    expect(getMeshBatch(createMesh({...base, batchId: "chunk-a"})).ok).toBe(true);
    expect(getMeshBatch(createMesh({...base, batchId: "chunk-b"})).ok).toBe(true);

    expect(gpuMemoryManager.createBatch).toHaveBeenCalledTimes(1);
    expect(gpuMemoryManager.createBatch).toHaveBeenLastCalledWith(expect.objectContaining({
      allocationKind: "sealedBatch",
      sceneModelId: "stream-model"
    }));
    expect(gpuMemoryManager.createBatch.mock.calls[0][0]).not.toHaveProperty("sceneBatchId");
  });
});
