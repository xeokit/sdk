import { IfcRelAggregates } from "../ifctypes";
/***
 * Converts a {@link metamodel!MetaModelParams | MetaModelParams} to a {@link data!DataModelParams | DataModelParams}.
 */
export function convertMetaModel(metaModelParams) {
    const dataModelParams = {
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
                type: 0 //metaObject.type
            });
            if (metaObject.parent) {
                dataModelParams.relationships.push({
                    relatingObjectId: metaObject.parent,
                    relatedObjectId: metaObject.id,
                    type: IfcRelAggregates
                });
            }
        }
    }
    return dataModelParams;
}
//# sourceMappingURL=convertMetaModel.js.map