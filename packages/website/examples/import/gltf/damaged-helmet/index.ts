import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample,
  fetchArrayBuffer,
  mustElement,
  mustOk,
  setStatus,
  signalExampleLoaded,
  toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const GLB_URL = "../../../../models/DamagedHelmet/gltf/model.glb";

// This GLB is authored in xeokit's default basis. Keeping the coordinate system
// explicit shows where a loader receives source-space metadata when a format or
// model needs axis, origin, unit, or scale conversion.
const GLTF_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("import/gltf/damaged-helmet", error));

async function main() {
  // Create the scene graph and Viewer. GLTFLoader will populate a SceneModel in
  // this Scene; the View below decides how that model is rendered.
  const scene = new Scene();
  const viewer = new Viewer({scene});

  // Create a PBR-oriented View before loading the model. The damaged helmet uses
  // metallic/roughness textures, so this example enables texturing, HDR IBL,
  // shadows, SAO, and ACES tonemapping up front.
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    backgroundColor: [0.02, 0.02, 0.025],
    texturing: {enabled: true},
    camera: {
      eye: [0, 5, 1.2],
      look: [0, 0, 0],
      up: [0, 0, 1]
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, mode: "aces", exposure: 1.05, sRGBEncode: true},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      shadows: {enabled: true, intensity: 0.28, direction: [-0.35, -0.45, -0.82], autoFit: true, pcfKernelSize: 2, resolution: 1024},
      bloom: {enabled: true},
      sky: {enabled: true},
      atmosphere: {enabled: false},
      depthOfField: {enabled: false}
    },
    lights: {
      ibl: {enabled: true, intensity: 0.85},
      hemispheric: {enabled: true, intensity: 0.06}
    }
  }));

  // Create the renderer. The default is WebGPU; append ?renderer=webgl to load
  // the same glTF through the WebGL renderer.
  const renderer = await createRenderer(viewer);

  // Connect navigation to renderer-backed picking so orbit and dolly gestures can
  // use the loaded helmet as their interaction target.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({
        view,
        canvasPos: pickParams.canvasPos,
        snapRadius: pickParams.snapRadius,
        snapToVertex: pickParams.snapToVertex,
        snapToEdge: pickParams.snapToEdge,
        pickInvisible: pickParams.pickInvisible,
        pickSurfaceNormal: pickParams.pickSurfaceNormal
      });
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false
  });

  // Provide a small procedural HDR studio environment to the IBL light. This is
  // what lets the helmet's PBR textures read as metal instead of flat diffuse color.
  const hdrBuffer = encodeRadianceHDR(paintStudioHDR(1024, 512), 1024, 512);
  const iblResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
  if (!iblResult.ok) {
    throw new Error(iblResult.error);
  }
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.08});
  new DirLight(view, {dir: [-0.35, -0.45, -0.82], color: [1, 0.96, 0.9], intensity: 1.2, space: "world"});

  // Fetch the GLB as bytes. GLTFLoader accepts ArrayBuffer input, including
  // binary .glb containers with embedded buffers and textures.
  setStatus("status", "Loading glTF...");
  const fileData = await fetchArrayBuffer(GLB_URL);

  // Create the SceneModel that GLTFLoader will fill. The coordinate system is
  // explicit even though this asset already matches xeokit's default scene basis.
  const sceneModel = mustOk(scene.createModel({
    id: "damagedHelmet",
    coordinateSystem: GLTF_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  // Load the glTF content into the existing SceneModel. Loader options can be
  // provided as the second argument when an application needs format-specific control.
  const loadResult = await new GLTFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model, so render directly
  // without a post-load fit pass.
  document.getElementById("status")?.style.setProperty("display", "none");
  renderer.events.onViewRendered.one(() => signalExampleLoaded());

  Object.assign(window, {
    damagedHelmetExample: {scene, viewer, view, renderer, picker, inputController, sceneModel}
  });
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
