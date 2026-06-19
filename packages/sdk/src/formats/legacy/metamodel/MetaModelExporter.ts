import {ModelExporter} from "../../ModelExporter";
import type {ModelEncodeParams} from "../../ModelEncodeParams";
import {yieldToHost} from "../../../base/utils";
import {convertDataModel} from "./convertDataModel";

/**
 * Writes a {@link model!data.DataModel | DataModel} to legacy
 * {@link MetaModelParams | MetaModelParams} as JSON.
 *
 * The inverse of {@link MetaModelLoader}. See {@link "metamodel" | @xeokit/sdk/metamodel}.
 */
export class MetaModelExporter extends ModelExporter {

  /**
   * Constructs a MetaModelExporter.
   */
  constructor() {
    super({
      format: "MetaModelParams",
      fileDataType: "json",
      encoders: {
        "1.0": encodeMetaModel,
      },
      defaultVersion: "1.0",
    });
  }
}

async function encodeMetaModel(params: ModelEncodeParams, options: any = {}): Promise<any> {
  await yieldToHost(options.signal);
  if (!params.dataModel) {
    return {
      projectId: "", author: "", createdAt: "", schema: "", creatingApplication: "",
      metaObjects: [], propertySets: [],
    };
  }
  const result = params.dataModel.toParams();
  if (result.ok === false) {
    throw new Error(`[MetaModelExporter] Could not read DataModel -> ${result.error}`);
  }
  return convertDataModel(result.value!);
}
