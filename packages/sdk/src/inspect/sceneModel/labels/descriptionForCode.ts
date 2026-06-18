import {DEFAULT_INSPECTION_REGISTRY} from "../DEFAULT_INSPECTION_REGISTRY";
import type {InspectionRegistry} from "../InspectionRegistry";


/**
 * Resolve an {@link Issue.code | issue code} to a plain-English
 * description by consulting the
 * {@link Inspection.descriptions | descriptions} maps on every
 * {@link Inspection} registered in `registry` (default
 * {@link DEFAULT_INSPECTION_REGISTRY}).
 *
 * UIs use this to display a "What is this?" sentence above a
 * panel of issues that share a code — describing the underlying
 * problem rather than what the registered Fix would do about it.
 *
 * Returns the empty string when no inspection in the registry
 * registers a description for `code`. UIs should treat the
 * absence as "skip the description card", not as a fallback to
 * the code itself.
 *
 * @param code The issue code to look up.
 * @param registry The registry to walk. Defaults to
 *   {@link DEFAULT_INSPECTION_REGISTRY}.
 * @returns The description, or `""` when no inspection in the
 *   registry registers one.
 */
export function descriptionForCode(
  code: string,
  registry: InspectionRegistry = DEFAULT_INSPECTION_REGISTRY,
): string {
  for (const inspection of registry.inspections()) {
    const descriptions = inspection.descriptions;
    if (descriptions && Object.prototype.hasOwnProperty.call(descriptions, code)) {
      return descriptions[code];
    }
  }
  return "";
}
