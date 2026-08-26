import type {Data, DataModel} from "@xeokit/sdk/model/data";
import type {Scene, SceneModel} from "@xeokit/sdk/model/scene";
import {buildMat4} from "@xeokit/sdk/model/scene";
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import type {Vec3, Vec3Float} from "@xeokit/sdk/base/math/vector";

export interface CreateDataModelTableParams {
  scene: Scene;
  data: Data;
  modelId?: string;
}

export interface CreateDataModelTableResult {
  sceneModel: SceneModel;
  dataModel: DataModel;
}

export const DataModelTableSchema = "MySchema";
export const DemoBoxGeometryId = "demoBoxGeometry";

export function createWeightHeightProperties(weight: number, height: number) {
  return [
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
}

export function createDemoBoxGeometryParams(id = DemoBoxGeometryId) {
  return {
    id,
    primitive: TrianglesPrimitive,
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
  };
}

export function createTablePartMatrix(params: {position: Vec3Float; scale: Vec3Float}) {
  return buildMat4(params);
}

export function createDataModelTable(params: CreateDataModelTableParams): CreateDataModelTableResult {
  const {scene, data} = params;
  const modelId = params.modelId ?? "demoModel";

  const dataModelResult = data.createModel({
    id: modelId,
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
    id: "redLeg",
    type: "BasicEntity",
    schema: DataModelTableSchema,
    name: "Red table leg",
    propertySetIds: ["tableLegPropertySet"],
  });

  dataModel.createObject({
    id: "greenLeg",
    type: "BasicEntity",
    schema: DataModelTableSchema,
    name: "Green table leg",
    propertySetIds: ["tableLegPropertySet"],
  });

  dataModel.createObject({
    id: "blueLeg",
    type: "BasicEntity",
    schema: DataModelTableSchema,
    name: "Blue table leg",
    propertySetIds: ["tableLegPropertySet"],
  });

  dataModel.createObject({
    id: "yellowLeg",
    type: "BasicEntity",
    schema: DataModelTableSchema,
    name: "Yellow table leg",
    propertySetIds: ["tableLegPropertySet"],
  });

  dataModel.createObject({
    id: "tableTop",
    type: "BasicEntity",
    schema: DataModelTableSchema,
    name: "Purple table top",
    propertySetIds: ["tableTopPropertySet"],
  });

  const rel0 = dataModel.createRelationship({
    type: "BasicAggregation",
    relatingObjectId: "table",
    relatedObjectId: "tableTop",
  });

  if (rel0.ok === false) {
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

  const sceneModelResult = scene.createModel({
    id: modelId,
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

  const createLeg = ({id, position, color}: {id: string; position: Vec3Float; color: Vec3}) => {
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
    id: "purpleTableTop",
    meshIds: ["purpleTableTopMesh"],
  });

  return {sceneModel, dataModel};
}
