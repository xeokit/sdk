import type {DataModel} from "../data";
import {DataModelParamsLoader} from "../data";
import {MetaModelLoader} from "../metamodel";
import type {SceneModel} from "../scene";
import {XKTLoader} from "./XKTLoader";

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

    const metaModelReader = new MetaModelLoader();

    if (params.src) {

      const xktReader = new XKTLoader();

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
                    xktReader.load({
                      fileData,
                      sceneModel
                    }).then(() => {
                      i++;
                      loadNextXKT();
                    }).catch((error) => {
                      reject(`Error loading XKT file: ${error}`);
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
                    metaModelReader.load({
                      fileData,
                      dataModel
                    }).then(() => {
                      i++;
                      loadNextMetaModelFile();
                    }).catch((error) => {
                      reject(`Error loading XKT metadata file: ${error}`);
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
