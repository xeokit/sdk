import type {IssueSeverity} from "./params/IssueSeverity";


/** One finding produced by {@link inspectDataModel}. */
export interface Issue {

  severity: IssueSeverity;

  /**
   * Stable code (e.g. `"OBJECT_UNKNOWN_TYPE"`). Built-in codes are
   * CONSTANT_CASE; custom inspections should namespace
   * (`"MyApp/CHECK_NAMING"`).
   */
  code: string;

  message: string;

  /** Optional one-line summary for UI rendering — the few ids /
   *  type names worth surfacing without parsing `message`. */
  summary?: string;

  /**
   * The DataModel resource this issue is about. DataObject ids
   * pass through directly; Relationships — which have no stable
   * id — get a synthetic `${relating}->${related}#${type}` locator.
   */
  resourceId?: string;

  /** Structured payload for tooling. Consumers should treat
   *  missing keys defensively. */
  context?: Record<string, unknown>;
}
