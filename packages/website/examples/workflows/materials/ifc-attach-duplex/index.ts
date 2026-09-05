import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {createExampleRenderer, failExample, finishExample, mustElement, mustOk, setStatus} from "../../../utils/standaloneRuntime.js";
import {createModelNavigationPick, IDENTITY_COORDINATE_SYSTEM, loadDataModel, loadXGFModel} from "../../../utils/workflowRuntime.js";
import {applyIFCMaterials} from "../../../../libs/studio/src/systems/applyIFCMaterials/index.ts";
// Attach procedural IFC materials to an already-loaded Duplex
// SceneModel.
//
// Loads the Duplex SceneModel + DataModel, then calls
// applyIFCMaterials to walk every SceneObject in the SceneModel,
// look up its matching DataObject by id, read the
// IFC type, and bind a procedurally-painted PBR material to all of
// the object's SceneMeshes — IfcWall → paintBrick, IfcSlab →
// paintCeramicTile, IfcWindow → paintGlass, etc. The materials and
// their three textures are added to the same SceneModel.

const MODEL_BASE = "../../../../models/Duplex";

async function main() {

  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye:  [31.38663988418555, 32.115413398051004, 14.796097980600416],
      look: [0.6121272273206806, 6.666971960818746, 2.5235511335317735],
      up:   [-0.2263867800274616, -0.18720656464184895, 0.9558779880213767]
    },
    effects: {
      tonemap: { sRGBEncode: true }
    }
  }));
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: createModelNavigationPick(view, picker)
  });

  // ── DataModel + SceneModel populated from the Duplex assets.
  //
  // The Duplex XGF file does not carry the website sidecar coordinate
  // system, so the example declares the model's metre-based identity
  // basis when it creates the SceneModel.

  const dataModel = mustOk(data.createModel({ id: "duplex" }));
  const sceneModel = mustOk(scene.createModel({
    id: "duplex",
    coordinateSystem: IDENTITY_COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  setStatus("status", "Loading Duplex...");
  await loadDataModel(`${MODEL_BASE}/datamodel/model.json`, dataModel);
  await loadXGFModel(`${MODEL_BASE}/xgf/model.xgf`, sceneModel);

  // ── Attach generation IFC materials in place. Reads each
  // SceneObject's IFC type from the DataModel and binds the
  // matching painter's textures + SceneMaterial to that object's
  // SceneMeshes. Materials and textures are added to the same
  // SceneModel.
  // applyIFCMaterials is async — texture generation streams
  // through the progress reporter. Await the result so the
  // SDKResult check sees a resolved value (without await, the
  // returned Promise's `.ok` is undefined and the throw fires
  // every time, killing the createView call that follows).
  const attachResult = await applyIFCMaterials({
    sceneModel,
    dataModel,
    textureSize: 256
  });
  if (!attachResult.ok) throw new Error(attachResult.error);

  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
}

main().catch((error) => failExample("workflows/materials/ifc-attach-duplex", error));
