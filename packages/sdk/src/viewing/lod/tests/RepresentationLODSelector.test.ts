import {PerspectiveProjectionType, TrianglesPrimitive} from "../../../base/constants";
import {Scene, type SceneModel, type SceneRepSet} from "../../../model/scene";
import type {View} from "../../viewer/View";
import {Viewer} from "../../viewer/Viewer";
import {installViewerTestGlobals} from "../../viewer/tests/installViewerTestGlobals";
import {RepresentationLODSelector} from "../RepresentationLODSelector";

class FakeHTMLElement {
  offsetLeft = 0;
  offsetTop = 0;
  clientWidth = 800;
  clientHeight = 600;
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

describe("RepresentationLODSelector", () => {
  it("selects authored SceneModel representations independently per view", () => {
    const {model, viewer, view} = createFixture();
    const farView = createView(viewer, "farView");
    setCamera(view, [0, 0, 18], [0, 0, 0]);
    setCamera(farView, [0, 0, 800], [0, 0, 0]);
    addLODObjects(model);
    const repSet = createLODRepSet(model);

    const selector = new RepresentationLODSelector({viewer});
    selector.updateView(view);
    selector.updateView(farView);

    expect(selector.getActiveRepId(view, repSet)).toBe("detailed");
    expect(selector.getActiveRepId(farView, repSet)).toBe("shell");
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(true);
    expect(viewer.lodVisibility.isSuppressed(farView.id, "source")).toBe(true);
    expect(viewer.lodVisibility.isSuppressed(farView.id, "shell")).toBe(false);

    selector.destroy();
  });

  it("does not mutate application visibility while switching representations", () => {
    const {model, viewer, view} = createFixture();
    addLODObjects(model);
    createLODRepSet(model);
    const selector = new RepresentationLODSelector({viewer});
    setCamera(view, [0, 0, 800], [0, 0, 0]);
    selector.updateView(view);
    view.objects.source.visible = false;

    setCamera(view, [0, 0, 18], [0, 0, 0]);
    selector.updateView(view);

    expect(view.objects.source.visible).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(true);

    selector.destroy();
  });

  it("discovers representation sets created after the selector", () => {
    const {model, viewer, view} = createFixture();
    addLODObjects(model);
    const selector = new RepresentationLODSelector({viewer});
    setCamera(view, [0, 0, 800], [0, 0, 0]);

    const repSet = createLODRepSet(model);
    selector.updateView(view);

    expect(selector.getActiveRepId(view, repSet)).toBe("shell");
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(true);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(false);

    selector.destroy();
  });

  it("updates from camera setter events without application selector calls", async () => {
    const {model, viewer, view} = createFixture();
    addLODObjects(model);
    const repSet = createLODRepSet(model);
    const selector = new RepresentationLODSelector({viewer});

    selector.updateView(view);
    expect(selector.getActiveRepId(view, repSet)).toBe("detailed");

    view.camera.eye = [0, 0, 800];
    await waitForScheduledTasks();

    expect(selector.getActiveRepId(view, repSet)).toBe("shell");
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(true);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(false);

    selector.destroy();
  });

  it("supports overlapping representation object membership", () => {
    const {model, viewer, view} = createFixture();
    addLODObjects(model);
    const result = model.createRepSet({
      id: "overlap-lod",
      defaultRepId: "detailed",
      selection: {
        strategy: "projectedSize"
      },
      reps: [
        {
          id: "detailed",
          objectIds: ["source", "shell"],
          range: {
            minPixels: 120
          }
        },
        {
          id: "dominant",
          objectIds: ["source"],
          range: {
            maxPixels: 100
          }
        }
      ]
    });
    expect(result.ok).toBe(true);
    const repSet = result.value!;
    const selector = new RepresentationLODSelector({viewer});

    setCamera(view, [0, 0, 18], [0, 0, 0]);
    selector.updateView(view);
    expect(selector.getActiveRepId(view, repSet)).toBe("detailed");
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(false);

    setCamera(view, [0, 0, 800], [0, 0, 0]);
    selector.updateView(view);
    expect(selector.getActiveRepId(view, repSet)).toBe("dominant");
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(true);

    selector.destroy();
  });

  it("clears selector-owned suppression on disable and destroy", () => {
    const {model, viewer, view} = createFixture();
    addLODObjects(model);
    createLODRepSet(model);
    const selector = new RepresentationLODSelector({viewer});
    setCamera(view, [0, 0, 800], [0, 0, 0]);
    selector.updateView(view);
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(true);

    selector.setEnabled(false);

    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(false);

    selector.setEnabled(true);
    selector.updateView(view);
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(true);

    selector.destroy();
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(false);
  });

  it("ignores representation sets without projected-size selection metadata", () => {
    const {model, viewer, view} = createFixture();
    addLODObjects(model);
    const repSet = model.createRepSet({
      id: "manual",
      defaultRepId: "detailed",
      reps: [
        {id: "detailed", objectIds: ["source"]},
        {id: "shell", objectIds: ["shell"]}
      ]
    }).value!;

    const selector = new RepresentationLODSelector({viewer});
    setCamera(view, [0, 0, 800], [0, 0, 0]);
    selector.updateView(view);

    expect(selector.getActiveRepId(view, repSet)).toBe("detailed");
    expect(selector.getMode(view, repSet)).toBe("invalid");
    expect(viewer.lodVisibility.isSuppressed(view.id, "source")).toBe(false);
    expect(viewer.lodVisibility.isSuppressed(view.id, "shell")).toBe(false);

    selector.destroy();
  });
});

function createFixture(): {scene: Scene; model: SceneModel; viewer: Viewer; view: View} {
  const scene = new Scene();
  const model = scene.createModel({id: "model"}).value!;
  const viewer = new Viewer({scene});
  const view = createView(viewer, "view");
  setCamera(view, [0, 0, 18], [0, 0, 0]);
  return {scene, model, viewer, view};
}

function createView(viewer: Viewer, id: string): View {
  const result = viewer.createView({
    id,
    htmlElement: new FakeHTMLElement() as any
  });
  expect(result.ok).toBe(true);
  return result.value!;
}

function setCamera(view: View, eye: [number, number, number], look: [number, number, number]): void {
  view.camera.projectionType = PerspectiveProjectionType;
  view.camera.eye = eye;
  view.camera.look = look;
  view.camera.up = [0, 1, 0];
  view.camera.perspectiveProjection.near = 0.1;
  view.camera.perspectiveProjection.fov = 60;
}

function waitForScheduledTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

function addLODObjects(model: SceneModel): void {
  addBoxObject(model, "source", [-5, -5, -5], [5, 5, 5]);
  addBoxObject(model, "shell", [-5, -5, -5], [5, 5, 5]);
}

function createLODRepSet(model: SceneModel): SceneRepSet {
  const result = model.createRepSet({
    id: "hub-lod",
    defaultRepId: "detailed",
    selection: {
      strategy: "projectedSize",
      hysteresisPixels: 8
    },
    reps: [
      {
        id: "detailed",
        objectIds: ["source"],
        range: {
          minPixels: 120
        }
      },
      {
        id: "shell",
        objectIds: ["shell"],
        range: {
          maxPixels: 100
        }
      }
    ]
  });
  expect(result.ok).toBe(true);
  return result.value!;
}

function addBoxObject(
  model: SceneModel,
  id: string,
  min: [number, number, number],
  max: [number, number, number]
): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  expect(model.createGeometry({
    id: `${id}-geometry`,
    primitive: TrianglesPrimitive,
    aabb: [x0, y0, z0, x1, y1, z1],
    positions: [
      x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
      x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1
    ],
    indices: [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      1, 2, 6, 1, 6, 5,
      2, 3, 7, 2, 7, 6,
      3, 0, 4, 3, 4, 7
    ]
  }).ok).toBe(true);
  expect(model.createMesh({
    id: `${id}-mesh`,
    geometryId: `${id}-geometry`
  }).ok).toBe(true);
  expect(model.createObject({
    id,
    meshIds: [`${id}-mesh`]
  }).ok).toBe(true);
}
