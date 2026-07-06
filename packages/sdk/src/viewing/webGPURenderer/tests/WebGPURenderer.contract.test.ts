import {SDKErrorType} from "../../../base/core";
import type {RendererError} from "../../renderer";
import {WebGPURenderer} from "../core";

describe("WebGPURenderer contract", () => {
  test("reports attach as unsupported until the rendering pipeline exists", () => {
    const renderer = new WebGPURenderer({logging: false});
    const errors: RendererError[] = [];

    renderer.events.onError.subscribe((_renderer, error) => {
      errors.push(error);
    });

    const result = renderer.attachViewer({} as any);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected WebGPURenderer.attachViewer to fail");
    }
    expect(result.type).toBe(SDKErrorType.NotSupported);
    expect(renderer.viewer).toBeNull();
    expect(renderer.rendering).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe(SDKErrorType.NotSupported);
  });

  test("emits destroyed once", () => {
    const renderer = new WebGPURenderer({logging: false});
    const destroyed: boolean[] = [];

    renderer.events.onRendererDestroyed.subscribe((_renderer, value) => {
      destroyed.push(value);
    });

    renderer.destroy();
    renderer.destroy();

    expect(destroyed).toEqual([true]);
  });
});
