import {GaussianSplatLoader} from "@xeokit/sdk/formats/gaussiansplat";
import {XGFExporter, XGFLoader} from "@xeokit/sdk/formats/xgf";
import {createStandaloneRuntime, failExample, fetchArrayBuffer, finishExample, mustOk, setStatus} from "../../../utils/standaloneRuntime.js";

const SPLAT_URL = "../../../../models/Train/splat/model.splat";

main().catch((error) => {
  failExample("splat-xgf-round-trip", error);
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

  setStatus("status", "Exporting to XGF...");
  const xgf = await new XGFExporter().write({sceneModel: original});
  const xgfVersion = new DataView(xgf).getUint32(0, true);
  original.destroy();

  setStatus("status", "Re-loading from XGF...");
  const roundTrip = mustOk(scene.createModel({id: "splatXgfRoundTrip"}));
  await new XGFLoader().load({fileData: xgf, sceneModel: roundTrip});
  const rtCount = splatCount(roundTrip);

  console.log(
    `[splat -> XGF round-trip] XGF v${xgfVersion}, ${xgf.byteLength} bytes\n` +
    `  original   : ${origCount} splats\n` +
    `  round-trip : ${rtCount} splats`
  );

  // The view was created with an explicit camera for the reloaded XGF splat model.
  document.getElementById("status")?.style.setProperty("display", "none");
  document.getElementById("caption")?.style.setProperty("display", "");
  finishExample(renderer, view);
}
