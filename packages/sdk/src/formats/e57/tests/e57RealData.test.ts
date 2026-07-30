import * as fs from "fs";
import * as path from "path";
import {readE57, decodeCompressedVector} from "../parser";
import {installE57TestGlobals} from "./installE57TestGlobals";

let restoreGlobals: (() => void) | null = null;

beforeAll(async () => {
  restoreGlobals = await installE57TestGlobals();
});

afterAll(() => {
  restoreGlobals?.();
});

function loadFixture(name: string): ArrayBuffer {
  const b = fs.readFileSync(path.join(__dirname, "fixtures", name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

// Real files produced by an independent E57 writer (CloudCompare / las2e57),
// covering the three field encodings the decoder must handle.
const FIXTURES = [
  {file: "tinyCartesianFloatRgb.e57", recordCount: 2090, encoding: "Float/single + 8-bit RGB", hasColor: true},
  {file: "bunnyDouble.e57", recordCount: 30571, encoding: "Float/double (default)", hasColor: false},
  {file: "bunnyInt24.e57", recordCount: 30571, encoding: "24-bit ScaledInteger", hasColor: false},
];

function boundsOfValid(col: Float64Array, invalid?: Float64Array): [number, number] {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < col.length; i++) {
    if (invalid && invalid[i] !== 0) continue;
    const v = col[i];
    expect(Number.isFinite(v)).toBe(true);
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return [mn, mx];
}

describe.each(FIXTURES)("E57 real-data decode: $file ($encoding)", ({file, recordCount, hasColor}) => {

  it("decodes recordCount points whose bounds match the file's cartesianBounds", () => {
    const {document, logical, header} = readE57(loadFixture(file));
    expect(document.pointClouds.length).toBeGreaterThanOrEqual(1);

    const pc = document.pointClouds[0];
    expect(pc.recordCount).toBe(recordCount);
    expect(pc.cartesianBounds).toBeDefined();

    const cols = decodeCompressedVector(logical, pc, header.pageSize);
    const X = cols.get("cartesianX")!;
    const Y = cols.get("cartesianY")!;
    const Z = cols.get("cartesianZ")!;
    expect(X).toHaveLength(recordCount);

    const invalid = cols.get("cartesianInvalidState");
    const b = pc.cartesianBounds!;
    const checks: Array<[Float64Array, number, number]> = [
      [X, b.xMinimum, b.xMaximum],
      [Y, b.yMinimum, b.yMaximum],
      [Z, b.zMinimum, b.zMaximum],
    ];
    for (const [col, lo, hi] of checks) {
      const [mn, mx] = boundsOfValid(col, invalid);
      const tol = Math.max(1e-3, (hi - lo) * 0.01);
      expect(Math.abs(mn - lo)).toBeLessThan(tol);
      expect(Math.abs(mx - hi)).toBeLessThan(tol);
    }
  });

  if (hasColor) {
    it("decodes 8-bit RGB into [0, 255]", () => {
      const {document, logical, header} = readE57(loadFixture(file));
      const cols = decodeCompressedVector(logical, document.pointClouds[0], header.pageSize);
      const red = cols.get("colorRed")!;
      expect(red).toHaveLength(recordCount);
      for (let i = 0; i < red.length; i++) {
        expect(red[i]).toBeGreaterThanOrEqual(0);
        expect(red[i]).toBeLessThanOrEqual(255);
      }
    });
  }
});
