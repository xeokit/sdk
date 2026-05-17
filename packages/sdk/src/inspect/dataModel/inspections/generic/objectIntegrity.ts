import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {Issue} from "../../Issue";


/**
 * Always-on. Walks every {@link model!data.DataObject | DataObject} for missing types and
 * duplicate property-set references.
 */
export const objectIntegrity: Inspection = {

  codes: [
    "OBJECT_MISSING_TYPE",
    "OBJECT_DUPLICATE_PROPERTY_SET_REF",
  ],

  description: "DataObject structural integrity",

  labels: {
    OBJECT_MISSING_TYPE:               "DataObject — missing type",
    OBJECT_DUPLICATE_PROPERTY_SET_REF: "DataObject — duplicate PropertySet reference",
  },

  descriptions: {
    OBJECT_MISSING_TYPE:
      "DataObject has no `type` value. Type-aware tooling — search, " +
      "filtering, schema validation — can't reason about untyped " +
      "objects.",
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
      if (sets && sets.length > 1) {
        const seen = new Set<string>();
        for (const ps of sets) {
          if (seen.has(ps.id)) {
            issues.push({
              severity:   "warning",
              code:       "OBJECT_DUPLICATE_PROPERTY_SET_REF",
              message:    `DataObject '${objId}' references PropertySet '${ps.id}' more than once`,
              summary:    `duplicate '${ps.id}'`,
              resourceId: objId,
              context:    {duplicatePropertySetId: ps.id},
            });
            break;
          }
          seen.add(ps.id);
        }
      }
    }
    return issues;
  },
};
