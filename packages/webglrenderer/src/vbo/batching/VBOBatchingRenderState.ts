import {WebGLArrayBuf} from "@xeokit/webglutils";
import {FloatArrayParam} from "@xeokit/math";

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
    positionsDecodeMatrix: FloatArrayParam;
    offsetsBuf: WebGLArrayBuf;
    colorsBuf: WebGLArrayBuf[];
    flagsBufs: WebGLArrayBuf[];
    origin: FloatArrayParam;
    positionsBuf: WebGLArrayBuf;
    indicesBuf: WebGLArrayBuf;
    pbrSupported: boolean;
}
