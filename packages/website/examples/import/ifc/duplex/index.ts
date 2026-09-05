import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {Data, searchObjects} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const IFC_URL = "../../../../models/Duplex/ifc/model.ifc";
const IFC_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("ifc-duplex", error));

async function main() {
  // SceneModel receives renderable IFC geometry; DataModel receives the IFC
  // object tree and property data used by searchObjects below.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    camera: {
      eye: [24.40, 23.70, 27.04],
      look: [4.39, 8.90, 2.54],
      up: [-0.56, -0.41, 0.71]
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, mode: "aces", exposure: 0.55, sRGBEncode: true},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      bloom: {enabled: true}
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect navigation to object picking before the IFC model is loaded.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // The Duplex IFC is authored in a Z-up, meter-based coordinate system. Passing
  // that basis when creating the SceneModel makes the loader's geometry land in
  // xeokit's scene coordinate system.
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: IFC_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "demoModel"}));

  // IFCLoader accepts the IFC file as an ArrayBuffer and populates both models.
  setStatus("status", "Loading Duplex IFC...");
  const fileData = await fetchArrayBuffer(IFC_URL);
  const loadResult = await new IFCLoader().load({fileData, sceneModel, dataModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Search semantic IFC data after load and put the matched objects into a style
  // bin to demonstrate using DataModel metadata with View state.
  const resultObjectIds: string[] = [];
  const result = searchObjects(data, {
    startObjectId: "1xS3BCk291UvhgP2a6eflK",
    includeObjects: ["IfcFurnishingElement"],
    includeRelated: ["IfcRelAggregates"],
    resultObjectIds
  });
  if (result.ok && resultObjectIds.length) {
    view.setObjectsInStyleBin("selected", resultObjectIds, true);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.ifcDuplexExample = {scene, viewer, view, renderer, picker, inputController, data, sceneModel, dataModel};
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
