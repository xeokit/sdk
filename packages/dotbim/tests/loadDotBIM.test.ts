import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadDotBIM} from "../src";

const fs = require('fs');

describe('loadDotBIM', () => {

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

    const fileData = JSON.parse(fs.readFileSync("./tests/assets/SmallHouse.bim", 'utf8'));


    test("the DotBIM data loads into a SceneModel and DataModel without error", async () => {
        await loadDotBIM({fileData, sceneModel, dataModel});
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
        const sceneModelJSON = JSON.parse(fs.readFileSync("./tests/assets/SmallHouse_SceneModel.json", 'utf8'));
        expect(sceneModel.getJSON()).toEqual(sceneModelJSON);
    });

    test("the DataModel has the expected components", () => {
        const dataModelJSON = JSON.parse(fs.readFileSync("./tests/assets/SmallHouse_DataModel.json", 'utf8'));
        expect(dataModel.getJSON()).toEqual(dataModelJSON);
    });
});

