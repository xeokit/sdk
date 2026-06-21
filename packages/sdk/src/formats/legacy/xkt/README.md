---
title: XKT Format Guide
---
# XKT (xeokit v2 native) Loader / Exporter

`XKTLoader` imports the geometry, instancing, and embedded metadata of xeokit v2's
native **XKT** binary format into a `SceneModel` and a `DataModel`, and `XKTExporter`
writes a `SceneModel` (plus optional `DataModel`) back out as XKT.

XKT is the format produced by `xeokit-convert` for xeokit v2. It is superseded by
[XGF](../../xgf/README.md) in v3, but remains supported so existing XKT assets load
directly into a v3 scene.

This document describes the container we accept, the subset of the format this version
honours, and the pipeline a file follows from bytes to a live scene (and back).

---

## 1. The XKT container

An `.xkt` file is a single binary buffer holding a flat **offset table** followed by a
list of typed-array and JSON payloads:

```
   model.xkt
   ├── u32[0]              version tag (12)
   ├── u32[1], u32[2]      entry 0: (byteOffset, byteLength)
   ├── u32[3], u32[4]      entry 1: (byteOffset, byteLength)
   ├── …                   one (offset, length) pair per array
   └── payloads            each entry's bytes, aligned to its element size
```

Word 0 is the version (a little-endian `uint32`, value `12`). The remaining header is
interleaved `(byteOffset, byteLength)` pairs, one per array, that address typed-array
views directly into the buffer. All multi-byte values are little-endian and byte-swapped
on big-endian hosts. The read order is positional, so the reader and writer must agree on
the entry sequence exactly. This is the **uncompressed** container (the high version bit
clear), matching `xeokit-convert`'s uncompressed writer.

Three of the entries are UTF-8 JSON blobs rather than numeric arrays:

- **`metadata`** — model and per-object metadata: `metaObjects` (the semantic object
  tree) and `propertySets`.
- **`eachEntityId`** — the object id string for each entity.
- **`eachGeometryAxisLabel`** — per-geometry text labels (IFC axis labels).

### Pooled geometry and portion indexing

XKT pools **all** geometry into shared arrays — 16-bit quantised `positions`, `indices`,
`colors`, `uvs`, `normals`, `edgeIndices` — rather than storing a separate buffer per
mesh. Each geometry owns a slice of every pooled array, addressed by a parallel set of
**portion** base indices (`eachGeometryPositionsPortion`, `eachGeometryIndicesPortion`,
…). A geometry's data runs from its base index to the next geometry's base (or the array
end for the last geometry). The same scheme links meshes to geometries
(`eachMeshGeometriesPortion`), entities to meshes (`eachEntityMeshesPortion`), and tiles
to entities (`eachTileEntitiesPortion`).

### Tiles, quantisation, and instancing

Positions are 16-bit quantised and dequantised through a **decode matrix** (a diagonal
scale plus translation that maps the `0…65535` range linearly across a bounding box):

- Geometry used by a **single mesh** is decoded against its **tile's** decode matrix,
  derived from `eachTileAABB`, placing it in that tile's coordinate frame.
- Geometry shared by **several meshes** (instanced) is decoded once against the shared
  `reusedGeometriesDecodeMatrix` into a local frame, then each mesh positions it with its
  own 4×4 matrix from the pooled `matrices` array.

Per-mesh material is six bytes in `eachMeshMaterialAttributes`: RGB colour, opacity,
metallic, roughness.

Primitive types are coded per geometry (`eachGeometryPrimitiveType`):

| Code | XKT primitive | Imported as |
|---|---|---|
| 0 | solid (closed triangles) | `TrianglesPrimitive` |
| 1 | surface (open triangles) | `TrianglesPrimitive` |
| 2 | points | `PointsPrimitive` |
| 3 | lines | `LinesPrimitive` |
| 4 | line-strip | `LinesPrimitive` (expanded to discrete segment pairs) |
| 7 | text labels, … | skipped |

---

## 2. Load pipeline

```
   .xkt bytes (ArrayBuffer)
        │
        ▼
   unpackXKT.ts            ←  offset table → typed-array views + JSON blobs (XKTData_v12)
        │
        ▼
   xktToModel.ts
        ├─ buildDataModel  ←  metadata.propertySets / metaObjects → DataObjects + BasicAggregation
        │
        └─ for each tile   ←  tile centre + decode matrix from eachTileAABB
             for each entity in tile
               for each mesh
                 ├─ createGeometry   (once per geometry — dequantise positions, indices/colours)
                 ├─ createMesh       (RTC origin = tile centre; colour/opacity; matrix if instanced)
                 └─ createObject     (id = entity id; groups the tile's meshes)
```

A geometry is created **once** and reused across every mesh that references it (so an
instanced part uploads one geometry and many lightweight meshes). The loader yields to the
host every few tiles, and honours an `AbortSignal` in its options.

If only a `dataModel` is passed (no `sceneModel`), the loader builds just the semantic
object tree — useful for headless metadata extraction.

---

## 3. Coordinate system & precision

XKT bakes its full-precision strategy into the file as **spatial tiles**. Each tile's
centre is computed from its AABB and used as the **RTC `origin`** of every mesh in that
tile, so each tile's geometry stays near its own origin regardless of the model's absolute
position. A georeferenced or city-scale model therefore loads at full precision without
any per-application accommodation.

Because the RTC anchors are part of the asset, an XKT file does not carry the per-model
`coordinateSystem` (basis / origin / units) declaration that native v3 models use; the
loader places geometry in the file's authored space, deriving RTC origins from the tiles.

---

## 4. Usage

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {Data} from "@xeokit/sdk/model/data";
import {XKTLoader, XKTExporter} from "@xeokit/sdk/formats/xkt";

const sceneModel = new Scene().createModel({id: "myModel"}).value;
const dataModel = new Data().createModel({id: "myModel"}).value;

const fileData = await (await fetch("model.xkt")).arrayBuffer();
await new XKTLoader().load({fileData, sceneModel, dataModel});
```

Both the loader and exporter declare `fileDataType: "arraybuffer"`, so read the `.xkt`
file as an `ArrayBuffer` before loading, and the exporter resolves to one.

### Exporter

```ts
const arrayBuffer = await new XKTExporter().write({sceneModel, dataModel});
```

`XKTExporter` is the inverse of the loader and round-trips with it. It writes a valid
**uncompressed XKT v12** file: the `SceneModel`'s geometry, meshes and per-mesh colour /
opacity, plus the `DataModel`'s object tree and property sets as the embedded `metadata`.
For simplicity it emits a **single tile** and **one geometry per mesh** (geometry is not
re-instanced) with **no textures**.

---

## 5. What this version does not cover

- **XKT version 12 only.** Older XKT versions and the legacy zlib-deflated container are
  not handled — only the uncompressed offset-table container emitted by current
  `xeokit-convert`.
- **Materials beyond flat colour + opacity** — metallic / roughness, textures and texture
  sets are present in the container but not applied on import; the exporter writes none.
- **Vertex normals** — XKT v12 carries no normals for the geometry the loader reads, so
  normals are left off and the renderer derives per-face flat normals. This suits the
  faceted, architectural geometry XKT typically holds; smoothing shared-vertex normals
  would smear shading across hard edges.
- **Edge indices** — read past but not emitted by the exporter.
- **Text-label geometry** (primitive code 7) is skipped.

---

## 6. File map

```
formats/legacy/xkt/
├── README.md                  (this file)
├── XKTLoader.ts               ModelLoader subclass — public
├── XKTExporter.ts             ModelExporter subclass — public
├── index.ts                   module re-export (loader + exporter) + docs
└── versions/v12/
    ├── parse.ts               load entry: unpackXKT → xktToModel
    ├── unpackXKT.ts           binary → XKTData_v12 (offset table → typed-array views)
    ├── xktToModel.ts          XKTData_v12 → SceneModel (+ DataModel)
    ├── modelToXKT.ts          SceneModel (+ DataModel) → XKTData_v12
    ├── packXKT.ts             XKTData_v12 → binary (offset-table container)
    ├── encode.ts              export entry: modelToXKT → packXKT
    ├── XKTData_v12.ts         decoded payload interface
    └── XKT_INFO.ts            version constant (12)
```

Only `XKTLoader` and `XKTExporter` are exported from the module; the binary codecs
(`unpackXKT` / `packXKT`) and the version parsers/encoders are internal and not
re-exported.
