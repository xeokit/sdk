import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";


/**
 * Always-on (active when a schema is supplied). Walks every
 * {@link model!data.DataObject | DataObject}'s `propertySets` and enforces per-type
 * `requiredPropertySets` / `forbiddenPropertySets` rules.
 *
 * Dangling-reference checks aren't included —
 * `DataModel.createObject` rejects unknown PropertySet ids at
 * construction time, so dangling refs can't exist in a live
 * DataModel.
 */
export const propertySetReferences: Inspection = {

  codes: [
    "OBJECT_REQUIRED_PROPERTY_SET_MISSING",
    "OBJECT_FORBIDDEN_PROPERTY_SET",
  ],

  description: "DataObject PropertySet usage",

  labels: {
    OBJECT_REQUIRED_PROPERTY_SET_MISSING: "DataObject — required PropertySet missing",
    OBJECT_FORBIDDEN_PROPERTY_SET:        "DataObject — forbidden PropertySet present",
  },

  descriptions: {
    OBJECT_REQUIRED_PROPERTY_SET_MISSING:
      "DataObject's type declares a required PropertySet that is " +
      "absent from the object's `propertySets`.",
    OBJECT_FORBIDDEN_PROPERTY_SET:
      "DataObject carries a PropertySet that the schema explicitly " +
      "forbids for this type.",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    const schema = params.schema;
    if (!schema || !schema.objectTypes) return [];

    const issues: Issue[] = [];
    for (const objId in dataModel.objects) {
      const obj = dataModel.objects[objId];
      const spec = schema.objectTypes[obj.type];
      if (!spec) continue;

      const required  = spec.requiredPropertySets;
      const forbidden = spec.forbiddenPropertySets;
      if (!required && !forbidden) continue;

      const present = new Set<string>();
      const sets = obj.propertySets ?? [];
      for (const ps of sets) {
        if (ps && dataModel.propertySets[ps.id] === ps) {
          present.add(ps.id);
        }
      }

      if (required) {
        for (const id of required) {
          if (!present.has(id)) {
            issues.push({
              severity:   "warning",
              code:       "OBJECT_REQUIRED_PROPERTY_SET_MISSING",
              message:    `DataObject '${objId}' (type '${obj.type}') is missing required PropertySet '${id}'`,
              summary:    `missing required '${id}'`,
              resourceId: objId,
              context:    {type: obj.type, requiredPropertySetId: id},
            });
          }
        }
      }

      if (forbidden) {
        for (const id of forbidden) {
          if (present.has(id)) {
            issues.push({
              severity:   "warning",
              code:       "OBJECT_FORBIDDEN_PROPERTY_SET",
              message:    `DataObject '${objId}' (type '${obj.type}') carries forbidden PropertySet '${id}'`,
              summary:    `forbidden '${id}'`,
              resourceId: objId,
              context:    {type: obj.type, forbiddenPropertySetId: id},
            });
          }
        }
      }
    }
    return issues;
  },
};
