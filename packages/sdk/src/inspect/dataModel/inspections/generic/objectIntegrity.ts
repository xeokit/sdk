import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {Issue} from "../../Issue";


/**
 * Always-on. Walks every {@link model!data.DataObject | DataObject} for missing types and
 * missing types, dangling property-set references, and duplicate
 * property-set references.
 */
export const objectIntegrity: Inspection = {

  codes: [
    "OBJECT_MISSING_TYPE",
    "OBJECT_DANGLING_PROPERTY_SET_REF",
    "OBJECT_DUPLICATE_PROPERTY_SET_REF",
  ],

  description: "DataObject structural integrity",

  labels: {
    OBJECT_MISSING_TYPE:               "DataObject — missing type",
    OBJECT_DANGLING_PROPERTY_SET_REF:  "DataObject — missing PropertySet",
    OBJECT_DUPLICATE_PROPERTY_SET_REF: "DataObject — duplicate PropertySet reference",
  },

  descriptions: {
    OBJECT_MISSING_TYPE:
      "DataObject has no `type` value. Type-aware tooling — search, " +
      "filtering, schema validation — can't reason about untyped " +
      "objects.",
    OBJECT_DANGLING_PROPERTY_SET_REF:
      "DataObject references a PropertySet that is missing from this " +
      "DataModel, has been replaced by another same-id PropertySet, " +
      "or is null.",
    OBJECT_DUPLICATE_PROPERTY_SET_REF:
      "DataObject lists the same PropertySet more than once in its " +
      "`propertySets` array. Harmless at runtime but usually a loader " +
      "bug.",
  },

  run(dataModel: DataModel): Issue[] {
    const issues: Issue[] = [];
    for (const objId in dataModel.objects) {
      const obj = dataModel.objects[objId];

      if (!obj.type || obj.type.length === 0) {
        issues.push({
          severity:   "error",
          code:       "OBJECT_MISSING_TYPE",
          message:    `DataObject '${objId}' has no type`,
          summary:    "missing type",
          resourceId: objId,
        });
      }

      // One issue per object on first dup — pathological N-copy
      // cases shouldn't drown the report.
      const sets = obj.propertySets;
      if (sets && sets.length > 0) {
        const seen = new Set<string>();
        for (const ps of sets) {
          const propertySetId = ps ? ps.id : "";
          if (!ps || dataModel.propertySets[propertySetId] !== ps) {
            issues.push({
              severity:   "error",
              code:       "OBJECT_DANGLING_PROPERTY_SET_REF",
              message:    `DataObject '${objId}' references missing, destroyed, or stale PropertySet '${propertySetId || "<null>"}'`,
              summary:    propertySetId ? `stale '${propertySetId}'` : "missing PropertySet",
              resourceId: objId,
              context:    {propertySetId},
            });
            continue;
          }
          if (seen.has(propertySetId)) {
            issues.push({
              severity:   "warning",
              code:       "OBJECT_DUPLICATE_PROPERTY_SET_REF",
              message:    `DataObject '${objId}' references PropertySet '${propertySetId}' more than once`,
              summary:    `duplicate '${propertySetId}'`,
              resourceId: objId,
              context:    {duplicatePropertySetId: propertySetId},
            });
            break;
          }
          seen.add(propertySetId);
        }
      }
    }
    return issues;
  },
};
