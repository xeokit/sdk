import {tokenize} from "./tokenize";

describe("FDS tokenize", () => {

  it("parses a single one-line record", () => {
    const records = tokenize("&HEAD CHID='test', TITLE='hello' /");
    expect(records).toHaveLength(1);
    expect(records[0].group).toBe("HEAD");
    expect(records[0].params.get("CHID")).toBe("test");
    expect(records[0].params.get("TITLE")).toBe("hello");
  });

  it("handles a record spanning multiple lines", () => {
    const records = tokenize(
      "&MESH IJK=10,10,10,\n" +
      "      XB=0,5,\n" +
      "         0,5,\n" +
      "         0,3 /\n"
    );
    expect(records).toHaveLength(1);
    expect(records[0].group).toBe("MESH");
    expect(records[0].params.get("IJK")).toEqual([10, 10, 10]);
    expect(records[0].params.get("XB")).toEqual([0, 5, 0, 5, 0, 3]);
  });

  it("ignores comments to end of line, including inside parameter runs", () => {
    const records = tokenize(
      "&OBST XB=0,1,0,1,0,1, ! corner stub\n" +
      "      SURF_ID='WALL' /\n" +
      "! whole-line comment\n" +
      "&SURF ID='WALL', RGB=128,128,128 /\n"
    );
    expect(records).toHaveLength(2);
    expect(records[0].group).toBe("OBST");
    expect(records[0].params.get("XB")).toEqual([0, 1, 0, 1, 0, 1]);
    expect(records[0].params.get("SURF_ID")).toBe("WALL");
    expect(records[1].group).toBe("SURF");
    expect(records[1].params.get("RGB")).toEqual([128, 128, 128]);
  });

  it("preserves quoted strings that contain '!' and commas", () => {
    const records = tokenize("&SURF ID='WIRE!CAGE,2', COLOR='RED' /");
    expect(records[0].params.get("ID")).toBe("WIRE!CAGE,2");
    expect(records[0].params.get("COLOR")).toBe("RED");
  });

  it("normalises 'D' exponent to JS-readable", () => {
    const records = tokenize("&OBST XB=0D0,1.5D-1,0,1,0,1 /");
    expect(records[0].params.get("XB")).toEqual([0, 0.15, 0, 1, 0, 1]);
  });

  it("decodes .TRUE. / .FALSE.", () => {
    const records = tokenize("&MISC SUPPRESSION=.TRUE., DNS=.F. /");
    expect(records[0].params.get("SUPPRESSION")).toBe(true);
    expect(records[0].params.get("DNS")).toBe(false);
  });
});
