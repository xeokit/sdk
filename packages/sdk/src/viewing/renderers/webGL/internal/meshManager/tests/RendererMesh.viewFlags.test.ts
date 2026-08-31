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
    setMeshColorInView: jest.fn(),
    setMeshOpacityInView: jest.fn(),
    setMeshPlacement: jest.fn(),
    setMeshStyleBin: jest.fn(),
    setMeshStyleBinEdges: jest.fn(),
    setMeshStyleBinClearDepthBefore: jest.fn(),
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

  test("style-bin color and opacity stay on the normal render-pass route", () => {
    const {rendererMesh, meshBatch, meshHandle} = createRendererMesh(1);

    rendererMesh.setStyleBin(0, [0.25, 0.5, 1], 1, true, true);

    expect(meshBatch.setMeshColorInView).toHaveBeenCalledWith(0, meshHandle, [63, 127, 255]);
    expect(meshBatch.setMeshOpacityInView).toHaveBeenCalledWith(0, meshHandle, 1);
    expect(meshBatch.setMeshStyleBinEdges).toHaveBeenCalledWith(0, meshHandle, true);
    expect(meshBatch.setMeshStyleBinClearDepthBefore).toHaveBeenCalledWith(0, meshHandle, true);
    expect(meshBatch.setMeshTransparent).toHaveBeenCalledWith(0, meshHandle, false);
    expect(meshBatch.setMeshStyleBin).not.toHaveBeenCalled();
  });

  test("transparent style-bin opacity uses the normal transparent route", () => {
    const {rendererMesh, meshBatch, meshHandle} = createRendererMesh(1);

    rendererMesh.setStyleBin(0, [1, 0.5, 0.25], 0.4, false, false);

    expect(meshBatch.setMeshOpacityInView).toHaveBeenCalledWith(0, meshHandle, 0.4);
    expect(meshBatch.setMeshStyleBinEdges).toHaveBeenCalledWith(0, meshHandle, false);
    expect(meshBatch.setMeshStyleBinClearDepthBefore).toHaveBeenCalledWith(0, meshHandle, false);
    expect(meshBatch.setMeshTransparent).toHaveBeenCalledWith(0, meshHandle, true);
    expect(meshBatch.setMeshStyleBin).not.toHaveBeenCalled();
  });

  test("clearing a style bin restores the saved base transparent route", () => {
    const {rendererMesh, meshBatch, meshHandle} = createRendererMesh(1);

    rendererMesh.setOpacity(0.5);
    jest.clearAllMocks();

    rendererMesh.setStyleBin(0, [0.25, 0.5, 1], 1, true, true);
    rendererMesh.clearStyleBin(0);

    expect(meshBatch.setMeshStyleBinClearDepthBefore).toHaveBeenLastCalledWith(0, meshHandle, false);
    expect(meshBatch.setMeshTransparent).toHaveBeenLastCalledWith(0, meshHandle, true);
  });
});
