/**
 * @jest-environment jsdom
 */

jest.mock("../webGL", () => ({
  WEBGL_INFO: {MAX_TEXTURE_UNITS: 4},
}));

import {RenderContext} from "../RenderContext";

function createFakeGL() {
  let textureId = 0;
  return {
    createTexture: jest.fn(() => ({id: ++textureId})),
    deleteTexture: jest.fn(),
    bindTexture: jest.fn(),
    activeTexture: jest.fn(),
    texImage2D: jest.fn(),
    texParameteri: jest.fn(),
    hint: jest.fn(),
    getExtension: jest.fn(() => null),
    isContextLost: jest.fn(() => false),
    FRAGMENT_SHADER_DERIVATIVE_HINT: 0x8B8B,
    NICEST: 0x1102,
    TEXTURE0: 0x84C0,
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
}

function createContext() {
  const gl = createFakeGL();
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl as never);
  const context = new RenderContext({} as never);
  expect(context.init({} as never).ok).toBe(true);
  gl.bindTexture.mockClear();
  gl.activeTexture.mockClear();
  return {context, gl};
}

describe("RenderContext texture binding cache", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("skips redundant 2D texture binds on the same unit", () => {
    const {context, gl} = createContext();
    const texture = gl.createTexture() as WebGLTexture;

    expect(context.bindTexture2D(1, texture)).toBe(true);
    expect(context.bindTexture2D(1, texture)).toBe(false);

    expect(gl.activeTexture).toHaveBeenCalledTimes(1);
    expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0 + 1);
    expect(gl.bindTexture).toHaveBeenCalledTimes(1);
    expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, texture);
  });

  test("tracks 2D and cubemap targets independently on the same unit", () => {
    const {context, gl} = createContext();
    const texture2D = gl.createTexture() as WebGLTexture;
    const cubemap = gl.createTexture() as WebGLTexture;

    expect(context.bindTexture2D(2, texture2D)).toBe(true);
    expect(context.bindCubemapTexture(2, cubemap)).toBe(true);
    expect(context.bindTexture2D(2, texture2D)).toBe(false);
    expect(context.bindCubemapTexture(2, cubemap)).toBe(false);

    expect(gl.bindTexture).toHaveBeenCalledTimes(2);
    expect(gl.bindTexture).toHaveBeenNthCalledWith(1, gl.TEXTURE_2D, texture2D);
    expect(gl.bindTexture).toHaveBeenNthCalledWith(2, gl.TEXTURE_CUBE_MAP, cubemap);
  });

  test("invalidation forces the next tracked bind on that unit", () => {
    const {context, gl} = createContext();
    const texture = gl.createTexture() as WebGLTexture;

    expect(context.bindTexture2D(0, texture)).toBe(true);
    context.invalidateTextureBinding(0);
    expect(context.bindTexture2D(0, texture)).toBe(true);

    expect(gl.activeTexture).toHaveBeenCalledTimes(2);
    expect(gl.bindTexture).toHaveBeenCalledTimes(2);
  });
});
