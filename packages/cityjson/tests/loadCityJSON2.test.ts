import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadCityJSON} from "../src";

const fs = require('fs');

describe('loadCityJSON', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;

    dataModel = data.createModel({
        id: "theModel"
    });

    sceneModel = scene.createModel({
        id: "theModel"
    });

    const fileData = JSON.parse(fs.readFileSync("./tests/assets/LoD3_Railway.json", 'utf8'));


    test("the CityJSON data loads into a SceneModel and DataModel without error", async () => {
        await loadCityJSON({fileData, sceneModel, dataModel});
    });

    test("the SceneModel builds without error", async () => {
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);
    });

    test("the DataModel builds without error", () => {
        dataModel.build();
        expect(dataModel.built).toBe(true);
    });

    test("the SceneModel has the expected components", () => {
        const sceneModelJSON = JSON.parse(fs.readFileSync("./tests/assets/LoD3_Railway.SceneModel.json", 'utf8'));
        expect(sceneModel.getJSON()).toEqual(sceneModelJSON);
    });

    test("the DataModel has the expected components", () => {
        const dataModelJSON = JSON.parse(fs.readFileSync("./tests/assets/LoD3_Railway.DataModel.json", 'utf8'));
        expect(dataModel.getJSON()).toEqual(dataModelJSON);
    });
});

