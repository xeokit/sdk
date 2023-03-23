import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadCityJSON} from "../src";
import {railwayMeshGeometryIds, railwayObjectIds, railwayObjectMeshes} from "./assets/testUtils";
import {BasicAggregation} from "@xeokit/datatypes/src/cityJSONTypes_1_1_3";

const fs = require('fs');

describe('loadCityJSON Test', () => {

    const data = new Data();
    const scene = new Scene();
    let dataModel;
    let sceneModel;
    let geometry;

    it('loadCityJSON Test', () => {

        dataModel = data.createModel({
            id: "theModel"
        });

        sceneModel = scene.createModel({
            id: "theModel"
        });

        fs.readFile("./tests/assets/LoD3_Railway.json", 'utf8', (err, dat) => {

            if (err) {
                console.error(err);
                return;
            }

            const fileData = JSON.parse(dat);

            expect(sceneModel.built).toBe(false);

            const meshGeometryArrays = {}

            loadCityJSON({
                data: fileData,
                sceneModel,
                dataModel
            }, {
                rotateX: true
            }).then(() => {

                sceneModel.build().then(() => {

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

                            // Each Mesh should have the expected Geometry

                            expect(geometry.id).toStrictEqual(railwayMeshGeometryIds[meshId]);

                            // SceneModel.createGeometry etc. is already tested in @xeokit/scene
                        }

                        // Test query

                        const resultObjectIds = [];

                        data.searchObjects({
                            startObjectId: "GMLID_BUI130363_1235_6047",
                            includeRelated: [BasicAggregation],
                            resultObjectIds
                        });

                        //    console.log(resultObjectIds)
                        expect(resultObjectIds).toStrictEqual([
                            "UUID_31689e39-de68-44f1-a882-cd2574ffd67f"
                        ]);
                    }
                });
            });

        });
    });
});