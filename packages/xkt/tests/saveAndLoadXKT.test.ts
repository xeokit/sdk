import {Scene} from "@xeokit/scene";
import * as testUtils from "./testUtils";
import {Data} from "@xeokit/data";
import {loadXKT, saveXKT} from "../src";
import {SDKError} from "@xeokit/core";
import {roundSceneModelParams} from "@xeokit/testutils";

describe('saveAndLoadXKT', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;

    test("the SceneModel builds without error", async () => {
        sceneModel = scene.createModel(testUtils.sampleSceneModelJSON);
        expect(scene.models["myModel"]).toBeDefined();
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);
    });

    test("the DataModel builds without error", () => {
        dataModel = data.createModel(testUtils.sampleDataModelJSON);
        expect(data.models["myModel"]).toBeDefined();
        dataModel.build();
        expect(dataModel.built).toBe(true);
    });

    let fileData;
    let sceneModelJSON;
    let dataModelJSON;

    test("saveXKT saves the DataModel and SceneModel to an XKT arraybuffer", () => {
        fileData = saveXKT({sceneModel, dataModel});

        sceneModelJSON = roundSceneModelParams(sceneModel.getJSON());
        sceneModel.destroy();

        dataModelJSON = dataModel.getJSON();
        dataModel.destroy();
    });


    let sceneModel2;
    let dataModel2;

    test("loadXKT loads the arrayBuffer into a second DataModel and SceneModel", async () => {

        sceneModel2 = scene.createModel({id: "myModel"});
        if (sceneModel2 instanceof SDKError) {
            throw sceneModel2;
        }

        dataModel2 = data.createModel({id: "myModel"});
        if (dataModel2 instanceof SDKError) {
            throw sceneModel2;
        }

        await loadXKT({fileData, sceneModel: sceneModel2, dataModel: dataModel2});

        await sceneModel2.build();

        dataModel2.build();
    });

    test("the second SceneModel has the same components as the first SceneModel", () => {
        const sceneModel2JSON = roundSceneModelParams(sceneModel2.getJSON());
        expect(sceneModelJSON).toEqual(sceneModel2JSON);
    });

    test("the second DataModel has the same components as the first DataModel", () => {
        const dataModel2JSON = dataModel2.getJSON();
        expect(dataModelJSON).toEqual(dataModel2JSON);
    });
});