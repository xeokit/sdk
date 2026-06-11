import {createMat3, createMat4Float32, createMat4Float64, decomposeMat4} from "../matrix";
import {createVec3Float64, createVec4Float64} from "../vector";

// Behavioural guard for the matrix factories + decomposeMat4, so the @ts-ignore
// cleanup can't silently change what they allocate / compute.
const FACTORIES: Array<{name: string; fn: (v?: any) => any; ctor: any; len: number}> = [
  // createMat3 allocates via the configurable newFloatArray, which is Float64Array.
  {name: "createMat3",        fn: createMat3,        ctor: Float64Array, len: 9},
  {name: "createMat4Float32", fn: createMat4Float32, ctor: Float32Array, len: 16},
  {name: "createMat4Float64", fn: createMat4Float64, ctor: Float64Array, len: 16},
];

describe("matrix factory functions", () => {
  for (const {name, fn, ctor, len} of FACTORIES) {
    it(`${name}() allocates a zeroed ${ctor.name}(${len})`, () => {
      const m = fn();
      expect(m).toBeInstanceOf(ctor);
      expect(m).toHaveLength(len);
      expect(Array.from(m)).toEqual(new Array(len).fill(0));
    });

    it(`${name}(seed) copies the seed into a ${ctor.name}(${len})`, () => {
      const s = Array.from({length: len}, (_, i) => i + 1);
      const m = fn(s);
      expect(m).toBeInstanceOf(ctor);
      expect(m).toHaveLength(len);
      expect(Array.from(m)).toEqual(s);
    });
  }
});

describe("decomposeMat4", () => {
  it("decomposes a column-major translation + uniform scale matrix", () => {
    const s = 2, tx = 10, ty = 20, tz = 30;
    const mat = new Float64Array([
      s, 0, 0, 0,
      0, s, 0, 0,
      0, 0, s, 0,
      tx, ty, tz, 1,
    ]);
    const position = createVec3Float64();
    const quaternion = createVec4Float64();
    const scale = createVec3Float64();

    decomposeMat4(mat, position, quaternion, scale);

    expect(Array.from(position)).toEqual([tx, ty, tz]);
    expect(Array.from(scale).map(v => +v.toFixed(6))).toEqual([s, s, s]);
    // No rotation -> identity quaternion.
    expect(Array.from(quaternion).map(v => +v.toFixed(6))).toEqual([0, 0, 0, 1]);
  });
});
