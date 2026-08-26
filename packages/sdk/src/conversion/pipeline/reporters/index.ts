/**
 * # Conversion Pipeline Reporters
 *
 * Utilities for generating reports and statistics during model conversion.
 *
 * @remarks
 * - The {@link manifest} submodule provides manifest reports describing the files and structure of a conversion.
 * - The {@link stats} submodule provides statistics and metrics about the conversion process.
 * - The {@link inspection} submodule serialises the per-SceneModel inspection results into a JSON-ready report.
 * - `optimization/createOptimizationReport` reports what the inspector's auto-fixer changed, per SceneModel.
 * - `conversion/createConversionReport` reports per-output conversion fidelity — what each exporter dropped or
 *   flattened because the target format couldn't represent it (e.g. triplanar textures), classifying each
 *   output `ok` / `lossy` / `failed`.
 *
 * @module reporters
 */

export * as manifest from "./manifest";
export * as stats from "./stats";
export * as inspection from "./inspection";
