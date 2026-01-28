// Example: xeokit SDK usage to display and animate a colored box

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create main xeokit components
const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();
const viewer = new xeokit.viewer.Viewer();
const renderer = new xeokit.webglrenderer.WebGLRenderer();

// Log all events to the console for debugging
new xeokit.core.EventsLogger(scene.events,    {prefix: "[Scene    ]"});
new xeokit.core.EventsLogger(data.events,     {prefix: "[Data     ]"});
new xeokit.core.EventsLogger(viewer.events,   {prefix: "[Viewer   ]"});
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
view.camera.eye  = [0, 0, 10];
view.camera.look = [0, 0, 0];
view.camera.up   = [0, 1, 0];

// Enable interactive camera controls (mouse, touch, keyboard)
new xeokit.cameracontrol.CameraControl(view);

// Create a SceneModel to hold geometry and meshes
const sceneModelResult = scene.createModel({ id: "demoModel" });
if (!sceneModelResult.ok) throw new Error("Failed to create SceneModel");
const sceneModel = sceneModelResult.value;

// Define box geometry (positions and indices)
sceneModel.createGeometry({
  id: "boxGeometry",
  primitive: xeokit.constants.TrianglesPrimitive,
  positions: [
    // 8 corners of a unit cube centered at origin
    -1, -1, -1, // 0
    1, -1, -1, // 1
    1,  1, -1, // 2
    -1,  1, -1, // 3
    -1, -1,  1, // 4
    1, -1,  1, // 5
    1,  1,  1, // 6
    -1,  1,  1  // 7
  ],
  indices: [
    // Bottom face
    0, 1, 2, 0, 2, 3,
    // Top face
    4, 5, 6, 4, 6, 7,
    // Front face
    0, 1, 5, 0, 5, 4,
    // Back face
    3, 2, 6, 3, 6, 7,
    // Left face
    0, 3, 7, 0, 7, 4,
    // Right face
    1, 2, 6, 1, 6, 5
  ]
});

// Create a colored mesh using the box geometry
const boxMeshResult = sceneModel.createMesh({
  id: "boxMesh",
  geometryId: "boxGeometry",
  matrix: xeokit.scene.buildMat4({ position: [0, 0, 0], scale: [1, 1, 1] }),
  color: [1, 0.7, 0.2] // Orange
});
if (!boxMeshResult.ok) throw new Error("Failed to create boxMesh");
const boxMesh = boxMeshResult.value;

// Create a SceneObject to group the mesh
const createObjectResult = sceneModel.createObject({
  id: "boxObject",
  meshIds: ["boxMesh"]
});
if (!createObjectResult.ok) throw new Error("Failed to create boxObject");

// Animate the mesh: rotate it continuously
let r = 0;
new xeokit.core.SDKTask({
  name: "Rotate the box mesh",
  repeat: true,
  stage: xeokit.core.SDKTask.CollectInputStage,
  task: () => {
    r += 0.02;
    boxMesh.matrix = xeokit.math.rotationMat4v(r, [0, 1, 0]);
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
