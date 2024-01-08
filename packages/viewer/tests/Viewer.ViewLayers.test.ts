import {View, Viewer} from "@xeokit/viewer";
import {Scene, SceneModel} from "@xeokit/scene";
import {sampleSceneModelParams_multipleViewLayers} from "@xeokit/testutils";
import {WebGLRenderer} from "@xeokit/webglrenderer";

document.body.innerHTML = '<canvas id="myCanvas" />';

const scene = new Scene();
const renderer = new WebGLRenderer({});

let viewer;
let view;
let sceneModel;
let viewLayer;

describe('Viewer', () => {

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
        expect(view.canvasElement instanceof HTMLCanvasElement).toBe(true);
        expect(view.canvasElement.id).toBe("myCanvas");
    });

    it("View contain ViewLayers for SceneModel", async () => {

        const eventViewLayers = {};

        view.onLayerCreated.subscribe((view, viewLayer) => {
            eventViewLayers[viewLayer.id] = viewLayer;
        });

        sceneModel = scene.createModel(sampleSceneModelParams_multipleViewLayers);
        expect(sceneModel instanceof SceneModel).toBe(true);
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);

        expect(view.layers["default"]).toBeDefined();
        expect(view.layers["viewLayer2"]).toBeDefined();

        expect(eventViewLayers["default"]).toBeDefined();
        expect(eventViewLayers["viewLayer2"]).toBeDefined();
    });

    it('ViewLayers contain ViewObjects for SceneObjects', () => {

        const defaultViewLayer = view.layers["default"];
        const viewLayer2 = view.layers["viewLayer2"];

        expect(defaultViewLayer.visibleObjectIds.sort()).toEqual(["redLeg",].sort());
        expect(viewLayer2.visibleObjectIds.sort()).toEqual(["greenLeg", "blueLeg", "yellowLeg", "tableTop"].sort());
    });

    it('ViewLayers contains no ViewLayers after SceneModel destroyed', () => {

        const eventViewLayers = {};

        view.onLayerDestroyed.subscribe((view, viewLayer) => {
            eventViewLayers[viewLayer.id] = viewLayer;
        });

        sceneModel.destroy();

        expect(scene.models["myModel"]).toBeUndefined();
        expect(sceneModel.destroyed).toBe(true);

        expect(view.layers["default"]).toBeUndefined();
        expect(view.layers["viewLayer2"]).toBeUndefined();

        expect(eventViewLayers["default"]).toBeDefined();
        expect(eventViewLayers["viewLayer2"]).toBeDefined();
    });

});