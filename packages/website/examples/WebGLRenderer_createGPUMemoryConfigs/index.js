// Import the pre-built xeokit demo bundle.
// This gives us access to scene, viewer, rendering, loaders, and utilities.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a Scene to store geometry, materials, and model objects.
const scene = new xeokit.scene.Scene();

// Create a Viewer that will manage one or more Views for this Scene.
// A Viewer works together with a renderer to display the scene.
const viewer = new xeokit.viewer.Viewer({
  scene
});

// Create a WebGLRenderer to draw the scene with the browser's WebGL API.
// The memory configuration helps xeokit manage GPU/system memory usage.
const renderer = new xeokit.webglrenderer.WebGLRenderer({
  memoryConfigs: xeokit.webglrenderer.createMemoryConfigs({
    grossMemoryMB: 2024, // Total memory budget to assume
    device: "medium",    // Treat this as a mid-range device
    utilization: 0.7,    // Use up to 70% of the available budget
    user: {
      // No custom overrides
    }
  })
});

// Attach the renderer to the Viewer so it can draw Views.
renderer.attachViewer(viewer);

// Create a Data container for semantic/model metadata.
// This is separate from the visual Scene.
const data = new xeokit.data.Data();

// Create a demo helper, but disable its default component setup.
// We’re building the Scene / Viewer / Renderer manually in this example.
const demoHelper = new xeokit.demo.DemoHelper({
  makeComponents: false
});

// Create a loader for .bim (DotBIM) files.
const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

// Initialize the demo environment, then create the View and load the model.
demoHelper.init()
  .then(() => {

    // Create a View and connect it to the canvas element in the page.
    // A Viewer can manage multiple Views, each with its own camera state.
    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    }).value;

    // Position the camera so it looks toward the world origin.
    view.camera.eye = [0, 0, 10];  // camera position
    view.camera.look = [0, 0, 0];  // point being viewed
    view.camera.up = [0, 1, 0];    // up direction

    // Attach mouse/touch camera controls so the user can orbit, pan, and zoom.
    new xeokit.viewcontroller.ViewController(view);

    // Create a SceneModel to hold the model's visual content:
    // geometry, meshes, materials, and scene objects.
    const sceneModel = scene.createModel({
      id: "myModel"
    }).value;

    // Create a DataModel to hold semantic information for the same model.
    // This is where object type/classification data will go.
    const dataModel = data.createModel({
      id: "myModel"
    }).value;

    // Load a DotBIM file from disk.
    // The file is JSON, so we read it with response.json().
    fetch("../../models/BlenderHouse/dotbim/model.bim").then(response => {
      response.json().then(fileData => {

        // Parse the DotBIM file into:
        // - sceneModel for visual content
        // - dataModel for semantic data
        dotBIMLoader.load({
          fileData,
          sceneModel,
          dataModel
        }).then(() => {

          // Find all semantic objects typed as IfcSpace.
          // These often represent room/space volumes that you may not want visible.
          const dataObjects = data.objectsByType["IfcSpace"];
          if (dataObjects) {
            dataObjects.forEach(([objectId, _]) => {

              // Look up the visual object in both the Scene and the View.
              // The Scene holds the model object, while the View controls appearance.
              const sceneObject = scene.objects[objectId];
              const viewObject = view.objects[objectId];

              // Hide the object in this View.
              // The scene object still exists; we're only changing visibility here.
              viewObject.visible = false;
            });
          }

          // Signal that setup and loading are complete.
          demoHelper.finished();
        });
      });
    });
  });
