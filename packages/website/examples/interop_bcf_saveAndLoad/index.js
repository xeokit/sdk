// Import the xeokit SDK bundle used by this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

    const { scene, data, renderer } = studio;

    const ifcLoader = new xeokit.formats.ifc.IFCLoader();

    const view = studio.viewManager.createView({
        camera: {
            eye: [-15.87, 10.09, 10.94],
            look: [-3.91, 1.72, 1.19],
            up: [0.45, -0.31, 0.83],
        }
    });

    const sceneModelResult = scene.createModel({
        id: "demoModel",
        coordinateSystem: {
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            origin: [0, 0, 0],
            units: "meters"
        }
    });

    if (!sceneModelResult.ok) {
        throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
    }

    const dataModelResult = data.createModel({ id: "demoModel" });

    if (!dataModelResult.ok) {
        throw new Error("Failed to create DataModel: " + dataModelResult.error);
    }

    const sceneModel = sceneModelResult.value;
    const dataModel = dataModelResult.value;

    fetch(`../../models/IfcOpenHouse4/ifc/model.ifc`)
        .then(response => response.arrayBuffer())
        .then(fileData => {

            ifcLoader.load({
                fileData,
                sceneModel,
                dataModel
            }).then(() => {

                // ---------------------------------------------------------
                // Step 1: Set up a viewpoint state to capture.
                //
                // Select a few objects and x-ray a few others to create
                // a visible scene state, then add a section plane to
                // demonstrate clipping plane round-trip.
                // ---------------------------------------------------------

                const allObjectIds = view.objectIds;

                // Select the first 3 objects.
                const selectedIds = allObjectIds.slice(0, 3);
                view.setObjectsSelected(selectedIds, true);

                // X-ray the next 3 objects.
                const xrayedIds = allObjectIds.slice(3, 6);
                view.setObjectsXRayed(xrayedIds, true);

                // Hide a few objects.
                const hiddenIds = allObjectIds.slice(6, 9);
                view.setObjectsVisible(hiddenIds, false);

                // Add a section plane cutting through the model along Y axis.
                view.createSectionPlane({
                    id: "sectionPlane1",
                    pos: [0, 2.5, 0],
                    dir: [0, -1, 0]
                });

                // ---------------------------------------------------------
                // Step 2: Save the BCF viewpoint.
                //
                // saveBCFViewpoint captures the camera position, section
                // planes, and per-object states (selection, x-ray,
                // visibility, coloring) into a plain JSON object.
                // ---------------------------------------------------------

                const saveResult = xeokit.interop.bcf.saveBCFViewpoint({
                    view,
                    originatingSystem: "xeokit-sdk-example"
                });

                if (!saveResult.ok) {
                    throw new Error("Failed to save BCF viewpoint: " + saveResult.error);
                }

                const bcfViewpoint = saveResult.value;

                console.log("Saved BCF viewpoint:", JSON.stringify(bcfViewpoint, null, 2));

                // ---------------------------------------------------------
                // Step 3: Reset the scene to a neutral state.
                //
                // Clear all object states and section planes so we can
                // verify that loadBCFViewpoint restores them from scratch.
                // ---------------------------------------------------------

                view.setObjectsSelected(view.selectedObjectIds, false);
                view.setObjectsXRayed(view.xrayedObjectIds, false);
                view.setObjectsVisible(view.objectIds, true);
                view.clearSectionPlanes();

                // Move the camera to a different position so we can see
                // the camera restore as well.
                view.camera.eye = [30, 30, 30];
                view.camera.look = [0, 0, 0];
                view.camera.up = [0, 1, 0];

                // ---------------------------------------------------------
                // Step 4: Restore the BCF viewpoint.
                //
                // loadBCFViewpoint applies the saved camera, section planes,
                // and object states back into the view.  The Data instance is
                // required so that the loader can resolve IFC GUIDs to the
                // correct ViewObjects.
                // ---------------------------------------------------------

                xeokit.interop.bcf.loadBCFViewpoint({
                    bcfViewpoint,
                    view,
                    data,
                    originatingSystem: "xeokit-sdk-example",
                    reset: true
                });

                console.log("BCF viewpoint restored.");
                console.log("Selected objects:", view.selectedObjectIds);
                console.log("X-rayed objects:", view.xrayedObjectIds);
                console.log("Section planes:", Object.keys(view.sectionPlanes).length);

                studio.finished();

            }).catch(e => {
                console.error(e);
            });
        });
});
