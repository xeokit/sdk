import type {DataModelParams} from "../../../model/data";
import type {MetaModelParams} from "./MetaModelParams";
import type {MetaObjectParams} from "./MetaObjectParams";
import type {MetaPropertySetParams} from "./MetaPropertySetParams";

/**
 * Converts a {@link model!data.DataModelParams | DataModelParams} to a legacy
 * {@link formats!metamodel.MetaModelParams | MetaModelParams}.
 *
 * Inverse of {@link convertMetaModel}: object aggregation relationships collapse
 * back into each meta-object's `parent`, and the entity–relationship graph is
 * flattened into the MetaModel's parent-pointer hierarchy.
 *
 * See {@link formats!metamodel | @xeokit/sdk/formats/metamodel} for usage.
 */
export function convertDataModel(dataModelParams: DataModelParams): MetaModelParams {

  const parentOf: Record<string, string> = {};
  for (const rel of dataModelParams.relationships || []) {
    parentOf[rel.relatedObjectId] = rel.relatingObjectId;
  }

  const metaObjects: MetaObjectParams[] = (dataModelParams.objects || []).map(object => ({
    id: object.id,
    name: object.name ?? object.id,
    type: object.type ?? "",
    parent: parentOf[object.id] ?? "",
    propertySetIds: object.propertySetIds ?? [],
    originalSystemId: object.originalSystemId,
  }));

  const propertySets: MetaPropertySetParams[] = (dataModelParams.propertySets || []).map(propertySet => ({
    id: propertySet.id,
    name: propertySet.name ?? propertySet.id,
    type: propertySet.type ?? "",
    originalSystemId: (propertySet as any).originalSystemId ?? "",
    properties: (propertySet.properties || []).map(property => ({
      name: property.name,
      type: property.type ?? "",
      value: property.value,
      valueType: (property as any).valueType ?? "",
      description: (property as any).description ?? "",
    })),
  }));

  return {
    projectId: String(dataModelParams.projectId ?? ""),
    author: dataModelParams.author ?? "",
    createdAt: dataModelParams.createdAt ?? "",
    schema: dataModelParams.schema ?? "",
    creatingApplication: dataModelParams.creatingApplication ?? "",
    metaObjects,
    propertySets,
  };
}
