// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, data, loader, and rendering APIs used by
// this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

async function main() {
  // Create the demo helper. This helper initializes the shared runtime
  // context and provides utilities for configuring and running the demo.
  const studio = new xeokit.studio.Studio({});

  await studio.init();

  // Access the Scene and Data subsystems created by the Studio. The
  // Scene manages renderable content, while the Data subsystem manages
  // semantic model structure and metadata.
  const { scene, data } = studio;

  // Create a View and position the camera to frame the model from an
  // elevated angle after loading.
  const view = studio.viewManager.createView({
    camera: {
      eye: [31.38663988418555, 32.115413398051004, 14.796097980600416],
      look: [0.6121272273206806, 6.666971960818746, 2.5235511335317735],
      up: [-0.2263867800274616, -0.18720656464184895, 0.9558779880213767],
    }
  });

  view.effects.edges.renderModes = [
    xeokit.base.constants.RealisticRender
  ];
  view.effects.edges.useMeshColor = true;
  view.effects.edges.edgeWidth = 2;

  // Create a SceneModel to hold renderable content. Duplex is authored
  // Y-up, while the Scene is Z-up by default; this basis lets the SceneModel
  // transform keep the building upright.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic content such as object types,
  // relationships, and metadata.
  const dataModelResult = data.createModel({ id: "demoModel" });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Load the semantic graph first, then load the renderable geometry.
  // Both model layers use the same logical model identifier.
  await studio.loadModel({
    id: "demoModel",
    src: `../../models/Duplex/datamodel/model.json`,
    format: "datamodel",
    dataModel
  });

  await studio.loadModel({
    id: "demoModel",
    src: `../../models/Duplex/xgf/model.xgf`,
    format: "xgf",
    sceneModel
  });

  // Finalize the SceneModel once loading is complete.

  // Query the semantic graph for all IfcBuildingStorey objects. These
  // will be used as the groups for the explosion animation.
  const ifcBuildingStoreys = data.objectsByType["IfcBuildingStorey"];
  if (!ifcBuildingStoreys) {
    console.error("No IfcBuildingStorey objects found in this model");
    return;
  }

  // Collect the storeys into a deterministic order so that the
  // animation behaves consistently between runs.
  const storeyEntries = Object.values(ifcBuildingStoreys);
  storeyEntries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Collect per-storey animation state, including the transform and
  // its signed offset direction.
  const storeyTransforms = [];

  // Create one transform per storey and parent the meshes of all
  // contained objects under that transform.
  for (let i = 0; i < storeyEntries.length; i++) {
    const storey = storeyEntries[i];

    const resultObjectIds = [];
    const searchResult = xeokit.model.data.searchObjects(data, {
      startObjectId: storey.id,
      resultObjectIds
    });

    if (!searchResult.ok) {
      console.warn(`Search failed for storey ${storey.id}`, searchResult);
      continue;
    }

    // Create a transform for the current storey group.
    const transformId = `storeyTransform_${storey.id}`;

    const sceneTransformResult = sceneModel.createTransform({
      id: transformId,
      position: [0, 0, 0]
    });

    if (!sceneTransformResult.ok) {
      console.warn(
          `Failed to create transform for storey ${storey.id}: ` +
          sceneTransformResult.error
      );
      continue;
    }

    const sceneTransform = sceneTransformResult.value;

    // Re-parent the meshes of all contained scene objects to the new
    // storey transform so they move together during the animation.
    for (const objectId of resultObjectIds) {
      const sceneObject = scene.objects[objectId];
      if (!sceneObject || !sceneObject.meshes) continue;

      for (const sceneMesh of sceneObject.meshes) {
        sceneMesh.setParentTransformId(transformId);
      }
    }

    // Distribute the storeys symmetrically around zero so that some
    // move in the negative direction and some in the positive direction.
    const center = (storeyEntries.length - 1) * 0.5;
    const dirY = i - center;

    storeyTransforms.push({
      storeyId: storey.id,
      transform: sceneTransform,
      basePos: [0, 0, 0],
      dirY
    });
  }

  if (storeyTransforms.length === 0) {
    console.error("No storey transforms were created; nothing to separate.");
    return;
  }

  const explodeDistancePerStorey = 3.5; // meters

  const applySeparation = (amount) => {
    for (const s of storeyTransforms) {
      const y = s.dirY * explodeDistancePerStorey * amount;
      s.transform.position = [s.basePos[0] + y * 3, s.basePos[1], s.basePos[2]];
    }
  };

  applySeparation(1);

  const info = await studio.openInfoPanelFromMeta();
  info.addSlider({
    label: "Separation",
    min: 0,
    max: 100,
    step: 1,
    value: 100,
    digits: 0,
    onChange: value => applySeparation(value / 100)
  });

  studio.finished();
  document.querySelectorAll(".xeokit-loading-overlay").forEach(el => {
    el.style.display = "none";
  });
}

main().catch((err) => {
  console.error("Error initializing demo:", err);
});
