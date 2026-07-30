import {TrianglesPrimitive} from "../../../base/constants";
import {Scene} from "../../../model/scene";
import {Viewer} from "../Viewer";
import {installViewerTestGlobals} from "./installViewerTestGlobals";

const QUAD_POSITIONS = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

class FakeHTMLElement {
  offsetLeft = 0;
  offsetTop = 0;
  clientWidth = 640;
  clientHeight = 480;
}

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

let restoreGlobals: (() => void) | null = null;

beforeAll(() => {
  restoreGlobals = installViewerTestGlobals(FakeHTMLElement, FakeResizeObserver);
});

afterAll(() => {
  restoreGlobals?.();
});

function createHostElement(): HTMLElement {
  return new FakeHTMLElement() as any;
}

function createScene(objects: { id: string; layerId?: string }[]): Scene {
  const scene = new Scene();
  const modelResult = scene.createModel({id: "model"});
  expect(modelResult.ok).toBe(true);
  const model = modelResult.value!;

  for (const object of objects) {
    const geometryId = `${object.id}.geometry`;
    const meshId = `${object.id}.mesh`;

    expect(model.createGeometry({
      id: geometryId,
      primitive: TrianglesPrimitive,
      positions: QUAD_POSITIONS,
      indices: QUAD_INDICES
    }).ok).toBe(true);

    expect(model.createMesh({
      id: meshId,
      geometryId
    }).ok).toBe(true);

    expect(model.createObject({
      id: object.id,
      meshIds: [meshId],
      layerId: object.layerId
    }).ok).toBe(true);
  }

  return scene;
}

describe("ViewLayer lifecycle", () => {

  it("shares one ViewObject between View and ViewLayer for explicit default-layer objects", () => {
    const scene = createScene([
      {id: "objectA", layerId: "default"},
      {id: "objectB", layerId: "default"}
    ]);
    const viewer = new Viewer({scene});

    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement()
    });

    expect(viewResult.ok).toBe(true);
    const view = viewResult.value!;
    const layer = view.layers["default"];

    expect(layer).toBeDefined();
    expect(view.numObjects).toBe(2);
    expect(layer.numObjects).toBe(2);
    expect(view.numVisibleObjects).toBe(2);
    expect(layer.numVisibleObjects).toBe(2);

    for (const objectId of ["objectA", "objectB"]) {
      const viewObject = view.objects[objectId];
      expect(viewObject).toBeDefined();
      expect(layer.objects[objectId]).toBe(viewObject);
      expect(view.visibleObjects[objectId]).toBe(viewObject);
      expect(layer.visibleObjects[objectId]).toBe(viewObject);
    }
  });

  it("populates explicitly created layers through View-owned ViewObjects", () => {
    const scene = createScene([
      {id: "modelObject", layerId: "model"},
      {id: "environmentObject", layerId: "environment"}
    ]);
    const viewer = new Viewer({scene});

    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      autoLayers: false
    });

    expect(viewResult.ok).toBe(true);
    const view = viewResult.value!;
    expect(view.numObjects).toBe(0);

    const layerResult = view.createLayer({id: "model"});
    expect(layerResult.ok).toBe(true);
    const layer = layerResult.value!;

    expect(view.numObjects).toBe(1);
    expect(layer.numObjects).toBe(1);
    expect(view.objects["environmentObject"]).toBeUndefined();
    expect(layer.objects["environmentObject"]).toBeUndefined();
    expect(layer.objects["modelObject"]).toBe(view.objects["modelObject"]);

    layer.destroy();

    expect(layer.destroyed).toBe(true);
    expect(view.layers["model"]).toBeUndefined();
    expect(view.objects["modelObject"]).toBeUndefined();
    expect(view.numObjects).toBe(0);
    expect(view.numVisibleObjects).toBe(0);
  });

  it("populates configured layers while creating a view", () => {
    const scene = createScene([
      {id: "modelObject", layerId: "model"},
      {id: "environmentObject", layerId: "environment"}
    ]);
    const viewer = new Viewer({scene});

    const viewResult = viewer.createView({
      id: "view",
      htmlElement: createHostElement(),
      autoLayers: false,
      layers: [{id: "model"}]
    });

    expect(viewResult.ok).toBe(true);
    const view = viewResult.value!;
    const layer = view.layers["model"];

    expect(layer).toBeDefined();
    expect(view.numObjects).toBe(1);
    expect(layer.numObjects).toBe(1);
    expect(view.objects["environmentObject"]).toBeUndefined();
    expect(layer.objects["modelObject"]).toBe(view.objects["modelObject"]);
  });
});
