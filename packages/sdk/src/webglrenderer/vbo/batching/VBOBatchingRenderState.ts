import { WebGLArrayBuf } from "../../../webglutils";
import { FloatArrayParam } from "../../../math";

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
  origin: FloatArrayParam;
  positionsBuf: WebGLArrayBuf;
  indicesBuf: WebGLArrayBuf;

  saoSupported: boolean;
  pbrSupported: boolean;
}
