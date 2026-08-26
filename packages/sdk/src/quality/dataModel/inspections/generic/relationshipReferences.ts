import type {DataModel} from "../../../../model/data";
import type {Inspection} from "../../Inspection";
import type {Issue} from "../../Issue";


/**
 * Always-on. Flags Relationships with missing / stale endpoint
 * DataObjects, plus Relationships whose relating and related
 * objects are the same. Self-refs are advisory by default;
 * {@link relationshipTypeBinding} promotes them to errors when
 * the schema explicitly forbids self-reference for that type.
 */
export const relationshipReferences: Inspection = {

  codes: [
    "RELATIONSHIP_DANGLING_RELATING_OBJECT",
    "RELATIONSHIP_DANGLING_RELATED_OBJECT",
    "RELATIONSHIP_SELF_REFERENCE",
  ],

  description: "Relationship reference integrity",

  labels: {
    RELATIONSHIP_DANGLING_RELATING_OBJECT: "Relationship — missing relating object",
    RELATIONSHIP_DANGLING_RELATED_OBJECT:  "Relationship — missing related object",
    RELATIONSHIP_SELF_REFERENCE: "Relationship — self-reference",
  },

  descriptions: {
    RELATIONSHIP_DANGLING_RELATING_OBJECT:
      "Relationship's relating endpoint is missing from the owning Data registry, " +
      "has been replaced by another same-id DataObject, or is null.",
    RELATIONSHIP_DANGLING_RELATED_OBJECT:
      "Relationship's related endpoint is missing from the owning Data registry, " +
      "has been replaced by another same-id DataObject, or is null.",
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
      const locator = relationshipLocator(rel);
      const relatingLive = !!relating && dataModel.data.objects[relating.id] === relating;
      const relatedLive  = !!related && dataModel.data.objects[related.id] === related;

      if (!relatingLive) {
        const objectId = relating ? relating.id : "";
        issues.push({
          severity:   "error",
          code:       "RELATIONSHIP_DANGLING_RELATING_OBJECT",
          message:    `Relationship '${locator}' references missing, destroyed, or stale relating DataObject '${objectId || "<null>"}'`,
          summary:    objectId ? `stale relating '${objectId}'` : "missing relating object",
          resourceId: locator,
          context:    {objectId, type: rel.type},
        });
      }

      if (!relatedLive) {
        const objectId = related ? related.id : "";
        issues.push({
          severity:   "error",
          code:       "RELATIONSHIP_DANGLING_RELATED_OBJECT",
          message:    `Relationship '${locator}' references missing, destroyed, or stale related DataObject '${objectId || "<null>"}'`,
          summary:    objectId ? `stale related '${objectId}'` : "missing related object",
          resourceId: locator,
          context:    {objectId, type: rel.type},
        });
      }

      if (relatingLive && relatedLive && relating.id === related.id) {
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
