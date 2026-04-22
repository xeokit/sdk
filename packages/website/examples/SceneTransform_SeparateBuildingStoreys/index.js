// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, data, loader, and rendering APIs used by
// this example.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

async function main() {
  // Create the demo helper. This helper initializes the shared runtime
  // context and provides utilities for configuring and running the demo.
  const demoHelper = new xeokit.demo.DemoHelper({});

  await demoHelper.init();

  // Access the Scene and Data subsystems created by the DemoHelper. The
  // Scene manages renderable content, while the Data subsystem manages
  // semantic model structure and metadata.
  const { scene, data } = demoHelper;

  // Create a View and position the camera to frame the model from an
  // elevated angle after loading.
  demoHelper.createView({
    camera: {
      eye: [31.38663988418555, 32.115413398051004, 14.796097980600416],
      look: [0.6121272273206806, 6.666971960818746, 2.5235511335317735],
      up: [-0.2263867800274616, -0.18720656464184895, 0.9558779880213767],
    }
  });

  // Create a SceneModel to hold renderable content. The coordinate
  // system is defined explicitly to ensure consistent interpretation
  // of axes and units.
  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
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
  await demoHelper.loadModel({
    id: "demoModel",
    src: `../../models/Duplex/datamodel/model.json`,
    format: "datamodel",
    dataModel
  });

  await demoHelper.loadModel({
    id: "demoModel",
    src: `../../models/Duplex/xgf/model.xgf`,
    format: "xgf",
    sceneModel
  });

  // Finalize the SceneModel once loading is complete.
  sceneModel.finalize();

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
    const searchResult = xeokit.data.searchObjects(data, {
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

  // Signal that loading and setup have completed before starting the
  // animation.
  demoHelper.finished();

  if (storeyTransforms.length === 0) {
    console.error("No storey transforms were created; nothing to animate.");
    return;
  }

  // Animate the storeys apart over time using a smoothstep easing
  // function for a softer start and finish.
  const explodeDistancePerStorey = 3.5; // meters
  const durationSeconds = 3.0;

  const startTime = performance.now();

  const task = new xeokit.core.SDKTask({
    name: "Explode Storeys Vertically",
    task: () => {
      const t = (performance.now() - startTime) / 1000;
      const u = Math.min(1, t / durationSeconds);

      // Apply smoothstep easing to the normalized animation progress.
      const eased = u * u * (3 - 2 * u);

      for (const s of storeyTransforms) {
        const y = s.dirY * explodeDistancePerStorey * eased;
        s.transform.position = [s.basePos[0] + y * 3, s.basePos[1], s.basePos[2]];
      }

      // Stop the task once the animation reaches its final state.
      if (u >= 1) {
        task.destroy();
      }
    },
    stage: xeokit.core.SDKTask.AnimateStage,
    repeat: true
  });

  task.schedule();
}

main().catch((err) => {
  console.error("Error initializing demo:", err);
});