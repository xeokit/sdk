import { ClampToEdgeWrapping, LinearEncoding, LinearFilter, TrianglesPrimitive } from "@xeokit/constants";
import { SDKError } from "@xeokit/core";
import { Data } from "@xeokit/data";
import { Scene } from "@xeokit/scene";
import { View, Viewer } from "@xeokit/viewer";
import { JSDOM } from "jsdom";
import * as testUtils from "./testUtils";

describe('DataModel', function () {

    const data = new Data();
    let dataModel;


    describe('Create and Destroy a Viewer', () => {

        it('Create and Destroy a Viewer', () => {

            const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
            console.log(dom.window._document.querySelector("p").textContent); // "Hello world"

            const scene = new Scene();

            const renderer = new MockRenderer({});

            const viewer: Viewer = new Viewer({
                id: "myViewer",
                scene,
                renderer
            });

            const view1: View | SDKError = viewer.createView({
                id: "myView",
                canvasId: "myView1"
            });

            if (view1 instanceof SDKError) {
                throw new Error("Failed to create new View with Viewer.createView()");
            }

            view1.camera.eye = [-3.933, 2.855, 27.018];
            view1.camera.look = [4.400, 3.724, 8.899];
            view1.camera.up = [-0.018, 0.999, 0.039];

            const sceneModel = scene.createModel({
                id: "myModel"
            });

            if (sceneModel instanceof SDKError) {
                throw new Error("Failed to create new SceneModel with Scene.createModel()");
            }

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

            sceneModel.createTexture({
                id: "colorTexture",
                src: "./assets/sample_etc1s.ktx2",
                preloadColor: [1, 0, 0, 1],
                flipY: false,
                encoding: LinearEncoding,
                magFilter: LinearFilter,
                minFilter: LinearFilter,
                wrapR: ClampToEdgeWrapping,
                wrapS: ClampToEdgeWrapping,
                wrapT: ClampToEdgeWrapping,
            });

            sceneModel.createTextureSet({
                id: "theTextureSet",
                colorTextureId: "colorTexture"
            });

            sceneModel.createMesh({
                id: "redLegMesh",
                geometryId: "theGeometry",
                position: [-4, -6, -4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [1, 0.3, 0.3],
                textureSetId: "theTextureSet"
            });

            sceneModel.createMesh({
                id: "greenLegMesh",
                geometryId: "theGeometry",
                position: [4, -6, -4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [0.3, 1.0, 0.3],
                textureSetId: "theTextureSet"
            });

            sceneModel.createMesh({
                id: "blueLegMesh",
                geometryId: "theGeometry",
                position: [4, -6, 4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [0.3, 0.3, 1.0],
                textureSetId: "theTextureSet"
            });

            sceneModel.createMesh({
                id: "yellowLegMesh",
                geometryId: "theGeometry",
                position: [-4, -6, 4],
                scale: [1, 3, 1],
                rotation: [0, 0, 0],
                color: [1.0, 1.0, 0.0],
                textureSetId: "theTextureSet"
            });

            sceneModel.createMesh({
                id: "tableTopMesh",
                geometryId: "theGeometry",
                position: [0, -3, 0],
                scale: [6, 0.5, 6],
                rotation: [0, 0, 0],
                color: [1.0, 0.3, 1.0],
                textureSetId: "theTextureSet"
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

            it('it supports creating objects, property sets and relations from JSON', () => {

                dataModel = data.createModel(testUtils.sampleDataModelJSON);
                dataModel.build();
                expect(dataModel.built).toBe(true);

            });

        });
    })
});
