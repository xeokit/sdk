import * as WebIFC from "web-ifc";
import {TrianglesPrimitive} from "../../../base/constants";
import {parse} from "../versions/IFC4/parse";

function vector(values: number[]) {
  return {
    size: () => values.length,
    get: (index: number) => values[index],
  };
}

function createDataModelStub() {
  const propertySets: any[] = [];
  const objects: any[] = [];
  const relationships: any[] = [];

  return {
    dataModel: {
      createPropertySet: jest.fn((params: any) => {
        propertySets.push(params);
        return {ok: true, value: params};
      }),
      createObject: jest.fn((params: any) => {
        objects.push(params);
        return {ok: true, value: params};
      }),
      createRelationship: jest.fn((params: any) => {
        relationships.push(params);
        return {ok: true, value: params};
      }),
    } as any,
    propertySets,
    objects,
    relationships,
  };
}

function createSceneModelStub() {
  const geometries: Record<string, any> = {};
  const meshes: Record<string, any> = {};
  const objects: Record<string, any> = {};

  return {
    sceneModel: {
      createGeometry: jest.fn((params: any) => {
        geometries[params.id] = params;
        return {ok: true, value: params};
      }),
      createMesh: jest.fn((params: any) => {
        meshes[params.id] = params;
        return {ok: true, value: params};
      }),
      createObject: jest.fn((params: any) => {
        objects[params.id] = params;
        return {ok: true, value: params};
      }),
    } as any,
    geometries,
    meshes,
    objects,
  };
}

function createIfcApiStub() {
  const project = {
    expressID: 1,
    GlobalId: {value: "project"},
    Name: {value: "Project"},
  };
  Object.setPrototypeOf(project, {constructor: {name: "IfcProject"}});

  const wall = {
    expressID: 2,
    GlobalId: {value: "wall"},
    Name: {value: "Wall"},
  };
  Object.setPrototypeOf(wall, {constructor: {name: "IfcWall"}});

  const propertyRelation = {
    RelatedObjects: [{value: 2}],
    RelatingPropertyDefinition: {
      GlobalId: {value: "pset-wall"},
      Name: {value: "Wall Pset"},
      HasProperties: [
        {
          Name: {value: "FireRating"},
          NominalValue: {type: "IfcLabel", value: "REI60", valueType: "STRING"},
        },
      ],
    },
  };

  const aggregateRelation = {
    RelatingObject: {value: 1},
    RelatedObjects: [{value: 2}],
  };

  const geometry = {
    GetVertexData: () => 1,
    GetVertexDataSize: () => 18,
    GetIndexData: () => 2,
    GetIndexDataSize: () => 3,
  };

  return {
    OpenModel: jest.fn(() => 100),
    GetLineIDsWithType: jest.fn((_modelId: number, type: number) => {
      switch (type) {
        case WebIFC.IFCPROJECT:
          return vector([1]);
        case WebIFC.IFCRELDEFINESBYPROPERTIES:
          return vector([10]);
        case WebIFC.IFCRELAGGREGATES:
          return vector([20, 21]);
        case WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE:
          return vector([]);
        default:
          return vector([]);
      }
    }),
    GetLine: jest.fn((_modelId: number, expressId: number) => {
      if (expressId === 1) return project;
      if (expressId === 2) return wall;
      if (expressId === 10) return propertyRelation;
      if (expressId === 20 || expressId === 21) return aggregateRelation;
      return undefined;
    }),
    StreamAllMeshes: jest.fn((_modelId: number, callback: any) => {
      callback({
        expressID: 2,
        geometries: {
          size: () => 1,
          get: () => ({
            geometryExpressID: 200,
            flatTransformation: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]),
            color: {x: 0.1, y: 0.2, z: 0.3, w: 0.4},
          }),
        },
      });
    }),
    GetGeometry: jest.fn(() => geometry),
    GetVertexArray: jest.fn(() => new Float32Array([
      0, 0, 0, 0, 0, 1,
      1, 0, 0, 0, 0, 1,
      0, 1, 0, 0, 0, 1,
    ])),
    GetIndexArray: jest.fn(() => new Uint32Array([0, 1, 2])),
  };
}

describe("IFC4 parser", () => {

  it("builds data objects once for duplicate relations and copies scene geometry out of WebIFC buffers", async () => {
    const ifcAPI = createIfcApiStub();
    const {dataModel, propertySets, objects: dataObjects, relationships} = createDataModelStub();
    const {sceneModel, geometries, meshes, objects: sceneObjects} = createSceneModelStub();

    await parse(ifcAPI as any, {
      fileData: new Uint8Array([1, 2, 3]).buffer,
      dataModel,
      sceneModel,
    } as any, {
      layerId: "ifc-layer",
    });

    expect(propertySets).toEqual([
      {
        id: "pset-wall",
        type: "Default",
        schema: "IFC4",
        name: "Wall Pset",
        properties: [
          {
            name: "FireRating",
            type: "IfcLabel",
            value: "REI60",
            valueType: "STRING",
            description: "",
          },
        ],
      },
    ]);

    expect(dataObjects.map((object) => object.id)).toEqual(["project", "wall"]);
    expect(dataObjects[1].propertySetIds).toEqual(["pset-wall"]);
    expect(relationships).toEqual([
      {
        type: "IfcRelAggregates",
        schema: "IFC4",
        relatingObjectId: "project",
        relatedObjectId: "wall",
      },
    ]);

    const geometry = geometries["0"];
    expect(geometry.primitive).toBe(TrianglesPrimitive);
    expect(Array.from(geometry.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(Array.from(geometry.indices)).toEqual([0, 1, 2]);

    expect(meshes["1"].geometryId).toBe("0");
    expect(Array.from(meshes["1"].matrix)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]);
    expect(meshes["1"].color).toEqual([0.1, 0.2, 0.3]);
    expect(meshes["1"].opacity).toBe(0.4);
    expect(sceneObjects.wall).toEqual({
      id: "wall",
      meshIds: ["1"],
      layerId: "ifc-layer",
    });
  });
});
