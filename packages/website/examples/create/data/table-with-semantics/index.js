import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {
  DataModelTableSchema,
  DemoBoxGeometryId,
  createDemoBoxGeometryParams,
  createTablePartMatrix,
  createWeightHeightProperties,
} from "../../../../libs/authoring/dist/building/index.js";

const studio = new xeokit.studio.Studio({});

studio
  .init()
  .then(() => {
    const {scene, data} = studio;

    studio.viewManager.createView({
      adaptiveQuality: false,
      camera: {
        projection: "perspective",
        far: 1000000,
        eye:  [14, -14, 10],
        look: [0,  0,   3],
        up:   [0,  0,   1],
      },
    });

    studio.viewProfiles?.setActiveProfile("realistic");

    // Author the semantic DataModel. This is independent from the renderable
    // SceneModel, but uses matching object IDs so tools can connect them.
    const dataModelResult = data.createModel({
      id: "demoModel",
      schema: DataModelTableSchema,
    });

    if (dataModelResult.ok === false) {
      throw new Error(dataModelResult.error);
    }

    const dataModel = dataModelResult.value;

    dataModel.createPropertySet({
      id: "tablePropertySet",
      name: "Table properties",
      type: "BasicPropertySet",
      schema: DataModelTableSchema,
      properties: createWeightHeightProperties(5, 12),
    });

    dataModel.createPropertySet({
      id: "tableTopPropertySet",
      name: "Table top properties",
      type: "BasicPropertySet",
      schema: DataModelTableSchema,
      properties: createWeightHeightProperties(10, 3),
    });

    dataModel.createPropertySet({
      id: "tableLegPropertySet",
      name: "Table leg properties",
      type: "BasicPropertySet",
      schema: DataModelTableSchema,
      properties: createWeightHeightProperties(5, 12),
    });

    dataModel.createObject({
      id: "table",
      type: "BasicEntity",
      schema: DataModelTableSchema,
      name: "Table",
      propertySetIds: ["tablePropertySet"],
    });

    dataModel.createObject({
      id: "tableTop",
      type: "BasicEntity",
      schema: DataModelTableSchema,
      name: "Purple table top",
      propertySetIds: ["tableTopPropertySet"],
    });

    for (const leg of [
      ["redLeg", "Red table leg"],
      ["greenLeg", "Green table leg"],
      ["blueLeg", "Blue table leg"],
      ["yellowLeg", "Yellow table leg"],
    ]) {
      dataModel.createObject({
        id: leg[0],
        type: "BasicEntity",
        schema: DataModelTableSchema,
        name: leg[1],
        propertySetIds: ["tableLegPropertySet"],
      });
    }

    const tableTopRelResult = dataModel.createRelationship({
      type: "BasicAggregation",
      relatingObjectId: "table",
      relatedObjectId: "tableTop",
    });

    if (tableTopRelResult.ok === false) {
      throw new Error(tableTopRelResult.error);
    }

    for (const legId of ["redLeg", "greenLeg", "blueLeg", "yellowLeg"]) {
      dataModel.createRelationship({
        type: "BasicAggregation",
        relatingObjectId: "tableTop",
        relatedObjectId: legId,
      });
    }

    // Author the renderable SceneModel. The reusable geometry and matrix
    // builders live in the shared examples library; the SDK authoring calls
    // remain explicit in this example.
    const sceneModelResult = scene.createModel({
      id: "demoModel",
      coordinateSystem: {
        basis: [
          1, 0, 0,
          0, 0, 1,
          0, 1, 0,
        ],
        origin: [0, 0, 0],
        units: "meters",
      },
    });

    if (sceneModelResult.ok === false) {
      throw new Error(sceneModelResult.error);
    }

    const sceneModel = sceneModelResult.value;

    sceneModel.createGeometry(createDemoBoxGeometryParams());

    const createLeg = ({id, position, color}) => {
      const meshId = `${id}Mesh`;

      sceneModel.createMesh({
        id: meshId,
        geometryId: DemoBoxGeometryId,
        matrix: createTablePartMatrix({
          position,
          scale: [1, 1, 3],
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
      position: [-4, -4, 3],
      color: [1, 0.3, 0.3],
    });

    createLeg({
      id: "greenLeg",
      position: [4, -4, 3],
      color: [0.3, 1.0, 0.3],
    });

    createLeg({
      id: "blueLeg",
      position: [4, 4, 3],
      color: [0.3, 0.3, 1.0],
    });

    createLeg({
      id: "yellowLeg",
      position: [-4, 4, 3],
      color: [1.0, 1.0, 0.0],
    });

    const tableTopMeshResult = sceneModel.createMesh({
      id: "purpleTableTopMesh",
      geometryId: DemoBoxGeometryId,
      matrix: createTablePartMatrix({
        position: [0, 0, 6],
        scale: [6, 6, 0.5],
      }),
      color: [1.0, 0.3, 1.0],
    });

    if (tableTopMeshResult.ok === false) {
      throw new Error(tableTopMeshResult.error);
    }

    sceneModel.createObject({
      id: "tableTop",
      meshIds: ["purpleTableTopMesh"],
    });

    studio.finished();
  });
