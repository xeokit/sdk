import {LinesPrimitive} from "@xeokit/sdk/base/constants";
import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {Data} from "@xeokit/sdk/model/data";
import {buildGrid} from "@xeokit/sdk/model/generation/buildGeometry";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, mustElement, mustOk, signalExampleLoaded, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const IFC_URL = "../../../../models/IfcOpenHouse2x3/ifc/model.ifc";

const IFC_OPEN_HOUSE_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const SCENE_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("view/layers/manual", error));

async function main() {
  // Scene stores shared model data; Data stores optional semantic records from the loader.
  const scene = new Scene({logging: false});
  const data = new Data();
  const viewer = new Viewer({scene, logging: false});

  // Create the View directly so the layer setup is visible in the tutorial.
  const view = mustOk(viewer.createView({
    id: "manualLayersView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    camera: {
      eye: [-19.198880324645085, 20.644412394213887, 10.270684931402508],
      look: [33.02005278082366, -35.52204955036619, -18.843578603143392],
      up: [0.2416633264296839, -0.25993204262564124, 0.9348979462355245]
    },
    effects: {
      edges: {enabled: true, useMeshColor: true, edgeWidth: 1},
      sao: {enabled: true, intensity: 0.08, scale: 0.9},
      tonemap: {enabled: true, sRGBEncode: true}
    }
  }));

  // Attach the renderer after the View exists. Use ?renderer=webgl to compare backends.
  const renderer = await createRenderer(viewer);

  // Navigation uses the active renderer for object picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true
  });

  // ViewLayers are per-View visibility buckets. SceneModels opt into a layer by ID.
  mustOk(view.createLayer({id: "modelLayer"}));
  mustOk(view.createLayer({id: "gridLayer"}));

  // Load the building into the model layer. The coordinate system is the model sidecar,
  // inlined here to show exactly what frame the IFC vertices are authored in.
  const buildingModel = mustOk(scene.createModel({
    id: "houseModel",
    layerId: "modelLayer",
    coordinateSystem: IFC_OPEN_HOUSE_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "houseModel"}));
  await new IFCLoader().load({
    fileData: await fetchArrayBuffer(IFC_URL),
    sceneModel: buildingModel,
    dataModel
  });

  // Add helper geometry as a separate SceneModel in the grid layer.
  const gridModel = mustOk(scene.createModel({
    id: "gridGroundPlane",
    layerId: "gridLayer",
    coordinateSystem: SCENE_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const grid = mustOk(buildGrid({size: 100, divisions: 100}));
  mustOk(gridModel.createGeometry({
    id: "gridGeometry",
    primitive: LinesPrimitive,
    positions: grid.positions,
    indices: grid.indices
  }));
  mustOk(gridModel.createMesh({
    id: "gridMesh",
    geometryId: "gridGeometry",
    position: [0, -5, 0],
    color: [0.4, 0.4, 0.4]
  }));
  mustOk(gridModel.createObject({id: "grid", meshIds: ["gridMesh"]}));

  signalExampleLoaded();
  window.manualLayersExample = {scene, data, viewer, view, renderer, picker, inputController, buildingModel, gridModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    const renderer = new WebGLRenderer({viewer, logging: false});
    mustOk(renderer.setInfiniteGridEnabled(true));
    return renderer;
  }
  const result = await WebGPURenderer.create({viewer, logging: false});
  if (!result.ok) {
    throw new Error(result.error);
  }
  mustOk(result.value.setInfiniteGridEnabled(true));
  return result.value;
}

