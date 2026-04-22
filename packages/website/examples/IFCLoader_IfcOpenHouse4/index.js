// Import the xeokit SDK bundle used by this example. This bundle provides
// the helper, loader, scene, data, and rendering APIs required by the
// sample.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create the demo helper. This helper initializes the rendering context,
// constructs the Scene and Data subsystems, and provides utilities for
// configuring and running the demo.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

    // Access the Scene, Data, and Renderer instances created by the
    // DemoHelper. The Scene manages renderable content, the Data subsystem
    // manages semantic content, and the Renderer provides low-level
    // inspection and rendering utilities.
    const { scene, data, renderer } = demoHelper;

    // Create an IFCLoader. This loader parses IFC data into renderable scene
    // content and corresponding semantic objects.
    const ifcLoader = new xeokit.formats.ifc.IFCLoader();

    // Create a View and configure its initial camera. The camera is positioned
    // to frame the model after loading.
    demoHelper.createView({
        camera: {
            eye: [-15.87, 10.09, 10.94],
            look: [-3.91, 1.72, 1.19],
            up: [0.45, -0.31, 0.83],
        }
    });

    // Create a SceneModel to hold renderable model content. Geometry and
    // material data loaded from the IFC file will be stored in this model.
    // The model coordinate system is defined explicitly in meters.
    const sceneModelResult = scene.createModel({
        id: "demoModel",
        coordinateSystem: {
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            origin: [0, 0, 0],
            units: "meters"
        }
    });

    // Validate that the SceneModel was created successfully. If creation
    // fails, throw an error describing the failure.
    if (!sceneModelResult.ok) {
        throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
    }

    // Create a DataModel to hold semantic model data. Metadata, relationships,
    // and higher-level object meaning are stored in this model.
    const dataModelResult = data.createModel({
        id: "demoModel"
    });

    // Validate that the DataModel was created successfully. If creation
    // fails, throw an error describing the failure.
    if (!dataModelResult.ok) {
        throw new Error("Failed to create DataModel: " + dataModelResult.error);
    }

    const sceneModel = sceneModelResult.value;
    const dataModel = dataModelResult.value;

    // Fetch the IFC file and load it into the SceneModel and DataModel. This
    // keeps the renderable scene content and semantic model data linked to
    // each other.
    fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
        .then(response => {
            response
                .arrayBuffer()
                .then(fileData => {

                    // Load the IFC file into the scene and semantic data models.
                    ifcLoader.load({
                        fileData,
                        sceneModel,
                        dataModel

                    }).then(() => {

                        // Signal that loading has completed. At this point, the IFC model
                        // is visible in the Scene, and the DataModel contains DataObject,
                        // Relationship, and PropertySet components representing the IFC
                        // entity-relationship structure.
                        demoHelper.finished();

                    }).catch(e => {

                        // Log any errors that occur while loading the IFC file.
                        console.error(e);
                    });
                });
        });
});