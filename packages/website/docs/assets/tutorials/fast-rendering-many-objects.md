---
title: Fast Rendering for Many Objects
---

# Fast Rendering for Many Objects

This tutorial shows how to configure a xeokit viewer for the fastest practical
interaction with large models containing many objects. The goal is not maximum
visual realism. The goal is to keep navigation, selection, visibility changes
and camera movement responsive when the scene contains thousands or millions of
renderable objects.

Large object counts stress a viewer in different ways from a single complex
mesh. The renderer has to maintain per-object state, decide what is visible,
build draw submissions, update selection and visibility flags, and sometimes
stream more content while the user is moving. A high-quality PBR view with
shadows, SAO, bloom, IBL and antialiasing can be appropriate when the camera is
still, but those effects compete directly with interactivity during navigation.

The performance strategy is to separate model preparation from interactive view
policy:

- Prepare model data so the renderer can batch it efficiently.
- Prefer XGF for deployed runtime geometry, because it is already shaped for
  fast xeokit loading and rendering.
- Use `SceneModel` construction boundaries (`building`, `beginBatch()` and
  `seal()`) so renderers register coherent groups instead of reacting to every
  component one at a time.
- Use `memoryPolicy: "compact"` for completed static content when renderer
  memory matters.
- Use a fast `ViewProfiles` profile while the user is interacting.
- Keep expensive view effects disabled unless they are required for the current
  workflow.
- For WebGPU, use renderer configuration that reduces draw calls and avoids
  building unused render data.

These choices keep the mental model simple: load or author the model in a way
that creates batchable renderer input, then make the active view cheap to draw
while the user is moving.

[![Procedural cityscape benchmark with many objects](https://xeokit.github.io/sdk/examples/studio/benchmarks/scene/procedural-cityscape/index.png)](https://xeokit.github.io/sdk/examples/index.html#studio/benchmarks/scene/procedural-cityscape)

The live
[Benchmark - Procedural Cityscape](https://xeokit.github.io/sdk/examples/index.html#studio/benchmarks/scene/procedural-cityscape)
example shows a large generated scene built from repeated geometry, useful for
comparing many-object interactivity choices.

---

## 1. Use Runtime Assets

For production viewers, prefer loading XGF instead of source formats such as IFC
or authoring formats such as glTF:

```javascript
import {Scene} from "@xeokit/sdk/model/scene";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";

const scene = new Scene();

const sceneModelResult = scene.createModel({
  id: "campus",
  memoryPolicy: "compact"
});

if (!sceneModelResult.ok) {
  throw new Error(sceneModelResult.error);
}

const sceneModel = sceneModelResult.value;

await new XGFLoader().load({
  fileData: await fetchArrayBuffer("./models/campus/model.xgf"),
  sceneModel
});

async function fetchArrayBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  return response.arrayBuffer();
}
```

XGF is the runtime geometry format. It avoids doing expensive source parsing and
tessellation on every page load, and gives the renderer geometry, materials,
transforms and objects in a form that is already close to its rendering needs.

Use a separate `DataModel` only when the view needs semantic object data such as
property panels, object trees or search. DataModel loading is valuable for
inspection workflows, but it is not required just to draw the model.

---

## 2. Prefer WebGPU, Fall Back to WebGL

WebGPU is the preferred renderer for large many-object scenes. It has explicit
configuration for packed geometry pages, instance buffers, frustum culling and
render-pass setup. Keep a WebGL fallback when the browser or device does not
support WebGPU.

```javascript
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";

const viewer = new Viewer({scene});
const renderer = await createFastRenderer(viewer);

renderer.events.onError.subscribe((_renderer, error) => {
  console.error(error.error);
});

async function createFastRenderer(viewer) {
  const webgpuResult = await WebGPURenderer.create({
    viewer,
    memoryConfigs: {
      maxBatchVertices: 200000,
      maxBatchIndices: 600000,
      maxBatchGeometries: 4096,
      maxBatchMeshes: 200000,
      frustumCulling: true,
      minProjectedCanvasSize: 0,
      compactSealedStreamPages: true
    },
    renderConfigs: {
      edges: false,
      transparentSortStrategy: "segment"
    }
  });

  if (webgpuResult.ok) {
    return webgpuResult.value;
  }

  console.warn(webgpuResult.error);
  return new WebGLRenderer({viewer});
}
```

The WebGPU options above are tuned for interactivity:

- Larger packed segment limits reduce draw-call pressure.
- `frustumCulling: true` skips off-screen packed segments during draw
  submission without unloading their geometry.
- `edges: false` avoids allocating and drawing edge batches.
- `transparentSortStrategy: "segment"` keeps transparent rendering
  batch-oriented instead of sorting each transparent object individually.

WebGPU classifies triangle batches internally while packing them. Plain
instance-colored triangle batches can use the lean flat path, while textured,
vertex-colored, emissive, alpha-masked or materially rich batches stay on the
PBR path. Applications usually do not need to select that path directly.

Leave depth-prepass selection to the renderer unless you are profiling a
specific scene. It is an internal pass-ordering tradeoff: useful when
depth-dependent rendering needs a stable depth buffer or expensive fragment
shading benefits from early depth rejection, but wasteful when the view is
already cheap to shade. Most applications should express intent through view
effects, view profiles and renderer presets instead of managing that pass
directly.

---

## 3. Create a Fast View

Create a view that starts cheap:

```javascript
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";

const viewResult = viewer.createView({
  id: "main",
  htmlElement: document.getElementById("viewerCanvas"),
  backgroundColor: [0.94, 0.96, 0.98],
  camera: {
    eye: [20, 20, 20],
    look: [0, 0, 0],
    up: [0, 0, 1],
    far: 1000
  },
  lights: {
    hemispheric: {
      enabled: true,
      intensity: 0.58,
      skyColor: [0.62, 0.72, 0.86],
      groundColor: [0.42, 0.36, 0.30],
      worldUp: [0, 0, 1]
    },
    ibl: {
      enabled: false,
      intensity: 0
    }
  },
  effects: {
    sao: {enabled: false},
    edges: {enabled: false},
    bloom: {enabled: false},
    atmosphere: {enabled: false},
    depthOfField: {enabled: false},
    colorGrading: {enabled: false},
    shadows: {enabled: false},
    sectionPlaneCaps: {enabled: false},
    bodyHatch: {enabled: false},
    tonemap: {
      enabled: true,
      mode: "aces",
      exposure: 0.82,
      sRGBEncode: true,
      renderScale: 1
    },
    antiAliasing: {
      enabled: false,
      mode: "fxaa"
    },
    sky: {
      enabled: true,
      sunEnabled: true,
      sunGlowIntensity: 0.15,
      worldUp: [0, 0, 1]
    },
    ibl: {
      enabled: false,
      intensity: 0
    }
  },
  resolutionScale: {
    enabled: true,
    resolutionScale: 0.72
  }
});

if (!viewResult.ok) {
  throw new Error(viewResult.error);
}

const view = viewResult.value;

new ModelNavigationController(view);
```

This is the same basic policy as the built-in `fast` profile: simple lighting,
no heavy post-processing, no enhanced edges, no shadows, and a reduced
resolution scale. It preserves tonemapping and final sRGB encoding so the view
does not become visually broken while staying cheap to redraw.

---

## 4. Use ViewProfiles for Interaction

For applications that need a better still image after navigation stops, use
`ViewProfiles` with `AdaptiveQuality`. The active profile switches to `"fast"`
while the camera is moving, then returns to a higher-quality profile after the
view settles.

```javascript
import {AdaptiveQuality} from "@xeokit/sdk/viewing/adaptiveQuality";
import {DEFAULT_VIEW_PROFILES, ViewProfiles} from "@xeokit/sdk/viewing/profiles";

const viewProfiles = new ViewProfiles(view, {
  profiles: DEFAULT_VIEW_PROFILES,
  activeProfile: "fast"
});

new AdaptiveQuality({
  viewProfiles,
  fastProfile: "fast",
  restProfile: "detailed",
  restMs: 500
});
```

Use `"detailed"` as the rest profile when engineering readability matters. It
adds subtle SAO, edges and antialiasing without going all the way to the
presentation-oriented `"realistic"` profile. For the fastest possible viewer,
skip `AdaptiveQuality` and keep `"fast"` active all the time.

---

## 5. Batch Programmatically Authored Models

When generating many objects directly with `SceneModel`, build in coherent
groups instead of making every object visible to the renderer immediately.

Use the `building` state for one-shot model creation:

```javascript
const modelResult = scene.createModel({
  id: "generated-campus",
  memoryPolicy: "compact"
});

if (!modelResult.ok) {
  throw new Error(modelResult.error);
}

const model = modelResult.value;

model.building = true;

try {
  for (const floor of floors) {
    model.createGeometry(floor.geometry);
    model.createMaterial(floor.material);
    model.createMesh(floor.mesh);
    model.createObject(floor.object);
  }
} finally {
  model.building = false;
}

const sealResult = model.seal();

if (!sealResult.ok) {
  throw new Error(sealResult.error);
}
```

Use `beginBatch()` when content arrives in chunks:

```javascript
const batchResult = model.beginBatch({
  id: chunk.id
});

if (!batchResult.ok) {
  throw new Error(batchResult.error);
}

try {
  for (const objectParams of chunk.objects) {
    model.createObject(objectParams);
  }

  const commitResult = model.commitBatch();

  if (!commitResult.ok) {
    throw new Error(commitResult.error);
  }
} catch (error) {
  const rollbackResult = model.rollbackBatch();

  if (!rollbackResult.ok) {
    console.warn(rollbackResult.error);
  }

  throw error;
}
```

Renderers observe these construction boundaries. While a model is building or a
batch is active, renderer registration can be deferred until the model reaches a
coherent boundary. That reduces repeated renderer-side work during large imports
or generated-model construction.

---

## 6. Keep Per-Frame Work Small

Fast many-object viewers are usually limited by repeated work, not only by raw
triangle count. Keep these rules in mind:

- Change visibility, selection and color through view/object state instead of
  rebuilding geometry.
- Avoid enabling enhanced edges globally for huge models unless edge readability
  is the actual workflow requirement.
- Avoid shadows, SAO, bloom, atmosphere and depth of field while the camera is
  moving.
- Keep transparent objects to a minimum. Transparency often prevents the
  renderer from using the cheapest opaque path.
- Keep textures enabled only when they add information. For coordination views,
  simple material colors are often faster and clearer.
- Use streaming or spatial partitioning when users only need a subset of a very
  large site at once.

Use renderer diagnostics when tuning a concrete model. For WebGPU, inspect
`renderer.getMemoryStats()` and `renderer.getViewRenderStats(viewIndex)` to
compare draw-call count, memory use and command-encoding cost before and after
changing batch sizes, render configs or view effects.
