import {createInspectionReport} from "../createInspectionReport";

// The reporter projects file sizes straight off the converter result (the
// ModelConverter records `fileDataSizeBytes` at the I/O boundary) — it never
// touches the filesystem. These cover that projection and the totals.
describe("createInspectionReport — file sizes", () => {

  it("returns null when no inspection ran", () => {
    expect(createInspectionReport({} as any)).toBeNull();
  });

  it("surfaces input and output sizes from the result, with totals", () => {
    const result: any = {
      pipeline: "p",
      inspection: {bySceneModel: {}},
      inputs: {
        in: {filePath: "a.glb", fileFormat: "glTF", fileDataSizeBytes: 1000},
      },
      outputs: {
        out: {filePath: "b.xgf", fileFormat: "xgf", fileDataSizeBytes: 400},
      },
    };
    const report: any = createInspectionReport(result);
    expect(report.files.inputs.in).toEqual({filePath: "a.glb", fileFormat: "glTF", fileDataSizeBytes: 1000});
    expect(report.files.outputs.out).toEqual({filePath: "b.xgf", fileFormat: "xgf", fileDataSizeBytes: 400});
    expect(report.files.totalInputBytes).toBe(1000);
    expect(report.files.totalOutputBytes).toBe(400);
  });

  it("sums multiple inputs/outputs and leaves outputs empty for validate-only runs", () => {
    const withInputsOnly: any = {
      pipeline: "p",
      inspection: {bySceneModel: {}},
      inputs: {
        a: {filePath: "a.gltf", fileFormat: "glTF", fileDataSizeBytes: 100},
        b: {filePath: "b.json", fileFormat: "datamodel", fileDataSizeBytes: 50},
      },
      outputs: {}, // validate-only: no exporter
    };
    const report: any = createInspectionReport(withInputsOnly);
    expect(report.files.totalInputBytes).toBe(150);
    expect(report.files.outputs).toEqual({});
    expect(report.files.totalOutputBytes).toBe(0);
  });
});
