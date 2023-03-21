import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadWebIFC} from "../src";
import * as WebIFC from "web-ifc/web-ifc-api-node";

const fs = require('fs');

describe('loadWebIFC Test', () => {

    const data = new Data();
    const scene = new Scene();
    let dataModel;
    let sceneModel;
    let geometry;

    it('loadWebIFC Test', () => {

        dataModel = data.createModel({
            id: "theModel"
        });

        sceneModel = scene.createModel({
            id: "theModel"
        });

        fs.readFile("./tests/assets/IfcOpenHouse4.ifc", (err, fileData) => {

            if (err) {
               // console.error(err);
                return;
            }

            expect(sceneModel.built).toBe(false);

            const ifcAPI = new WebIFC.IfcAPI();

            //   ifcAPI.SetWasmPath(cfg.wasmPath);

            ifcAPI.Init().then(() => {

                expect(sceneModel.built).toBe(false);

                loadWebIFC({
                    data: toArrayBuffer(fileData),
                    ifcAPI,
                    sceneModel,
                    dataModel
                }).then(() => {

                    expect(sceneModel.built).toBe(false);

                    // sceneModel.build().then(() => {
                    //
                    //     expect(sceneModel.built).toBe(true);
                    //
                    //     dataModel.build();
                    //
                    //     //    console.log(dataModel.getJSON());
                    //
                    //     expect(dataModel.built).toBe(true);
                    //
                    //     // expect(dataModel.objects['UUID_bd865e62-18de-40ff-85da-883709a86f0f']).toBeDefined();
                    //     // expect(dataModel.objects['UUID_106e0075-dbba-40aa-b262-7c53471ebc9c']).toBeDefined();
                    //
                    //
                    // });

                }).catch((e) => {

                })
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
