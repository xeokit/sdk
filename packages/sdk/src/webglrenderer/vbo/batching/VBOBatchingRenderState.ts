import {type FloatArrayParam} from "../../../math";
import type {WebGLArrayBuf} from "../../../webglutils";

/**
 * @private
 */
export interface VBOBatchingRenderState {
  uvDecodeMatrix: FloatArrayParam;
  colorTextureSupported: boolean;
  uvBuf: WebGLArrayBuf;
  metallicRoughnessBuf: WebGLArrayBuf;
  textureSet: any;
  normalsBuf: WebGLArrayBuf;
  edgeIndicesBuf: WebGLArrayBuf;
  numVertices: number;
  pickColorsBuf: WebGLArrayBuf;
  positionsDecompressScale: FloatArrayParam,
  positionsDecompressOffset: FloatArrayParam,
  offsetsBuf: WebGLArrayBuf;
  colorsBuf: WebGLArrayBuf[];
  flagsBufs: WebGLArrayBuf[];
  positionsBuf: WebGLArrayBuf;
  indicesBuf: WebGLArrayBuf;
  tilesBuf: WebGLArrayBuf;
  saoSupported: boolean;
  pbrSupported: boolean;
}
