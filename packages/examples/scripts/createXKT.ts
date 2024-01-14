import * as xeokit from "../dist/xeokit-bundle.js";

function log(msg: string) {
    console.log("[LOG]: " + (msg + "\n"));
}

function error(msg: string) {
    console.error("[ERROR]: " + (msg + "\n"));
}

log("// Building a scene model and data model and saving them to an XKT file")

log("scene = new Scene()");
log("data  = new Data()");

const scene = new xeokit.scene.Scene();
const data = new xeokit.data.Data();

log("sceneModel = scene.createModel(..)");

const sceneModel = scene.createModel({
    id: "myModel"
});

if (sceneModel instanceof xeokit.core.SDKError) {
    error(sceneModel.message);
} else {

    log("sceneModel.createGeometry(..)");

    const geometry = sceneModel.createGeometry({
        id: "boxGeometry",
        primitive: xeokit.constants.TrianglesPrimitive,
        positions: [
            1, 1, 1, 0, 1, 1,
            0, 0, 1, 1, 0, 1, 1,
            0, 0, 1, 1, 0, 0, 1, 0, 0,
            0, 0
        ],
        indices: [
            0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
            0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
            4, 7, 6, 4, 6, 5
        ]
    });

    if (geometry instanceof xeokit.core.SDKError) {
        error(geometry.message);
    }

    log("sceneModel.createLayerMesh(..) x5");

    const redLegMesh = sceneModel.createMesh({
        id: "redLegMesh",
        geometryId: "boxGeometry",
        position: [-4, -6, -4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [1, 0.3, 0.3]
    });

    if (redLegMesh instanceof xeokit.core.SDKError) {
        error(redLegMesh.message);
    }

    sceneModel.createMesh({
        id: "greenLegMesh",
        geometryId: "boxGeometry",
        position: [4, -6, -4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [0.3, 1.0, 0.3]
    });

    sceneModel.createMesh({
        id: "blueLegMesh",
        geometryId: "boxGeometry",
        position: [4, -6, 4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [0.3, 0.3, 1.0]
    });

    sceneModel.createMesh({
        id: "yellowLegMesh",
        geometryId: "boxGeometry",
        position: [-4, -6, 4],
        scale: [1, 3, 1],
        rotation: [0, 0, 0],
        color: [1.0, 1.0, 0.0]
    });

    sceneModel.createMesh({
        id: "tableTopMesh",
        geometryId: "boxGeometry",
        position: [0, -3, 0],
        scale: [6, 0.5, 6],
        rotation: [0, 0, 0],
        color: [1.0, 0.3, 1.0]
    });

    // Create five SceneObjects, each using a SceneMesh.
    // A SceneMesh belongs to exactly one SceneObject.

    log("sceneModel.createObject(..) x5");

    const redLegSceneObject = sceneModel.createObject({
        id: "redLegObject",
        meshIds: ["redLegMesh"]
    });

    if (redLegSceneObject instanceof xeokit.core.SDKError) {
        error(redLegSceneObject.message);
    }

    sceneModel.createObject({
        id: "greenLegObject",
        meshIds: ["greenLegMesh"]
    });

    sceneModel.createObject({
        id: "blueLegObject",
        meshIds: ["blueLegMesh"]
    });

    sceneModel.createObject({
        id: "yellowLegObject",
        meshIds: ["yellowLegMesh"]
    });

    sceneModel.createObject({
        id: "tableTopObject",
        meshIds: ["tableTopMesh"]
    });

    sceneModel.onBuilt.subscribe((theSceneModel) => {
        log("SceneModel built.");
    });

    sceneModel.onDestroyed.subscribe((theSceneModel) => {
        log("SceneModel destroyed.");
    });

    log("sceneModel.build(..)");

    sceneModel.build().then(() => {
        log("sceneModel.built = true");

        log("sceneModel.aabb = " + sceneModel.aabb)

        log("dataModel = data.createModel(..)");

        const dataModel = data.createModel({ // DataModel | SDKError
            id: "myTableModel"
        });

        if (dataModel instanceof xeokit.core.SDKError) {
            error(dataModel.message);

        } else {

            log("tableTopPropertySet = dataModel.createPropertySet(..)");

            const tableTopPropertySet = dataModel.createPropertySet({ // PropertySet | SDKError
                id: "tableTopPropertySet",
                name: "Table top properties",
                type: "",
                properties: [ // Property[]
                    {
                        name: "Weight",
                        value: 5,
                        type: "",
                        valueType: "",
                        description: "Weight of the table top"
                    },
                    {
                        name: "Height",
                        value: 12,
                        type: "",
                        valueType: "",
                        description: "Height of the table top"
                    }
                ]
            });

            if (tableTopPropertySet instanceof xeokit.core.SDKError) {
                error(tableTopPropertySet.message);
            }

            log("tableLegPropertySet = dataModel.createPropertySet(..)");

            const tableLegPropertySet = dataModel.createPropertySet({
                id: "tableLegPropertySet",
                name: "Table leg properties",
                type: "",
                properties: [
                    {
                        name: "Weight",
                        value: 5,
                        type: "",
                        valueType: "",
                        description: "Weight of the table leg"
                    },
                    {
                        name: "Height",
                        value: 12,
                        type: "",
                        valueType: "",
                        description: "Height of the table leg"
                    }
                ]
            });

            log("dataModel.createObject(..) x5");

            const myTableObject = dataModel.createObject({ // DataObject | SDKError
                id: "table",
                type: xeokit.basictypes.BasicEntity,
                name: "Table"
            });

            if (myTableObject instanceof xeokit.core.SDKError) {
                error(myTableObject.message);
            }

            dataModel.createObject({
                id: "redLeg",
                name: "Red table Leg",
                type: xeokit.basictypes.BasicEntity,
                propertySetIds: ["tableLegPropertySet"]
            });

            dataModel.createObject({
                id: "greenLeg",
                name: "Green table leg",
                type: xeokit.basictypes.BasicEntity,
                propertySetIds: ["tableLegPropertySet"]
            });

            dataModel.createObject({
                id: "blueLeg",
                name: "Blue table leg",
                type: xeokit.basictypes.BasicEntity,
                propertySetIds: ["tableLegPropertySet"]
            });

            dataModel.createObject({
                id: "yellowLeg",
                name: "Yellow table leg",
                type: xeokit.basictypes.BasicEntity,
                propertySetIds: ["tableLegPropertySet"]
            });

            dataModel.createObject({
                id: "tableTop",
                name: "Purple table top",
                type: xeokit.basictypes.BasicEntity,
                propertySetIds: ["tableTopPropertySet"]
            });

            log("dataModel.createRelationship(..) x5");

            const myRelationship = dataModel.createRelationship({
                type: xeokit.basictypes.BasicAggregation,
                relatingObjectId: "table",
                relatedObjectId: "tableTop"
            });

            if (myRelationship instanceof xeokit.core.SDKError) {
                error(myRelationship.message);
            }

            dataModel.createRelationship({
                type: xeokit.basictypes.BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "redLeg"
            });

            dataModel.createRelationship({
                type: xeokit.basictypes.BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "greenLeg"
            });

            dataModel.createRelationship({
                type: xeokit.basictypes.BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "blueLeg"
            });

            dataModel.createRelationship({
                type: xeokit.basictypes.BasicAggregation,
                relatingObjectId: "tableTop",
                relatedObjectId: "yellowLeg"
            });

            log("dataModel.build(..)");

            dataModel.build().then(() => {

                log("dataModel.built = true");

                const fileData = xeokit.xkt.saveXKT({
                    sceneModel, dataModel
                });

                log("fileData = xeokit.xkt.saveXKT({ sceneModel, dataModel })");

                log("fileData.byteLength = " + fileData.byteLength);

                log("Done.");

            }).catch((sdkError) => {
                error(sdkError.message);
            });
        }

    }).catch((sdkError) => {
        error(sdkError.message);
    });
}
