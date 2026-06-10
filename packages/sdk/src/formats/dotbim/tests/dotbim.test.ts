import {encode as encode_1_0_0} from "../versions/1_0_0/encode";
import {parse as parse_1_0_0} from "../versions/1_0_0/parse";
import {encode as encode_1_1_0} from "../versions/1_1_0/encode";
import {parse as parse_1_1_0} from "../versions/1_1_0/parse";

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

// Builds a minimal single-mesh SceneModel. `color` is 0..1; we expose it as both
// `color` (read by 1.1.0) and `effectiveColor` (read by 1.0.0). The mesh carries
// both `matrix` (read via getMeshWorldMatrix in 1.0.0) and `worldMatrix` (read
// directly in 1.1.0).
function buildSource(matrix: number[], color: number[], opacity: number) {
  const geom = {id: "g1", positionsCompressed: quantize(QUAD_POSITIONS, QUAD_AABB), aabb: QUAD_AABB, indices: QUAD_INDICES};
  const mesh = {
    id: "mesh1",
    geometry: geom,
    color,
    effectiveColor: color,
    effectiveOpacity: opacity,
    matrix,
    worldMatrix: matrix,
  };
  const sceneModel: any = {
    scene: {coordinateSystem: {}},
    geometries: {g1: geom},
    objects: {Building1: {id: "Building1", meshes: [mesh]}},
  };
  return {sceneModel, mesh, geom};
}

describe("DotBIMExporter", () => {

  describe("v1.0.0", () => {

    it("encodes a SceneModel + DataModel to a .bim document", async () => {
      const {sceneModel} = buildSource(IDENTITY, [0.2, 0.4, 0.6], 0.5);
      const dataModel: any = {
        objects: {Building1: {id: "Building1", type: "IfcBuilding", name: "B1", description: "desc"}},
      };

      const bim = await encode_1_0_0({sceneModel, dataModel});

      // One mesh, one element.
      expect(bim.meshes).toHaveLength(1);
      expect(bim.elements).toHaveLength(1);

      const dbMesh = bim.meshes[0];
      expect(dbMesh.mesh_id).toBe("g1");
      // 4 quad corners → 12 coordinates, decompressed back to the unit quad.
      expect(dbMesh.coordinates).toHaveLength(12);
      expect(Array.from(dbMesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);

      const el = bim.elements[0];
      expect(el.info.id).toBe("Building1");
      expect(el.type).toBe("IfcBuilding");
      expect(el.info.Name).toBe("B1");
      expect(el.info.Description).toBe("desc");
      expect(el.mesh_id).toBe("g1");
      // 1.0.0 multiplies the effectiveColor (0..1) by 255.
      expect(el.color.r).toBeCloseTo(0.2 * 255, 6);
      expect(el.color.g).toBeCloseTo(0.4 * 255, 6);
      expect(el.color.b).toBeCloseTo(0.6 * 255, 6);
      // Identity matrix → origin position.
      expect(el.vector).toEqual({x: 0, y: 0, z: 0});
    });

    it("defaults element type/name/description when no DataModel is supplied", async () => {
      const {sceneModel} = buildSource(IDENTITY, [1, 1, 1], 1);
      const bim = await encode_1_0_0({sceneModel});
      const el = bim.elements[0];
      expect(el.type).toBe("None");
      expect(el.info.Name).toBe("None");
      expect(el.info.Description).toBe("None");
    });

    it("round-trips geometry + element back through the loader", async () => {
      const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  10, 20, 30, 1];
      const {sceneModel} = buildSource(matrix, [0.2, 0.4, 0.6], 0.5);
      const dataModel: any = {objects: {Building1: {id: "Building1", type: "IfcBuilding"}}};

      const bim = await encode_1_0_0({sceneModel, dataModel});

      const calls: {geom: any[]; mesh: any[]; object: any[]; dataObject: any[]} = {geom: [], mesh: [], object: [], dataObject: []};
      const dstScene: any = {
        createGeometry: (p: any) => { calls.geom.push(p);   return {ok: true, value: {}}; },
        createMesh:     (p: any) => { calls.mesh.push(p);   return {ok: true, value: {}}; },
        createObject:   (p: any) => { calls.object.push(p); return {ok: true, value: {}}; },
      };
      const dstData: any = {
        objects: {},
        createObject: (p: any) => { calls.dataObject.push(p); return {ok: true, value: {}}; },
      };

      await parse_1_0_0({fileData: bim, sceneModel: dstScene, dataModel: dstData});

      // Geometry carried over with the exported coordinates and indices.
      expect(calls.geom).toHaveLength(1);
      expect(calls.geom[0].id).toBe("g1");
      expect(calls.geom[0].positions).toHaveLength(12);

      // One mesh + one scene object.
      expect(calls.mesh).toHaveLength(1);
      expect(calls.object).toHaveLength(1);
      expect(calls.object[0].id).toBe("Building1");
      // Loader divides r/g/b by 255 → recovers the original 0..1 colour.
      expect(Array.from(calls.mesh[0].color).map((v: any) => +v.toFixed(2))).toEqual([0.2, 0.4, 0.6]);
      // Translation baked into the element's vector and recovered as the mesh position.
      expect(calls.mesh[0].position).toEqual([10, 20, 30]);

      // CityObject came back as a DataObject carrying the original type.
      expect(calls.dataObject).toHaveLength(1);
      expect(calls.dataObject[0].id).toBe("Building1");
      expect(calls.dataObject[0].type).toBe("IfcBuilding");
    });
  });

  describe("v1.1.0", () => {

    it("encodes a SceneModel + DataModel to a .bim document", async () => {
      // 1.1.0 writes mesh.color verbatim (no *255), so feed it 0..255 values.
      const {sceneModel} = buildSource(IDENTITY, [51, 102, 153], 0.5);
      const dataModel: any = {
        objects: {Building1: {id: "Building1", type: "IfcBuilding", name: "B1", description: "desc"}},
      };

      const bim = await encode_1_1_0({sceneModel, dataModel});

      expect(bim.meshes).toHaveLength(1);
      expect(bim.elements).toHaveLength(1);

      const dbMesh = bim.meshes[0];
      expect(dbMesh.mesh_id).toBe("g1");
      expect(dbMesh.coordinates).toHaveLength(12);
      expect(Array.from(dbMesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);

      const el = bim.elements[0];
      expect(el.info.id).toBe("Building1");
      expect(el.type).toBe("IfcBuilding");
      expect(el.info.Name).toBe("B1");
      expect(el.info.Description).toBe("desc");
      // 1.1.0 writes color verbatim.
      expect(el.color.r).toBe(51);
      expect(el.color.g).toBe(102);
      expect(el.color.b).toBe(153);
      expect(el.vector).toEqual({x: 0, y: 0, z: 0});
    });

    it("defaults element type/name/description when no DataModel is supplied", async () => {
      const {sceneModel} = buildSource(IDENTITY, [255, 255, 255], 1);
      const bim = await encode_1_1_0({sceneModel});
      const el = bim.elements[0];
      expect(el.type).toBe("None");
      expect(el.info.Name).toBe("None");
      expect(el.info.Description).toBe("None");
    });

    it("round-trips geometry + element back through the loader", async () => {
      const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  10, 20, 30, 1];
      const {sceneModel} = buildSource(matrix, [51, 102, 153], 0.5);
      const dataModel: any = {objects: {Building1: {id: "Building1", type: "IfcBuilding"}}};

      const bim = await encode_1_1_0({sceneModel, dataModel});

      const calls: {geom: any[]; mesh: any[]; object: any[]; dataObject: any[]} = {geom: [], mesh: [], object: [], dataObject: []};
      const dstScene: any = {
        createGeometry: (p: any) => { calls.geom.push(p);   return {ok: true, value: {}}; },
        createMesh:     (p: any) => { calls.mesh.push(p);   return {ok: true, value: {}}; },
        createObject:   (p: any) => { calls.object.push(p); return {ok: true, value: {}}; },
      };
      const dstData: any = {
        objects: {},
        createObject: (p: any) => { calls.dataObject.push(p); return {ok: true, value: {}}; },
      };

      await parse_1_1_0({fileData: bim, sceneModel: dstScene, dataModel: dstData});

      expect(calls.geom).toHaveLength(1);
      expect(calls.geom[0].id).toBe("g1");
      expect(calls.geom[0].positions).toHaveLength(12);

      expect(calls.mesh).toHaveLength(1);
      expect(calls.object).toHaveLength(1);
      expect(calls.object[0].id).toBe("Building1");
      // Loader divides the verbatim 0..255 colour by 255 → 0..1.
      expect(Array.from(calls.mesh[0].color).map((v: any) => +v.toFixed(2))).toEqual([0.2, 0.4, 0.6]);
      expect(calls.mesh[0].position).toEqual([10, 20, 30]);

      expect(calls.dataObject).toHaveLength(1);
      expect(calls.dataObject[0].id).toBe("Building1");
      expect(calls.dataObject[0].type).toBe("IfcBuilding");
    });
  });
});
