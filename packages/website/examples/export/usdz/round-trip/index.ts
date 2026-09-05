import {USDZExporter, USDZLoader} from "@xeokit/sdk/formats/usdz";
import {createStandaloneRuntime, failExample, fetchArrayBuffer, finishExample, mustOk, setStatus} from "../../../utils/standaloneRuntime.js";

const USDZ_URL = "../../../../models/ResidentialBuilding/usdz/model.usdz";
const COORD = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1] as [number, number, number, number, number, number, number, number, number],
  origin: [0, 0, 0] as [number, number, number],
  units: "meters" as const,
  scaleToMeters: 1
};

main().catch((error) => {
  failExample("usdz-round-trip", error);
});

async function main() {
  const {scene, view, renderer} = await createStandaloneRuntime({
    grid: true,
    viewParams: {
      camera: {
        eye: [20, 15, 20],
        look: [0, 0, 0],
        up: [0, 0, 1]
      }
    }
  });

  const counts = (model) => ({
    objects: Object.keys(model.objects).length,
    meshes: Object.keys(model.meshes).length,
    geometries: Object.keys(model.geometries).length
  });

  setStatus("status", "Loading original USDZ...");
  const fileData = await fetchArrayBuffer(USDZ_URL);

  const original = mustOk(scene.createModel({id: "usdzOriginal", coordinateSystem: COORD}));
  await new USDZLoader().load({fileData, sceneModel: original});
  const origCounts = counts(original);

  setStatus("status", "Re-exporting USDZ...");
  const exported = await new USDZExporter().write({sceneModel: original});
  original.destroy();

  setStatus("status", "Re-loading exported USDZ...");
  const roundTrip = mustOk(scene.createModel({id: "usdzRoundTrip", coordinateSystem: COORD}));
  await new USDZLoader().load({fileData: exported, sceneModel: roundTrip});
  const rtCounts = counts(roundTrip);

  console.log(
    `[USDZ round-trip] exported ${exported.byteLength} bytes\n` +
    `  original   : ${JSON.stringify(origCounts)}\n` +
    `  round-trip : ${JSON.stringify(rtCounts)}`
  );

  // The view was created with an explicit camera for the reloaded USDZ model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
}
