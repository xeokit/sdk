// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

// Create a inspectors that sets up the Scene, Data, Viewer, and WebGLRenderer used by this demo.

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper
  .init()
  .then(() => {

    const {view, scene, data} = demoHelper;

    // Position the View camera so the demo model will be in frame.

    demoHelper.createView({
      camera: {
        "eye": [-0.000915541313801782, -21.65544666913458, -5.7500762951094835],
        "look": [-0.000915541313801782, -0.000915541313801782, -5.7500762951094835],
        "up": [0, 0, 1]
      },
    });

    // Create a DataModel to hold semantic objects, properties, and relationships.

    const dataModelResult = data.createModel({
      id: "demoModel",
    });

    if (!dataModelResult.ok) {
      throw new Error(dataModelResult.error);
    }

    const dataModel = dataModelResult.value;

    // Create PropertySets that describe reusable property groups for table components.

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

    // Create DataObjects that represent the table assembly and each of its parts.

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

    // Create aggregation relationships so the table object owns the tabletop and the tabletop owns the legs.

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

    // Create a SceneModel to hold geometry, meshes, and scene objects for rendering.

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

    // Create a reusable box geometry that will be instanced by the tabletop and each leg.

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

    // Create meshes that instance the box geometry with a transform and a color for each component.

    const createLeg = ({id, position, color}) => {
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

    // Create the tabletop mesh and scene object as a scaled instance of the same box geometry.

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

    // Signal that the demo is ready once all setup is complete.

    demoHelper.finished();
  });
