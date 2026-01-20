
import {isJSONObject} from "../utils";
import {type ModelLoadParams} from "./ModelLoadParams";
import {type ModelLoaderParams} from "./ModelLoaderParams";
import {type ModelParser} from "./ModelParser";

import {createFileIO} from '../io/FileIOFactory';
import {type ModelLoadOptions} from "./ModelLoadOptions";

const fileIO = createFileIO();

/**
 * Loads a model file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 */
export class ModelLoader {

  /**
   * The loaded model file format.
   */
  format: string;

  /**
   * Filename extensions expected on loaded model files.
   */
  fileNameExtensions: string[];

  /**
   * A parser for each supported schema version.
   * @internal
   */
  parsers: {
    [key: string]: ModelParser
  };

  /**
   * IDs of supported file schema versions.
   */
  versions: string[];

  /**
   * Identifies the MIME type of files loaded by this parser.
   */
  fileDataType: string;

  /**
   * Gets the schema version of the given file data.
   */
  getVersion: (fileData: any) => string;

  /**
   * @protected
   * @param params
   */
  constructor(params: ModelLoaderParams) {
    this.format = params.format;
    this.parsers = params.parsers || {};
    this.versions = Object.keys(this.parsers);
    this.fileDataType = params.fileDataType;
    this.getVersion = params.getVersion;
  }

  /**
   * Loads file data into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
   *
   * @param params - The parameters used for loading the file data.
   * @param options - Options for customizing the loading process. These are specific to the Loader subclass.
   * @returns {Promise} Resolves when the file data has been successfully loaded into the SceneModel and/or DataModel.
   *
   * @throws
   * - If the SceneModel has already been destroyed.
   * - If the DataModel has already been destroyed.
   */
  load(params: ModelLoadParams, options: ModelLoadOptions = {}): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      if (!params) {
        return reject("Argument expected: params");
      }
      const {filePath, fileData, sceneModel, dataModel} = params;
      if (sceneModel) {
        // if (!(sceneModel instanceof SceneModel)) {
        //   return reject("Argument type mismatch: params.sceneModel should be a SceneModel");
        // }
        if (sceneModel.destroyed) {
          return reject("SceneModel already destroyed");
        }
      }
      if (dataModel) {
        // if (!(dataModel instanceof DataModel)) {
        //   return reject("Argument type mismatch: params.dataModel should be a DataModel");
        // }
        if (dataModel.destroyed) {
          return reject("DataModel already destroyed");
        }
      }
      if (!filePath && !fileData) {
        return reject("Argument expected: filePath or fileData");
      }
      const loadFileData = (fileData) => {
        if (this.fileDataType === "json" && !isJSONObject(fileData)) {
          return reject("Argument type mismatch: params.fileData should be a JSON object");
        }
        // if (parser.fileDataType === "arraybuffer" && !isArraybuffer(fileData)) {
        //     return reject("Argument type mismatch: params.fileData should be an ArrayBuffer");
        // }
        const version = this.getVersion(fileData);
        if (!version) {
          return reject(`Cannot determine schema version of source file`);
        }
        const parser = this.parsers[version];
        if (!parser) {
          return reject(`Unsupported source file schema version: ${version} - supported versions are [${this.versions}]`);
        }
        if (sceneModel || dataModel) {
          parser({fileData, sceneModel, dataModel}, options)
            .then(() => {
              resolve();
            })
            .catch(err => {
              reject(`Cannot load source file: ${err}`);
            });
        } else {
          return resolve();
        }
      }
      if (filePath) {
        fileIO.load(filePath).then((fileData) => {
          loadFileData(fileData);
        }).catch(err => {
          reject(`Cannot load source file: ${err}`);
        });
      } else {
        loadFileData(fileData);
      }
    });
  }
}
