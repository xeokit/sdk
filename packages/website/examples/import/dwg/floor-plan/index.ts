import {DWGLoader} from "@xeokit/sdk/formats/dwg";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const MODEL_URL = "../../../../models/FloorPlan/dwg/model.dwg";
const FLOOR_PLAN_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0] as [number, number, number, number, number, number, number, number, number],
  origin: [0, 0, 0] as [number, number, number],
  units: "meters"
};

main().catch((error) => {
  failExample("dwg-floor-plan", error, "info");
});

async function main() {
  // Create the scene graph and an explicit top-down sheet camera.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      projection: "perspective",
      eye: [0, 0, 1000],
      look: [0, 0, 0],
      up: [0, 1, 0]
    }
  }));
  const renderer = await createRenderer(viewer);

  // Renderer-backed picking gives navigation a target once the DWG layers load.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  const infoEl = document.getElementById("info");

  // Create the SceneModel with the floor-plan coordinate system. DWG layers
  // become xeokit objects according to the loader's objectIdStrategy option.
  const sceneModel = mustOk(scene.createModel({
    id: "FloorPlanDWG",
    coordinateSystem: FLOOR_PLAN_COORDINATE_SYSTEM
  }));

  // Fetch the DWG bytes and parse vector entities into line/fill/text geometry.
  const fileData = await fetchArrayBuffer(MODEL_URL);

  infoEl?.replaceChildren(`Parsing ${(fileData.byteLength / 1024).toFixed(0)} KB of DWG...`);
  const result = await new DWGLoader().load({
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
  renderStats(infoEl, "FloorPlan DWG loaded", mustOk(result), "parsed by @mlightcad/libredwg-web (GPL-3.0)");
  finishExample(renderer, view);

  Object.assign(window, {dwgFloorPlanExample: {scene, viewer, view, renderer, picker, inputController, sceneModel}});
}

function renderStats(infoEl: HTMLElement | null, title: string, result: any, footer: string) {
  if (!infoEl) {
    return;
  }
  const count = (value: unknown) => (typeof value === "number" ? value : 0).toLocaleString();
  infoEl.innerHTML =
    `<b>${title}</b><br>` +
    `${count(result.segmentCount)} line segments<br>` +
    `${count(result.triangleCount)} fill triangles<br>` +
    `${count(result.textCount)} text labels<br>` +
    `${count(result.insertCount)} INSERT block expansions<br>` +
    `${result.sceneObjectIds.length} SceneObjects (one per DWG layer)<br>` +
    `<span class="muted">${footer}</span>`;
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
