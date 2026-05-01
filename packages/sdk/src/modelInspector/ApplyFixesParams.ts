import type {SceneModel} from "../scene";
import type {InspectionReport} from "./InspectionReport";
import type {FixRegistry} from "./FixRegistry";
import type {ApplyFixesProgress} from "./ApplyFixesProgress";


/** Parameters for {@link applyFixes}. */
export interface ApplyFixesParams {

  /**
   * SceneModel the fixes mutate. Same constraints as
   * {@link optimizeSceneModel} — strategies that need
   * {@link SceneModel.createGeometry} / `createMesh` will only
   * succeed before the model is finalised.
   */
  sceneModel: SceneModel;

  /**
   * Inspection report whose issues should be fed through the
   * registered strategies.
   */
  report: InspectionReport;

  /**
   * {@link FixRegistry} the fix runner dispatches against.
   * Default: {@link DEFAULT_FIX_REGISTRY} — the
   * pre-populated singleton that plugins register their strategies
   * into. Pass an explicit registry to use a custom dispatch table
   * (e.g. tests, or a pipeline that wants only a subset of fixes).
   */
  registry?: FixRegistry;

  /**
   * Whitelist of issue codes to fix. When omitted, every code that
   * has a matching strategy in the registry is fixed. Useful when
   * fixing incrementally — e.g. fix only `OBJECT_DANGLING_MESH`
   * first to settle reference integrity, then re-inspect, then fix
   * `GEOMETRY_DUPLICATE` once the report is clean of errors.
   */
  codes?: string[];

  /**
   * Optional `AbortSignal`. {@link applyFixesAsync} checks
   * `signal.aborted` between issues and throws an `AbortError`
   * when the caller aborts. Outcomes collected before the abort
   * are discarded — the SceneModel keeps any mutations that did
   * land before the abort, so a re-inspect after cancellation
   * tells the truth about post-abort state. The synchronous
   * {@link applyFixes} ignores this field.
   */
  signal?: AbortSignal;

  /**
   * Optional progress callback fired by {@link applyFixesAsync}.
   * Called with `phase: "before"` ahead of each issue's strategy
   * dispatch, `phase: "after"` once it resolves, and once more at
   * completion. The synchronous {@link applyFixes} ignores this
   * field.
   */
  onProgress?: (progress: ApplyFixesProgress) => void;
}
