import {Scene} from "@xeokit/scene";

import {Data} from "@xeokit/data";
import {loadDotBIM, saveDotBIM} from "../src";
import {roundSceneModelParams, sampleDataModelParams, sampleSceneModelParams} from "@xeokit/testutils";

describe('saveAndLoadDotBIM', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;

    test("Create SceneModel from SceneModelParams", async () => {
        sceneModel = scene.createModel(sampleSceneModelParams);
        expect(scene.models["myModel"]).toBeDefined();
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);
    });

    test("Create DataModel from DataModelParams", () => {
        dataModel = data.createModel(sampleDataModelParams);
        expect(data.models["myModel"]).toBeDefined();
        dataModel.build();
        expect(dataModel.built).toBe(true);
    });

    let dotBIM;
    let sceneModelParams;
    let dataModelParams;

    test("Save DataModel and SceneModel to DotBIM with saveDotBIM", () => {
        dotBIM = saveDotBIM({
            sceneModel,
            dataModel
        });
        sceneModelParams = roundSceneModelParams(sceneModel.getJSON(), {stripMeshMatrices: true});
        sceneModel.destroy();
        dataModelParams = dataModel.getJSON();
        dataModel.destroy();
    });

    let sceneModel2;
    let dataModel2;

    test("Load DotBIM into second DataModel and SceneModel with loadDotBIM", async () => {
        sceneModel2 = scene.createModel({id: "myModel"});
        dataModel2 = data.createModel({id: "myModel"});
        await loadDotBIM({
            fileData: dotBIM,
            sceneModel: sceneModel2,
            dataModel: dataModel2
        });
        await sceneModel2.build();
        dataModel2.build();
    });

    test("Second SceneModel matches first SceneModel", () => {
        const sceneModel2Params = roundSceneModelParams(sceneModel2.getJSON(), {stripMeshMatrices: true});
        expect(sceneModelParams).toEqual(sceneModel2Params);
    });

    // test("the second DataModel matches the first DataModel", () => {
    //     expect(dataModelParams).toEqual(dataModel2.getJSON());
    // });

});
