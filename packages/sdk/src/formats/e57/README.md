---
title: E57 Format Guide
---
# E57 (`.e57`) Loader / Exporter

`E57Loader` imports **E57** (ASTM E2807) laser-scan point clouds into a
`SceneModel`, and `E57Exporter` writes a `SceneModel`'s point geometry back out
as `.e57`. Points are a first-class `SceneModel` primitive (`PointsPrimitive`),
so a scan loads, streams, transforms, picks and renders like any other model.

This document describes the file format we accept, the in-memory
representation, the pipeline a file follows from bytes to a live scene (and
back), and the current limits.

---

## 1. The E57 format

E57 is the open ASTM standard for exchanging 3D imaging (laser-scan) data. A
file nests **three layers**, outer to inner:

1. **File header (48 bytes)** — signature `ASTM-E57`, version, and *physical*
   offsets/lengths for the XML section, plus the `pageSize` (1024).
2. **Page / CRC layer** — the file is a sequence of `pageSize`-byte physical
   pages whose **last 4 bytes are a CRC-32C** (Castagnoli) of the preceding
   `pageSize − 4` data bytes. Every offset E57 records is *physical*
   (CRC-inclusive); reading content means working in the *logical* stream with
   those CRC bytes removed.
3. **XML section** — a small UTF-8 document describing `data3D` (a vector of
   scans, each with a `pose`, `cartesianBounds`, and a `points`
   `CompressedVector`) and `images2D`.
4. **`CompressedVector` binary** — one bit-packed bytestream per prototype
   field, chunked across data packets.

> **CRC-32C byte order:** the per-page checksum is stored **big-endian**
> (verified against real-world E57 writers), distinct from the SDK's zip CRC-32.

### Point record prototype

Each scan's `points` declares a `prototype` of fields. The ones we read:

| Field                                   | E57 node type                  | Decoded as |
|-----------------------------------------|--------------------------------|------------|
| `cartesianX` / `Y` / `Z`                | `Float` (`single`/`double`) or `ScaledInteger` | position |
| `colorRed` / `Green` / `Blue`           | `Integer` (0..255)             | per-point RGB |
| `intensity`                             | `Float` / `ScaledInteger`      | optional grayscale |
| `cartesianInvalidState`                 | `Integer` (0..1)               | invalid-point filter |

Two encodings appear in the wild and both are handled:

- **`Float`** — raw IEEE bytes. **Precision defaults to `double`** when the
  attribute omits it (a common gotcha — reading those as 32-bit yields garbage).
- **`Integer` / `ScaledInteger`** — LSB-first bit-packed integers of
  `floor(log2(max−min))+1` bits, decoded as `(raw + minimum) · scale + offset`
  (`scale = 1`, `offset = 0` for plain `Integer`).

The only standard codec is `bitPackCodec`, so point data is **bit-packed, not
compressed** — no decompression dependency.

---

## 2. In-memory representation

Each `data3D` scan loads as one `PointsPrimitive` `SceneGeometry` + mesh +
object:

| Field                | Storage                       | Notes |
|----------------------|-------------------------------|-------|
| `positionsCompressed`| `Uint16` quantized + `aabb`   | dequantized via the geometry AABB, like all primitives |
| `colorsCompressed`   | `Uint8` RGBA, 4 per point     | RGB (alpha 255); grayscale from intensity, or white |

Points are placed into world space by the scan **pose** (a `[w,x,y,z]`
quaternion + translation), then stored relative to a per-scan **RTC origin**
(the scan centroid) so survey-scale coordinates keep precision.

---

## 3. Load pipeline

```
   .e57 bytes (ArrayBuffer)
        │
        ▼
   parseE57Header.ts        ←  48-byte header: signature, pageSize, XML offsets
        │
        ▼
   e57PageReader.ts         ←  strip per-page CRC → contiguous "logical" stream;
        │                      physical↔logical offset mapping
        ▼
   parseE57Xml.ts (DOMParser) ←  XML → typed scans (prototype, pose, bounds,
        │                          section offset, recordCount)
        ▼
   decodeCompressedVector.ts  ←  per scan: walk data packets, concatenate each
        │                          field's bytestream, decode exactly recordCount
        │                          values (Float / bit-packed Integer)
        ▼
   E57Loader.ts
        │   per scan:  apply pose → RTC-centre → filter invalid → decimate (skip)
        │
        ▼
   sceneModel.createGeometry  (PointsPrimitive: positions, colorsCompressed)
   sceneModel.createMesh       (chunked at 20 000 points/geometry)
   sceneModel.createObject     (one object per scan)
   dataModel.createObject      (one semantic object per scan, under a root)
```

Record counts come from the XML `recordCount`, **not** inferred from bytestream
length (bit padding makes that ambiguous): each field's chunks are concatenated
across packets, then exactly `recordCount` values are pulled.

---

## 4. Export pipeline

`E57Exporter` is the inverse — and needs **no `DOMParser`** (it builds the XML
as a string):

```
   SceneModel
        │
        ▼
   E57Exporter.ts
        │   gather every PointsPrimitive geometry:
        │     dequantize positionsCompressed (+ aabb) → worldMatrix → world XYZ
        │     RGB from colorsCompressed (white when absent); track bounds
        │
        ├─ CompressedVector section: 32-byte header + 4-byte-aligned DATA packets
        │     (XYZ as Float/single, RGB as 8-bit Integer; ≤ 4000 records/packet)
        ├─ XML: one data3D scan (cartesianBounds, prototype, recordCount)
        ├─ assemble logical stream: header + section + XML
        │
        ▼
   page/CRC layer            ←  split into 1020-byte data pages, append a
        │                        big-endian CRC-32C per page
        ▼
   .e57 bytes (ArrayBuffer)
```

All `PointsPrimitive` geometry in the model is written as a **single** `data3D`
scan; non-point geometry (triangles, lines) is ignored.

### Round-trip

`load → export → load` is faithful:

- **Colours** survive **exactly** (raw RGB bytes).
- **Positions** survive to within the `SceneGeometry` **16-bit position
  quantisation** (the same quantize/dequantize every primitive uses); the
  error scales with each axis's extent.

---

## 5. Coordinate system

E57 has **no mandated up-axis** — the scanner's frame is whatever the file
records. Declare that source frame on the `SceneModel.coordinateSystem` at
creation (basis columns are Right, Up, Forward) and the SDK premultiplies the
model into the Scene's right-handed Z-up world. Survey scans are commonly Z-up:

```ts
const sceneModel = scene.createModel({
  id: "myModel",
  coordinateSystem: {
    basis: [1,0,0,  0,1,0,  0,0,1],   // Right +X, Up +Y, Forward +Z
    origin: [0, 0, 0],
    units: "meters",
  },
}).value!;
```

---

## 6. Usage

### Loader

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {E57Loader} from "@xeokit/sdk/formats/e57";

const scene = new Scene();
const sceneModel = scene.createModel({id: "myScan"}).value!;

const fileData = await (await fetch("./scan.e57")).arrayBuffer();

await new E57Loader().load({fileData, sceneModel});
```

Options ({@link E57LoaderOptions}): `skip` (decimation), `intensityAsColor`,
`layerId`. The loader's `fileDataType` is `"arraybuffer"`.

Under Node a `DOMParser` polyfill must be installed first:

```ts
import {DOMParser} from "@xmldom/xmldom";
(globalThis as any).DOMParser = DOMParser;
```

### Exporter

```ts
import {E57Exporter} from "@xeokit/sdk/formats/e57";

const arrayBuffer = await new E57Exporter().write({sceneModel});
```

The exporter's `fileDataType` is `"arraybuffer"`; the result is ready to
download as `.e57` or re-load with `E57Loader`.

---

## 7. What this version does not cover

The features below are explicitly out of scope.

### Import

- **Spherical coordinates** — `sphericalRange`/`Azimuth`/`Elevation` scans are
  skipped (cartesian only).
- **`images2D`** — embedded scan photos are not read.
- **CRC verification** — the reader strips page CRCs without checking them
  (the exporter writes them correctly).

### Export

- **Single combined scan** — all point geometry is written as one `data3D`;
  per-object scans, poses and intensity are not emitted.
- **No packet index** — `indexPhysicalOffset` is `0` (matches common real-world
  writers); sequential reads work, random-access seeking has no index to use.
- **Float/single positions only** — no `ScaledInteger` position encoding (so no
  size win from quantised coordinates).
- **Points only** — triangle/line geometry is ignored (E57 has no mesh model).

---

## 8. File map

```
formats/e57/
├── README.md                       (this file)
├── E57Loader.ts                    ModelLoader subclass — load entry point
├── E57LoaderOptions.ts             skip / intensityAsColor / layerId
├── E57Exporter.ts                  ModelExporter subclass — write entry point
├── index.ts                        module guide + re-exports
├── parser/                         pure, SDK-free reader (unit-testable on buffers)
│   ├── parseE57Header.ts           48-byte file header
│   ├── e57PageReader.ts            physical↔logical CRC-page mapping
│   ├── crc32c.ts                   CRC-32C (Castagnoli) — page checksums
│   ├── parseE57Xml.ts              XML header → typed scans (DOMParser)
│   ├── decodeCompressedVector.ts   packet framing + bit-unpack → field columns
│   ├── readE57.ts                  header + logical stream + parsed document
│   ├── types.ts                    E57Header / E57Field / E57PointCloud / …
│   └── index.ts
└── tests/
    ├── parseE57Header.test.ts      header byte layout
    ├── e57PageReader.test.ts       CRC strip + offset mapping
    ├── parseE57Xml.test.ts         prototype / pose / bounds parsing
    ├── e57RealData.test.ts         real fixtures (float/double/scaled-int) → bounds match
    ├── E57Loader.test.ts           load + RTC framing + decimation
    └── E57Exporter.test.ts         CRC-valid pages + round-trip + re-import
```
