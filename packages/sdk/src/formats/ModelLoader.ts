
import {isJSONObject, setYieldIntervalOverride} from "../base/utils";
import {type ModelLoadParams} from "./ModelLoadParams";
import {type ModelLoaderParams} from "./ModelLoaderParams";
import {type ModelParser} from "./ModelParser";

import {createFileIO} from '../base/io/FileIOFactory';
import {type ModelLoadOptions} from "./ModelLoadOptions";

const MIN_YIELD_INTERVAL_MS = 16;

// Lazily created so merely importing this module doesn't construct a
// FileIO — `createFileIO()` throws in Node, and the module graph is
// pulled into Node-side tooling (e.g. the xeoconvert CLI bundle) that
// never reaches the filePath branch.
let _fileIO: ReturnType<typeof createFileIO> | null = null;
function getFileIO(): ReturnType<typeof createFileIO> {
  return _fileIO ?? (_fileIO = createFileIO());
}


/**
 * Loads a model file into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
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
   * Loads file data into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
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
      const className = this.constructor.name;
      if (!params) {
        return reject(`[${className}.load] Argument expected: params`);
      }
      const {filePath, fileData, sceneModel, dataModel} = params;
      if (!sceneModel && !dataModel) {
        return reject(`[${className}.load] Argument expected: sceneModel or dataModel`);
      }
      if (sceneModel) {
        if (sceneModel.destroyed) {
          return reject(`[${className}.load] SceneModel already destroyed`);
        }
      }
      if (dataModel) {
        if (dataModel.destroyed) {
          return reject(`[${className}.load] DataModel already destroyed`);
        }
      }
      if (!filePath && !fileData) {
        return reject(`[${className}.load] Argument expected: filePath or fileData`);
      }
      const loadFileData = (fileData) => {
        if (this.fileDataType === "json" && !isJSONObject(fileData)) {
          return reject(`[${className}.load] Argument type mismatch: params.fileData should be a JSON object`);
        }
        if (this.fileDataType === "arraybuffer" && !(fileData instanceof ArrayBuffer)) {
            return reject("Argument type mismatch: params.fileData should be an ArrayBuffer");
        }
        const version = this.getVersion(fileData);
        if (!version) {
          return reject(`[${className}.load] Cannot determine schema version of source file`);
        }
        const parser = this.parsers[version];
        if (!parser) {
          return reject(`[${className}.load] Unsupported source file schema version: ${version} - supported versions are [${this.versions}]`);
        }
        if (sceneModel || dataModel) {
          // Push the caller's `yieldIntervalMs` (clamped to the
          // 16ms minimum) onto the cooperative-yield throttle so
          // every `yieldToHost` deeper in the parser picks it up
          // without each call site having to thread the value
          // through. Restored in finally so a thrown parser
          // can't leave the override leaking into the next load.
          let prevYieldOverride: number | undefined;
          let pushedYieldOverride = false;
          if (options.yieldIntervalMs !== undefined) {
            const clamped = Math.max(MIN_YIELD_INTERVAL_MS, options.yieldIntervalMs);
            prevYieldOverride = setYieldIntervalOverride(clamped);
            pushedYieldOverride = true;
          }
          const restoreYieldOverride = (): void => {
            if (pushedYieldOverride) {
              setYieldIntervalOverride(prevYieldOverride);
              pushedYieldOverride = false;
            }
          };
          parser({fileData, sceneModel, dataModel}, options)
            .then(() => {
              restoreYieldOverride();
              resolve();
            })
            .catch(err => {
              restoreYieldOverride();
              reject(err); // We expect the parser to prefix its errors
            });
        } else {
          return resolve();
        }
      }
      if (filePath) {
        getFileIO().load(filePath).then((fileData) => {
          loadFileData(fileData);
        }).catch(err => {
          reject(`[${className}.load] Cannot load glTF -> ${err}`);
        });
      } else {
        loadFileData(fileData);
      }
    });
  }
}
