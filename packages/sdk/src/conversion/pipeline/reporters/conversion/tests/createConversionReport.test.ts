import {createConversionReport} from "../createConversionReport";

function output(over: any = {}) {
  return {
    fileData: new Uint8Array(0),
    fileDataType: "arraybuffer",
    fileFormat: "gltf",
    fileFormatVersion: "2",
    fileDataSizeBytes: 100,
    options: {},
    sceneModel: "s",
    dataModel: "d",
    messages: [],
    warnings: [],
    errors: [],
    ...over,
  };
}

describe("createConversionReport", () => {

  it("returns null when no outputs were produced (validate-only run)", () => {
    expect(createConversionReport({outputs: {}, errors: []} as any)).toBeNull();
  });

  it("produces summary / warnings / errors, classifying each output", () => {
    const result: any = {
      outputs: {
        clean: output({filePath: "a.gltf"}),
        dropped: output({filePath: "b.gltf", warnings: ["[GLTFExporter] Dropped 2 texture(s) on 1 material(s): triplanar"]}),
        broke: output({filePath: "c.gltf", errors: ["boom"]}),
      },
      errors: ["pipeline blew up"],
    };

    const report = createConversionReport(result);

    expect(report.summary).toMatchObject({outputs: 3, ok: 1, lossy: 1, failed: 1, warnings: 1, errors: 2});
    expect(report.summary.byOutput.clean.status).toBe("ok");
    expect(report.summary.byOutput.dropped.status).toBe("lossy");
    expect(report.summary.byOutput.broke.status).toBe("failed");

    expect(report.warnings).toEqual([
      {output: "dropped", fileFormat: "gltf", message: expect.stringMatching(/triplanar/i)},
    ]);
    expect(report.errors).toEqual([
      {output: "broke", message: "boom"},
      {output: null, message: "pipeline blew up"},
    ]);
  });
});
