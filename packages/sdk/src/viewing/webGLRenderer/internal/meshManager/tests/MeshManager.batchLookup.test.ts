import {LinesPrimitive, TrianglesPrimitive} from "../../../../../base/constants";
import type {SceneMesh} from "../../../../../model/scene";
import {GPUMemoryCheckResult} from "../../gpuMemoryManager";
import {MeshManager} from "../MeshManager";

function createManager() {
  let nextBatchIndex = 0;
  const gpuMemoryManager = {
    createBatch: jest.fn(() => ({ok: true, value: nextBatchIndex++})),
    hasMemoryForMesh: jest.fn(() => GPUMemoryCheckResult.OK),
  };

  const manager = new MeshManager({} as any, gpuMemoryManager as any);

  return {manager, gpuMemoryManager};
}

function createMesh({
  primitive,
  normals = false,
  uvs = false,
  bin,
}: {
  primitive: number;
  normals?: boolean;
  uvs?: boolean;
  bin?: string;
}): SceneMesh {
  return {
    geometry: {
      primitive,
      normalsCompressed: normals ? new Int8Array(3) : undefined,
      uvsCompressed: uvs ? new Uint16Array(2) : undefined,
    },
    bin,
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
});
