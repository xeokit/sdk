import {utils} from "../../viewer/index";
import {Shader} from "./Shader";
import {Sampler} from "./Sampler";
import {Attribute} from "./Attribute";
import {Texture} from "./Texture";

const ids = new utils.Map({}, "");

export class Program {

    id: number;
    vertexShader: Shader;
    fragmentShader: Shader;
    attributes: { [key: string]: Attribute };
    samplers: { [key: string]: Sampler };
    uniforms: { [key: string]: WebGLUniformLocation };
    errors: string[];
    validated: boolean;
    linked: boolean;
    compiled: boolean;
    allocated: boolean;
    gl: WebGL2RenderingContext;
    source: any;
    handle: WebGLProgram;

    constructor(gl: WebGL2RenderingContext, shaderSource: any) {

        // @ts-ignore
        this.id = ids.addItem({});
        this.source = shaderSource;
        this.gl = gl;
        this.allocated = false;
        this.compiled = false;
        this.linked = false;
        this.validated = false;
        this.errors = null;
        this.uniforms = {};
        this.samplers = {};
        this.attributes = {};

        this.vertexShader = new Shader(gl, gl.VERTEX_SHADER, joinSansComments(this.source.vertex));
        this.fragmentShader = new Shader(gl, gl.FRAGMENT_SHADER, joinSansComments(this.source.fragment));

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
                if ((u.type === gl.SAMPLER_2D) || (u.type === gl.SAMPLER_CUBE) || (u.type === 35682)) {
                    this.samplers[uName] = new Sampler(gl, location);
                } else {
                    this.uniforms[uName] = location;
                }
            }
        }

        const numAttribs = gl.getProgramParameter(this.handle, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttribs; i++) {
            const a = gl.getActiveAttrib(this.handle, i);
            if (a) {
                const location = gl.getAttribLocation(this.handle, a.name);
                this.attributes[a.name] = new Attribute(gl, location);
            }
        }

        this.allocated = true;
    }

    bind() {
        if (!this.allocated) {
            return;
        }
        this.gl.useProgram(this.handle);
    }

    getLocation(name: string): WebGLUniformLocation {
        if (!this.allocated) {
            return;
        }
        return this.uniforms[name];
    }

    getAttribute(name: string): Attribute {
        if (!this.allocated) {
            return;
        }
        return this.attributes[name];
    }

    getSampler(name: string): Sampler {
        if (!this.allocated) {
            return;
        }
        return this.samplers[name];
    }

    bindTexture(name: string, texture: Texture, unit: number): boolean {
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

    destroy() {
        if (!this.allocated) {
            return;
        }
        ids.removeItem(this.id);
        this.gl.deleteProgram(this.handle);
        this.gl.deleteShader(this.vertexShader.handle);
        this.gl.deleteShader(this.fragmentShader.handle);
        this.handle = null;
        this.attributes = {};
        this.uniforms = {};
        this.samplers = {};
        this.allocated = false;
    }
}

function joinSansComments(srcLines: string[]) {
    const src = [];
    let line;``
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
