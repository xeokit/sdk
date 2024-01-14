import {SDKError} from "@xeokit/core";
import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {load3DXML} from "../src";
import {railwayMeshGeometryIds, railwayObjectIds, railwayObjectMeshes} from "./assets/testUtils";


const fs = require('fs');

describe('load3DXML', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;
    let geometry;

    test("it should load the 3DXML model into a SceneModel and a DataModel", () => {

        dataModel = data.createModel({
            id: "theModel"
        });

        if (dataModel instanceof SDKError) {

        } else {

            sceneModel = scene.createModel({
                id: "theModel"
            });

            if (sceneModel instanceof SDKError) {

            } else {

                fs.readFile("./tests/assets/LoD3_Railway.json", 'utf8', (err, dat) => {

                    if (err) {
                        console.error(err);
                        return;
                    }

                    const fileData = JSON.parse(dat);

                    expect(sceneModel.built).toBe(false);

                    const meshGeometryArrays = {}

                    load3DXML({
                        fileData,
                        sceneModel,
                        dataModel
                    }).then(() => {

                        sceneModel.build()
                            .then(() => {

                                expect(sceneModel.built).toBe(true);

                                dataModel.build();

                                expect(dataModel.built).toBe(true);

                                const objectMeshIds = {}

                                for (let i = 0, len = railwayObjectIds.length; i < len; i++) {

                                    // Each CityObject should get a DataObject and a SceneObject

                                    const objectId = railwayObjectIds[i];

                                    const dataObject = dataModel.objects[objectId];
                                    const sceneObject = sceneModel.objects[objectId];

                                    expect(dataObject).toBeDefined();
                                    expect(dataObject.id).toStrictEqual(objectId);

                                    expect(sceneObject).toBeDefined();
                                    expect(sceneObject.id).toStrictEqual(objectId);

                                    // Each SceneObject should have the expected Meshes

                                    const meshes = sceneObject.meshes;

                                    for (let j = 0; j < meshes.length; j++) {

                                        const meshId = railwayObjectMeshes[objectId][j];
                                        const mesh = meshes[j];
                                        const geometry = mesh.geometry;

                                        expect(mesh.id).toStrictEqual(meshId);

                                        // Each SceneMesh should have the expected SceneGeometry

                                        expect(geometry.id).toStrictEqual(railwayMeshGeometryIds[meshId]);

                                        // SceneModel.createGeometry etc. is already tested in @xeokit/scene
                                    }

                                    // Test query

                                    const resultObjectIds = [];

                                    const result = data.searchObjects({
                                        startObjectId: "GMLID_BUI130363_1235_6047",
                                        includeRelated: [BasicAggregation],
                                        resultObjectIds
                                    });

                                    if (result instanceof SDKError) {
                                        throw (result);
                                    }

                                    expect(resultObjectIds).toStrictEqual([
                                        'GMLID_BUI130363_1235_6047',
                                        'UUID_106e0075-dbba-40aa-b262-7c53471ebc9c',
                                        'UUID_f86096c0-8f2c-480c-8735-912b9848bacc',
                                        'UUID_473e6b54-b1bf-4b1f-9cac-9f140d281f68',
                                        'UUID_a36e82c0-15bd-4ce0-9835-073afc80a8d2',
                                        'UUID_bc1947a4-3112-4802-82c3-e222c6057654',
                                        'UUID_3c683328-d725-4d17-98dd-76b1f9add1a3',
                                        'UUID_860899b8-285a-4664-8355-96fa06448d8b',
                                        'UUID_fb5abb23-6094-4494-92a2-3ec7d0adb941',
                                        'UUID_3a542054-54d1-4167-8551-46f5b207514f',
                                        'UUID_e7a2aa1b-699a-40e1-9701-dc11295f6926',
                                        'UUID_68137f34-512a-4de2-8a5c-d4e01b0568a3',
                                        'UUID_b3e0f61a-7f68-4d2b-8a33-5ac6cca64be4',
                                        'UUID_5c9d78e9-1243-4b47-8959-3a180ad0295d',
                                        'UUID_04c7ddba-f27e-4ebf-9536-eab328fa46ad',
                                        'UUID_3edf315d-799b-424a-8708-f99a2d2d5943',
                                        'UUID_32ec33ab-c4f9-4661-ac6c-3e7a77cc875b',
                                        'UUID_322168b3-be85-4a50-ae74-1bc4ad115020',
                                        'UUID_8eaba6cb-231c-4b2a-9e82-283fff695f4c',
                                        'UUID_3011b616-0c46-4a5e-baa5-625553cfb0dc',
                                        'UUID_99c687c3-a7e5-4eff-ba96-f59ab3eca38f',
                                        'UUID_11334c5a-e455-4fbb-80d4-bd8af9164a27',
                                        'UUID_7bffc33f-c817-4210-9cdf-3cf2d0b9959c',
                                        'UUID_e657e929-1ea2-446b-9f97-6de4916cd86c',
                                        'UUID_b8cfb726-826b-410d-9439-fa61750d5201',
                                        'UUID_aa821ebf-c870-4fa4-af90-9dec0647a25a',
                                        'UUID_8e5673a8-c1f2-406d-96df-12e75259bdf7',
                                        'UUID_3f2a5070-f4b3-4948-b3dc-622159041598',
                                        'UUID_389a52f7-b97b-4162-bafd-3af49c30c328',
                                        'UUID_f3bdd9e9-6394-4347-b232-50146cb76ee8',
                                        'UUID_93e9b87b-80a8-4a95-a845-daeb7bc6caa4',
                                        'UUID_5b4e50b3-9510-4672-95c6-197610d41543',
                                        'UUID_108a2ac4-a6b2-46ea-bf05-8121367b012f',
                                        'UUID_34d08703-26dd-4ae1-abb8-5b291fbcda56',
                                        'UUID_0df6a3b1-84c5-451d-9c1c-41a1e6296637',
                                        'UUID_31070f32-ea4d-43df-9b01-0347d1ca8314',
                                        'UUID_78c5fbf8-dded-4681-80c9-b4e3ba9396da',
                                        'UUID_224b5dc5-152d-4164-84e0-9187f9693b5c',
                                        'UUID_0bd23c77-fe8f-4433-8257-d94d5ba7bdcb',
                                        'UUID_70e63734-f6d0-43a8-b2bf-a317a72f6c97',
                                        'UUID_eb7c7f5d-5c89-4ce6-a742-491ceaf3e7ae',
                                        'UUID_f78662ba-0202-4620-bdce-24b286884f13',
                                        'UUID_256fb971-599a-4a4a-8d1a-b2a56ca80312',
                                        'UUID_258502a2-666e-4dc9-8c58-f0755bf47962',
                                        'UUID_ee7d3a2f-b2fd-4f04-bf74-44f0c05f62b1',
                                        'UUID_825e880c-0eb5-4e5a-a908-e980d3364a76',
                                        'UUID_883ba233-07bf-4ecf-89c3-0d552d8575c2',
                                        'UUID_31689e39-de68-44f1-a882-cd2574ffd67f',
                                        'UUID_1ab6c2c9-8d55-4fc8-b30b-be30307238ab',
                                        'UUID_fdbb45f7-05b7-4a13-98cd-94161ed115d0',
                                        'UUID_5c4873cc-c590-4841-a9d5-176d9b66e434',
                                        'UUID_e2958d70-5ebd-4426-a77d-1bef0175e3b7',
                                        'UUID_e8183cbd-c339-4472-926a-32bbe4527b44'
                                    ]);
                                }
                            }).catch((sdkError: SDKError) => {

                        });
                    }).catch((sdkError: SDKError) => {

                    });

                });
            }
        }
    });

});