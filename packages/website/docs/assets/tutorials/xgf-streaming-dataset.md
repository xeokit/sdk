---
title: Create and Stream an XGF Dataset
---

# Create and Stream an XGF Dataset

This tutorial shows how to create an XGF Stream dataset and load it into a
viewer with camera-driven, frustum-prioritized streaming. The goal is to make a
large model usable before every object has been downloaded, decoded and committed
to the scene.

XGF is xeokit's compact binary geometry format. XGF Stream is the same renderable
content split into an index plus many smaller XGF chunks. The split matters
because a viewer can reason about each chunk independently: where it is in model
space, what assets it depends on, how many objects it contains, and whether it is
worth loading for the current camera.

An XGF Stream dataset has two kinds of chunk:

- asset-library chunks, which define reusable geometries, materials and textures.
- references-only chunks, which create scene objects and meshes that reference
  those shared assets.

That separation keeps repeated assets from being duplicated across every visible
tile. When a references-only chunk is selected for loading, the streaming loader
first makes sure its asset-library dependencies are resident, then commits the
chunk into the target `SceneModel`.

Instead of one large model file, an XGF Stream package writes:

- `index.json` - a readable stream index for tools and debugging.
- `index.runtime.json` - a compact runtime index for viewers.
- `chunks/*.xgf` - XGF v2 chunks containing shared assets and scene references.
- optional semantic data such as `datamodel.json`.

At runtime, `XGFViewStreamController` watches a `View` and turns camera state into
a load queue. It tests chunk AABBs against the camera frustum, optionally ignores
chunks that project to only a few screen pixels, sorts visible chunks by distance
to the camera look point or eye, loads dependencies, then commits references-only
chunks into a target `SceneModel`. Calling `schedule()` after camera changes
rebuilds that queue for the new view.

This is the usual shape for large BIM, CAD and city datasets: load enough of the
current view quickly, continue loading as the camera moves, and avoid blocking the
main thread with one monolithic file.

---

## 1. Install the SDK

For an application project:

```bash
npm install @xeokit/sdk
```

When working from this repository checkout, build the SDK before using the local
CLI:

```bash
pnpm --filter @xeokit/sdk sdk-dist
node packages/sdk/dist/xeoconvert/xeoconvert.js --help
```

---

## 2. Create an XGF Stream with `xeoconvert`

For IFC input, use the built-in `ifc2xgfstream` pipeline:

```bash
mkdir -p public/models/my-building

npx xeoconvert \
  --pipeline ifc2xgfstream \
  --ifc ./source/model.ifc \
  --xgfstream ./public/models/my-building \
  --datamodel ./public/models/my-building/datamodel.json \
  --inspect-fix \
  --inspect-checks all \
  --stats-report ./public/models/my-building/stats.json \
  --manifest-report ./public/models/my-building/manifest.json \
  --log
```

From this repository checkout, use the built CLI path:

```bash
node packages/sdk/dist/xeoconvert/xeoconvert.js \
  --pipeline ifc2xgfstream \
  --ifc ./source/model.ifc \
  --xgfstream ./public/models/my-building \
  --datamodel ./public/models/my-building/datamodel.json \
  --inspect-fix \
  --inspect-checks all \
  --stats-report ./public/models/my-building/stats.json \
  --manifest-report ./public/models/my-building/manifest.json \
  --log
```

The converter writes the stream index files and chunk directory under
`public/models/my-building`. Use `.xgfstream` pipelines for other supported
source formats, for example `gltf2xgfstream`, `cityjson2xgfstream`,
`citygml2xgfstream`, `dotbim2xgfstream` or `xkt2xgfstream`.

---

## 3. Create an XGF Stream Programmatically

Use `XGFStreamExporter` when your application or dataset script already builds a
`SceneModel` in memory. Grid partitioning is the default and is the right choice
for frustum-prioritized streaming because every chunk needs spatial bounds.

```javascript
import {mkdir, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {Scene} from "@xeokit/sdk/model/scene";
import {XGFStreamExporter} from "@xeokit/sdk/formats/xgfstream";

const scene = new Scene();
const sceneModel = scene.createModel({
  id: "city",
  updateHint: "static"
}).value;

// Build or import geometry, meshes and objects here.
// sceneModel.fromParams(...);

const stream = await new XGFStreamExporter().write(
  {sceneModel},
  {
    partition: "grid",
    chunkMetric: "objects",
    chunkBudget: 500,
    minChunkBudget: 100,
    assetLibraryChunkSize: 256,
    sharedAssetMode: "sharded",
    sharedAssetShardSize: 512,
    runtimeIndex: "index.runtime.json",
    chunkDir: "chunks"
  }
);

await writeStreamFiles(stream.files, "public/models/city");

async function writeStreamFiles(files, outputDir) {
  for (const [name, data] of Object.entries(files)) {
    const fileName = join(outputDir, name);
    await mkdir(dirname(fileName), {recursive: true});
    if (data instanceof ArrayBuffer) {
      await writeFile(fileName, Buffer.from(data));
    } else if (ArrayBuffer.isView(data)) {
      await writeFile(fileName, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    } else {
      await writeFile(fileName, JSON.stringify(data, null, 2));
    }
  }
}
```

Useful exporter options:

- `partition: "grid"` groups nearby objects into spatial chunks.
- `chunkBudget` controls the target chunk size for the selected metric.
- `chunkMetric` can be `"objects"`, `"meshes"` or `"geometry-bytes"`.
- `sharedAssetMode: "sharded"` splits reused assets into multiple libraries, so
  first-frustum loads do not necessarily depend on one large global asset file.
- `runtimeIndex: "index.runtime.json"` writes the compact index used by viewers.
- `chunkRepSets` can add projected-size representation sets to each chunk for
  coarse in-chunk LOD behavior.

---

## 4. Add a Viewer Page

Create a page with a canvas and a small status overlay:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>XGF Stream Viewer</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      #myCanvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      #status {
        position: absolute;
        left: 12px;
        top: 12px;
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.9);
        font: 12px/1.4 system-ui, sans-serif;
      }
    </style>
  </head>
  <body>
    <canvas id="myCanvas"></canvas>
    <div id="status">Loading...</div>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
```

---

## 5. Load the Runtime Index

Create `viewer.js` and read the compact runtime index:

```javascript
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {
  readXGFStreamingRuntimeIndex,
  XGFStreamingLoader,
  XGFViewStreamController
} from "@xeokit/sdk/formats/xgfstream";

const MODEL_ID = "my-building";
const INDEX_URL = "./models/my-building/index.runtime.json";

main().catch((error) => {
  document.getElementById("status").textContent = String(error?.message || error);
  console.error(error);
});

async function main() {
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = viewer.createView({
    id: "main",
    htmlElement: document.getElementById("myCanvas"),
    backgroundColor: [0.93, 0.95, 0.98],
    camera: {
      eye: [20, -25, 18],
      look: [0, 0, 3],
      up: [0, 0, 1]
    }
  }).value;

  const renderer = new WebGLRenderer({viewer});
  new ModelNavigationController(view);

  const index = await fetchRuntimeIndex(INDEX_URL);
  const sceneModel = scene.createModel({
    id: MODEL_ID,
    updateHint: "dynamic",
    coordinateSystem: index.coordinateSystem
  }).value;

  const streamController = createStreamController({
    index,
    sceneModel,
    view,
    indexURL: INDEX_URL
  });

  bindCameraStreaming(viewer, streamController);
  streamController.prefetchInitial(4);
  streamController.schedule("Initial view");

  window.xeokitDemo = {
    scene,
    viewer,
    view,
    renderer,
    streamController
  };
}

async function fetchRuntimeIndex(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const result = readXGFStreamingRuntimeIndex(await response.json());
  if (!result.ok) {
    throw new Error(result.error);
  }

  return resolveIndexRelativeChunkUris(result.value, url);
}
```

The call to `resolveIndexRelativeChunkUris()` below makes chunk URIs absolute to
the index file location. This is useful when the viewer is nested at a different
URL depth than the model directory.

```javascript
function resolveIndexRelativeChunkUris(index, indexURL) {
  const baseURL = new URL(indexURL, window.location.href).href;
  return {
    ...index,
    chunks: (index.chunks || []).map((manifest) => ({
      ...manifest,
      uri: manifest.uri ? new URL(manifest.uri, baseURL).href : manifest.uri,
      dependencies: {
        ...manifest.dependencies,
        chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
          ...dependency,
          uri: dependency.uri ? new URL(dependency.uri, baseURL).href : dependency.uri
        }))
      }
    }))
  };
}
```

---

## 6. Configure Frustum-Prioritized Streaming

Create the `XGFViewStreamController`. With `frustumOnly: true`, the controller
commits only chunks that intersect the current view frustum. When the camera
moves, call `schedule()` again and it will rebuild the queue for the new view.

```javascript
function createStreamController({index, sceneModel, view, indexURL}) {
  const status = document.getElementById("status");

  return new XGFViewStreamController({
    index,
    loader: new XGFStreamingLoader(),
    sceneModel,
    view,
    batchSize: 8,
    fetchConcurrency: 8,
    commitFrameBudgetMs: 10,
    cameraDebounceMs: 140,
    frustumOnly: true,
    frustumDepthMultiplier: 2,
    frustumMinDepth: 50,
    minProjectedChunkSizePixels: 4,
    chunkPriorityTarget: "look",
    cacheFileData: true,
    maxCachedFileBytes: 256 * 1024 * 1024,
    onStatus: (message) => {
      status.textContent = message;
    },
    onProgress: ({queued, loaded}) => {
      status.textContent = queued > 0
        ? `Streaming ${loaded}/${queued} visible chunks`
        : "Current frustum loaded";
    },
    onError: (error) => {
      status.textContent = String(error?.message || error);
      console.error(error);
    },
    loadOptions: {
      getFileData: async (manifest, signal) => {
        const response = await fetch(manifest.uri, {signal});
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} fetching ${manifest.uri}`);
        }
        return response.arrayBuffer();
      }
    }
  });
}
```

Key runtime options:

- `frustumOnly: true` keeps the active queue focused on visible chunks.
- `frustumDepthMultiplier` and `frustumMinDepth` cap how deep the streaming
  frustum reaches without changing the render camera far clip.
- `minProjectedChunkSizePixels` skips tiny chunks that would not visibly affect
  the current frame.
- `batchSize`, `fetchConcurrency` and `commitFrameBudgetMs` balance throughput
  against interactivity.
- `cacheFileData` lets unloaded chunks reload without refetching bytes, bounded
  by `maxCachedFileBytes`.

---

## 7. Reschedule on Camera Movement

`ModelNavigationController` updates the camera in response to mouse, touch and
keyboard input. Subscribe to camera matrix updates and ask the stream controller
to schedule a new pass.

```javascript
function bindCameraStreaming(viewer, streamController) {
  const onCameraChanged = () => {
    streamController.schedule("Camera changed");
  };

  viewer.events.onCameraViewMatrixUpdated.subscribe(onCameraChanged);
  viewer.events.onCameraProjMatrixUpdated.subscribe(onCameraChanged);
}
```

The controller already debounces scheduled passes with `cameraDebounceMs`, so it
is fine to call `schedule()` on every relevant camera update.

---

## 8. Unload or Cap Resident Chunks

For review workflows where the user jumps between distant viewpoints, unload
chunks that are no longer visible:

```javascript
viewer.events.onCameraViewMatrixUpdated.subscribe(() => {
  streamController.unloadInvisibleChunks();
  streamController.schedule("Camera changed");
});
```

For roaming workflows, prefer LRU eviction:

```javascript
const streamController = new XGFViewStreamController({
  index,
  sceneModel,
  view,
  frustumOnly: true,
  enableLRUEviction: true,
  maxResidentChunks: 200,
  loadOptions: {
    getFileData
  }
});
```

Asset-library chunks are retained while references-only chunks depend on them.
That keeps shared geometry and material data available for nearby reloads.

---

## 9. Choosing Chunk Sizes

Start with conservative defaults, then tune with real model timings:

- For buildings, start with `chunkMetric: "objects"` and `chunkBudget` between
  `250` and `1000`.
- For city or CAD datasets with uneven geometry density, try
  `chunkMetric: "geometry-bytes"`.
- Keep chunks spatially local. Large chunks with wide AABBs stay visible too
  often and weaken frustum prioritization.
- Avoid one huge shared asset library when first-frustum latency matters; use
  `sharedAssetMode: "sharded"` or `"local"` to reduce initial dependencies.
- Use `updateHint: "static"` for streams that will not change after loading.
  Use `updateHint: "dynamic"` when chunks are frequently loaded and unloaded.

Existing examples worth comparing against:

- `packages/website/examples/streaming/xgf/chunks`
- `packages/website/examples/streaming/xgf/house-plan`
- `packages/website/examples/streaming/xgf/west-river-side-hospital-static`
- `packages/website/examples/streaming/xgf/otc`
- `packages/website/examples/benchmarks/streaming/xgf-baku-4000-dynamic`
