import type { WebGLAbstractTexture } from "./WebGLAbstractTexture";
/**
 * Represents a WebGL2 render buffer.
 */
export declare class WebGLRenderBuffer {
    #private;
    /**
     * Creates a new render buffer.
     * @param canvas
     * @param gl
     * @param options
     */
    constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, options: {
        depthTexture: boolean;
        size: number[];
    });
    /**
     * Sets the size of this render buffer.
     * @param size
     */
    setSize(size: number[]): void;
    /**
     * Binds this render buffer.
     */
    bind(): void;
    /**
     * Clears this render buffer.
     */
    clear(): void;
    /**
     * Reads a pixel from this render buffer.
     * @param pickX
     * @param pickY
     */
    read(pickX: number, pickY: number): Uint8Array;
    /**
     * Redas an image from this render buffer.
     * @param params
     */
    readImage(params: {
        height?: number;
        width?: number;
        format?: string;
    }): any;
    /**
     * Redas image from this render buffer as a image data.
     */
    readImageData(): any;
    /**
     * Unbinds this render buffer.
     */
    unbind(): void;
    /**
     * Gets a texture that has the contents of this render buffer.
     */
    getTexture(): WebGLAbstractTexture;
    /**
     * Does this render buffer have a depth texture component?
     */
    hasDepthTexture(): boolean;
    /**
     * Gets the depth texture component of this render buffer, if any.
     */
    getDepthTexture(): WebGLAbstractTexture | null;
    /**
     * Destroys this render buffer.
     */
    destroy(): void;
}
//# sourceMappingURL=WebGLRenderBuffer_OLD.d.ts.map