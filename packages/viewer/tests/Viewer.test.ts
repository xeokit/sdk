import { SDKError } from "@xeokit/core";
import { Scene, SceneModel } from "@xeokit/scene";
import { sampleSceneModelParams } from "@xeokit/testutils";
import { WebGLRenderer } from "../../webglrenderer";
import { View, Viewer } from "../src";

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
            renderer: renderer as any
        });
        expect(viewer.destroyed).toEqual(false);
        expect(viewer.numViews).toEqual(0);
        expect(viewer.viewList).toEqual([]);
        expect(viewer.views).toEqual({});
        expect(viewer.capabilities.maxViews).toEqual(1);
        expect(viewer.capabilities.headless).toEqual(false);
    });

    it('Creates a View for a canvas in the DOM', () => {
        view = viewer.createView({
            id: "myView",
            elementId: "myCanvas"
        });
        expect(view instanceof View).toBe(true);
        expect(viewer.numViews).toEqual(1);
        expect(viewer.viewList.length).toEqual(1);
        expect(viewer.viewList[0].id).toEqual(view.id);
        expect(view.htmlElement instanceof HTMLCanvasElement).toBe(true);
        expect(view.htmlElement.id).toBe("myCanvas");
    });

    it('Prevent creating excess Views', () => {
        const view2 = viewer.createView({
            id: "myView2",
            elementId: "myCanvas"
        });
        expect(view2 instanceof SDKError).toBe(true);
        expect(viewer.numViews).toEqual(1);
        expect(viewer.viewList.length).toEqual(1);
    });


    it("View creates a `default` ViewLayer when SceneModel created in Scene", async () => {
        let eventViewLayer;
        view.onLayerCreated.subscribe((view, viewLayer) => {
            eventViewLayer = viewLayer;
        });

        sceneModel = scene.createModel(sampleSceneModelParams);
        expect(sceneModel instanceof SceneModel).toBe(true);
        await sceneModel.build();
        expect(sceneModel.built).toBe(true);

        viewLayer = view.layers["default"];
        expect(viewLayer).toBeDefined();

        expect(eventViewLayer).toBeDefined();
        expect(eventViewLayer.id).toEqual("default");
    });

    it('View contains a ViewObject for each SceneObject in the Scene', () => {
        for (let id in scene.objects) {
            const sceneObject = scene.objects[id];
            const viewObject = view.objects[id];
            expect(viewObject).toBeDefined();
            expect(viewObject.id).toEqual(sceneObject.id);
            expect(viewObject.sceneObject).toBeDefined();
            expect(viewObject.sceneObject.id).toEqual(id);
            const viewLayer = viewObject.layer;
            expect(viewLayer).toBeDefined();
            expect(viewLayer.id).toEqual("default");
        }
    });

    it('ViewLayer cotains a ViewObject for each SceneObject in the Scene', () => {
        for (let id in scene.objects) {
            const sceneObject = scene.objects[id]
            const viewObject = viewLayer.objects[id];
            expect(sceneObject).toBeDefined();
            expect(viewObject).toBeDefined();
            expect(viewObject.id).toEqual(sceneObject.id);
        }
    });

    it('View.selectedObjects and ViewLayer.selectedObjects synchronize with ViewObject.selected', () => {
        const redLegViewObject = view.objects["redLeg"];
        expect(view.selectedObjectIds).toEqual([]);
        expect(viewLayer.selectedObjectIds).toEqual([]);
        redLegViewObject.selected = true;
        expect(view.selectedObjectIds).toEqual(["redLeg"]);
        expect(viewLayer.selectedObjectIds).toEqual(["redLeg"]);
        redLegViewObject.selected = false;
        expect(view.selectedObjectIds).toEqual([]);
        expect(viewLayer.selectedObjectIds).toEqual([]);
    });

    it('View.highlightedObjects and ViewLayer.highlightedObjects synchronize with ViewObject.selected', () => {
        const redLegViewObject = view.objects["redLeg"];
        expect(view.highlightedObjectIds).toEqual([]);
        expect(viewLayer.highlightedObjectIds).toEqual([]);
        redLegViewObject.highlighted = true;
        expect(view.highlightedObjectIds).toEqual(["redLeg"]);
        expect(viewLayer.highlightedObjectIds).toEqual(["redLeg"]);
        redLegViewObject.highlighted = false;
        expect(view.highlightedObjectIds).toEqual([]);
        expect(viewLayer.highlightedObjectIds).toEqual([]);
    });

    it('View.visibleObjects and ViewLayer.visibleObjects synchronize with ViewObject.visible', () => {
        const redLegViewObject = viewLayer.objects["redLeg"];
        expect(viewLayer.visibleObjectIds.sort()).toEqual(["redLeg", "greenLeg", "blueLeg", "yellowLeg", "tableTop"].sort());
        redLegViewObject.visible = false;
        expect(viewLayer.visibleObjectIds.sort()).toEqual(["greenLeg", "blueLeg", "yellowLeg", "tableTop"].sort());
        expect(view.visibleObjectIds.sort()).toEqual(["greenLeg", "blueLeg", "yellowLeg", "tableTop"].sort());
        redLegViewObject.visible = true;
        expect(viewLayer.visibleObjectIds.sort()).toEqual(["greenLeg", "blueLeg", "yellowLeg", "tableTop", "redLeg"].sort());
        expect(view.visibleObjectIds.sort()).toEqual(["greenLeg", "blueLeg", "yellowLeg", "tableTop", "redLeg"].sort());
    });

    it('ViewLayer.onObjectVisibility fires on change to ViewObject.visible', () => {
        let eventViewObject;
        viewLayer.onObjectVisibility.subscribe((viewLayer, viewObject) => {
            eventViewObject = viewObject;
        });
        const redLegViewObject = viewLayer.objects["redLeg"];
        redLegViewObject.visible = false;
        expect(eventViewObject).toBeDefined();
        expect(eventViewObject.id).toEqual(redLegViewObject.id);
        redLegViewObject.visible = true;
    });

    it('View.onObjectVisibility fires on change to ViewObject.visible', () => {
        let eventViewObject;
        view.onObjectVisibility.subscribe((view, viewObject) => {
            eventViewObject = viewObject;
        });
        const redLegViewObject = view.objects["redLeg"];
        redLegViewObject.visible = false;
        expect(eventViewObject).toBeDefined();
        expect(eventViewObject.id).toEqual(redLegViewObject.id);
        redLegViewObject.visible = true;
    });
});
