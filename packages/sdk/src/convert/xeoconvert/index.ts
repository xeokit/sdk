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
 * {@link convert!modelConverter.ModelConverter | ModelConverter}
 * class — same engine, scriptable from a shell.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * flowchart TB
 *     A[input file] --> B[--pipeline]
 *     B --> C[ModelConverter]
 *     C --> D[loader → SceneModel + DataModel]
 *     D --> E{--inspect?}
 *     E -- yes --> F[inspectSceneModel]
 *     F --> G{--inspect-fix?}
 *     G -- yes --> H[applyFixes]
 *     G -- no  --> I[exporter]
 *     H --> I
 *     E -- no  --> I
 *     I --> J[output file]
 *     F -.-> K[inspection report]
 *     C -.-> L[stats + manifest reports]
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Pipeline-based** — `--pipeline <name>` selects from a
 *   registered set of conversion routes (`dotbim2xgf`,
 *   `gltf2gltf`, etc.); each pipeline declares required input /
 *   output ids so the CLI tells the user exactly which flags are
 *   needed.
 * - **Inspection + auto-fix** — `--inspect`, `--inspect-fix`,
 *   `--inspect-checks` route through
 *   {@link inspect!sceneModel | inspect.sceneModel} so the export
 *   sees a validated and (optionally) auto-cleaned SceneModel.
 * - **Reporters** — pass `--<reporterId> <path>` to emit
 *   inspection / manifest / stats reports as JSON alongside the
 *   conversion output.
 * - **Async-friendly** — `--inspect-async` uses the
 *   chunk-yielding async path so very large models don't lock
 *   the Node process.
 * - **Fail-fast on errors** — by default the CLI aborts when
 *   inspection finds error-severity issues; pass
 *   `--no-fail-on-inspect-errors` to override.
 *
 * <br>
 *
 * # Installation
 *
 * Install the xeokit SDK by running:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * ### Basic Syntax
 * ````
 * node xeoconvert.js --pipeline <pipelineName> --<inputId> <inputFile> --<outputId> <outputFile> [options]
 * ````
 *
 * ### Required Parameters
 *
 * * `--pipeline <name>` - Specifies the conversion pipeline to use. *Each pipeline defines the required input and output formats.*
 * * `--<inputId> <inputFile>` - Supplies an input file for the pipeline. *The input ID depends on the pipeline and is mandatory.*
 * * `--<outputId> <outputFile>` - Specifies the output file where the converted result will be saved. *The output ID depends on the pipeline and is mandatory.*
 *
 * ### Optional Parameters
 *
 * * `--log` - Enables verbose logging for debugging and progress monitoring.
 * * `--<reporterId> <reportPath>` - Generates a conversion report in the specified file. *Reporter IDs vary depending on available report types.*
 *
 * ### Inspection
 *
 * `xeoconvert` can run {@link sceneModelInspector} on each loaded SceneModel before export — useful for catching
 * data-integrity errors and performance / correctness warnings, and (optionally) auto-fixing them. Results
 * surface on {@link convert!modelConverter.ModelConverterResult.inspection | ModelConverterResult.inspection} and via
 * the `inspection-report` reporter.
 *
 * * `--inspect` - Enables inspection. Implied by any other `--inspect-*` flag.
 * * `--inspect-fix` - Run {@link inspect!sceneModel.applyFixes | applyFixes} after inspection (skipped if errors are present).
 * * `--inspect-checks <list>` - Comma-separated opt-in checks. Available: `dup, similar, dense, large, quality, objects, textures, geom-far, all`.
 * * `--no-fail-on-inspect-errors` - Continue to export even when inspection found errors. Default is to abort.
 * * `--inspect-async` - Use {@link inspect!sceneModel.inspectSceneModelAsync | inspectSceneModelAsync} so very large models don't block.
 * * `--inspection-report <file>` - Write a JSON inspection report (auto-registered with the other reporters).
 *
 * ### Examples
 *
 * Inspect, auto-fix, and re-export a glTF model:
 *
 * ````bash
 * node xeoconvert.js \
 *   --pipeline gltf2gltf \
 *   --gltf model.glb \
 *   --gltf-out model.fixed.glb \
 *   --datamodel model.json \
 *   --inspect-fix --inspect-checks all \
 *   --inspection-report inspection.json --log
 * ````
 *
 * Inspect-only, no rewrite:
 *
 * ````bash
 * node xeoconvert.js --pipeline gltf --gltf model.glb \
 *   --inspect --inspect-checks all --inspection-report inspection.json --log
 * ````
 *
 * @module xeoconvert
 */
export * from "../modelConverter/reporters";

