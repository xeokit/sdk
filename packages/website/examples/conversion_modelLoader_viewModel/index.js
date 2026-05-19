/**
 * Provides a flexible model viewer that can load and display any model from the
 * demo examples collection. The model is selected using the `modelId` query
 * parameter, while one or more source formats are specified via the `format`
 * parameter. The source coordinate system is loaded from `coordSys.json` in the
 * target model directory, ensuring correct interpretation of axis orientation
 * and handedness.
 *
 * The example loads the coordinate system from disk, loads the requested model
 * data into both SceneModel and DataModel layers, and then fits the View for
 * interaction.
 */

// Import the xeokit SDK bundle used by this example.
// Includes the rendering engine, format loaders, and demo helpers.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

/**
 * Loads a coordinate system JSON file from the selected model directory.
 *
 * Expected path:
 * `./models/<modelId>/coordSys.json`
 *
 * This function assumes the file always exists and is valid.
 * It will throw if the file cannot be loaded or parsed.
 */
async function loadCoordinateSystemFromFile(modelId) {
  const coordSysPath = `../../models/${encodeURIComponent(modelId)}/coordSys.json`;

  const response = await fetch(coordSysPath, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Failed to load coordSys.json at ${coordSysPath}`);
  }

  const json = await response.json();

  if (
    !json ||
    !Array.isArray(json.basis) ||
    !Array.isArray(json.origin) ||
    typeof json.units !== "string"
  ) {
    throw new Error(`Invalid coordSys.json at ${coordSysPath}`);
  }

  return json;
}

/**
 * Entry point for the demo. Initializes xeokit, resolves runtime
 * parameters, loads model data, and prepares the View.
 */
async function main() {

  // Create and initialize the Studio, which sets up Scene, Data,
  // Viewer, and rendering context.
  const studio = new xeokit.studio.Studio({});

  await studio.init({
    logging: false
  });

  const { data, scene } = studio;

  // Create a View and configure the initial camera framing.
  const view = studio.viewManager.createView({
    camera: {
      eye: [-3.23, -3.49, 2.58],
      look: [-0.03, 0.05, 0.5],
      up: [0.26, 0.29, 0.91]
    }
  });

  // Read runtime parameters from the URL query string.
  // - modelId: selects which demo model to load
  // - format: selects one or more source formats (comma-separated)

  const params = new URLSearchParams(window.location.search);
  const modelId = params.get("modelId") || "Duplex";
  const formatParam = params.get("format") || "xgf";

  // Load coordinate system from the model's coordSys.json file.
  const coordinateSystem = await loadCoordinateSystemFromFile(modelId);

  // Create a SceneModel to hold renderable geometry.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem,
  });

  if (sceneModelResult.ok === false) {
    throw new Error(`Error creating SceneModel: ${sceneModelResult.error}`);
  }

  // Create a DataModel to hold semantic metadata.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (dataModelResult.ok === false) {
    throw new Error(`Error creating DataModel: ${dataModelResult.error}`);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Parse the format parameter into a list of formats.
  // Multiple formats can be specified as a comma-separated string.
  const formats = formatParam
    .split(",")
    .map((format) => format.trim())
    .filter(Boolean);

  // Load each requested format into the same SceneModel/DataModel.
  // This allows combining geometry and metadata from multiple sources.
  for (const format of formats) {
    await studio.loadModel(
      { modelId, format, sceneModel, dataModel },
      {}
    );
  }

  // Fit the View to the model bounds and signal that initialization
  // has completed.
  studio.viewFit(view);

  studio.finished();
}

// Run the demo and report any initialization errors.
main().catch((err) => {
  console.error("Error initializing demo:", err);
});
