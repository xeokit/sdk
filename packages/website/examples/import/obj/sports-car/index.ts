import {MTLLoader} from "@xeokit/sdk/formats/mtl";
import {OBJLoader} from "@xeokit/sdk/formats/obj";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchText, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const OBJ_URL = "../../../../models/SportsCar/obj/model.obj";
const MTL_URL = "../../../../models/SportsCar/mtl/model.mtl";
const OBJ_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("obj-sports-car", error));

async function main() {
  // Create the scene graph and a View with light effects for the materialized OBJ.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    camera: {
      eye: [3.27, 3.91, 2.39],
      look: [0, 0, 0],
      up: [-0.18, -0.28, 0.93]
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, mode: "aces", exposure: 0.55, sRGBEncode: true},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      bloom: {enabled: false}
    },
    lights: {
      ibl: {enabled: true, intensity: 0.65},
      hemispheric: {enabled: true, intensity: 0.35}
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect orbit navigation to renderer-backed picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create the target SceneModel in the OBJ's authored coordinate system.
  const sceneModel = mustOk(scene.createModel({
    id: "sportsCarObj",
    coordinateSystem: OBJ_COORDINATE_SYSTEM,
    updateHint: "dynamic"
  }));

  // Load the MTL first so OBJLoader can bind parsed material definitions.
  setStatus("status", "Loading OBJ sports car...");
  const materialResult = await new MTLLoader().load({fileData: await fetchText(MTL_URL), sceneModel});
  if (materialResult && materialResult.ok === false) {
    throw new Error(materialResult.error);
  }
  const geometryResult = await new OBJLoader().load({fileData: await fetchText(OBJ_URL), sceneModel});
  if (geometryResult && geometryResult.ok === false) {
    throw new Error(geometryResult.error);
  }

  // Style bins can be applied after load to demonstrate renderer-neutral object state.
  view.setObjectsInStyleBin("xrayed", view.objectIds.slice(30, 40), true);
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.objSportsCarExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
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
