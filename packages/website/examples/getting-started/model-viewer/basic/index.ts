import {DataModelImporter} from "@xeokit/sdk/formats/datamodel";
import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {SceneModelImporter} from "@xeokit/sdk/formats/scenemodel";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, fetchJSON, finishExample, fitViewToScene, mustElement, mustOk, toNavigationPick, createExampleRenderer} from "../../../utils/standaloneRuntime.js";

const MODELS_DIR = "../../../../models";
const DEFAULT_MODEL_ID = "FM_LFT";
const DEFAULT_FORMATS = ["xgf"];
const FORMAT_EXTENSIONS = {
  datamodel: "json",
  gltf: "glb",
  ifc: "ifc",
  scenemodel: "json",
  xgf: "xgf"
};

const params = new URLSearchParams(window.location.search);
const modelId = params.get("modelId") || DEFAULT_MODEL_ID;
const formats = (params.get("format") || DEFAULT_FORMATS.join(","))
  .split(",")
  .map((format) => format.trim())
  .filter(Boolean);

main().catch((error) => {
  document.title = `Failed to load ${modelId} (${formats.join(", ")})`;
  failExample("getting-started-model-viewer-basic", error);
});

async function main() {
  // Standalone setup: this small viewer owns its Scene/Data, View, renderer, and
  // model navigation controller instead of going through Studio.
  const scene = new Scene({logging: false});
  const data = new Data({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "modelView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye: [-3.23, -3.49, 2.58],
      look: [-0.03, 0.05, 0.5],
      up: [0.26, 0.29, 0.91]
    },
    effects: {
      sky: {enabled: true},
      sao: {enabled: false},
      shadows: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  document.title = `Loading ${modelId} (${formats.join(", ")})`;
  const coordinateSystem = await loadCoordinateSystem(modelId);
  const sceneModel = mustOk(scene.createModel({
    id: modelId,
    // The website catalog stores each model's authored coordinate frame beside
    // the model. Passing it here keeps arbitrary query-param models upright.
    coordinateSystem,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: modelId}));

  for (const format of formats) {
    await loadFormat({format, modelId, sceneModel, dataModel});
  }

  fitViewToScene(view);
  finishExample(renderer, view);
  document.title = `${modelId} (${formats.join(", ")})`;
  window.basicModelViewerExample = {scene, data, viewer, view, renderer, picker, inputController, sceneModel, dataModel};
}

async function loadFormat({format, modelId, sceneModel, dataModel}) {
  const src = await resolveModelUrl(modelId, format);
  if (format === "datamodel") {
    await new DataModelImporter().load({fileData: await fetchJSON(src), dataModel});
    return;
  }
  if (format === "scenemodel") {
    await new SceneModelImporter().load({fileData: await fetchJSON(src), sceneModel});
    return;
  }
  if (format === "gltf") {
    const fileData = await fetchArrayBuffer(src);
    const result = await new GLTFLoader().load({fileData, sceneModel, dataModel}, {
      baseUri: new URL(".", new URL(src, window.location.href)).href,
      yieldIntervalMs: 60
    });
    mustOk(result);
    return;
  }
  if (format === "ifc") {
    const result = await new IFCLoader().load({fileData: await fetchArrayBuffer(src), sceneModel, dataModel}, {
      yieldIntervalMs: 60
    });
    mustOk(result);
    return;
  }
  if (format === "xgf") {
    const result = await new XGFLoader().load({fileData: await fetchArrayBuffer(src), sceneModel, dataModel}, {
      yieldIntervalMs: 60
    });
    mustOk(result);
    return;
  }
  throw new Error(`Unsupported model format '${format}'`);
}

async function resolveModelUrl(modelId, format) {
  const ext = FORMAT_EXTENSIONS[format];
  if (!ext) {
    throw new Error(`Unsupported model format '${format}'`);
  }
  const optimized = await loadOptimizedFormats(modelId);
  const fileName = optimized.has(format) ? `model.optimized.${ext}` : `model.${ext}`;
  return `${MODELS_DIR}/${modelId}/${format}/${fileName}`;
}

async function loadOptimizedFormats(modelId) {
  try {
    const catalog = await fetchJSON(`${MODELS_DIR}/index.json`);
    return new Set(catalog?.[modelId]?.optimized || []);
  } catch {
    return new Set();
  }
}

async function loadCoordinateSystem(modelId) {
  try {
    return await fetchJSON(`${MODELS_DIR}/${modelId}/coordSys.json`);
  } catch {
    return undefined;
  }
}
