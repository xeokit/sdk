// Import the xeokit SDK bundle. This bundle provides the demo helper
// along with scene, data, loader, and rendering APIs used by the example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper, which initializes the shared rendering context
// and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

    // Access the Scene and Data subsystems created by the Studio. The
    // Scene manages renderable content, while the Data subsystem manages
    // semantic model information.
    const { scene, data } = studio;

    // Create two Views with identical camera configurations in a +Z-up
    // coordinate system. This provides a consistent initial framing of the
    // model across multiple views.
    studio.viewManager.createView({
        id: "demoView",
        camera: {
            projection: "perspective",
            eye: [1841990.28, 5173295.70, 16.25],
            look: [1842022.29, 5173301.85, 10.49],
            up: [0.17, 0.03, 0.98]
        }
    });

    studio.viewManager.createView({
        id: "demoView2",
        camera: {
            projection: "perspective",
            eye: [1841990.28, 5173295.70, 16.25],
            look: [1842022.29, 5173301.85, 10.49],
            up: [0.17, 0.03, 0.98]
        }
    });

    // Create a SceneModel to hold renderable model content. The coordinate
    // system is defined explicitly to describe axis orientation and units.
    const sceneModelResult = scene.createModel({
        id: "demoModel",
        coordinateSystem: {
            basis: [
                1, 0, 0, // Right (+X)
                0, 1, 0, // Up (+Y)
                0, 0, -1 // Forward (-Z)
            ],
            origin: [0, 0, 0],
            units: "meters"
        }
    });

    // Ensure that the SceneModel was created successfully before continuing.
    if (!sceneModelResult.ok) {
        throw new Error(`Error creating SceneModel: ${sceneModelResult.error}`);
    }

    // Create a DataModel to hold semantic data such as object metadata and
    // relationships, separate from rendering concerns.
    const dataModelResult = data.createModel({
        id: "demoModel"
    });

    // Ensure that the DataModel was created successfully before continuing.
    if (dataModelResult.ok === false) {
        throw new Error(`Error creating SceneModel: ${dataModelResult.error}`);
    }

    const sceneModel = sceneModelResult.value;
    const dataModel = dataModelResult.value;

    // Create a GLTFLoader to load a glTF or GLB model into both the
    // SceneModel and DataModel.
    const gltfLoader = new xeokit.formats.gltf.GLTFLoader();

    // Fetch the binary GLB file, convert it to an ArrayBuffer, and pass it
    // to the loader.
    fetch("../../models/MAP/gltf/model.glb").then(response => {

        response
            .arrayBuffer()
            .then(fileData => {

                gltfLoader.load({
                    fileData,
                    sceneModel,
                    dataModel
                }).then(() => {

                    // At this point, the SceneModel contains a SceneObject for each
                    // renderable element in the model, and the DataModel contains the
                    // corresponding semantic structure.

                    studio.finished();

                }).catch(message => {
                    console.error(`Error loading glTF: ${message}`);
                });
            });
    });
});