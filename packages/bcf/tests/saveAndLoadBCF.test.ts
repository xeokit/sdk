import {Data} from "@xeokit/data";
import {BasicAggregation, BasicEntity} from "@xeokit/basictypes";
import {TrianglesPrimitive} from "@xeokit/constants";
import {Scene} from "@xeokit/scene";
import {Viewer} from "@xeokit/viewer";
import {saveBCFViewpoint} from "../src";
import {SDKError} from "@xeokit/core";

describe('build', function () {

    const data = new Data();
    const scene = new Scene();

    let dataModel;

    it('create data model', () => {

        const viewer = new Viewer({
            id: "myViewer",
            renderer: null,
            scene
        });

        const view = viewer.createView({
            id: "myView"
        });

        if (view instanceof SDKError) {

        } else {

            const viewLayer = view.createLayer({
                id: "myLayer"
            });

            // create DataModel

            const dataModel = data.createModel({
                id: "myTableModel"
            });

            dataModel.createObject({
                id: "table",
                type: BasicEntity,
                name: "Table"
            });

            dataModel.createObject({
                id: "redLeg",
                name: "Red table Leg",
                type: BasicEntity
            });

            dataModel.createObject({
                id: "greenLeg",
                name: "Green table leg",
                type: BasicEntity
            });

            dataModel.createObject({
                id: "blueLeg",
                name: "Blue table leg",
                type: BasicEntity
            });

            dataModel.createObject({
                id: "yellowLeg",
                name: "Yellow table leg",
                type: BasicEntity
            });

            dataModel.createObject({
                id: "tableTop",
                name: "Purple table top",
                type: BasicEntity
            });

            dataModel.createRelationship({
                type: BasicAggregation,
                relatingObjectId: "table",
                relatedObjectId: "tableTop"
            });

            dataModel.createRelationship({
                type: BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "redLeg"
            });

            dataModel.createRelationship({
                type: BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "greenLeg"
            });

            dataModel.createRelationship({
                type: BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "blueLeg"
            });

            dataModel.createRelationship({
                type: BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "yellowLeg"
            });

            dataModel.build();

            // Create SceneModel

            const sceneModel = scene.createModel({
                id: "theModel"
            });

            sceneModel.createGeometry({
                id: "theGeometry",
                primitive: TrianglesPrimitive,
                positions: [ // Floats
                    1, 1, 1, -1, 1, 1,
                    -1, -1, 1, 1, -1, 1, 1,
                    -1, -1, 1, 1, -1, -1, 1, -1, -1,
                    -1, -1
                ],
                indices: [
                    0, 1, 2, 0, 2, 3, 4, 5, 6, 4,
                    6, 7, 8, 9, 10, 8, 10, 11, 12,
                    13, 14, 12, 14, 15, 16, 17, 18,
                    16, 18, 19, 20, 21, 22, 20, 22, 23
                ]
            });

            sceneModel.createMesh({
                id: "redLegMesh",
                geometryId: "theGeometry",
                position: [-4, -6, -4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [1, 0.3, 0.3]
            });

            sceneModel.createMesh({
                id: "greenLegMesh",
                geometryId: "theGeometry",
                position: [4, -6, -4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [0.3, 1.0, 0.3]
            });

            sceneModel.createMesh({
                id: "blueLegMesh",
                geometryId: "theGeometry",
                position: [4, -6, 4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [0.3, 0.3, 1.0]
            });

            sceneModel.createMesh({
                id: "yellowLegMesh",
                geometryId: "theGeometry",
                position: [-4, -6, 4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [1.0, 1.0, 0.0]
            });

            sceneModel.createMesh({
                id: "tableTopMesh",
                geometryId: "theGeometry",
                position: [0, -3, 0],
                scale: [6, 0.5, 6],
                rotation: [0, 0, 0],
                color: [1.0, 0.3, 1.0]
            });

            sceneModel.createObject({
                id: "redLegObject",
                meshIds: ["redLegMesh"]
            });

            sceneModel.createObject({
                id: "greenLegObject",
                meshIds: ["greenLegMesh"]
            });

            sceneModel.createObject({
                id: "blueLegObject",
                meshIds: ["blueLegMesh"]
            });

            sceneModel.createObject({
                id: "yellowLegObject",
                meshIds: ["yellowLegMesh"]
            });

            sceneModel.createObject({
                id: "tableTopObject",
                meshIds: ["tableTopMesh"]
            });

            sceneModel.build();

            const bcfViewpoint = saveBCFViewpoint(({
                view,
                includeLayerIds: [],
                excludeLayerIds: []
            }));

        }
    });
});