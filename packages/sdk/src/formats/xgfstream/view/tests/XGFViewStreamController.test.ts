import {XGFViewStreamController} from "../XGFViewStreamController";
import type {XGFChunkManifest} from "../../chunk/XGFChunkManifest";

function chunk(id: string, aabb: number[]): XGFChunkManifest {
  return {
    format: "XGF",
    manifestVersion: "1.0.0",
    xgfVersion: "2.0.0",
    id,
    uri: `${id}.xgf`,
    role: "referencesOnly",
    aabb,
    dependencies: {chunks: [], geometries: [], materials: [], textures: []},
    assets: {geometries: [], materials: [], textures: []},
    counts: {
      transforms: 0,
      geometries: 0,
      materials: 0,
      textures: 0,
      objects: 1,
      meshes: 2
    }
  };
}

function controller(chunks: XGFChunkManifest[]): XGFViewStreamController {
  return new XGFViewStreamController({
    index: {chunks} as any,
    sceneModel: {} as any,
    view: {
      camera: {
        look: [0, 0, 0],
        frustum: {
          planes: [{
            normal: [1, 0, 0],
            offset: 0,
            testVertex: [1, 0, 0]
          }]
        }
      }
    } as any
  });
}

describe("XGFViewStreamController", () => {

  it("prioritizes visible chunks by squared distance without mutating chunkManifests", () => {
    const farVisible = chunk("farVisible", [100, 0, 0, 101, 1, 1]);
    const nearOutside = chunk("nearOutside", [-2, 0, 0, -1, 1, 1]);
    const nearVisible = chunk("nearVisible", [1, 0, 0, 2, 1, 1]);
    const streamController = controller([farVisible, nearOutside, nearVisible]);

    const sorted = streamController.prioritizeChunks();

    expect(sorted.map((manifest) => manifest.id)).toEqual([
      "nearVisible",
      "farVisible",
      "nearOutside"
    ]);
    expect(streamController.chunkManifests.map((manifest) => manifest.id)).toEqual([
      "farVisible",
      "nearOutside",
      "nearVisible"
    ]);
  });

  it("prioritizes visible chunks by squared distance to the camera look point by default", () => {
    const nearLook = chunk("nearLook", [1, 0, 0, 2, 1, 1]);
    const nearEye = chunk("nearEye", [98, 0, 0, 99, 1, 1]);
    const streamController = new XGFViewStreamController({
      index: {chunks: [nearLook, nearEye]} as any,
      sceneModel: {} as any,
      view: {
        camera: {
          look: [0, 0, 0],
          eye: [100, 0, 0],
          frustum: frustum([1, 0, 0], 0, [1, 0, 0])
        }
      } as any
    });

    expect(streamController.prioritizeChunks().map((manifest) => manifest.id)).toEqual([
      "nearLook",
      "nearEye"
    ]);
  });

  it("can prioritize visible chunks by squared distance to the camera eye", () => {
    const nearLook = chunk("nearLook", [1, 0, 0, 2, 1, 1]);
    const nearEye = chunk("nearEye", [98, 0, 0, 99, 1, 1]);
    const streamController = new XGFViewStreamController({
      index: {chunks: [nearLook, nearEye]} as any,
      sceneModel: {} as any,
      view: {
        camera: {
          look: [0, 0, 0],
          eye: [100, 0, 0],
          frustum: frustum([1, 0, 0], 0, [1, 0, 0])
        }
      } as any,
      chunkPriorityTarget: "eye"
    });

    expect(streamController.prioritizeChunks().map((manifest) => manifest.id)).toEqual([
      "nearEye",
      "nearLook"
    ]);
  });

  it("loads global streaming candidates in current-view nearest-neighbour order", async () => {
    const visibleFar = chunk("visibleFar", [50, 0, 0, 51, 1, 1]);
    const invisibleNear = chunk("invisibleNear", [-5, 0, 0, -4, 1, 1]);
    const visibleNear = chunk("visibleNear", [1, 0, 0, 2, 1, 1]);
    const invisibleFar = chunk("invisibleFar", [-100, 0, 0, -99, 1, 1]);
    const loaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [visibleFar, invisibleNear, visibleNear, invisibleFar]} as any,
      sceneModel: {} as any,
      view: viewWithFrustum([1, 0, 0], 0, [1, 0, 0]),
      loader: {
        loadChunk: async (_params: any, options: any) => {
          loaded.push(_params.manifest.id);
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 4,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      frustumOnly: false,
      chunkPriorityTarget: "look",
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("global stream");
    await wait(20);

    expect(loaded).toEqual([
      "visibleNear",
      "visibleFar",
      "invisibleNear",
      "invisibleFar"
    ]);
  });

  it("batches per-chunk progress callbacks when a progress cadence is configured", async () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const second = chunk("second", [3, 0, 0, 4, 1, 1]);
    const third = chunk("third", [5, 0, 0, 6, 1, 1]);
    const progress: number[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [first, second, third]} as any,
      sceneModel: {} as any,
      view: viewWithFrustum([1, 0, 0], 0, [1, 0, 0]),
      loader: {
        loadChunk: async (_params: any, options: any) => {
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 3,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      progressCadenceMs: 1000,
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any,
      onProgress: (value) => {
        progress.push(value.loaded);
      }
    });

    streamController.schedule("batched progress");
    await wait(20);

    expect(progress).toEqual([0, 3]);
  });

  it("caps streaming frustum depth from the eye-to-look distance", async () => {
    const near = chunk("near", [8, -1, -1, 9, 1, 1]);
    const far = chunk("far", [50, -1, -1, 51, 1, 1]);
    const loaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [near, far]} as any,
      sceneModel: {} as any,
      view: {
        camera: {
          eye: [0, 0, 0],
          look: [10, 0, 0],
          frustum: frustum([1, 0, 0], 0, [1, 0, 0])
        }
      } as any,
      loader: {
        loadChunk: async (_params: any, options: any) => {
          loaded.push(_params.manifest.id);
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 4,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      frustumDepthMultiplier: 2,
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("current frustum");
    await wait(20);

    expect(loaded).toEqual(["near"]);
  });

  it("uses a minimum streaming frustum depth for close-focus views", async () => {
    const near = chunk("near", [8, -1, -1, 9, 1, 1]);
    const context = chunk("context", [48, -1, -1, 49, 1, 1]);
    const far = chunk("far", [120, -1, -1, 121, 1, 1]);
    const loaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [near, context, far]} as any,
      sceneModel: {} as any,
      view: {
        camera: {
          eye: [0, 0, 0],
          look: [10, 0, 0],
          frustum: frustum([1, 0, 0], 0, [1, 0, 0])
        }
      } as any,
      loader: {
        loadChunk: async (_params: any, options: any) => {
          loaded.push(_params.manifest.id);
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 4,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      frustumDepthMultiplier: 2,
      frustumMinDepth: 50,
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("current frustum");
    await wait(20);

    expect(loaded).toEqual(["near", "context"]);
  });

  it("skips chunks below the minimum projected canvas size", async () => {
    const tiny = chunk("tiny", [0, 0, 0, 0.1, 0.1, 0.1]);
    const visible = chunk("visible", [0.2, 0, 0, 0.6, 0.4, 0.1]);
    const loaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [tiny, visible]} as any,
      sceneModel: {} as any,
      view: viewWithProjection(100, 100),
      loader: {
        loadChunk: async (_params: any, options: any) => {
          loaded.push(_params.manifest.id);
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 4,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      minProjectedChunkSizePixels: 10,
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("current view");
    await wait(20);

    expect(loaded).toEqual(["visible"]);
    expect(streamController.queueProgress.queued).toBe(1);
  });

  it("continues into a pending frustum generation after the current queue drains", async () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const second = chunk("second", [-3, 0, 0, -2, 1, 1]);
    const view = viewWithFrustum([1, 0, 0], 0, [1, 0, 0]);
    const loaded: string[] = [];
    let moved = false;
    const streamController = new XGFViewStreamController({
      index: {chunks: [first, second]} as any,
      sceneModel: {} as any,
      view,
      loader: {
        loadChunk: async (_params: any, options: any) => {
          loaded.push(_params.manifest.id);
          if (!moved) {
            moved = true;
            view.camera.frustum = frustum([-1, 0, 0], 0, [0, 0, 0]);
            streamController.schedule("moved frustum");
          }
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("initial frustum");
    await wait(50);

    expect(loaded).toEqual(["first", "second"]);
  });

  it("does not replace a newer camera queue with an older running generation", () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const second = chunk("second", [-3, 0, 0, -2, 1, 1]);
    const view = viewWithFrustum([1, 0, 0], 0, [1, 0, 0]);
    const streamController = new XGFViewStreamController({
      index: {chunks: [first, second]} as any,
      sceneModel: {} as any,
      view,
      loader: mockLoader(),
      cameraDebounceMs: 100000,
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("initial frustum");
    view.camera.frustum = frustum([-1, 0, 0], 0, [0, 0, 0]);
    streamController.schedule("moved frustum");
    (streamController as any).ensureCandidateQueue(1);

    expect((streamController as any)._candidateQueue.generation).toBe(2);
    expect((streamController as any)._candidateQueue.chunks.map((manifest: XGFChunkManifest) => manifest.id)).toEqual(["second"]);
    streamController.pause();
  });

  it("evicts least-recently-used resident chunks when enabled", async () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const second = chunk("second", [-3, 0, 0, -2, 1, 1]);
    const view = {
      camera: {
        look: [0, 0, 0],
        frustum: {
          planes: [{
            normal: [1, 0, 0],
            offset: 0,
            testVertex: [1, 0, 0]
          }]
        }
      }
    } as any;
    const unloaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [first, second]} as any,
      sceneModel: {} as any,
      view,
      loader: {
        loadChunk: async (_params: any, options: any) => {
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: ({chunkId}: any) => {
          unloaded.push(chunkId);
          return {ok: true, value: undefined};
        }
      } as any,
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any,
      enableLRUEviction: true,
      maxResidentChunks: 1
    });

    streamController.schedule("first");
    await wait(10);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["first"]);
    expect(streamController.loadedTotals).toEqual({objects: 1, meshes: 2});

    view.camera.frustum = {
      planes: [{
        normal: [-1, 0, 0],
        offset: 0,
        testVertex: [0, 0, 0]
      }]
    };
    streamController.schedule("second");
    await wait(10);

    expect(unloaded).toEqual(["first"]);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["second"]);
    expect(streamController.loadedTotals).toEqual({objects: 1, meshes: 2});
  });

  it("pauses and resumes scheduled streaming", async () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const streamController = new XGFViewStreamController({
      index: {chunks: [first]} as any,
      sceneModel: {} as any,
      view: viewWithFrustum([1, 0, 0], 0, [1, 0, 0]),
      loader: mockLoader(),
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      loadOptions: {
        getFileData: () => new ArrayBuffer(8)
      } as any
    });

    streamController.pause();
    streamController.schedule("paused");
    await wait(10);
    expect(streamController.paused).toBe(true);
    expect(Array.from(streamController.loadedChunkIds)).toEqual([]);

    streamController.resume("resumed");
    await wait(10);
    expect(streamController.paused).toBe(false);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["first"]);
  });

  it("unloads all resident streamed chunks and continues streaming", async () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const second = chunk("second", [3, 0, 0, 4, 1, 1]);
    const unloaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [first, second]} as any,
      sceneModel: {} as any,
      view: viewWithFrustum([1, 0, 0], 0, [1, 0, 0]),
      loader: {
        loadChunk: async (_params: any, options: any) => {
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: ({chunkId}: any) => {
          unloaded.push(chunkId);
          return {ok: true, value: undefined};
        }
      } as any,
      batchSize: 2,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      loadOptions: {
        getFileData: () => new ArrayBuffer(8)
      } as any
    });

    streamController.schedule("load");
    await wait(10);
    expect(streamController.loadedTotals).toEqual({objects: 2, meshes: 4});

    expect(streamController.unloadAllChunks()).toBe(2);
    expect(streamController.paused).toBe(false);
    expect(unloaded).toEqual(["first", "second"]);
    expect(Array.from(streamController.loadedChunkIds)).toEqual([]);
    expect(streamController.loadedTotals).toEqual({objects: 0, meshes: 0});

    await wait(10);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["first", "second"]);
    expect(streamController.loadedTotals).toEqual({objects: 2, meshes: 4});
  });

  it("unloads resident chunks outside the current frustum and keeps visible chunks", async () => {
    const visible = chunk("visible", [1, 0, 0, 2, 1, 1]);
    const invisible = chunk("invisible", [-3, 0, 0, -2, 1, 1]);
    const view = viewWithFrustum([1, 0, 0], 10, [1, 0, 0]);
    const unloaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {chunks: [visible, invisible]} as any,
      sceneModel: {} as any,
      view,
      loader: {
        loadChunk: async (_params: any, options: any) => {
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: ({chunkId}: any) => {
          unloaded.push(chunkId);
          return {ok: true, value: undefined};
        }
      } as any,
      batchSize: 2,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      loadOptions: {
        getFileData: () => new ArrayBuffer(8)
      } as any
    });

    streamController.schedule("load both");
    await wait(10);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["visible", "invisible"]);

    view.camera.frustum = frustum([1, 0, 0], 0, [1, 0, 0]);
    expect(streamController.unloadInvisibleChunks()).toBe(1);

    expect(unloaded).toEqual(["invisible"]);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["visible"]);
    expect(streamController.loadedTotals).toEqual({objects: 1, meshes: 2});
  });

  it("reuses cached XGF file data after chunk eviction", async () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const second = chunk("second", [-3, 0, 0, -2, 1, 1]);
    const view = viewWithFrustum([1, 0, 0], 0, [1, 0, 0]);
    const fetchCounts = new Map<string, number>();
    const streamController = new XGFViewStreamController({
      index: {chunks: [first, second]} as any,
      sceneModel: {} as any,
      view,
      loader: mockLoader(),
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      loadOptions: {
        getFileData: (manifest) => {
          fetchCounts.set(manifest.id, (fetchCounts.get(manifest.id) || 0) + 1);
          return new ArrayBuffer(8);
        }
      } as any,
      enableLRUEviction: true,
      maxResidentChunks: 1,
      cacheFileData: true
    });

    streamController.schedule("first");
    await wait(10);
    view.camera.frustum = frustum([-1, 0, 0], 0, [0, 0, 0]);
    streamController.schedule("second");
    await wait(10);
    view.camera.frustum = frustum([1, 0, 0], 0, [1, 0, 0]);
    streamController.schedule("first again");
    await wait(10);

    expect(fetchCounts.get("first")).toBe(1);
    expect(fetchCounts.get("second")).toBe(1);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["first"]);
  });

  it("honors the cached XGF file byte budget", async () => {
    const first = chunk("first", [1, 0, 0, 2, 1, 1]);
    const second = chunk("second", [-3, 0, 0, -2, 1, 1]);
    const view = viewWithFrustum([1, 0, 0], 0, [1, 0, 0]);
    const fetchCounts = new Map<string, number>();
    const streamController = new XGFViewStreamController({
      index: {chunks: [first, second]} as any,
      sceneModel: {} as any,
      view,
      loader: mockLoader(),
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      loadOptions: {
        getFileData: (manifest) => {
          fetchCounts.set(manifest.id, (fetchCounts.get(manifest.id) || 0) + 1);
          return new ArrayBuffer(8);
        }
      } as any,
      enableLRUEviction: true,
      maxResidentChunks: 1,
      cacheFileData: true,
      maxCachedFileBytes: 8
    });

    streamController.schedule("first");
    await wait(10);
    view.camera.frustum = frustum([-1, 0, 0], 0, [0, 0, 0]);
    streamController.schedule("second");
    await wait(10);
    view.camera.frustum = frustum([1, 0, 0], 0, [1, 0, 0]);
    streamController.schedule("first again");
    await wait(10);

    expect(fetchCounts.get("first")).toBe(2);
    expect(fetchCounts.get("second")).toBe(1);
    expect(Array.from(streamController.loadedChunkIds)).toEqual(["first"]);
  });

  it("activates child stream chunks only when the child stream AABB is visible", async () => {
    const childChunk = chunk("childChunk", [10, 0, 0, 11, 1, 1]);
    const view = viewWithFrustum([1, 0, 0], 0, [1, 0, 0]);
    let childIndexReads = 0;
    const loaded: string[] = [];
    const streamController = new XGFViewStreamController({
      index: {
        format: "XGFStreamingIndex",
        indexVersion: "1.1.0",
        chunks: [],
        streams: [{
          id: "child",
          uri: "child/index.runtime.json",
          aabb: [110, 0, 0, 111, 1, 1],
          origin: [100, 0, 0]
        }]
      },
      streamIndexBaseURI: "https://example.com/root/index.runtime.json",
      sceneModel: {} as any,
      view,
      loader: {
        loadChunk: async (_params: any, options: any) => {
          loaded.push(_params.manifest.id);
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      unloadInactiveStreams: true,
      getStreamIndex: () => {
        childIndexReads++;
        return {
          format: "XGFStreamingIndex",
          indexVersion: "1.0.0",
          chunks: [childChunk]
        };
      },
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    view.camera.frustum = frustum([-1, 0, 0], -20, [0, 0, 0]);
    streamController.schedule("outside child");
    await wait(10);
    expect(childIndexReads).toBe(0);
    expect(streamController.chunkManifests).toEqual([]);

    view.camera.frustum = frustum([1, 0, 0], -100, [1, 0, 0]);
    streamController.schedule("inside child");
    await wait(50);

    expect(childIndexReads).toBe(1);
    expect(streamController.chunkManifests.map((manifest) => manifest.id)).toEqual(["child::childChunk"]);
    expect(streamController.chunkManifests[0].uri).toBe("https://example.com/root/child/childChunk.xgf");
    expect(streamController.chunkManifests[0].aabb).toEqual([110, 0, 0, 111, 1, 1]);
    expect(loaded).toEqual(["child::childChunk"]);

    view.camera.frustum = frustum([-1, 0, 0], -20, [0, 0, 0]);
    streamController.schedule("outside child again");
    await wait(20);
    expect(streamController.chunkManifests).toEqual([]);
    expect(Array.from(streamController.loadedChunkIds)).toEqual([]);
  });

  it("does not activate child streams below the minimum projected canvas size", async () => {
    const childChunk = chunk("childChunk", [0, 0, 0, 0.1, 0.1, 0.1]);
    let childIndexReads = 0;
    const streamController = new XGFViewStreamController({
      index: {
        format: "XGFStreamingIndex",
        indexVersion: "1.1.0",
        chunks: [],
        streams: [{
          id: "child",
          uri: "child/index.runtime.json",
          aabb: [0, 0, 0, 0.1, 0.1, 0.1]
        }]
      },
      sceneModel: {} as any,
      view: viewWithProjection(100, 100),
      loader: mockLoader(),
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      minProjectedChunkSizePixels: 10,
      getStreamIndex: () => {
        childIndexReads++;
        return {
          format: "XGFStreamingIndex",
          indexVersion: "1.0.0",
          chunks: [childChunk]
        };
      },
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("tiny child");
    await wait(20);

    expect(childIndexReads).toBe(0);
    expect(streamController.chunkManifests).toEqual([]);
  });

  it("transforms child stream chunk AABBs from child coordinate system into the target scene", async () => {
    const childChunk = chunk("childChunk", [0, 0, 0, 1, 10, 1]);
    const view = viewWithFrustum([1, 0, 0], -100, [1, 0, 0]);
    const streamController = new XGFViewStreamController({
      index: {
        format: "XGFStreamingIndex",
        indexVersion: "1.1.0",
        coordinateSystem: {
          basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1
        },
        chunks: [],
        streams: [{
          id: "child",
          uri: "child/index.runtime.json",
          aabb: [100, 0, 0, 101, 1, 10],
          origin: [100, 0, 0]
        }]
      },
      streamIndexBaseURI: "https://example.com/root/index.runtime.json",
      sceneModel: {
        coordinateSystem: {
          basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1
        }
      } as any,
      view,
      loader: mockLoader(),
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      getStreamIndex: () => ({
        format: "XGFStreamingIndex",
        indexVersion: "1.2.0",
        coordinateSystem: {
          basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1
        },
        chunks: [childChunk]
      }),
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("inside child");
    await wait(50);

    expect(streamController.chunkManifests.map((manifest) => manifest.id)).toEqual(["child::childChunk"]);
    expect(streamController.chunkManifests[0].aabb).toEqual([100, 0, 0, 101, 1, 10]);
  });

  it("uses child stream coordinate system when expanding child streams", async () => {
    const childChunk = chunk("childChunk", [0, 0, 0, 1, 10, 1]);
    const view = viewWithFrustum([1, 0, 0], -100, [1, 0, 0]);
    const yUpCoordinateSystem = {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    };
    const zUpCoordinateSystem = {
      basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    };
    const streamController = new XGFViewStreamController({
      index: {
        format: "XGFStreamingIndex",
        indexVersion: "1.1.0",
        coordinateSystem: zUpCoordinateSystem,
        chunks: [],
        streams: [{
          id: "child",
          uri: "child/index.runtime.json",
          aabb: [100, 0, 0, 101, 1, 10],
          origin: [100, 0, 0]
        }]
      },
      streamIndexBaseURI: "https://example.com/root/index.runtime.json",
      sceneModel: {
        coordinateSystem: zUpCoordinateSystem
      } as any,
      view,
      loader: mockLoader(),
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      getStreamIndex: () => ({
        format: "XGFStreamingIndex",
        indexVersion: "1.2.0",
        coordinateSystem: yUpCoordinateSystem,
        chunks: [childChunk]
      }),
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("inside child");
    await wait(50);

    expect(streamController.chunkManifests.map((manifest) => manifest.id)).toEqual(["child::childChunk"]);
    expect(streamController.chunkManifests[0].aabb).toEqual([100, 0, 0, 101, 1, 10]);
  });

  it("preserves child stream coordinates when the root stream has no coordinate system", async () => {
    const childChunk = chunk("childChunk", [0, 0, 0, 1, 10, 1]);
    const view = viewWithFrustum([1, 0, 0], -100, [1, 0, 0]);
    const loadedCoordinateSystems: any[] = [];
    const streamController = new XGFViewStreamController({
      index: {
        format: "XGFStreamingIndex",
        indexVersion: "1.2.0",
        chunks: [],
        streams: [{
          id: "child",
          uri: "child/index.runtime.json",
          aabb: [100, 0, 0, 101, 10, 1],
          origin: [100, 0, 0]
        }]
      },
      streamIndexBaseURI: "https://example.com/root/index.runtime.json",
      sceneModel: {
        coordinateSystem: {
          basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1
        }
      } as any,
      view,
      loader: {
        loadChunk: async (_params: any, options: any) => {
          loadedCoordinateSystems.push((_params.manifest as any).coordinateSystem);
          options.onChunkLoaded(_params.manifest);
        },
        unloadChunk: () => ({ok: true, value: undefined})
      } as any,
      batchSize: 1,
      cameraDebounceMs: 0,
      commitFrameBudgetMs: 0,
      getStreamIndex: () => ({
        format: "XGFStreamingIndex",
        indexVersion: "1.2.0",
        coordinateSystem: {
          basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1
        },
        chunks: [childChunk]
      }),
      loadOptions: {
        getFileData: () => new ArrayBuffer(0)
      } as any
    });

    streamController.schedule("inside child");
    await wait(50);

    expect(streamController.chunkManifests.map((manifest) => manifest.id)).toEqual(["child::childChunk"]);
    expect(streamController.chunkManifests[0].aabb).toEqual([100, 0, 0, 101, 10, 1]);
    expect(loadedCoordinateSystems).toEqual([undefined]);
  });

});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function viewWithFrustum(normal: number[], offset: number, testVertex: number[]) {
  return {
    camera: {
      look: [0, 0, 0],
      frustum: frustum(normal, offset, testVertex)
    }
  } as any;
}

function viewWithProjection(width: number, height: number) {
  return {
    htmlElement: {
      getBoundingClientRect: () => ({width, height}),
      clientWidth: width,
      clientHeight: height
    },
    camera: {
      look: [0, 0, 0],
      viewMatrix: identityMat4(),
      projMatrix: identityMat4(),
      frustum: {planes: []}
    }
  } as any;
}

function identityMat4() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function frustum(normal: number[], offset: number, testVertex: number[]) {
  return {
    planes: [{
      normal,
      offset,
      testVertex
    }]
  };
}

function mockLoader() {
  return {
    loadChunk: async (_params: any, options: any) => {
      options.onChunkLoaded(_params.manifest);
    },
    unloadChunk: () => ({ok: true, value: undefined})
  } as any;
}
