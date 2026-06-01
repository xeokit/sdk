import {SDKErrorType, SDKInternalException, type SDKResult} from "../../../../base/core";

/**
 * A WebGL framebuffer used for snap-to-vertex / snap-to-edge picking.
 *
 * The snap pipeline renders into a small square FBO centred on the
 * cursor — typically `(2 · snapRadius + 1)²` texels — first running
 * the snap-init pass (triangle surfaces populate the depth buffer
 * and a baseline view-position texture), then the snap pass (vertex
 * / edge primitives whose fragments survive the depth test write the
 * same view-position output). JS reads the texture back, scans for
 * the nearest non-empty texel to the centre, and reconstructs the
 * world-space snap target.
 *
 * Single MRT slot: `RGBA32F` (view-space position with `1.0` in the
 * alpha channel as a "this texel was written" sentinel — empty texels
 * read back as `0`s). One depth renderbuffer (`DEPTH_COMPONENT24`)
 * shared between the init and snap passes.
 *
 * Lifecycle mirrors {@link WebGLPickBuffer}: `init` allocates the
 * GL objects, `bind` binds the FBO, `clear` zeroes both colour and
 * depth, `read` returns the readback `Float32Array`, `unbind`
 * restores the default framebuffer, and `destroy` releases the GL
 * objects.
 *
 * Backed by `EXT_color_buffer_float` (mandatory for renderable
 * `RGBA32F` colour attachments under WebGL 2). `init` returns a
 * `NotSupported` SDKResult when the extension is absent.
 */
export class WebGLSnapBuffer {

  #gl: WebGL2RenderingContext;
  #framebuffer: WebGLFramebuffer | null = null;
  #colorTexture: WebGLTexture | null = null;
  #depthBuffer: WebGLRenderbuffer | null = null;
  #size: [number, number] = [1, 1];

  bound = false;

  /**
   * Creates a new snap framebuffer wrapper. Does NOT allocate GL
   * objects; call {@link init} first.
   */
  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
  }

  /**
   * Allocates the framebuffer + RGBA32F colour attachment + depth
   * renderbuffer at `1 × 1` (resize via {@link setSize} before use).
   * Returns `NotSupported` if `EXT_color_buffer_float` isn't
   * available — `RGBA32F` is not a colour-renderable format under
   * WebGL 2 without it.
   */
  init(): SDKResult<void> {
    const gl = this.#gl;
    if (!gl.getExtension("EXT_color_buffer_float")) {
      return {
        ok: false,
        type: SDKErrorType.NotSupported,
        error: "[WebGLSnapBuffer] EXT_color_buffer_float not available — cannot allocate RGBA32F snap target",
      };
    }
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGLSnapBuffer] Failed to create framebuffer",
      };
    }
    const colorTexture = gl.createTexture();
    if (!colorTexture) {
      gl.deleteFramebuffer(framebuffer);
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGLSnapBuffer] Failed to create color texture",
      };
    }
    const depthBuffer = gl.createRenderbuffer();
    if (!depthBuffer) {
      gl.deleteTexture(colorTexture);
      gl.deleteFramebuffer(framebuffer);
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGLSnapBuffer] Failed to create depth renderbuffer",
      };
    }

    this.#framebuffer = framebuffer;
    this.#colorTexture = colorTexture;
    this.#depthBuffer = depthBuffer;
    this.#size = [1, 1];

    // Initial allocation at 1×1 — a `setSize(...)` resize before
    // first use is expected.
    return this._allocateAttachments(1, 1);
  }

  /** True once {@link init} has succeeded. */
  get allocated(): boolean {
    return !!this.#framebuffer;
  }

  /** Current `(width, height)` of the colour + depth attachments. */
  get size(): readonly [number, number] {
    return this.#size;
  }

  /** Underlying RGBA32F colour texture — exposed for inspectors. */
  get colorTexture(): WebGLTexture | null {
    return this.#colorTexture;
  }

  /**
   * Resize the colour + depth attachments to the requested dimensions.
   * No-op when the size is already a match. Idempotent and cheap so
   * a snap-pick caller can recompute the radius per click.
   */
  setSize(width: number, height: number): SDKResult<void> {
    if (!this.#framebuffer) {
      throw new SDKInternalException("Snap buffer not allocated");
    }
    width  = Math.max(1, width  | 0);
    height = Math.max(1, height | 0);
    if (this.#size[0] === width && this.#size[1] === height) {
      return {ok: true, value: undefined};
    }
    return this._allocateAttachments(width, height);
  }

  /**
   * (Re-)allocate the colour texture (RGBA32F + nearest filter +
   * clamp-to-edge) and the depth renderbuffer to `width × height`,
   * and re-attach them to the framebuffer. Verifies completeness
   * before returning.
   */
  private _allocateAttachments(width: number, height: number): SDKResult<void> {
    const gl = this.#gl;
    const framebuffer = this.#framebuffer!;
    const colorTexture = this.#colorTexture!;
    const depthBuffer = this.#depthBuffer!;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    // Colour: RGBA32F. Nearest-only sampling (we read back exact
    // texels; bilinear would average across snap targets and break
    // the centre-distance tiebreak).
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);

    // Depth: DEPTH_COMPONENT24 — populated by snap-init, z-tested by
    // snap pass so occluded vertices/edges drop out.
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGLSnapBuffer] Incomplete framebuffer at ${width}×${height}: ${framebufferStatusToString(gl, status)}`,
      };
    }

    this.#size = [width, height];
    return {ok: true, value: undefined};
  }

  /**
   * Re-allocate after WebGL context loss. Caller is responsible for
   * supplying the new (restored) `WebGL2RenderingContext`.
   */
  webglContextRestored(gl: WebGL2RenderingContext): SDKResult<void> {
    this.#gl = gl;
    this.#framebuffer = null;
    this.#colorTexture = null;
    this.#depthBuffer = null;
    return this.init();
  }

  /**
   * Bind the snap framebuffer for rendering. Sets the viewport to the
   * current attachment size; caller still owns depth-test / blend
   * state (see `SnapManager` for the canonical setup).
   */
  bind(): void {
    if (!this.#framebuffer) {
      throw new SDKInternalException("Snap buffer not allocated");
    }
    if (this.bound) return;
    const gl = this.#gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.#framebuffer);
    gl.viewport(0, 0, this.#size[0], this.#size[1]);
    this.bound = true;
  }

  /** Release the framebuffer binding back to the default canvas. */
  unbind(): void {
    if (!this.bound) {
      throw new SDKInternalException("Snap buffer not bound");
    }
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, null);
    this.bound = false;
  }

  /**
   * Clear colour to `(0, 0, 0, 0)` and depth to `1.0`. Empty texels
   * are detected on read-back via `alpha === 0`, so clearing alpha
   * to zero is structurally important.
   */
  clear(): void {
    if (!this.bound) {
      throw new SDKInternalException("Snap buffer not bound");
    }
    const gl = this.#gl;
    gl.disable(gl.BLEND);
    gl.disable(gl.DITHER);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /**
   * Read the entire colour attachment as a `Float32Array` of length
   * `width * height * 4`. Layout is row-major bottom-to-top (WebGL
   * convention); each texel is `(viewX, viewY, viewZ, written)`
   * where `written = 1.0` if any pass touched the texel and `0.0`
   * otherwise.
   *
   * Pass `outBuffer` of the right size to avoid a fresh allocation
   * on every snap-pick.
   */
  read(outBuffer?: Float32Array): Float32Array {
    if (!this.#framebuffer) {
      throw new SDKInternalException("Snap buffer not allocated");
    }
    if (!this.bound) {
      throw new SDKInternalException("Snap buffer not bound");
    }
    const [w, h] = this.#size;
    const len = w * h * 4;
    const target = (outBuffer && outBuffer.length >= len) ? outBuffer : new Float32Array(len);
    const gl = this.#gl;
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, target);
    return target;
  }

  /** Release every GL object owned by this buffer. */
  destroy(): void {
    const gl = this.#gl;
    if (this.#colorTexture) {
      gl.deleteTexture(this.#colorTexture);
      this.#colorTexture = null;
    }
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


/**
 * Per-radius cache of {@link WebGLSnapBuffer}s — V2 keeps one buffer
 * per snap radius so repeat snap-picks at the same radius reuse the
 * already-allocated framebuffer. Caller is responsible for releasing
 * via {@link WebGLSnapBufferCache.destroy} when the renderer tears
 * down.
 */
export class WebGLSnapBufferCache {

  #gl: WebGL2RenderingContext;
  #cache = new Map<number, WebGLSnapBuffer>();

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
  }

  /**
   * Get (or lazily allocate) the snap buffer sized for the given
   * radius. The buffer is `(2 · radius + 1) × (2 · radius + 1)`.
   */
  get(radius: number): SDKResult<WebGLSnapBuffer> {
    const key = Math.max(1, radius | 0);
    let buf = this.#cache.get(key);
    if (buf && buf.allocated) {
      return {ok: true, value: buf};
    }
    buf = new WebGLSnapBuffer(this.#gl);
    const initRes = buf.init();
    if (initRes.ok === false) return initRes;
    const dim = 2 * key + 1;
    const sizeRes = buf.setSize(dim, dim);
    if (sizeRes.ok === false) {
      buf.destroy();
      return sizeRes;
    }
    this.#cache.set(key, buf);
    return {ok: true, value: buf};
  }

  webglContextRestored(gl: WebGL2RenderingContext): SDKResult<void> {
    this.#gl = gl;
    for (const buf of this.#cache.values()) {
      const r = buf.webglContextRestored(gl);
      if (r.ok === false) return r;
    }
    return {ok: true, value: undefined};
  }

  destroy(): void {
    for (const buf of this.#cache.values()) buf.destroy();
    this.#cache.clear();
  }
}


function framebufferStatusToString(gl: WebGL2RenderingContext, status: number): string {
  switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:                      return "FRAMEBUFFER_COMPLETE";
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:         return "FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: return "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
    case gl.FRAMEBUFFER_UNSUPPORTED:                   return "FRAMEBUFFER_UNSUPPORTED";
    default:                                           return String(status);
  }
}
