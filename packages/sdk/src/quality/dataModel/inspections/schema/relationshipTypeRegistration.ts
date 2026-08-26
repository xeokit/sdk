import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";
import {relationshipLocator} from "../generic/relationshipReferences";


/**
 * Always-on; no-ops when `params.schema` lacks a
 * `relationshipTypes` map. Mirrors {@link objectTypeRegistration}.
 */
export const relationshipTypeRegistration: Inspection = {

  codes: ["RELATIONSHIP_UNKNOWN_TYPE"],

  description: "Relationship types registered in schema",

  labels: {
    RELATIONSHIP_UNKNOWN_TYPE: "Relationship — unknown type",
  },

  descriptions: {
    RELATIONSHIP_UNKNOWN_TYPE:
      "Relationship's `type` isn't declared in the supplied " +
      "DataFormatSchema.",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    const schema = params.schema;
    if (!schema || !schema.relationshipTypes) return [];

    const issues: Issue[] = [];
    for (const rel of dataModel.relationships) {
      if (!rel.type) continue;
      if (!Object.prototype.hasOwnProperty.call(schema.relationshipTypes, rel.type)) {
        const locator = relationshipLocator(rel);
        issues.push({
          severity:   "error",
          code:       "RELATIONSHIP_UNKNOWN_TYPE",
          message:    `Relationship '${locator}' has type '${rel.type}' which is not declared in schema '${schema.id}'`,
          summary:    `type '${rel.type}' not in schema '${schema.id}'`,
          resourceId: locator,
          context:    {type: rel.type, schemaId: schema.id},
        });
      }
    }
    return issues;
  },
};
