import {type ModelConverterReporter} from "../ModelConverterReporter";
import {type ModelConverterResult} from "../../ModelConverterResult";

type OutputStatus = "ok" | "lossy" | "failed";

interface ConversionReportOutputSummary {
  filePath?: string;
  fileFormat: string;
  fileFormatVersion: string;
  fileDataSizeBytes: number;
  status: OutputStatus;
}

interface ConversionReportWarning {
  output: string;
  fileFormat: string;
  message: string;
}

interface ConversionReportError {
  /** Output id the error belongs to, or `null` for a run-level error. */
  output: string | null;
  message: string;
}

/**
 * Generate a JSON-ready conversion-fidelity report — how well the conversion
 * went and what was omitted. The CLI writes it to the path given via
 * `--conversion-report <file>`.
 *
 * Shape:
 *
 * - `summary` — run totals (`outputs`, `ok`, `lossy`, `failed`, `warnings`,
 *   `errors`) plus a per-output `byOutput` map of format, size and `status`.
 * - `warnings` — flat list of fidelity warnings the exporters raised (for
 *   example, triplanar textures dropped because the target format cannot
 *   represent world-projected texturing), each tagged with its output.
 * - `errors` — flat list of failures, per-output or run-level (`output: null`).
 *
 * Each output is classified `ok` (no warnings/errors), `lossy` (exported but
 * something was dropped or flattened) or `failed` (the export threw).
 *
 * Returns `null` ("nothing to write") when the run produced no outputs, so a
 * validate-only run doesn't emit an empty conversion report.
 */
export const createConversionReport: ModelConverterReporter = (
  modelConverterResult: ModelConverterResult,
) => {
  const outputIds = Object.keys(modelConverterResult.outputs);
  if (outputIds.length === 0) return null;

  const summary = {
    outputs: 0,
    ok: 0,
    lossy: 0,
    failed: 0,
    warnings: 0,
    errors: 0,
    byOutput: {} as {[id: string]: ConversionReportOutputSummary},
  };
  const warnings: ConversionReportWarning[] = [];
  const errors: ConversionReportError[] = [];

  for (const id of outputIds) {
    const output = modelConverterResult.outputs[id];
    const status: OutputStatus =
      output.errors.length ? "failed" : output.warnings.length ? "lossy" : "ok";

    summary.outputs++;
    summary[status]++;
    summary.warnings += output.warnings.length;
    summary.errors += output.errors.length;
    summary.byOutput[id] = {
      filePath: output.filePath,
      fileFormat: output.fileFormat,
      fileFormatVersion: output.fileFormatVersion,
      fileDataSizeBytes: output.fileDataSizeBytes,
      status,
    };

    for (const message of output.warnings) {
      warnings.push({output: id, fileFormat: output.fileFormat, message});
    }
    for (const message of output.errors) {
      errors.push({output: id, message});
    }
  }

  // Run-level errors (e.g. a pipeline failure not tied to one output).
  for (const message of modelConverterResult.errors) {
    summary.errors++;
    errors.push({output: null, message});
  }

  return {summary, warnings, errors};
};
