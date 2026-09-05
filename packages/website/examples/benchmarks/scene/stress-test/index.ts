import {SDKTask} from "@xeokit/sdk/base/core";
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {finishExample, mustElement, mustOk, toNavigationPick, createExampleRenderer} from "../../../utils/standaloneRuntime.js";

const OFFSET = 250;
const STRESS_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => console.error(error));

async function main() {
  // This benchmark is intentionally simple and explicit: one dynamic SceneModel
  // receives geometry churn while the View and renderer are created here.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      perspectiveProjection: {far: 100000},
      eye: [OFFSET, -450, 300],
      look: [OFFSET, 0, 0],
      up: [0, 0, 1]
    },
    effects: {
      sky: {enabled: true},
      sao: {enabled: false},
      shadows: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: STRESS_COORDINATE_SYSTEM,
    updateHint: "dynamic"
  }));
  let i = 0;
  const dequeue = [];

  function createObject() {
    mustOk(sceneModel.createGeometry({
      id: `demoBoxGeometry${i}`,
      primitive: TrianglesPrimitive,
      positions: [
        1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
        -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
        -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
      ],
      indices: [
        0, 1, 2, 0, 2, 3,
        4, 5, 6, 4, 6, 7,
        8, 9, 10, 8, 10, 11,
        12, 13, 14, 12, 14, 15,
        16, 17, 18, 16, 18, 19,
        20, 21, 22, 20, 22, 23
      ]
    }));
    const mesh = mustOk(sceneModel.createMesh({
      id: `redLegMesh${i}`,
      geometryId: `demoBoxGeometry${i}`,
      matrix: buildMat4({
        position: [OFFSET + Math.random() * 200 - 100, Math.random() * 200 - 100, Math.random() * 200 - 100],
        scale: [2, 2, 2]
      }),
      color: [Math.random(), Math.random(), Math.random()]
    }));
    const object = mustOk(sceneModel.createObject({id: `redLeg${i}`, meshIds: [mesh.id]}));
    dequeue.push(object);
    if (dequeue.length > 1000) {
      const oldObject = dequeue.shift();
      oldObject.destroy();
      for (const oldMesh of oldObject.meshes) {
        oldMesh.destroy();
      }
    }
    i++;
  }

  new SDKTask({
    name: "Stress test - create and retire boxes",
    repeat: true,
    stage: SDKTask.CollectInputStage,
    task: () => {
      for (let j = 0; j < 50; j++) {
        createObject();
      }
      view.camera.orbitYaw(0.2);
      view.camera.orbitPitch(0.1);
    }
  });

  finishExample(renderer, view);
  window.stressTestBenchmark = {scene, viewer, view, renderer, picker, inputController, sceneModel};
}
