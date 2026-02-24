// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const {view, scene} = demoHelper;

    view.camera.projectionType = xeokit.constants.PerspectiveProjectionType;
    view.camera.eye = [-20, -5, 20];
    view.camera.look = [0, -5, 0];
    view.camera.up = [0, 1, 0];
    view.camera.orbitPitch(20);

    // Manually create two ViewLayers in our View

    const result1 = view.createLayer({
      id: "modelLayer"
    });

    if (!result1.ok) {
      throw new Error(`Error creating ViewLayer 'modelLayer': ${result1.error}`);
    }

    const viewLayer1 = result1.value;

    const result2 = view.createLayer({
      id: "gridLayer"
    });

    if (!result2.ok) {
      throw new Error(`Error creating ViewLayer 'gridLayer': ${result2.error}`);
    }

    const viewLayer2 = result2.value;

    // Create a SceneModel and load a building model into it.
    //
    // The SceneModel specifies that its SceneObject instances will
    // belong to ViewLayer "modelLayer".
    //
    // The "modelLayer" ViewLayer is expected to already exist in our View, because we
    // configured the View with autoLayers: false (true is the default).

    const result3 = scene.createModel({
      id: "demoModel",
      layerId: "modelLayer"
    });

    if (!result3.ok) {
      throw new Error(`Error creating SceneModel: ${result3.error}`);
    }

    const sceneModel = result3.value;

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


              // Create another SceneModel and programmatically
              // construct a wireframe ground plane grid.
              //
              // The SceneModel specifies that its SceneObject instances will
              // belong to ViewLayer "gridLayer".
              //
              // The "gridLayer" ViewLayer is expected to already exist in our View, because we
              // configured the View with autoLayers: false (true is the default).

              const gridSceneModel = scene.createModel({
                id: "demoHelperSceneModel",
                layerId: "gridLayer"
              });

              const grid = xeokit.procgen.buildGridGeometry({
                size: 100,
                divisions: 100
              });

              gridSceneModel.createGeometry({
                id: "gridGeometry",
                primitive: xeokit.constants.LinesPrimitive,
                positions: grid.positions,
                indices: grid.indices
              });

              gridSceneModel.createMesh({
                id: "gridMesh",
                geometryId: "gridGeometry",
                position: [0, -5, 0],
                color: [.7, .7, .7]
              });

              gridSceneModel.createObject({
                id: "grid",
                meshIds: ["gridMesh"]
              });

              // Highlight the ViewObjects in ViewLayer "gridLayer"

              view.layers["gridLayer"].setObjectsHighlighted(["grid"], true);

              demoHelper.finished();

            }).catch(message => {
              console.error(`Error loading glTF: ${message}`);
            });
          });
      });


  });
