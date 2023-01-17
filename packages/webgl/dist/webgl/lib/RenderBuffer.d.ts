import type { Texture } from "./Texture";
export declare class RenderBuffer {
    #private;
    constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, options: {
        depthTexture: boolean;
        size: number[];
    });
    setSize(size: number[]): void;
    bind(): void;
    clear(): void;
    read(pickX: number, pickY: number): Uint8Array;
    readImage(params: {
        height?: number;
        width?: number;
        format?: string;
    }): Uint8Array;
    unbind(): void;
    getTexture(): Texture;
    hasDepthTexture(): boolean;
    getDepthTexture(): Texture | null;
    destroy(): void;
}
