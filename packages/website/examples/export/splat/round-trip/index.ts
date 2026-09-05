import {GaussianSplatExporter, GaussianSplatLoader} from "@xeokit/sdk/formats/gaussiansplat";
import {createStandaloneRuntime, failExample, fetchArrayBuffer, finishExample, mustOk, setStatus} from "../../../utils/standaloneRuntime.js";

const SPLAT_URL = "../../../../models/Train/splat/model.splat";

main().catch((error) => {
  failExample("splat-round-trip", error);
});

async function main() {
  const {scene, view, renderer} = await createStandaloneRuntime({
    grid: false,
    viewParams: {
      camera: {
        eye: [0, 0, 4],
        look: [0, 0, 0],
        up: [0, 1, 0]
      }
    }
  });

  const splatCount = (model) =>
    Object.values(model.geometries).reduce<number>((count, geometry: any) => count + geometry.positionsCompressed.length / 3, 0);

  setStatus("status", "Loading original .splat...");
  const fileData = await fetchArrayBuffer(SPLAT_URL);

  const original = mustOk(scene.createModel({id: "splatOriginal"}));
  await new GaussianSplatLoader().load({fileData, sceneModel: original});
  const origCount = splatCount(original);

  setStatus("status", "Re-exporting .splat...");
  const exported = await new GaussianSplatExporter().write({sceneModel: original});
  original.destroy();

  setStatus("status", "Re-loading exported .splat...");
  const roundTrip = mustOk(scene.createModel({id: "splatRoundTrip"}));
  await new GaussianSplatLoader().load({fileData: exported, sceneModel: roundTrip});
  const rtCount = splatCount(roundTrip);

  console.log(
    `[splat round-trip] exported ${exported.byteLength} bytes\n` +
    `  original   : ${origCount} splats\n` +
    `  round-trip : ${rtCount} splats`
  );

  // The view was created with an explicit camera for the reloaded splat model.
  document.getElementById("status")?.style.setProperty("display", "none");
  document.getElementById("caption")?.style.setProperty("display", "");
  finishExample(renderer, view);
}
