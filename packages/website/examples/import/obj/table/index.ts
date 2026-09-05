import {MTLLoader} from "@xeokit/sdk/formats/mtl";
import {OBJLoader} from "@xeokit/sdk/formats/obj";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchText, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const OBJ_URL = "../../../../models/Table/obj/model.obj";
const MTL_URL = "../../../../models/Table/mtl/model.mtl";
const OBJ_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1] as [number, number, number, number, number, number, number, number, number],
  origin: [0, 0, 0] as [number, number, number],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("obj-table", error));

async function main() {
  // Create the scene, View, and renderer explicitly for this OBJ/MTL pair.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    camera: {
      eye: [13, -15, 7],
      look: [0, 0, -5],
      up: [0, 0, 1]
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, mode: "aces", exposure: 0.55, sRGBEncode: true},
      sao: {enabled: true, intensity: 0.08, scale: 0.8}
    },
    lights: {
      ibl: {enabled: true, intensity: 0.65},
      hemispheric: {enabled: true, intensity: 0.35}
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect navigation to the OBJ geometry after it loads.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // The table OBJ is Y-up; the identity model basis lets xeokit convert it
  // into the Viewer's default Z-up scene coordinates.
  const sceneModel = mustOk(scene.createModel({
    id: "tableObj",
    coordinateSystem: OBJ_COORDINATE_SYSTEM
  }));
  setStatus("status", "Loading OBJ table...");
  const materialResult = await new MTLLoader().load({fileData: await fetchText(MTL_URL), sceneModel});
  if (materialResult && materialResult.ok === false) {
    throw new Error(materialResult.error);
  }
  const geometryResult = await new OBJLoader().load({fileData: await fetchText(OBJ_URL), sceneModel});
  if (geometryResult && geometryResult.ok === false) {
    throw new Error(geometryResult.error);
  }
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.objTableExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
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
