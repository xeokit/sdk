import type {InspectSceneModelParams} from "./params/InspectSceneModelParams";
import type {Issue} from "./Issue";
import type {InspectionReport} from "./InspectionReport";
import {DEFAULT_INSPECTION_REGISTRY} from "./DEFAULT_INSPECTION_REGISTRY";
import {getInspectionIndex} from "./internal/getInspectionIndex";


/**
 * Orchestrator for the demo's inspect pipeline. Walks every
 * {@link Inspection} registered in the configured
 * {@link InspectionRegistry}, concatenates each `run`'s issues, and
 * finalises the result into an {@link InspectionReport} bucketed
 * by severity and by code.
 *
 * The validator only inspects state — it never mutates the
 * SceneModel. Callers that want to block on errors should check
 * `report.errors.length === 0`; {@link optimizeSceneModel} does
 * this itself on entry.
 *
 * ## Defaults
 *
 *   - {@link InspectSceneModelParams.registry} defaults to
 *     {@link DEFAULT_INSPECTION_REGISTRY} — the singleton plugins
 *     extend on import.
 *   - Every inspection that has {@link Inspection.optIn | optIn}
 *     `true` reads its own `check…` flag from `params` and
 *     returns an empty array when the flag is unset, so this
 *     orchestrator stays oblivious to per-inspection options.
 *
 * ## Custom inspections
 *
 * ```ts
 * import {DEFAULT_INSPECTION_REGISTRY} from "@xeokit/sdk/inspect/sceneModel";
 *
 * DEFAULT_INSPECTION_REGISTRY.register({
 *   codes: ["MyApp/CHECK_NAMING"],
 *   description: "Object names follow project convention",
 *   run(sceneModel) {
 *     // walk + return Issue[]
 *   },
 * });
 * ```
 *
 * Or for tests / isolated runs, build a fresh registry:
 *
 * ```ts
 * import {InspectionRegistry, geometryDataIntegrity, inspectSceneModel} from "@xeokit/sdk/inspect/sceneModel";
 *
 * const registry = new InspectionRegistry([geometryDataIntegrity]);
 * const report = inspectSceneModel({sceneModel, registry});
 * ```
 */
export function inspectSceneModel(
  params: InspectSceneModelParams,
): InspectionReport {
  const sceneModel = params.sceneModel;
  const issues: Issue[] = [];

  if (!sceneModel || sceneModel.destroyed) {
    issues.push({
      severity: "error",
      code:     "SCENE_MODEL_INVALID",
      message:  "SceneModel is missing or destroyed",
    });
    return finalise(issues);
  }

  const registry = params.registry ?? DEFAULT_INSPECTION_REGISTRY;
  const index = getInspectionIndex(sceneModel);
  for (const inspection of registry.inspections()) {
    // Layer the registry-stored overrides for this inspection
    // under the per-call params — per-call wins on the keys it
    // declares. Inspections that don't use the schema-driven
    // config (or that don't have a stored override) see the
    // original params bag through transparently.
    const stored = registry.getConfig(inspection);
    const merged = stored ? {...stored, ...params} as InspectSceneModelParams : params;
    const produced = inspection.run(sceneModel, merged, index);
    if (produced.length > 0) {
      for (const i of produced) issues.push(i);
    }
  }
  // Drop the heaviest cached rows (decompressed positions, edge
  // incidence maps, canonical-triangle keys) so the index doesn't
  // pin O(model-size) memory between runs. Cheap rows (content
  // hashes, canonical slots, AABB centroids) survive — they're
  // tiny and reused by follow-up applyFixes calls.
  index.releaseHeavyRows();

  return finalise(issues);
}


function finalise(issues: Issue[]): InspectionReport {
  const errors:   Issue[] = [];
  const warnings: Issue[] = [];
  const info:     Issue[] = [];
  const byCode = new Map<string, Issue[]>();
  for (const i of issues) {
    if (i.severity === "error")        errors.push(i);
    else if (i.severity === "warning") warnings.push(i);
    else                                info.push(i);
    const bucket = byCode.get(i.code);
    if (bucket) {
      bucket.push(i);
    } else {
      byCode.set(i.code, [i]);
    }
  }
  return {issues, errors, warnings, info, byCode};
}
