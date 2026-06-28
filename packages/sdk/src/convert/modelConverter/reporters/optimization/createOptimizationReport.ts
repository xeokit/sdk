import {applyFixesResultToJson} from "../../../../inspect/sceneModel";
import {type ModelConverterReporter} from "../ModelConverterReporter";
import {type ModelConverterResult} from "../../ModelConverterResult";

interface FileSize {
  filePath?: string;
  fileFormat: string;
  fileDataSizeBytes: number;
}

/**
 * Generate a JSON-ready report of the optimization (fix) outcomes per
 * SceneModel — the optimizer-mode counterpart to the inspection report.
 *
 * Reads the `fixResult` already attached to each
 * {@link ModelConverterResult.inspection} entry (populated when the inspect
 * step ran with `fix` enabled). Also records input (original) and output
 * (optimized) file sizes from the conversion result, with a `bytes` summary —
 * for an in-place optimize that's the size before and after the rewrite.
 * Returns `null` — "nothing to write" — when no optimization ran, so the CLI
 * skips the file unless fixes actually executed.
 */
export const createOptimizationReport: ModelConverterReporter = (
  modelConverterResult: ModelConverterResult,
) => {
  const inspection = modelConverterResult.inspection;
  if (!inspection) return null;

  const counts = {sceneModels: 0, fixed: 0, skipped: 0, errors: 0};
  const bySceneModel: {[id: string]: ReturnType<typeof applyFixesResultToJson>} = {};
  let any = false;

  for (const id of Object.keys(inspection.bySceneModel)) {
    const fixResult = inspection.bySceneModel[id].fixResult;
    if (!fixResult) continue;
    any = true;
    counts.sceneModels++;
    counts.fixed   += fixResult.fixed.length;
    counts.skipped += fixResult.skipped.length;
    counts.errors  += fixResult.errors.length;
    bySceneModel[id] = applyFixesResultToJson(fixResult);
  }

  if (!any) return null;

  const inputs: {[id: string]: FileSize} = {};
  const outputs: {[id: string]: FileSize} = {};
  let bytesIn = 0;
  let bytesOut = 0;
  for (const id of Object.keys(modelConverterResult.inputs || {})) {
    const i = modelConverterResult.inputs[id];
    inputs[id] = {filePath: i.filePath, fileFormat: i.fileFormat, fileDataSizeBytes: i.fileDataSizeBytes};
    bytesIn += i.fileDataSizeBytes || 0;
  }
  for (const id of Object.keys(modelConverterResult.outputs || {})) {
    const o = modelConverterResult.outputs[id];
    outputs[id] = {filePath: o.filePath, fileFormat: o.fileFormat, fileDataSizeBytes: o.fileDataSizeBytes};
    bytesOut += o.fileDataSizeBytes || 0;
  }
  const bytes = {input: bytesIn, output: bytesOut, delta: bytesOut - bytesIn};

  return {counts, bytes, files: {inputs, outputs}, bySceneModel};
};
