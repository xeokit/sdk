/**
 * Name-based rule that routes a `SceneObject` to a painter-table key
 * by matching the object's `DataObject.name`.
 *
 * Used by {@link applyIFCMaterials} as a sibling resolver to the IFC
 * type → painter mapping. Useful when authoring tools encode semantic
 * meaning in the element name that the IFC type can't capture — for
 * example Revit RPC trees that export as `IfcBuildingElementProxy`,
 * or German vs. English naming for vegetation.
 *
 * Pattern matches first-wins, before property rules and before the
 * fallback to `DataObject.type`. Consistent with how the V2 demo's
 * name-based fallback colour map works.
 */
export interface IfcNameRule {

  /**
   * Regex tested against the SceneObject's `DataObject.name`. Case
   * sensitivity / flags are entirely up to the caller — typically
   * `i` for human-readable element names.
   */
  pattern: RegExp;

  /**
   * Painter-table key to use when this rule fires. Looked up against
   * the merged `painters` map (defaults + user overrides) just like
   * an IFC type would be.
   */
  key: string;
}
