import {applyFixesResultToJson} from "../../../../inspect/sceneModel";
import {type ModelConverterReporter} from "../ModelConverterReporter";
import {type ModelConverterResult} from "../../ModelConverterResult";

/**
 * Generate a JSON-ready report of the optimization (fix) outcomes per
 * SceneModel — the optimizer-mode counterpart to the inspection report.
 *
 * Reads the `fixResult` already attached to each
 * {@link ModelConverterResult.inspection} entry (populated when the inspect
 * step ran with `fix` enabled). Returns `null` — "nothing to write" — when no
 * optimization ran, so the CLI skips the file unless fixes actually executed.
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
  return {counts, bySceneModel};
};
