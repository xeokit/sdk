import type {DataModel} from "../../../data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";
import {relationshipLocator} from "../generic/relationshipReferences";


/**
 * Opt-in via {@link InspectDataModelParams.checkSchemaTagging}.
 *
 * Compares each DataObject's and Relationship's `schema` field
 * against the expected schema id. The expected id comes from
 * `params.schema.id` when a {@link DataFormatSchema} is supplied;
 * otherwise it falls back to {@link DataModel.schema} (the
 * model-level tag). Entities with an empty / undefined schema
 * field are tolerated — only an explicit mismatch fires.
 *
 * The fallback path lets schema-tagging run without a full
 * `DataFormatSchema` — useful for projects that stamp the model
 * with a schema id but don't ship a vocabulary spec.
 */
export const schemaTagging: Inspection = {

  codes: [
    "OBJECT_SCHEMA_MISMATCH",
    "RELATIONSHIP_SCHEMA_MISMATCH",
  ],

  description: "Schema tag matches DataFormatSchema.id",

  optIn: true,
  paramsKey: "checkSchemaTagging",

  labels: {
    OBJECT_SCHEMA_MISMATCH:       "DataObject — schema tag mismatch",
    RELATIONSHIP_SCHEMA_MISMATCH: "Relationship — schema tag mismatch",
  },

  descriptions: {
    OBJECT_SCHEMA_MISMATCH:
      "DataObject's `schema` field is set to a value other than the " +
      "expected DataFormatSchema id.",
    RELATIONSHIP_SCHEMA_MISMATCH:
      "Same as the object variant, on a Relationship.",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    if (!params.checkSchemaTagging) return [];
    const expected = params.schema?.id ?? dataModel.schema;
    if (!expected) return [];

    const issues: Issue[] = [];

    for (const objId in dataModel.objects) {
      const obj = dataModel.objects[objId];
      if (obj.schema && obj.schema !== expected) {
        issues.push({
          severity:   "warning",
          code:       "OBJECT_SCHEMA_MISMATCH",
          message:    `DataObject '${objId}' is tagged schema '${obj.schema}', expected '${expected}'`,
          summary:    `'${obj.schema}' ≠ '${expected}'`,
          resourceId: objId,
          context:    {actual: obj.schema, expected},
        });
      }
    }

    for (const rel of dataModel.relationships) {
      if (rel.schema && rel.schema !== expected) {
        const locator = relationshipLocator(rel);
        issues.push({
          severity:   "warning",
          code:       "RELATIONSHIP_SCHEMA_MISMATCH",
          message:    `Relationship '${locator}' is tagged schema '${rel.schema}', expected '${expected}'`,
          summary:    `'${rel.schema}' ≠ '${expected}'`,
          resourceId: locator,
          context:    {actual: rel.schema, expected},
        });
      }
    }

    return issues;
  },
};
