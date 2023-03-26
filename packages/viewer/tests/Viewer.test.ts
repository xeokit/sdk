/**
 * @jest-environment jsdom
 */

const jsdom = require("jsdom");


import {CreateModelParams, Renderer, View, Viewer, ViewObject} from "@xeokit/viewer";
import {RendererViewObject} from "../src/RendererViewObject";
import {FloatArrayParam} from "@xeokit/math/src/math";
import {Capabilities, SDKError} from "@xeokit/core/components";
import {Scene} from "@xeokit/scene";
import {ClampToEdgeWrapping, LinearEncoding, LinearFilter, TrianglesPrimitive} from "@xeokit/core/dist/constants";


const {JSDOM} = jsdom;

class MockRenderer implements Renderer {

    registeredViews: {};
    registeredModels: {};
    registeredObjects: {};
    rendererViewObjects: { [key: string]: RendererViewObject };
    imageDirty: boolean;

    constructor(params: {}) {
        this.rendererViewObjects = {};
        this.registeredViews = {};
        this.registeredModels = {};
        this.registeredObjects = {};
        this.imageDirty = false;
    }

    init(viewer: Viewer): void {
    }

    getCapabilities(capabilities: Capabilities): void {
        capabilities.maxViews = 1;
    }

    registerView(view: View): number {
        this.registeredViews[view.id] = view;
        return 0;
    }

    deregisterView(viewIndex: number): void { // Nop
    }

    addModel(params: CreateModelParams): void {
        this.registeredModels[params.id] = params;
    }

    removeModel(modelId: string): void {
        delete this.registeredModels[modelId];
    }

    setImageDirty(viewIndex?: number) {
        this.imageDirty = true;
    }

    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void { // @ts-ignore

    }

    setEdgesEnabled(viewIndex: number, enabled: boolean): void {

    }

    setPBREnabled(viewIndex: number, enabled: boolean): void {

    }

    getSAOSupported(): boolean {
        return false;
    }

    setSAOEnabled(viewIndex: number, enabled: boolean): void {

    }

    setTransparentEnabled(viewIndex: number, enabled: boolean): void {

    }

    clear(viewIndex: number) {

    };

    needsRebuild(viewIndex?: number): void {

    }

    needsRender(viewIndex?: number): boolean {
        return true;
    }

    render(viewIndex: number, params: { force?: boolean; }) {

    }

    pickSceneObject(viewIndex: number, params: {}): ViewObject | null {
        return null;
    };
}

describe('Create and Destroy a Viewer', () => {

    it('Create and Destroy a Viewer', () => {

        const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
        console.log(dom.window.document.querySelector("p").textContent); // "Hello world"

        const scene = new Scene();

        const renderer = new MockRenderer({});

        const viewer = new Viewer({
            id: "myViewer",
            scene,
            renderer
        });

        const view1 = viewer.createView({
            id: "myView",
            canvasId: "myView1"
        });

        if (view1 instanceof SDKError) {
            //
        } else {
            view1.camera.eye = [-3.933, 2.855, 27.018];
            view1.camera.look = [4.400, 3.724, 8.899];
            view1.camera.up = [-0.018, 0.999, 0.039];
        }

        const sceneModel = scene.createModel({
            id: "myModel"
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

        expect(renderer.registeredModels["myModel"]).toBeDefined();

        const redLegObject = view1.objects["redLegObject"]
        const greenLegObject = view1.objects["greenLegObject"]
        const blueLegObject = view1.objects["greenLegObject"]
        const yellowLegObject = view1.objects["greenLegObject"]
        const tableTopObject = view1.objects["tableTopObject"]

        expect(redLegObject).toBeDefined();
        expect(greenLegObject).toBeDefined();
        expect(blueLegObject).toBeDefined();
        expect(yellowLegObject).toBeDefined();
        expect(tableTopObject).toBeDefined();
    });
});