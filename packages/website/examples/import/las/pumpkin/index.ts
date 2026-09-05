import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {LASLoader} from "@xeokit/sdk/formats/las";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {
  failExample,
  fetchArrayBuffer,
  mustElement,
  mustOk,
  signalExampleLoaded,
  toNavigationPick
} from "../../../utils/standaloneRuntime.js";

const LAZ_URL = "../../../../models/Nalls-Pumpkin-Hill/laz/model.laz";

// This is the contents of models/Nalls-Pumpkin-Hill/coordSys.json, inlined so the
// coordinate-system contract is visible in the example. The LAZ points are authored
// in this basis; SceneModel.coordinateSystem converts them into xeokit's scene basis.
const PUMPKIN_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 0, 1,
    0, 1, 0
  ],
  origin: [0, 0, 0],
  units: "meters"
};

main().catch((error) => failExample("las-pumpkin", error));

async function main() {
  // Create the model/data containers. Scene owns renderable geometry; Data owns
  // semantic model information when a loader provides it.
  const scene = new Scene();
  const data = new Data();
  const viewer = new Viewer({scene});

  // Create a View against the example canvas and tune it for point-cloud rendering.
  // The pointsMaterial options are renderer-neutral and consumed by WebGL/WebGPU.
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    effects: {
      sky: {enabled: false}
    },
    camera: {
      eye: [27.16230033378987, -11.455454610739224, 21.25759320462873],
      look: [2.457399368286133, 20.841599464416504, 1.7299499660730362],
      up: [-0.26, 0.34, 0.90],
      perspectiveProjection: {far: 10000000}
    },
    pointsMaterial: {
      pointSize: 2,
      roundPoints: true,
      perspectivePoints: true,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 5,
      filterIntensity: false,
      minIntensity: 0,
      maxIntensity: 100
    }
  }));

  // Create the renderer. This example defaults to WebGPU; append ?renderer=webgl
  // to the URL to compare the WebGL path with the same LASLoader setup.
  const renderer = await createRenderer(viewer);

  // Connect model navigation to renderer-backed picking so orbit and dolly gestures
  // can use the loaded point cloud as their navigation target.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, pickParams});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create the SceneModel with the point cloud's authored coordinate system. This is
  // the critical step for LAS/LAZ data whose axis basis differs from the scene basis.
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: PUMPKIN_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  // Create a matching DataModel when you want LASLoader to attach object metadata.
  // The LAS file has one point-cloud object, but the pattern is the same for richer data.
  const dataModel = mustOk(data.createModel({id: "demoModel"}));

  // Fetch the compressed LAZ as bytes. LASLoader accepts ArrayBuffer input and delegates
  // LAS/LAZ decoding to loaders.gl before populating the xeokit SceneModel.
  const fileData = await fetchArrayBuffer(LAZ_URL);

  // Load the points into the existing model. Loader options such as center, transform,
  // skip, fp64, colorDepth, and layerId can be passed as the second argument when needed.
  const loadResult = await new LASLoader().load({fileData, sceneModel, dataModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already positioned for this point cloud, so the loaded
  // example can render directly without a post-load camera flight or fit pass.
  renderer.events.onViewRendered.one(() => signalExampleLoaded());
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
