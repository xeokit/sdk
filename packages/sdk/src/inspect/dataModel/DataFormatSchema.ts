/**
 * Declarative spec describing what is well-formed in a given data
 * format — the rule book {@link inspectDataModel} validates a
 * {@link model!data.DataModel | DataModel} against. Plug-in inspections that want richer
 * constraints can read additional fields off the schema via TS
 * declaration merging.
 */
export interface DataFormatSchema {

  /** Compared against {@link DataObject.schema} and
   *  {@link Relationship.schema} by {@link schemaTagging}. */
  id: string;

  description?: string;

  /** Allowed DataObject types. Empty / missing disables type
   *  registration checks. */
  objectTypes?: { [typeId: string]: ObjectTypeSpec };

  /** Allowed Relationship types. Empty / missing disables type
   *  registration checks. */
  relationshipTypes?: { [typeId: string]: RelationshipTypeSpec };
}


/** Spec for one DataObject type. */
export interface ObjectTypeSpec {

  /** Single-inheritance super-type id. Resolved recursively against
   *  {@link DataFormatSchema.objectTypes}. */
  superType?: string;

  /** PropertySet ids the type must include. Missing surfaces as
   *  `OBJECT_REQUIRED_PROPERTY_SET_MISSING`. */
  requiredPropertySets?: string[];

  /** PropertySet ids the type must not include. Surfaces as
   *  `OBJECT_FORBIDDEN_PROPERTY_SET`. */
  forbiddenPropertySets?: string[];

  label?: string;
}


/** Spec for one Relationship type. */
export interface RelationshipTypeSpec {

  /** Allowed types for {@link Relationship.relatingObject}. A type
   *  matches when it equals one of these or any of its super-types
   *  does. Empty / missing means "any type allowed". */
  allowedRelatingTypes?: string[];

  /** Allowed types for {@link Relationship.relatedObject}. Same
   *  matching rules as {@link allowedRelatingTypes}. */
  allowedRelatedTypes?: string[];

  /** When `false` (default), self-references fire
   *  `RELATIONSHIP_SELF_REFERENCE_FORBIDDEN`. */
  allowSelfReference?: boolean;

  label?: string;
}


/**
 * Walk `typeId`'s super-type chain, return `true` when any link
 * appears in `allowedTypes`. Empty / missing `allowedTypes` is the
 * "any" sentinel and short-circuits to `true`. The walk's own
 * `seen` set guards against malformed circular chains.
 */
export function typeMatchesOrInherits(
  schema:       DataFormatSchema,
  typeId:       string,
  allowedTypes: readonly string[] | undefined,
): boolean {
  if (!allowedTypes || allowedTypes.length === 0) return true;
  const allowed = new Set(allowedTypes);
  const seen = new Set<string>();
  let cur: string | undefined = typeId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (allowed.has(cur)) return true;
    cur = schema.objectTypes?.[cur]?.superType;
  }
  return false;
}
