import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {SDKError} from "@xeokit/core";
import {loadXKT} from "./loadXKT";
import {loadMetamodel} from "@xeokit/metamodel";

/**
 *
 */
export interface XKTManifest {
    xktFiles: string[],
    metaModelFiles?: string []
}

/**
 *
 * @param params
 */
export function loadXKTManifest(params: {
    src?: string,
    manifest?: XKTManifest,
    sceneModel: SceneModel,
    dataModel: DataModel
}) {
    return new Promise<void>((resolve, reject) => {

        if (!params) {
            return reject(new SDKError("[loadXKTChunks] Argument expected: params"));
        }

        const sceneModel = params.sceneModel;
        if (!sceneModel) {
            return reject(new SDKError("[loadXKTChunks] Parameter expected: sceneModel"));
        }

        const dataModel = params.dataModel;
        if (!params.manifest && !params.src) {
            return reject(new SDKError("[loadXKTChunks] Parameter expected: manifest or src"));
        }

        if (params.src) {
            const baseDir = getBaseDirectory(params.src);

            fetch(params.src).then(response => {
                response.json().then(manifest => {

                    const xktFiles = manifest.xktFiles;
                    const metaModelFiles = manifest.metaModelFiles;

                    const loadXKTFiles = (done: () => void) => {
                        let i = 0;
                        const loadNextXKT = () => {
                            if (sceneModel.destroyed) {
                                done();
                            } else if (i >= xktFiles.length) {
                                done();
                            } else {
                                fetch(`${baseDir}${xktFiles[i]}`).then(response => {
                                    response.arrayBuffer().then(fileData => {
                                        loadXKT({
                                            fileData,
                                            sceneModel
                                        }).then(() => {
                                            i++;
                                            loadNextXKT();
                                        }).catch((error) => {
                                            reject(`[loadXKTChunks] Error loading XKT file: ${error}`);
                                        })
                                    });
                                });
                            }
                        }
                        loadNextXKT();
                    }

                    const loadMetaModelFiles = (done: () => void) => {
                        let i = 0;
                        const loadNextMetaModelFile = () => {
                            if (dataModel.destroyed) {
                                done();
                            } else if (i >= metaModelFiles.length) {
                                done();
                            } else {
                                fetch(`${baseDir}${metaModelFiles[i]}`).then(response => {
                                    response.json().then(fileData => {
                                        loadMetamodel({
                                            fileData,
                                            dataModel
                                        }).then(() => {
                                            i++;
                                            loadNextMetaModelFile();
                                        }).catch((error) => {
                                            reject(`[loadXKTChunks] Error loading XKT metadata file: ${error}`);
                                        })
                                    });
                                });
                            }
                        }
                        loadNextMetaModelFile();
                    }

                    if (xktFiles && metaModelFiles) {
                        loadXKTFiles(() => {
                            loadMetaModelFiles(() => {
                                resolve();
                            });
                        });
                    } else if (xktFiles) {
                        loadXKTFiles(() => {
                            resolve();
                        });
                    } else if (metaModelFiles) {
                        loadMetaModelFiles(() => {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        }
    });
}


function getBaseDirectory(filePath) {
    const pathArray = filePath.split('/');
    pathArray.pop(); // Remove the file name or the last segment of the path
    return pathArray.join('/') + '/';
}
