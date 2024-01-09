import {View, Viewer} from "@xeokit/viewer";
import {Scene, SceneModel} from "@xeokit/scene";
import {sampleDataModelParams, sampleSceneModelParams} from "@xeokit/testutils";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {SDKError} from "@xeokit/core";
import {saveBCFViewpoint} from "../src";
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

    it(`Hide, select, highlight, X-ray and colorize some objects`, () => {
        view.objects["redLeg"].visible = false;
        view.objects["greenLeg"].selected = true;
        view.objects["greenLeg"].colorize = [1, 0, 1]; // Purple
        view.objects["tableTop"].xrayed = true;
    });

    it("Save a BCF viewpoint", () => {

        bcfViewpoint = saveBCFViewpoint({view});

        expect(bcfViewpoint instanceof SDKError).toBe(false);

        expect(bcfViewpoint).toEqual(sampleBCFViewpoint);
    });
});