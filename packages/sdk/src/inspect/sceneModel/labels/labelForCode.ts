import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import type {InspectionRegistry} from "../InspectionRegistry";


/**
 * Resolve an {@link Issue.code | issue code} to its human-readable
 * label by consulting the {@link Inspection.labels | labels} maps
 * on every {@link Inspection} registered in `registry` (default
 * {@link DEFAULT_INSPECTION_REGISTRY}).
 *
 * UIs use this when rendering codes: instead of showing
 * `GEOMETRY_DUPLICATE`, they show "Duplicate geometry"
 * (the friendly form), and a glance at any inspection's `labels`
 * map tells you which strings will appear.
 *
 * Falls back to the code itself when no label is registered —
 * codes added by external plugins that don't ship a label still
 * render legibly.
 *
 * @param code The issue code to look up.
 * @param registry The registry to walk. Defaults to
 *   {@link DEFAULT_INSPECTION_REGISTRY}.
 * @returns The friendly label, or `code` when no inspection in
 *   the registry registers one.
 */
export function labelForCode(
  code: string,
  registry: InspectionRegistry = DEFAULT_INSPECTION_REGISTRY,
): string {
  for (const inspection of registry.inspections()) {
    const labels = inspection.labels;
    if (labels && Object.prototype.hasOwnProperty.call(labels, code)) {
      return labels[code];
    }
  }
  return code;
}
