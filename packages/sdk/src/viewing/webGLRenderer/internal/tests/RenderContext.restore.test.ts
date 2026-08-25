/**
 * @jest-environment jsdom
 */

jest.mock("../webGL", () => ({
  WEBGL_INFO: {MAX_TEXTURE_UNITS: 8},
}));

import {RenderContext} from "../RenderContext";

function createFakeGL() {
  let lost = false;
  let textureId = 0;
  let bufferId = 0;
  const gl = {
    createTexture: jest.fn(() => ({id: ++textureId})),
    deleteTexture: jest.fn(),
    createBuffer: jest.fn(() => ({id: ++bufferId})),
    deleteBuffer: jest.fn(),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    bindTexture: jest.fn(),
    texImage2D: jest.fn(),
    texParameteri: jest.fn(),
    hint: jest.fn(),
    getExtension: jest.fn(() => null),
    isContextLost: jest.fn(() => lost),
    FRAGMENT_SHADER_DERIVATIVE_HINT: 0x8B8B,
    NICEST: 0x1102,
    UNIFORM_BUFFER: 0x8A11,
    DYNAMIC_DRAW: 0x88E8,
    TEXTURE_CUBE_MAP: 0x8513,
    TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515,
    TEXTURE_CUBE_MAP_NEGATIVE_X: 0x8516,
    TEXTURE_CUBE_MAP_POSITIVE_Y: 0x8517,
    TEXTURE_CUBE_MAP_NEGATIVE_Y: 0x8518,
    TEXTURE_CUBE_MAP_POSITIVE_Z: 0x8519,
    TEXTURE_CUBE_MAP_NEGATIVE_Z: 0x851A,
    TEXTURE_2D: 0x0DE1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812F,
  };
  return {
    gl,
    setLost(value: boolean) {
      lost = value;
    },
  };
}

describe("RenderContext WebGL context restore", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("recreates context-owned placeholder textures after restoration", () => {
    const fake = createFakeGL();
    const gl = fake.gl;
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl as never);

    const context = new RenderContext({} as never);
    expect(context.init({} as never).ok).toBe(true);

    const initialCubemap = context.iblIrradianceCubemap;
    const initialTexture = context.iblBRDFLUT;
    expect(initialCubemap).toBeTruthy();
    expect(initialTexture).toBeTruthy();

    fake.setLost(true);
    context.webglContextLost();

    expect(context.contextLost).toBe(true);
    expect(context.iblIrradianceCubemap).toBeNull();
    expect(context.iblPrefilteredCubemap).toBeNull();
    expect(context.iblBRDFLUT).toBeNull();

    fake.setLost(false);
    const result = context.webglContextRestored();

    expect(result.ok).toBe(true);
    expect(context.contextLost).toBe(false);
    expect(context.iblIrradianceCubemap).toBeTruthy();
    expect(context.iblPrefilteredCubemap).toBe(context.iblIrradianceCubemap);
    expect(context.iblBRDFLUT).toBeTruthy();
    expect(context.iblIrradianceCubemap).not.toBe(initialCubemap);
    expect(context.iblBRDFLUT).not.toBe(initialTexture);
  });

  test("switches to a replacement WebGL context before reallocating placeholders", () => {
    const original = createFakeGL();
    const restored = createFakeGL();
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(original.gl as never);

    const context = new RenderContext({} as never);
    expect(context.init({} as never).ok).toBe(true);

    original.setLost(true);
    context.webglContextLost();
    original.setLost(false);

    const result = context.webglContextRestored(restored.gl as never);

    expect(result.ok).toBe(true);
    expect((context as any).gl).toBe(restored.gl);
    expect(restored.gl.createTexture).toHaveBeenCalled();
  });
});
