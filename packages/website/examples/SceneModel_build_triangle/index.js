// Step 1: Import the xeokit SDK bundle.
//
// This bundle exposes the xeokit SDK v3 APIs used in this example.
// In a real application you would typically import from a package,
// but here we use a prebuilt bundle to keep the focus on the core concepts.

import * as xeokit from "../../js/xeokit-demo-bundle.js";


// Step 2: Create the four core engine components.
//
// This is the canonical “hello world” structure in xeokit SDK v3:
//
// - Scene: holds all world data (models, objects, geometry)
// - Data: optional data layer (metadata, external data sources)
// - Viewer: manages Views (presentation of the Scene)
// - WebGLRenderer: performs actual rendering to the canvas
//
// In v3, these are intentionally decoupled so you can compose them
// flexibly depending on your application needs.

const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();
const viewer = new xeokit.viewer.Viewer();
const renderer = new xeokit.webglrenderer.WebGLRenderer();


// Step 3: Attach debug event loggers (optional but very useful).
//
// xeokit SDK v3 is event-driven internally. Attaching event loggers
// to each core component lets you observe how the system behaves as
// it initializes, renders, and updates. This is especially helpful
// when learning the architecture or debugging issues.

new xeokit.core.EventsLogger(scene.events, {prefix: "[Scene    ]"});
new xeokit.core.EventsLogger(data.events, {prefix: "[Data     ]"});
new xeokit.core.EventsLogger(viewer.events, {prefix: "[Viewer   ]"});
new xeokit.core.EventsLogger(renderer.events, {prefix: "[Renderer ]"});


// Step 4: Connect the components together.
//
// In v3, nothing is implicitly wired. We explicitly connect:
//
// - Viewer → Scene (so Views know what to display)
// - Renderer → Viewer (so Views can be rendered)
//
// This explicit composition is a key design choice in xeokit SDK v3.

viewer.attachScene(scene);
renderer.attachViewer(viewer);


// Step 5: Create a View to display the Scene.
//
// A View represents a specific presentation of the Scene. It binds to
// an HTML canvas and defines how the Scene is rendered (camera, background,
// transparency, etc). Multiple Views could render the same Scene differently.

const viewResult = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas",
  transparent: true,
  backgroundColor: [0, 0, 0]
});
if (!viewResult.ok) throw new Error("Failed to create View");
const view = viewResult.value;


// Step 6: Configure the camera.
//
// The camera belongs to the View (not the Scene). This reinforces the
// separation between data and presentation. Here we position the camera
// so it looks at the origin from a distance along the Z axis.

view.camera.eye = [0, 0, 7];
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];


// Step 7: Enable user interaction.
//
// The ViewController adds standard controls (mouse, touch, keyboard)
// for orbiting, panning, and zooming the camera. This is optional,
// but typically included in interactive applications.

new xeokit.viewcontroller.ViewController(view);


// Step 8: Create a SceneModel to hold our content.
//
// A SceneModel is the main container for geometry, meshes, and objects
// inside the Scene. In xeokit SDK v3, all renderable content lives inside
// SceneModels, whether it comes from a file loader or is created manually.

const sceneModelResult = scene.createModel({id: "demoModel"});
if (!sceneModelResult.ok) throw new Error("Failed to create SceneModel");
const sceneModel = sceneModelResult.value;


// Step 9: Define reusable geometry.
//
// Geometry is defined once and can be reused by multiple meshes.
// Here we define a simple triangle using positions and indices.
// This is the lowest-level building block for rendering.

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


// Step 10: Create meshes that use the geometry.
//
// A mesh references geometry and adds instance-specific properties
// like transform (matrix) and color. Here we create two meshes from
// the same triangle geometry, positioned left and right, with different colors.
//
// This demonstrates an important v3 pattern: reuse geometry, vary meshes.

const myMeshResult = sceneModel.createMesh({
  id: "triangleMesh",
  geometryId: "triangleGeometry",
  matrix: xeokit.scene.buildMat4({
    position: [-1, 0, 0],
    scale: [1, 1, 1]
  }),
  color: [0, 1, 1] // Cyan
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
  color: [0, 1, 0] // Green
});
if (!myMesh2Result.ok) throw new Error("Failed to create SceneMesh2");
const myMesh2 = myMesh2Result.value;


// Step 11: Group meshes into a SceneObject.
//
// A SceneObject groups one or more meshes into a logical entity.
// This is the level at which you typically interact with objects
// (selection, visibility, metadata, etc).
//
// Even in this simple example, grouping the meshes reflects how
// real models are structured in xeokit SDK v3.

const createObjectResult = sceneModel.createObject({
  id: "triangleObject",
  meshIds: ["triangleMesh", "triangleMesh2"]
});
if (!createObjectResult.ok) throw new Error("Failed to create SceneObject");


// Step 12: Animate the meshes using an SDKTask.
//
// xeokit SDK v3 provides a task system for per-frame updates.
// Here we register a repeating task that updates each frame,
// rotating the two meshes on different axes.
//
// This demonstrates how dynamic behavior is integrated into the engine
// without directly managing a render loop yourself.

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
