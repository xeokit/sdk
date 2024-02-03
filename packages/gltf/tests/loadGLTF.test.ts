import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadGLTF} from "../src";

import * as testData from "./assets/HousePlan.glb.testData";

const fs = require('fs');

describe('loadGLTF Test', () => {

    const data = new Data();
    const scene = new Scene();
    let dataModel;
    let sceneModel;
    let geometry;

    it('loadGLTF Test', () => {

        dataModel = data.createModel({
            id: "theModel"
        });

        sceneModel = scene.createModel({
            id: "theModel"
        });

        fs.readFile("./tests/assets/HousePlan.glb",  (err, buffer) => {

            const fileData = toArrayBuffer(buffer);

            expect(sceneModel.built).toBe(false);

         //   console.log(arraybuffer)

            loadGLTF({
                fileData,
                sceneModel,
                dataModel
            }).then(() => {

                sceneModel.build().then(() => {

                    expect(sceneModel.built).toBe(true);

                    expect(Object.keys(sceneModel.meshes)).toEqual(testData.meshIds)

                    expect(Object.keys(sceneModel.geometries)).toEqual(testData.geometryIds)

                    expect(Object.keys(sceneModel.textures)).toEqual(testData.textureIds)

                    expect(Object.keys(sceneModel.objects)).toEqual(testData.objectIds)

                });

            }).catch((reason) => {
                throw new Error(`loadGLTF failed: ${reason}`);
            });
        });
    });
});

export function toArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}