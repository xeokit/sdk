import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const GLB_URL = "../../../../models/BigSquareCommercialBuilding/gltf/model.glb";

const GLTF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("import/gltf/big-square-commercial-building", error));

async function main() {
  // Create the SDK scene graph and the View that renders it.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    backgroundColor: [0.85, 0.89, 0.93],
    texturing: {enabled: true},
    camera: {
      eye: [20, 15, 14],
      look: [0, 0, 0],
      up: [0, 0, 1],
      perspectiveProjection: {near: 0.01, far: 10000}
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, mode: "aces", exposure: 0.35, sRGBEncode: true},
      atmosphere: {enabled: false},
      depthOfField: {enabled: false}
    }
  }));

  // Create the renderer selected by ?renderer=webgl or default to WebGPU.
  const renderer = await createRenderer(viewer);

  // Use simple direct lighting for this large building model.
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.22});
  new DirLight(view, {dir: [-0.42, -0.55, -0.72], color: [1, 0.96, 0.88], intensity: 1.65, space: "world"});

  // Model navigation uses renderer-backed picking for orbit targets and double-pick.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false
  });

  // GLB is a binary glTF container, so fetch it as bytes.
  setStatus("status", "Loading glTF...");
  const fileData = await fetchArrayBuffer(GLB_URL);

  // Create the SceneModel with the source coordinate system before loading.
  const sceneModel = mustOk(scene.createModel({
    id: "BigSquareCommercialBuilding",
    coordinateSystem: GLTF_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  // Load the glTF data into the existing SceneModel.
  const loadResult = await new GLTFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);

  Object.assign(window, {bigSquareCommercialBuildingExample: {scene, viewer, view, renderer, picker, inputController, sceneModel}});
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return configureExampleRenderer(viewer, new WebGLRenderer({viewer}));
  }
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return configureExampleRenderer(viewer, result.value);
}
