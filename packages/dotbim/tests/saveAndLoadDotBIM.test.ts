import {Scene} from "@xeokit/scene";

import {Data} from "@xeokit/data";
import {loadDotBIM, saveDotBIM} from "../src";
import {roundSceneModelParams, sampleDataModelParams, sampleSceneModelParams} from "@xeokit/testutils";

describe('saveAndLoadDotBIM', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;

    test("the SceneModel creates from SceneModelParams", async () => {
        sceneModel = scene.createModel(sampleSceneModelParams);
        expect(scene.models["myModel"]).toBeDefined();
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);
    });

    test("the DataModel creates from DataModelParams", () => {
        dataModel = data.createModel(sampleDataModelParams);
        expect(data.models["myModel"]).toBeDefined();
        dataModel.build();
        expect(dataModel.built).toBe(true);
    });

    let dotBIM;
    let sceneModelParams;
    let dataModelParams;

    test("saveDotBIM saves the DataModel and SceneModel to DotBIM", () => {
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

    test("loadDotBIM loads the DotBIM into a second DataModel and SceneModel", async () => {
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

    test("the second SceneModel matches the first SceneModel", () => {
        const sceneModel2Params = roundSceneModelParams(sceneModel2.getJSON(), {stripMeshMatrices: true});
        expect(sceneModelParams).toEqual(sceneModel2Params);
    });

    // test("the second DataModel matches the first DataModel", () => {
    //     expect(dataModelParams).toEqual(dataModel2.getJSON());
    // });

});