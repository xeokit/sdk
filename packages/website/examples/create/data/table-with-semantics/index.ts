import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {
  DataModelTableSchema,
  DemoBoxGeometryId,
  createDemoBoxGeometryParams,
  createTablePartMatrix,
  createWeightHeightProperties
} from "@xeokit/website-authoring/building";
import {signalExampleLoaded, signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";
import {createExampleRenderer, createModelNavigationPickAdapter} from "../../../utils/standaloneRuntime.js";

const canvas = document.getElementById("demoCanvas") as HTMLCanvasElement;
const status = document.getElementById("status");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  const scene = new Scene({logging: true});
  const data = new Data({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "tableWithSemanticsView",
    htmlElement: canvas,
    adaptiveQuality: false,
    backgroundColor: [1, 1, 1],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [14, -14, 10],
      look: [0, 0, 3],
      up: [0, 0, 1]
    },
    effects: {
      sao: {
        enabled: true,
        intensity: 0.14,
        kernelRadius: 70,
        numSamples: 12,
        blur: true
      },
      shadows: {
        enabled: true,
        intensity: 0.58,
        bias: 0.0008,
        normalOffsetBias: 0.006,
        slopeBias: 0.0008,
        resolution: 2048,
        direction: [-0.35, -0.45, -0.82],
        autoFit: true,
        projectionSize: 18,
        lightDistance: 120,
        maxDistance: 180,
        padding: 1.2,
        cascadeCount: 4,
        cascadeSplitLambda: 0.55
      },
      sky: {
        enabled: true,
        skyColor: [0.56, 0.72, 0.92],
        horizonColor: [0.84, 0.90, 0.95],
        groundColor: [0.62, 0.64, 0.60],
        horizonBlend: 0.36,
        sunEnabled: true,
        sunDirection: [0.35, 0.45, 0.82],
        sunColor: [1, 0.94, 0.82],
        sunAngularSize: 2.5,
        sunGlowSize: 14,
        sunGlowIntensity: 0.18,
        worldUp: [0, 0, 1]
      },
      bloom: {
        enabled: true,
        threshold: 2.8,
        knee: 0.55,
        intensity: 0.08
      },
      edges: {
        enabled: false
      },
      tonemap: {
        enabled: false
      }
    }
  }));

  view.clearLights();
  new AmbientLight(view, {
    color: [1, 1, 1],
    intensity: 0.16
  });
  new DirLight(view, {
    dir: view.effects.shadows.direction,
    color: [1, 0.95, 0.86],
    intensity: 1.65,
    space: "world"
  });

  const renderer = await createExampleRenderer(viewer, {logging: true});
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });
  mustOk(renderer.setInfiniteGridEnabled(true));

  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: createModelNavigationPickAdapter(view, picker),
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 10,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 70,
    touchDollyRate: 0.16
  });

  const dataModel = mustOk(data.createModel({
    id: "demoModel",
    schema: DataModelTableSchema
  }));

  createTableSemantics(dataModel);
  const sceneModel = createTableSceneModel(scene);
  sceneModel.objects.ground.castsShadow = false;
  if (view.objects.ground) {
    view.objects.ground.castsShadow = false;
  }

  renderer.events.onViewRendered.subscribe(() => {
    if (!status) {
      return;
    }
    status.dataset.state = "ok";
    status.innerHTML =
      "<strong>WebGPU Renderer</strong>" +
      "<span>Rendering a programmatic table SceneModel with matching semantic DataModel objects.</span>";
  });

  signalExampleLoadedOnNextRender(renderer, view);

  window.addEventListener("resize", () => {
  });

  (window as any).tableWithSemanticsDemo = {
    scene,
    data,
    viewer,
    view,
    renderer,
    inputController,
    sceneModel,
    dataModel
  };
}

function createTableSemantics(dataModel) {
  dataModel.createPropertySet({
    id: "tablePropertySet",
    name: "Table properties",
    type: "BasicPropertySet",
    schema: DataModelTableSchema,
    properties: createWeightHeightProperties(5, 12)
  });

  dataModel.createPropertySet({
    id: "tableTopPropertySet",
    name: "Table top properties",
    type: "BasicPropertySet",
    schema: DataModelTableSchema,
    properties: createWeightHeightProperties(10, 3)
  });

  dataModel.createPropertySet({
    id: "tableLegPropertySet",
    name: "Table leg properties",
    type: "BasicPropertySet",
    schema: DataModelTableSchema,
    properties: createWeightHeightProperties(5, 12)
  });

  dataModel.createObject({
    id: "table",
    type: "BasicEntity",
    schema: DataModelTableSchema,
    name: "Table",
    propertySetIds: ["tablePropertySet"]
  });

  dataModel.createObject({
    id: "tableTop",
    type: "BasicEntity",
    schema: DataModelTableSchema,
    name: "Purple table top",
    propertySetIds: ["tableTopPropertySet"]
  });

  for (const [id, name] of [
    ["redLeg", "Red table leg"],
    ["greenLeg", "Green table leg"],
    ["blueLeg", "Blue table leg"],
    ["yellowLeg", "Yellow table leg"]
  ]) {
    dataModel.createObject({
      id,
      type: "BasicEntity",
      schema: DataModelTableSchema,
      name,
      propertySetIds: ["tableLegPropertySet"]
    });
  }

  mustOk(dataModel.createRelationship({
    type: "BasicAggregation",
    relatingObjectId: "table",
    relatedObjectId: "tableTop"
  }));

  for (const legId of ["redLeg", "greenLeg", "blueLeg", "yellowLeg"]) {
    mustOk(dataModel.createRelationship({
      type: "BasicAggregation",
      relatingObjectId: "tableTop",
      relatedObjectId: legId
    }));
  }
}

function createTableSceneModel(scene) {
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  }));

  mustOk(sceneModel.createGeometry(createDemoBoxGeometryParams()));

  mustOk(sceneModel.createMesh({
    id: "groundMesh",
    geometryId: DemoBoxGeometryId,
    matrix: createTablePartMatrix({
      position: [0, 0, -0.08],
      scale: [12, 12, 0.04]
    }),
    color: [0.74, 0.76, 0.72]
  }));

  mustOk(sceneModel.createObject({
    id: "ground",
    meshIds: ["groundMesh"]
  }));

  for (const leg of [
    {id: "redLeg", position: [-4, -4, 3], color: [1, 0.3, 0.3]},
    {id: "greenLeg", position: [4, -4, 3], color: [0.3, 1, 0.3]},
    {id: "blueLeg", position: [4, 4, 3], color: [0.3, 0.3, 1]},
    {id: "yellowLeg", position: [-4, 4, 3], color: [1, 1, 0]}
  ]) {
    createLeg(sceneModel, leg);
  }

  mustOk(sceneModel.createMesh({
    id: "purpleTableTopMesh",
    geometryId: DemoBoxGeometryId,
    matrix: createTablePartMatrix({
      position: [0, 0, 6],
      scale: [6, 6, 0.5]
    }),
    color: [1, 0.3, 1]
  }));

  mustOk(sceneModel.createObject({
    id: "tableTop",
    meshIds: ["purpleTableTopMesh"]
  }));

  return sceneModel;
}

function createLeg(sceneModel, params) {
  const meshId = `${params.id}Mesh`;

  mustOk(sceneModel.createMesh({
    id: meshId,
    geometryId: DemoBoxGeometryId,
    matrix: createTablePartMatrix({
      position: params.position,
      scale: [1, 1, 3]
    }),
    color: params.color
  }));

  mustOk(sceneModel.createObject({
    id: params.id,
    meshIds: [meshId]
  }));
}

function mustOk(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}

function reportError(message) {
  console.error(message);
  if (status) {
    status.dataset.state = "error";
    status.innerHTML = `<strong>Example failed</strong><span>${escapeHtml(message)}</span>`;
  }
  signalExampleLoaded();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}
