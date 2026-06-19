import * as fs from "fs";
import * as path from "path";
import {TrianglesPrimitive} from "../../../../base/constants";
import {decompressPositions3WithAABB3} from "../../../../base/math/compression";
import {Scene} from "../../../../model/scene/Scene";
import {Data} from "../../../../model/data/Data";
import {XKTLoader} from "../XKTLoader";
import {XKTExporter} from "../XKTExporter";
import {unpackXKT} from "../versions/v12/unpackXKT";

describe("XKTExporter — XKT v12", () => {
  it("encodes a v12 file whose geometry decodes back to the source positions", async () => {
    const scene = new Scene();
    const sceneModel = scene.createModel({id: "m"}).value!;
    sceneModel.createGeometry({id: "g", primitive: TrianglesPrimitive, positions: [0, 0, 0, 10, 0, 0, 0, 10, 0], indices: [0, 1, 2]});
    sceneModel.createMesh({id: "mesh1", geometryId: "g"});
    sceneModel.createObject({id: "obj1", meshIds: ["mesh1"]});
    const dataModel = new Data().createModel({id: "m"}).value!;
    dataModel.createObject({id: "obj1", name: "Object 1", type: "Default"});

    const buffer = await new XKTExporter().write({sceneModel, dataModel});

    // Header is XKT version 12.
    expect(new DataView(buffer).getUint32(0, true)).toBe(12);

    // Unpack and decode the single tile's positions back to world space.
    const d = unpackXKT(buffer);
    expect(Array.from(d.eachEntityId)).toEqual(["obj1"]);
    expect(d.eachGeometryPrimitiveType[0]).toBe(1); // triangles → surface code
    expect(d.metadata.metaObjects.map((o: any) => o.id)).toContain("obj1");

    const world = decompressPositions3WithAABB3(d.positions, Array.from(d.eachTileAABB) as any, new Float32Array(d.positions.length));
    const expected = [0, 0, 0, 10, 0, 0, 0, 10, 0];
    for (let i = 0; i < expected.length; i++) {
      expect(Math.abs(world[i] - expected[i])).toBeLessThan(0.01);
    }
  });

  it("round-trips the real Duplex model (export → re-import)", async () => {
    const xkt = path.resolve(__dirname, "fixtures/Duplex.xkt");
    const bytes = fs.readFileSync(xkt);
    const fileData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const srcScene = new Scene().createModel({id: "duplex"}).value!;
    const srcData = new Data().createModel({id: "duplex"}).value!;
    await new XKTLoader().load({fileData, sceneModel: srcScene, dataModel: srcData}, {});

    const out = await new XKTExporter().write({sceneModel: srcScene, dataModel: srcData});

    const dstScene = new Scene().createModel({id: "duplex2"}).value!;
    const dstData = new Data().createModel({id: "duplex2"}).value!;
    await new XKTLoader().load({fileData: out, sceneModel: dstScene, dataModel: dstData}, {});

    // Objects, meshes, and metadata survive the round-trip (geometry is not
    // instanced on export, so geometry count rises to one per mesh).
    expect(Object.keys(dstScene.objects).length).toBe(Object.keys(srcScene.objects).length);
    expect(Object.keys(dstScene.meshes).length).toBe(Object.keys(srcScene.meshes).length);
    expect(Object.keys(dstData.objects).length).toBe(Object.keys(srcData.objects).length);
  });
});
