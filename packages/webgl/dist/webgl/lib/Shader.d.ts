export declare class Shader {
    errors: string[];
    allocated: boolean;
    compiled: boolean;
    handle: WebGLShader;
    constructor(gl: WebGL2RenderingContext, type: number, source: string);
    destroy(): void;
}
