import {ModelLoader, ModelLoadParams} from "../io";
import {DataModel} from "../data";
import {IfcRelAggregates, ifcTypeCodes} from "../ifctypes";

/**
 * Loads {@link MetaModelParams | MetaModelParams} into a {@link DataModel | DataModel}.
 */
export class MetaModelLoader extends ModelLoader {

    /**
     * Constructs a MetaModelLoader.
     */
    constructor() {
        super({
            fileDataType: "json",
            parsers: {
                "1.0": parseMetaModel
            },
            getVersion: (fileData: any): string => {
                return fileData.version || "1.0";
            }
        });
    }
}

function parseMetaModel(params: ModelLoadParams): Promise<void> {
    const {fileData, dataModel} = params;

    // TODO: Property set decompression

    if (fileData.propertySets) {
        for (let i = 0, len = fileData.propertySets.length; i < len; i++) {
            const propertySetData = fileData.propertySets[i];
            if (!propertySetData.properties) { // HACK: https://github.com/Creoox/creoox-ifc2gltfcxconverter/issues/8
                propertySetData.properties = [];
            }
            let propertySet = dataModel.propertySets[propertySetData.id];
            if (!propertySet) {
                dataModel.createPropertySet({
                    id: propertySetData.id,
                    type: propertySetData.type,
                    name: propertySetData.name,

                    // FIXME: Properties not translated right here

                    properties: propertySetData.properties
                });
            }
        }
    }
    if (fileData.metaObjects) {
        for (let i = 0, len = fileData.metaObjects.length; i < len; i++) {
            const metaObjectData = fileData.metaObjects[i];
            const id = metaObjectData.id;
            let dataObject = dataModel.objects[id];
            if (!dataObject) {
                const originalSystemId = metaObjectData.originalSystemId;
                const propertySetIds = metaObjectData.propertySets || metaObjectData.propertySetIds;
                const type = ifcTypeCodes[metaObjectData.type];
                dataModel.createObject({
                    id,
                    originalSystemId,
                    type,
                    name: metaObjectData.name,
                    propertySetIds
                });
                if (metaObjectData.parent) {
                    dataModel.createRelationship({
                        relatingObjectId: metaObjectData.parent,
                        relatedObjectId: id,
                        type: IfcRelAggregates
                    })
                }
            }
        }
    }
    return Promise.resolve();
}
