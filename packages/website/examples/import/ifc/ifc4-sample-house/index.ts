import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const IFC_URL = "../../../../models/Ifc4_SampleHouse/ifc/model.ifc";
const IFC_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("ifc4-sample-house", error));

async function main() {
  // SceneModel receives renderable IFC geometry; DataModel receives object and
  // property metadata emitted by IFCLoader.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    camera: {
      eye: [-13.141660030273833, 3.4311164539069736, 2.7685643611972126],
      look: [-7.672335979800191, 0.2209277473205562, 1.1672576240406844],
      up: [0.2111338689358516, -0.12392382975193127, 0.9695696848642663]
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, mode: "aces", exposure: 0.55, sRGBEncode: true}
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect navigation to renderer-backed IFC object picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create the target xeokit models before loading so coordinate-system and
  // lifecycle policy are explicit at the API boundary.
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: IFC_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "demoModel"}));

  // Fetch the IFC bytes and pass them to IFCLoader along with both target models.
  setStatus("status", "Loading IFC4 sample house...");
  const fileData = await fetchArrayBuffer(IFC_URL);
  const loadResult = await new IFCLoader().load({fileData, sceneModel, dataModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.ifc4SampleHouseExample = {scene, viewer, view, renderer, picker, inputController, data, sceneModel, dataModel};
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
