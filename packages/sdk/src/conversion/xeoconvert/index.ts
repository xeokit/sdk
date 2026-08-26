/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Multi-Format File Converter
 *
 * ---
 *
 * ***CLI tool for converting 3D models between various formats.***
 *
 * ---
 *
 * `xeoconvert` is a Node.js command-line utility that converts 3D
 * model or data files between formats. Pre-defined pipelines describe
 * how each input file flows into one or more output files; optional
 * inspection / auto-fix passes catch data integrity issues before
 * export.
 *
 * Wraps the
 * {@link convert!pipeline.ModelConverter | ModelConverter}
 * class — same engine, scriptable from a shell.
 *
 * <br>
 *
 * ## Tasks
 *
 * Each run does one of four things. The flags select which; all four share one
 * internal sequence — load, optionally inspect, optionally fix, optionally export.
 *
 * ```mermaid
 * flowchart LR
 *     G([Run]) --> C[Convert]
 *     G --> CO[Convert + optimize]
 *     G --> V[Validate]
 *     G --> O[Optimize in place]
 *     C --> C1[load A] --> C2[export B] --> C3[B]
 *     CO --> CO1[load A] --> CO2[inspect + fix] --> CO3[export B] --> CO4[B + reports]
 *     V --> V1[load A] --> V2[inspect] --> V3[reports only]
 *     O --> O1[load A] --> O2[inspect + fix] --> O3[export A] --> O4[A + reports]
 * ```
 *
 * <br>
 *
 * | Task | `--out`? | Inspection flags | Produces |
 * | --- | --- | --- | --- |
 * | Convert | different format | none | output file |
 * | Convert + optimize | different format | `--inspect-fix` | cleaned output + reports |
 * | Validate | omitted | `--inspect` | reports only |
 * | Optimize in place | same format | `--inspect-fix` | rewritten file + reports |
 *
 * <br>
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * <br>
 *
 * # Usage
 *
 * Two ways to name input and output:
 *
 * - `--in <file> --out <file>` — loader and exporter resolved from the file
 *   extensions. Covers the single-input/single-output case.
 * - `--pipeline <name> --<inputId> <file> --<outputId> <file>` — a registered
 *   pipeline for multi-input/output, coordinate-system conversion, or the
 *   ambiguous `.json` formats. The pipeline declares the required ids; the CLI
 *   reports which are missing.
 *
 * Add `--log` to any command for progress output.
 *
 * <br>
 *
 * ## Convert
 *
 * Load one format, write another.
 *
 * ````bash
 * node xeoconvert.js --in model.glb --out model.xgf
 * ````
 *
 * Multi-output via a named pipeline (geometry to XGF, semantics to a DataModel):
 *
 * ````bash
 * node xeoconvert.js --pipeline ifc2xgf --ifc model.ifc \
 *   --xgf model.xgf --datamodel model.json
 * ````
 *
 * Some target formats cannot represent every source feature. The
 * `--conversion-report` reporter records what each exporter dropped or flattened
 * (for example, triplanar textures the format has no projection for):
 *
 * ````bash
 * node xeoconvert.js --in model.xgf --out model.gltf \
 *   --conversion-report conversion.json
 * ````
 *
 * <br>
 *
 * ## Convert + optimize
 *
 * Convert and clean the SceneModel in the same pass. `--inspect-fix` runs
 * {@link inspect!sceneModel.applyFixes | applyFixes} before export, so the output
 * is already deduplicated and re-quantised.
 *
 * ````bash
 * node xeoconvert.js --in model.glb --out model.xgf \
 *   --inspect-fix --inspect-checks all \
 *   --optimization-report optimization.json --conversion-report conversion.json
 * ````
 *
 * <br>
 *
 * ## Validate
 *
 * Load and inspect; write no model file. Omit `--out` (or use a pipeline with no
 * outputs) and request an inspection report.
 *
 * ````bash
 * node xeoconvert.js --in model.xgf \
 *   --inspect --inspect-checks all --inspection-report inspection.json
 * ````
 *
 * Inspection runs {@link sceneModelInspector} on each loaded SceneModel. Results
 * also surface on
 * {@link convert!pipeline.ModelConverterResult.inspection | ModelConverterResult.inspection}.
 *
 * To gate a conversion on validation, combine `--out` with `--inspect` (without
 * `--inspect-fix`): the export aborts if inspection finds errors, unless
 * `--no-fail-on-inspect-errors` downgrades the gate to advisory.
 *
 * <br>
 *
 * ## Optimize in place
 *
 * Rewrite a file in its own format with fixes applied. Same in/out extension.
 *
 * ````bash
 * node xeoconvert.js --in model.xgf --out model.xgf \
 *   --inspect-fix --inspect-checks all --optimization-report optimization.json
 * ````
 *
 * <br>
 *
 * # Reference
 *
 * ## Pipelines
 *
 * `--pipeline <name>` with the listed input/output arg ids. A pipeline with no
 * outputs is validate-only.
 *
 * | Pipeline | Input args (loader) | Output args → files |
 * | --- | --- | --- |
 * | `json` | `--scenemodel` `--datamodel` | validate-only |
 * | `gltf` | `--gltf` | validate-only |
 * | `gltf2xgf` | `--gltf` | `--xgf`, `--datamodel` |
 * | `gltf2gltf` | `--gltf` | `--gltf-out`, `--datamodel` |
 * | `gltf2dotbim` | `--gltf` `--datamodel` | `--dotbim` |
 * | `cityjson` | `--cityjson` | validate-only |
 * | `cityjson2xgf` | `--cityjson` | `--xgf`, `--datamodel` |
 * | `cityjson2json` | `--cityjson` | `--scenemodel`, `--datamodel` |
 * | `citygml` | `--citygml` | validate-only |
 * | `citygml2xgf` | `--citygml` | `--xgf`, `--datamodel` |
 * | `citygml2xgfstream` | `--citygml` | `--xgfstream`, `--datamodel` |
 * | `citygml2json` | `--citygml` | `--scenemodel`, `--datamodel` |
 * | `ifc` | `--ifc` | validate-only |
 * | `ifc2json` | `--ifc` | `--datamodel`, `--scenemodel` |
 * | `ifc2xgf` | `--ifc` | `--xgf`, `--datamodel` |
 * | `ifc2dotbim` | `--ifc` | `--dotbim` |
 * | `dotbim` | `--dotbim` | validate-only |
 * | `dotbim2gltf` | `--dotbim` | `--gltf` |
 * | `dotbim2json` | `--dotbim` | `--datamodel`, `--scenemodel` |
 * | `dotbim2xgf` | `--dotbim` | `--xgf`, `--datamodel` |
 * | `dotbim2ifc` | `--dotbim` | `--ifc` |
 * | `las` | `--las` | validate-only |
 * | `las2xgf` | `--las` | `--xgf` |
 *
 * ## Formats by extension
 *
 * In `--in`/`--out` mode the loader and exporter are resolved from the file
 * extension. Same in/out extension is an in-place optimize/validate.
 *
 * | Ext | Loader | Exporter |
 * | --- | --- | --- |
 * | `.glb` / `.gltf` | glb | glb |
 * | `.gml` / `.citygml` | citygml | — (input only) |
 * | `.xgf` | xgf | xgf |
 * | `.ifc` | ifc | ifc |
 * | `.bim` | dotbim | dotbim |
 * | `.las` / `.laz` | las | — (input only) |
 * | `.e57` | e57 | e57 |
 * | `.splat` | gaussiansplat | gaussiansplat |
 * | `.fbx` | fbx | fbx |
 * | `.obj` | obj | obj |
 * | `.mtl` | mtl | mtl |
 * | `.usdz` | usdz | usdz |
 * | `.3dxml` | threedxml | threedxml |
 * | `.fds` | fds | fds |
 * | `.xkt` | xkt | xkt |
 * | `.dxf` | — | dxf (output only) |
 * | `.svg` | — | svg (output only) |
 *
 * Use `--loader` / `--exporter` to override resolution for the ambiguous `.json`
 * scenemodel/datamodel pair.
 *
 * ## Inspection flags
 *
 * * `--inspect` — enable inspection. Implied by any other `--inspect-*` flag.
 * * `--inspect-fix` — run {@link inspect!sceneModel.applyFixes | applyFixes} after inspection (skipped if errors are present).
 * * `--inspect-checks <list>` — comma-separated opt-in checks: `dup, similar, dense, large, quality, objects, textures, geom-far, all`.
 * * `--no-fail-on-inspect-errors` — export even when inspection found errors. Default aborts.
 * * `--inspect-async` — use {@link inspect!sceneModel.inspectSceneModelAsync | inspectSceneModelAsync} so very large models don't block.
 *
 * ## Configuration flags
 *
 * Tune which checks and fixes run, or print the effective config. These don't write models.
 *
 * * `--config <file>` — full rule config (inspections, optimizations, `dataInspections`, `plugins`).
 * * `--inspect-config <file>` — inspection overrides only.
 * * `--optimize-config <file>` — optimization (fix) overrides only.
 * * `--print-config` — print the merged config to stdout and exit.
 *
 * ## Report flags
 *
 * Each writes JSON to the given path; omit the flag to skip the report. A path is required when the flag is present.
 *
 * * `--inspection-report <file>` — validation findings.
 * * `--optimization-report <file>` — what `--inspect-fix` changed. Empty unless fixes ran.
 * * `--conversion-report <file>` — per-output fidelity (see below).
 * * `--stats-report <file>` — sizes, formats, counts.
 * * `--manifest-report <file>` — inventory of written files.
 *
 * ### Conversion report
 *
 * Records how faithfully each output was produced. Each output's `status` is
 * `ok` (no warnings/errors), `lossy` (something dropped or flattened) or
 * `failed` (the export threw). `errors` entries are tagged with their output, or
 * `null` for a run-level failure. Exporters surface these via the `onWarning`
 * export option; currently emitted for triplanar (world-projected) textures the
 * glTF, FBX, USDZ and XKT exporters cannot represent.
 *
 * The AECMaterials model uses triplanar texturing, which glTF can't represent:
 *
 * ````bash
 * node xeoconvert.js --in AECMaterials/xgf/model.xgf --out AECMaterials.gltf \
 *   --conversion-report AECMaterials-conversion.json
 * ````
 *
 * `AECMaterials-conversion.json`:
 *
 * ````json
 * {
 *     "summary": {
 *         "outputs": 1, "ok": 0, "lossy": 1, "failed": 0, "warnings": 1, "errors": 0,
 *         "byOutput": {
 *             "out": { "filePath": "AECMaterials.gltf", "fileFormat": "glTF",
 *                      "fileFormatVersion": "2", "fileDataSizeBytes": 137552, "status": "lossy" }
 *         }
 *     },
 *     "warnings": [
 *         { "output": "out", "fileFormat": "glTF",
 *           "message": "[glTF] Dropped 63 texture(s) on 21 material(s): they are sampled via triplanar (world-projected) texturing, which glTF cannot represent — those materials are exported as flat colour. Export to XGF to keep them." }
 *     ],
 *     "errors": []
 * }
 * ````
 *
 * ## Behaviour
 *
 * * Output files are written only for the `--out` / `--<outputId>` paths supplied; missing directories are created.
 * * `fileDataType` sets encoding — `json` minified, `text` as-is, binary as a `Buffer`.
 * * Exit code is `1` on success, `-1` on error.
 *
 * @module xeoconvert
 */
export * from "../pipeline/reporters";
