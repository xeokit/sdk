import {DataModel} from "../data";
import {setYieldIntervalOverride} from "../utils";
import type {ModelEncoder} from "./ModelEncoder";
import type {ModelExporterParams} from "./ModelExporterParams";
import type {ModelExportParams} from "./ModelExportParams";
import type {ModelExportOptions} from "./ModelExportOptions";

const MIN_YIELD_INTERVAL_MS = 16;

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
   *
   * @internal
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
   * @param options - Options for customizing the export process.
   * @param options.coordinateSystem - Optional target CoordinateSystem for export.
   * @returns {Promise} Resolves when the SceneModel and/or DataModel has been successfully written.
   *
   * @throws
   * - If the SceneModel has already been destroyed.
   * - If the DataModel has already been destroyed.
   */
  write(params: ModelExportParams, options: ModelExportOptions = {}): Promise<any> {

    return new Promise<any>((resolve, reject) => {
      if (!params) {
        return reject("Argument expected: params");
      }
      const {sceneModel, dataModel} = params;
      // At least one of {sceneModel, dataModel} must be present —
      // every exporter except the standalone DataModel one needs a
      // SceneModel, and the DataModel exporter only needs a
      // DataModel. Per-encoder validation handles the more specific
      // "this exporter requires X" checks.
      if (!sceneModel && !dataModel) {
        return reject("Argument expected: params.sceneModel or params.dataModel");
      }
      if (sceneModel && sceneModel.destroyed) {
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
      // Push the caller's `yieldIntervalMs` onto the
      // cooperative-yield throttle. See ModelLoader.load for
      // rationale. Restored in finally so a thrown encoder
      // can't leave the override leaking into the next export.
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
      encoder({sceneModel, dataModel}, options)
        .then((fileData: any) => {
          restoreYieldOverride();
          resolve(fileData);
        })
        .catch(err => {
          restoreYieldOverride();
          reject(`Cannot export target file -> ${err}`);
        });
    });
  }
}
