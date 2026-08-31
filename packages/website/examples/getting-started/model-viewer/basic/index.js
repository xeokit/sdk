import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const params = new URLSearchParams(window.location.search);
const modelId = params.get("modelId") || "FM_LFT";
const formats = (params.get("format") || "xgf")
  .split(",")
  .map(format => format.trim())
  .filter(Boolean);

const studio = new xeokit.studio.Studio({
  modelsDir: "../../../../models"
});

studio.init({logging: false}).then(async () => {
  studio.viewManager.createView({
    id: "modelView",
    camera: {
      eye:  [-3.23, -3.49, 2.58],
      look: [-0.03,  0.05, 0.5],
      up:   [ 0.26,  0.29, 0.91],
    },
  });

  document.title = `Loading ${modelId} (${formats.join(", ")})`;

  const result = await studio.loadDataset({
    modelId,
    formats,
    yieldIntervalMs: 60,
  });

  if (result.ok === false) {
    throw new Error(result.error);
  }

  document.title = `${modelId} (${formats.join(", ")})`;
  studio.finished();
}).catch(err => {
  const message = err?.message || err;
  document.title = `Failed to load ${modelId} (${formats.join(", ")})`;
  console.error(err);
});
