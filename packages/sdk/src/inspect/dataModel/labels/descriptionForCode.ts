import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import type {InspectionRegistry} from "../InspectionRegistry";


/** Resolve an issue code to its plain-English description via the
 *  registry. Returns `undefined` when none is registered. */
export function descriptionForCode(
  code: string,
  registry: InspectionRegistry = DEFAULT_INSPECTION_REGISTRY,
): string | undefined {
  for (const inspection of registry.inspections()) {
    const descriptions = inspection.descriptions;
    if (descriptions && Object.prototype.hasOwnProperty.call(descriptions, code)) {
      return descriptions[code];
    }
  }
  return undefined;
}
