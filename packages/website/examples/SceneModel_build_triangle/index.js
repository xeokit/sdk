// Import the xeokit SDK bundle. This example uses a prebuilt bundle to
// focus on the core API flow without additional setup.
import * as xeokit from "../../js/xeokit-demo-bundle.js";


// Create the core subsystems. The Scene manages renderable content, the
// Data subsystem holds optional semantic data, the Viewer manages Views,
// and the Renderer draws frames to the canvas.
const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();
const viewer = new xeokit.viewer.Viewer();
const renderer = new xeokit.webglrenderer.WebGLRenderer();


// Attach optional debug event loggers. These log lifecycle and update
// events for each subsystem, which is useful for understanding behavior
// during development.
new xeokit.core.EventsLogger(scene.events, { prefix: "[Scene    ]" });
new xeokit.core.EventsLogger(data.events, { prefix: "[Data     ]" });
new xeokit.core.EventsLogger(viewer.events, { prefix: "[Viewer   ]" });
new xeokit.core.EventsLogger(renderer.events, { prefix: "[Renderer ]" });


// Connect the subsystems explicitly. The Viewer consumes the Scene,
// and the Renderer consumes the Viewer to produce visual output.
viewer.attachScene(scene);
renderer.attachViewer(viewer);


// Create a View to display the Scene. The View binds to a canvas element
// and manages camera configuration and presentation settings.
const viewResult = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas",
  transparent: true,
  backgroundColor: [0, 0, 0]
});
if (!viewResult.ok) throw new Error("Failed to create View");
const view = viewResult.value;


// Configure the camera on the View. Camera state is owned by the View,
// not the Scene.
view.camera.eye = [0, 0, 7];
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];


// Enable user interaction. The ViewController adds orbit, pan, and zoom
// controls for navigating the scene.
new xeokit.viewcontroller.ViewController(view);


// Create a SceneModel to hold renderable content. SceneModels group
// geometry, meshes, and objects into a logical model.
const sceneModelResult = scene.createModel({ id: "demoModel" });
if (!sceneModelResult.ok) throw new Error("Failed to create SceneModel");
const sceneModel = sceneModelResult.value;


// Define reusable geometry. This triangle can be instanced by multiple
// meshes to avoid duplicating vertex data.
sceneModel.createGeometry({
  id: "triangleGeometry",
  primitive: xeokit.constants.TrianglesPrimitive,
  positions: [
    0.0, 1.5, 0.0,
    -1.5, -1.5, 0.0,
    1.5, -1.5, 0.0
  ],
  indices: [0, 1, 2]
});


// Create meshes that instance the shared geometry. Each mesh applies its
// own transform and color while reusing the same vertex data.
const myMeshResult = sceneModel.createMesh({
  id: "triangleMesh",
  geometryId: "triangleGeometry",
  matrix: xeokit.scene.buildMat4({
    position: [-1, 0, 0],
    scale: [1, 1, 1]
  }),
  color: [0, 1, 1]
});
if (!myMeshResult.ok) throw new Error("Failed to create SceneMesh");
const myMesh = myMeshResult.value;

const myMesh2Result = sceneModel.createMesh({
  id: "triangleMesh2",
  geometryId: "triangleGeometry",
  matrix: xeokit.scene.buildMat4({
    position: [1, 0, 0],
    scale: [1, 1, 1]
  }),
  color: [0, 1, 0]
});
if (!myMesh2Result.ok) throw new Error("Failed to create SceneMesh2");
const myMesh2 = myMesh2Result.value;


// Group the meshes into a SceneObject. SceneObjects represent logical
// entities that can be selected, hidden, or styled as a unit.
const createObjectResult = sceneModel.createObject({
  id: "triangleObject",
  meshIds: ["triangleMesh", "triangleMesh2"]
});
if (!createObjectResult.ok) throw new Error("Failed to create SceneObject");


// Animate the meshes using an SDKTask. The task runs each frame and
// updates the mesh transforms to produce continuous rotation.
let r = 0;

new xeokit.core.SDKTask({
  name: "Rotate the triangle meshes",
  repeat: true,
  stage: xeokit.core.SDKTask.CollectInputStage,
  task: () => {
    r += 0.1;

    myMesh.matrix = xeokit.math.matrix.rotationMat4v(r, [0, 1, 0]);
    myMesh2.matrix = xeokit.math.matrix.rotationMat4v(r, [1, 0, 0]);
  }
});