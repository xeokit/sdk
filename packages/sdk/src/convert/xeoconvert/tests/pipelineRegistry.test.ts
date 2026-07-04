import {modelConverter} from "../xeoconvert_core";

describe("xeoconvert built-in pipeline registry", () => {

  it("references only registered loader and exporter ids", () => {
    const missing: string[] = [];

    for (const [pipelineId, pipeline] of Object.entries(modelConverter.pipelines)) {
      for (const [inputId, input] of Object.entries((pipeline as any).inputs || {})) {
        const loaderId = (input as any).loader;
        if (!modelConverter.loaders[loaderId]) {
          missing.push(`${pipelineId}.${inputId} loader "${loaderId}"`);
        }
      }

      for (const [outputId, output] of Object.entries((pipeline as any).outputs || {})) {
        const exporterId = (output as any).exporter;
        if (!modelConverter.exporters[exporterId]) {
          missing.push(`${pipelineId}.${outputId} exporter "${exporterId}"`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
