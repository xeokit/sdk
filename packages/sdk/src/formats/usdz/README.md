---
title: USDZ Format Guide
---
# USDZ (Pixar) Loader / Exporter

`USDZLoader` loads Pixar USDZ (`.usdz`) packages into a `SceneModel`, and
`USDZExporter` writes a `SceneModel` back out as USDZ.

USDZ is the format behind ARKit AR Quick Look; it's what Sketchfab,
Blender and Reality Composer export for AR. The loader handles the common
real-world case — a binary USD layer inside the package — by decoding it
with the [`tinyusdz`](https://github.com/lighttransport/tinyusdz) wasm
reader. The exporter writes an ASCII `.usda` layer (pure JS, no wasm).

---

## 1. What USDZ is

USDZ is **not** a model format — it's a **package**:

- An **uncompressed ZIP** archive (the spec mandates *stored*, 64-byte
  aligned entries, so a runtime can mmap them).
- Inside: a **root USD layer** plus textures and other assets.
- The root layer is one of two encodings, which need different readers:
  - **`.usdc`** — binary "Crate". What ARKit / Blender / Sketchfab
    produce by default.
  - **`.usda`** — ASCII text.
- The content is a **USD scenegraph**: typed prims (`Xform`, `Mesh`,
  `Material` / `UsdPreviewSurface`), attributes, and composition arcs.
  Default coordinate system: **Y-up, metres, right-handed**.

This SDK's own ZIP reader (`usdzArchive.ts`, dependency-free) unpacks the
package; `tinyusdz` decodes the USD layer.

---

## 2. Browser only (v1)

The published `tinyusdz` wasm is built **web / worker only** — it asserts
against Node. So USDZ loading works in the **browser / Studio** but
throws under Node (the `xeoconvert` CLI and headless tests). Node support
awaits a node-enabled wasm build.

The wasm (~1.9 MB) is fetched from a CDN and initialised lazily on first
load, then cached — it stays off the critical path until a `.usdz` is
actually loaded.

---

## 3. Load pipeline

```
   .usdz (ArrayBuffer)
        │
        ▼
   usdzArchive.ts:unpackUSDZ      stored-ZIP unpack → root layer + assets
        │
        ▼
   usdLayer.ts:detectUSDLayer     classify root: crate | ascii
        │
        ▼
   getTinyUSDZ() → TinyUSDZLoaderNative.loadFromBinary(rootBytes, name)
        │                          decodes USD crate/ascii → scenegraph
        ▼
   versions/v1/buildSceneModel.ts walk Xform/Mesh nodes → SceneModel
        │
        ▼
   SceneModel populated
```

`buildSceneModel` walks the node tree, composes each node's local matrix
down into a world matrix, and emits one `SceneGeometry` per distinct
tinyusdz mesh (instanced prims share geometry), one `SceneMaterial` per
material (UsdPreviewSurface → `color` / `opacity` / `metallic` /
`roughness`), and one `SceneMesh` + `SceneObject` per mesh-bearing node
(object id from the USD prim path). tinyusdz returns already-triangulated
meshes, so face indices are used as-is.

---

## 4. Usage

### Loader (browser only)

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {USDZLoader} from "@xeokit/sdk/formats/usdz";

const scene = new Scene();
const sceneModel = scene.createModel({id: "myModel"}).value;

const fileData = await (await fetch("model.usdz")).arrayBuffer();

await new USDZLoader().load({fileData, sceneModel});
```

The loader's `fileDataType` is `"arraybuffer"`, so read the `.usdz` as an
`ArrayBuffer` first.

USD is Y-up by default. Orient the result for your scene by setting the
`SceneModel.coordinateSystem` at `createModel` time, as for the FBX
loader.

### Exporter (runs anywhere)

```ts
import {USDZExporter} from "@xeokit/sdk/formats/usdz";

const usdzBytes = await new USDZExporter().write({sceneModel}); // ArrayBuffer
```

The exporter writes an ASCII `.usda` root layer wrapped in a stored,
64-byte-aligned ZIP — pure JS, so unlike the loader it works under Node
too. It serialises mesh geometry (points, triangles, normals), per-mesh
transforms, and UsdPreviewSurface materials (base colour, opacity,
metallic, roughness).

---

## 5. What v1 does not cover

- **Node / CLI / headless** — tinyusdz wasm is web-only.
- **Packaged textures** — the loader feeds tinyusdz only the root layer's
  bytes, so in-package image assets aren't resolved yet (material base
  colour / PBR scalars still apply).
- **Animation / skinning** (`UsdSkel`), **subdivision surfaces**,
  **variants / payload composition**, **point instancers**, **lights /
  cameras**, and **external (non-packaged) references**.
- **Export specifics** — the exporter writes ASCII `.usda` (not binary
  `.usdc`), inlines geometry per mesh (no USD reference-instancing), and
  does not write textures.

---

## 6. File map

```
formats/usdz/
├── README.md                     (this file)
├── USDZLoader.ts                 ModelLoader subclass — read entry point
├── USDZExporter.ts               ModelExporter subclass — write entry point
├── usdzArchive.ts                dependency-free stored-ZIP unpack + isUSDZ
├── usdzWriter.ts                 dependency-free stored-ZIP pack (aligned, CRC)
├── usdLayer.ts                   crate-vs-ascii detection
├── getTinyUSDZ.ts                lazy, cached, browser-only wasm initialiser
├── tinyusdz.d.ts                 ambient types for the untyped tinyusdz package
├── index.ts                      module re-exports
└── versions/v1/
    ├── parse.ts                  unpack → tinyusdz → buildSceneModel
    ├── buildSceneModel.ts        USD scenegraph → SceneModel (pure, tested)
    ├── encode.ts                 SceneModel → USDA scene → packUSDZ
    └── buildUSDA.ts              scene description → .usda text (pure, tested)
```
