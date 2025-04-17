import {SceneModel} from "../scene";
import {DataModel} from "../data";
import {ModelChunksManifestParams} from "../core";
import {DataModelParamsLoader} from "../data/DataModelParamsLoader";
import {Loader} from "../io";

/**
 * Loads a SceneModel and/or DataModel from a set of chunk files.
 *
 * See {@link @xeokit/sdk/modelchunksloader | @xeokit/sdk/modelchunksloader} for usage.
 *
 * @param params
 */
export class ModelChunksLoader {

    #sceneModelLoader: Loader;
    #dataModelLoader: Loader;
    #cancelled: boolean;

    constructor(params: {
        sceneModelLoader: Loader,
        dataModelLoader: Loader
    }) {
        const {sceneModelLoader, dataModelLoader} = params;
        this.#sceneModelLoader = sceneModelLoader;
        this.#dataModelLoader = dataModelLoader || new DataModelParamsLoader();
        this.#cancelled = false;
    }

    cancel() {
        this.#cancelled = true;
    }

    get cancelled(): boolean {
        return this.#cancelled;
    }

    /**
     * Loads the geometry and data models listed in a ModelChunksManifestParams into a SceneModel and DataModel.
     *
     * Loading can be interrupted at any time by calling {@link modelchunksloader!ModelChunksLoader.cancel | ModelChunksLoader.cancel}.
     *
     * @param params
     * @returns {Promise} Resolves when all models have been loaded.
     */
    load(params: {
        modelChunksManifest: ModelChunksManifestParams,
        baseDir: string,
        sceneModel?: SceneModel,
        dataModel?: DataModel
    }): Promise<void> {

        this.#cancelled = false;

        return new Promise<void>((resolve, reject) => {

            if (!params) {
                return reject("Argument expected: params");
            }

            const {modelChunksManifest, baseDir, sceneModel, dataModel} = params;

            if (!modelChunksManifest) {
                return reject("Parameter expected: modelChunksManifest");
            }

            if (!baseDir) {
                return reject("Parameter expected: baseDir");
            }

            const sceneModelFiles = modelChunksManifest.sceneModelFiles;
            const dataModelFiles = modelChunksManifest.dataModelFiles;

            const loadSceneModelFiles = (done: () => void) => {
                let i = 0;
                const loadNextSceneModelFile = () => {
                    if (this.#cancelled || sceneModel.destroyed) {
                        done();
                    } else if (i >= sceneModelFiles.length) {
                        done();
                    } else {
                        fetch(`${baseDir}/${sceneModelFiles[i]}`).then(response => {
                            const fileDataType = this.#sceneModelLoader.fileDataType;
                            (fileDataType === "json"
                                ? response.json()
                                : (fileDataType === "arraybuffer"
                                    ? response.arrayBuffer()
                                    : response.arrayBuffer()))
                                .then(fileData => {
                                    this.#sceneModelLoader.load({
                                        fileData,
                                        sceneModel
                                    }).then(() => {
                                        i++;
                                        loadNextSceneModelFile();
                                    }).catch((error) => {
                                        reject(`Error loading SceneModel file: ${error}`);
                                    });
                                }).catch((error) => {
                                reject(`Error loading SceneModel file: ${error}`);
                            });
                        }).catch((error) => {
                            reject(`Error loading SceneModel file: ${error}`);
                        });
                    }
                }
                loadNextSceneModelFile();
            }

            const loadDataModelFiles = (done: () => void) => {
                let i = 0;
                const loadNextDataModelFile = () => {
                    if (this.#cancelled || dataModel.destroyed) {
                        done();
                    } else if (i >= dataModelFiles.length) {
                        done();
                    } else {
                        fetch(`${baseDir}/${dataModelFiles[i]}`).then(response => {
                            const fileDataType = this.#sceneModelLoader.fileDataType;
                            (fileDataType === "json"
                                ? response.json()
                                : (fileDataType === "arraybuffer"
                                    ? response.arrayBuffer()
                                    : response.arrayBuffer()))
                                .then(fileData => {
                                    this.#dataModelLoader.load({
                                        fileData,
                                        dataModel
                                    }).then(() => {
                                        i++;
                                        loadNextDataModelFile();
                                    });
                                }).catch((error) => {
                                reject(`Error loading DataModel file: ${error}`);
                            });
                        }).catch((error) => {
                            reject(`Error loading DataModel file: ${error}`);
                        });
                    }
                }
                loadNextDataModelFile();
            }

            if (sceneModelFiles && sceneModel &&
                dataModelFiles && dataModel) {
                loadSceneModelFiles(() => {
                    loadDataModelFiles(() => {
                        resolve();
                    });
                });
            } else if (sceneModelFiles && sceneModel) {
                loadSceneModelFiles(() => {
                    resolve();
                });
            } else if (dataModelFiles && dataModel) {
                loadDataModelFiles(() => {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
