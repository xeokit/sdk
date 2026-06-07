---
title: FDS Format Guide
---
# FDS (Fire Dynamics Simulator) Loader / Exporter

`FDSLoader` imports the geometry and structure of NIST **Fire Dynamics
Simulator v6** input files into a `SceneModel` + `DataModel` pair, and
`FDSExporter` writes an FDS-shaped `DataModel` back out as v6 namelist
text.

This document describes the file format we accept, the namelist groups
the loader honours, and the pipeline a file follows from text to a live
scene (and back).

---

## 1. The FDS input format

FDS input files are plain ASCII text in **Fortran namelist** syntax. A
file is a flat list of records; each record opens with `&GROUP`, lists
zero or more `NAME=VALUE` parameters, and closes with `/`. Comments run
from `!` to end of line. Records may span multiple lines.

```
&HEAD CHID='office', TITLE='Open-plan ignition' /

&MESH IJK=20,20,10, XB=0.0,5.0, 0.0,5.0, 0.0,2.5 /

&TIME T_END=120 /

&SURF ID='WALL',    RGB=200,200,200 /
&SURF ID='WINDOW',  COLOR='CYAN', TRANSPARENCY=0.5 /

&OBST XB=1.0,1.2, 1.0,3.0, 0.0,2.5, SURF_ID='WALL' /  ! a 200mm wall
&VENT XB=0.0,0.0, 0.0,5.0, 0.0,2.5, SURF_ID='OPEN' /
&HOLE XB=1.0,1.2, 1.8,2.2, 0.6,1.6 /                  ! doorway
```

### Grammar (lenient, matches real-world files)

```
file     = (comment | record)*
record   = "&" GROUP ws param* ws "/"
param    = NAME ws "=" ws value (("," | ws) param)?
value    = number | string | bool | array
string   = "'" ... "'" | "\"" ... "\""
bool     = ".TRUE." | ".T." | ".FALSE." | ".F."
array    = value ("," value)*
number   = Fortran float (`D` exponent permitted, normalised to `E`)
comment  = "!" ... EOL    (ignored inside quoted strings)
```

Whitespace and commas are interchangeable as parameter separators. The
tokeniser is line-aware so warnings can be reported against the line
where a record opened.

### XB convention

Every volume-bearing record uses a 6-tuple:

```
XB = X_MIN, X_MAX, Y_MIN, Y_MAX, Z_MIN, Z_MAX
```

The loader normalises any axis where the author swapped min/max.

---

## 2. Namelist groups honoured

Only the groups the loader uses are listed here. Every other group
(`&REAC`, `&CTRL`, `&MULT`, `&GEOM`, `&PART`, `&MATL`, `&TIME`, `&DUMP`,
`&MISC`, `&INIT`, `&PROP`, `&RADI`, `&SPEC`, `&RAMP`) is silently
ignored — it is common in non-trivial files but not relevant to
geometry.

Any group **not** in either list (honoured or known-ignored) is
collected as a `warnings` entry on the loader result.

| Group | Honoured params (v1) | Effect |
|---|---|---|
| `&HEAD` | `CHID`, `TITLE` | Project name on the `FDSProject` DataObject. |
| `&MESH` | `XB`, `IJK`, `ID` | One wireframe outline + one `FDSMesh` DataObject. Element ownership is inferred spatially from the element centre. |
| `&SURF` | `ID`, `RGB`, `COLOR`, `TRANSPARENCY` | Material map referenced by `SURF_ID`. Every remaining parameter is preserved in an `FDS` property set. |
| `&OBST` | `XB`, `SURF_ID`, `RGB`, `COLOR`, `ID` | A solid box (possibly cut by `&HOLE`s). |
| `&VENT` | `XB`, `MB`, `IOR`, `SURF_ID`, `RGB`, `COLOR`, `ID` | A boundary quad. `XB`-only is rendered; `MB`-only is skipped in v1. |
| `&HOLE` | `XB`, `ID` | Subtracts from intersecting `&OBST`s. Carries a `FDSHole` DataObject for traceability; no geometry of its own. |

### Colours

Colour resolution order, per element:

1. Inline `RGB=(r,g,b)` on the element (0–255).
2. Inline `COLOR='NAME'` looked up in the loader's small palette.
3. The element's `SURF_ID`, resolved against `&SURF` records (RGB or
   COLOR).
4. The format default (grey for obstructions, light blue for vents).

The palette covers the 16 most common FDS colour names
(`WHITE` / `BLACK` / `RED` / `GREEN` / `BLUE` / `YELLOW` / `ORANGE` /
`CYAN` / `MAGENTA` / `GRAY` / `GREY` / `BROWN` / `TAN` / `STEEL` /
`CONCRETE` / `WOOD`). Anything else falls through to the default.

---

## 3. Load pipeline

```
   .fds text
       │
       ▼
   tokenize.ts          ←  comment-strip, lex into FDSRecord[]
       │
       ▼
   parse.ts:dispatch    ←  bucket records into FDSModel
       │                   { head, meshes, surfs, obsts, vents, holes, warnings }
       │
       ▼
   applyHoles.ts        ←  axis-aligned (OBST ∖ HOLE) → flat list of remainder AABBs
       │
       ├───▶ buildGeometry.ts   ←  3 reusable geometries (cube / quad / wireBox),
       │                          one SceneMesh per remainder / quad / wire,
       │                          colour from §2 lookup
       │
       └───▶ buildDataModel.ts  ←  FDSProject + FDSMesh + FDSElement DataObjects,
                                  Geometry + FDS PropertySets,
                                  `contains` and `usesSurface` Relationships
```

### Hole subtraction (`applyHoles`)

For every `&OBST` the loader walks the holes one at a time and, for any
hole that overlaps the current remainder, splits it into ≤6
axis-aligned remainder boxes — the canonical decomposition of
`r \ h` for two AABBs:

```
   ┌─────────────────┐               ┌──┐         ┌──┐
   │      r          │               │  │         │  │
   │    ┌───┐        │   →   left,   │  │ right,  │  │  …
   │    │ h │        │     bottom,             …  ┌──┐
   │    └───┘        │     top, front, back       │  │
   └─────────────────┘                            └──┘
```

Cases handled:

- No overlap → `r` unchanged.
- Fully contained (`h ⊇ r`) → `r` dropped entirely.
- Corner/edge/through-tunnel/fully-inside cuts → 3 / 4 / 6 remainder
  boxes respectively.
- Repeated holes are composed by re-running the subtraction against
  every remainder produced by the previous hole.

Zero-volume slivers (from near-flush hole edges) are dropped so we
never emit degenerate meshes.

### Geometry build (`buildGeometry`)

Three shared `SceneGeometry` instances are authored in `[0,1]^3` at
load start:

- **`FDS::geom::cube`** — 8-vertex unit cube (`TrianglesPrimitive`).
  Per-element transform = `(position=min, scale=extent)`.
- **`FDS::geom::quad`** — 4-vertex unit quad on the XY plane
  (`TrianglesPrimitive`). For VENTs the axis with zero extent
  collapses to a line, matching the FDS author's intent.
- **`FDS::geom::wireBox`** — 12 line segments outlining the unit cube
  (`LinesPrimitive`). One per `&MESH`.

Every element becomes one `SceneObject`. Obstructions with multiple
remainders (from hole-cuts) bundle their remainder `SceneMesh`es into a
single `SceneObject` keyed by the original obstruction's id.

### Data model (`buildDataModel`)

Object types:

```
FDSProject                       ← &HEAD
  ├── FDSMesh                    ← &MESH (one per record)
  │      └── FDSElement (abstract)
  │             ├── FDSObstruction   ← &OBST
  │             ├── FDSVent          ← &VENT
  │             ├── FDSHole          ← &HOLE
  │             └── FDSDevice        ← &DEVC (deferred)
  └── FDSSurface (free; referenced by FDSElement.usesSurface)   ← &SURF
```

Relationships:

- **`contains`** — Project → Mesh, Mesh → Element. Mesh ownership is
  inferred from the element's centre point against each MESH's XB; if
  no MESH owns it, the element hangs off the Project directly.
- **`usesSurface`** — Element → Surface. Only emitted when the
  element's `SURF_ID` resolves against a known `&SURF`.

Property sets per element:

- **`Geometry`** — XMIN / XMAX / YMIN / YMAX / ZMIN / ZMAX as authored.
  MESHes carry `I` / `J` / `K` from `IJK`. VENTs carry `MB` and `IOR`
  when present.
- **`FDS`** — every other namelist parameter on the record,
  preserved as-typed (numbers stay numbers, strings stay strings,
  arrays stay arrays).

### ID convention

SceneObject and DataObject IDs are deliberately identical so the
two halves pair up out of the box:

| Object | ID |
|---|---|
| Project | `FDS::project` |
| Mesh `i` | `FDS::mesh:<i>` |
| Surface `<id>` | `FDS::surf:<id>` |
| Obstruction `i` | `FDS::obst:<i>` |
| Vent `i` | `FDS::vent:<i>` |
| Hole `i` | `FDS::hole:<i>` |

The `i` is the 0-based record index in source order. Inside one
obstruction's `SceneObject`, the constituent `SceneMesh`es carry suffix
ids `:0`, `:1`, … so hole-cut remainders pick or hide individually.

### Schema

The loader writes objects, relationships, and property sets under the
schema id **`fds6`**, exported from `formats/fds`:

```ts
import { FDSSchema, FDS_SCHEMA_ID } from "@xeokit/sdk/formats/fds";
```

Use it with `inspectDataModel(model, FDSSchema)` to validate any
DataModel the loader produced (or a DataModel hand-authored to the
same shape).

---

## 4. Export pipeline

`FDSExporter` is the inverse of the loader. It runs entirely off the
`DataModel`; the SceneModel is not consulted because reconstituting
the authored XB from hole-cut SceneMesh remainders would be lossy,
whereas the `Geometry` PropertySet on each `FDSObstruction` /
`FDSVent` / `FDSMesh` / `FDSHole` already carries the exact XB the
loader saw.

```
   DataModel  (FDSProject / FDSSurface / FDSMesh / FDSObstruction / FDSVent / FDSHole)
       │
       ▼
   versions/v6/encode.ts
       │
       ├─ project (FDSProject)         →  &HEAD TITLE='…'  /
       │
       ├─ each FDSSurface
       │     ID = surface name (the FDS surface id)
       │     RGB / COLOR / TRANSPARENCY ← FDS PropertySet
       │     other params              ← FDS PropertySet (verbatim)
       │
       ├─ each FDSMesh
       │     ID  = object name (if non-synthetic)
       │     XB  ← Geometry PropertySet  (XMIN..ZMAX)
       │     IJK ← Geometry PropertySet  (I, J, K)
       │
       ├─ each FDSObstruction
       │     ID                    ← object name (if non-synthetic)
       │     XB                    ← Geometry PropertySet
       │     RGB / COLOR           ← FDS PropertySet
       │     SURF_ID               ← outgoing `usesSurface` Relationship
       │                              (target's FDSSurface name)
       │     other params          ← FDS PropertySet (verbatim)
       │
       ├─ each FDSVent
       │     ID, XB, RGB, COLOR, SURF_ID — same as Obstruction
       │     MB, IOR               ← Geometry PropertySet
       │
       └─ each FDSHole
             ID                    ← object name (if non-synthetic)
             XB                    ← Geometry PropertySet
             other params          ← FDS PropertySet (verbatim)
       │
       ▼
   .fds text  (one record per line, blank lines between groups)
```

### Round-trip

`tokenize → dispatch → buildDataModel → encode → tokenize → dispatch`
is a fixed point for every group the loader honours (`HEAD` / `SURF` /
`MESH` / `OBST` / `VENT` / `HOLE`):

- `HEAD TITLE` survives in `FDSProject.name`.
- `SURF RGB / COLOR / TRANSPARENCY` and every other namelist parameter
  survive in the `FDS` PropertySet — colour fields are stored
  explicitly so they don't fall through the `extras` filter.
- `OBST` / `VENT` / `HOLE` `XB` survives in `XMIN..ZMAX` properties on
  the `Geometry` PropertySet.
- `VENT` `MB` and `IOR` survive in the `Geometry` PropertySet.
- Per-element `RGB` / `COLOR` overrides survive in the `FDS`
  PropertySet.
- `SURF_ID` survives as a `usesSurface` Relationship from the element
  to the surface; the encoder follows it back to recover the SURF
  name.

Records the loader recognised-but-ignored (`&REAC`, `&CTRL`, `&MULT`,
…) and unknown groups (everything `warnings` flagged) are **not**
round-tripped — they were dropped at load time, before the DataModel
was populated. An encoder that wants those preserved would need to
park them as DataObjects of a generic "unrecognised namelist" type at
load time; v1 doesn't.

### Number formatting

Integer-valued reals are written as `N.0` so the reader recognises
them as reals (the FDS convention; the tokeniser parses both forms but
the round-trip stays in the more common shape).

### String escapes

FDS namelist has no documented escape for `'` inside a single-quoted
string. The encoder defensively replaces any embedded `'` with `_`
when quoting. Real-world IDs rarely contain quotes.

---

## 5. Usage

### Loader

```ts
import {Scene} from "@xeokit/sdk/model/scene";
import {Data}  from "@xeokit/sdk/model/data";
import {FDSLoader} from "@xeokit/sdk/formats/fds";

const scene = new Scene();
const data  = new Data();

const sceneModel = scene.createModel({id: "myFire"}).value!;
const dataModel  = data.createModel({id: "myFire"}).value!;

const text = await (await fetch("./compartment.fds")).text();

const result = await new FDSLoader().load({
  fileData: text,
  sceneModel,
  dataModel,
});

console.log(result.warnings);    // any non-honoured groups, by line
```

The loader's `fileDataType` is `"text"`, so application code must read
the `.fds` file as a string before handing it over.

### Exporter

```ts
import {FDSExporter} from "@xeokit/sdk/formats/fds";

const text: string = await new FDSExporter().write({dataModel});
// → "&HEAD TITLE='…' /\n&SURF ID='WALL', RGB=200,180,180 /\n…"
```

The exporter's `fileDataType` is `"text"`. The `sceneModel` parameter
is accepted by the base `ModelExporter` API but not consulted by the
FDS v6 encoder — the typed DataModel is the canonical source. Either
write the result to disk or pipe it into another consumer; it's plain
ASCII namelist text.

---

## 6. What v1 does not cover

The features below are explicitly out of scope for this loader version.
None require a structural change to add — each slots into the existing
dispatch + build pipeline.

- **`&GEOM` triangle meshes.** Non-axis-aligned obstructions defined as
  triangulated B-reps. v1 only honours axis-aligned `&OBST` boxes.
- **`&MULT` repeating patterns.** A single `&MULT` record can synthesise
  many `&OBST`s through index expansion; v1 treats it as a single
  honoured-but-ignored group.
- **`&DEVC` device markers.** Schema slot (`FDSDevice`) exists; geometry
  is deferred.
- **Smokeview output** (`.smv`, slice files, particle files, time
  series). Animation and volumetrics are a separate, much larger
  project.
- **`ROTATE_AXIS` on `&OBST`.** Rotated obstructions are silently kept
  axis-aligned to their authored XB.
- **`&CTRL` control logic** and **`&REAC` chemistry** beyond raw
  preservation in `FDS` property sets.

Records of these groups produce no warnings — they're recognised as
"known but not supported in v1".

---

## 7. File map

```
formats/fds/
├── README.md                       (this file)
├── FDSLoader.ts                    ModelLoader subclass — load entry point
├── FDSExporter.ts                  ModelExporter subclass — write entry point
├── index.ts                        module re-exports
└── versions/v6/
    ├── types.ts                    FDSHead | FDSMesh | FDSSurf | FDSObst | FDSVent | FDSHole | FDSModel | FDSRecord
    ├── tokenize.ts                 .fds text → FDSRecord[]
    ├── applyHoles.ts               (OBST, HOLE)[] → remainder AABBs
    ├── schema.ts                   DataFormatSchema for fds6
    ├── buildGeometry.ts            FDSModel + SceneModel → SceneMesh/SceneObject
    ├── buildDataModel.ts           FDSModel + DataModel → DataObject/Relationship/PropertySet
    ├── parse.ts                    load pipeline: tokenize → dispatch → build
    ├── encode.ts                   write pipeline: DataModel → namelist text
    ├── tokenize.test.ts            tokeniser unit tests
    ├── applyHoles.test.ts          AABB-subtraction unit tests
    └── encode.test.ts              parse → encode → parse round-trip tests
```
