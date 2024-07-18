import { Scene, SceneModel } from "@xeokit/scene";
import { sampleSceneModelParams_multipleViewLayers } from "@xeokit/testutils";
import { WebGLRenderer } from "../../webglrenderer";
import { View, ViewLayer, Viewer } from "../src";

document.body.innerHTML = '<canvas id="myCanvas" />';

const scene = new Scene();
const renderer = new WebGLRenderer({});

let viewer;
let view;
let sceneModel;
let viewLayerDefault;
let viewLayer2;

describe('Viewer with autoLayers:false', () => {

    it('Creates a Viewer with a Scene and a WebGLRenderer', () => {
        viewer = new Viewer({
            id: "myViewer",
            scene,
            renderer: renderer as any
        });
    });

    it('Creates a View for a canvas in the DOM', () => {
        view = viewer.createView({
            id: "myView",
            elementId: "myCanvas",
            autoLayers: false
        });
        expect(view instanceof View).toBe(true);
        expect(view.htmlElement instanceof HTMLCanvasElement).toBe(true);
        expect(view.htmlElement.id).toBe("myCanvas");
    });

    it("Create ViewLayers", () => {

        const eventViewLayers = {};

        view.onLayerCreated.subscribe((view, viewLayer) => {
            eventViewLayers[viewLayer.id] = viewLayer;
        });

        viewLayerDefault = view.createLayer({
            id: "default",
            visible: true
        })
        expect(viewLayerDefault instanceof ViewLayer).toBe(true);

        viewLayer2 = view.createLayer({
            id: "viewLayer2",
            visible: true
        })
        expect(viewLayer2 instanceof ViewLayer).toBe(true);
        expect(eventViewLayers["default"]).toBeDefined();
        expect(eventViewLayers["viewLayer2"]).toBeDefined();
    });

    it("Create SceneModel", async () => {

        sceneModel = scene.createModel(sampleSceneModelParams_multipleViewLayers);
        expect(sceneModel instanceof SceneModel).toBe(true);
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);
    });

    it('ViewLayers contain ViewObjects for SceneObjects', () => {

        const defaultViewLayer = view.layers["default"];
        const viewLayer2 = view.layers["viewLayer2"];

        expect(defaultViewLayer.visibleObjectIds.sort()).toEqual(["redLeg",].sort());
        expect(viewLayer2.visibleObjectIds.sort()).toEqual(["greenLeg", "blueLeg", "yellowLeg", "tableTop"].sort());
    });

    it('View still contains the ViewLayers after SceneModel destroyed', () => {

        sceneModel.destroy();

        expect(scene.models["myModel"]).toBeUndefined();
        expect(sceneModel.destroyed).toBe(true);

        expect(view.layers["default"]).toBeDefined();
        expect(view.layers["viewLayer2"]).toBeDefined();
    });

    it("View does not contain ViewLayers after they are destroyed", () => {

        const eventViewLayers = {};

        view.onLayerDestroyed.subscribe((view, viewLayer) => {
            eventViewLayers[viewLayer.id] = viewLayer;
        });

        viewLayerDefault.destroy();
        viewLayer2.destroy();

        expect(viewLayerDefault.destroyed).toEqual(true);
        expect(viewLayer2.destroyed).toEqual(true);

        expect(view.layers["default"]).toBeUndefined();
        expect(view.layers["viewLayer2"]).toBeUndefined();

        expect(eventViewLayers["default"]).toBeDefined();
        expect(eventViewLayers["viewLayer2"]).toBeDefined();
    });


});
