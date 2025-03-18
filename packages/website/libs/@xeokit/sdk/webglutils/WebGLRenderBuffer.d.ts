import { WebGLAbstractTexture } from "./WebGLAbstractTexture";
/**
 *  Represents a WebGL render buffer.
 * @private
 */
declare class WebGLRenderBuffer {
    #private;
    allocated: boolean;
    canvas: HTMLCanvasElement;
    bound: boolean;
    size: any;
    constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, options: {
        depthTexture: boolean;
        size?: number[];
    });
    /**
     * Sets the size of this render buffer.
     * @param size
     */
    setSize(size: any): void;
    webglContextRestored(gl: WebGL2RenderingContext): void;
    /**
     * Binds this render buffer.
     */
    bind(...internalformats: any): void;
    /**
     * Create and specify a WebGL texture image.
     *
     * @param { number } width
     * @param { number } height
     * @param { GLenum } [internalformat=null]
     *
     * @returns { WebGLTexture }
     */
    createTexture(width: number, height: number, internalformat?: any): WebGLTexture;
    /**
     *
     * @param {number[]} [internalformats=[]]
     * @returns
     */
    touch(...internalformats: any): void;
    /**
     * Clears this render buffer.
     */
    clear(): void;
    /**
     * Reads a pixel from this render buffer.
     * @param pickX
     * @param pickY
     */
    read(pickX: number, pickY: number, glFormat?: any, glType?: any, arrayType?: Uint8ArrayConstructor, arrayMultiplier?: number, colorBufferIndex?: number): Uint8Array<ArrayBuffer>;
    readArray(glFormat?: any, glType?: any, arrayType?: Uint8ArrayConstructor, arrayMultiplier?: number, colorBufferIndex?: number): Uint8Array<ArrayBuffer>;
    /**
     * Returns an HTMLCanvas containing the contents of the RenderBuffer as an image.
     *
     * - The HTMLCanvas has a CanvasRenderingContext2D.
     * - Expects the caller to draw more things on the HTMLCanvas (annotations etc).
     *
     * @returns {HTMLCanvasElement}
     */
    readImageAsCanvas(): any;
    /**
     * Redas an image from this render buffer.
     * @param params
     */
    readImage(params: {
        height?: number;
        width?: number;
        format?: string;
    }): any;
    _getImageDataCache(type?: Uint8ArrayConstructor, multiplier?: number): any;
    unbind(): void;
    getTexture(): WebGLAbstractTexture;
    hasDepthTexture(): boolean;
    /**
     * Gets the depth texture component of this render buffer, if any.
     */
    getDepthTexture(): WebGLAbstractTexture | null;
    destroy(): void;
}
export { WebGLRenderBuffer };
//# sourceMappingURL=WebGLRenderBuffer.d.ts.map