// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene, data, and rendering APIs used by this
// example.
import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create the demo helper. This helper initializes the shared runtime
// context and provides utilities for configuring and running the demo.
const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
    .init()
    .then(() => {

        // Access the View, Scene, and Data subsystems created by the
        // DemoHelper. The Scene manages renderable content, while the
        // Data subsystem manages semantic model structure and metadata.
        const { view, scene, data } = demoHelper;

        // Create a View and position the camera so the table model is in
        // frame. This provides a stable initial viewpoint for the sample.
        demoHelper.createView({
            camera: {
                eye: [-0.00, -21.66, -5.75],
                look: [-0.00, -0.00, -5.75],
                up: [0, 0, 1]
            },
        });

        // Create a DataModel to hold semantic content such as objects,
        // relationships, and property sets.
        const dataModelResult = data.createModel({
            id: "demoModel",
        });

        if (!dataModelResult.ok) {
            throw new Error(dataModelResult.error);
        }

        const dataModel = dataModelResult.value;

        // Define reusable property sets for the table components. These
        // provide a consistent set of metadata that can be queried later.
        const makeWeightHeightProps = (weight, height) => [
            {
                name: "Weight",
                value: weight,
                type: "",
                valueType: "",
                description: "Weight of the thing",
            },
            {
                name: "Height",
                value: height,
                type: "",
                valueType: "",
                description: "Height of the thing",
            },
        ];

        dataModel.createPropertySet({
            id: "tablePropertySet",
            name: "Table properties",
            type: "BasicPropertySet",
            schema: "MySchema",
            properties: makeWeightHeightProps(5, 12),
        });

        dataModel.createPropertySet({
            id: "tableTopPropertySet",
            name: "Table top properties",
            type: "BasicPropertySet",
            schema: "MySchema",
            properties: makeWeightHeightProps(10, 3),
        });

        dataModel.createPropertySet({
            id: "tableLegPropertySet",
            name: "Table leg properties",
            type: "BasicPropertySet",
            schema: "MySchema",
            properties: makeWeightHeightProps(5, 12),
        });

        // Create DataObjects for the table and its parts. These objects define
        // the semantic structure independently from the renderable geometry.
        dataModel.createObject({
            id: "table",
            type: "BasicEntity",
            schema: "MySchema",
            name: "Table",
            propertySetIds: ["tablePropertySet"],
        });

        dataModel.createObject({
            id: "redLeg",
            type: "BasicEntity",
            schema: "MySchema",
            name: "Red table leg",
            propertySetIds: ["tableLegPropertySet"],
        });

        dataModel.createObject({
            id: "greenLeg",
            type: "BasicEntity",
            schema: "MySchema",
            name: "Green table leg",
            propertySetIds: ["tableLegPropertySet"],
        });

        dataModel.createObject({
            id: "blueLeg",
            type: "BasicEntity",
            schema: "MySchema",
            name: "Blue table leg",
            propertySetIds: ["tableLegPropertySet"],
        });

        dataModel.createObject({
            id: "yellowLeg",
            type: "BasicEntity",
            schema: "MySchema",
            name: "Yellow table leg",
            propertySetIds: ["tableLegPropertySet"],
        });

        dataModel.createObject({
            id: "tableTop",
            type: "BasicEntity",
            schema: "MySchema",
            name: "Purple table top",
            propertySetIds: ["tableTopPropertySet"],
        });

        // Create aggregation relationships between the table components.
        // The table contains the top, and the top contains the legs.
        const rel0 = dataModel.createRelationship({
            type: "BasicAggregation",
            relatingObjectId: "table",
            relatedObjectId: "tableTop",
        });

        if (!rel0.ok) {
            throw new Error(rel0.error);
        }

        dataModel.createRelationship({
            type: "BasicAggregation",
            relatingObjectId: "tableTop",
            relatedObjectId: "redLeg",
        });

        dataModel.createRelationship({
            type: "BasicAggregation",
            relatingObjectId: "tableTop",
            relatedObjectId: "greenLeg",
        });

        dataModel.createRelationship({
            type: "BasicAggregation",
            relatingObjectId: "tableTop",
            relatedObjectId: "blueLeg",
        });

        dataModel.createRelationship({
            type: "BasicAggregation",
            relatingObjectId: "tableTop",
            relatedObjectId: "yellowLeg",
        });

        // Create a SceneModel to hold the renderable content. Geometry,
        // meshes, and scene objects are stored here.
        const sceneModelResult = scene.createModel({
            id: "demoModel",
            coordinateSystem: {
                basis: [
                    1, 0, 0,
                    0, 1, 0,
                    0, 0, 1
                ],
                origin: [0, 0, 0],
                units: "meters"
            }
        });

        if (!sceneModelResult.ok) {
            throw new Error(sceneModelResult.error);
        }

        const sceneModel = sceneModelResult.value;

        // Create a reusable box geometry. Multiple meshes will instance this
        // geometry for the tabletop and legs.
        sceneModel.createGeometry({
            id: "demoBoxGeometry",
            primitive: xeokit.constants.TrianglesPrimitive,
            positions: [
                1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1,
                1, -1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1,
                -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1,
                -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
            ],
            indices: [
                0, 1, 2, 0, 2, 3,
                4, 5, 6, 4, 6, 7,
                8, 9, 10, 8, 10, 11,
                12, 13, 14, 12, 14, 15,
                16, 17, 18, 16, 18, 19,
                20, 21, 22, 20, 22, 23,
            ],
        });

        // Create meshes from the shared geometry, applying per-part transforms
        // and colors. A small helper keeps the repeated setup concise.
        const createLeg = ({ id, position, color }) => {
            const meshId = `${id}Mesh`;

            sceneModel.createMesh({
                id: meshId,
                geometryId: "demoBoxGeometry",
                matrix: xeokit.scene.buildMat4({
                    position,
                    scale: [1, 3, 1],
                }),
                color,
            });

            sceneModel.createObject({
                id,
                meshIds: [meshId],
            });
        };

        createLeg({
            id: "redLeg",
            position: [-4, -6, -4],
            color: [1, 0.3, 0.3],
        });

        createLeg({
            id: "greenLeg",
            position: [4, -6, -4],
            color: [0.3, 1.0, 0.3],
        });

        createLeg({
            id: "blueLeg",
            position: [4, -6, 4],
            color: [0.3, 0.3, 1.0],
        });

        createLeg({
            id: "yellowLeg",
            position: [-4, -6, 4],
            color: [1.0, 1.0, 0.0],
        });

        // Create the tabletop as another instance of the same geometry.
        // Only the transform and color differ from the legs.
        const tableTopMeshResult = sceneModel.createMesh({
            id: "purpleTableTopMesh",
            geometryId: "demoBoxGeometry",
            matrix: xeokit.scene.buildMat4({
                position: [0, -3, 0],
                scale: [6, 0.5, 6],
            }),
            color: [1.0, 0.3, 1.0],
        });

        if (!tableTopMeshResult.ok) {
            throw new Error(tableTopMeshResult.error);
        }

        sceneModel.createObject({
            id: "purpleTableTop",
            meshIds: ["purpleTableTopMesh"],
        });

        // Signal that setup has completed. At this point, both the semantic
        // and renderable representations of the table have been created.
        demoHelper.finished();
    });