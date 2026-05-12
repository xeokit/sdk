import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import type {InspectionRegistry} from "../InspectionRegistry";


/** Resolve an issue code to its human-readable label via the
 *  registry. Falls back to the code itself when no label is
 *  registered. */
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
