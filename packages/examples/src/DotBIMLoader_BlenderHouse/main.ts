
import * as xeokit from "@xeokit/sdk"

const model = "https://sos-ch-gva-2.exo.io/creoox-public/xeokit-sdk/model.bim"

// Create a DotBIMLoader to load .BIM files
const dotBIMLoader = new xeokit.dotbim.DotBIMLoader();

// Create a Scene to hold geometry and materials
const scene: xeokit.scene.Scene = new xeokit.scene.Scene();

// Create a Data to hold semantic data
const data = new xeokit.data.Data();

// Create a WebGLRenderer to use the browser's WebGL graphics API for rendering
const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that will use the WebGLRenderer to draw the Scene
const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Give the Viewer a single View to render the Scene in our HTML canvas element
const view = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas"
});

if (view instanceof xeokit.core.SDKError) {
  throw new Error(`Error creating View: ${view.message}`);
}

// Configure the View's World-space coordinate axis to make the +Z axis "up"
view.camera.worldAxis = [
  1, 0, 0, // Right +X
  0, 0, 1, // Up +Z
  0, -1, 0 // Forward -Y
];

// Arrange the View's Camera within our +Z "up" coordinate system
view.camera.eye = [11.276311451067942, 16.914467176601914, 7.399026975905038];
view.camera.look = [0, 0, 0];
view.camera.up = [-0.18971864040782152, -0.28457796061173224, 0.9396926209223285];


// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input
new xeokit.cameracontrol.CameraControl(view, {});

// Create a SceneModel to hold our model's geometry and materials
const sceneModel = scene.createModel({
  id: "demoModel"
});
if (sceneModel instanceof xeokit.core.SDKError) {
  throw new Error(`Error creating SceneModel: ${sceneModel.message}`);
}


// Create a DataModel to hold semantic data for our model
const dataModel = data.createModel({
  id: "demoModel"
});

if (dataModel instanceof xeokit.core.SDKError) {
  throw new Error(`Error creating DataModel: ${dataModel.message}`);
}

fetch(model).then(response => {
  response
    .json()
    .then(fileData => {
      dotBIMLoader.load({
        fileData,
        sceneModel,
        dataModel
      }).then(() => {
        console.log("DotBIMLoader loaded .BIM file");
        dataModel.build();
        sceneModel.build();
      }).catch(message => {
        console.log(`Error loading .BIM: ${message}`);
        console.error(`Error loading .BIM: ${message}`);
      });
    });
});

