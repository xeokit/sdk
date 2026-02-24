// Import xeokit SDK via the JavaScript bundle that we've built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";
import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials for our model

const scene = new xeokit.scene.Scene();

// Create a Viewer that viewManager our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer"
});

const result = viewer.attachScene(scene);
if (!result.ok) {
  throw new Error("Unable to show Scene to Viewer: " + result.error);
}

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Attach the WebGLRenderer to the Viewer

const attachResult = renderer.attachViewer(viewer);
if (!attachResult.ok) {
  throw new Error("Unable to show WebGLRenderer to Viewer: " + attachResult.error);
}

// Log any errors to the console.

new xeokit.core.EventsLogger(scene.events, {prefix: `[Scene    ]`});
new xeokit.core.EventsLogger(viewer.events, {prefix: `[Viewer   ]`});
new xeokit.core.EventsLogger(renderer.events, {prefix: `[Renderer ]`});
3
// Configure the Viewer using the given ViewerParams object. This will
// create and configure a single View within the Viewer.

const viewerParams = {
  "views": [
    {
      "id": "demoView",
      "elementId": "demoCanvas",
      "camera": {
        "eye": [0, 0, 10],
        "look": [0, 0, 0],
        "up": [0, 1, 0],
        "worldAxis": [1, 0, 0, 0, 1, 0, 0, 0, 1],
        "gimbalLock": true,
        "constrainPitch": false,
        "projectionType": 500000,
        "perspectiveProjection": {
          "far": 10000,
          "near": 0.1,
          "fov": 60,
          "fovAxis": "min"
        },
        "orthoProjection": {"far": 2000, "near": 0.1, "scale": 1},
        "frustumProjection": {
          "far": 10000,
          "near": 0.1,
          "top": 1,
          "bottom": -1,
          "right": 1,
          "left": -1
        },
        "customProjection": {
          "projMatrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      },
      "autoLayers": true,
      "layers": [{"id": "default", "autoDestroy": true}],
      "sectionPlanes": [],
      "lights": [
        {"color": [1, 1, 1], "intensity": 1},
        {
          "dir": [0.8, -0.5, -0.5],
          "color": [0.8, 0.8, 1],
          "intensity": 1,
          "space": "world"
        },
        {
          "dir": [-0.8, -1, 0.5],
          "color": [1, 1, 0.8],
          "intensity": 1,
          "space": "world"
        },
        {
          "dir": [-0.8, -1, -0.5],
          "color": [0, 0, 1],
          "intensity": 1,
          "space": "world"
        }
      ],
      "sao": {
        "renderModes": [30000],
        "intensity": 0.15,
        "minResolution": 0,
        "blendFactor": 1,
        "numSamples": 10,
        "bias": 0.5,
        "scale": 1,
        "blur": false,
        "blendCutoff": 0.3,
        "enabled": true,
        "kernelRadius": 100
      },
      "edges": {
        "renderModes": [30000],
        "edgeColor": [0, 0, 0],
        "edgeWidth": 1,
        "edgeAlpha": 1,
        "enabled": false
      },
      "highlightMaterial": {
        "fillColor": [1, 1, 0],
        "backfaces": false,
        "edgeColor": [0.5, 0.4, 0.4],
        "edgeWidth": 1,
        "edgeAlpha": 1,
        "edges": true,
        "fillAlpha": 0.5,
        "fill": true,
        "glowThrough": false
      },
      "selectedMaterial": {
        "fillColor": [0, 1, 0],
        "backfaces": false,
        "edgeColor": [0.4, 0.5, 0.4],
        "edgeWidth": 1,
        "edgeAlpha": 1,
        "edges": true,
        "fillAlpha": 0.5,
        "fill": true,
        "glowThrough": false
      },
      "xrayMaterial": {
        "fillColor": [0.8, 0.6, 0.6],
        "backfaces": false,
        "edgeColor": [0.5, 0.4, 0.4],
        "edgeWidth": 1,
        "edgeAlpha": 1,
        "edges": true,
        "fillAlpha": 0.4,
        "fill": true,
        "glowThrough": false
      },
      "pointsMaterial": {
        "pointSize": 1,
        "roundPoints": true,
        "perspectivePoints": true,
        "minPerspectivePointSize": 1,
        "maxPerspectivePointSize": 6,
        "filterIntensity": false,
        "minIntensity": 0,
        "maxIntensity": 1
      },
      "resolutionScale": {
        "enabled": true,
        "renderModes": [300001],
        "resolutionScale": 1
      },
      "renderMode": 30000
    }
  ]
};

const fromParamsResult = viewer.fromParams(viewerParams);
if (!fromParamsResult.ok) {
  throw new Error("Unable to configure Viewer from ViewerParams: " + fromParamsResult.error);
}

// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input

new xeokit.cameracontrol.CameraControl(viewer.viewList[0]);

const demoHelper = new DemoHelper({
  makeComponents: false // Don't use boilerplate demo xeokit components
});

demoHelper.init()
  .then(() => {

    // Within the Scene, create a SceneModel to hold geometry and materials for
    // our model

    const sceneModelResult = scene.createModel({
      id: "demoModel",
      geometries: [
        {
          id: "boxGeometry",
          primitive: 20002, // TrianglesPrimitive (defined in @xeokit/constants)
          positions: [ // 64-bit floats
            1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
            1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0,
            1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0,
            -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
            1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0
          ],
          indices: [
            0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
            8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
          ]
        }
      ],
      meshes: [
        {
          id: "boxMesh",
          geometryId: "boxGeometry",
          color: [1, 1, 0],
          opacity: 1
        }
      ],
      objects: [
        {
          id: "boxObject",
          meshIds: ["boxMesh"]
        }
      ]
    });

    if (!sceneModelResult.ok) {
      throw new Error("Unable to create SceneModel: " + sceneModelResult.error);
    }

    // The model now appears in the View's canvas.

    demoHelper.finished();
  });
