const mockLoad = jest.fn();

jest.mock("../../../base/io/FileIOFactory", () => ({
  createFileIO: () => ({
    load: mockLoad,
    save: jest.fn(),
  }),
}));

import {ModelConverter} from "../ModelConverter";

const waitForMacrotask = () => new Promise(resolve => setTimeout(resolve, 0));

describe("ModelConverter filePath inputs", () => {

  beforeEach(() => {
    mockLoad.mockReset();
  });

  it("awaits filePath data before continuing to export", async () => {
    let resolveFile: ((fileData: any) => void) | undefined;
    mockLoad.mockImplementation(() => new Promise(resolve => {
      resolveFile = resolve;
    }));

    let loaded = false;
    const loader = {
      format: "stub",
      fileDataType: "json",
      async load({fileData}: any) {
        expect(fileData).toEqual({version: "1.0"});
        loaded = true;
      },
    };
    const exporter = {
      format: "stub-out",
      fileDataType: "json",
      defaultVersion: "1.0",
      async write() {
        return {loaded};
      },
    };

    const converter = new ModelConverter({
      loaders: {stub: loader as any},
      exporters: {out: exporter as any},
      pipelines: {
        p: {
          inputs: {in: {loader: "stub"}},
          outputs: {out: {exporter: "out"}},
        },
      },
    } as any);

    const conversion = converter.convert({
      pipeline: "p",
      inputs: {in: {filePath: "model.stub"}},
    } as any);
    let settled = false;
    conversion.then(() => {
      settled = true;
    });

    await waitForMacrotask();
    await waitForMacrotask();
    await waitForMacrotask();

    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    resolveFile?.({version: "1.0"});
    const result = await conversion;

    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(result.inputs.in.filePath).toBe("model.stub");
    expect(result.inputs.in.fileData).toEqual({version: "1.0"});
    expect(result.outputs.out.fileData).toEqual({loaded: true});
  });
});
