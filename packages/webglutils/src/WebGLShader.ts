/**
 * Represents a WebGL2 shader.
 */
export class WebGLShader {

    /**
     * Compilation errors, if any.
     */
    errors: string[];

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
    handle: WebGLShader;

    /**
     * Creates a new shader.
     * @param gl
     * @param type
     * @param source
     */
    constructor(gl: WebGL2RenderingContext, type: number, source: string) {
        this.allocated = false;
        this.compiled = false;
        // @ts-ignore
        this.handle = gl.createShader(type);
        if (!this.handle) {
            this.errors = [
                "Failed to allocate"
            ];
            return;
        }
        this.allocated = true;
        gl.shaderSource(this.handle, source);
        gl.compileShader(this.handle);
        this.compiled = gl.getShaderParameter(this.handle, gl.COMPILE_STATUS);
        if (!this.compiled) {
            if (!gl.isContextLost()) { // Handled explicitly elsewhere, so won't re-handle here
                const lines = source.split("\n");
                const numberedLines = [];
                for (let i = 0; i < lines.length; i++) {
                    numberedLines.push((i + 1) + ": " + lines[i] + "\n");
                }
                this.errors = [];
                this.errors.push("");
                this.errors.push(gl.getShaderInfoLog(this.handle) || "");
                this.errors = this.errors.concat(numberedLines.join(""));
            }
        }
    }

    /**
     * Destroys this shader.
     */
    destroy() {

    }
}