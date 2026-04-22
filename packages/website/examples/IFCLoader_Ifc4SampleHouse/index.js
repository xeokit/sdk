// Import the xeokit SDK bundle. This provides the demo helper along with
// the scene, data, and rendering APIs needed to construct and display
// the model.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create the demo helper, which sets up the shared rendering context and
// provides convenience utilities for initializing the example.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

    // Access the core subsystems. The Scene manages renderable content,
    // and the Data subsystem manages semantic structure.
    const { scene, data } = demoHelper;

    // Create a loader for IFC data. This loader converts IFC input into
    // both renderable geometry and a structured semantic graph.
    const ifcLoader = new xeokit.formats.ifc.IFCLoader();

    // Configure a view with a camera positioned to give a clear overview
    // of the model once it has been loaded.
    demoHelper.createView({
        camera: {
            eye: [24.40, 23.70, 27.04],
            look: [4.39, 8.90, 2.54],
            up: [-0.56, -0.41, 0.71]
        }
    });

    // Create a model container for renderable content. The coordinate
    // system is defined explicitly to ensure consistent interpretation
    // of axes, origin, and units.
    const sceneModelResult = scene.createModel({
        id: "demoModel",
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

    if (!sceneModelResult.ok) {
        throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
    }

    // Create a parallel model container for semantic data. This holds
    // object types, relationships, and metadata independently from
    // rendering concerns.
    const dataModelResult = data.createModel({
        id: "demoModel"
    });

    if (!dataModelResult.ok) {
        throw new Error("Failed to create DataModel: " + dataModelResult.error);
    }

    const sceneModel = sceneModelResult.value;
    const dataModel = dataModelResult.value;

    // Fetch the IFC file and pass its binary contents to the loader.
    // The loader populates both the renderable model and the semantic
    // model so that geometry and metadata remain linked.
    fetch(`../../models/Ifc4_SampleHouse/ifc/model.ifc`)
        .then(response => {
            response
                .arrayBuffer()
                .then(fileData => {

                    ifcLoader.load({
                        fileData,
                        sceneModel,
                        dataModel

                    }).then(() => {

                        // Signal that loading has completed so the demo can finalize
                        // its setup and hide any loading indicators.
                        demoHelper.finished();

                    }).catch(e => {
                        console.error(e);
                    });
                });
        });
});