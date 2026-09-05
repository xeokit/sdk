import {CityJSONExporter, CityJSONLoader} from "@xeokit/sdk/formats/cityjson";
import {Data} from "@xeokit/sdk/model/data";
import {createStandaloneRuntime, failExample, fetchJSON, finishExample, mustOk, setStatus} from "../../../utils/standaloneRuntime.js";

const CITYJSON_URL = "../../../../models/LoD3_Railway/cityjson/model.json";

main().catch((error) => {
  failExample("cityjson-round-trip", error);
});

async function main() {
  const data = new Data();
  const {scene, view, renderer} = await createStandaloneRuntime({
    grid: true,
    viewParams: {
      id: "demoView",
      camera: {
        eye: [11.50, 16.32, 15.12],
        look: [9.01, 9.65, 11.22],
        up: [0, 0, 1]
      }
    }
  });

  const counts = (model) => ({
    objects: Object.keys(model.objects).length,
    meshes: Object.keys(model.meshes).length,
    geometries: Object.keys(model.geometries).length
  });

  setStatus("status", "Loading original CityJSON...");
  const fileData = await fetchJSON(CITYJSON_URL);

  const originalScene = mustOk(scene.createModel({id: "cityjsonOriginal"}));
  const originalData = mustOk(data.createModel({id: "cityjsonOriginal"}));
  await new CityJSONLoader().load({
    fileData,
    sceneModel: originalScene,
    dataModel: originalData
  });
  const origCounts = counts(originalScene);

  setStatus("status", "Re-exporting CityJSON...");
  const exported = await new CityJSONExporter().write({
    sceneModel: originalScene,
    dataModel: originalData
  });

  originalScene.destroy();
  originalData.destroy();

  setStatus("status", "Re-loading exported CityJSON...");
  const roundTripScene = mustOk(scene.createModel({id: "cityjsonRoundTrip"}));
  const roundTripData = mustOk(data.createModel({id: "cityjsonRoundTrip"}));
  await new CityJSONLoader().load({
    fileData: exported,
    sceneModel: roundTripScene,
    dataModel: roundTripData
  });
  const rtCounts = counts(roundTripScene);

  console.log(
    `[CityJSON round-trip] exported ${Object.keys(exported.CityObjects).length} city objects, ` +
    `${exported.vertices.length} shared vertices\n` +
    `  original   : ${JSON.stringify(origCounts)}\n` +
    `  round-trip : ${JSON.stringify(rtCounts)}`
  );

  // The view was created with an explicit camera, so the reloaded CityJSON
  // renders from a stable instructional starting position.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
}
