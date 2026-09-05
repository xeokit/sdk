import {FBXLoader} from "@xeokit/sdk/formats/fbx";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const FBX_URL = "../../../../models/E3D_Plant/fbx/model.fbx";
const FBX_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0] as [number, number, number, number, number, number, number, number, number],
  origin: [0, 0, 0] as [number, number, number],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => {
  failExample("fbx-e3d-plant", error);
});

async function main() {
  // Create the scene graph and an initial camera for the plant assembly.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye: [-300.45928353964246, 258.25925259779626, 124.00350940239844],
      look: [-302.12662024198926, 301.5614529151791, 106.08332812798437],
      up: [-0.014703546021141807, 0.3818640120771069, 0.9241015539510684]
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect navigation to renderer picking for the FBX objects.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Fetch the FBX bytes and create the target SceneModel with the source basis.
  setStatus("status", "Loading FBX...");
  const fileData = await fetchArrayBuffer(FBX_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "fbxSample",
    coordinateSystem: FBX_COORDINATE_SYSTEM
  }));

  // Load the FBX content into the existing SceneModel.
  const loadResult = await new FBXLoader().load({
    fileData,
    sceneModel
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  console.log(
    `[FBX] loaded ${Object.keys(sceneModel.objects).length} objects, ` +
    `${Object.keys(sceneModel.meshes).length} meshes, ` +
    `${Object.keys(sceneModel.geometries).length} geometries`
  );

  // The view was created with an explicit camera for the plant assembly.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);

  Object.assign(window, {fbxPlantExample: {scene, viewer, view, renderer, picker, inputController, sceneModel}});
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return new WebGLRenderer({viewer});
  }
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
