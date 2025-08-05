import {DataModel} from "../data";
import type {ModelEncoder} from "./ModelEncoder";
import type {ModelExporterParams} from "./ModelExporterParams";
import type {ModelExportParams} from "./ModelExportParams";

/**
 * Exports a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel} to a file.
 */
export class ModelExporter {

  /**
   * The exported model file format.
   */
  format: string;

  /**
   * An encoder for each supported schema version.
   */
  encoders: {
    [key: string]: ModelEncoder
  };

  /**
   * List of supported schema versions.
   */
  versions: string[];

  /**
   * The default supported schema version.
   */
  defaultVersion: string;

  /**
   * Data type of the file written by this Exporter.
   */
  fileDataType: string;

  /**
   * @param params
   */
  constructor(params: ModelExporterParams) {
    this.format = params.format;
    this.encoders = params.encoders || {};
    this.versions = Object.keys(this.encoders);
    this.fileDataType = params.fileDataType;
    this.defaultVersion = params.defaultVersion;
  }

  /**
   * Exports a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel} to file data.
    *
   * @param params - The parameters used for writing the file data.
   * @param params.sceneModel - The {@link scene!SceneModel | SceneModel} to write.
   * @param params.dataModel - The {@link data!DataModel | DataModel} to write.
   * @param options - Options for customizing the loading process. These are specific to the Exporter subclass.
   * @returns {Promise} Resolves when the SceneModel and/or DataModel has been successfully written.
   *
   * @throws {@link core!SDKError | SDKError}
   * - If the SceneModel has already been destroyed.
   * - If the DataModel has already been destroyed.
   */
  write(params: ModelExportParams, options: any = {}): Promise<any> {

    return new Promise<any>((resolve, reject) => {
      if (!params) {
        return reject("Argument expected: params");
      }
      const {sceneModel, dataModel} = params;
      if (!sceneModel) {
        return reject("Argument expected: params.sceneModel");
      }
      if (sceneModel.destroyed) {
        return reject("SceneModel already destroyed");
      }
      if (dataModel) {
        if (!(dataModel instanceof DataModel)) {
          return reject("Argument type mismatch: params.dataModel should be a DataModel");
        }
        if (dataModel.destroyed) {
          return reject("DataModel already destroyed");
        }
      }
      const version = params.version || this.defaultVersion;
      const encoder = this.encoders[version];
      if (!encoder) {
        return reject(`Unsupported target file schema version: ${version} - supported versions are [${this.versions}]`);
      }
      encoder({sceneModel, dataModel}, options)
        .then((fileData: any) => {
          resolve(fileData);
        })
        .catch(err => {
          reject(`Failed to export target file: ${err}`);
        });
    });
  }
}

