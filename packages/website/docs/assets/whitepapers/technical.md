---
title: xeokit SDK — Technical Whitepaper
---

# xeokit SDK — Technical Whitepaper

*A developer-focused summary of the SDK architecture and the technical choices that matter for AECO applications.*

---

## TL;DR

xeokit SDK is a TypeScript SDK for building browser and Node.js AECO tools: BIM viewers, digital twins, coordination systems, model analytics, and operational dashboards.

Two design choices define the SDK:

1. **Float64 scene placement with automatic renderer RTC.** Models keep their source-coordinate meaning in the scene graph: basis, origin, units, and world-space transforms are represented in double precision. The renderer derives fine-grained Relative-To-Center (RTC) regions from the content it draws, so applications do not choose RTC origins, create RTC tiles, or rebase geometry when objects move. The GPU sees stable Float32 offsets even when source coordinates are UTM-scale.
2. **Data-texture batching.** Per-object and per-mesh render state lives in GPU textures. Visibility, selection, x-ray, opacity, color, and transform updates are texture writes, not geometry rebuilds.

Around those two foundations, the SDK separates geometry from semantic data, exposes result-monad error handling, and keeps viewing state per `View` so multiple views can share one scene without duplicating model geometry.

### Featured Example: XGF Streamed Stadium

![Baku Stadium loaded with XGF streaming](https://xeokit.github.io/sdk/images/bakuStadium2.png)

The [Baku Stadium XGF streaming example](https://xeokit.github.io/sdk/examples/index.html#benchmarks/streaming/xgf-baku-2000-dynamic) demonstrates viewpoint-driven loading on a large BIM dataset. As reviewers select simulated BCF issues, xeokit streams the XGF chunks visible from each issue viewpoint first, allowing useful review context to appear before the whole model has loaded.

---

## Why It Matters For BIM

### Large Coordinates

IFC and infrastructure models often use surveyed real-world coordinates. Moving everything near the origin avoids GPU precision loss, but breaks federation, GIS alignment, round-tripping, and control-point workflows.

xeokit keeps model placement meaningful in the scene graph:

```ts
scene.createModel({
  id: "siteA",
  coordinateSystem: {
    basis:  [1, 0, 0,  0, 0, 1,  0, 1, 0],
    origin: [465120.8, 5429331.4, 0],
    units:  "meters",
    scaleToMeters: 1,
  },
});
```

Precision is handled by the renderer:

- geometry is quantized relative to per-geometry bounds
- mesh/world transforms are Float64
- render submissions are assigned to renderer-owned RTC regions
- moving content keeps precision without app-managed rebasing

Result: a model 10 km from world origin renders like the same model centered at origin, while still retaining source-coordinate meaning.

### Large State Changes

BIM interaction is state-heavy: hide/show, isolate, select, recolor, x-ray, section, and animate thousands of objects. Traditional WebGL designs often turn those operations into buffer updates or draw-call churn.

xeokit batches compatible meshes and stores per-mesh state in fixed-size GPU data textures:

- matrices and RTC placement
- material values
- visibility, selection, x-ray, highlight, clippable, pickable flags
- compressed geometry references

A single draw call can process thousands of meshes. Changing 50,000 object flags becomes a set of texture-row writes plus a render request.

---

## Architecture

### Module Buckets

| Bucket | Purpose |
|---|---|
| `base/` | Math, compression, core result/event/task types, WebGL helpers, IO, locale, constants. |
| `model/` | Scene graph, semantic data graph, procedural geometry/material helpers, streaming. |
| `viewing/` | Viewer, View, Camera, SectionPlane, lights, effects, WebGL renderer, controls. |
| `formats/` | Import/export for BIM, CAD, point cloud, drawing, reality-capture, and native JSON formats. |
| `spatial/` | Picking, snapping, collision/BVH, AABB and region queries. |
| `inspect/` | Scene/data validation and issue reporting. |
| `tools/` | Interactive measurements. |
| `interop/` | BCF viewpoint import/export. |
| `convert/` | Conversion pipelines and CLI tooling. |
| `ui/` | Plain-DOM UI primitives. |

### Scene And Data

The SDK keeps two graphs side by side:

- `Scene` -> `SceneModel` -> `SceneObject` -> `SceneMesh` -> `SceneGeometry` / `SceneMaterial`
- `Data` -> `DataModel` -> `DataObject` -> properties and relationships

Objects are joined by shared IDs. A BIM query can run against the data graph, then apply visibility or selection changes to matching scene objects without the renderer knowing anything about IFC semantics.

### View And Scene

`Scene` owns loaded content. `View` owns render state: camera, per-object visibility, selection, x-ray, section planes, effects, and canvas. Multiple views can share one scene with no geometry duplication.

### Error Handling

Fallible APIs return `SDKResult<T>`:

```ts
type SDKResult<T> =
  | { ok: true;  value: T }
  | { ok: false; type: SDKErrorType; error: string };
```

Expected failures are values: duplicate IDs, bad parameters, malformed input, and IO errors are handled at call sites instead of being thrown across module boundaries.

---

## API Shape

```ts
import { Scene } from "@xeokit/sdk/model/scene";
import { Data, searchObjects } from "@xeokit/sdk/model/data";
import { Viewer } from "@xeokit/sdk/viewing/viewer";
import { WebGLRenderer } from "@xeokit/sdk/viewing/renderers/webGL";
import { IFCLoader } from "@xeokit/sdk/formats/ifc";

const scene = new Scene();
const data = new Data();
const viewer = new Viewer({ scene });
new WebGLRenderer({ viewer });

const viewResult = viewer.createView({ id: "main", elementId: "canvas" });
if (!viewResult.ok) throw new Error(viewResult.error);
const view = viewResult.value;

const sceneModel = scene.createModel({ id: "duplex" }).value!;
const dataModel = data.createModel({ id: "duplex" }).value!;

const ifcLoader = new IFCLoader();
const bytes = await fetch("model.ifc").then(r => r.arrayBuffer());
await ifcLoader.load({ fileData: bytes, sceneModel, dataModel });

const wallIds: string[] = [];
const q = searchObjects(data, {
  startObjectId: "38aOKO8_DDkBd1FHm_lVXz",
  includeObjects: ["IfcWall"],
  includeRelated: ["IfcRelAggregates"],
  resultObjectIds: wallIds,
});
if (q.ok) view.setObjectsInStyleBin("selected", wallIds, true);
```

The common flow is: create `Scene` and `Data`, attach a `Viewer` and renderer, create one or more `View`s, load scene/data models, then operate through view state.

---

## Core Capabilities

### Coordinate Precision

- Float64 scene/model/object placement.
- Per-model source frame: basis, origin, units, scale.
- Renderer-owned RTC regions derived from current render-space bounds.
- Quantized geometry and logarithmic depth for large-coordinate scenes.

### Scene Graph

- Scene/model/object/mesh/geometry/material hierarchy.
- Triangles, lines, thick lines, and points.
- Runtime transforms and transform hierarchies.
- Per-object visibility, selection, x-ray, highlight, opacity, color, clippable, pickable, and edge state.
- Layers and bulk object operations.

### Data Graph

- Data models with typed objects, property sets, properties, and relationships.
- IFC-style relationship traversal via `searchObjects`.
- Shared IDs between data objects and scene objects.
- Schema-aware ingest for IFC entity data.

### Renderer

- WebGL 2 renderer behind a renderer interface.
- Data-texture batching for mesh state.
- Texture atlas support for PBR materials.
- Section planes, section caps, edge overlays, silhouettes, x-ray, SAO, bloom, shadows, FXAA/MSAA, tonemapping.
- Per-view state and render invalidation.

### Spatial And Interaction

- Ray and canvas-position picking.
- Surface picking and snap picking.
- BVH-backed scene/object AABB queries.
- Marquee selection.
- Distance and angle measurements.
- Camera controls, camera flights, NavCube, and transform controls.

### Inspection

- Scene-model and data-model validators.
- Issue codes, labels, descriptions, severities, and fix hooks.
- Useful for loader development, QA, and model-health tooling.

---

## Format Support

Supported formats include:

| Format | Direction | Module |
|---|---:|---|
| IFC | Import/export | `formats/ifc` |
| glTF / GLB | Import/export | `formats/gltf` |
| XGF | Import/export | `formats/xgf` |
| XKT | Import/export | `formats/xkt` |
| dotbim | Import/export | `formats/dotbim` |
| CityJSON | Import/export | `formats/cityjson` |
| 3D Tiles | Import/streaming | `formats/threedtiles` |
| 3DXML | Import/export | `formats/threedxml` |
| LAS / LAZ | Import | `formats/las` |
| E57 | Import/export | `formats/e57` |
| 3D Gaussian Splatting | Import/export | `formats/gaussiansplat` |
| OBJ / MTL | Import/export | `formats/obj`, `formats/mtl` |
| FBX | Import/export | `formats/fbx` |
| USDZ | Import/export | `formats/usdz` |
| FDS | Import/export | `formats/fds` |
| PDF | Import | `formats/pdf` |
| DWG | Import | `formats/dwg` |
| DXF | Import/export | `formats/dxf` |
| SVG | Import/export | `formats/svg` |
| MetaModel | Import | `formats/legacy/metamodel` |
| Scene/Data JSON | Import/export | `formats/scenemodel`, `formats/datamodel` |

Conversion tooling includes IFC -> glTF -> XGF and generic format-to-format conversion through `convert/xeoconvert` and `convert/modelConverter`.

---

## Studio And Tooling

The website examples layer provides the demo/workbench shell: toolbar, panel registry, model loading helpers, diagnostics, and runtime UI. Applications can use the SDK core without the example Studio helper.

The SDK also uses:

- `SDKTaskRunner` for staged per-frame work
- typed events for observable state
- `destroy()` / `destroyed` conventions for long-lived objects
- TSDoc-generated API reference from the exported source

---

## How This SDK Was Built

The core architecture — Scene, Data, Viewer, WebGLRenderer, coordinate handling, data-texture batching, and result-monad conventions — was designed from prior WebGL SDK experience.

AI assistance was used later to accelerate implementation of additional loaders, exporters, and renderer features against that architecture, with xeokit V2 as a reference. Contributions were reviewed, tested, inspected, and revised before being kept.

---

## Reading Order

1. Root `README.md` for module buckets and import paths.
2. The minimal scene/view example in the README.
3. The IFC model viewer example for loader + data graph flow.
4. `packages/website/examples/` for focused examples by prefix: `viewing_*`, `formats_*`, `building_*`.
5. The Tutorial Index for task-focused tutorials and reference notes, including static/dynamic `SceneModel.updateHint` behavior and XGF renderer storage examples.
6. The generated API reference at `https://xeokit.github.io/sdk/docs/api/`.
