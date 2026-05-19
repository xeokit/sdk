import type {DataObject} from "../../../model/data";


/**
 * Property-based rule that routes a `SceneObject` to a painter-table
 * key by inspecting the object's `DataObject` — typically its
 * `propertySets` (e.g. `Pset_WallCommon.IsExternal === true`).
 *
 * Used by {@link applyIFCMaterials} after name rules have been tried
 * and before falling back to `DataObject.type`. Lets routing decisions
 * key off semantic IFC properties that the type alone doesn't carry —
 * exterior vs. interior walls, load-bearing slabs, fire-rated doors,
 * etc.
 *
 * `predicate` is run once per object during `applyIFCMaterials`;
 * cheap inspection is fine, but expensive computation should be
 * memoised by the caller.
 */
export interface IfcPropertyRule {

  /**
   * Predicate run against the object's `DataObject` (which exposes
   * `name`, `type`, and `propertySets`). Returns `true` to route this
   * object to {@link IfcPropertyRule.key}; returns `false` to pass.
   *
   * The `DataObject` may be `undefined` when no DataModel pair exists
   * for the SceneObject — predicates should handle that case
   * defensively.
   */
  predicate: (dataObject: DataObject | undefined) => boolean;

  /**
   * Painter-table key to use when this rule fires.
   */
  key: string;
}
