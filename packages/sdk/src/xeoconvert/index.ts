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
 * `xeoconvert` is a Node.js command-line utility that converts 3D model or data files between various formats.
 * It uses predefined pipelines that describe how to process input files into output files.
 *
 * The tool is designed for users who want a simple, scriptable way to transform models, inspect the results, and optionally generate reports.
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
 * surface on {@link modelConverter!ModelConverterResult.inspection | ModelConverterResult.inspection} and via
 * the `inspection-report` reporter.
 *
 * * `--inspect` - Enables inspection. Implied by any other `--inspect-*` flag.
 * * `--inspect-fix` - Run {@link sceneModelInspector!applyFixes | applyFixes} after inspection (skipped if errors are present).
 * * `--inspect-checks <list>` - Comma-separated opt-in checks. Available: `dup, similar, dense, large, quality, objects, textures, geom-far, all`.
 * * `--no-fail-on-inspect-errors` - Continue to export even when inspection found errors. Default is to abort.
 * * `--inspect-async` - Use {@link sceneModelInspector!inspectSceneModelAsync | inspectSceneModelAsync} so very large models don't block.
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

