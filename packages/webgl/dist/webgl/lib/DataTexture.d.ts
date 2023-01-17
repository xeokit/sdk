import type { Program } from "./Program";
import type { Sampler } from "./Sampler";
/**
 * A WebGL2 texture that holds geometry data.
 */
export declare class DataTexture {
    #private;
    gl?: WebGL2RenderingContext;
    texture?: WebGLTexture | null;
    textureWidth?: number;
    textureHeight?: number;
    textureData?: any;
    constructor(params?: {
        gl?: WebGL2RenderingContext;
        texture?: WebGLTexture;
        textureWidth?: number;
        textureHeight?: number;
        textureData?: any;
        onDestroyed?: Function;
    });
    bindTexture(glProgram: Program, sampler: Sampler, unit: number): void;
    bind(unit: number): true | undefined;
    disableFiltering(): void;
    unbind(unit: number): void;
    destroy(): void;
}
