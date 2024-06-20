import {WebGLArrayBuf} from "@xeokit/webglutils";
import {FloatArrayParam} from "@xeokit/math";

/**
 * @private
 */
export interface VBOPointsRenderState {
    numVertices: number;
    pickColorsBuf: WebGLArrayBuf;
    positionsDecodeMatrix: FloatArrayParam;
    offsetsBuf: WebGLArrayBuf;
    colorsBuf: WebGLArrayBuf;
    flagsBuf: WebGLArrayBuf;
    origin: FloatArrayParam;
    positionsBuf: WebGLArrayBuf
}
