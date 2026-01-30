// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const {view, scene} = demoHelper;

    // Set the View's Camera to look at a point five meters above the
    // center of the World coordinate system

    view.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
    view.camera.eye = [-20, -5, 20];
    view.camera.look = [0, -5, 0];
    view.camera.up = [0, 1, 0];
    view.camera.orbitPitch(20);

    // Create a SceneModel and use GLTFLoader load a building model into it.
    //
    // The SceneModel specifies that its SceneObject components will
    // belong to ViewLayer "modelLayer".
    //
    // The "modelLayer" ViewLayer is then created on-demand in our View, because we
    // configured the View with autoLayers: true (which is the default).

    const sceneModelResult = scene.createModel({
      id: "demoModel",
      layerId: "modelLayer"
    });

    if (!sceneModelResult.ok) {
      throw new Error(`Error creating SceneModel: ${sceneModelResult.error}`);
    }

    const sceneModel = sceneModelResult.value;

    // Use GLTFLoader to load a glTF model into our SceneModel

    const gltfLoader = new xeokit.formats.gltf.GLTFLoader();

    fetch("../../models/IfcOpenHouse2x3/ifc2gltf/model.glb")
      .then(response => {

        response
          .arrayBuffer()
          .then(fileData => {

            gltfLoader.load({
              fileData,
              sceneModel,
              //  dataModel
            }).then(() => {

              // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.
              // The View will contain a ViewObject corresponding to each SceneObject, through which the
              // appearance of the object can be controlled in the View.

              demoHelper.finished();

            }).catch(message => {
              console.error(`Error loading glTF: ${message}`);
            });
          });
      });


    // Create another SceneModel and programmatically
    // construct a wireframe ground plane grid.
    //
    // The SceneModel specifies that its SceneObject instances will
    // belong to ViewLayer "gridLayer".
    //
    // The "gridLayer" ViewLayer is then created on-demand in our View, because we
    // configured the View with autoLayers: true (which is the default).

    const gridSceneModelResult = scene.createModel({
      id: "demoHelperSceneModel",
      layerId: "gridLayer"
    });

    if (!gridSceneModelResult.ok) {
      throw new Error(`Error creating SceneModel: ${gridSceneModelResult.error}`);
    }

    const gridSceneModel = gridSceneModelResult.value;

    const gridGeometryResult = xeokit.procgen.buildGridGeometry({
      size: 100,
      divisions: 100
    });

    if (!gridGeometryResult.ok) {
      throw new Error(`Error creating grid geometry: ${gridGeometryResult.error}`);
    }

    const grid = gridGeometryResult.value;

    const geometryResult = gridSceneModel.createGeometry({
      id: "gridGeometry",
      primitive: xeokit.constants.LinesPrimitive,
      positions: grid.positions,
      indices: grid.indices
    });

    if (!geometryResult.ok) {
      throw new Error(`Error creating grid geometry in SceneModel: ${geometryResult.error}`);
    }

    const meshResult = gridSceneModel.createMesh({
      id: "gridMesh",
      geometryId: "gridGeometry",
      position: [0, -5, 0],
      color: [.7, .7, .7]
    });

    if (!meshResult.ok) {
      throw new Error(`Error creating grid mesh in SceneModel: ${meshResult.error}`);
    }

    const objectResult = gridSceneModel.createObject({
      id: "grid",
      meshIds: ["gridMesh"]
    });

    if (!objectResult.ok) {
      throw new Error(`Error creating grid object in SceneModel: ${objectResult.error}`);
    }

    // Highlight the ViewObjects in ViewLayer "gridLayer"

    view.layers["gridLayer"].setObjectsHighlighted(["grid"], true);

    demoHelper.finished();
  });
