import type { WebGLAbstractTexture } from "./WebGLAbstractTexture";

/**
 * Represents a WebGL render buffer with optional depth texture and MRT support.
 * Internally manages a framebuffer + one or more color textures and an optional depth attachment
 * (either a texture or a renderbuffer).
 *
 * Notes:
 * - Framebuffer completeness is checked while bound.
 * - Resizes lazily via `touch()` when size or drawingBuffer changes.
 * - Provides small wrapper objects compatible with `WebGLAbstractTexture` for sampling the color/depth textures.
 * - `allocated` is derived from internal state (getter) instead of a manual flag.
 */
class WebGLRenderBuffer {
  #gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  #buffer: BufferState | null = null;
  bound = false;
  size?: readonly [number, number];
  #imageDataCache: ImageCache | null = null;
  #texture: WebGLAbstractTexture | null = null;
  #depthTexture: WebGLAbstractTexture | null = null;
  #hasDepthTexture: boolean;
  #depthTextureCompare: boolean;
  #colorFilter: "linear" | "nearest";
  #colorFilters: ("linear" | "nearest")[] | null;
  #stencil: boolean;

  /**
   * Creates a WebGLRenderBuffer.
   *
   * @param canvas host canvas (for image-cache sizing only)
   * @param gl    WebGL2 context
   * @param options
   * @param options.depthTexture create a sampleable depth attachment
   * @param options.depthTextureCompare when `depthTexture` is true, set
   *   TEXTURE_COMPARE_MODE on the depth texture so it can be sampled with
   *   `sampler2DShadow` in GLSL — gets 2×2 hardware-bilinear comparison free
   *   per tap. Also switches the depth texture to LINEAR filtering (only
   *   valid with compare mode on).
   * @param options.colorFilter `"nearest"` (default) for pixel-accurate
   *   sampling (e.g. SAO depth), `"linear"` for bilinear-filtered reads
   *   (e.g. supersampling downsample on the HDR scene target).
   * @param options.size explicit buffer size (defaults to canvas size)
   * @param options.stencil When `true`, pack a stencil channel alongside
   *   depth. Allocates DEPTH24_STENCIL8 instead of DEPTH_COMPONENT24, and
   *   attaches as DEPTH_STENCIL_ATTACHMENT. Mutually exclusive with
   *   `depthTexture` (no sampleable depth+stencil texture here).
   * @param options.colorFilters Optional per-attachment filter array
   *   that overrides `colorFilter` for individual MRT slots. Use when
   *   one attachment is an integer format (R8UI etc.) which requires
   *   NEAREST while a neighbouring float attachment wants LINEAR.
   *   Indices not in this array fall back to `colorFilter`.
   */
  constructor(
      canvas: HTMLCanvasElement,
      gl: WebGL2RenderingContext,
      options: {
        depthTexture: boolean;
        size?: readonly [number, number];
        depthTextureCompare?: boolean;
        colorFilter?: "linear" | "nearest";
        stencil?: boolean;
        colorFilters?: ("linear" | "nearest")[];
      }
  ) {
    this.#gl = gl;
    this.canvas = canvas;
    this.size = options.size;
    this.#hasDepthTexture = !!options.depthTexture;
    this.#depthTextureCompare = !!options.depthTextureCompare;
    this.#colorFilter = options.colorFilter === "linear" ? "linear" : "nearest";
    this.#colorFilters = options.colorFilters ? options.colorFilters.slice() : null;
    this.#stencil = !!options.stencil;
  }

  /** Whether GPU resources are currently allocated. */
  get allocated(): boolean {
    return !!this.#buffer;
  }

  /** Sets the desired size; actual allocation happens on next bind/touch. */
  setSize(size: readonly [number, number]) {
    this.size = size;
  }

  /**
   * Forget the GPU resources after a context loss. They belong to the dead
   * context, so the handles are dropped WITHOUT `gl.delete*` (which would
   * error against the restored context); `touch()` recreates them lazily on
   * the next bind.
   */
  webglContextLost() {
    this.#buffer = null;
    this.bound = false;
  }

  /** Re-associate with a restored WebGL2 context. */
  webglContextRestored(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.#buffer = null;
    this.bound = false;
  }

  /** Bind the framebuffer, allocating or resizing as needed. */
  bind(...internalformats: number[]) {
    this.touch(...internalformats);
    if (!this.#buffer) return;
    // Always re-issue the GL bind. The `bound` flag can't be trusted as a
    // short-circuit because other buffers' `unbind()` calls mutate the GL
    // state behind this one's back — skipping the bind here leaves draws
    // going to whichever framebuffer was unbound-to-null last.
    const gl = this.#gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.#buffer.framebuf);
    this.bound = true;
  }

  /** Ensure GPU resources exist and match the desired size. */
  touch(...internalformats: number[]) {
    const gl = this.#gl;

    const [width, height] = this.size
        ? [this.size[0], this.size[1]]
        : [gl.drawingBufferWidth, gl.drawingBufferHeight];

    const needsResize =
        !this.#buffer ||
        this.#buffer.width !== width ||
        this.#buffer.height !== height;

    if (!needsResize) return;

    // Dispose previous resources (if any)
    this.#disposeGPUResources();

    // Create color textures
    const colorTextures: WebGLTexture[] = [];
    if (internalformats.length > 0) {
      for (let i = 0; i < internalformats.length; i++) {
        colorTextures.push(this.#createColorTexture(width, height, internalformats[i], i));
      }
    } else {
      colorTextures.push(this.#createColorTexture(width, height, null, 0));
    }

    // Optional depth as texture; otherwise a renderbuffer
    let depthTex: WebGLTexture | null = null;
    let depthRbo: WebGLRenderbuffer | null = null;

    const framebuf = gl.createFramebuffer();
    if (!framebuf) {
      throw new Error("Failed to create framebuffer");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuf);

    // Attach colors
    for (let i = 0; i < colorTextures.length; i++) {
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + i,
          gl.TEXTURE_2D,
          colorTextures[i],
          0
      );
    }

    if (colorTextures.length > 1) {
      gl.drawBuffers(colorTextures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    }

    if (this.#hasDepthTexture) {
      depthTex = gl.createTexture();
      if (!depthTex) {
        throw new Error("Failed to create depth texture");
      }
      gl.bindTexture(gl.TEXTURE_2D, depthTex);
      // When compare mode is on, LINEAR filtering gives a 2×2 PCF-style
      // bilinear compare per sample. Without it, use NEAREST (LINEAR + no
      // compare mode is undefined behaviour on several drivers).
      const depthFilter = this.#depthTextureCompare ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, depthFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, depthFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.#depthTextureCompare) {
        // Any sampler2DShadow sample will compare its reference against this
        // texture with LEQUAL (frag passes — i.e. is lit — when its refDepth is
        // at or in front of the stored texel). This avoids needing a large
        // receiver bias for coplanar/self-shadow cases.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      }
      // Use DEPTH_COMPONENT24 for wide compatibility; 32F may be unsupported on some devices.
      gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.DEPTH_COMPONENT24,
          width,
          height,
          0,
          gl.DEPTH_COMPONENT,
          gl.UNSIGNED_INT,
          null
      );
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          depthTex,
          0
      );
    } else {
      depthRbo = gl.createRenderbuffer();
      if (!depthRbo) {
        throw new Error("Failed to create renderbuffer");
      }
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRbo);
      if (this.#stencil) {
        // Pack 24-bit depth + 8-bit stencil in one renderbuffer.
        // Attached to DEPTH_STENCIL_ATTACHMENT so a single bind
        // satisfies both depth and stencil reads from any shader.
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, width, height);
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_STENCIL_ATTACHMENT,
            gl.RENDERBUFFER,
            depthRbo
        );
      } else {
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            depthRbo
        );
      }
    }

    // Check completeness while bound
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // Clean up partially-created resources before throwing
      for (const t of colorTextures) gl.deleteTexture(t);
      if (depthTex) gl.deleteTexture(depthTex);
      if (depthRbo) gl.deleteRenderbuffer(depthRbo);
      gl.deleteFramebuffer(framebuf);

      const reason = framebufferStatusToString(gl, status);
      throw new Error(`Incomplete framebuffer: ${reason}`);
    }

    // Unbind
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.#buffer = {
      framebuf,
      renderbuf: depthRbo,
      textures: colorTextures,
      depthTexture: depthTex,
      width,
      height,
    };

    this.bound = false;
  }

  /** Clear currently bound framebuffer. */
  clear(mask: number = this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT) {
    if (!this.bound) throw new Error("Render buffer not bound");
    this.#gl.clear(mask);
  }

  /** Read a single pixel from the given color attachment (default 0). */
  read(
      pickX: number,
      pickY: number,
      glFormat: number | null = null,
      glType: number | null = null,
      arrayType: TypedArrayConstructor = Uint8Array,
      arrayMultiplier: number = 4,
      colorBufferIndex = 0
  ) {
    if (!this.#buffer) throw new Error("No buffer allocated");
    const gl = this.#gl;
    const x = pickX;
    const y = this.#buffer.height ? this.#buffer.height - pickY - 1 : gl.drawingBufferHeight - pickY;
    const pix = new arrayType(arrayMultiplier);
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + colorBufferIndex);
    gl.readPixels(
        x,
        y,
        1,
        1,
        glFormat ?? gl.RGBA,
        glType ?? gl.UNSIGNED_BYTE,
        pix,
        0
    );
    return pix;
  }

  /** Read the entire color attachment into a typed array. */
  readArray(
      glFormat: number | null = null,
      glType: number | null = null,
      arrayType: TypedArrayConstructor = Uint8Array,
      arrayMultiplier = 4,
      colorBufferIndex = 0
  ) {
    if (!this.#buffer) throw new Error("No buffer allocated");
    const { width, height } = this.#buffer;
    const gl = this.#gl;
    const pix = new arrayType(width * height * arrayMultiplier);
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + colorBufferIndex);
    gl.readPixels(0, 0, width, height, glFormat ?? gl.RGBA, glType ?? gl.UNSIGNED_BYTE, pix, 0);
    return pix;
  }

  /**
   * Returns an HTMLCanvasElement containing the current contents.
   * Also updates an internal CPU-side ImageData cache for reuse.
   */
  readImageAsCanvas(): HTMLCanvasElement {
    this.#updateImageCacheFromGPU();
    if (!this.#imageDataCache) throw new Error("Image cache unavailable");
    return this.#imageDataCache.canvas;
  }

  /** Returns a data URL (png/jpeg/bmp) of the current contents. */
  readImage(params: { height?: number; width?: number; format?: string } = {}) {
    this.#updateImageCacheFromGPU();
    if (!this.#imageDataCache) throw new Error("Image cache unavailable");
    const format = params.format || "png";
    return this.#imageDataCache.canvas.toDataURL(`image/${format}`);
  }

  /** Unbind the framebuffer. */
  unbind() {
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, null);
    this.bound = false;
  }

  /** Wrapper texture for sampling the first color target. */
  getTexture(): WebGLAbstractTexture {
    if (this.#texture) return this.#texture;
    this.#texture = {
      bind: (unit: number) => {
        const buf = this.#buffer;
        if (buf && buf.textures[0]) {
          const gl = this.#gl;
          // @ts-ignore indexer exists on WebGL2 contexts
          gl.activeTexture(gl["TEXTURE" + unit]);
          gl.bindTexture(gl.TEXTURE_2D, buf.textures[0]);
          return true;
        }
        return false;
      },
      unbind: (unit: number) => {
        const buf = this.#buffer;
        if (buf && buf.textures[0]) {
          const gl = this.#gl;
          // @ts-ignore indexer exists on WebGL2 contexts
          gl.activeTexture(gl["TEXTURE" + unit]);
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
      },
    };
    return this.#texture;
  }

  /**
   * Wrapper texture for sampling a specific MRT color target.
   * Returns null when no attachment exists at the given index.
   */
  getTextureAt(index: number): WebGLAbstractTexture | null {
    const buf = this.#buffer;
    if (!buf || !buf.textures[index]) return null;
    const gl = this.#gl;
    return {
      bind: (unit: number) => {
        const b2 = this.#buffer;
        const tex = b2 ? b2.textures[index] : null;
        if (!tex) return false;
        // @ts-ignore indexer exists on WebGL2 contexts
        gl.activeTexture(gl["TEXTURE" + unit]);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        return true;
      },
      unbind: (unit: number) => {
        // @ts-ignore indexer exists on WebGL2 contexts
        gl.activeTexture(gl["TEXTURE" + unit]);
        gl.bindTexture(gl.TEXTURE_2D, null);
      },
    };
  }

  /** Number of allocated color attachments. */
  getColorAttachmentCount(): number {
    return this.#buffer ? this.#buffer.textures.length : 0;
  }

  /**
   * Raw GL handle for the texture at the given color attachment
   * index — needed by callers that have to detach / reattach the
   * attachment manually (e.g. to break a feedback loop when the
   * cap quad samples a previous pass's MRT output). Most consumers
   * should prefer {@link getTextureAt}.
   */
  getRawTextureAt(index: number): WebGLTexture | null {
    return this.#buffer ? this.#buffer.textures[index] ?? null : null;
  }

  /** Whether this FBO has a depth texture attachment. */
  hasDepthTexture(): boolean {
    return this.#hasDepthTexture;
  }

  /** Wrapper texture for sampling the depth texture (if present). */
  getDepthTexture(): WebGLAbstractTexture | null {
    if (!this.#hasDepthTexture) return null;
    if (this.#depthTexture) return this.#depthTexture;
    this.#depthTexture = {
      bind: (unit: number) => {
        const buf = this.#buffer;
        if (buf && buf.depthTexture) {
          const gl = this.#gl;
          // @ts-ignore indexer exists on WebGL2 contexts
          gl.activeTexture(gl["TEXTURE" + unit]);
          gl.bindTexture(gl.TEXTURE_2D, buf.depthTexture);
          return true;
        }
        return false;
      },
      unbind: (unit: number) => {
        const buf = this.#buffer;
        if (buf && buf.depthTexture) {
          const gl = this.#gl;
          // @ts-ignore indexer exists on WebGL2 contexts
          gl.activeTexture(gl["TEXTURE" + unit]);
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
      },
    };
    return this.#depthTexture;
  }

  /** Destroy GPU resources and caches. */
  destroy() {
    this.#disposeGPUResources();
    this.bound = false;
    this.#imageDataCache = null;
    this.#texture = null;
    this.#depthTexture = null;
  }

  // ---------- Internals ----------

  #createColorTexture(width: number, height: number, internalformat: number | null, slot: number = 0): WebGLTexture {
    const gl = this.#gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create texture");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const filterName = (this.#colorFilters && this.#colorFilters[slot])
      ? this.#colorFilters[slot]
      : this.#colorFilter;
    const colorFilter = filterName === "linear" ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, colorFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, colorFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (internalformat != null) {
      gl.texStorage2D(gl.TEXTURE_2D, 1, internalformat, width, height);
    } else {
      gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  #disposeGPUResources() {
    const buf = this.#buffer;
    if (!buf) return;
    const gl = this.#gl;
    for (const t of buf.textures) gl.deleteTexture(t);
    if (buf.depthTexture) gl.deleteTexture(buf.depthTexture);
    if (buf.renderbuf) gl.deleteRenderbuffer(buf.renderbuf);
    gl.deleteFramebuffer(buf.framebuf);
    this.#buffer = null;
  }

  #updateImageCacheFromGPU() {
    if (!this.#buffer) throw new Error("No buffer allocated");
    const gl = this.#gl;
    const { width, height } = this.#buffer;

    const cache = this.#getImageDataCache(Uint8Array, 4);

    // Read pixels (bottom-left origin) then flip into top-left origin for Canvas2D
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, cache.pixelData, 0);

    // Vertical flip into ImageData
    const bytesPerRow = width * 4;
    for (let y = 0; y < height; y++) {
      const srcOffset = (height - 1 - y) * bytesPerRow;
      const dstOffset = y * bytesPerRow;
      cache.imageData.data.set(cache.pixelData.subarray(srcOffset, srcOffset + bytesPerRow), dstOffset);
    }

    cache.context.putImageData(cache.imageData, 0, 0);
  }

  #getImageDataCache<T extends TypedArrayConstructor>(type: T, multiplier: number): ImageCache {
    if (!this.#buffer) throw new Error("No buffer allocated");
    const bufferWidth = this.#buffer.width;
    const bufferHeight = this.#buffer.height;

    let cache = this.#imageDataCache;
    if (cache && (cache.width !== bufferWidth || cache.height !== bufferHeight)) {
      this.#imageDataCache = null;
      cache = null;
    }

    if (!cache) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D context unavailable");

      canvas.width = bufferWidth;
      canvas.height = bufferHeight;

      cache = {
        pixelData: new type(bufferWidth * bufferHeight * multiplier) as unknown as Uint8Array<any>,
        canvas,
        context,
        imageData: context.createImageData(bufferWidth, bufferHeight),
        width: bufferWidth,
        height: bufferHeight,
      };
      this.#imageDataCache = cache;
    }

    // Prevent transform accumulation if caller draws/reads repeatedly
    cache.context.resetTransform();
    return cache;
  }
}

// ---------- Types ----------

export type TypedArrayConstructor = {
  new (length: number): any;
};

interface BufferState {
  framebuf: WebGLFramebuffer;
  renderbuf: WebGLRenderbuffer | null;
  textures: WebGLTexture[];
  depthTexture: WebGLTexture | null;
  width: number;
  height: number;
}

interface ImageCache {
  pixelData: Uint8Array<any>;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: ImageData;
  width: number;
  height: number;
}

function framebufferStatusToString(gl: WebGL2RenderingContext, status: number): string {
  switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
      return "FRAMEBUFFER_COMPLETE";
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      return "FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      return "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
      // WebGL2 does not expose FRAMEBUFFER_INCOMPLETE_DIMENSIONS as a status constant; include for clarity if provided by impl
    case (gl as any).FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      return "FRAMEBUFFER_INCOMPLETE_DIMENSIONS";
    case gl.FRAMEBUFFER_UNSUPPORTED:
      return "FRAMEBUFFER_UNSUPPORTED";
    default:
      return String(status);
  }
}

export { WebGLRenderBuffer };
