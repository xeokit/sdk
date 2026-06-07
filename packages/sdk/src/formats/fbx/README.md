---
title: FBX Format Guide
---
# FBX (Autodesk FBX) Loader / Exporter

`FBXLoader` reads **binary** Autodesk FBX files into a `SceneModel`, and
`FBXExporter` writes a `SceneModel` back out as binary FBX.

This document describes the on-disk format we parse, the node graph we
walk inside it, and the pipeline a file follows from bytes to a live
scene (and back).

---

## 1. The FBX binary format

FBX is Autodesk's interchange format for 3D content. It comes in two
variants — **binary** and **ASCII**. This loader handles **binary
only**; ASCII files are detected and rejected.

A binary FBX file is a 27-byte header followed by a tree of node
records, terminated by a null record:

```
   ┌─────────────────────────────────────────────────────────────┐
   │ 0..20:  21-byte magic "Kaydara FBX Binary  \0"              │
   │ 21..22: two bytes 0x1A 0x00                                 │
   │ 23..26: little-endian uint32 file version                   │
   ├─────────────────────────────────────────────────────────────┤
   │ Node record                                                 │
   │ Node record                                                 │
   │   ...                                                       │
   │ Null record   (all-zero header, terminates the top level)   │
   └─────────────────────────────────────────────────────────────┘
```

### Node record

Each node record is:

```
   endOffset      uint32 or uint64    (offset of first byte AFTER this record)
   numProperties  uint32 or uint64
   propertyListLen uint32 or uint64    (bytes in the property list)
   nameLen        uint8
   name           nameLen bytes (ASCII)
   property[0]    type-code byte + payload
   property[1]    type-code byte + payload
   ...
   childRecord[0]
   childRecord[1]
   ...
   nullRecord                        (only if there are nested children)
```

The size of `endOffset` / `numProperties` / `propertyListLen` is
**uint32 for version < 7500** and **uint64 for version ≥ 7500**. The
null record terminator is correspondingly **13 bytes** or **25 bytes**.

### Property type codes

A property's first byte is a single-char type code; the payload follows
immediately:

| Code | Type | Payload |
|------|------|---------|
| `Y`  | int16 | 2-byte LE |
| `C`  | bool | 1 byte |
| `I`  | int32 | 4-byte LE |
| `F`  | float | 4-byte LE |
| `D`  | double | 8-byte LE |
| `L`  | int64 | 8-byte LE |
| `S`  | string | uint32 length, then bytes |
| `R`  | raw | uint32 length, then bytes |
| `f` `d` `l` `i` `b` | typed array | uint32 length, uint32 encoding, uint32 byte-length, then data |

For typed arrays, **encoding `1` is zlib-deflated** (the loader uses
`pako` to inflate it); `0` is raw.

### Logical layout

After parse, the loader sees one root with two key children:

- **`Objects`** — a flat list of named typed objects: `Geometry`,
  `Model`, `Material`, `Texture`, `Video`, and many others.
- **`Connections`** — a list of `C` records that wire objects together
  (`OO` = parent/child, `OP` = a property slot like a Material's
  `DiffuseColor` slot).

Every object is identified by its FBX **id** — a single int64 carried
as the object's first property. The connection graph references those
ids.

---

## 2. Node tree we walk (v1)

The loader keeps only the typed objects it knows what to do with, and
the connection graph that wires them.

```
                 Connections (C records)
                  │  parent  ──── relType ──── child  [+ prop slot for OP]
                  ▼
           ┌─────────────────────────────────────┐
           │  Model        (mesh instance, TRS)  │
           │   ├─── Geometry  (positions, polys, normals, UVs)
           │   └─── Material  (diffuse colour)
           │           └─── Texture
           │                    └─── Video  (embedded image bytes)
           └─────────────────────────────────────┘
```

For each `Model` the parser walks the connection graph to find its
attached `Geometry` (mandatory — non-mesh models like cameras and
lights are skipped) and its `Material` (optional). For the material,
it walks one more step to find a `Texture` connected on a colour slot
(`DiffuseColor` / `BaseColor` / `Color`), then the texture's connected
`Video` for the embedded image bytes.

### Other node kinds

The following object types are recognised by name but **not** consumed
by v1 — they're skipped silently rather than warned about:

- `NodeAttribute`, `AnimationCurve`, `AnimationLayer`, `AnimationStack`
  — animation framework.
- `Deformer`, `SubDeformer` — skinning.
- `Pose`, `BindPose` — rest poses.
- `NurbsCurve`, `NurbsSurface` — NURBS primitives.
- `CollectionExclusive`, `Implementation`, `BindingTable`, `ShadingNode`
  — material binding plumbing.

---

## 3. Load pipeline

```
   .fbx bytes (ArrayBuffer)
        │
        ▼
   fbxBinaryReader.ts:readFBXBinary  ←  magic check → walk records (32/64-bit aware)
        │                                inflate zlib arrays
        ▼
   FBXNode tree
        │
        ▼
   versions/binary/parse.ts
        │
        ├─ index `Objects` children by id  →  Map<id, FBXNode>
        │
        ├─ index `Connections.C`           →  Map<parentId, [{id, prop}]>
        │
        ├─ for each Model:
        │     locate Geometry + (optional) Material via the graph
        │     │
        │     ├─ extractGeometry      (control points + polygons → triangulated corners)
        │     ├─ emitDiffuseTexture   (Material → Texture → Video.Content → ImageBitmap)
        │     ├─ extractDiffuse       (Properties70 DiffuseColor → [r,g,b])
        │     ├─ extractModelMatrix   (Properties70 Lcl Translation/Rotation/Scaling → Mat4)
        │     │
        │     ▼
        │   sceneModel.createGeometry(once per FBX geom id, shared via instancing)
        │   sceneModel.createTexture (once per FBX texture id)
        │   sceneModel.createMaterial
        │   sceneModel.createMesh    (one per Model)
        │   sceneModel.createObject  (id from Model name, deduped)
        │
        ▼
   SceneModel populated
```

### Header detection

`isBinaryFBX` matches only the 18-byte printable prefix `"Kaydara FBX
Binary"`. The trailing spaces + `\0` aren't required by every exporter.
ASCII FBX files fail this check and the loader rejects them upstream
(`getVersion` returns `""`, which the base `ModelLoader` reports as
"unsupported version").

### Geometry extraction

```
   Vertices (control points)        flat double array, 3 per point
   PolygonVertexIndex                flat int array, one index per
                                     corner — the LAST corner of each
                                     polygon is encoded as -(idx+1)
                                     (negation marks the polygon end)
```

The parser:

1. **Walks each polygon** by scanning `PolygonVertexIndex` until a
   negative value flags the polygon end.
2. **Fan-triangulates** the polygon (works for any convex N-gon; non-
   convex polygons aren't common in mesh exporters).
3. **Expands per-corner** — every triangle corner is emitted as a
   fresh vertex. The output is non-indexed positions; the index buffer
   is a trivial `0..N-1` identity. Vertex sharing is a later
   optimisation.
4. **Looks up normals and UVs** through `LayerElementNormal` /
   `LayerElementUV` honouring the `MappingInformationType`
   (`ByPolygonVertex` / `ByControlPoint` / `ByVertice` / `AllSame`)
   and `ReferenceInformationType` (`Direct` / `IndexToDirect`).

### Transform extraction

A `Model`'s local transform comes from its `Properties70` block:

```
   Lcl Translation  →  [tx, ty, tz]
   Lcl Rotation     →  [rx, ry, rz]    (Euler degrees, X-Y-Z order)
   Lcl Scaling      →  [sx, sy, sz]
```

Composed inline as `M = T · Rz · Ry · Rx · S` (column-major 4×4
`Float64`). FBX's full pivot / pre-rotation / post-rotation chain is
**not** applied — most real-world content has zero pivots, but content
that relies on them will be slightly off.

### Material extraction

`extractDiffuse` reads `Properties70 → DiffuseColor` (falling back to
`Diffuse`), giving an `[r, g, b]` triple. Defaults to a neutral grey
when absent. No PBR — base colour only.

### Texture extraction (embedded only)

The diffuse-texture path:

1. From the Material's connections, find a `Texture` wired to a colour
   slot (`/diffusecolor|basecolor|^color$/i`). Falls back to any
   connected `Texture` if no colour-slotted one exists.
2. From the Texture's connections, find a connected `Video`.
3. Read the `Video → Content` property — it's a `Uint8Array` of the
   raw image bytes (PNG/JPEG).
4. When `createImageBitmap` is available (browser), decode it to an
   `ImageBitmap` and pass it as the texture's `image`. Otherwise pass
   the raw bytes as `buffers: [ArrayBuffer]` so the data still
   round-trips through tests.

**Not handled:** external-file textures (`Texture.RelativeFilename` /
`Texture.FileName` with no embedded data). Resolving them needs a base
URL the loader isn't given; they're skipped with a console warning.

### Geometry / material / texture instancing

The loader keeps `Map<fbxId, sceneId>` per object kind. Multiple `Model`
records sharing the same `Geometry` produce one `SceneGeometry` and one
`SceneMesh` per Model that references it — same for materials and
textures. The connection graph drives the wiring; nothing is
duplicated.

### SceneObject ids

Each `Model` becomes one `SceneObject`. The id is sourced from the
Model's full FBX name property (`"name\0\x01Model"`), stripped of the
trailing `\0\x01Model` tag. Collisions are resolved with a numeric
suffix (`Foo`, `Foo_1`, `Foo_2`).

---

## 4. Export pipeline

`FBXExporter` writes the inverse path. The encoder
(`versions/binary/encode.ts`) builds an `FBXNode` tree mirroring the
loader's expectations:

```
   SceneModel
        │
        ▼
   encode.ts
        │
        ├─ collect SceneGeometry → emit one Geometry node per id
        ├─ collect SceneMaterial → emit one Material node per id
        ├─ collect SceneTexture  → emit one Texture + Video pair per id
        ├─ for each SceneMesh    → emit one Model node + connect to its
        │                          Geometry / Material
        │
        ▼
   FBXNode tree (Objects + Connections)
        │
        ▼
   fbxBinaryWriter.ts:writeFBXBinary
        │
        ├─ 27-byte header (magic + version)
        ├─ recursively serialise records (32-bit offsets by default)
        └─ trailing null record
        │
        ▼
   ArrayBuffer
```

**Out of scope for the writer:** animation, skinning, the
SceneModel's coordinate system (the output sits in whatever
orientation the meshes were authored in), and external-file textures.

---

## 5. Coordinate system

FBX is **Y-up or Z-up** depending on the file's `GlobalSettings`. The
loader does **not** read `GlobalSettings` — it places geometry in the
exact local TRS the file specifies. Orient the result for your scene
by setting the `SceneModel.coordinateSystem` at creation time:

```ts
const sceneModel = scene.createModel({
  id: "myModel",
  coordinateSystem: {
    basis: [1,0,0, 0,0,1, 0,-1,0],   // Y-up → Z-up rotation
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1,
  },
}).value!;
```

---

## 6. Usage

### Loader

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {FBXLoader} from "@xeokit/sdk/formats/fbx";

const scene = new Scene();
const sceneModel = scene.createModel({id: "myFBX"}).value!;

const fileData = await (await fetch("./model.fbx")).arrayBuffer();

await new FBXLoader().load({fileData, sceneModel});
```

The loader's `fileDataType` is `"arraybuffer"`, so application code
must read the `.fbx` file as an `ArrayBuffer` before handing it over.

### Exporter

```ts
import {FBXExporter} from "@xeokit/sdk/formats/fbx";

const arrayBuffer = await new FBXExporter().write({sceneModel});
```

---

## 7. What v1 does not cover

The features below are out of scope for this version.

### Loader gaps

- **ASCII FBX** — rejected at the magic check. Use a converter to
  binary first (Autodesk's `FBX Converter` ships with the SDK; many
  tools export both).
- **Animation** — `AnimationCurve` / `AnimationLayer` /
  `AnimationStack` nodes are ignored; nothing time-varying is emitted.
- **Skinning & deformers** — `Deformer` / `SubDeformer` /
  `BindPose` are ignored. Skinned meshes load in their bind pose.
- **External-file textures** — `RelativeFilename` /
  `Filename` without embedded `Video.Content` produces a console
  warning and no texture. No base-URL resolution.
- **NURBS** — `NurbsCurve` / `NurbsSurface` are ignored. Tessellate to
  triangles before export.
- **Full pivot chain** — `PreRotation`, `PostRotation`,
  `RotationPivot`, `ScalingPivot`, `RotationOffset`, `ScalingOffset`
  are not applied. Only `Lcl Translation / Rotation / Scaling` is.
- **Non-colour texture slots** — normal maps, metallic-roughness,
  emissive, etc are wired in the FBX graph but the loader only
  consumes the colour slot.
- **Per-corner colours** (`LayerElementColor`) — ignored.
- **GlobalSettings** — `UpAxis` / `FrontAxis` / `UnitScaleFactor` are
  not read; caller supplies the SceneModel coordinate system.

### Exporter gaps

- Mirror set: no animation, skinning, external textures, NURBS, or
  GlobalSettings.
- SceneModel's coordinate system is not baked into the file; the
  output meshes sit in their authored local frames.

Each of these slots into the existing object/connection graph if and
when prioritised.

---

## 8. File map

```
formats/fbx/
├── README.md                              (this file)
├── FBXLoader.ts                           ModelLoader subclass — entry point
├── FBXExporter.ts                         ModelExporter subclass — write-side
├── FBXNode.ts                             FBXNode interface + findChild helper
├── fbxBinaryReader.ts                     binary file → FBXNode tree (32/64-bit, zlib)
├── fbxBinaryWriter.ts                     FBXNode tree → binary file
├── index.ts                               module re-exports
├── fbx.test.ts                            round-trip + reader/writer unit tests
└── versions/binary/
    ├── parse.ts                           FBXNode tree → SceneModel
    └── encode.ts                          SceneModel → FBXNode tree
```
