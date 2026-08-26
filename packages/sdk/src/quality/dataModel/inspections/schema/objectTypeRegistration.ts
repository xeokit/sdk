import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";


/**
 * Always-on; no-ops when `params.schema` lacks an `objectTypes`
 * map. Emits `OBJECT_UNKNOWN_TYPE` for any DataObject whose `type`
 * isn't a key in that map.
 */
export const objectTypeRegistration: Inspection = {

  codes: ["OBJECT_UNKNOWN_TYPE"],

  description: "DataObject types registered in schema",

  labels: {
    OBJECT_UNKNOWN_TYPE: "DataObject — unknown type",
  },

  descriptions: {
    OBJECT_UNKNOWN_TYPE:
      "DataObject's `type` isn't declared in the supplied " +
      "DataFormatSchema. Either misspelled, the schema is out of date, " +
      "or the source data uses a vocabulary the schema doesn't cover.",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    const schema = params.schema;
    if (!schema || !schema.objectTypes) return [];

    const issues: Issue[] = [];
    for (const objId in dataModel.objects) {
      const obj = dataModel.objects[objId];
      if (!obj.type) continue; // OBJECT_MISSING_TYPE covers this
      if (!Object.prototype.hasOwnProperty.call(schema.objectTypes, obj.type)) {
        issues.push({
          severity:   "error",
          code:       "OBJECT_UNKNOWN_TYPE",
          message:    `DataObject '${objId}' has type '${obj.type}' which is not declared in schema '${schema.id}'`,
          summary:    `type '${obj.type}' not in schema '${schema.id}'`,
          resourceId: objId,
          context:    {type: obj.type, schemaId: schema.id},
        });
      }
    }
    return issues;
  },
};
