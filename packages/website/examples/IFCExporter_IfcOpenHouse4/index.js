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

  // view.camera.eye = [-6.01, 4.85, 9.11];
  // view.camera.look = [3.93, -2.65, -12.51];
  // view.camera.up = [0.12, 0.95, -0.27];


  view.camera.eye = [0,10,0];
  view.camera.look = [0, 0, 0];
  view.camera.up = [0,0,1];

// Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel"
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

  fetch(`../../models/IfcOpenHouse2x3/ifc/model.ifc`)
    .then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          ifcLoader.load({
            fileData,
            sceneModel,
            dataModel

          }).then(() => { // IFC file loaded

            demoHelper.viewFit();

            const ifcExporter = new xeokit.formats.ifc.IFCExporter();

            ifcExporter.write({
              sceneModel,
              dataModel
            }).then(exportedData => {

              console.log("Exported data:", exportedData);

              const blob = new Blob([exportedData], {type: "text/plain"});

              const url = URL.createObjectURL(blob);

              const link = document.createElement("a");
              link.style.zIndex = 500000;
              link.href = url;
              link.download = "../models/model.ifc";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              demoHelper.finished();
            });



          }).catch(e => {
            console.error(e);
          });
        });
    });
});

