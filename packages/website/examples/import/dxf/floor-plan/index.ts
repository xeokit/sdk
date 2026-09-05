import {DXFLoader} from "@xeokit/sdk/formats/dxf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchText, finishExample, mustElement, mustOk, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const MODEL_URL = "../../../../models/FloorPlan/dxf/model.dxf";
const DXF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => {
  failExample("dxf-floor-plan", error, "info");
});

async function main() {
  // Create the scene graph and a camera looking down at the drawing extents.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      projection: "perspective",
      eye: [400, 300, 900],
      look: [400, 300, 0],
      up: [0, 1, 0]
    }
  }));
  const renderer = await createRenderer(viewer);

  // Navigation can pick the layer objects created by DXFLoader.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create the target SceneModel and parse the DXF text into renderable geometry.
  const sceneModel = mustOk(scene.createModel({id: "dxfPlan", coordinateSystem: DXF_COORDINATE_SYSTEM}));
  const fileData = await fetchText(MODEL_URL);
  const result = await new DXFLoader().load({
    fileData,
    sceneModel
  }, {
    scale: 1,
    circleSteps: 64,
    lineWidthScale: 4.0,
    minLineWidth: 1.0,
    renderText: true,
    objectIdStrategy: "layer"
  });

  // The view was created with an explicit top-down camera for the sheet extents.
  renderStats(document.getElementById("info"), mustOk(result));
  finishExample(renderer, view);

  Object.assign(window, {dxfFloorPlanExample: {scene, viewer, view, renderer, picker, inputController, sceneModel}});
}

function renderStats(infoEl: HTMLElement | null, result: any) {
  if (!infoEl) {
    return;
  }
  infoEl.innerHTML =
    `<b>DXF loaded</b><br>` +
    `${result.segmentCount.toLocaleString()} line segments<br>` +
    `${result.triangleCount.toLocaleString()} fill triangles<br>` +
    `${result.textCount.toLocaleString()} text labels<br>` +
    `${result.insertCount.toLocaleString()} INSERT block expansions<br>` +
    `${result.sceneObjectIds.length} SceneObjects (one per DXF layer)<br>` +
    `<span class="muted">parsed in-tree (no third-party DXF library)</span>`;
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
