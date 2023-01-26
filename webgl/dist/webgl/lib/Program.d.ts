import { Shader } from "./Shader";
import { Sampler } from "./Sampler";
import { Attribute } from "./Attribute";
import type { Texture } from "./Texture";
export declare class Program {
    id: number;
    vertexShader: Shader;
    fragmentShader: Shader;
    attributes: {
        [key: string]: Attribute;
    };
    samplers: {
        [key: string]: Sampler;
    };
    uniforms: {
        [key: string]: WebGLUniformLocation;
    };
    errors: string[];
    validated: boolean;
    linked: boolean;
    compiled: boolean;
    allocated: boolean;
    gl: WebGL2RenderingContext;
    source: any;
    handle: WebGLProgram;
    constructor(gl: WebGL2RenderingContext, shaderSource: any);
    bind(): void;
    getLocation(name: string): WebGLUniformLocation;
    getAttribute(name: string): Attribute;
    getSampler(name: string): Sampler;
    bindTexture(name: string, texture: Texture, unit: number): boolean;
    destroy(): void;
}
