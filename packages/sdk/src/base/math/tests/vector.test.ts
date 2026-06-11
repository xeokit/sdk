import {
  createVec2Float64, createVec2Float32, createVec2Int32, createVec2Int16, createVec2Uint16,
  createVec3Float64, createVec3Float32, createVec3Int32, createVec3Int16,
  createVec4Float64, createVec4Float32, createVec4Int32, createVec4Int16,
  createVec9Float64, createVec9Float32,
} from "../vector";

// Behavioural guard for the createVec* factory functions, so the @ts-ignore
// cleanup on these can't silently change what they allocate. Each factory:
//   - with no arg → a zeroed typed array of the right kind + length
//   - with a seed → a typed array of the right kind copying the seed values
const FACTORIES: Array<{name: string; fn: (v?: any) => any; ctor: any; len: number}> = [
  {name: "createVec2Float64", fn: createVec2Float64, ctor: Float64Array, len: 2},
  {name: "createVec2Float32", fn: createVec2Float32, ctor: Float32Array, len: 2},
  {name: "createVec2Int32",   fn: createVec2Int32,   ctor: Int32Array,   len: 2},
  {name: "createVec2Int16",   fn: createVec2Int16,   ctor: Int16Array,   len: 2},
  {name: "createVec2Uint16",  fn: createVec2Uint16,  ctor: Uint16Array,  len: 2},
  {name: "createVec3Float64", fn: createVec3Float64, ctor: Float64Array, len: 3},
  {name: "createVec3Float32", fn: createVec3Float32, ctor: Float32Array, len: 3},
  {name: "createVec3Int32",   fn: createVec3Int32,   ctor: Int32Array,   len: 3},
  {name: "createVec3Int16",   fn: createVec3Int16,   ctor: Int16Array,   len: 3},
  {name: "createVec4Float64", fn: createVec4Float64, ctor: Float64Array, len: 4},
  {name: "createVec4Float32", fn: createVec4Float32, ctor: Float32Array, len: 4},
  {name: "createVec4Int32",   fn: createVec4Int32,   ctor: Int32Array,   len: 4},
  {name: "createVec4Int16",   fn: createVec4Int16,   ctor: Int16Array,   len: 4},
  {name: "createVec9Float64", fn: createVec9Float64, ctor: Float64Array, len: 9},
  {name: "createVec9Float32", fn: createVec9Float32, ctor: Float32Array, len: 9},
];

const seed = (n: number) => Array.from({length: n}, (_, i) => i + 1);

describe("vector factory functions", () => {
  for (const {name, fn, ctor, len} of FACTORIES) {
    it(`${name}() allocates a zeroed ${ctor.name}(${len})`, () => {
      const v = fn();
      expect(v).toBeInstanceOf(ctor);
      expect(v).toHaveLength(len);
      expect(Array.from(v)).toEqual(new Array(len).fill(0));
    });

    it(`${name}(seed) copies the seed into a ${ctor.name}(${len})`, () => {
      const s = seed(len);
      const v = fn(s);
      expect(v).toBeInstanceOf(ctor);
      expect(v).toHaveLength(len);
      expect(Array.from(v)).toEqual(s);
    });
  }
});
