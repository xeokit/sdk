import {PDFLoader} from "@xeokit/sdk/formats/pdf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const PDF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("pdf-import-panel", error));

async function main() {
  // Create an empty PDF import workspace. Dropped files will each become a new
  // SceneModel populated by PDFLoader.
  const canvas = mustElement("demoCanvas");
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: canvas,
    backgroundColor: [1, 1, 1],
    backgroundColorFromAmbientLight: false,
    camera: {
      projection: "perspective",
      eye: [0, 0, 1500],
      look: [0, 0, 0],
      up: [0, 1, 0]
    },
    effects: {
      sky: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Navigation picks whichever PDF geometry has been loaded into the scene.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  installDropImport(canvas, scene, view, renderer);
  setStatus("status", "Drop a PDF onto the canvas.");
  finishExample(renderer, view);
  window.pdfImportPanelExample = {scene, viewer, view, renderer, picker, inputController};
}

function installDropImport(canvas, scene, view, renderer) {
  canvas.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  canvas.addEventListener("drop", async (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    try {
      setStatus("status", `Loading ${file.name}...`);
      // Each dropped PDF gets its own SceneModel, which keeps repeated imports
      // independent and makes model lifecycle explicit.
      const sceneModel = mustOk(scene.createModel({id: `pdf-${Date.now()}`, coordinateSystem: PDF_COORDINATE_SYSTEM}));
      const result = await new PDFLoader().load({fileData: await file.arrayBuffer(), sceneModel}, {
        scale: 1,
        renderFills: true,
        renderImages: true,
        renderText: true
      });
      if (result.ok === false) {
        throw new Error(result.error);
      }
      finishExample(renderer, view);
    } catch (error) {
      failExample("pdf-import-panel", error);
    }
  });
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
