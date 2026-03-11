import {SDKErrorType, SDKInternalException, SDKResult} from "../core";

class WebGLPickBuffer {
  #gl: WebGL2RenderingContext;
  #framebuffer: WebGLFramebuffer | null = null;
  #colorTextures: WebGLTexture[] = [];
  #depthBuffer: WebGLRenderbuffer | null = null;
  bound = false;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
  }

  init() : SDKResult<void>{
    const gl = this.#gl;

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      return {
        ok: false,
        error: "[WebGLPickBuffer] Failed to create framebuffer",
        type: SDKErrorType.InitializationFailed
      };
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    const colorTextures: WebGLTexture[] = [];
    for (let i = 0; i < 3; i++) {
      const tex = gl.createTexture();
      if (!tex) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(framebuffer);
        return {
          ok: false,
          error: "[WebGLPickBuffer] Failed to create color texture",
          type: SDKErrorType.InitializationFailed
        };
      }

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        tex,
        0
      );

      colorTextures.push(tex);

      this.#framebuffer = framebuffer;
    }

    const depthBuffer = gl.createRenderbuffer();
    if (!depthBuffer) {
      for (const tex of colorTextures) {
        gl.deleteTexture(tex);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      return {
        ok: false,
        error: "[WebGLPickBuffer] Failed to create depth renderbuffer",
        type: SDKErrorType.InitializationFailed
      };
    }

    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 1, 1);
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depthBuffer
    );

    gl.drawBuffers([
      gl.COLOR_ATTACHMENT0,
      gl.COLOR_ATTACHMENT1,
      gl.COLOR_ATTACHMENT2,
    ]);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      for (const tex of colorTextures) {
        gl.deleteTexture(tex);
      }
      gl.deleteRenderbuffer(depthBuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      return {
        ok: false,
        error: `[WebGLPickBuffer] Incomplete framebuffer: ${framebufferStatusToString(gl, status)}`,
        type: SDKErrorType.InitializationFailed
      };
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.#framebuffer = framebuffer;
    this.#colorTextures = colorTextures;
    this.#depthBuffer = depthBuffer;
    this.bound = false;


    return {
      ok: true,
      value: undefined
    };
  }

  get allocated(): boolean {
    return !!this.#framebuffer;
  }

  webglContextRestored(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.destroy();
    this.init();
  }

  bind() {
    if (!this.#framebuffer) {
      this.init();
    }
    if (this.bound || !this.#framebuffer) {
      return;
    }

    const gl = this.#gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.#framebuffer);
    gl.viewport(0, 0, 1, 1);
    this.bound = true;
  }

  unbind() {
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, null);
    this.bound = false;
  }

  clear() {
    if (!this.bound) {
      throw new SDKInternalException("Pick buffer not bound");
    }

    const gl = this.#gl;
    gl.disable(gl.BLEND);
    gl.disable(gl.DITHER);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  read() {
    if (!this.#framebuffer) {
      throw new SDKInternalException("Pick buffer not allocated");
    }

    const gl = this.#gl;
    const target0 = new Uint8Array(4);
    const target1 = new Uint8Array(4);
    const target2 = new Uint8Array(4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.#framebuffer);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error("Framebuffer is incomplete:", status);
    }

    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, target0);

    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, target1);

    gl.readBuffer(gl.COLOR_ATTACHMENT2);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, target2);

    return {
      target0,
      target1,
      target2,
    };
  }

  destroy() {
    const gl = this.#gl;

    for (const tex of this.#colorTextures) {
      gl.deleteTexture(tex);
    }
    this.#colorTextures = [];

    if (this.#depthBuffer) {
      gl.deleteRenderbuffer(this.#depthBuffer);
      this.#depthBuffer = null;
    }

    if (this.#framebuffer) {
      gl.deleteFramebuffer(this.#framebuffer);
      this.#framebuffer = null;
    }

    this.bound = false;
  }

}

function framebufferStatusToString(gl: WebGL2RenderingContext, status: number): string {
  switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
      return "FRAMEBUFFER_COMPLETE";
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      return "FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      return "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
    case gl.FRAMEBUFFER_UNSUPPORTED:
      return "FRAMEBUFFER_UNSUPPORTED";
    default:
      return String(status);
  }
}

export { WebGLPickBuffer };
