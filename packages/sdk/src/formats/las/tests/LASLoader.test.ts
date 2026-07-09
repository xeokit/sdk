import {parse} from "@loaders.gl/core";
import {PointsPrimitive} from "../../../base/constants";
import {Scene} from "../../../model/scene";
import {LASLoader} from "../LASLoader";

jest.mock("@loaders.gl/core", () => ({parse: jest.fn()}));

function sceneModel(): any {
  const result = new Scene().createModel({id: "m"}) as any;
  if (result.ok === false) {
    throw new Error(result.error);
  }
  return result.value;
}

function parsedLAS(params: {
  positions?: number[];
  intensities?: number[];
  colors?: number[] | null;
} = {}): any {
  const positions = params.positions || [
    0, 0, 0,
    1, 0, 0,
    2, 0, 0,
    3, 0, 0,
    4, 0, 0,
  ];
  const intensities = params.intensities || [0, 16384, 32768, 49152, 65535];
  const colors = params.colors === undefined
    ? [
      10, 20, 30, 255,
      40, 50, 60, 255,
      70, 80, 90, 255,
      100, 110, 120, 255,
      130, 140, 150, 255,
    ]
    : params.colors;

  const attributes: any = {
    POSITION: {value: new Float32Array(positions), size: 3},
    intensity: {value: new Uint16Array(intensities), size: 1},
  };
  if (colors) {
    attributes.COLOR_0 = {value: new Uint8Array(colors), size: 4};
  }
  return {
    attributes,
    loaderData: {pointsFormatId: colors ? 3 : 1}
  };
}

function geometries(model: any): any[] {
  return Object.values(model.geometries) as any[];
}

function pointCount(model: any): number {
  let count = 0;
  for (const geom of geometries(model)) {
    count += (geom.positionsCompressed.length / 3) | 0;
  }
  return count;
}

describe("LASLoader", () => {

  beforeEach(() => {
    (parse as jest.Mock).mockReset();
  });

  it("keeps every point by default and writes matched point colors", async () => {
    (parse as jest.Mock).mockResolvedValue(parsedLAS());
    const model = sceneModel();

    await new LASLoader().load({fileData: new ArrayBuffer(1), sceneModel: model} as any);

    const geom = geometries(model)[0];
    expect(pointCount(model)).toBe(5);
    expect(geom.primitive).toBe(PointsPrimitive);
    expect(geom.colorsCompressed).toHaveLength(5 * 4);
    expect(Array.from(geom.colorsCompressed.slice(0, 12))).toEqual([
      10, 20, 30, 0,
      40, 50, 60, 64,
      70, 80, 90, 128,
    ]);
  });

  it("decimates by keeping every Nth point starting at the first point", async () => {
    (parse as jest.Mock).mockResolvedValue(parsedLAS());
    const model = sceneModel();

    await new LASLoader().load({fileData: new ArrayBuffer(1), sceneModel: model} as any, {skip: 2});

    const geom = geometries(model)[0];
    expect(pointCount(model)).toBe(3);
    expect(geom.colorsCompressed).toHaveLength(3 * 4);
    expect(Array.from(geom.colorsCompressed)).toEqual([
      10, 20, 30, 0,
      70, 80, 90, 128,
      130, 140, 150, 255,
    ]);
  });

  it("uses the point count, not the scalar component count, when centering", async () => {
    (parse as jest.Mock).mockResolvedValue(parsedLAS({
      positions: [
        3, 6, 9,
        6, 9, 12,
      ],
      intensities: [0, 65535],
      colors: null,
    }));
    const model = sceneModel();

    await new LASLoader().load({fileData: new ArrayBuffer(1), sceneModel: model} as any, {center: true});

    const aabb = geometries(model)[0].aabb;
    expect(Array.from(aabb)).toEqual([-1.5, -1.5, -1.5, 1.5, 1.5, 1.5]);
  });
});
