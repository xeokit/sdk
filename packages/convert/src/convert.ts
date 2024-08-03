import {Scene} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {loadDTX, saveDTX} from "@xeokit/dtx";
import {loadDotBIM, saveDotBIM} from "@xeokit/dotbim";
import {loadXKT} from "@xeokit/xkt";
import {loadWebIFC} from "@xeokit/webifc";
import {loadGLTF} from "@xeokit/gltf";
import {saveArrayBuffer, saveJSON} from "@xeokit/utils";
import {loadCityJSON} from "@xeokit/cityjson";
import {loadLAS} from "@xeokit/las";

/**
 *
 */
export class Converter {

    #loaders: any;
    #savers: any;
    #scene: Scene;

    constructor() {

        this.#loaders = {
            "dtx": {load: loadDTX, mime: "arraybuffer"},
            "bim": {load: loadDotBIM, mime: "json"},
            "glb": {load: loadGLTF, mime: "arraybuffer"},
            "xkt": {load: loadXKT, mime: "arraybuffer"},
            "ifc": {load: loadWebIFC, mime: "arraybuffer"},
            "json": {load: loadCityJSON, mime: "json"},
            "las": {load: loadLAS, mime: "arraybuffer"},
            "laz": {load: loadLAS, mime: "arraybuffer"}
        };

        this.#savers = {
            "dtx": {save: saveDTX, mime: "arraybuffer"},
            "bim": {save: saveDotBIM, mime: "json"}
        };

        this.#scene = new Scene();
    }

    get inputFormats(): string[] {
        return Object.keys(this.#loaders);
    }

    get outputFormats(): string[] {
        return Object.keys(this.#savers);
    }

    convert(src: string, dest: string): Promise<any> {
        return new Promise<void>((resolve, reject) => {

            const srcExt = getFileExtension(src);
            const destExt = getFileExtension(dest);

            const loader = this.#loaders[srcExt];
            if (!loader) {
                reject(`[convert] Input file type not supported: ".${srcExt}"`);
                return;
            }

            const saver = this.#savers[srcExt];
            if (!saver) {
                reject(`[convert] Output file type not supported: ".${destExt}"`);
                return;
            }

            const sceneModel = this.#scene.createModel({
                id: "myModel"
            });

            if (sceneModel instanceof SDKError) {
                reject(`[convert] Error converting file: ${(sceneModel).message}`);
            } else {

                fetch(src)
                    .then(response => {
                        (loader.mime === "arraybuffer"
                            ? response.arrayBuffer()
                            : response.json())
                            .then(fileData => {

                                loader.load({
                                    fileData,
                                    sceneModel
                                }).then(() => {
                                    (sceneModel).build()
                                        .then(() => {
                                            const fileDataDest = saver.save({
                                                sceneModel
                                            });
                                            (saver.mime === "arraybuffer")
                                                ? saveArrayBuffer(fileDataDest, dest)
                                                : saveJSON(fileDataDest, dest);

                                            // TODO: errors from saving

                                            sceneModel.destroy();
                                            resolve();
                                        })
                                        .catch(sdkError => {
                                            sceneModel.destroy();
                                            reject(`[convert] Error converting file: ${sdkError.message}`);
                                        })
                                }).catch(sdkError => {
                                    sceneModel.destroy();
                                    reject(`[convert] Error parsing input file: ${sdkError.message}`);
                                });
                            }).catch(message => {
                            sceneModel.destroy();
                            reject(`[convert] Error fetching input file: ${message}`);
                        });
                    }).catch(message => {
                    sceneModel.destroy();
                    reject(`[convert] Error fetching input file: ${message}`);
                });
            }
        });
    }
}

function getFileExtension(fileName) {
    const parts = fileName.split('.');
    if (parts.length === 1) return '';
    return parts.pop();
}
