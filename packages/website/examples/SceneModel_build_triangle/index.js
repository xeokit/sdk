// Example: Minimal xeokit SDK usage to display and animate two colored triangles

// Import xeokit SDK bundle
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create main xeokit components
const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();
const viewer = new xeokit.viewer.Viewer();
const renderer = new xeokit.webglrenderer.WebGLRenderer();

// Log all events to the console for debugging
new xeokit.core.EventsLogger(scene.events, {prefix: "[Scene    ]"});
new xeokit.core.EventsLogger(data.events, {prefix: "[Data     ]"});
new xeokit.core.EventsLogger(viewer.events, {prefix: "[Viewer   ]"});
new xeokit.core.EventsLogger(renderer.events, {prefix: "[Renderer ]"});

// Attach components together
viewer.attachScene(scene);
renderer.attachViewer(viewer);

// Create a View to render the Scene in the HTML canvas
const viewResult = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas",
  transparent: true,
  backgroundColor: [0, 0, 0]
});
if (!viewResult.ok) throw new Error("Failed to create View");
const view = viewResult.value;

// Set up the camera position
view.camera.eye = [0, 0, 7];
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];

// Enable interactive camera controls (mouse, touch, keyboard)
new xeokit.cameracontrol.CameraControl(view);

// Create a SceneModel to hold geometry and meshes
const sceneModelResult = scene.createModel({id: "demoModel"});
if (!sceneModelResult.ok) throw new Error("Failed to create SceneModel");
const sceneModel = sceneModelResult.value;

// Define triangle geometry (positions and indices)
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

// Create two colored meshes using the same geometry, positioned left and right
const myMeshResult = sceneModel.createMesh({
  id: "triangleMesh",
  geometryId: "triangleGeometry",
  matrix: xeokit.scene.buildMat4({position: [-1, 0, 0], scale: [1, 1, 1]}),
  color: [0, 1, 1] // Cyan
});
if (!myMeshResult.ok) throw new Error("Failed to create SceneMesh");
const myMesh = myMeshResult.value;

const myMesh2Result = sceneModel.createMesh({
  id: "triangleMesh2",
  geometryId: "triangleGeometry",
  matrix: xeokit.scene.buildMat4({position: [1, 0, 0], scale: [1, 1, 1]}),
  color: [0, 1, 0] // Green
});
if (!myMesh2Result.ok) throw new Error("Failed to create SceneMesh2");
const myMesh2 = myMesh2Result.value;

// Create a SceneObject to group both meshes
const createObjectResult = sceneModel.createObject({
  id: "triangleObject",
  meshIds: ["triangleMesh", "triangleMesh2"]
});
if (!createObjectResult.ok) throw new Error("Failed to create SceneObject");

// Animate both meshes: rotate them continuously on different axes
let r = 0;
new xeokit.core.SDKTask({
  name: "Rotate the triangle meshes",
  repeat: true,
  stage: xeokit.core.SDKTask.CollectInputStage,
  task: () => {
    r += 0.1;
    myMesh.matrix = xeokit.math.rotationMat4v(r, [0, 1, 0]);
    myMesh2.matrix = xeokit.math.rotationMat4v(r, [1, 0, 0]);
  }
});

// (Optional) Debug: access the shader view after a short delay
setTimeout(() => {
  const shaderViewResult = renderer.getShaderView();
  if (!shaderViewResult.ok) return;
  const shaderView = shaderViewResult.value;
  // new xeokit.webglrenderer.internal.ShaderDebugger(shaderView, document.getElementById("data-textures-debugger"));
  // new xeokit.webglrenderer.internal.MemoryDebugger(renderer, document.getElementById("data-textures-debugger"));
}, 2000);
