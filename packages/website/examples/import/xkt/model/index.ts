import {xkt} from "@xeokit/sdk/formats";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const XKT_URL = "../../../../models/XKTModel/xkt/model.xkt";
const XKT_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, -1],
  origin: [0, 0, 0],
  units: "meters"
};

main().catch((error) => failExample("xkt-model", error));

async function main() {
  // XKT can carry both renderable SceneModel content and optional DataModel
  // metadata; this example creates both targets before loading.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    camera: {
      eye: [-30, -30, 20],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect model navigation to renderer-backed picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // The coordinate system is specified at SceneModel creation because XKT
  // geometry is decoded directly into that model.
  const sceneModel = mustOk(scene.createModel({
    id: "xktModel",
    coordinateSystem: XKT_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "xktModel"}));

  // Fetch the XKT bytes and load them into the prepared models.
  setStatus("status", "Loading XKT model...");
  const fileData = await fetchArrayBuffer(XKT_URL);
  const loadResult = await new xkt.XKTLoader().load({fileData, sceneModel, dataModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.xktModelExample = {scene, viewer, view, renderer, picker, inputController, data, sceneModel, dataModel};
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
