import {ItemDataTexture} from "../ItemDataTexture";

/**
 * Regression test for the partial (dirty-item) upload path of ItemDataTexture.
 * The upload must address the texture in TEXELS: an item spans `texelsPerItem`
 * consecutive texels, so a texture with texelsPerItem > 1 (e.g. the 4-texel
 * matrix record) must upload `count * texelsPerItem` texels, split at texture-row
 * boundaries — not `count` texels as if one item were one texel. Getting this
 * wrong was why the partial path was disabled (full re-upload every frame).
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

/** A 4-texels-per-item RGBA32F item texture, like the matrix record. */
class FourTexelItemTexture extends ItemDataTexture {
  constructor(gl: WebGL2RenderingContext, width: number, maxItems: number) {
    super({
      gl,
      description: "test",
      format: gl.RGBA,
      type: gl.FLOAT,
      internalFormat: (gl as unknown as {RGBA32F: number}).RGBA32F,
      maxItems,
      getNumItems: () => maxItems,
      width,
      itemSizeInBytes: 16 * 4,
      texelsPerItem: 4,
      elementsPerTexel: 4,
      useBuffer: true,
    } as any);
    this.debugging = false;
  }
  setItem(itemIndex: number, values: number[]): void {
    const base = itemIndex * this.elementsPerItem;
    for (let i = 0; i < values.length; i++) this.buffer[base + i] = values[i];
    this.setItemDirty(itemIndex);
  }
  getItem(): number[] {
    return [];
  }
}

describe("ItemDataTexture partial upload (texelsPerItem > 1)", () => {

  it("uploads only dirty items, in texels, split at row boundaries", () => {
    const uploads: RecordedUpload[] = [];
    const gl = fakeGL(uploads);
    // width = 8 texels = 2 items per row (texelsPerItem 4).
    const tex = new FourTexelItemTexture(gl, 8, 8);
    expect(tex.allocate().ok).toBe(true);

    const item = (n: number) => Array.from({length: 16}, (_, i) => n * 100 + i);
    tex.setItem(0, item(0)); // texels 0..3  (row 0)
    tex.setItem(1, item(1)); // texels 4..7  (row 0) — contiguous with item 0
    tex.setItem(3, item(3)); // texels 12..15 (row 1, cols 4..7) — separate run

    uploads.length = 0;
    expect(tex.uploadChanges()).toBe(true);

    // Run [0,1] fills row 0 (8 texels); run [3] is 4 texels at (4,1).
    expect(uploads).toEqual([
      {x: 0, y: 0, width: 8, height: 1, data: [...item(0), ...item(1)]},
      {x: 4, y: 1, width: 4, height: 1, data: item(3)},
    ]);

    // 3 dirty items * 4 texels = 12 texels total (not 3).
    expect(uploads.reduce((n, u) => n + u.width * u.height, 0)).toBe(12);
    for (const u of uploads) {
      expect(u.data.length).toBe(u.width * 4);
      expect(u.x + u.width).toBeLessThanOrEqual(8);
    }

    // Dirty set cleared — a second flush with no changes uploads nothing.
    uploads.length = 0;
    expect(tex.uploadChanges()).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  it("uploads one bounded span when dirty items are dense", () => {
    const uploads: RecordedUpload[] = [];
    const gl = fakeGL(uploads);
    const tex = new FourTexelItemTexture(gl, 8, 40);
    expect(tex.allocate().ok).toBe(true);

    const item = (n: number) => Array.from({length: 16}, (_, i) => n * 100 + i);
    for (let i = 0; i < 32; i++) {
      tex.setItem(i, item(i));
    }

    uploads.length = 0;
    expect(tex.uploadChanges()).toBe(true);

    expect(uploads).toHaveLength(16);
    expect(uploads[0]).toEqual({x: 0, y: 0, width: 8, height: 1, data: [...item(0), ...item(1)]});
    expect(uploads[15]).toEqual({x: 0, y: 15, width: 8, height: 1, data: [...item(30), ...item(31)]});
    expect(uploads.reduce((n, u) => n + u.width * u.height, 0)).toBe(128);
  });
});
