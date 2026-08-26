/**
 * # Conversion Pipeline Inspection Reporters
 *
 * Utilities for serialising the per-SceneModel inspection results
 * attached to {@link ModelConverterResult.inspection} into a
 * JSON-ready report.
 *
 * @remarks
 * - {@link ModelConverterInspectionReport}: JSON-ready inspection
 *   report, one entry per SceneModel.
 * - {@link createInspectionReport}: Reporter function that
 *   produces it (returns `null` when no `inspect` block ran).
 *
 * @module inspection
 */
export * from "./ModelConverterInspectionReport";
export * from "./createInspectionReport";
