// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a helper that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

import {ModelConverterStatsReportHTMLView} from "../../js/ModelConverterStatsReportHTMLView.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data} = demoHelper;

  // Create a ModelConverter instance configured to convert our .BIM file into SceneModelParams and DataModelParams JSON.
  // We configure the ModelConverter with a DotBIMLoader to load BIM files, a SceneModelParamsExporter, and a DataModelParamsExporter. We'll also
  // configure the ModelConveter with a single pipeline, "ifc2dotbim", which connects our loader and exporters together into a pipeline.

  const modelConverter = new xeokit.modelconverter.ModelConverter({
    loaders: {
      "ifc": new xeokit.formats.ifc.IFCLoader()
    },
    exporters: {
      "dotbim": new xeokit.formats.dotbim.DotBIMExporter()
    },
    pipelines: {
      "ifc2dotbim": {
        inputs: {
          "ifc": {
            loader: "ifc"
          }
        },
        outputs: {
          "dotbim": {
            exporter: "dotbim"
          }
        }
      }
    }
  });

  // Position the Camera in the scene with eye, look, and up vectors

  view.camera.eye = [-6.01, 4.85, 9.11];
  view.camera.look = [3.93, -2.65, -12.51];
  view.camera.up = [0.12, 0.95, -0.27];

  // Create a SceneModel to store the geometry and material data for the model

  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // Create a DataModel to hold the semantic metadata for the model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error(dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // Create an DotBIMLoader to load the geometry and materials into our SceneModel and DataModel

  const dotBIMLoader = new xeokit.formats.dotbim.DotBIMLoader();

  // Fetch the .BIM file containing the source model

  fetch("../../models/IfcOpenHouse4/ifc/model.ifc")
    .then(response => {
      response
        .arrayBuffer()
        .then(fileData => {

          // Convert the IFC into .BIM using the ModelConverter

          modelConverter.convert({
            pipeline: "ifc2dotbim",
            inputs: {
              ifc: {
                fileData
              }
            }
          }).then(result => {

            // Load the .BIM into the SceneModel and DataModel using our DotBIMLoader

            dotBIMLoader.load({
              fileData: result.outputs.dotbim.fileData,
              sceneModel,
              dataModel
            }).then(() => {

              // The Scene and SceneModel will then contain a SceneObject for each displayable object in our model.
              // The Data and DataModel will contain a DataObject for each IFC element in the model. Each SceneObject
              // will have a corresponding DataObject with the same ID, to attach semantic meaning.
              // The View will contain a ViewObject corresponding to each SceneObject, through which the
              // appearance of the object can be controlled in the View.

              const modelConverterStatsReport = xeokit.modelconverter.reporters.stats.createStatsReport(result);

              ModelConverterStatsReportHTMLView.show(modelConverterStatsReport, {
                corner: "top-right", // "top-left" | "bottom-right" | "bottom-left"
                maxWidth: 520,
                zIndex: 2147483647,
              });

              demoHelper.finished();

            }).catch(message => {
              console.error(`Error loading SceneModelParams: ${message}`);
            });

          }).catch(message => {
            console.error(`Error converting .BIM: ${message}`);
          });
        });
    });
});
