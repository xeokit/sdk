import {Map} from "@xeokit/utils";

import {WebGLShader} from "./WebGLShader";
import {WebGLSampler} from "./WebGLSampler";
import {WebGLAttribute} from "./WebGLAttribute";
import type {WebGLAbstractTexture} from "./WebGLAbstractTexture";

const ids = new Map({}, "");

/**
 * Represents a WebGL2 program.
 */
export class WebGLProgram {

    /**
     * Unique ID of this program.
     */
    id: number;

    /**
     * The vertex shader.
     */
    vertexShader: WebGLShader;

    /**
     * The fragment shader.
     */
    fragmentShader: WebGLShader;

    /**
     * Map of all attributes in this program.
     */
    attributes: { [key: string]: WebGLAttribute };

    /**
     * Map of all samplers in this program.
     */
    samplers: { [key: string]: WebGLSampler };

    /**
     * Map of all uniforms in this program.
     */
    uniforms: { [key: string]: WebGLUniformLocation };

    /**
     * List of compilation errors for this program, if any.
     */
    errors: string[];

    /**
     * Flag set true when program has been validated.
     */
    validated: boolean;

    /**
     * Flag set true when this program has been successfully linked.
     */
    linked: boolean;

    /**
     * Flag set true when this program has been successfully conpiled.
     */
    compiled: boolean;

    /**
     * Flag set true when this program has been successfully allocated.
     */
    allocated: boolean;

    /**
     * The WebGL2 rendering context.
     */
    gl: WebGL2RenderingContext;

    /**
     * The source code from which the shaders are built.
     */
    source: any;

    /**
     * Handle to the WebGL program itself, which resides on the GPU.
     */
    handle: WebGLProgram;

    /**
     * Creates a new program.
     * @param gl
     * @param shaderSource
     */
    constructor(gl: WebGL2RenderingContext,
                shaderSource: {
                    vertex: string,
                    fragment: string
                }) {

        // console.log("WebGLProgram constructor")
        // console.log("-----------------------------------------------------")
        // console.log("\nshaderSource.vertex:\n");
        // console.log(shaderSource.vertex);
        // console.log("\nshaderSource.fragment:\n");
        // console.log(shaderSource.fragment);
        // console.log("-----------------------------------------------------")

        // @ts-ignore
        this.id = ids.addItem({});
        this.source = shaderSource;
        this.gl = gl;
        this.allocated = false;
        this.compiled = false;
        this.linked = false;
        this.validated = false;
        this.errors = undefined;
        this.uniforms = {};
        this.samplers = {};
        this.attributes = {};

        this.vertexShader = new WebGLShader(gl, gl.VERTEX_SHADER, this.source.vertex);
        this.fragmentShader = new WebGLShader(gl, gl.FRAGMENT_SHADER, this.source.fragment);

        if (!this.vertexShader.allocated) {
            this.errors = ["Vertex shader failed to allocate"].concat(this.vertexShader.errors);
            logErrors(this.errors);
            return;
        }

        if (!this.fragmentShader.allocated) {
            this.errors = ["Fragment shader failed to allocate"].concat(this.fragmentShader.errors);
            logErrors(this.errors);
            return;
        }

        this.allocated = true;

        if (!this.vertexShader.compiled) {
            this.errors = ["Vertex shader failed to compile"].concat(this.vertexShader.errors);
            logErrors(this.errors);
            return;
        }

        if (!this.fragmentShader.compiled) {
            this.errors = ["Fragment shader failed to compile"].concat(this.fragmentShader.errors);
            logErrors(this.errors);
            return;
        }

        this.compiled = true;
        // @ts-ignore
        this.handle = gl.createProgram();

        if (!this.handle) {
            this.errors = ["Failed to allocate program"];
            return;
        }

        gl.attachShader(this.handle, this.vertexShader.handle);
        gl.attachShader(this.handle, this.fragmentShader.handle);
        gl.linkProgram(this.handle);

        this.linked = gl.getProgramParameter(this.handle, gl.LINK_STATUS);

        // HACK: Disable validation temporarily: https://github.com/xeolabs/xeokit-sdk/issues/5
        // Perhaps we should defer validation until render-time, when the program has values set for all inputs?

        this.validated = true;

        if (!this.linked || !this.validated) {
            this.errors = [];
            this.errors.push("");
            // @ts-ignore
            this.errors.push(gl.getProgramInfoLog(this.handle));
            this.errors.push("\nVertex shader:\n");
            this.errors = this.errors.concat(this.source.vertex);
            this.errors.push("\nFragment shader:\n");
            this.errors = this.errors.concat(this.source.fragment);
            logErrors(this.errors);
            return;
        }

        const numUniforms = gl.getProgramParameter(this.handle, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; ++i) {
            const u = gl.getActiveUniform(this.handle, i);
            if (u) {
                let uName = u.name;

                if (uName[uName.length - 1] === "\u0000") {
                    uName = uName.substr(0, uName.length - 1);
                }
                const location = gl.getUniformLocation(this.handle, uName);
                if ((u.type === gl.SAMPLER_2D) || (u.type === gl.SAMPLER_CUBE) ||  (u.type === 35682) || (u.type === 36306)) {
                    // @ts-ignore
                    this.samplers[uName] = new WebGLSampler(gl, location);
                } else {
                    // @ts-ignore
                    this.uniforms[uName] = location;
                }
            }
        }

        const numAttribs = gl.getProgramParameter(this.handle, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttribs; i++) {
            const a = gl.getActiveAttrib(this.handle, i);
            if (a) {
                const location = gl.getAttribLocation(this.handle, a.name);
                this.attributes[a.name] = new WebGLAttribute(gl, location);
            }
        }

        this.allocated = true;
    }

    /**
     * Binds this program.
     */
    bind() {
        if (!this.allocated) {
            return;
        }
        this.gl.useProgram(this.handle);
    }

    /**
     * Gets the location of the given uniform within this program.
     * @param name
     */
    getLocation(name: string): WebGLUniformLocation {
        return this.uniforms[name];
    }

    /**
     * Gets an attribute within this program.
     * @param name
     */
    getAttribute(name: string): WebGLAttribute {
        return this.attributes[name];
    }

    /**
     * Gets a sampler within this program.
     * @param name
     */
    getSampler(name: string): WebGLSampler {
        return this.samplers[name];
    }

    /**
     * Binds a texture to this program.
     * @param name
     * @param texture
     * @param unit
     */
    bindTexture(name: string, texture: WebGLAbstractTexture, unit: number): boolean {
        if (!this.allocated) {
            return false;
        }
        const sampler = this.samplers[name];
        if (sampler) {
            return sampler.bindTexture(texture, unit);
        } else {
            return false;
        }
    }

    /**
     * Destroys this program.
     */
    destroy() {
        if (!this.allocated) {
            return;
        }
        ids.removeItem(this.id);
        this.gl.deleteProgram(this.handle);
        this.gl.deleteShader(this.vertexShader.handle);
        this.gl.deleteShader(this.fragmentShader.handle);
        this.attributes = {};
        this.uniforms = {};
        this.samplers = {};
        this.allocated = false;
    }
}

function joinSansComments(srcLines: string[]) {
    const src = [];
    let line;
    ``
    for (let i = 0, len = srcLines.length; i < len; i++) {
        line = srcLines[i];
        const n = line.indexOf("/");
        if (n > 0) {
            if (line.charAt(n + 1) === "/") {
                line = line.substring(0, n);
            }
        }
        src.push(line);
    }
    return src.join("\n");
}

function logErrors(errors: string[]) {
    console.error(errors.join("\n"));
}
