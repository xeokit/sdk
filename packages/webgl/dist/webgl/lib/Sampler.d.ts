import type { Texture2D } from "./Texture2D";
import type { DataTexture } from "./DataTexture";
import type { Texture } from "./Texture";
export declare class Sampler {
    private readonly location;
    private readonly gl;
    constructor(gl: WebGL2RenderingContext, location: WebGLUniformLocation);
    bindTexture(texture: Texture2D | DataTexture | Texture, unit: number): boolean;
}
