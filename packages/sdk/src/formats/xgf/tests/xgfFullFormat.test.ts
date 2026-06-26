import {encode} from "../versions/v1/encode";
import {parse} from "../versions/v1/parse";
import {TrianglesPrimitive, PNGMediaType, sRGBEncoding} from "../../../base/constants";
import {Scene} from "../../../model/scene/Scene";

const TRI = {positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2]};
const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).buffer;

function capture() {
  const c: any = {geom: [], mat: [], tex: []};
  const sm: any = {
    id: "d", geometries: {},
    createGeometryCompressed: (p: any) => { c.geom.push(p); sm.geometries[p.id] = p; },
    createMesh: () => {}, createObject: () => {},
    createTexture: (p: any) => c.tex.push(p),
    createMaterial: (p: any) => c.mat.push(p),
  };
  return {sm, c};
}

// The whole point of the collapse: one version carries the full format. This
// exercises geometry + a textured PBR material whose colour multiplier exceeds
// 1.0 (the washout case) + per-texture sRGB encoding + per-material
// triplanarScale, all through a single export tagged version 1.
describe("xgf carries the full format", () => {

  it("round-trips geometry + material(colour>1) + texture(sRGB) + triplanar", async () => {
    const src = new Scene().createModel({id: "m"}).value!;
    src.createGeometry({id: "g", primitive: TrianglesPrimitive, ...TRI});
    src.createTexture({id: "tex", buffers: [PNG()], mediaType: PNGMediaType, encoding: sRGBEncoding});
    src.createMaterial({id: "mat", color: [1.6, 0.5, 0.2], metallic: 1, roughness: 0.3, colorTextureId: "tex", triplanarScale: 2.5});
    src.createMesh({id: "me", geometryId: "g", materialId: "mat"});
    src.createObject({id: "o", meshIds: ["me"]});

    const buf = await encode({sceneModel: src} as any, {});
    expect(new DataView(buf).getUint32(0, true)).toBe(1); // header tag 1

    const {sm, c} = capture();
    await parse({fileData: buf, sceneModel: sm} as any, {});

    expect(c.geom).toHaveLength(1);
    const mat = c.mat[0];
    expect(mat.color[0]).toBeCloseTo(1.6, 4);     // colour multiplier >1 survives (washout fix)
    expect(mat.color[1]).toBeCloseTo(0.5, 4);
    expect(mat.metallic).toBeCloseTo(1, 2);
    expect(mat.triplanarScale).toBeCloseTo(2.5, 4);
    const tex = c.tex.find((t: any) => t.id === "tex");
    expect(tex.encoding).toBe(sRGBEncoding);
  });
});
