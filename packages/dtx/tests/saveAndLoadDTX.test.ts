import {Scene} from "@xeokit/scene";
import * as testUtils from "./testUtils";
import {Data} from "@xeokit/data";
import {loadDTX, saveDTX} from "../src";
import {SDKError} from "@xeokit/core";
import {roundSceneModelParams} from "@xeokit/testutils";

describe('saveAndLoadDTX', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;

    test("Create SceneModel from SceneModelParams", async () => {
        sceneModel = scene.createModel(testUtils.sampleSceneModelJSON);
        expect(scene.models["myModel"]).toBeDefined();
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);
    });

    test("Create DataModel from DataModelParams", () => {
        dataModel = data.createModel(testUtils.sampleDataModelJSON);
        expect(data.models["myModel"]).toBeDefined();
        dataModel.build();
        expect(dataModel.built).toBe(true);
    });

    let fileData;
    let sceneModelJSON;
    let dataModelJSON;

    test("Save DataModel and SceneModel to DTX with saveDTX", () => {
        fileData = saveDTX({sceneModel});

        sceneModelJSON = roundSceneModelParams(sceneModel.getJSON());
        sceneModel.destroy();

        dataModelJSON = dataModel.getJSON();
        dataModel.destroy();
    });


    let sceneModel2;
    let dataModel2;

    test("Load DTX into second DataModel and SceneModel with loadDTX", async () => {

        sceneModel2 = scene.createModel({id: "myModel"});
        if (sceneModel2 instanceof SDKError) {
            throw sceneModel2;
        }

        dataModel2 = data.createModel({id: "myModel"});
        if (dataModel2 instanceof SDKError) {
            throw sceneModel2;
        }

        await loadDTX({fileData, sceneModel: sceneModel2, dataModel: dataModel2});

        await sceneModel2.build();

        dataModel2.build();
    });

    test("Second SceneModel matches first SceneModel", () => {
        const sceneModel2JSON = roundSceneModelParams(sceneModel2.getJSON());
        expect(sceneModelJSON).toEqual(sceneModel2JSON);
    });

    test("Second DataModel matches first DataModel", () => {
        const dataModel2JSON = dataModel2.getJSON();
        expect(dataModelJSON).toEqual(dataModel2JSON);
    });
});
