// Import the pre-built demo bundle

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Viewer that views our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
    scene
});

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({
    viewer,
    memoryConfigs: xeokit.webglrenderer.createGPUMemoryConfigs({ // Memory limits
        grossMemoryMB: 2024, // 2GB
        device: "medium", // Assume mid-range device
        utilization: 0.7, // Use 70% of available memory
        user: { // No overrides
        }
    })
});

// Attach the WebGLRenderer to the Viewer

renderer.attachViewer(viewer);

// Create a Data to hold semantic data

const data = new xeokit.data.Data();

const demoHelper = new DemoHelper({
  elementId: "info-container",
  viewer
});

const dotBIMLoader = new xeokit.dotbim.DotBIMLoader();

demoHelper.init()
  .then(() => {

    // Create a View

    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    // Point the View's Camera at the center of the World coordinate system, looking down the -Z axis

    view.camera.eye = [0, 0, 10];
    view.camera.look = [0, 0, 0];
    view.camera.up = [0, 1, 0];

    // Attach a CameraControl to the View

    new xeokit.cameracontrol.CameraControl(view);

    // Create a SceneModel to hold model geometry and materials

    const sceneModel = scene.createModel({
        id: "myModel"
    });

    // Create a DataModel to hold model semantic data

    const dataModel = data.createModel({
        id: "myModel"
    });

    // Use DotBIMLoader to load a DotBIM model into the SceneModel and DataModel

    fetch("../../../models/BlenderHouse/dotbim/model.bim").then(response => {
      response.json().then(fileData => {

        dotBIMLoader.load({
            fileData,
            sceneModel,
            dataModel
        }).then(() => {

          // Search the Data to find all objects that represent IfcSpace elements
          // and set those objects invisible

          const dataObjects = data.objectsByType[xeokit.ifctypes.IfcSpace];
          if (dataObjects) {
            dataObjects.forEach(([objectId, dataObject]) => {

              const sceneObject = scene.objects[objectId];
              const viewObject = view.objects[objectId];

              viewObject.visible = false;
            });
          }

          demoHelper.finished();
        });
      });
    });
  });
