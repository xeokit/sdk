import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadDotBIM} from "../src";

const fs = require('fs');

describe('loadDotBIM Test', () => {

    const data = new Data();
    const scene = new Scene();
    let dataModel;
    let sceneModel;

    it('loadDotBIM Test', () => {

        dataModel = data.createModel({
            id: "theModel"
        });

        sceneModel = scene.createModel({
            id: "theModel"
        });

        fs.readFile("./tests/assets/SmallHouse.bim", 'utf8', (err, dat) => {

            if (err) {
                console.error(err);
                return;
            }

            const fileData = JSON.parse(dat);

            expect(sceneModel.built).toBe(false);

            const meshGeometryArrays = {}

            loadDotBIM({
                fileData,
                sceneModel,
                dataModel
            }, {
            }).then(() => {

                sceneModel.build().then(() => {

                    expect(sceneModel.built).toBe(true);

                    dataModel.build();

                    expect(dataModel.built).toBe(true);

                    // TODO: Test content is loaded, like we do with CityJSON
                });
            });
        });
    });
});