import {buildLogicalStream, physicalToLogical} from "../parser/e57PageReader";

// pageSize 8 → 4 data bytes + 4 CRC bytes per page. Two full pages:
//   page 0: A0 A1 A2 A3 | c c c c
//   page 1: B0 B1 B2 B3 | c c c c
function twoPages(): ArrayBuffer {
  const data = new Uint8Array([
    10, 11, 12, 13, 0xff, 0xff, 0xff, 0xff,
    20, 21, 22, 23, 0xee, 0xee, 0xee, 0xee,
  ]);
  return data.buffer;
}

describe("e57PageReader", () => {

  it("buildLogicalStream drops the 4 CRC bytes of every page", () => {
    const logical = buildLogicalStream(twoPages(), 8);
    expect(Array.from(logical)).toEqual([10, 11, 12, 13, 20, 21, 22, 23]);
  });

  it("handles a short final page (no full CRC tail)", () => {
    // page 0 full (8 bytes), page 1 has only 4 data bytes, no CRC written.
    const data = new Uint8Array([10, 11, 12, 13, 0xff, 0xff, 0xff, 0xff, 30, 31, 32, 33]);
    const logical = buildLogicalStream(data.buffer, 8);
    expect(Array.from(logical)).toEqual([10, 11, 12, 13, 30, 31, 32, 33]);
  });

  it("physicalToLogical maps across the CRC gaps", () => {
    expect(physicalToLogical(2, 8)).toBe(2);   // within page 0 data
    expect(physicalToLogical(8, 8)).toBe(4);   // start of page 1 data
    expect(physicalToLogical(9, 8)).toBe(5);
    expect(physicalToLogical(16, 8)).toBe(8);  // start of page 2 data
  });
});
