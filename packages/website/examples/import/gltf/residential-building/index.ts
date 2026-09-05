import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const GLB_URL = "../../../../models/ResidentialBuilding/gltf/model.glb";

const GLTF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("import/gltf/residential-building", error));

async function main() {
  // Create the scene graph, View, and renderer before loading the GLB.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.85, 0.89, 0.93],
    texturing: {enabled: true},
    camera: {
      eye: [1050, -1350, 980],
      look: [-30, -2, 470],
      up: [0, 0, 1],
      perspectiveProjection: {far: 5000}
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, mode: "aces", exposure: 0.9, sRGBEncode: true},
      shadows: {enabled: true, intensity: 0.32, direction: [-0.42, -0.52, -0.74], autoFit: true, resolution: 1024, pcfKernelSize: 1},
      sao: {enabled: true, intensity: 0.08, scale: 0.8}
    }
  }));
  const renderer = await createRenderer(viewer);

  // This textured building benefits from shadows and SAO without the heavier IBL path.
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.24});
  new DirLight(view, {dir: [-0.42, -0.52, -0.74], color: [1, 0.96, 0.88], intensity: 1.35, space: "world"});

  // Connect navigation to renderer picking so interaction follows the loaded model.
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

  // Fetch the GLB bytes, then load them into an explicitly created SceneModel.
  setStatus("status", "Loading glTF...");
  const fileData = await fetchArrayBuffer(GLB_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "residentialBuilding",
    coordinateSystem: GLTF_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new GLTFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);

  Object.assign(window, {residentialBuildingExample: {scene, viewer, view, renderer, picker, inputController, sceneModel}});
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
