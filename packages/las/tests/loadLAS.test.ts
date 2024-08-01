import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadLAS} from "../src";

const fs = require('fs');


describe('loadLAS Test', () => {

    const data = new Data();
    const scene = new Scene();
    let dataModel;
    let sceneModel;
    let geometry;

    it('loadLAS Test', () => {

        dataModel = data.createModel({
            id: "theModel"
        });

        sceneModel = scene.createModel({
            id: "theModel"
        });

        fs.readFile("./tests/assets/indoorScan.laz", (err, fileData) => {

            expect(sceneModel.built).toBe(false);

            //   console.log(arraybuffer)

            loadLAS({
                fileData,
                sceneModel,
                dataModel,
                fp64: false,
                colorDepth: "auto",
                skip: 1,
                log: (msg) => {
                    console.log(msg);
                }
            }).then(() => {

                sceneModel.build().then(() => {

                    expect(sceneModel.built).toBe(true);

                    expect(sceneModel.geometries["geometry-0"].positionsCompressed.length).toEqual(1212063);

                    // expect(Object.keys(sceneModel.meshes)).toEqual(testData.meshIds)
                    // expect(Object.keys(sceneModel.geometries)).toEqual(testData.geometryIds)
                    // expect(Object.keys(sceneModel.textures)).toEqual(testData.textureIds)
                    // expect(Object.keys(sceneModel.objects)).toEqual(testData.objectIds)

                });

            }).catch((reason) => {
                throw new Error(`loadLAS failed: ${reason}`);
            });
        });
    });
});


