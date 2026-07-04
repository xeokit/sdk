import {RendererMesh} from "../RendererMesh";

function createIdentityMatrix(): Float64Array {
  return new Float64Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}

function createRendererMesh(maxViews: number) {
  const meshHandle = {batchIndex: 0, meshIndex: 0};
  const meshBatch = {
    removeMesh: jest.fn(),
    setMeshMatrix: jest.fn(),
    setMeshOpacityInView: jest.fn(),
    setMeshTile: jest.fn(),
    setMeshTransparent: jest.fn(),
    setMeshVisible: jest.fn(),
  };
  const gpuTile = {id: "tile-0", tileIndex: 0, center: [0, 0, 0]};
  const gpuMemoryManager = {
    getTile: jest.fn(() => gpuTile),
    moveTile: jest.fn(() => gpuTile),
    putTile: jest.fn(),
  };

  const rendererMesh = new RendererMesh({
    sceneMesh: {
      effectiveColor: [1, 1, 1],
      effectiveOpacity: 1,
      worldMatrix: createIdentityMatrix(),
    } as any,
    meshBatch: meshBatch as any,
    renderContext: {memoryConfigs: {maxViews}} as any,
    gpuMemoryManager: gpuMemoryManager as any,
    meshHandle: meshHandle as any,
  });

  jest.clearAllMocks();

  return {rendererMesh, meshBatch, meshHandle};
}

describe("RendererMesh view flags", () => {
  test("stores the default single-view flags inline", () => {
    const {rendererMesh, meshBatch, meshHandle} = createRendererMesh(1);

    expect((rendererMesh as any)._viewFlags).toBeNull();

    rendererMesh.setObjectVisible(0, false);

    expect(meshBatch.setMeshVisible).toHaveBeenCalledWith(0, meshHandle, false);
  });

  test("allocates a typed flag array only for multiple views", () => {
    const {rendererMesh} = createRendererMesh(2);

    expect((rendererMesh as any)._viewFlags).toBeInstanceOf(Uint8Array);
    expect((rendererMesh as any)._viewFlags).toHaveLength(2);
  });
});
