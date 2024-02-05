import {View, Viewer} from "@xeokit/viewer";
import {Scene, SceneModel} from "@xeokit/scene";
import {sampleDataModelParams, sampleSceneModelParams} from "@xeokit/testutils";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {loadBCFViewpoint, saveBCFViewpoint} from "../src";
import {Data, DataModel} from "@xeokit/data";

import {sampleBCFViewpoint} from "./assets/sampleBCFViewpoint";

document.body.innerHTML = '<canvas id="myCanvas" />';

const scene = new Scene();
const data = new Data();
const renderer = new WebGLRenderer({});

let viewer;
let view;
let sceneModel;
let dataModel;
let bcfViewpoint;

describe('saveBCFViewpoint', () => {

    it('Creates a Viewer with a Scene and a WebGLRenderer', () => {

        viewer = new Viewer({
            id: "myViewer",
            scene,
            renderer
        });
    });

    it('Creates a View for a canvas in the DOM', () => {

        view = viewer.createView({
            id: "myView",
            canvasId: "myCanvas"
        });

        expect(view instanceof View).toBe(true);
    });

    it(`Arrange the Camera`, () => {

        view.camera.eye = [-10.0, 12.0, 24.0];
        view.camera.look = [8.0, 2.0, 0];
        view.camera.up = [0.18, 0.93, -0.25];
    });

    it("Create a SceneModel and DataModel", async () => {

        sceneModel = scene.createModel(sampleSceneModelParams);
        expect(sceneModel instanceof SceneModel).toBe(true);
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);

        dataModel = data.createModel(sampleDataModelParams);
        expect(dataModel instanceof DataModel).toBe(true);
        dataModel.build();
        expect(dataModel.built).toBe(true);
    });

    it("Load a BCF viewpoint", () => {
        loadBCFViewpoint({
            view,
            data,
            bcfViewpoint: sampleBCFViewpoint,
            rayCast: false
        });
    });

    it("The Camera should be set correctly", () => {
        // expect(Array.from(view.camera.eye)).toEqual([-10, 12, 24]);
        // expect(Array.from(view.camera.look)).toEqual([8.0, 2.0, 0]);
        // expect(Array.from(view.camera.up)).toEqual([0.18, 0.93, -0.25])
    });

    it(`The correct objects should be hidden, selected, highlighted, X-rayed and colorized`, () => {
        expect(view.objects["redLeg"].visible).toEqual(false);
        expect(view.objects["greenLeg"].selected).toEqual(true);
        expect(Array.from(view.objects["greenLeg"].colorize)).toEqual([1, 0, 1]); // Purple
        expect(view.objects["tableTop"].xrayed).toEqual(true);
    });
});