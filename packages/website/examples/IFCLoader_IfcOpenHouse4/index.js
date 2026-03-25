// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data, renderer} = demoHelper;

 const drawInspectorResult = renderer.getRenderInspector();

  if (!drawInspectorResult.ok) {
    throw new Error("Failed to get RenderInspector: " + drawInspectorResult.error);
  }

  window.renderInspector = drawInspectorResult.value;

  renderInspector.enabled = true;

// Create an IFCLoader to load IFC files

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

// Arrange the View's Camera

  demoHelper.createView({
    camera: {
      "eye": [-15.87,10.09,10.94],
      "look": [-3.91,1.72,1.19],
      "up": [0.45,-0.31,0.83],
    }
  });

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    "coordinateSystem": {
      "basis": [1,0,0,0,1,0,0,0,1],
      "origin": [0,0,0],
      "units": "meters"
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Load our IFC data into the SceneModel and DataModel

  fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
    .then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          ifcLoader.load({
            fileData,
            sceneModel,
            dataModel

          }).then(() => { // IFC file loaded

            // The IFC model now appears in our Viewer.  The DataModel and the Data will then contain DataObject,
            // Relationship and PropertySet components that represent the IFC data as an
            // entity-relationship graph.

            demoHelper.finished();

          }).catch(e => {
            console.error(e);
          });
        });
    });
});

