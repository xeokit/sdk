import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const TILESET_URL = "../../../../models/ThreeDTilesExamples/PointCloud/tileset.json";
const BASE_URI = "../../../../models/ThreeDTilesExamples/PointCloud/";
const METADATA_URL = "../../../../models/ThreeDTilesExamples/PointCloud/metadata.json";
const TILESET_COORDINATE_SYSTEM = {basis: [1, 0, 0, 0, 0, 1, 0, 1, 0], origin: [0, 0, 0], units: "meters", scaleToMeters: 1};

main().catch((error) => failExample("threedtiles-point-cloud", error));

async function main() {
  // Create a point-cloud-oriented View. Mesh post effects are disabled, while
  // pointsMaterial controls the point rasterization used by both renderers.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {eye: [7, -8, 6], look: [0, 0, 1.4], up: [0, 0, 1]},
    effects: {sky: {enabled: false}, sao: {enabled: false}, edges: {enabled: false}},
    pointsMaterial: {
      pointSize: 2,
      roundPoints: true,
      perspectivePoints: true,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 5
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {pick: (_view, pickParams) => {
    const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
    return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
  }});
  // Fetch sidecar metadata for the caption separately from the runtime tileset.
  const metadata = await fetchJSON(METADATA_URL);

  // Point positions are already in Z-up tile space, so the SceneModel uses the
  // tileset coordinate system directly. Mesh post effects stay disabled; the
  // grid provides a world-space reference plane for the loaded points.
  setStatus("status", "Loading point-cloud 3D Tiles...");
  const fileData = await fetchJSON(TILESET_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "pointCloud3DTiles",
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new ThreeDTilesLoader().load({fileData, sceneModel}, {
    baseUri: new URL(BASE_URI, window.location.href).toString()
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Use loader statistics after load to report what the PNTS payload produced.
  setStatus("status", `PNTS loaded: ${sceneModel.stats.numPoints.toLocaleString()} points from ${metadata.source}.`);
  finishExample(renderer, view);
  window.threeDTilesPointCloudExample = {scene, viewer, view, renderer, picker, inputController, sceneModel, metadata};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") return new WebGLRenderer({viewer});
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
