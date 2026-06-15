---
title: 3D Gaussian Splatting Format Guide
---
# 3D Gaussian Splatting (`.splat`) Loader / Exporter

`GaussianSplatLoader` imports compact **`.splat`** 3D-Gaussian-Splatting scenes
into a `SceneModel`, and `GaussianSplatExporter` writes a `SceneModel`'s splat
geometries back out as `.splat`. Splats are a first-class `SceneModel`
primitive (`GaussianSplatsPrimitive`), so a captured scene loads, streams,
transforms, picks and renders like any other model.

This document describes the file format we accept, the in-memory representation,
the pipeline a file follows from bytes to a live scene (and back), and how the
renderer draws splats.

---

## 1. The compact `.splat` format

3D Gaussian Splatting (3DGS) represents a scene as a cloud of anisotropic 3D
gaussians — each with a position, a covariance (orientation + scale), a colour
and an opacity — rendered as depth-sorted, alpha-blended screen-space splats.
It is the format of choice for photoreal reality capture: real-estate tours,
scanned environments, and as-built / BIM context alongside CAD geometry.

We import/export the compact **`.splat`** encoding (the antimatter15/splat
layout): a **headerless** file that is a flat array of fixed-size **32-byte
records**, so `count = byteLength / 32`. It carries **baked RGB** — no spherical
harmonics, so there is no view-dependent shading, which is what keeps the files
small enough to stream millions of splats.

### Per-splat record (32 bytes, little-endian)

```
   bytes  0..11   position   : 3 × float32   (x, y, z)
   bytes 12..23   scale      : 3 × float32   (per-axis gaussian std-dev)
   bytes 24..27   colour     : 4 × uint8     (RGBA, 0..255 — baked, no SH)
   bytes 28..31   rotation   : 4 × uint8     (quaternion, file order w,x,y,z)
```

The rotation bytes decode as `(b - 128) / 128` into roughly `[-1, 1]`; the
renderer normalises the quaternion before building the covariance. The file
packs the quaternion **w-first** (`w, x, y, z`); `SceneGeometry` stores it
`xyzw`, so the loader reorders on the way in and the exporter reorders on the
way out.

---

## 2. In-memory representation

A loaded splat scene is one `GaussianSplatsPrimitive` `SceneGeometry`:

| Field                | Storage                          | Notes |
|----------------------|----------------------------------|-------|
| `positionsCompressed`| `Uint16` quantized + `aabb`      | dequantized via the geometry AABB, like points/triangles |
| `scales`             | `Float32`, 3 per splat           | per-axis std-dev, uncompressed (P1) |
| `rotations`          | `Float32`, 4 per splat (`xyzw`)  | rotation quaternion, uncompressed (P1) |
| `colorsCompressed`   | `Uint8` RGBA, 4 per splat        | baked colour + opacity |

The 3D covariance is **not** stored — it is derived on the GPU from
`scales` + `rotations` at pack time (`Σ = Mᵀ·M`, `M = diag(scale)·R`; see
`computeCovariance3D.ts`).

---

## 3. Load pipeline

```
   .splat bytes (ArrayBuffer)
        │
        ▼
   parseSplat.ts            ←  length check (× 32) → decode positions / scales /
        │                      RGBA / quaternion into typed arrays
        ▼
   GaussianSplatLoader.ts
        │
        ├─ reorder quaternion file (w,x,y,z) → SceneGeometry (xyzw)
        │
        ▼
   sceneModel.createGeometry  (GaussianSplatsPrimitive: positions, scales,
        │                       rotations, colorsCompressed)
   sceneModel.createMesh       (one mesh, unparented)
   sceneModel.createObject     (one object)
        │
        ▼
   SceneModel populated
```

The loader produces exactly **one geometry + one mesh + one object**. No
`DataModel` is involved — `.splat` carries no semantic data. Headerless format
⇒ a single `"*"` version.

---

## 4. Export pipeline

`GaussianSplatExporter` is the inverse of the loader, built on `encodeSplat.ts`
(the exact byte-level inverse of `parseSplat`):

```
   SceneModel
        │
        ▼
   GaussianSplatExporter.ts
        │
        ├─ for each GaussianSplatsPrimitive geometry:
        │     dequantize positionsCompressed (+ aabb) → world-frame centres
        │     reorder rotations xyzw → file order (w,x,y,z)
        │     default missing colours to opaque white
        │
        ▼
   encodeSplat.ts            ←  pack 32-byte records (positions/scales/RGBA/quat)
        │
        ▼
   .splat bytes (ArrayBuffer)
```

All `GaussianSplatsPrimitive` geometries in the model are concatenated into one
`.splat` buffer; non-splat geometry (triangles, lines, points) is ignored.

### Round-trip

`parseSplat → createGeometry → export → parseSplat` is faithful:

- **Scales, colours and rotations** survive **exactly** (the 8-bit quaternion
  encode is the exact inverse of the decode; scales are stored as float;
  colours as the raw RGBA8 bytes).
- **Positions** survive to within the `SceneGeometry` **16-bit position
  quantisation** (the same quantize/dequantize every primitive uses).

Geometry is written verbatim in its stored frame — see §5.

---

## 5. Coordinate system

`.splat` / COLMAP scenes are authored **Y-down** (the scene's "up" runs along
`-Y`); the SDK world is right-handed **Z-up**. Splats load in their **native
frame** — the loader bakes no orientation fix. Stand a scene upright by
declaring its source frame on the `SceneModel.coordinateSystem` at creation; the
SDK premultiplies the model's meshes into the Scene frame for you:

```ts
const sceneModel = scene.createModel({
  id: "myModel",
  coordinateSystem: {
    basis: [1,0,0,  0,0,-1,  0,1,0],   // Right +X, Up -Y (Y-down), Forward +Z
    origin: [0, 0, 0],
    units: "meters",
  },
}).value!;
```

Because the orientation lives on the coordinate system and not in the geometry,
a loaded → exported file keeps its original `.splat` orientation.

---

## 6. Rendering

Splats are drawn by a dedicated WebGL pass (`GaussianSplatTechnique`), not the
mesh batch path:

- **EWA splatting** — each splat's anisotropic 3D covariance is projected to a
  screen-space gaussian billboard, expanded to a quad in the vertex shader.
- **Depth-sorted, alpha-blended** — back-to-front premultiplied "over" blend.
  The sort is a 16-bit counting sort run **off the main thread**
  (`SplatSortWorker`), re-requested when the camera moves.
- **Depth-tested, not depth-written** — splats are occluded by opaque mesh
  geometry but don't block it, so they composite over a CAD scene correctly.
- **Pickable** — the splat pick pass (`GaussianSplatPickTechnique`) writes into
  the shared pick depth buffer, so a click returns the picked object **and** the
  world-space surface position, depth-resolved against triangle meshes.
- **Section-plane clipping** — active `View` section planes clip splats
  per-splat-centre in world space (both the colour and pick passes), so a
  clipped splat is invisible *and* unpickable.
- **Budget** — a single shared GPU batch of up to ~1.5M splats
  (~96 MB at 64 B/splat); splats stream in/out as freeable texture portions like
  mesh vertex data.

---

## 7. Usage

### Loader

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {GaussianSplatLoader} from "@xeokit/sdk/formats/gaussiansplat";

const scene = new Scene();
const sceneModel = scene.createModel({id: "mySplat"}).value!;

const fileData = await (await fetch("./scene.splat")).arrayBuffer();

await new GaussianSplatLoader().load({fileData, sceneModel});
```

The loader's `fileDataType` is `"arraybuffer"`, so application code must read
the `.splat` file as an `ArrayBuffer` before handing it over.

### Exporter

```ts
import {GaussianSplatExporter} from "@xeokit/sdk/formats/gaussiansplat";

const arrayBuffer = await new GaussianSplatExporter().write({sceneModel});
```

The exporter's `fileDataType` is `"arraybuffer"`. The result is ready to
download as a `.splat` file or re-load with `GaussianSplatLoader`.

---

## 8. What this version does not cover

The features below are explicitly out of scope.

### Format

- **Spherical harmonics (SH)** — the compact `.splat` profile bakes RGB only;
  view-dependent colour is dropped. `.ply` 3DGS files (which carry SH) are not
  imported.
- **Generating splats from triangle/point geometry** — the exporter only writes
  existing `GaussianSplatsPrimitive` geometry; it does not sample meshes into
  splats.

### Rendering

- **Per-object visibility / highlight / selection / xray / colorize / opacity**
  — the batch is all-or-nothing; splats don't yet join the per-object material
  bins (each splat already carries its owning mesh's pick id, so this is the
  natural next step).
- **LOD / distance culling** — the whole batch draws at full resolution.
- **Transparent-mesh ordering** — splats composite over opaque geometry but sit
  between the opaque and transparent passes; ordering against transparent meshes
  is undefined.
- **Clean planar section cut** — clipping is per-splat-centre, so the cut edge
  can bleed up to one splat radius and looks soft rather than razor-flat.

---

## 9. File map

```
formats/gaussiansplat/
├── README.md                       (this file)
├── GaussianSplatLoader.ts          ModelLoader subclass — load entry point
├── GaussianSplatExporter.ts        ModelExporter subclass — write entry point
├── index.ts                        module re-exports (loader + exporter public)
├── versions/v1/
│   ├── parseSplat.ts               .splat bytes → typed attribute arrays
│   └── encodeSplat.ts              typed attribute arrays → .splat bytes (inverse of parseSplat)
├── utils/
│   ├── packSplats.ts               attributes → GPU texture record (used by the renderer)
│   └── computeCovariance3D.ts      scale + quaternion → 3D covariance (used by the renderer)
└── tests/
    ├── parseSplat.test.ts          decode unit tests
    ├── encodeSplat.test.ts         encode + byte-exact round-trip
    ├── packSplats.test.ts          GPU-record packing
    ├── computeCovariance3D.test.ts covariance math
    ├── GaussianSplatLoader.test.ts load + coordinate-system + no-transform
    └── GaussianSplatExporter.test.ts export round-trip + multi-geometry
```

The GPU-side rendering (EWA technique, sort worker, pick pass, splat batch)
lives under `viewing/webGLRenderer/internal/` — `packSplats.ts` and
`computeCovariance3D.ts` here are shared with it.
```

