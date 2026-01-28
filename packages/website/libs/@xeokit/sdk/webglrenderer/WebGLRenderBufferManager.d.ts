import { WebGLRenderBuffer } from "../webglutils";
/**
 * @private
 */
export declare class WebGLRenderBufferManager {
    #private;
    constructor(gl: WebGL2RenderingContext, webglCanvas: HTMLCanvasElement);
    getRenderBuffer(id: string, options?: {
        depthTexture: boolean;
        size?: number[];
    }): WebGLRenderBuffer;
    destroy(): void;
}
//# sourceMappingURL=RenderBuffers.d.ts.map
