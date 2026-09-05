import {xkt} from "@xeokit/sdk/formats";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {createStandaloneRuntime, failExample, fetchArrayBuffer, finishExample, mustOk, setStatus} from "../../../utils/standaloneRuntime.js";

const XKT_URL = "../../../../models/XKTModel/xkt/model.xkt";
const {XKTExporter, XKTLoader} = xkt;

main().catch((error) => {
  failExample("xkt-round-trip", error);
});

async function main() {
  const data = new Data();
  const {scene, view, renderer} = await createStandaloneRuntime({
    grid: true,
    viewParams: {
      camera: {
        eye: [-30, -30, 20],
        look: [0, 0, 0],
        up: [0, 0, 1]
      }
    }
  });

  setStatus("status", "Loading source XKT...");
  const fileData = await fetchArrayBuffer(XKT_URL);

  const srcScene = new Scene();
  const srcData = new Data();
  const srcModel = mustOk(srcScene.createModel({id: "src"}));
  const srcDataModel = mustOk(srcData.createModel({id: "src"}));
  await new XKTLoader().load({fileData, sceneModel: srcModel, dataModel: srcDataModel});

  setStatus("status", "Exporting to XKT...");
  const exported = await new XKTExporter().write({sceneModel: srcModel, dataModel: srcDataModel});

  setStatus("status", "Re-importing exported XKT...");
  const sceneModel = mustOk(scene.createModel({
    id: "xktRoundTrip",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, -1] as [number, number, number, number, number, number, number, number, number],
      origin: [0, 0, 0] as [number, number, number],
      units: "meters"
    }
  }));
  const dataModel = mustOk(data.createModel({id: "xktRoundTrip"}));
  await new XKTLoader().load({fileData: exported, sceneModel, dataModel});

  // The view was created with an explicit camera for the re-imported XKT model.
  const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
  setStatus(
    "status",
    `XKT round-trip - source ${kb(fileData.byteLength)} / ${Object.keys(srcModel.objects).length} objects ` +
    `-> exported ${kb(exported.byteLength)} -> re-imported ${Object.keys(sceneModel.objects).length} objects, ` +
    `${Object.keys(sceneModel.meshes).length} meshes, ${Object.keys(dataModel.objects).length} metadata objects.`
  );
  finishExample(renderer, view);
}
