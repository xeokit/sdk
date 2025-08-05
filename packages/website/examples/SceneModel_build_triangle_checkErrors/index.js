// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials for our triangle

const scene = new xeokit.scene.Scene();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that views our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

const demoHelper = new DemoHelper({
  viewer
});

demoHelper.init()
  .then(() => {

    // Add a View, which will render an independent view of the Scene within the
    // given DOM element. If this call did not succeed, then
    // instead of returning a View, it will return an SDKError that will indicate
    // what failed. In this example, we'll not assume that
    // our method calls always succeed, so we'll first check if they return an
    // SDKError.

    const view = viewer.createView({
      id: "demoView",
      elementId: "demoCanvas"
    });

    if (view instanceof xeokit.core.SDKError) {
      demoHelper.log(`Error creating View: ${view.message}`);
    }

    // Position the View's Camera

    view.camera.eye = [0, 0, 10]; // Default
    view.camera.look = [0, 0, 0]; // Default
    view.camera.up = [0, 1, 0]; // Default

    // Configure the Camera's PerspectiveProjection

    view.camera.projectionType = xeokit.constants.PerspectiveProjectionType; // Default
    view.camera.perspectiveProjection.fov = 60; // Default
    view.camera.perspectiveProjection.near = 0.1; // Default
    view.camera.perspectiveProjection.far = 10000; // Default

    view.backfaces = true; // FIXME

    // Add a CameraControl to interactively control the Camera with keyboard,
    // mouse and touch input

    new xeokit.cameracontrol.CameraControl(view);

    // Within the Scene, create a SceneModel to hold geometry and materials for our model

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    if (sceneModel instanceof xeokit.core.SDKError) {
      demoHelper.log(`Error creating SceneModel: ${sceneModel.message}`);

    } else {

      // Create a SceneGeometry that defines that shape of our triangle

      const geometry = sceneModel.createGeometry({
        id: "triangleGeometry",
        primitive: xeokit.constants.TrianglesPrimitive,
        positions: [
          0.0, 1.5, 0.0,
          -1.5, -1.5, 0.0,
          1.5, -1.5, 0.0,
        ],
        indices: [
          0, 1, 2
        ]
      });

      if (geometry instanceof xeokit.core.SDKError) {
        demoHelper.log(`Error creating Geometry: ${geometry.message}`);
      }

      // Create a SceneMesh that defines both the shape and
      // the surface appearance of our triangle

      const triangleMesh = sceneModel.createMesh({
        id: "triangleMesh",
        geometryId: "triangleGeometry",
        matrix: [ // Default
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ],
        color: [1, 1.0, 1.0] // Default
      });

      if (triangleMesh instanceof xeokit.core.SDKError) {
        demoHelper.log(`Error creating SceneMesh: ${triangleMesh.message}`);
      }

      // Create a SceneObject that defines the triangle object itself

      const triangleSceneObject = sceneModel.createObject({
        id: "triangleObject",
        meshIds: ["triangleMesh"]
      });

      if (triangleSceneObject instanceof xeokit.core.SDKError) {
        demoHelper.log(`Error creating SceneObject: ${triangleSceneObject.message}`);
      }

      // At this point, the View will contain a single ViewObject that has the same
      // ID as the SceneObject. Through the ViewObject, we can now update the
      // appearance of the box in that View.

      view.objects["triangleObject"].highlighted = true;

      demoHelper.finished();
    }
  });
