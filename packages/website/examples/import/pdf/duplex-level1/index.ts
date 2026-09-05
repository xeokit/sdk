import {PDFLoader} from "@xeokit/sdk/formats/pdf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";
import {buildLevelOnePlanPdf} from "./duplexLevel1Pdf.js";

const PDF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("pdf-duplex-level1", error));

async function main() {
  const cx = 5.25;
  const cy = 7.0;
  // Create the scene graph and a top-down camera for the generated PDF plan.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    backgroundColorFromAmbientLight: false,
    camera: {
      projection: "perspective",
      eye: [cx, cy, 22],
      look: [cx, cy, 0],
      up: [0, 1, 0]
    },
    effects: {
      sky: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Connect navigation to the generated PDF vector geometry.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Build a PDF in memory, then let PDFLoader parse it into this SceneModel.
  const sceneModel = mustOk(scene.createModel({id: "duplexLevel1Plan", coordinateSystem: PDF_COORDINATE_SYSTEM}));
  setStatus("status", "Loading Duplex Level 1 PDF...");
  const result = await new PDFLoader().load({fileData: buildLevelOnePlanPdf(), sceneModel}, {
    scale: 0.001,
    bezierSteps: 16,
    lineWidthScale: 0.6,
    minLineWidth: 1.0,
    renderFills: true,
    renderText: false
  });
  if (result.ok === false) {
    throw new Error(result.error);
  }
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.pdfDuplexLevel1Example = {scene, viewer, view, renderer, picker, inputController, sceneModel, pages: result.value.pages};
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
