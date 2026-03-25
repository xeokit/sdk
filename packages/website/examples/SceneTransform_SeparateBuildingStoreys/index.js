// Import the SDK from a bundle built for these examples.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const { view, scene, data } = demoHelper;

  // Create an IFCLoader to load IFC files
  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Arrange the View's Camera
  demoHelper.createView({
    camera: {
      "eye": [31.38663988418555,32.115413398051004,14.796097980600416],
      "look": [0.6121272273206806,6.666971960818746,2.5235511335317735],
      "up": [-0.2263867800274616,-0.18720656464184895,0.9558779880213767],
    }
  });

  // Create a SceneModel to hold our model's geometry and materials
  const sceneModelResult = scene.createModel({ id: "demoModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0,0,0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic data for our model
  const dataModelResult = data.createModel({ id: "demoModel" });
  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel  = dataModelResult.value;

  // Load our IFC data into the SceneModel and DataModel
  fetch(`../../models/Duplex/ifc/model.ifc`)
    .then(response => response.arrayBuffer())
    .then(fileData => {

      return ifcLoader.load({
        fileData,
        sceneModel,
        dataModel
      });

    })
    .then(() => {

      // Get all IfcBuildingStorey objects from the Data graph
      const ifcBuildingStoreys = data.objectsByType["IfcBuildingStorey"];
      if (!ifcBuildingStoreys) {
        console.error("No IfcBuildingStorey objects found in this model");
        return;
      }

      // We'll build one transform per storey, and animate them apart on +Y
      const storeyEntries = Object.values(ifcBuildingStoreys);

      // Deterministic ordering helps the explosion look stable between runs
      storeyEntries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

      // Keep per-storey info for animation
      const storeyTransforms = []; // { storeyId, transform, basePos, dirY }

      // Create transforms and parent contained meshes
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

        // Create a transform for this storey group
        const transformId = `storeyTransform_${storey.id}`;

        const sceneTransformResult = sceneModel.createTransform({
          id: transformId,
          position: [0, 0, 0]
        });

        if (!sceneTransformResult.ok) {
          console.warn(`Failed to create transform for storey ${storey.id}: ${sceneTransformResult.error}`);
          continue;
        }

        const sceneTransform = sceneTransformResult.value;

        // Parent meshes of all contained objects to this storey transform
        for (const objectId of resultObjectIds) {
          const sceneObject = scene.objects[objectId];
          if (!sceneObject || !sceneObject.meshes) continue;

          for (const sceneMesh of sceneObject.meshes) {
            sceneMesh.setParentTransformId(transformId);
          }
        }

        // Direction: spread them by index around 0 so some go up, some go down (optional)
        // If you want *all* storeys moving upward only, set dirY = i.
        const center = (storeyEntries.length - 1) * 0.5;
        const dirY = (i - center); // negative below center, positive above

        storeyTransforms.push({
          storeyId: storey.id,
          transform: sceneTransform,
          basePos: [0, 0, 0],
          dirY
        });
      }

      if (storeyTransforms.length === 0) {
        console.error("No storey transforms were created; nothing to animate.");
        return;
      }

      // Animate: move storeys apart along vertical axis (Y)
      // Tweak these:
      const explodeDistancePerStorey = 3.5; // meters (ish)
      const durationSeconds = 3.0;

      const startTime = performance.now();

      const task = new xeokit.core.SDKTask({
        name: "Explode Storeys Vertically",
        task: () => {
          const t = (performance.now() - startTime) / 1000;
          const u = Math.min(1, t / durationSeconds);

          // Smoothstep easing
          const eased = u * u * (3 - 2 * u);

          for (const s of storeyTransforms) {
            const y = s.dirY * explodeDistancePerStorey * eased;
            s.transform.position = [s.basePos[0]+y*3, s.basePos[1], s.basePos[2]];
          }

          if (u >= 1) {
            task.unschedule();
            demoHelper.finished();
          }
        },
        stage: xeokit.core.SDKTask.AnimateStage,
        repeat: true
      });

      task.schedule();

    })
    .catch(e => console.error(e));
});
