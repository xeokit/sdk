import type {DataModelParams, RelationshipParams} from "../../data";
import {IfcRelAggregates} from "../../formats/ifc/ifctypes_4_0_2_1";
import type {MetaModelParams} from "./MetaModelParams";

/***
 * Converts a {@link metamodel!MetaModelParams | MetaModelParams} to a {@link data!DataModelParams | DataModelParams}.
 *
 * See {@link "metamodel" | @xeokit/sdk/metamodel} for usage.
 */
export function convertMetaModel(metaModelParams: MetaModelParams): DataModelParams {
  const dataModelParams: DataModelParams = {
    id: "",
    objects: [],
    relationships: [],
    propertySets: []
  };
  if (metaModelParams.propertySets) {
    for (let i = 0, len = metaModelParams.propertySets.length; i < len; i++) {
      const propertySetParams = metaModelParams.propertySets[i];
      if (!propertySetParams.properties) { // HACK: https://github.com/Creoox/creoox-ifc2gltfcxconverter/issues/8
        propertySetParams.properties = [];
      }
      dataModelParams.propertySets.push(propertySetParams);
    }
  }
  if (metaModelParams.metaObjects) {
    for (let i = 0, len = metaModelParams.metaObjects.length; i < len; i++) {
      const metaObject = metaModelParams.metaObjects[i];
      dataModelParams.objects.push({
        id: metaObject.id,
        name: metaObject.name,
        type: 0//metaObject.type
      });
      if (metaObject.parent) {
        dataModelParams.relationships.push(<RelationshipParams>{
          relatingObjectId: metaObject.parent,
          relatedObjectId: metaObject.id,
          type: IfcRelAggregates
        })
      }
    }
  }
  return dataModelParams;
}
