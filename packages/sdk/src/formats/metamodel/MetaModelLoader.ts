import type {ModelLoadParams} from "../ModelLoadParams";
import {ModelLoader} from "../ModelLoader";
import {DataModel} from "../../data";

/**
 * Loads {@link MetaModelParams | MetaModelParams} into a {@link DataModel | DataModel}.
 */
export class MetaModelLoader extends ModelLoader {

  /**
   * Constructs a MetaModelLoader.
   */
  constructor() {
    super({
      format: "MetaModelParams",
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
      const propertySet = dataModel.propertySets[propertySetData.id];
      if (!propertySet) {
        const result = dataModel.createPropertySet({
          id: propertySetData.id,
          type: propertySetData.type,
          name: propertySetData.name,
          properties: propertySetData.properties
        });
        if (result.ok ===false) {
          return Promise.reject(`[MetaModelLoader.load]: Could not create PropertySet -> ${result.error}`);
        }
      }
    }
  }
  if (fileData.metaObjects) {
    for (let i = 0, len = fileData.metaObjects.length; i < len; i++) {
      const metaObjectData = fileData.metaObjects[i];
      const id = metaObjectData.id;
      const dataObject = dataModel.objects[id];
      if (!dataObject) {
        const originalSystemId = metaObjectData.originalSystemId;
        const propertySetIds = metaObjectData.propertySets || metaObjectData.propertySetIds;
        const type = metaObjectData.type;
        const result2 = dataModel.createObject({
          id,
          originalSystemId,
          type,
          name: metaObjectData.name,
          propertySetIds
        });
        if (result2.ok===false) {
          return Promise.reject(`[MetaModelLoader.load]: Could not create DataObject -> ${result2.error}`);
        }
        if (metaObjectData.parent) {
          const result3 = dataModel.createRelationship({
            relatingObjectId: metaObjectData.parent,
            relatedObjectId: id,
            type: "IfcRelAggregates"
          });
          if (result3.ok===false) {
            return Promise.reject(`[MetaModelLoader.load]: Could not create Relationship -> ${result3.error}`);
          }
        }
      }
    }
  }
  return Promise.resolve();
}
