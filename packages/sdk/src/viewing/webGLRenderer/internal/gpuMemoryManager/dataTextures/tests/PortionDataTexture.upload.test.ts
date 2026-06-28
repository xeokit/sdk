import {PortionDataTexture} from "../PortionDataTexture";

/**
 * Regression test for the partial (dirty-portion) upload path of
 * PortionDataTexture. The upload must address the texture in TEXELS: an item
 * spans `texelsPerItem` consecutive texels, so a texture with texelsPerItem > 1
 * (e.g. the 4-texel gaussian-splat record) must upload `size * texelsPerItem`
 * texels, split at texture-row boundaries — not `size` texels as if one item
 * were one texel. Getting this wrong scatters each splat's centre/colour/
 * covariance across the wrong texels ("fur").
 */

interface RecordedUpload {
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
}

function fakeGL(uploads: RecordedUpload[]): WebGL2RenderingContext {
  const gl: Record<string, unknown> = {
    TEXTURE_2D: 0x0de1,
    UNPACK_ALIGNMENT: 0x0cf5,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812f,
    FLOAT: 0x1406,
    UNSIGNED_BYTE: 0x1401,
    UNSIGNED_INT: 0x1405,
    UNSIGNED_SHORT: 0x1403,
    RGBA: 0x1908,
    RGBA32F: 0x8814,
    createTexture: () => ({}),
    deleteTexture: () => undefined,
    bindTexture: () => undefined,
    pixelStorei: () => undefined,
    texParameteri: () => undefined,
    texStorage2D: () => undefined,
    texSubImage2D: (
      _target: number, _level: number, x: number, y: number,
      width: number, height: number, _format: number, _type: number,
      data: ArrayLike<number>,
    ) => {
      uploads.push({x, y, width, height, data: Array.from(data as ArrayLike<number>)});
    },
  };
  return gl as unknown as WebGL2RenderingContext;
}

/** A 4-texels-per-item RGBA32F texture, like SplatDataTexture. */
class FourTexelTexture extends PortionDataTexture {
  constructor(gl: WebGL2RenderingContext, width: number, maxItems: number) {
    super({
      gl,
      description: "test",
      format: gl.RGBA,
      type: gl.FLOAT,
      internalFormat: (gl as unknown as {RGBA32F: number}).RGBA32F,
      maxItems,
      getNumItems: () => this.numItems,
      width,
      itemSizeInBytes: 16 * 4,
      texelsPerItem: 4,
      elementsPerTexel: 4,
    });
    this.debugging = false;
  }
  getItem(): number[] {
    return [];
  }
}

describe("PortionDataTexture partial upload (texelsPerItem > 1)", () => {

  it("uploads size*texelsPerItem texels, split at row boundaries", () => {
    const uploads: RecordedUpload[] = [];
    const gl = fakeGL(uploads);
    // width = 8 texels = 2 items per row (texelsPerItem 4).
    const tex = new FourTexelTexture(gl, 8, 8);
    expect(tex.allocate().ok).toBe(true);

    // 3 items => 48 elements (16 per item), occupying texels [0, 12).
    const data = Float32Array.from({length: 48}, (_, i) => i + 1);
    uploads.length = 0;
    const handle = tex.getPortion(data);
    expect(handle).not.toBeNull();

    expect(tex.uploadChanges()).toBe(true);

    // Total texels uploaded must be 3 items * 4 texels = 12 (not 3).
    const totalTexels = uploads.reduce((n, u) => n + u.width * u.height, 0);
    expect(totalTexels).toBe(12);

    // Row split: row 0 holds 8 texels, row 1 the remaining 4.
    expect(uploads).toEqual([
      {x: 0, y: 0, width: 8, height: 1, data: Array.from(data.subarray(0, 32))},
      {x: 0, y: 1, width: 4, height: 1, data: Array.from(data.subarray(32, 48))},
    ]);

    // Every upload's pixel payload is width * elementsPerTexel (= width * 4).
    for (const u of uploads) {
      expect(u.data.length).toBe(u.width * 4);
      expect(u.x + u.width).toBeLessThanOrEqual(8);
    }
  });
});
