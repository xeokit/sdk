// Import the xeokit SDK bundle used by this example.
// It provides the helper, loader, and rendering APIs used in this sample.
import * as xeokit from "../../js/xeokit-demo-bundle.js";
// Create the demo helper.
// It initializes the scene, data, viewer, and renderer context for this demo.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {view, scene, data, renderer} = demoHelper;

  const drawInspectorResult = renderer.getRenderInspector();

  if (!drawInspectorResult.ok) {
    throw new Error("Failed to get RenderInspector: " + drawInspectorResult.error);
  }
  // Create a SceneModel for renderable model content.
  // Geometry and material data loaded from files is stored here.
  const sceneModelResult = scene.createModel({
    id: "demoModel"
  });

  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;
  // Create a DataModel for semantic model data.
  // Metadata, relationships, and object meaning are stored here.
  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const dataModel = dataModelResult.value;

  // Fetch the ModelChunksManifestParams for the model. This file was output by xgf.

  fetch(`../../models/KarhumakiBridge/ifc2gltf2xgf/model.manifest.json`)
    .then(response => {
      response
        .json()
        .then(modelChunksManifest => {

          // Create a ModelChunksLoader, equipped with an XGFLoader and a DataModelParamsLoader.

          const modelChunksLoader = new xeokit.modelchunksloader.ModelChunksLoader({
            sceneModelLoader: new xeokit.formats.xgf.XGFLoader(),
            dataModelLoader: new xeokit.formats.datamodel.DataModelParamsLoader()
          });

          // Use the ModelChunksLoader to load the glTF
          // and JSON files listed in the ModelChunksManifestParams. The ModelChunksLoader will use XGFLoader to
          // load each XGF file into the SceneModel, and DataModelParamsLoader to load each JSON DataModelParams
          // file into the DataModel.

          modelChunksLoader.load({
            modelChunksManifest,
            baseDir: "../../models/KarhumakiBridge/xgf/",
            sceneModel,
            dataModel

          }).then(() => { // XGF and JSON files loaded

            // The Karhumaki Bridge model now appears in our Viewer.

            demoHelper.viewFit();

            demoHelper.finished();

          }).catch(e => {
            console.error(e);
            demoHelper.finished();

          });
        });
    });
});

