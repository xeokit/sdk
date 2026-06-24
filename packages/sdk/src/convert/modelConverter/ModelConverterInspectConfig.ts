import type {InspectSceneModelParams} from "../../inspect/sceneModel";
import type {InspectDataModelParams} from "../../inspect/dataModel";

/**
 * Optional inspect/fix step that runs after loading and before
 * exporting in {@link ModelConverter.convert}. When `enabled`, the
 * converter walks every SceneModel populated by the pipeline,
 * runs {@link inspectSceneModel} (or its async variant) and —
 * when `fix` is set — {@link applyFixes} before the exporters
 * serialise. The resulting reports surface on
 * {@link ModelConverterResult.inspection}.
 */
export interface ModelConverterInspectConfig {

  /** Master switch. Default `false` — pipelines without an
   * `inspect` block keep their current behaviour. */
  enabled?: boolean;

  /** Pass-through to {@link InspectSceneModelParams}. The
   * `sceneModel` field is supplied by the converter; everything
   * else (the opt-in `checkXxx` flags, thresholds, custom
   * registry) is forwarded verbatim. */
  checks?: Omit<InspectSceneModelParams, "sceneModel">;

  /** Pass-through to {@link InspectDataModelParams} for DataModel validation.
   * The `dataModel` field is supplied by the converter; the schema, opt-in
   * `checkXxx` flags and custom registry are forwarded verbatim. DataModel
   * inspection is validation-only (no fixes). */
  dataChecks?: Omit<InspectDataModelParams, "dataModel">;

  /**
   * `false` (default) — report only.
   * `true`            — run {@link applyFixes} after inspection.
   *
   * The fix pass is skipped when `report.errors.length > 0` —
   * auto-fixing on top of structural errors masks data corruption.
   */
  fix?: boolean;

  /** Re-run inspection after `fix` so the result reflects the
   * post-fix state. Default `true` whenever `fix` is set. */
  reInspect?: boolean;

  /** Skip `processOutputs` and resolve with errors populated when
   * `report.errors.length > 0`. Default `true`. Set `false` to
   * export anyway (e.g. you want the bad output for diffing). */
  failOnErrors?: boolean;

  /** Use {@link inspectSceneModelAsync} so a multi-million-tri
   * IFC doesn't block the event loop. Default `false`. */
  async?: boolean;
}
