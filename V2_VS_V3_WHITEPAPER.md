---
title: xeokit V2 vs V3 — Capability Comparison
---

# xeokit V2 vs V3 — Capability Comparison

*A side-by-side guide for teams choosing between, or migrating from, the established
**xeokit SDK V2** ([`xeokit/xeokit-sdk`](https://github.com/xeokit/xeokit-sdk)) and the
**xeokit SDK V3** ([`xeokit/sdk`](https://github.com/xeokit/sdk)).*

---

## TL;DR

Both products solve the same problem — viewing high-detail, full-precision 3D
engineering and BIM models in the browser — and share the same lineage, the same
performance philosophy, and the same AGPL-3.0 / commercial dual license. The
difference is in how each is packaged and how far the architecture has been
generalised.

- **V2** is a mature, production-proven **JavaScript** SDK built around a single
  `Viewer` and an extensible **plugin** ecosystem. It is widely deployed, heavily
  documented, and the safe choice for an application that needs a known-stable
  base today.
- **V3** is a ground-up **TypeScript** rewrite organised as a **modular, bucketed
  SDK**. It generalises the parts of V2 that were fixed assumptions — one canvas,
  one renderer backend, one semantic model, import-only formats — into first-class,
  composable subsystems: multiple `View`s per `Scene`, a pluggable `Renderer`
  interface, a separated scene/data graph, result-monad error handling, and
  symmetric **import *and* export** across far more formats.

If you are shipping now and your needs map onto V2's plugins, V2 is the pragmatic
choice. If you are starting fresh, need TypeScript, multi-view, format export, or
the newer capabilities (2D drawings, Gaussian splats, section caps, validation),
V3 is the forward path.

---

## At a glance

| Dimension                | xeokit V2 (`xeokit-sdk`)                                  | xeokit V3 (`sdk`)                                                       |
| ------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Language                 | JavaScript (ES modules), JSDoc                            | TypeScript, TSDoc                                                       |
| Packaging                | One SDK + **plugin** classes on a `Viewer`                | **Topical module buckets** (`base/`, `model/`, `viewing/`, …), tree-shakeable |
| Error handling           | Exceptions / return values                                | Uniform **result-monad** `SDKResult<T>` (`{ok, value}` \| `{ok, type, error}`) |
| Renderer                 | WebGL 2 (VBO + optional data-texture `dtxEnabled`)        | WebGL 2 behind a pluggable **`Renderer` interface** (WebGPU anticipated) |
| Semantic model           | `MetaScene` / `MetaModel` / `MetaObject`                  | Separated **`Data`** graph (`DataModel` / `DataObject` / `Relationship`), paired by id |
| Views per scene          | One `Viewer` → one `Scene` → one canvas                   | **Many `View`s per `Scene`**, each its own camera / state / effects / canvas |
| Coordinate precision      | Full precision via **RTC** tiles (anchored in XKT)        | Full precision via RTC **plus** per-model `coordinateSystem` (basis / origin / units) |
| Format I/O               | **Import-focused** (export limited to BCF / snapshots)    | **Symmetric import + export** across most formats                       |
| Native model format      | **XKT** (offline-converted)                               | **XGF** (in-SDK + CLI conversion); XKT still imported                   |
| 2D drawings              | StoreyViews (2D plan images)                              | Full **drawings pipeline** (plan / section / elevation, HLE, fills, labels) + PDF/DWG/DXF/SVG import |
| Reality capture          | LAS/LAZ point clouds                                       | LAS/LAZ **+ 3D Gaussian Splatting** (`.splat`)                           |
| Maturity                 | **Production-proven, large install base**                 | Newer architecture, broader scope                                       |
| License                  | AGPL-3.0 / commercial (Creoox AG)                         | AGPL-3.0 / commercial (Creoox AG)                                       |

---

## Architecture

### V2 — Viewer + plugins

V2 centres on a single `Viewer` that owns a `Scene`, a `Camera`, and a `CameraControl`,
rendering to one canvas. Functionality is added by instantiating **plugins** against
the viewer:

```js
import { Viewer, XKTLoaderPlugin, TreeViewPlugin } from "@xeokit/xeokit-sdk";

const viewer = new Viewer({ canvasId: "myCanvas" });
const loader = new XKTLoaderPlugin(viewer);
new TreeViewPlugin(viewer, { containerElement: document.getElementById("tree") });

const model = loader.load({ id: "myModel", src: "model.xkt", edges: true });
```

The plugin set is broad and battle-tested. As enumerated in the V2 source tree, the
shipped plugins are:

- **Loaders** — `XKTLoaderPlugin`, `GLTFLoaderPlugin`, `OBJLoaderPlugin`,
  `STLLoaderPlugin`, `LASLoaderPlugin`, `CityJSONLoaderPlugin`, `DotBIMLoaderPlugin`,
  `WebIFCLoaderPlugin`, `IFCOpenShellLoaderPlugin`, `CxConverterIFCLoaderPlugin`,
  `XML3DLoaderPlugin`.
- **Navigation / orientation** — `NavCubePlugin`, `AxisGizmoPlugin`, `FastNavPlugin`,
  `ViewCullPlugin`.
- **Sectioning** — `SectionPlanesPlugin`, `FaceAlignedSectionPlanesPlugin`.
- **Measurement / markup** — `DistanceMeasurementsPlugin`, `AngleMeasurementsPlugin`,
  `AnnotationsPlugin`, `ZonesPlugin`, `TransformControl`.
- **BIM structure** — `TreeViewPlugin`, `StoreyViewsPlugin`.
- **Interop** — `BCFViewpointsPlugin`.

This model is easy to reason about and easy to extend: a plugin is a self-contained
unit you attach to a viewer. The trade-off is that the `Viewer` and its single canvas
are fixed assumptions, and tree-shaking is coarse — you import from one package.

### V3 — modular buckets

V3 drops the single-viewer assumption and reorganises everything into **topical
buckets**, each an independent import path:

| Bucket          | Responsibility |
| --------------- | -------------- |
| `base/`         | Math (Float32 + Float64), `SDKResult`, events, WebGL primitives, IO, locale, constants |
| `model/`        | `scene/` (render graph), `data/` (semantic graph), `procgen/`, `streaming/` |
| `viewing/`      | `viewer/` (`Viewer`, `View`, `Camera`, `SectionPlane`, lights, effects), `webGLRenderer/`, `viewController/`, `cameraFlight/`, `transformControls/` |
| `formats/`      | Import / export for every supported format |
| `spatial/`      | `collision/` (KdTree / BVH), `picking/` |
| `inspect/`      | Scene + data model validation |
| `presentations/`| `drawings/`, `sectionCaps/`, `exploder/`, `heatmaps/`, `materials/` |
| `tools/`        | `measurements/` (distance, angle) |
| `interop/`      | `bcf/` |
| `convert/`      | Conversion pipelines + `xeoconvert` CLI |
| `ui/`           | Plain-DOM UI primitives |
| `simulation/`   | Rigid-body physics binding |

An application composes only the buckets it needs, and the same buckets are exposed
at runtime as namespaces on a root `xeokit` object (`xeokit.model.scene`, …). The
practical wins are TypeScript types end-to-end, finer tree-shaking, and the freedom
to use the core (`Scene` + `Viewer` + `WebGLRenderer`) without any higher-level UI.

### Error handling

V2 follows conventional JavaScript practice — methods return values or throw. V3 is
uniformly **result-monadic**: every fallible operation returns

```ts
type SDKResult<T> =
  | { ok: true;  value: T }
  | { ok: false; type: SDKErrorType; error: string };
```

Id collisions, malformed geometry, bad coordinate systems, and IO errors are values,
not exceptions, and the type system forces a branch-and-narrow at each call site.

---

## The semantic model

Both products keep BIM semantics (entity types, property sets, relationships)
separate from renderable geometry, joined by shared object ids — so a tree-view click
in semantic space resolves to a mesh in render space.

- **V2** exposes this as `MetaScene` → `MetaModel` → `MetaObject`, populated alongside
  the `Scene` by IFC/XKT loaders, and consumed by `TreeViewPlugin`, `StoreyViewsPlugin`,
  and BCF.
- **V3** promotes it to a first-class, standalone graph: `Data` → `DataModel` →
  `DataObject` with typed `Relationship`s, `Property`s and `PropertySet`s, plus a
  `searchObjects` traversal query (start from any object, walk by relationship type,
  filter by type, collect ids). The data graph can be loaded, queried, validated, and
  round-tripped to JSON independently of any viewer.

---

## Coordinate precision

This is shared DNA, not a V3 invention. **Both** products render full-precision,
real-world-coordinate models without Float32 jitter by rebasing geometry into
**Relative-To-Center (RTC)** tiles so the GPU only ever sees small Float32 deltas. In
V2 the RTC anchors are baked into the XKT file; the technique is mature and proven.

V3 generalises the *authoring* side of this. Each `SceneModel` carries an explicit
`coordinateSystem` — a **basis** (3×3 axis orientation), a Float64 **origin**, and
**units** — so Z-up and Y-up sources cohabit one Z-up world, models from different
surveys land correctly relative to one another on first load, and the RTC tiling is
derived automatically at upload time rather than precomputed into the asset:

```ts
scene.createModel({
  id: "siteA",
  coordinateSystem: {
    basis:  [1,0,0, 0,0,1, 0,1,0],     // remap Y-up source onto Z-up world
    origin: [465120.8, 5429331.4, 0],   // UTM eastings/northings + Z
    units:  "meters",
  },
});
```

Both render a model 10 km from the origin at sub-millimetre stability. V3 simply makes
the coordinate declaration a per-model API rather than a property of the converted file.

---

## Renderer

Both ship a **WebGL 2** renderer that batches thousands of meshes per draw call and
holds per-object state (visibility, selection, x-ray, colour, opacity) in **GPU data
textures**, so toggling state is a texture write rather than a buffer rebuild. V2
introduced this as the `dtxEnabled` data-texture path alongside its VBO scene-model
renderer; V3 builds on the same idea throughout.

The architectural difference is **pluggability**. In V3 the renderer sits behind a
`Renderer` interface (`WebGLRenderer` is the supplied implementation, WebGPU is the
stated successor), and the technique set is broader: atlas-packed PBR textures,
shader-permutation caching, fragment-stage logarithmic depth, section-plane caps,
hatch / line patterns, and a per-`DrawOps` selectable depth scheme.

Both support SAO, edges, x-ray, highlight, selection, and PBR materials. V3 adds bloom,
configurable tonemapping (ACES / Reinhard / linear), MSAA/FXAA selection, and an
independent render-resolution scale as per-`View` settings.

---

## Format support

This is where the two diverge most. V2 is **import-focused** — its loaders bring models
in, while export is limited to BCF viewpoints and canvas snapshots; producing the native
XKT format is an **offline** step (`xeokit-convert`, run in Node). V3 treats format
support as **symmetric import + export** and pulls conversion into the SDK and a CLI.

| Format                                 | V2 import | V2 export | V3 import | V3 export |
| -------------------------------------- | :-------: | :-------: | :-------: | :-------: |
| IFC (via web-ifc / IfcOpenShell)       |    ✓      |    —      |    ✓      |    ✓      |
| XKT (xeokit v1/v2 native)              |    ✓      | offline   |    ✓      |    —      |
| XGF (V3 native binary)                 |    —      |    —      |    ✓      |    ✓      |
| glTF / GLB                             |    ✓      |    —      |    ✓      |    ✓      |
| OBJ / MTL                              |    ✓      |    —      |    ✓      |    ✓      |
| STL                                    |    ✓      |    —      |    —      |    —      |
| CityJSON                               |    ✓      |    —      |    ✓      |    —      |
| dotbim (`.bim`)                        |    ✓      |    —      |    ✓      |    ✓      |
| LAS / LAZ point clouds                 |    ✓      |    —      |    ✓      |    —      |
| XML3D / 3DXML                          |    ✓      |    —      |    ✓      |    ✓      |
| 3D Gaussian Splatting (`.splat`)       |    —      |    —      |    ✓      |    ✓      |
| PDF / DWG / DXF / SVG drawing sheets   |    —      |    —      |    ✓      | DXF/SVG   |
| BCF Viewpoints                         |    ✓      |    ✓      |    ✓      |    ✓      |
| SceneModel / DataModel JSON            |    —      |    —      |    ✓      |    ✓      |

V3 also ships in-SDK conversion pipelines (`convert/ifc2gltf2xgf`, `convert/xeoconvert`,
`convert/modelConverter`) so IFC → glTF → XGF can run end-to-end without a separate
toolchain.

> Note: V2 retains STL import, which V3 does not currently provide; teams relying on
> STL should account for that gap.

---

## Viewer features

Many capabilities exist in both, delivered as a V2 *plugin* versus a V3 *module*:

| Capability                   | V2                                   | V3                                              |
| ---------------------------- | ------------------------------------ | ----------------------------------------------- |
| Section planes               | `SectionPlanesPlugin`, `FaceAlignedSectionPlanesPlugin` | `viewing/viewer` `SectionPlane` (per-View, up to 8) |
| Section caps (filled cuts)   | —                                    | `presentations/sectionCaps` (hatch-aware)        |
| Distance / angle measurement | `DistanceMeasurementsPlugin`, `AngleMeasurementsPlugin` | `tools/measurements`                |
| Annotations / markup         | `AnnotationsPlugin`                  | (UI primitives in `ui/`; annotations app-level)  |
| 3D zones                     | `ZonesPlugin`                        | —                                                |
| Tree view (BIM structure)    | `TreeViewPlugin`                     | data-graph driven, app builds the tree           |
| 2D storey plans              | `StoreyViewsPlugin` (plan images)    | `presentations/drawings` (plan/section/elevation, HLE, fills, labels) |
| NavCube / axis gizmo         | `NavCubePlugin`, `AxisGizmoPlugin`   | `NavCube` (`viewing/cameraFlight` + viewer)      |
| Transform gizmo              | `TransformControl`                   | `viewing/transformControls`                      |
| Camera flight                | `CameraFlightAnimation`              | `viewing/cameraFlight` (arc flights, easing, projection-transition) |
| Perf: culling / fast-nav     | `ViewCullPlugin`, `FastNavPlugin`    | render bins + resolution scale per View          |
| Picking / snap               | `Scene.pick` (vertex/edge snap)      | `spatial/picking` (ray, surface, snap-to-vertex/edge) |
| Heatmaps                     | —                                    | `presentations/heatmaps`                         |
| Exploded views               | (app-level)                          | `presentations/exploder`                         |
| Model / data validation      | —                                    | `inspect/sceneModel`, `inspect/dataModel`        |
| Physics                      | —                                    | `simulation/physics` (rigid-body)                |

---

## What is new or expanded in V3

Capabilities that V3 introduces or substantially generalises beyond V2:

- **Multiple `View`s per `Scene`** — split-pane, picture-in-picture, before/after, and
  orthographic plan/elevation alongside 3D perspective, at zero geometry duplication.
  Each `View` has its own camera, per-object state, section planes, and effects.
- **Symmetric format export** — glTF, OBJ/MTL, dotbim, XGF, 3DXML, DXF/SVG, splats,
  and round-trippable scene/data JSON.
- **2D drawings pipeline** — orthographic plan / section / elevation generation with
  hidden-line elimination, fills, room labels, and title-block chrome, plus native
  import of PDF / DWG / DXF / SVG sheets into the same scene as the 3D model.
- **3D Gaussian Splatting** — `.splat` import and export, section-plane clipping of
  splats, and splat support in the XGF v3 container.
- **Section-plane caps** — solid, hatch-stamped caps on clipped surfaces for
  engineering-drawing legibility.
- **Materials, hatching, line patterns** — PBR materials with atlas-packed textures,
  IFC-convention material assignment, and per-material hatch / stipple / dash slots.
- **Model and data validation** — static-analysis-style validators with severity-coded
  reports for both graphs.
- **In-SDK conversion + CLI** — IFC → glTF → XGF and generic converters without an
  external toolchain.
- **TypeScript + result-monad** — typed APIs and explicit, value-based error handling
  across every module boundary.

---

## Where V2 still leads

V3's scope is broader, but V2 remains the stronger choice in several practical respects:

- **Production maturity.** V2 has a large, long-running install base, extensive
  real-world hardening, and a deep catalogue of documented examples.
- **Ready-made plugin shell.** Tree view, storey views, annotations, and zones are
  drop-in plugins; in V3 some of these (tree view, annotations) are assembled by the
  application from lower-level primitives.
- **3D zones** (`ZonesPlugin`) and **STL import** ship in V2 and are not present in V3.
- **Lower adoption friction for existing apps.** A JavaScript codebase already built on
  the V2 `Viewer` + plugin model continues to work without a TypeScript migration.

---

## Migration map (V2 → V3)

For teams porting an application, the common V2 constructs map onto V3 as follows:

| V2                                   | V3 equivalent                                                    |
| ------------------------------------ | ---------------------------------------------------------------- |
| `new Viewer({ canvasId })`           | `new Viewer({ scene })` + `new WebGLRenderer({ viewer })` + `viewer.createView({ elementId })` |
| `viewer.scene`                       | a `Scene` you create and pass to the `Viewer`                    |
| `viewer.metaScene` / `MetaModel`     | a `Data` graph (`Data`, `DataModel`, `DataObject`)               |
| `XKTLoaderPlugin.load({ src })`      | `new XGFLoader().load({ fileData, sceneModel })` (or import XKT)  |
| `WebIFCLoaderPlugin`                 | `formats/ifc` `IFCLoader` (populates SceneModel + DataModel)      |
| `SectionPlanesPlugin`                | `View` section planes (`viewing/viewer`)                         |
| `DistanceMeasurementsPlugin`         | `tools/measurements`                                             |
| `TreeViewPlugin`                     | query the `Data` graph (`searchObjects`) and build the tree       |
| `StoreyViewsPlugin`                  | `presentations/drawings`                                         |
| `BCFViewpointsPlugin`                | `interop/bcf`                                                    |
| `model.setVisible(...)` / colorize   | `view.setObjectsVisible(ids, …)` / `view.setObjectsColorized(…)`  |
| thrown errors / null returns         | branch on `SDKResult<T>` (`if (!r.ok) …`)                        |

---

## Choosing between them

- **Choose V2** when you need a stable, production-proven base today, your feature set
  maps onto the existing plugins, you are extending an existing V2 application, or you
  specifically need 3D zones or STL import.
- **Choose V3** when you are starting fresh, want TypeScript and explicit error
  handling, need multiple synchronised views, require format **export** or conversion
  in-app, or want the newer capabilities — 2D drawings, Gaussian splats, section caps,
  heatmaps, validation — without writing them yourself.

Both are the same engine philosophy at heart: full-precision coordinates, data-texture
batching, and a clean separation between geometry and semantics. V3 is that philosophy
generalised into a modular, typed, import-and-export SDK; V2 is that philosophy in its
proven, plugin-packaged form.
