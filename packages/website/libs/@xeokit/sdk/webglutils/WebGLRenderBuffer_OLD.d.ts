import type { WebGLAbstractTexture } from "./WebGLAbstractTexture";
/**
 * Represents a WebGL2 draw _buffer.
 */
export declare class WebGLRenderBuffer {
    #private;
    /**
     * Creates a new draw _buffer.
     * @param canvas
     * @param gl
     * @param options
     */
    constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, options: {
        depthTexture: boolean;
        size: number[];
    });
    /**
     * Sets the size of this draw _buffer.
     * @param size
     */
    setSize(size: number[]): void;
    /**
     * Binds this draw _buffer.
     */
    bind(): void;
    /**
     * Clears this draw _buffer.
     */
    clear(): void;
    /**
     * Reads a pixel from this draw _buffer.
     * @param pickX
     * @param pickY
     */
    read(pickX: number, pickY: number): Uint8Array;
    /**
     * Redas an image from this draw _buffer.
     * @param params
     */
    readImage(params: {
        height?: number;
        width?: number;
        format?: string;
    }): any;
    /**
     * Redas image from this draw _buffer as a image data.
     */
    readImageData(): any;
    /**
     * Unbinds this draw _buffer.
     */
    unbind(): void;
    /**
     * Gets a texture that has the contents of this draw _buffer.
     */
    getTexture(): WebGLAbstractTexture;
    /**
     * Does this draw _buffer have a depth texture component?
     */
    hasDepthTexture(): boolean;
    /**
     * Gets the depth texture component of this draw _buffer, if any.
     */
    getDepthTexture(): WebGLAbstractTexture | null;
    /**
     * Destroys this draw _buffer.
     */
    destroy(): void;
}
//# sourceMappingURL=WebGLRenderBuffer_OLD.d.ts.map
