import type {DataModel} from "../../../data";
import type {Inspection} from "../../Inspection";
import type {Issue} from "../../Issue";


/**
 * Always-on. Flags Relationships whose relating and related
 * objects are the same. Self-refs are advisory by default;
 * {@link relationshipTypeBinding} promotes them to errors when
 * the schema explicitly forbids self-reference for that type.
 *
 * Dangling-reference checks aren't included — `DataModel`'s
 * builders (`createRelationship`, `createObject`) reject unknown
 * ids at construction time, so a dangling endpoint can't exist
 * in a live DataModel.
 */
export const relationshipReferences: Inspection = {

  codes: ["RELATIONSHIP_SELF_REFERENCE"],

  description: "Relationship reference integrity",

  labels: {
    RELATIONSHIP_SELF_REFERENCE: "Relationship — self-reference",
  },

  descriptions: {
    RELATIONSHIP_SELF_REFERENCE:
      "Relationship's relating and related objects are the same. Most " +
      "relationship types are binary across two distinct objects; self- " +
      "references usually indicate a loader bug. Schemas can opt in via " +
      "RelationshipTypeSpec.allowSelfReference.",
  },

  run(dataModel: DataModel): Issue[] {
    const issues: Issue[] = [];
    for (const rel of dataModel.relationships) {
      const relating = rel.relatingObject;
      const related  = rel.relatedObject;
      if (relating && related && relating.id === related.id) {
        const locator = relationshipLocator(rel);
        issues.push({
          severity:   "warning",
          code:       "RELATIONSHIP_SELF_REFERENCE",
          message:    `Relationship '${locator}' has the same object on both sides ('${relating.id}')`,
          summary:    `'${relating.id}' both sides`,
          resourceId: locator,
          context:    {objectId: relating.id, type: rel.type},
        });
      }
    }
    return issues;
  },
};


/**
 * Synthetic locator for a Relationship — Relationships have no
 * stable id of their own. Stable across re-runs of the same state.
 */
export function relationshipLocator(rel: {
  type: string;
  relatingObject?: {id: string} | null;
  relatedObject?:  {id: string} | null;
}): string {
  const a = rel.relatingObject ? rel.relatingObject.id : "?";
  const b = rel.relatedObject  ? rel.relatedObject.id  : "?";
  return `${a}->${b}#${rel.type}`;
}
