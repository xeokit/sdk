import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {type WebGLContextProvider} from "./WebGLContextProvider";

/**
 * Represents a WebGL2 shader.
 */
export class WebGLShader {

    /**
     * True when this shader was successfully allocated.
     */
    allocated: boolean;

    /**
     * True when this shader was successfully compiled.
     */
    compiled: boolean;

    /**
     * Handle to GPU-resident WebGL2 shader.
     */
    handle: any;

    private _glSrc: WebGLContextProvider;
    private _type: number;
    private _source: string;

    /**
     * Creates a new shader.
     * @param glSrc
     * @param type
     * @param source
     */
    constructor(glSrc:WebGLContextProvider, type: number, source: string) {
        this._glSrc = glSrc;
        this._type = type;
        this.allocated = false;
        this.compiled = false;
        this._source = source;
    }

    /**
     * Initializes this shader (compile + status check).
     */
    init(): SDKResult<any> {
        const compileResult = this.compile();
        if (compileResult.ok === false) {
            return compileResult;
        }
        return this.checkCompiled();
    }

    /**
     * Issues the compile without reading back its status.
     *
     * `getShaderParameter(COMPILE_STATUS)` blocks until the driver has finished
     * compiling, so reading it here would serialize a batch of shaders. Callers
     * that compile many shaders should call {@link compile} on all of them first,
     * then {@link checkCompiled} on each — the driver compiles them concurrently
     * in between (see {@link WebGLProgram.link}).
     */
    compile(): SDKResult<any> {
        const gl = this._glSrc.gl;

        this.handle = gl.createShader(this._type);
        if (!this.handle) {
            return {
                ok: false,
                type: SDKErrorType.InitializationFailed,
                error: "Cannot allocate WebGL2 shader"
            };
        }

        this.allocated = true;
        gl.shaderSource(this.handle, this._source);
        gl.compileShader(this.handle);

        return {ok: true, value: undefined};
    }

    /**
     * Reads back the compile status (blocking) — call after {@link compile}.
     */
    checkCompiled(): SDKResult<any> {
        const gl = this._glSrc.gl;

        this.compiled = gl.getShaderParameter(this.handle, gl.COMPILE_STATUS);

        if (!this.compiled) {
            if (!gl.isContextLost()) {
                const lines = this._source.split("\n");
                const numberedLines = lines.map((line, index) => `${index + 1}: ${line}`);
                const shaderInfoLog = gl.getShaderInfoLog(this.handle) || "Unknown error during shader compilation";
                const errorDetails = [
                    "Shader Compilation Error:",
                    shaderInfoLog,
                    "Shader Source:",
                    numberedLines.join("\n")
                ].join("\n");

                this.destroy();

                return {
                    ok: false,
                    type: SDKErrorType.InitializationFailed,
                    error: errorDetails
                };
            } else {

                this.destroy();

                return {
                    ok: false,
                    type: SDKErrorType.WebGLContextLost,
                    error: "WebGL context lost during shader compilation"
                };
            }
        }

        return {
            ok: true,
            value: undefined
        };
    }


    /**
     * Rebuilds the shader after WebGL context has been restored.
     */
    webglContextRestored(): SDKResult<any> {

        if (!this._glSrc.gl || !this._source || !this._type) {
            return {
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "Cannot restore shader: Missing WebGL context, source, or type"
            };
        }

        const result = this.init();

        if (result.ok === false) {
            return {
                ok: false,
                type: result.type,
                error: `Failed to restore shader: ${result.error}`
            };
        }

        return {
            ok: true,
            value: undefined
        };
    }


    /**
     * Destroys this shader, releasing its GPU resources.
     */
    destroy(): void {
        if (this.allocated) {
            this._glSrc.gl?.deleteShader(this.handle);
            this.allocated = false;
        }
    }
}
