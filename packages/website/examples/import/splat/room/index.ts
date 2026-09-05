import {GaussianSplatLoader} from "@xeokit/sdk/formats/gaussiansplat";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const SPLAT_URL = "../../../../models/Train/splat/model.splat";
const SPLAT_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("splat-room", error));

async function main() {
  // Create a lean View for splat rendering. Mesh-only effects such as SAO are
  // disabled so the example stays focused on GaussianSplatLoader.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.03, 0.035, 0.04],
    camera: {
      eye: [2.5, -4.5, 2.2],
      look: [0, 0, 1],
      up: [0, 0, 1]
    },
    effects: {
      sky: {enabled: false},
      sao: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Navigation still uses picking when the renderer supports picking these objects.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // GaussianSplatLoader consumes the .splat file as binary data and stores the
  // splat primitives on a SceneModel.
  setStatus("status", "Loading Gaussian splat scene...");
  const fileData = await fetchArrayBuffer(SPLAT_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "splatRoom",
    coordinateSystem: SPLAT_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new GaussianSplatLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Splat rendering is kept lean: no grid, no sky, and no mesh-only SAO pass.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.splatRoomExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
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
