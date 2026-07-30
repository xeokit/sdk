import type {DataTextures, RendererGPUResources} from "../RendererGPUResources";

function acceptsRendererGPUResources(_resources: RendererGPUResources): void {
}

function acceptsDataTextures(_resources: DataTextures): void {
}

describe("RendererGPUResources compatibility", () => {

  it("keeps DataTextures as an assignable compatibility name", () => {
    const rendererResources = {
      numTiles: 0,
      viewTileCameraMatrixTexture: [],
      viewTilePickMatrixTexture: [],
      batches: [],
      onBatchCreated: {} as any
    } satisfies RendererGPUResources;

    const compatResources: DataTextures = rendererResources;
    const roundTripResources: RendererGPUResources = compatResources;

    acceptsDataTextures(roundTripResources);
    acceptsRendererGPUResources(compatResources);
    expect(roundTripResources).toBe(rendererResources);
  });
});
