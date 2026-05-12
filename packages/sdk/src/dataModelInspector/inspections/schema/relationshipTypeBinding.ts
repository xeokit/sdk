import type {DataModel} from "../../../data";
import type {Inspection} from "../../Inspection";
import type {InspectDataModelParams} from "../../params/InspectDataModelParams";
import type {Issue} from "../../Issue";
import {typeMatchesOrInherits} from "../../DataFormatSchema";
import {relationshipLocator} from "../generic/relationshipReferences";


/**
 * Opt-in via {@link InspectDataModelParams.checkRelationshipTypeBinding}.
 *
 * For each Relationship, validates relating / related object
 * types against the schema's `allowedRelatingTypes` /
 * `allowedRelatedTypes` lists, honouring super-type inheritance.
 * Promotes self-references to errors when the schema sets
 * `allowSelfReference: false` (default).
 */
export const relationshipTypeBinding: Inspection = {

  codes: [
    "RELATIONSHIP_FORBIDDEN_RELATING_TYPE",
    "RELATIONSHIP_FORBIDDEN_RELATED_TYPE",
    "RELATIONSHIP_SELF_REFERENCE_FORBIDDEN",
  ],

  description: "Relationship endpoint types match schema",

  optIn: true,
  paramsKey: "checkRelationshipTypeBinding",

  labels: {
    RELATIONSHIP_FORBIDDEN_RELATING_TYPE:    "Relationship — relating type not allowed by schema",
    RELATIONSHIP_FORBIDDEN_RELATED_TYPE:     "Relationship — related type not allowed by schema",
    RELATIONSHIP_SELF_REFERENCE_FORBIDDEN:   "Relationship — self-reference forbidden by schema",
  },

  descriptions: {
    RELATIONSHIP_FORBIDDEN_RELATING_TYPE:
      "Relating object's type isn't on the schema's " +
      "allowedRelatingTypes list (or any of its super-types).",
    RELATIONSHIP_FORBIDDEN_RELATED_TYPE:
      "Same as the relating-side variant, on the related side.",
    RELATIONSHIP_SELF_REFERENCE_FORBIDDEN:
      "Relating and related are the same object AND the schema " +
      "explicitly forbids self-reference for this relationship type.",
  },

  run(dataModel: DataModel, params: InspectDataModelParams): Issue[] {
    if (!params.checkRelationshipTypeBinding) return [];
    const schema = params.schema;
    if (!schema || !schema.relationshipTypes) return [];

    const issues: Issue[] = [];
    for (const rel of dataModel.relationships) {
      const spec = schema.relationshipTypes[rel.type];
      // Unknown types are reported by relationshipTypeRegistration —
      // skip here to avoid double-counting.
      if (!spec) continue;
      if (!rel.relatingObject || !rel.relatedObject) continue;

      const locator = relationshipLocator(rel);

      if (!typeMatchesOrInherits(schema, rel.relatingObject.type, spec.allowedRelatingTypes)) {
        issues.push({
          severity:   "error",
          code:       "RELATIONSHIP_FORBIDDEN_RELATING_TYPE",
          message:    `Relationship '${locator}' has relating type '${rel.relatingObject.type}', not allowed for type '${rel.type}' (allowed: ${formatList(spec.allowedRelatingTypes)})`,
          summary:    `relating '${rel.relatingObject.type}' ⊄ ${formatList(spec.allowedRelatingTypes)}`,
          resourceId: locator,
          context:    {
            relationshipType: rel.type,
            actualType:       rel.relatingObject.type,
            allowedTypes:     spec.allowedRelatingTypes ?? [],
          },
        });
      }

      if (!typeMatchesOrInherits(schema, rel.relatedObject.type, spec.allowedRelatedTypes)) {
        issues.push({
          severity:   "error",
          code:       "RELATIONSHIP_FORBIDDEN_RELATED_TYPE",
          message:    `Relationship '${locator}' has related type '${rel.relatedObject.type}', not allowed for type '${rel.type}' (allowed: ${formatList(spec.allowedRelatedTypes)})`,
          summary:    `related '${rel.relatedObject.type}' ⊄ ${formatList(spec.allowedRelatedTypes)}`,
          resourceId: locator,
          context:    {
            relationshipType: rel.type,
            actualType:       rel.relatedObject.type,
            allowedTypes:     spec.allowedRelatedTypes ?? [],
          },
        });
      }

      if (rel.relatingObject.id === rel.relatedObject.id && spec.allowSelfReference !== true) {
        issues.push({
          severity:   "error",
          code:       "RELATIONSHIP_SELF_REFERENCE_FORBIDDEN",
          message:    `Relationship '${locator}' is a self-reference; type '${rel.type}' forbids self-references`,
          summary:    `self-ref forbidden for '${rel.type}'`,
          resourceId: locator,
          context:    {relationshipType: rel.type, objectId: rel.relatingObject.id},
        });
      }
    }
    return issues;
  },
};

function formatList(list: readonly string[] | undefined): string {
  if (!list || list.length === 0) return "(any)";
  return `[${list.join(", ")}]`;
}
