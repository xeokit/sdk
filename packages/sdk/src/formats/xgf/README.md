---
title: XGF Format Guide
---
# XGF (xeokit Geometry Format) Loader / Exporter

`XGFLoader` reads xeokit's native binary geometry format (`.xgf`) into a
`SceneModel`, and `XGFExporter` writes a `SceneModel` back out as XGF.

This document describes the binary container, the two on-disk schema
versions, and the pipelines a file follows from bytes to a live scene
(and back).

---

## 1. What XGF is

XGF is xeokit's compact binary format for **geometry, materials, and
textures** — the visual half of a model. It's positional, length-
prefixed, and designed to be loaded in one fetch + a handful of
typed-array views.

Two roles:

- **Visual half** — the SceneModel — lives in `.xgf`.
- **Semantic half** — the DataModel — typically lives in a separate
  `.json` sidecar (one of the xeokit `datamodel` / `metamodel`
  formats). Pair them by id and load them together.

The XGF loader's DataModel output is intentionally minimal: every
SceneObject id also becomes a `BasicEntity` DataObject so the
SceneModel ↔ DataModel pair is always queryable. Richer semantics
come from a paired DataModel JSON.

### Trade-offs

- Positions are **quantised to 16-bit** against per-geometry AABBs —
  no precision loss for typical model scales (mm precision at world
  sizes up to ~65 m per geometry; rescale your AABBs for bigger
  scenes).
- Normals are **oct-encoded** into two `uint16`s per vertex, decoded
  in the vertex shader.
- UVs are `float32` so tiling values outside `[0, 1]` survive intact.
- Edge indices ride alongside triangle indices so the renderer's
  wireframe overlay is free.
- The format intentionally has **no compression layer of its own** —
  use HTTP transport-level compression (gzip / brotli) at delivery
  time.

---

## 2. Binary container

Every XGF file (v1 or v2) is the same outer container — a version
tag, an `(offset, length)` table, and a sequence of typed-array
payloads laid out at those offsets:

```
   ┌──────────────────────────────────────────────────────────────┐
   │ 0..3        uint32 version              (1 or 2)             │
   ├──────────────────────────────────────────────────────────────┤
   │ 4..7        uint32 entry[0].byteOffset                       │
   │ 8..11       uint32 entry[0].byteLength                       │
   │ 12..15      uint32 entry[1].byteOffset                       │
   │ 16..19      uint32 entry[1].byteLength                       │
   │ ...         (one (offset, length) pair per entry)            │
   ├──────────────────────────────────────────────────────────────┤
   │ entry[0]    typed-array payload  (padded to its BPE align)   │
   │ entry[1]    typed-array payload                              │
   │ ...                                                          │
   └──────────────────────────────────────────────────────────────┘
```

- **Little-endian.** The reader byte-swaps on big-endian hosts (a
  one-time `Uint16Array[0] === 1` probe decides whether swapping is
  needed).
- **Position alignment.** Each payload starts at the smallest offset
  ≥ the running cursor that's an integer multiple of the payload's
  `BYTES_PER_ELEMENT`. Padding bytes between payloads are unused.
- **Positional layout.** The reader and writer walk the same fixed
  list of entries in the same order. There's no name dictionary —
  adding or removing an entry is a schema-version-breaking change.
- **JSON-as-bytes.** A handful of entries (e.g. `eachObjectId`,
  `eachMaterialId`) are JSON arrays of strings; they ride in the
  container as `Uint8Array` blobs the reader `JSON.parse`s on
  demand.

---

## 3. The two versions

XGF has shipped two schema revisions. The loader handles both; the
exporter writes either via its `version` parameter.

| Version | Adds |
|---|---|
| **v1** (`1.0.0`) | base — geometry (positions, colors, indices, edge indices), per-geometry AABBs, modelling matrices, meshes referencing per-mesh inline RGBA colours, objects referencing meshes. |
| **v2** (`1.1.0`, "XKT2") | adds **per-geometry normals + UVs**; **textures** (image bytes + sampler params); **materials** with full PBR + alpha mode / cutoff; **per-mesh material references** (with inline RGBA as the fallback when no material is set). |

The v1 reader is still in the codebase so existing `.xgf` files keep
loading; new exports should target v2 unless you have a v1-only
consumer.

The default exporter version is `1.0.0`. Pass `version: "1.1.0"` to
the writer to emit v2.

---

## 4. v2 payload

Field order = pack order = read order. See
[`versions/v2/XGFData_v2.ts`](versions/v2/XGFData_v2.ts) for the
authoritative TypeScript shape.

### Geometry (per-vertex blobs)

| Entry | Type | Meaning |
|---|---|---|
| `positions` | `Uint16Array` | Quantised positions (R G B 16-bit per vertex). Decode against the geometry's AABB: `p = uint * (max - min) / 65535 + min`. |
| `colors` | `Uint8Array` | Per-vertex RGBA (4 bytes/vertex). |
| `indices` | `Uint32Array` | Triangle / line indices. |
| `edgeIndices` | `Uint32Array` | Wireframe edge indices. |
| `aabbs` | `Float32Array` | Per-geometry AABBs (six floats: `minX minY minZ maxX maxY maxZ`). Multiple geometries may share an AABB by pointing at the same base. |
| `normals` | `Uint16Array` | **v2 only.** Octahedral RG16UI normals, two values per vertex. Geometries without normals occupy zero range. |
| `uvs` | `Float32Array` | **v2 only.** RG32F UVs, two values per vertex. Floats (not quantised) so tiling values round-trip. |

### Per-geometry pointers

`eachGeometry*` is a per-geometry array; each entry is the **base
index** into the global blob it points to. The geometry's slice runs
from its base to (the next geometry's base) or (the global blob's
length).

| Entry | Type | Meaning |
|---|---|---|
| `eachGeometryPositionsBase` | `Uint32Array` | Base into `positions`. |
| `eachGeometryColorsBase` | `Uint32Array` | Base into `colors`. |
| `eachGeometryIndicesBase` | `Uint32Array` | Base into `indices`. |
| `eachGeometryEdgeIndicesBase` | `Uint32Array` | Base into `edgeIndices`. |
| `eachGeometryNormalsBase` | `Uint32Array` | Base into `normals`, or `0xffffffff` if this geometry has no normals. |
| `eachGeometryUVsBase` | `Uint32Array` | Base into `uvs`, or `0xffffffff` if no UVs. |
| `eachGeometryPrimitiveType` | `Uint8Array` | `0` Triangles, `1` Solid, `2` Surface, `3` Lines, `4` Points. |
| `eachGeometryAABBBase` | `Uint32Array` | Base into `aabbs` (multiple of 6). |

### Modelling matrices

| Entry | Type | Meaning |
|---|---|---|
| `matrices` | `Float64Array` | Concatenated 4×4 column-major modelling matrices. Each mesh points at one. |

### Textures (v2 only)

| Entry | Type | Meaning |
|---|---|---|
| `textureData` | `Uint8Array` | Concatenated encoded image bytes (PNG / JPEG / GIF or opaque transcoded buffer). |
| `eachTextureDataBase` | `Uint32Array` | Base into `textureData`. |
| `eachTextureMediaType` | `Uint8Array` | `0` PNG, `1` JPEG, `2` GIF, `255` opaque transcoded buffer (treat as raw bytes; not decoded at load time). |
| `eachTextureWidth` | `Uint16Array` | Per-texture pixel width. |
| `eachTextureHeight` | `Uint16Array` | Per-texture pixel height. |
| `eachTextureSampler` | `Uint8Array` | Five bytes per texture: `minFilter, magFilter, wrapS, wrapT, wrapR`. Each is a small-integer code (1–9) matching the `xeokit/base/constants` sampler enums. |
| `eachTextureId` | `string[]` | Per-texture string ID (JSON blob). |

### Materials (v2 only)

| Entry | Type | Meaning |
|---|---|---|
| `eachMaterialPBR` | `Uint8Array` | Eight bytes per material: `R, G, B, opacity, roughness, metallic, alphaMode, alphaCutoff`. All values quantised to `[0, 255]` from `[0, 1]`. `alphaMode` is `0` OPAQUE, `1` MASK, `2` BLEND. |
| `eachMaterialTextures` | `Int32Array` | Five entries per material: `colorTextureIndex, metallicRoughnessTextureIndex, normalsTextureIndex, occlusionTextureIndex, emissiveTextureIndex`. Each is a 0-based index into `eachTextureId`, or `-1` for "no texture". |
| `eachMaterialId` | `string[]` | Per-material string ID (JSON blob). |

### Per-mesh

| Entry | Type | Meaning |
|---|---|---|
| `eachMeshGeometriesBase` | `Uint32Array` | Index into the geometry list (each mesh references exactly one geometry). |
| `eachMeshMatricesBase` | `Uint32Array` | Index into `matrices` (multiple of 16). |
| `eachMeshMaterialAttributes` | `Uint8Array` | Inline RGBA fallback (4 bytes/mesh: R, G, B, opacity). Used when `eachMeshMaterial` is `-1`. |
| `eachMeshMaterial` | `Int32Array` | Index into the material array, or `-1` to fall back to `eachMeshMaterialAttributes`. **v1 has no materials; always falls back.** |

### Per-object

| Entry | Type | Meaning |
|---|---|---|
| `eachObjectId` | `string[]` | Per-object string ID (JSON blob). |
| `eachObjectMeshesBase` | `Uint32Array` | Base into the per-mesh arrays. The object's meshes run from its base to (the next object's base) or (mesh count). |

### v1 payload

v1 is the same shape as v2 minus `normals`, `uvs`,
`eachGeometryNormalsBase`, `eachGeometryUVsBase`, `eachGeometryPrimitiveType`,
all texture entries, and all material entries. The v1 reader treats
every mesh as inline-RGBA and emits `TrianglesPrimitive` geometries by
default. See [`versions/v1/XGFData_v1.ts`](versions/v1/XGFData_v1.ts).

---

## 5. Load pipeline

```
   .xgf bytes (ArrayBuffer)
        │
        ▼
   XGFLoader.getVersion       ←  read uint32 [0]: "1" or "2"
        │
        ▼
   versions/v{N}/parse.ts
        │
        ├─ unpackXGF              ←  walk the (offset, length) table,
        │                            byte-swap on big-endian hosts,
        │                            create typed-array views in place
        │                            (zero copies)
        │
        ▼
   XGFData_v{N}  payload
        │
        ▼
   xgfToModel              ←  walks objects → meshes → geometries
        │
        ├─ decode textures (v2)
        │     PNG/JPEG/GIF → createImageBitmap → sceneModel.createTexture
        │     opaque       → pass raw bytes through with `compressed: true`
        │     empty        → register a 1×1 white pixel placeholder
        │
        ├─ build materials (v2)
        │     PBR + alpha + texture references → sceneModel.createMaterial
        │
        ├─ for each object:
        │     for each mesh:
        │       ensure geometry created once → sceneModel.createGeometryCompressed
        │           (per-vertex slices come from `eachGeometry*Base` arrays;
        │            normals/UVs slices end at the *next* geometry with
        │            non-sentinel base, since geometries without
        │            normals/UVs are sparsely indexed)
        │       resolve mesh transform from matrices[base..base+16]
        │       resolve material (v2) or inline RGBA (v1 / unset)
        │       sceneModel.createMesh
        │     sceneModel.createObject({id, meshIds, layerId})
        │     dataModel.createObject({id, type: "BasicEntity"})
        │     dataModel.createRelationship({type: "BasicAggregation", …})
        │
        ▼
   SceneModel + DataModel populated
```

### Cancellation + progress

Every async-loop site calls `yieldToHost(signal)` at a coarse cadence
(every 4 textures, every 32 objects). Two effects:

- **Progress** — `options.onProgress` fires with `{phase, current,
  total}` at the same cadence.
- **AbortSignal** — `yieldToHost` checks `signal.aborted` and throws
  `DOMException("Aborted", "AbortError")` on cancel. Worst-case
  abort latency is one yield interval (≈16 ms).

### Texture decoding

PNG/JPEG/GIF blobs are decoded through `createImageBitmap` so the GPU
atlas can sample them directly. Outside a browser (Node test runs,
worker contexts without `createImageBitmap`) the loader will throw —
the path assumes a browser. For pre-decoded ("opaque transcoded")
textures the bytes pass through unchanged as a SceneTexture buffer; the
runtime / transcoder pipeline handles upload.

---

## 6. Export pipeline

```
   SceneModel
        │
        ▼
   modelToXGF (v1 or v2)
        │
        ├─ flatten geometries → concatenated positions / colors /
        │                       indices / edge indices, build base arrays
        ├─ flatten matrices  ← one per mesh
        ├─ encode textures (v2)
        │     imageBitmap → canvas.toBlob("image/png") → bytes
        │     buffers     → passed through unchanged
        ├─ build per-material PBR bytes + texture-index references (v2)
        ├─ build per-mesh material index OR inline RGBA fallback
        └─ build per-object id + mesh-base arrays
        │
        ▼
   XGFData_v{N}  payload
        │
        ▼
   packXGF                  ←  positional pack; byte-swap on big-endian,
        │                      pad each payload to its BPE alignment,
        │                      embed JSON arrays as Uint8 blobs
        ▼
   .xgf bytes  (ArrayBuffer)
```

### Round-trip

The `pack ↔ unpack` halves walk the same positional list in the same
order — adding, removing, or reordering an entry is a
schema-version-breaking change that requires bumping the version tag
in `XGF_INFO.xgfVersion` and a matching reader.

Geometry data round-trips through `createGeometryCompressed` (load
side) and the corresponding v2 packer (write side) without
re-decompressing. Per-vertex positions, normals, UVs and indices are
already quantised in the SceneModel, so the writer mostly concatenates
buffers and emits base arrays.

### Coordinate-system transform

If `options.coordinateSystem` is passed to the exporter,
`getMeshWorldMatrix` bakes the SceneModel-space → target-space
transform into each mesh's modelling matrix before pack. The XGF
container itself doesn't carry a coordinate-system field — the caller
specifies it at load time via the SceneModel.

### Texture encoding

`imageBitmap`-backed SceneTextures are re-encoded to PNG bytes via an
`OffscreenCanvas` (or a `<canvas>` fallback). `buffers`-backed
SceneTextures pass through verbatim, with `mediaType: 255` flagging
the opaque-transcoded case.

---

## 7. Quantisation conventions

### Positions (Uint16 against per-geometry AABB)

```
   uint16 = round((double - min) * 65535 / (max - min))
   double = uint16 * (max - min) / 65535 + min
```

Applied per axis, per geometry. The AABB ships in `aabbs` and is
referenced by `eachGeometryAABBBase`. Multiple geometries can share
an AABB to save space when they cover the same volume.

Practical implication: keep each geometry's AABB tight to its actual
extent. At a 1-metre AABB you get ~15 µm precision; at a 100-metre
AABB you get ~1.5 mm.

### Normals (oct-encoded Uint16 RG)

Each normal is folded to the unit-octahedron's 2D parameterisation,
then quantised to two 16-bit unsigned ints. Decoded in the vertex
shader — the renderer's `unoctEncodedVec3` does the inverse. Cost:
2 bytes/normal vs 12 bytes for raw float3.

### UVs (Float32 RG)

Floats, not quantised. Tiling values outside `[0, 1]` (e.g. for
repeat-mapping a brick texture across a wall) need to survive intact,
which they wouldn't through a `0..1`-clamped quantisation.

---

## 8. Usage

### Loader

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {Data}  from "@xeokit/sdk/model/data";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";

const scene = new Scene();
const data  = new Data();

const sceneModel = scene.createModel({id: "myModel"}).value!;
const dataModel  = data.createModel({id: "myModel"}).value!;

const fileData = await (await fetch("./model.xgf")).arrayBuffer();

await new XGFLoader().load({
  fileData,
  sceneModel,
  dataModel,
});
```

The loader's `fileDataType` is `"arraybuffer"`. Pass a `DataModel` to
also receive the loader's minimal `BasicEntity` graph keyed by
SceneObject id; omit it if you'll pair the SceneModel with a
hand-authored DataModel from a JSON sidecar.

### Exporter

```ts
import {XGFExporter} from "@xeokit/sdk/formats/xgf";

const arrayBuffer = await new XGFExporter().write({
  sceneModel,
  version: "1.1.0",   // omit for default "1.0.0"
});
```

The exporter's `fileDataType` is `"arraybuffer"`. The `dataModel`
parameter is accepted by the base `ModelExporter` API but XGF is a
geometry-only format — semantic data should be written separately
through the `datamodel` JSON exporter.

### Pairing with DataModel JSON

The canonical streamed-model payload is **`.xgf` + `.json`** loaded
together:

```ts
import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {XGFLoader}             from "@xeokit/sdk/formats/xgf";

await Promise.all([
  new DataModelImporter().load({
    fileData: await (await fetch("./model.json")).json(),
    dataModel,
  }),
  new XGFLoader().load({
    fileData: await (await fetch("./model.xgf")).arrayBuffer(),
    sceneModel,
    dataModel,  // safe to share — the XGF BasicEntity graph merges
                // with the JSON-authored DataObjects by id
  }),
]);
```

---

## 9. What XGF does not carry

- **Animation / skinning.** XGF is a static-geometry format. Time-
  varying transforms aren't representable.
- **Cameras, lights.** The format describes meshes + materials, not
  the surrounding scene.
- **NURBS / B-rep / parametric primitives.** Geometry must be
  tessellated to triangles (or lines / points) before export.
- **Section planes.** A runtime view-side concept; not in the file.
- **Semantic structure.** DataObjects / Relationships /
  PropertySets live in the paired DataModel JSON; XGF only carries
  object IDs so the two halves can pair up.
- **Coordinate system metadata.** The runtime caller specifies the
  coordinate system via `SceneModel.coordinateSystem`; the file
  itself is coordinate-system-agnostic.
- **Pre-encoded compression layer.** No built-in zstd / draco /
  meshopt step. Use HTTP-layer compression (gzip / brotli) for wire
  efficiency.

---

## 10. File map

```
formats/xgf/
├── README.md                              (this file)
├── XGFLoader.ts                           ModelLoader subclass — version dispatch
├── XGFExporter.ts                         ModelExporter subclass — version dispatch
├── index.ts                               module re-exports
└── versions/
    ├── v1/
    │   ├── XGF_INFO.ts                    {xgfVersion: 1}
    │   ├── XGFData_v1.ts                  v1 payload type
    │   ├── parse.ts                       load pipeline entry — unpack → xgfToModel
    │   ├── encode.ts                      write pipeline entry — modelToXGF → pack
    │   ├── unpackXGF.ts                   ArrayBuffer → XGFData_v1 (positional, BE-aware)
    │   ├── packXGF.ts                     XGFData_v1 → ArrayBuffer
    │   ├── xgfToModel.ts                  XGFData_v1 → SceneModel + DataModel
    │   └── modelToXGF.ts                  SceneModel → XGFData_v1
    └── v2/
        ├── XGF_INFO.ts                    {xgfVersion: 2}
        ├── XGFData_v2.ts                  v2 payload type (adds normals, UVs, textures, materials)
        ├── parse.ts                       load pipeline entry
        ├── encode.ts                      write pipeline entry
        ├── unpackXGF.ts                   ArrayBuffer → XGFData_v2
        ├── packXGF.ts                     XGFData_v2 → ArrayBuffer
        ├── xgfToModel.ts                  XGFData_v2 → SceneModel + DataModel
        └── modelToXGF.ts                  SceneModel → XGFData_v2
```
