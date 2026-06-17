---
title: 3DXML Format Guide
---
# 3DXML (Dassault Systèmes) Loader / Exporter

`ThreeDXMLLoader` imports the geometry and assembly structure of Dassault
Systèmes **3DXML** files (CATIA / 3DEXPERIENCE export) into a `SceneModel`, and
`ThreeDXMLExporter` writes a SceneModel's triangle geometry back out as `.3dxml`.

This document describes the file structure we accept, the subset of the format
v1 honours, and the pipeline a file follows from bytes to a live scene (and back).

---

## 1. The 3DXML container

A `.3dxml` file is a **ZIP archive** of XML documents:

```
   model.3dxml  (ZIP)
   ├── Manifest.xml                 <Root> names the product-structure file
   ├── <root>.3dxml                 product structure (assembly tree)
   ├── <part-a>.3DRep               tessellated representation (triangles)
   ├── <part-b>.3DRep
   └── …
```

Entries are normally DEFLATE-compressed; the loader's ZIP reader (`unzip.ts`)
inflates them via `pako` (STORED entries pass through). XML is parsed with the
browser's native `DOMParser`.

### Manifest

```xml
<Manifest xmlns="http://www.3ds.com/xsd/3DXML">
  <Root>Product.3dxml</Root>
</Manifest>
```

`<Root>` names the product-structure document inside the archive. References may
be a plain filename, a path, or a `urn:…:name` form — the loader resolves them
to an archive entry by basename, case-insensitively, as a fallback.

### Product structure (assembly graph)

A flat list of id-referenced nodes under `<ProductStructure>`:

| Node | Role |
|---|---|
| `Reference3D` | A part / product — a node that can be instanced. |
| `ReferenceRep` | Names the file (`associatedFile`) holding a part's tessellation. |
| `Instance3D` | Places one `Reference3D` under another, with a `<RelativeMatrix>`. |
| `InstanceRep` | Attaches a `ReferenceRep` to a `Reference3D`. |

`Instance*` nodes wire parent ↔ child via `<IsAggregatedBy>` (parent) and
`<IsInstanceOf>` (child) id references. The root is `<ProductStructure root="…">`
when declared, otherwise the one `Reference3D` no `Instance3D` instantiates.

`<RelativeMatrix>` is 12 numbers — three 3-vectors (the local X / Y / Z axes)
then the translation, i.e. the upper 3×4 of a column-major transform.

### Representation (tessellation)

```xml
<Rep>
  <SurfaceAttributes><Color red="1" green="0" blue="0" alpha="1"/></SurfaceAttributes>
  <Faces><Face triangles="0 1 2 3 4 5 …"/></Faces>
  <VertexBuffer>
    <Positions>x y z  x y z  …</Positions>
    <Normals>nx ny nz  …</Normals>
  </VertexBuffer>
</Rep>
```

A `Rep` may nest child `Rep`s ("bags"); each `Rep` that owns a `VertexBuffer`
yields one geometry. The `triangles` attribute is a flat index soup into the
vertex buffer. Number lists tolerate whitespace, comma or `;` separators.

---

## 2. Load pipeline

```
   .3dxml bytes (ArrayBuffer)
        │
        ▼
   unzip.ts                 ←  ZIP central directory → { name → bytes }, pako inflate
        │
        ▼
   Manifest.xml             ←  <Root> → product-structure entry
        │
        ▼
   versions/v1/parseProductStructure.ts
        │                       Reference3D / ReferenceRep / Instance3D / InstanceRep
        ▼
   traverse from root          ←  compose RelativeMatrix → baked world matrix per instance
        │
        ▼
   versions/v1/parseRepresentation.ts
        │                       each ReferenceRep's associatedFile → triangle geometry
        ▼
   SceneModel
        ├─ createGeometry   (once per ReferenceRep — instanced, reused)
        ├─ createMesh       (once per instance; world matrix baked into mesh.matrix; flat colour)
        └─ createObject     (once per instance; originalSystemId = assembly path)
```

Geometry is created **once** per `ReferenceRep` and reused across every instance
(so a part used 100 times uploads one geometry and 100 lightweight meshes). The
assembly transform is **baked into each mesh's matrix** — the loader builds no
`SceneTransform` hierarchy (matching FBX / glTF).

---

## 3. Coordinate system

The loader places geometry in the file's authored coordinate space and bakes no
orientation fix. CATIA models are typically millimetre, Z-up. Orient / scale the
result for your scene by setting the `SceneModel.coordinateSystem` at creation
time (see the other format guides for the basis convention).

---

## 4. Usage

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {ThreeDXMLLoader} from "@xeokit/sdk/formats/threedxml";

const scene = new Scene();
const sceneModel = scene.createModel({id: "myModel"}).value!;

const fileData = await (await fetch("./model.3dxml")).arrayBuffer();

await new ThreeDXMLLoader().load({fileData, sceneModel});
```

The loader's `fileDataType` is `"arraybuffer"`, so application code reads the
`.3dxml` file as an `ArrayBuffer` before handing it over. XML parsing uses the
browser's `DOMParser`; Node hosts must install a `DOMParser` polyfill (e.g.
`linkedom`, `@xmldom/xmldom`) onto `globalThis` first.

### Exporter

```ts
import {ThreeDXMLExporter} from "@xeokit/sdk/formats/threedxml";

const arrayBuffer = await new ThreeDXMLExporter().write({sceneModel});
```

`ThreeDXMLExporter` is the inverse of the loader and round-trips with it: each
triangle `SceneMesh` becomes a part — its geometry (dequantized from the
SceneModel's compressed buffers) is written to a `Rep_<n>.3DRep` document, and
the product structure places it under a single root `Reference3D` with the mesh's
matrix as the instance `RelativeMatrix`. The flat per-mesh colour becomes the
`Rep`'s `<SurfaceAttributes><Color>`. Output is a valid (STORED, CRC-checked) ZIP.

Unlike the loader, the exporter builds XML as strings and needs **no** `DOMParser`,
so it runs in browser and Node alike. v1 exports **triangle-family geometry only**
and does **not** deduplicate instancing (one representation per mesh).

---

## 5. What v1 does not cover

The features below are out of scope for this version.

- **Exact B-rep / NURBS.** Only the **tessellated** representation (`triangles`)
  is read. `strips` / `fans` face encodings and analytic surfaces are skipped.
- **Edges / wireframe & points** — only triangle faces are emitted.
- **PMI, dimensions, annotations, views, sections.**
- **Materials beyond a flat per-`Rep` colour** — no textures, no PBR.
- **Animations / kinematics.**
- **Semantic data** — no `DataModel` is produced; the assembly path is preserved
  on each object's `originalSystemId` for traceability.
- **External references** — a `.3dxml` that points at resources outside the
  archive isn't resolved.

None require a structural change to add — each slots into the existing
unzip → structure → representation pipeline.

---

## 6. File map

```
formats/threedxml/
├── README.md                         (this file)
├── ThreeDXMLLoader.ts                ModelLoader subclass — public
├── ThreeDXMLExporter.ts              ModelExporter subclass — public
├── index.ts                          module re-export (loader + exporter) + docs
├── unzip.ts                          ZIP reader: ArrayBuffer → { name → bytes } (pako)
└── versions/v1/
    ├── parse.ts                      pipeline: unzip → manifest → structure → reps → SceneModel
    ├── parseProductStructure.ts      product-structure XML → assembly graph
    ├── parseRepresentation.ts        representation XML → triangle geometry
    ├── encode.ts                     SceneModel → .3dxml (XML build + STORED ZIP writer)
    ├── xml.ts                        namespace-tolerant DOMParser helpers
    └── types.ts                      parsed intermediate types
```

Only `ThreeDXMLLoader` and `ThreeDXMLExporter` are exported from the module; the
ZIP reader/writer, XML helpers and version parsers/encoders are internal.
