import { loadXKT } from "./loadXKT";
import { loadMetaModel } from "../metamodel";
/**
 *
 * @param params
 */
export function loadXKTManifest(params) {
    return new Promise((resolve, reject) => {
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
                    const xktFiles = manifest.xktFiles;
                    const metaModelFiles = manifest.metaModelFiles;
                    const loadXKTFiles = (done) => {
                        let i = 0;
                        const loadNextXKT = () => {
                            if (sceneModel.destroyed) {
                                done();
                            }
                            else if (i >= xktFiles.length) {
                                done();
                            }
                            else {
                                fetch(`${baseDir}${xktFiles[i]}`).then(response => {
                                    response.arrayBuffer().then(fileData => {
                                        loadXKT({
                                            fileData,
                                            sceneModel
                                        }).then(() => {
                                            i++;
                                            loadNextXKT();
                                        }).catch((error) => {
                                            reject(`Error loading XKT file: ${error}`);
                                        });
                                    });
                                });
                            }
                        };
                        loadNextXKT();
                    };
                    const loadMetaModelFiles = (done) => {
                        let i = 0;
                        const loadNextMetaModelFile = () => {
                            if (dataModel.destroyed) {
                                done();
                            }
                            else if (i >= metaModelFiles.length) {
                                done();
                            }
                            else {
                                fetch(`${baseDir}${metaModelFiles[i]}`).then(response => {
                                    response.json().then(fileData => {
                                        loadMetaModel({
                                            fileData,
                                            dataModel
                                        }).then(() => {
                                            i++;
                                            loadNextMetaModelFile();
                                        }).catch((error) => {
                                            reject(`Error loading XKT metadata file: ${error}`);
                                        });
                                    });
                                });
                            }
                        };
                        loadNextMetaModelFile();
                    };
                    if (xktFiles && metaModelFiles) {
                        loadXKTFiles(() => {
                            loadMetaModelFiles(() => {
                                resolve();
                            });
                        });
                    }
                    else if (xktFiles) {
                        loadXKTFiles(() => {
                            resolve();
                        });
                    }
                    else if (metaModelFiles) {
                        loadMetaModelFiles(() => {
                            resolve();
                        });
                    }
                    else {
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
//# sourceMappingURL=loadXKTManifest.js.map