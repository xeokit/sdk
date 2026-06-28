import {octEncodeNormalsToU16, octDecodeNormalsU16, decompressNormals} from "../compression";

function angleDeg(a: number[], b: number[]): number {
  const la = Math.hypot(a[0], a[1], a[2]) || 1;
  const lb = Math.hypot(b[0], b[1], b[2]) || 1;
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

// octDecodeNormalsU16 must be the exact inverse of octEncodeNormalsToU16.
// The exporter previously decoded these U16-oct normals with decompressNormals
// (a different oct format), which corrupted every exported normal.
describe("octEncodeNormalsToU16 / octDecodeNormalsU16", () => {

  const normals = [
    1, 0, 0,  0, 1, 0,  0, 0, 1,
    -1, 0, 0,  0, -1, 0,  0, 0, -1,
    0.5773, 0.5773, 0.5773,
    -0.5773, 0.5773, -0.5773,
    0.267, -0.535, 0.802,
  ];

  it("round-trips unit normals to within 16-bit oct precision", () => {
    const encoded = octEncodeNormalsToU16(normals);
    const decoded = octDecodeNormalsU16(encoded);
    let maxDeg = 0;
    for (let i = 0; i < normals.length; i += 3) {
      const deg = angleDeg(
        [normals[i], normals[i + 1], normals[i + 2]],
        [decoded[i], decoded[i + 1], decoded[i + 2]],
      );
      maxDeg = Math.max(maxDeg, deg);
      // every decoded normal stays unit length
      const len = Math.hypot(decoded[i], decoded[i + 1], decoded[i + 2]);
      expect(len).toBeCloseTo(1, 4);
    }
    expect(maxDeg).toBeLessThan(0.2); // 16-bit oct is well under a quarter degree
  });

  it("the Int8-format decoder (decompressNormals) does NOT decode U16 oct — guards the pairing", () => {
    const encoded = octEncodeNormalsToU16([0, 0, 1]);
    const wrong = decompressNormals(encoded, new Float32Array(3));
    // decompressNormals normalises its output, so the corruption shows up as a
    // wildly wrong direction (here ~180° from the true +Z), not a bad length.
    expect(angleDeg([0, 0, 1], [wrong[0], wrong[1], wrong[2]])).toBeGreaterThan(45);
  });
});
