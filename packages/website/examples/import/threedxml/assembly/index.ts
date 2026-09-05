import {ThreeDXMLLoader} from "@xeokit/sdk/formats/threedxml";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const THREEDXML_URL = "../../../../models/3DPreview/threedxml/model.3dxml";
const THREEDXML_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0] as [number, number, number, number, number, number, number, number, number],
  origin: [0, 0, 0] as [number, number, number],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("threedxml-assembly", error));

async function main() {
  // Create the scene graph and camera before loading the 3DXML package.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    camera: {
      eye: [80, 80, 80],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect navigation to the assembly geometry via renderer picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // 3DXML is loaded from binary package bytes into a SceneModel. The Y-up basis
  // is specified here because this asset is authored outside xeokit's Z-up basis.
  setStatus("status", "Loading 3DXML assembly...");
  const fileData = await fetchArrayBuffer(THREEDXML_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "3DPreview",
    coordinateSystem: THREEDXML_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new ThreeDXMLLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this assembly.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.threeDXMLAssemblyExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
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
