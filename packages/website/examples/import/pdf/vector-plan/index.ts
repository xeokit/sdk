import {PDFLoader} from "@xeokit/sdk/formats/pdf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const PDF_URL = "../../../../models/ArchDrawing/pdf/model.pdf";
const PDF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("pdf-vector-plan", error));

async function main() {
  // Create a View for a 2D PDF drawing, with sky/grid effects disabled.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    backgroundColorFromAmbientLight: false,
    camera: {
      projection: "perspective",
      eye: [400, 320, 1100],
      look: [400, 320, 0],
      up: [0, 1, 0]
    },
    effects: {
      sky: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Connect navigation to vector geometry created by PDFLoader.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // PDFLoader writes the parsed page geometry into an existing SceneModel.
  const sceneModel = mustOk(scene.createModel({id: "vectorPlan", coordinateSystem: PDF_COORDINATE_SYSTEM}));
  setStatus("status", "Loading vector PDF...");
  const result = await new PDFLoader().load({fileData: await fetchArrayBuffer(PDF_URL), sceneModel}, {
    scale: 1,
    bezierSteps: 20,
    lineWidthScale: 1.4,
    minLineWidth: 1.0,
    renderFills: false,
    renderImages: true,
    renderText: false
  });
  if (result.ok === false) {
    throw new Error(result.error);
  }
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.pdfVectorPlanExample = {scene, viewer, view, renderer, picker, inputController, sceneModel, pages: result.value.pages};
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
