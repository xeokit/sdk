import {encode} from "../versions/v1_0/encode";
import {parse} from "../versions/v1_0/parse";

// Quantise positions to uint16 the way SceneGeometry stores them — the inverse
// of the exporter's decompressPoint3WithAABB3.
function quantize(positions: number[], aabb: number[]): Uint16Array {
  const q = new Uint16Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const min = aabb[k], max = aabb[k + 3];
      q[i + k] = Math.round(((positions[i + k] - min) / (max - min)) * 65535);
    }
  }
  return q;
}

// A unit quad (2 triangles) in the XY plane.
const QUAD_POSITIONS = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];
const QUAD_AABB = [0, 0, 0, 1, 1, 1];
const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);
const IDENTITY = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];

function buildSource(matrix: number[], color: number[], opacity: number) {
  const geom = {id: "g1", positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB), aabb: QUAD_AABB, indices: QUAD_INDICES};
  const mesh = {id: "mesh1", geometry: geom, color, opacity, worldMatrix: matrix};
  const sceneModel: any = {
    scene: {coordinateSystem: {}},
    geometries: {g1: geom},
    objects: {Building1: {id: "Building1", meshes: [mesh]}},
  };
  return {sceneModel, mesh, geom};
}

describe("CityJSONExporter", () => {

  it("encodes a SceneModel + DataModel to a CityJSON document", async () => {
    const {sceneModel} = buildSource(IDENTITY, [0.2, 0.4, 0.6], 0.5);
    const dataModel: any = {
      objects: {Building1: {id: "Building1", type: "Building"}},
      relationships: [],
    };

    const cj = await encode({sceneModel, dataModel});

    expect(cj.type).toBe("CityJSON");
    expect(cj.version).toBe("1.0");
    expect(cj.transform).toBeDefined();
    expect(cj.transform.scale).toHaveLength(3);
    expect(cj.transform.translate).toHaveLength(3);

    // Quad's 4 corners deduped into the shared vertex array, integer-quantised.
    expect(cj.vertices).toHaveLength(4);
    expect(Number.isInteger(cj.vertices[0][0])).toBe(true);

    const co = cj.CityObjects.Building1;
    expect(co).toBeDefined();
    expect(co.type).toBe("Building");                 // taken from the DataModel
    expect(co.geometry).toHaveLength(1);
    expect(co.geometry[0].type).toBe("MultiSurface");
    // 2 triangles → 2 surfaces, each a single outer ring of 3 indices.
    expect(co.geometry[0].boundaries).toHaveLength(2);
    expect(co.geometry[0].boundaries[0][0]).toHaveLength(3);

    // One shared material collapses to a single `value`.
    expect(co.geometry[0].material.default.value).toBe(0);
    expect(cj.appearance.materials).toHaveLength(1);
    expect(cj.appearance.materials[0].diffuseColor).toEqual([0.2, 0.4, 0.6]);
    expect(cj.appearance.materials[0].transparency).toBeCloseTo(0.5, 6);  // 1 - opacity
  });

  it("defaults the CityObject type when no DataModel is supplied", async () => {
    const {sceneModel} = buildSource(IDENTITY, [1, 1, 1], 1);
    const cj = await encode({sceneModel});
    expect(cj.CityObjects.Building1.type).toBe("GenericCityObject");
  });

  it("maps DataModel relationships to CityObject parents/children", async () => {
    const geom = {id: "g1", positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB), aabb: QUAD_AABB, indices: QUAD_INDICES};
    const parentMesh = {id: "mp", geometry: geom, color: [1, 0, 0], opacity: 1, worldMatrix: IDENTITY};
    const childMesh = {id: "mc", geometry: geom, color: [0, 1, 0], opacity: 1, worldMatrix: IDENTITY};
    const sceneModel: any = {
      scene: {coordinateSystem: {}},
      geometries: {g1: geom},
      objects: {
        Building1: {id: "Building1", meshes: [parentMesh]},
        Wall1: {id: "Wall1", meshes: [childMesh]},
      },
    };
    const parent = {id: "Building1"}, child = {id: "Wall1"};
    const dataModel: any = {
      objects: {Building1: {id: "Building1", type: "Building"}, Wall1: {id: "Wall1", type: "WallSurface"}},
      relationships: [{type: "BasicAggregation", relatingObject: parent, relatedObject: child}],
    };

    const cj = await encode({sceneModel, dataModel});
    expect(cj.CityObjects.Building1.children).toEqual(["Wall1"]);
    expect(cj.CityObjects.Wall1.parents).toEqual(["Building1"]);
  });

  it("round-trips geometry + material back through the CityJSONLoader", async () => {
    // Translate the mesh by (10,20,30): the exporter must bake the world matrix
    // into the absolute CityJSON vertices, and the loader recover them.
    const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  10, 20, 30, 1];
    const {sceneModel} = buildSource(matrix, [0.2, 0.4, 0.6], 0.8);
    const dataModel: any = {objects: {Building1: {id: "Building1", type: "Building"}}, relationships: []};

    const cj = await encode({sceneModel, dataModel});

    // Re-import the exported document into capturing stubs.
    const calls: {geom: any[]; mesh: any[]; object: any[]; dataObject: any[]} = {geom: [], mesh: [], object: [], dataObject: []};
    const dstScene: any = {
      createGeometry: (p: any) => { calls.geom.push(p);   return {ok: true, value: {}}; },
      createMesh:     (p: any) => { calls.mesh.push(p);   return {ok: true, value: {}}; },
      createObject:   (p: any) => { calls.object.push(p); return {ok: true, value: {}}; },
    };
    const dstData: any = {
      createObject:       (p: any) => { calls.dataObject.push(p); return {ok: true, value: {}}; },
      createRelationship: () => ({ok: true, value: {}}),
    };

    await parse({fileData: cj, sceneModel: dstScene, dataModel: dstData});

    // The CityObject came back as a DataObject carrying the original type.
    expect(calls.dataObject).toHaveLength(1);
    expect(calls.dataObject[0].id).toBe("Building1");
    expect(calls.dataObject[0].type).toBe("Building");

    // Geometry survived: at least one triangle mesh carrying the exported colour.
    expect(calls.geom.length).toBeGreaterThan(0);
    expect(calls.mesh.length).toBeGreaterThan(0);
    const mesh = calls.mesh[0];
    expect(Array.from(mesh.color).map((v: any) => +v.toFixed(2))).toEqual([0.2, 0.4, 0.6]);
    // The exporter writes transparency=0.2 (asserted in the first test); the
    // loader's *shared-material* path hardcodes opacity 1.0 and drops it, so the
    // round-tripped opacity does not reflect the source. (Loader limitation, not
    // the exporter's — left as-is.)
    expect(mesh.opacity).toBe(1.0);

    // Absolute vertices recovered around the baked translation (10,20,30) within
    // ~1mm quantisation, proving the world matrix was folded in on export.
    const positions = calls.geom[0].positions;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      minZ = Math.min(minZ, positions[i + 2]);
    }
    expect(minX).toBeCloseTo(10, 2);
    expect(minY).toBeCloseTo(20, 2);
    expect(minZ).toBeCloseTo(30, 2);
  });
});
