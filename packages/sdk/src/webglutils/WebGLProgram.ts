import {Map} from "../utils";
import {WebGLAttribute} from "./WebGLAttribute";
import {WebGLShader} from "./WebGLShader";
import {SDKErrorType, type SDKResult} from "../core";
import {type WebGLContextProvider} from "./WebGLContextProvider";

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
  samplers: { [key: string]: WebGLUniformLocation };

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
  private _glSrc: WebGLContextProvider;

  /**
   * The source code from which the shaders are built.
   */
  source: any;

  /**
   * Handle to the WebGL program itself, which resides on the GPU.
   */
  handle: any;

  /**
   * Creates a new program.
   * @param glSrc
   * @param shaderSource
   */
  constructor(glSrc: WebGLContextProvider,
              shaderSource: {
                vertex: string,
                fragment: string
              }) {

    this.id = ids.addItem();
    this.source = shaderSource;
    this._glSrc = glSrc;
    this.allocated = false;
    this.compiled = false;
    this.linked = false;
    this.validated = false;
    this.errors = undefined;
    this.uniforms = {};
    this.samplers = {};
    this.attributes = {};
  }

  /**
   * Initializes this program.
   */
  public init(): SDKResult<any> {

    const gl = this._glSrc.gl;

    if (!gl) {
        return {
            ok: false,
            type: SDKErrorType.InvalidOperation,
            error: "Cannot initialize WebGL program: Missing WebGL context"
        };
    }

    this.vertexShader = new WebGLShader(this._glSrc, gl.VERTEX_SHADER, this.source.vertex);
    const resultVertex = this.vertexShader.init();
    if (resultVertex.ok===false) {
      this.vertexShader.destroy();
      return {
        ok: false,
        type: resultVertex.type,
        error: `WebGL vertex shader initialization failed: ${resultVertex.error}`
      };
    }

    this.fragmentShader = new WebGLShader(this._glSrc, gl.FRAGMENT_SHADER, this.source.fragment);
    const resultFragment = this.fragmentShader.init();
    if (resultFragment.ok===false) {
      this.vertexShader.destroy();
      this.fragmentShader.destroy();
      return {
        ok: false,
        type: resultFragment.type,
        error: `WebGL fragment shader initialization failed: ${resultFragment.error}`
      };
    }

    this.handle = gl.createProgram();
    if (!this.handle) {
      this.vertexShader.destroy();
      this.fragmentShader.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "Cannot allocate WebGL program"
      };
    }

    gl.attachShader(this.handle, this.vertexShader.handle);
    gl.attachShader(this.handle, this.fragmentShader.handle);
    gl.linkProgram(this.handle);

    this.linked = gl.getProgramParameter(this.handle, gl.LINK_STATUS);
    if (!this.linked) {
      const programInfoLog = gl.getProgramInfoLog(this.handle) || "Unknown error during program linking";
      const errorDetails = [
        "Program Linking Error:",
        programInfoLog,
        "\nVertex Shader Source:",
        this.source.vertex,
        "\nFragment Shader Source:",
        this.source.fragment
      ].join("\n");

      this.destroy();

      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: errorDetails
      };
    }

    // gl.validateProgram(this.handle);
    // this.validated = gl.getProgramParameter(this.handle, gl.VALIDATE_STATUS);
    // if (!this.validated) {
    //   const validationLog = gl.getProgramInfoLog(this.handle) || "Unknown error during program validation";
    //   this.destroy();
    //   return {
    //     ok: false,
    //     type: SDKErrorType.InvalidOperation,
    //     error: `WebGL program validation failed: ${validationLog}`
    //   };
    // }

    this._extractUniformsAndAttributes();

    this.allocated = true;
    this.compiled = true;

    return {
      ok: true,
      value: this
    };
  }

  private _extractUniformsAndAttributes(): void {
    const gl = this._glSrc.gl;

    // Extract uniforms
    const numUniforms = gl.getProgramParameter(this.handle, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; ++i) {
      const u = gl.getActiveUniform(this.handle, i);
      if (u) {
        let uName = u.name;
        if (uName[uName.length - 1] === "\u0000") {
          uName = uName.substr(0, uName.length - 1);
        }
        const location = gl.getUniformLocation(this.handle, uName);
        if ((u.type === gl.SAMPLER_2D) || (u.type === gl.SAMPLER_CUBE) || (u.type === 35682) || (u.type === 36306)) {
          this.samplers[uName] = location;
        } else {
          this.uniforms[uName] = location;
        }
      }
    }

    // Extract attributes
    const numAttribs = gl.getProgramParameter(this.handle, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttribs; i++) {
      const a = gl.getActiveAttrib(this.handle, i);
      if (a) {
        const location = gl.getAttribLocation(this.handle, a.name);
        this.attributes[a.name] = new WebGLAttribute(gl, location);
      }
    }
  }

  /**
   * Binds this program.
   */
  bind() {
    if (!this.allocated) {
      return;
    }
    this._glSrc.gl.useProgram(this.handle);
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
  getSampler(name: string): WebGLUniformLocation {
    return this.samplers[name];
  }

  /**
   * Rebuilds the program after WebGL context has been restored.
   */
  public webglContextRestored(): SDKResult<any> {
    if (!this._glSrc.gl || !this.source || !this.source.vertex || !this.source.fragment) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "Cannot restore WebGL program: Missing WebGL context or shader source"
      };
    }

    // Rebuild vertex shader
    const vertexRestoreResult = this.vertexShader.webglContextRestored();
    if (vertexRestoreResult.ok===false) {
      return {
        ok: false,
        type: vertexRestoreResult.type,
        error: `Failed to restore WebGL vertex shader: ${vertexRestoreResult.error}`
      };
    }

    // Rebuild fragment shader
    const fragmentRestoreResult = this.fragmentShader.webglContextRestored();
    if (fragmentRestoreResult.ok===false) {
      return {
        ok: false,
        type: fragmentRestoreResult.type,
        error: `Failed to restore WebGL fragment shader: ${fragmentRestoreResult.error}`
      };
    }

    // Reinitialize the program
    const initResult = this.init();
    if (initResult.ok===false) {
      return {
        ok: false,
        type: initResult.type,
        error: `Failed to restore WebGL program: ${initResult.error}`
      };
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Destroys this program.
   */
  destroy() {
    if (!this.allocated) {
      return;
    }
    ids.removeItem(this.id);
    const gl = this._glSrc.gl;
    if (gl) {
      gl.deleteProgram(this.handle);
      gl.deleteShader(this.vertexShader.handle);
      gl.deleteShader(this.fragmentShader.handle);
    }
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
