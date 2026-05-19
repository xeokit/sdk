import type {DataObject} from "../../../model/data";


/**
 * Reads a single named property out of a `DataObject`'s PropertySets.
 *
 * Helper for {@link IfcPropertyRule} predicates — most common pattern
 * is "this object's `Pset_WallCommon.IsExternal` is `true`" and
 * writing the lookup inline is verbose. Pass the PropertySet's `type`
 * (the IFC pset name, e.g. `"Pset_WallCommon"`) and the property's
 * `name` (e.g. `"IsExternal"`).
 *
 * Returns `undefined` when:
 *
 *   - `dataObject` is `undefined`
 *   - the object has no `propertySets`
 *   - no PropertySet matches `propertySetType`
 *   - the matched PropertySet has no property named `propertyName`
 *
 * Property-set matching is exact on `PropertySet.type`. If you need
 * fuzzier lookup (e.g. case-insensitive pset name) walk the
 * `propertySets` array yourself.
 */
export function getDataProperty(
  dataObject:      DataObject | undefined,
  propertySetType: string,
  propertyName:    string,
): unknown {
  const psets = dataObject?.propertySets;
  if (!psets) {
    return undefined;
  }
  for (const pset of psets) {
    if (pset.type !== propertySetType) {
      continue;
    }
    for (const prop of pset.properties) {
      if (prop.name === propertyName) {
        return prop.value;
      }
    }
  }
  return undefined;
}
