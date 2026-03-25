// Step 1: Import the xeokit SDK bundle used by this example.
//
// This bundle provides the xeokit SDK v3 APIs that the example relies on.
// In these demos, the bundle is already prepared for us, so we can focus on
// learning the v3 programming model instead of spending time on app setup.

import * as xeokit from "../../js/xeokit-demo-bundle.js";


// Step 2: Create and initialize the demo helper.
//
// The DemoHelper is part of the example harness. It prepares the shared scene
// and rendering environment used by the demo, giving us a ready place to create
// views and models. In xeokit SDK v3, this is a convenient way to get to the
// important concepts quickly: Scene, View, ViewLayer, and SceneModel.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const { scene } = demoHelper;

  // Step 3: Create a View and set its initial camera.
  //
  // In xeokit SDK v3, the Scene owns the world data, while a View is a specific
  // presentation of that data. The View controls things like camera state and
  // how scene content is shown. This separation is one of the key ideas in v3:
  // the same Scene can potentially be presented in different ways through Views.

  const view = demoHelper.createView({
    camera: {
      eye: [-19.198880324645085, 20.644412394213887, 10.270684931402508],
      look: [33.02005278082366, -35.52204955036619, -18.843578603143392],
      up: [0.2416633264296839, -0.25993204262564124, 0.9348979462355245]
    }
  });

  // Step 4: Create two ViewLayers to organize what the View displays.
  //
  // ViewLayers are a View-side organization tool in xeokit SDK v3. Here we
  // create one layer for the IFC model and another for the grid. This keeps
  // imported model content separate from helper graphics, which makes the
  // example easier to understand and makes later control of appearance or
  // visibility more deliberate.

  const modelLayerResult = view.createLayer({
    id: "modelLayer"
  });

  if (!modelLayerResult.ok) {
    throw new Error(`Error creating ViewLayer 'modelLayer': ${modelLayerResult.error}`);
  }

  const gridLayerResult = view.createLayer({
    id: "gridLayer"
  });

  if (!gridLayerResult.ok) {
    throw new Error(`Error creating ViewLayer 'gridLayer': ${gridLayerResult.error}`);
  }

  // Step 5: Create a SceneModel for the IFC building.
  //
  // A SceneModel is a scene-side container for model content. In v3, this is a
  // central concept: model data is added to the Scene through SceneModels, while
  // the View is responsible for presenting it. By assigning this model to the
  // "modelLayer", we are telling xeokit which ViewLayer should present the
  // SceneObjects created from this model.
  //
  // We also define the model's coordinate system explicitly. This makes the
  // model's basis, origin, and units clear, which is especially useful in v3's
  // more explicit and structured architecture.

  const houseModelResult = scene.createModel({
    id: "houseModel",
    layerId: "modelLayer",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!houseModelResult.ok) {
    throw new Error(`Error creating SceneModel 'houseModel': ${houseModelResult.error}`);
  }

  const houseModel = houseModelResult.value;

  // Step 6: Create the IFC loader.
  //
  // Format loaders in xeokit SDK v3 translate external file formats into scene
  // content. In this example, the IFCLoader will parse the IFC file and populate
  // our SceneModel with the geometry, meshes, and objects needed for rendering.

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Step 7: Fetch the IFC file and load it into the SceneModel.
  //
  // Once the file has been fetched as binary data, we pass it to the IFCLoader
  // together with the target SceneModel. After loading finishes, the Scene will
  // contain SceneObjects for the building, and the View will present them through
  // ViewObjects. This is the core v3 relationship in action: scene-side data,
  // view-side presentation.

  fetch("../../models/IfcOpenHouse2x3/ifc/model.ifc")
    .then(response => response.arrayBuffer())
    .then(fileData => {
      return ifcLoader.load({
        fileData,
        sceneModel: houseModel
      });
    })
    .then(() => {

      // Step 8: Create a second SceneModel for procedural helper geometry.
      //
      // xeokit SDK v3 treats imported and programmatically generated content in a
      // consistent way: both live in SceneModels. Here we create a second model
      // for a ground grid and assign it to "gridLayer" so that it stays separate
      // from the building model in the View.

      const gridModelResult = scene.createModel({
        id: "gridGroundPlane",
        layerId: "gridLayer",
        coordinateSystem: {
          basis: [
            1, 0, 0, // Right
            0, 1, 0, // Up
            0, 0, 1  // Forward
          ],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1.0
        }
      });

      if (!gridModelResult.ok) {
        throw new Error(`Error creating SceneModel 'gridGroundPlane': ${gridModelResult.error}`);
      }

      const gridModel = gridModelResult.value;

      // Step 9: Build the grid geometry data procedurally.
      //
      // This helper returns raw positions and indices for a line grid. The result
      // is not yet part of the Scene; it is just geometry data. In the next step,
      // we turn that data into xeokit geometry, then into a mesh, and finally into
      // an object that the Scene and View can manage.

      const gridGeometryResult = xeokit.procgen.buildGridGeometry({
        size: 100,
        divisions: 100
      });

      if (!gridGeometryResult.ok) {
        throw new Error(`Error creating grid geometry: ${gridGeometryResult.error}`);
      }

      const gridGeometryData = gridGeometryResult.value;

      // Step 10: Create the geometry, mesh, and object for the grid.
      //
      // This shows the construction flow clearly. First we register geometry,
      // then we create a mesh that uses that geometry and defines placement and
      // color, and finally we create an object that groups the mesh into a
      // manageable scene entity. This explicit layering is a good example of how
      // xeokit SDK v3 keeps the data model structured and composable.

      gridModel.createGeometry({
        id: "gridGeometry",
        primitive: xeokit.constants.LinesPrimitive,
        positions: gridGeometryData.positions,
        indices: gridGeometryData.indices
      });

      gridModel.createMesh({
        id: "gridMesh",
        geometryId: "gridGeometry",
        position: [0, -5, 0],
        color: [0.4, 0.4, 0.4]
      });

      gridModel.createObject({
        id: "grid",
        meshIds: ["gridMesh"]
      });

      // Step 11: Finish the demo.
      //
      // At this point the example is complete. The Scene contains two SceneModels:
      // one loaded from IFC and one generated in code. The View presents them
      // through separate ViewLayers. That makes this a compact but useful example
      // of the xeokit SDK v3 architecture: Scene for shared content, View for
      // presentation, and ViewLayers for organizing what the user sees.

      demoHelper.finished();
    })
    .catch(error => {
      console.error(`Error loading IFC model: ${error}`);
    });

});
