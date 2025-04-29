import {DataModel} from "../data/DataModel";
import {SceneModel} from "../scene/SceneModel";
import {isJSONObject} from "../utils";
import {ModelLoadParams} from "./ModelLoadParams";
import {ModelLoaderParams} from "./ModelLoaderParams";
import {ModelParser} from "./ModelParser";

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
     * This method expects the following conditions:
     * - The {@link scene!SceneModel.built | SceneModel.built} and {@link scene!SceneModel.destroyed | SceneModel.destroyed} properties must be `false`.
     * - It does not invoke the {@link scene!SceneModel.build | SceneModel.build} and {@link data!DataModel.build | DataModel.build} methods; those are to be managed by the caller.
     *
     * @param params - The parameters used for loading the file data.
     * @param options - Options for customizing the loading process. These are specific to the Loader subclass.
     * @returns {Promise} Resolves when the file data has been successfully loaded into the SceneModel and/or DataModel.
     *
     * @throws {@link core!SDKError | SDKError}
     * - If the SceneModel has already been destroyed.
     * - If the SceneModel has already been built.
     * - If the DataModel has already been destroyed.
     * - If the DataModel has already been built.
     */
    load(params: ModelLoadParams, options: any = {}): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            if (!params) {
                return reject("Argument expected: params");
            }
            const {fileData, sceneModel, dataModel} = params;
            if (!fileData) {
                return reject("Argument expected: fileData");
            }
            if (this.fileDataType === "json" && !isJSONObject(fileData)) {
                return reject("Argument type mismatch: params.fileData should be a JSON object");
            }
            // if (parser.fileDataType === "arraybuffer" && !isArraybuffer(fileData)) {
            //     return reject("Argument type mismatch: params.fileData should be an ArrayBuffer");
            // }
            if (sceneModel) {
                if (!(sceneModel instanceof SceneModel)) {
                    return reject("Argument type mismatch: params.sceneModel should be a SceneModel");
                }
                if (sceneModel.destroyed) {
                    return reject("SceneModel already destroyed");
                }
                if (sceneModel.built) {
                    return reject("SceneModel already built");
                }
            }
            if (dataModel) {
                if (!(dataModel instanceof DataModel)) {
                    return reject("Argument type mismatch: params.dataModel should be a DataModel");
                }
                if (dataModel.destroyed) {
                    return reject("DataModel already destroyed");
                }
                if (dataModel.built) {
                    return reject("DataModel already built");
                }
            }
            const version = this.getVersion(fileData);
            if (!version) {
                return reject(`Failed to determine schema version of source file`);
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
                        reject(`Failed to load source file: ${err}`);
                    });
            } else {
                return resolve();
            }
        });
    }
}
