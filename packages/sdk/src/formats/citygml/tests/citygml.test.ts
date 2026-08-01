/**
 * @jest-environment jsdom
 */

import {getCityGMLVersion} from "../CityGMLLoader";
import {parse} from "../versions/v2_0/parse";

const SAMPLE_CITYGML = `<?xml version="1.0" encoding="UTF-8"?>
<core:CityModel
  xmlns:core="http://www.opengis.net/citygml/2.0"
  xmlns:bldg="http://www.opengis.net/citygml/building/2.0"
  xmlns:gml="http://www.opengis.net/gml">
  <core:cityObjectMember>
    <bldg:Building gml:id="building-1">
      <gml:name>Building One</gml:name>
      <bldg:boundedBy>
        <bldg:WallSurface gml:id="wall-1">
          <gml:name>North Wall</gml:name>
          <bldg:lod2MultiSurface>
            <gml:MultiSurface>
              <gml:surfaceMember>
                <gml:Polygon gml:id="wall-poly-1">
                  <gml:exterior>
                    <gml:LinearRing>
                      <gml:posList srsDimension="3">0 0 0 1 0 0 1 1 0 0 1 0 0 0 0</gml:posList>
                    </gml:LinearRing>
                  </gml:exterior>
                </gml:Polygon>
              </gml:surfaceMember>
            </gml:MultiSurface>
          </bldg:lod2MultiSurface>
        </bldg:WallSurface>
      </bldg:boundedBy>
    </bldg:Building>
  </core:cityObjectMember>
</core:CityModel>`;

function createCaptureModels() {
  const calls: {
    geometry: any[];
    mesh: any[];
    sceneObject: any[];
    dataObject: any[];
    relationship: any[];
  } = {
    geometry: [],
    mesh: [],
    sceneObject: [],
    dataObject: [],
    relationship: []
  };

  const sceneModel: any = {
    createGeometry: (params: any) => {
      calls.geometry.push(params);
      return {ok: true, value: {}};
    },
    createMesh: (params: any) => {
      calls.mesh.push(params);
      return {ok: true, value: {}};
    },
    createObject: (params: any) => {
      calls.sceneObject.push(params);
      return {ok: true, value: {}};
    }
  };

  const dataModel: any = {
    createObject: (params: any) => {
      calls.dataObject.push(params);
      return {ok: true, value: {}};
    },
    createRelationship: (params: any) => {
      calls.relationship.push(params);
      return {ok: true, value: {}};
    }
  };

  return {calls, sceneModel, dataModel};
}

describe("CityGMLLoader", () => {

  it("detects CityGML versions from namespaces", () => {
    expect(getCityGMLVersion(SAMPLE_CITYGML)).toBe("2.0");
    expect(getCityGMLVersion(`<core:CityModel xmlns:core="http://www.opengis.net/citygml/3.0"/>`)).toBe("3.0");
    expect(getCityGMLVersion(`<core:CityModel xmlns:core="http://www.opengis.net/citygml/1.0"/>`)).toBe("1.0");
  });

  it("imports feature hierarchy and polygonal surface geometry", async () => {
    const {calls, sceneModel, dataModel} = createCaptureModels();

    await parse({fileData: SAMPLE_CITYGML, sceneModel, dataModel});

    expect(calls.dataObject.map(object => [object.id, object.type, object.name])).toEqual([
      ["building-1", "Building", "Building One"],
      ["wall-1", "WallSurface", "North Wall"]
    ]);
    expect(calls.relationship).toEqual([
      {
        relatingObjectId: "building-1",
        relatedObjectId: "wall-1",
        type: "BasicAggregation",
        schema: "citygml_2_0"
      }
    ]);

    expect(calls.sceneObject).toHaveLength(1);
    expect(calls.sceneObject[0].id).toBe("wall-1");
    expect(calls.geometry).toHaveLength(1);
    expect(calls.geometry[0].positions).toHaveLength(12);
    expect(calls.geometry[0].indices).toHaveLength(6);
    expect(calls.mesh[0].geometryId).toBe(calls.geometry[0].id);
  });

  it("subtracts localOrigin from georeferenced CityGML coordinates", async () => {
    const {calls, sceneModel} = createCaptureModels();
    const origin: [number, number, number] = [458868, 5438343, 112];
    const cityGML = SAMPLE_CITYGML.replace(
      "0 0 0 1 0 0 1 1 0 0 1 0 0 0 0",
      "458868 5438343 112 458869 5438343 112 458869 5438344 112 458868 5438344 112 458868 5438343 112"
    );

    await parse({fileData: cityGML, sceneModel}, {localOrigin: origin});

    expect(calls.geometry).toHaveLength(1);
    expect(calls.geometry[0].positions).toEqual([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0
    ]);
    expect(calls.geometry[0].indices).toHaveLength(6);
  });
});
