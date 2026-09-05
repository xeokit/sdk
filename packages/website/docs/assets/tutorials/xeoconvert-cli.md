---
title: Use the xeoconvert CLI
---

# Use the xeoconvert CLI

This tutorial shows how to use `xeoconvert`, the xeokit SDK command-line file
format converter. Use it when model conversion belongs in a build script, asset
pipeline or CI job instead of browser application code.

`xeoconvert` converts between supported 3D model and data formats. It can read
formats such as IFC, glTF, XGF, DotBIM, LAS/LAZ, E57, FBX, OBJ, PLY, USDZ,
3DXML, FDS, Gaussian splats and XKT, then write another supported output
format. Converting to XGF or XGF Stream is one important role because those are
xeokit's native delivery formats, but the CLI is not only an XGF generator. It
is the general file conversion front end for the SDK's loader/exporter stack.

When the target is a xeokit web viewer, `xeoconvert` is commonly used to prepare
XGF, XGF Stream and DataModel JSON before an application starts. The viewer then
loads those prepared assets with runtime loaders such as `XGFLoader`,
`XGFStreamingLoader` and `DataModelImporter`.

Under the hood, `xeoconvert` wraps the SDK's headless `ModelConverter`. The
converter is built from three concepts:

- **Loaders** read source formats into SDK model structures. For example, the
  IFC, glTF, DotBIM, LAS and XGF loaders populate `SceneModel` and, when the
  source has semantic information, `DataModel`.
- **Exporters** write SDK model structures back out to files. For xeokit viewer
  delivery, the usual visual outputs are XGF or XGF Stream, while semantic data
  is written as DataModel JSON.
- **Pipelines** connect named inputs to loaders and named outputs to exporters.
  A pipeline such as `ifc2xgf` says: read `--ifc`, write `--xgf`, and also write
  `--datamodel`.

This means the CLI is not a separate conversion system with separate behavior.
It is a scriptable shell entry point over the same conversion components that
can be used directly from TypeScript. For the programmatic API, see
[Use ModelConverter Programmatically](https://xeokit.github.io/sdk/docs/assets/tutorials/modelconverter.md).
Use `xeoconvert` when you want those conversion components from a terminal; use
`ModelConverter` when conversion belongs inside your own application or service
code.

[![DotBIM conversion pipeline example](https://xeokit.github.io/sdk/examples/sdk/export/dotbim/to-json-pipeline/index.png)](https://xeokit.github.io/sdk/examples/index.html#sdk/export/dotbim/to-json-pipeline)

The live
[Convert DotBIM to JSON with Conversion Pipeline](https://xeokit.github.io/sdk/examples/index.html#sdk/export/dotbim/to-json-pipeline)
example shows the same loader/exporter pipeline idea in a browser-facing
example: convert source data into SDK JSON params, then view the result.

A typical conversion run follows this sequence:

1. Read input files from disk.
2. Load them into one or more `SceneModel` and `DataModel` instances.
3. Optionally inspect the loaded `SceneModel`s and semantic data.
4. Optionally apply automatic SceneModel fixes.
5. Export the requested output files.
6. Optionally write reports for CI, manifests and diagnostics.

Use `xeoconvert` when you want repeatable asset generation outside the browser:
preparing model folders for a web app, validating incoming models in CI,
building XGF Stream datasets, creating conversion reports, or converting a
batch of source files as part of a release pipeline.

The main command styles are:

- **Generic conversion** with `--in` and `--out`, where the loader and exporter
  are chosen from file extensions. This is the quickest path for one input and
  one output.
- **Named pipelines** with `--pipeline`, where the pipeline declares the input
  and output argument names. Use these for multi-output conversions such as IFC
  to XGF plus DataModel JSON.
- **Validation** with `--inspect`, where no model output is required. This is
  useful for CI gates and incoming model checks.
- **Conversion with repair** using `--inspect-fix`, which runs registered
  SceneModel fix strategies before export.
- **XGF and XGF Stream generation** when the output is intended for xeokit
  runtime delivery.

Keep conversion and viewing as separate responsibilities. `xeoconvert` prepares
files; the viewer displays those files.

---

## 1. Run the CLI

From an installed package, run:

```bash
npx xeoconvert --help
```

From this repository after building the SDK package, run the generated CLI:

```bash
node packages/sdk/dist/xeoconvert/xeoconvert.js --help
```

During SDK development, the source wrapper lives at:

```bash
node packages/sdk/src/conversion/xeoconvert/xeoconvert.js --help
```

Use the built package path for normal project scripts. Use the source wrapper
only when working inside the SDK repository.

---

## 2. Convert by File Extension

For a single input and a single output, use `--in` and `--out`.

```bash
npx xeoconvert \
  --in ./models/house.glb \
  --out ./public/models/house/model.xgf \
  --log
```

In generic mode, `xeoconvert` resolves the loader from the input extension and
the exporter from the output extension. Common extensions include:

- `.glb` / `.gltf`
- `.ifc`
- `.xgf`
- `.bim`
- `.las` / `.laz`
- `.e57`
- `.fbx`
- `.obj`
- `.ply`
- `.usdz`
- `.3dxml`
- `.fds`
- `.splat`
- `.xkt`

Use named pipelines for ambiguous `.json` formats such as SceneModel JSON and
DataModel JSON.

---

## 3. Convert IFC to XGF and DataModel JSON

Use a named pipeline when a conversion has named inputs and multiple outputs.
The `ifc2xgf` pipeline writes visual XGF data and semantic DataModel JSON.

```bash
npx xeoconvert \
  --pipeline ifc2xgf \
  --ifc ./models/source/building.ifc \
  --xgf ./public/models/building/model.xgf \
  --datamodel ./public/models/building/datamodel.json \
  --stats-report ./public/models/building/stats.json \
  --manifest-report ./public/models/building/manifest.json \
  --log
```

`--ifc`, `--xgf` and `--datamodel` are pipeline argument names. Other pipelines
use different names, such as `--gltf`, `--cityjson`, `--dotbim`,
`--scenemodel` or `--xgfstream`.

---

## 4. Validate Without Writing a Model

Omit `--out` and enable inspection when you only want a validation report.

```bash
npx xeoconvert \
  --in ./public/models/building/model.xgf \
  --inspect \
  --inspect-checks all \
  --inspection-report ./reports/building-inspection.json \
  --log
```

`--inspect-checks` accepts a comma-separated list:

- `dup`
- `similar`
- `dense`
- `large`
- `quality`
- `objects`
- `textures`
- `geom-far`
- `all`

By default, inspection errors abort conversion. Use
`--no-fail-on-inspect-errors` only when you deliberately want an advisory report
while still writing outputs.

---

## 5. Convert and Apply Automatic Fixes

Use `--inspect-fix` to run the scene-model fix registry after inspection and
before export.

```bash
npx xeoconvert \
  --in ./models/house.glb \
  --out ./public/models/house/model.xgf \
  --inspect-fix \
  --inspect-checks all \
  --inspection-report ./public/models/house/inspection.json \
  --optimization-report ./public/models/house/optimization.json \
  --conversion-report ./public/models/house/conversion.json \
  --log
```

`--inspection-report` records the findings. `--optimization-report` records
what the automatic fix step changed or skipped. `--conversion-report` records
format-fidelity warnings, such as source material features that an output format
cannot represent.

Do not treat automatic repair as a replacement for source-data validation. Some
issues require fixing the source model or loader configuration.

---

## 6. Generate an XGF Stream Dataset

Use an XGF Stream output when a model is too large for a single-file loading
workflow or when you want view-prioritized streaming.

```bash
npx xeoconvert \
  --pipeline ifc2xgfstream \
  --ifc ./models/source/campus.ifc \
  --xgfstream ./public/models/campus/xgfstream \
  --datamodel ./public/models/campus/datamodel.json \
  --xgfstream-partition grid \
  --xgfstream-chunk-metric objects \
  --xgfstream-chunk-budget 500 \
  --xgfstream-min-chunk-budget 125 \
  --xgfstream-grid-cell-size 40 \
  --xgfstream-chunk-dir chunks \
  --xgfstream-index index.json \
  --xgfstream-runtime-index index.runtime.json \
  --manifest-report ./public/models/campus/manifest.json \
  --stats-report ./public/models/campus/stats.json \
  --log
```

The `.xgfstream` output is a directory containing stream indexes and chunk XGF
files. Use it with the XGF streaming loader and a view stream controller in the
viewer.

---

## 7. Use a Coordinate System File

In generic `--in` / `--out` mode, pass `--coordinate-system` when the input needs
a known model-space basis, origin or unit scale.

```json
{
  "basis": [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  "origin": [0, 0, 0],
  "units": "meters",
  "scaleToMeters": 1
}
```

```bash
npx xeoconvert \
  --in ./models/source/site.glb \
  --out ./public/models/site/model.xgf \
  --coordinate-system ./models/source/site.coordSys.json \
  --log
```

For named pipelines, coordinate-system defaults are part of the pipeline. Use
pipeline-specific conversion scripts when a project needs more control than the
CLI flags expose.

---

## 8. Print and Override Rule Configuration

Print the effective inspection and optimization configuration:

```bash
npx xeoconvert --print-config
```

Load a full rule configuration:

```bash
npx xeoconvert \
  --pipeline ifc2xgf \
  --ifc ./models/source/building.ifc \
  --xgf ./public/models/building/model.xgf \
  --datamodel ./public/models/building/datamodel.json \
  --config ./conversion-rules.json \
  --inspect-fix \
  --inspection-report ./public/models/building/inspection.json \
  --optimization-report ./public/models/building/optimization.json
```

A full rule config can contain scene inspection settings, optimization settings,
data inspection settings and plugins:

```json
{
  "sceneInspections": {
    "GEOMETRY_DUPLICATE": {"enabled": true}
  },
  "optimizations": {
    "GEOMETRY_DUPLICATE": {"enabled": true},
    "GEOMETRY_OVER_BUDGET": {"enabled": false}
  },
  "dataInspections": {
    "checkSchemaTagging": true,
    "checkRelationshipCycles": true
  },
  "plugins": [
    "./project-conversion-rules.cjs"
  ]
}
```

Use `--inspect-config` when you only need inspection overrides, and
`--optimize-config` when you only need optimization overrides.

---

## 9. Use Reports in CI

For CI, write reports to a predictable directory and fail the job when the CLI
exits with an error.

```bash
mkdir -p ./reports

npx xeoconvert \
  --in ./models/source/house.glb \
  --out ./public/models/house/model.xgf \
  --inspect \
  --inspect-checks all \
  --inspection-report ./reports/house-inspection.json \
  --stats-report ./reports/house-stats.json \
  --manifest-report ./reports/house-manifest.json \
  --log
```

The CLI exits with `0` on success and a non-zero code on errors. Missing inputs,
unknown pipelines, missing required pipeline arguments, failed inspection gates
and write failures should stop the build.

---

## 10. Load the Converted XGF

After the IFC-to-XGF conversion, load the generated files in the viewer:

```javascript
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";

const scene = new Scene();
const data = new Data();

const sceneModelResult = scene.createModel({id: "building"});

if (!sceneModelResult.ok) {
  throw new Error(sceneModelResult.error);
}

const dataModelResult = data.createModel({id: "building"});

if (!dataModelResult.ok) {
  throw new Error(dataModelResult.error);
}

await new XGFLoader().load({
  fileData: await fetchArrayBuffer("./models/building/model.xgf"),
  sceneModel: sceneModelResult.value
});

await new DataModelImporter().load({
  fileData: await fetchJSON("./models/building/datamodel.json"),
  dataModel: dataModelResult.value
});
```

For conversions that only produce visual output, load just the XGF. Keep
conversion and viewing separate: `xeoconvert` prepares deployable assets, and
the viewer loads those assets with the runtime loaders.
