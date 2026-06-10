import type {ModelLoadParams} from "../../ModelLoadParams";
import {ModelLoader} from "../../ModelLoader";
import {DataModel} from "../../../model/data";
import {yieldToHost} from "../../../base/utils";
import type {LoaderProgress} from "../../LoaderProgress";

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

async function parseMetaModel(params: ModelLoadParams, options: any = {}): Promise<void> {
  const {fileData, dataModel} = params;
  const onProgress: ((p: LoaderProgress) => void) | undefined = options.onProgress;
  const signal: AbortSignal | undefined = options.signal;
  const progress: LoaderProgress = {phase: "", current: 0, total: 0};
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    if (onProgress) {
      progress.phase = phase;
      progress.current = current;
      progress.total = total;
      onProgress(progress);
    }
    await yieldToHost(signal);
  };

  // TODO: Property set decompression

  if (fileData.propertySets) {
    for (let i = 0, len = fileData.propertySets.length; i < len; i++) {
      if ((i & 0x3F) === 0) await step("Parsing property sets", i, len);
      const propertySetData = fileData.propertySets[i];
      if (!propertySetData.properties) { // HACK: https://github.com/Creoox/creoox-ifc2gltfcxconverter/issues/8
        propertySetData.properties = [];
      }
      const propertySet = dataModel.propertySets[propertySetData.id];
      if (!propertySet) {

        const properties = [];
        for (let j = 0, len2 = propertySetData.properties.length; j < len2; j++) {
          const propertyItem = propertySetData.properties[j];
          let propertyData: any = propertyItem;
          if (propertyItem.id === undefined) {
            const propertyId = propertyItem;
            propertyData = fileData.properties ? fileData.properties[propertyId] : undefined;
          }
          if (propertyData) {
            if (propertyItem.value === undefined) {
              propertyData.value = null;
            }
            properties.push(propertyData);
          }
        }

        const result = dataModel.createPropertySet({
          id: propertySetData.id,
          type: propertySetData.type,
          name: propertySetData.name,
          properties
        });
        if (result.ok ===false) {
          throw new Error(`[MetaModelLoader.load]: Could not create PropertySet -> ${result.error}`);
        }
      }
    }
  }
  if (fileData.metaObjects) {
    for (let i = 0, len = fileData.metaObjects.length; i < len; i++) {
      if ((i & 0x3F) === 0) await step("Parsing meta objects", i, len);
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
          throw new Error(`[MetaModelLoader.load]: Could not create DataObject -> ${result2.error}`);
        }
      }
    }

    for (let i = 0, len = fileData.metaObjects.length; i < len; i++) {
      if ((i & 0x3F) === 0) await step("Building relationships", i, len);
      const metaObjectData = fileData.metaObjects[i];
      const id = metaObjectData.id;
      const dataObject = dataModel.objects[id];
      if (dataObject) {
        if (metaObjectData.parent) {
          const result3 = dataModel.createRelationship({
            relatingObjectId: metaObjectData.parent,
            relatedObjectId: id,
            type: "IfcRelAggregates"
          });
          if (result3.ok===false) {
            throw new Error(`[MetaModelLoader.load]: Could not create Relationship -> ${result3.error}`);
          }
        }
      }
    }
    await step("Building relationships", fileData.metaObjects.length, fileData.metaObjects.length);
  }
}
