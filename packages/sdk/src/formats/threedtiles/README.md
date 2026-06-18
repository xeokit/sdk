---
title: 3D Tiles Format Guide
---
# 3D Tiles (OGC / Cesium) Importer

`ThreeDTilesLoader` imports a [3D Tiles](https://github.com/CesiumGS/3d-tiles)
`tileset.json` and its content files into a `SceneModel`, and per-feature /
per-tile metadata into a `DataModel`. For tilesets too large to load whole,
`TilesetStreamer` streams the visible tiles as the camera moves.

This document describes the tileset structure the loader walks, the static
one-shot import pipeline, and the camera-driven streaming path (explicit and
implicit).

---

## 1. What 3D Tiles is

3D Tiles is the OGC / Cesium standard for streaming large, heterogeneous 3D
geospatial datasets — photogrammetry, BIM, point clouds, and instanced
features. A dataset is a tree of **tiles**:

```
   tileset.json
        │
        ▼
     root tile  ── boundingVolume (box / sphere / region)
        │       ── geometricError   (world-space error if this tile is shown
        │                            instead of its children)
        │       ── refine           REPLACE (children replace this tile) or
        │                            ADD (children add detail on top)
        │       ── content.uri      b3dm / pnts / i3dm / cmpt / glTF / GLB,
        │                            or another tileset.json (external tileset)
        │       ── transform        local 4×4, composed down the tree
        ├── child tile
        ├── child tile
        │     └── ...
        └── child tile
```

A renderer descends the tree, choosing how deep to go from each tile's
**geometric error** projected to **screen-space error** (SSE): a tile is good
enough when its SSE falls below a pixel threshold, otherwise it refines into its
children.

**Implicit tiling** (3D Tiles 1.1) replaces the explicit `children` arrays with
a compact rule: a `QUADTREE` or `OCTREE` subdivision plus binary `.subtree`
availability files. Tile coordinates are Morton (Z-order) indices, and each
tile's content / subtree URI is produced by templating `{level}/{x}/{y}/{z}`
into a pattern. This is the form Cesium ion and Google Photorealistic 3D Tiles
emit.

---

## 2. Static import pipeline

`ThreeDTilesLoader` is a `ModelLoader` whose `fileDataType` is `"json"`; the
`tileset.json` is parsed by `parseTileset`, which loads the whole selected tile
set in a single pass.

```
   tileset.json (parsed JSON)
        │
        ▼
   parseTileset.ts
        │
        ├─ applyTilesetMetadata   tileset / group metadata → DataModel
        │
        ├─ walk the tile tree (compose each tile's world transform):
        │     │
        │     ├─ explicit children → recurse
        │     │
        │     └─ implicitTiling   → traverseImplicit.ts
        │                            fetch .subtree files, enumerate available
        │                            tiles by Morton index, template URIs
        │     │
        │     ▼
        │   for each selected tile with content:
        │     fetchArrayBuffer(content URL)
        │     │
        │     ├─ *.json            → external tileset, recurse
        │     └─ binary content    → decodeContent.ts
        │     │
        │     ├─ applyTileMetadata  per-tile / per-content metadata → DataModel
        │     ▼
        │   SceneModel + DataModel populated
        ▼
   sceneModel.build()
```

By default the most-detailed (leaf) tiles of a `REPLACE` tileset are loaded;
`maxDepth` / `maxGeometricError` load coarser detail instead. Content files are
fetched relative to `ModelLoadOptions.baseUri`; an injectable `fetchArrayBuffer`
lets tests and the CLI read from disk.

### Content decode (`content/decodeContent.ts`)

Content is dispatched by its magic bytes:

- **`b3dm`** (Batch 3D Model) — a glTF/GLB payload plus a Batch Table; Batch
  Table columns become `DataObject` property sets.
- **`pnts`** (Point Cloud) — quantised or float positions and colours.
- **`i3dm`** (Instanced 3D Model) — a glTF/GLB referenced once and placed at
  many instances; instance transforms come from `POSITION`, `NORMAL_UP` /
  `NORMAL_RIGHT` (orientation) and `SCALE` / `SCALE_NON_UNIFORM`.
- **`cmpt`** (Composite) — a container of the above, decoded recursively.
- **glTF / GLB** — 3D Tiles 1.1 content, decoded by the shared `GLTFLoader`.

The glTF path decodes `KHR_draco_mesh_compression` (when the caller injects the
`draco3d` module via `ModelLoadOptions.dracoModule`) and per-feature
`EXT_structural_metadata` property tables (mapped to `DataObject`s via the
`dataParentId` option). Each tile's composed world transform is baked into the
per-mesh matrices, so georeferenced (ECEF) tilesets keep full positional
precision.

---

## 3. Streaming pipeline

For tilesets too large to load whole, `streaming/` drives camera-based loading:
each camera change selects the tiles to render and makes the scene hold exactly
that set.

```
   buildTileTree(tileset, baseUri)        in-memory TileNode tree
        │                                 (world transform, geometric error,
        │                                  world bounding sphere per tile)
        ▼
   TilesetStreamer.update(camera)
        │
        ├─ selectStreaming(tree, camera)  async selection:
        │     ├─ frustum-cull (Frustum3 from view × projection)
        │     ├─ screen-space error per tile → descend or stop
        │     └─ implicit nodes expand lazily (see §4)
        │     ▼
        │   selected content tiles (nearest maxLoadedTiles kept)
        │
        ├─ load newly-selected tiles      per-tile SceneModel via decodeContent
        └─ destroy no-longer-selected     so coarse + fine never render together
```

`TilesetStreamer.update` is testable without a renderer (it takes a plain
`CameraState`); `streamTilesetInView` wires it to a View's camera for live use.
Each tile loads into its own `SceneModel` created with `globalizedIds: true`, so
identical object names across tiles stay unique scene-wide. When a selection
exceeds `maxLoadedTiles`, the nearest tiles are kept.

`selectTiles` (in `screenSpaceError.ts`) is a pure synchronous selection for
explicit trees; `selectStreaming` is the async variant the streamer uses,
because implicit expansion has to fetch subtrees.

---

## 4. Implicit-tiling streaming

An implicit tileset has no explicit `children` — its tree is expanded on demand
as the camera descends, so subtrees are fetched only where detail is needed.

- `buildTileTree` turns a tile carrying `implicitTiling` (with a `box` bounding
  volume) into an implicit `TileNode`: it records the subdivision scheme,
  `subtreeLevels`, `availableLevels`, the subtree / content URI templates, and
  the root box (an `ImplicitSpec`), and keeps **no** children.
- `selectStreaming` walks the implicit structure by SSE + frustum, reusing
  `parseSubtree` (availability bitstreams), `morton` (subdivision + Morton child
  indices), and the URI templating from `traverseImplicit`. It fetches a
  `.subtree` file only when the walk crosses into it (every `subtreeLevels`),
  caching parsed subtrees on the streamer so each is read once.
- `implicit/boxSubdivision.ts` derives each implicit tile's bounding volume:
  `subdividedSphere` splits the root box into the cell at a given level and
  Morton coordinate (X/Y for `QUADTREE`, X/Y/Z for `OCTREE`) and returns its
  world-space sphere; `geometricErrorAtLevel` halves the root error per level.

`REPLACE` emits a content tile where it stops refining; `ADD` emits at every
available level it visits. Emitted tiles are ordinary `TileNode`s with stable
ids, so the streamer's load / unload path is unchanged.

---

## 5. Coordinate system

3D Tiles is georeferenced (ECEF, Z-up by convention). The loader bakes each
tile's composed world transform into the per-mesh matrices rather than reading
any global up-axis. Declare the model's coordinate system at `createModel` time
for cross-model alignment:

```ts
const sceneModel = scene.createModel({
  id: "city",
  coordinateSystem: { /* basis / origin / units */ },
}).value!;
```

---

## 6. Usage

### Static import

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";

const scene = new Scene();
const sceneModel = scene.createModel({id: "city"}).value!;

const tileset = await (await fetch("./city/tileset.json")).json();
await new ThreeDTilesLoader().load(
  {fileData: tileset, sceneModel},
  {baseUri: "./city/"},   // directory the tileset and its content live in
);

sceneModel.build();
```

The loader's `fileDataType` is `"json"`, so the `tileset.json` is passed as
parsed JSON.

### Streaming

```ts
import {buildTileTree, streamTilesetInView} from "@xeokit/sdk/formats/threedtiles";

const tileset = await (await fetch("./city/tileset.json")).json();
const tree = buildTileTree(tileset, "./city/");

// Streams into view.viewer.scene, re-selecting on every camera change.
streamTilesetInView(view, tree, {maxScreenSpaceError: 16, maxLoadedTiles: 256});
```

For manual control (tests, custom render loops), drive the streamer directly:

```ts
import {TilesetStreamer} from "@xeokit/sdk/formats/threedtiles";

const streamer = new TilesetStreamer({scene, tree});
await streamer.update({eye, viewportHeight, fov, viewMatrix, projMatrix});
```

---

## 7. What is not covered

- **Bounding volumes** — `box`, `sphere`, and `region` are used for streaming
  selection. A `region` (geodetic extent, EPSG:4979) is converted to an ECEF
  world-space sphere enclosing its eight corners; the tile transform does not
  apply to it (per spec). Implicit streaming uses `box` only.
- **Camera** — streaming selection assumes a perspective camera.
- **KTX2 / Basis textures** (`KHR_texture_basisu`) are not uploaded — the
  renderer has no compressed-texture path.
- **i3dm** oct-encoded normals (`*_OCT32P`) and `EAST_NORTH_UP` orientation are
  not handled (identity rotation).
- **Metadata** maps to `DataObject`s per tileset / group / tile / feature. A
  glTF mesh whose `EXT_mesh_features` feature ids are a per-vertex attribute
  (`_FEATURE_ID_n`) bound to an `EXT_structural_metadata` property table is
  split into one SceneObject per feature, each sharing its id with the feature's
  DataObject — so a picked feature resolves to its metadata. Feature id
  **textures** (`FeatureIdTexture`), property textures, external `schemaUri`,
  enum-name resolution, and implicit subtree-level metadata are not handled.
- **Multiple `contents`** per tile — a single (optionally templated) `content`
  is loaded.

---

## 8. File map

```
formats/threedtiles/
├── README.md                       (this file)
├── ThreeDTilesLoader.ts            ModelLoader subclass — static import entry point
├── parseTileset.ts                 tileset.json → SceneModel + DataModel (one-shot)
├── tilesetMetadata.ts              tileset / group / tile metadata → DataModel
├── index.ts                        module re-exports + module docs
├── content/
│   ├── decodeContent.ts            magic dispatch: b3dm / pnts / i3dm / cmpt / glTF
│   └── binaryTables.ts             Feature / Batch Table binary-body readers
├── implicit/
│   ├── morton.ts                   subdivision + Morton (Z-order) index helpers
│   ├── parseSubtree.ts             .subtree file → availability predicates
│   ├── traverseImplicit.ts         static implicit walk + URI templating
│   └── boxSubdivision.ts           implicit tile box → world sphere + level error
├── streaming/
│   ├── TileTree.ts                 buildTileTree: tileset → in-memory TileNode tree
│   ├── screenSpaceError.ts         SSE + pure explicit selectTiles + frustum cull
│   ├── selectStreaming.ts          async explicit + implicit (lazy) selection
│   ├── TilesetStreamer.ts          camera-driven load / unload of per-tile models
│   └── index.ts                    streaming re-exports
└── tests/
    ├── threedtiles.test.ts         synthetic-tileset unit tests
    ├── threedtiles.cesium.test.ts  real CesiumGS samples (implicit + metadata)
    ├── featureLinkage.test.ts      EXT_mesh_features feature → object linkage
    ├── streaming.test.ts           tile tree, SSE, region, selection, frustum, streamer
    ├── implicitStreaming.test.ts   box subdivision + implicit lazy expansion
    └── fixtures/                    vendored CesiumGS 3d-tiles-samples (Apache-2.0)
```
