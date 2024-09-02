import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {loadGLTF} from "./loadGLTF";
import {loadMetamodel} from "@xeokit/metamodel";

/**
 *
 */
export interface GLTFManifest {
    gltfOutFiles: string[],
    metadataOutFiles?: string []
}

/**
 *
 * @param params
 */
export function loadGLTFManifest(params: {
    src?: string,
    manifest?: GLTFManifest,
    sceneModel: SceneModel,
    dataModel: DataModel
}) {
    return new Promise<void>((resolve, reject) => {

        if (!params) {
            return reject("Argument expected: params");
        }

        const sceneModel = params.sceneModel;
        if (!sceneModel) {
            return reject("Parameter expected: sceneModel");
        }

        const dataModel = params.dataModel;
        if (!params.manifest && !params.src) {
            return reject("Parameter expected: manifest or src");
        }

        if (params.src) {
            const baseDir = getBaseDirectory(params.src);

            fetch(params.src).then(response => {
                response.json().then(manifest => {

                    const gltfOutFiles = manifest.gltfOutFiles;
                    const metadataOutFiles = manifest.metadataOutFiles;

                    const loadGLTFFiles = (done: () => void) => {
                        let i = 0;
                        const loadNextGLTF = () => {
                            if (sceneModel.destroyed) {
                                done();
                            } else if (i >= gltfOutFiles.length) {
                                done();
                            } else {
                                fetch(`${baseDir}${gltfOutFiles[i].split('/').pop()}`).then(response => {
                                    response.arrayBuffer().then(fileData => {
                                        loadGLTF({
                                            fileData,
                                            sceneModel
                                        }).then(() => {
                                            i++;
                                            loadNextGLTF();
                                        }).catch((error) => {
                                            reject(`Error loading glTF file: ${error}`);
                                        })
                                    });
                                });
                            }
                        }
                        loadNextGLTF();
                    }

                    const loadMetaModelFiles = (done: () => void) => {
                        let i = 0;
                        const loadNextMetaModelFile = () => {
                            if (dataModel.destroyed) {
                                done();
                            } else if (i >= metadataOutFiles.length) {
                                done();
                            } else {
                                fetch(`${baseDir}${metadataOutFiles[i].split('/').pop()}`).then(response => {
                                    response.json().then(fileData => {
                                        loadMetamodel({
                                            fileData,
                                            dataModel
                                        }).then(() => {
                                            i++;
                                            loadNextMetaModelFile();
                                        }).catch((error) => {
                                            reject(`Error loading metadata file: ${error}`);
                                        })
                                    });
                                });
                            }
                        }
                        loadNextMetaModelFile();
                    }

                    if (gltfOutFiles && metadataOutFiles) {
                        loadGLTFFiles(() => {
                            loadMetaModelFiles(() => {
                                resolve();
                            });
                        });
                    } else if (gltfOutFiles) {
                        loadGLTFFiles(() => {
                            resolve();
                        });
                    } else if (metadataOutFiles) {
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
