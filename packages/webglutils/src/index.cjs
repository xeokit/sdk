var utils = require('@xeokit/utils');
var constants = require('@xeokit/constants');

/**
 * Represents a WebGL ArrayBuffer.
 */
var GLArrayBuf = /*#__PURE__*/function () {
  /**
   * Creates a WebGL ArrayBuffer.
   */
  function GLArrayBuf(gl, type, data, numItems, itemSize, usage, normalized, stride, offset) {
    /**
     * WebGL2 rendering context.
     */
    this.gl = void 0;
    /**
     * The ArrayBuffer's item type.
     */
    this.itemType = void 0;
    /**
     * Byte size of each item.
     */
    this.itemByteSize = void 0;
    /**
     * The ArrayBuffer type.
     */
    this.type = void 0;
    /**
     * Allocated yet?
     */
    this.allocated = void 0;
    /**
     * A GLenum specifying the intended usage pattern of the data store for optimization purposes. Possible values:
     *
     * * gl.STATIC_DRAW : The contents are intended to be specified once by the application, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.DYNAMIC_DRAW : The contents are intended to be respecified repeatedly by the application, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.STREAM_DRAW : The contents are intended to be specified once by the application, and used at most a few times as the source for WebGL drawing and image specification commands.
     * * gl.STATIC_READ : The contents are intended to be specified once by reading data from WebGL, and queried many times by the application.
     * * gl.DYNAMIC_READ : The contents are intended to be respecified repeatedly by reading data from WebGL, and queried many times by the application.
     * * gl.STREAM_READ : The contents are intended to be specified once by reading data from WebGL, and queried at most a few times by the application
     * * gl.STATIC_COPY : The contents are intended to be specified once by reading data from WebGL, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.DYNAMIC_COPY : The contents are intended to be respecified repeatedly by reading data from WebGL, and used many times as the source for WebGL drawing and image specification commands.
     * * gl.STREAM_COPY : The contents are intended to be specified once by reading data from WebGL, and used at most a few times as the source for WebGL drawing and image specification commands.
     */
    this.usage = void 0;
    /**
     * The ArrayBuffer type.
     */
    this.length = void 0;
    /**
     *
     */
    this.dataLength = void 0;
    /**
     * Number of items in the ArrayBuffer.
     */
    this.numItems = void 0;
    /**
     * Size of each item.
     */
    this.itemSize = void 0;
    /**
     * True when ArrayBuffer values are normalized.
     */
    this.normalized = void 0;
    /**
     * The ArrayBuffer stride.
     */
    this.stride = void 0;
    /**
     *
     */
    this.offset = void 0;
    /**
     * Hand to a WebGLBuffer.
     */
    this.handle = void 0;
    this.gl = gl;
    this.type = type;
    this.allocated = false;
    switch (data.constructor) {
      case Uint8Array:
        this.itemType = gl.UNSIGNED_BYTE;
        this.itemByteSize = 1;
        break;
      case Int8Array:
        this.itemType = gl.BYTE;
        this.itemByteSize = 1;
        break;
      case Uint16Array:
        this.itemType = gl.UNSIGNED_SHORT;
        this.itemByteSize = 2;
        break;
      case Int16Array:
        this.itemType = gl.SHORT;
        this.itemByteSize = 2;
        break;
      case Uint32Array:
        this.itemType = gl.UNSIGNED_INT;
        this.itemByteSize = 4;
        break;
      case Int32Array:
        this.itemType = gl.INT;
        this.itemByteSize = 4;
        break;
      default:
        this.itemType = gl.FLOAT;
        this.itemByteSize = 4;
    }
    this.usage = usage;
    this.length = 0;
    this.dataLength = numItems;
    this.numItems = 0;
    this.itemSize = itemSize;
    this.normalized = !!normalized;
    this.stride = stride || 0;
    this.offset = offset || 0;
    this._allocate(data);
  }
  var _proto = GLArrayBuf.prototype;
  _proto._allocate = function _allocate(data) {
    this.allocated = false;
    // @ts-ignore
    this.handle = this.gl.createBuffer();
    if (!this.handle) {
      throw new Error("Failed to allocate WebGL ArrayBuffer");
    }
    if (this.handle) {
      this.gl.bindBuffer(this.type, this.handle);
      this.gl.bufferData(this.type, data.length > this.dataLength ? data.slice(0, this.dataLength) : data, this.usage);
      this.gl.bindBuffer(this.type, null);
      this.length = data.length;
      this.numItems = this.length / this.itemSize;
      this.allocated = true;
    }
  }
  /**
   * Updates the contents of this ArrayBuffer.
   * @param data
   * @param offset
   */;
  _proto.setData = function setData(data, offset) {
    if (!this.allocated) {
      return;
    }
    if (data.length + (offset || 0) > this.length) {
      // Needs reallocation
      this.destroy();
      this._allocate(data);
    } else {
      // No reallocation needed
      this.gl.bindBuffer(this.type, this.handle);
      if (offset || offset === 0) {
        this.gl.bufferSubData(this.type, offset * this.itemByteSize, data);
      } else {
        this.gl.bufferData(this.type, data, this.usage);
      }
      this.gl.bindBuffer(this.type, null);
    }
  }
  /**
   * Binds this ArrayBuffer to the WebGL rendering context.
   */;
  _proto.bind = function bind() {
    if (!this.allocated) {
      return;
    }
    this.gl.bindBuffer(this.type, this.handle);
  }
  /**
   * Unbinds this ArrayBuffer from the WebGL rendering context.
   */;
  _proto.unbind = function unbind() {
    if (!this.allocated) {
      return;
    }
    this.gl.bindBuffer(this.type, null);
  }
  /**
   * Destroys this ArrayBuffer.
   */;
  _proto.destroy = function destroy() {
    if (!this.allocated) {
      return;
    }
    this.gl.deleteBuffer(this.handle);
    this.allocated = false;
  };
  return GLArrayBuf;
}();

/**
 * Represents a WebGL vertex attribute.
 */
var GLAttribute = /*#__PURE__*/function () {
  /**
   * Creates a new vertex attribute.
   * @param gl
   * @param location
   */
  function GLAttribute(gl, location) {
    this.gl = void 0;
    this.location = void 0;
    this.gl = gl;
    this.location = location;
  }
  /**
   * Binds an array buffer to this vertex attribute.
   * @param arrayBuf
   */
  var _proto = GLAttribute.prototype;
  _proto.bindArrayBuffer = function bindArrayBuffer(arrayBuf) {
    if (!arrayBuf) {
      return;
    }
    arrayBuf.bind();
    this.gl.enableVertexAttribArray(this.location);
    this.gl.vertexAttribPointer(this.location, arrayBuf.itemSize, arrayBuf.itemType, arrayBuf.normalized, arrayBuf.stride, arrayBuf.offset);
  };
  return GLAttribute;
}();

var id = 0;
function _classPrivateFieldLooseKey(name) {
  return "__private_" + id++ + "_" + name;
}
function _classPrivateFieldLooseBase(receiver, privateKey) {
  if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) {
    throw new TypeError("attempted to use private field on non-instance");
  }
  return receiver;
}

var _onDestroyed = /*#__PURE__*/_classPrivateFieldLooseKey("onDestroyed");
/**
 * Represents a WebGL2 data texture.
 */
var GLDataTexture = /*#__PURE__*/function () {
  /**
   * Constructs a new GLDataTexture.
   * @param params
   */
  function GLDataTexture(params) {
    if (params === void 0) {
      params = {};
    }
    this.gl = void 0;
    this.texture = void 0;
    this.textureWidth = void 0;
    this.textureHeight = void 0;
    this.textureData = void 0;
    Object.defineProperty(this, _onDestroyed, {
      writable: true,
      value: void 0
    });
    this.gl = params.gl;
    this.texture = params.texture;
    this.textureWidth = params.textureWidth;
    this.textureHeight = params.textureHeight;
    this.textureData = params.textureData;
    _classPrivateFieldLooseBase(this, _onDestroyed)[_onDestroyed] = params.onDestroyed;
  }
  /**
   * Binds this GLDataTexture to the given {@link GLSampler}.
   * @param glProgram
   * @param sampler
   * @param unit
   */
  var _proto = GLDataTexture.prototype;
  _proto.bindTexture = function bindTexture(glProgram, sampler, unit) {
    if (!this.gl) {
      return;
    }
    sampler.bindTexture(this, unit);
  }
  /**
   * Unbinds this GLDataTexture from whichever {@link GLSampler} it's currently bound to, if any.
   * @param unit
   */;
  _proto.bind = function bind(unit) {
    if (!this.gl || !this.texture) {
      return false;
    }
    // @ts-ignore
    this.gl.activeTexture(this.gl["TEXTURE" + unit]);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    return true;
  };
  _proto.disableFiltering = function disableFiltering() {
    if (!this.gl) {
      return;
    }
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  };
  _proto.unbind = function unbind(unit) {
    if (!this.gl) {
      return;
    }
    // This `unbind` method is ignored at the moment to allow avoiding to rebind same texture already bound to a texture unit.
    // this.gl.activeTexture(this.state.gl["TEXTURE" + unit]);
    // this.gl.bindTexture(this.state.gl.TEXTURE_2D, null);
  };
  _proto.destroy = function destroy() {
    if (!this.gl || !this.texture) {
      return;
    }
    this.gl.deleteTexture(this.texture);
    this.texture = null;
    if (_classPrivateFieldLooseBase(this, _onDestroyed)[_onDestroyed]) {
      _classPrivateFieldLooseBase(this, _onDestroyed)[_onDestroyed]();
    }
  };
  return GLDataTexture;
}();

/**
 * Represents a WebGL2 shader.
 */
var GLShader = /*#__PURE__*/function () {
  /**
   * Creates a new shader.
   * @param gl
   * @param type
   * @param source
   */
  function GLShader(gl, type, source) {
    /**
     * Compilation errors, if any.
     */
    this.errors = void 0;
    /**
     * True when this shader was successfully allocated.
     */
    this.allocated = void 0;
    /**
     * True when this shader was successfully compiled.
     */
    this.compiled = void 0;
    /**
     * Handle to GPU-resident WebGL2 shader.
     */
    this.handle = void 0;
    this.allocated = false;
    this.compiled = false;
    // @ts-ignore
    this.handle = gl.createShader(type);
    if (!this.handle) {
      this.errors = ["Failed to allocate"];
      return;
    }
    this.allocated = true;
    gl.shaderSource(this.handle, source);
    gl.compileShader(this.handle);
    this.compiled = gl.getShaderParameter(this.handle, gl.COMPILE_STATUS);
    if (!this.compiled) {
      if (!gl.isContextLost()) {
        // Handled explicitly elsewhere, so won't re-handle here
        var lines = source.split("\n");
        var numberedLines = [];
        for (var i = 0; i < lines.length; i++) {
          numberedLines.push(i + 1 + ": " + lines[i] + "\n");
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
  var _proto = GLShader.prototype;
  _proto.destroy = function destroy() {};
  return GLShader;
}();

/**
 * Represents a WebGL2 sampler.
 */
var GLSampler = /*#__PURE__*/function () {
  /**
   * Creates a new sampler.
   * @param gl
   * @param location
   */
  function GLSampler(gl, location) {
    this.location = void 0;
    this.gl = void 0;
    this.gl = gl;
    this.location = location;
  }
  /**
   * Binds a texture to this sampler.
   * @param texture
   * @param unit
   */
  var _proto = GLSampler.prototype;
  _proto.bindTexture = function bindTexture(texture, unit) {
    if (texture.bind(unit)) {
      this.gl.uniform1i(this.location, unit);
      return true;
    }
    return false;
  };
  return GLSampler;
}();

var ids = new utils.Map({}, "");
/**
 * Represents a WebGL2 program.
 */
var GLProgram = /*#__PURE__*/function () {
  /**
   * Creates a new program.
   * @param gl
   * @param shaderSource
   */
  function GLProgram(gl, shaderSource) {
    /**
     * Unique ID of this program.
     */
    this.id = void 0;
    /**
     * The vertex shader.
     */
    this.vertexShader = void 0;
    /**
     * The fragment shader.
     */
    this.fragmentShader = void 0;
    /**
     * Map of all attributes in this program.
     */
    this.attributes = void 0;
    /**
     * Map of all samplers in this program.
     */
    this.samplers = void 0;
    /**
     * Map of all uniforms in this program.
     */
    this.uniforms = void 0;
    /**
     * List of compilation errors for this program, if any.
     */
    this.errors = void 0;
    /**
     * Flag set true when program has been validated.
     */
    this.validated = void 0;
    /**
     * Flag set true when this program has been successfully linked.
     */
    this.linked = void 0;
    /**
     * Flag set true when this program has been successfully conpiled.
     */
    this.compiled = void 0;
    /**
     * Flag set true when this program has been successfully allocated.
     */
    this.allocated = void 0;
    /**
     * The WebGL2 rendering context.
     */
    this.gl = void 0;
    /**
     * The source code from which the shaders are built.
     */
    this.source = void 0;
    /**
     * Handle to the WebGL program itself, which resides on the GPU.
     */
    this.handle = void 0;
    // @ts-ignore
    this.id = ids.addItem({});
    this.source = shaderSource;
    this.gl = gl;
    this.allocated = false;
    this.compiled = false;
    this.linked = false;
    this.validated = false;
    this.errors = [];
    this.uniforms = {};
    this.samplers = {};
    this.attributes = {};
    this.vertexShader = new GLShader(gl, gl.VERTEX_SHADER, this.source.vertex);
    this.fragmentShader = new GLShader(gl, gl.FRAGMENT_SHADER, this.source.fragment);
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
    var numUniforms = gl.getProgramParameter(this.handle, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < numUniforms; ++i) {
      var u = gl.getActiveUniform(this.handle, i);
      if (u) {
        var uName = u.name;
        if (uName[uName.length - 1] === "\0") {
          uName = uName.substr(0, uName.length - 1);
        }
        var location = gl.getUniformLocation(this.handle, uName);
        if (u.type === gl.SAMPLER_2D || u.type === gl.SAMPLER_CUBE || u.type === 35682) {
          // @ts-ignore
          this.samplers[uName] = new GLSampler(gl, location);
        } else {
          // @ts-ignore
          this.uniforms[uName] = location;
        }
      }
    }
    var numAttribs = gl.getProgramParameter(this.handle, gl.ACTIVE_ATTRIBUTES);
    for (var _i = 0; _i < numAttribs; _i++) {
      var a = gl.getActiveAttrib(this.handle, _i);
      if (a) {
        var _location = gl.getAttribLocation(this.handle, a.name);
        this.attributes[a.name] = new GLAttribute(gl, _location);
      }
    }
    this.allocated = true;
  }
  /**
   * Binds this program.
   */
  var _proto = GLProgram.prototype;
  _proto.bind = function bind() {
    if (!this.allocated) {
      return;
    }
    this.gl.useProgram(this.handle);
  }
  /**
   * Gets the location of the given uniform within this program.
   * @param name
   */;
  _proto.getLocation = function getLocation(name) {
    return this.uniforms[name];
  }
  /**
   * Gets an attribute within this program.
   * @param name
   */;
  _proto.getAttribute = function getAttribute(name) {
    return this.attributes[name];
  }
  /**
   * Gets a sampler within this program.
   * @param name
   */;
  _proto.getSampler = function getSampler(name) {
    return this.samplers[name];
  }
  /**
   * Binds a texture to this program.
   * @param name
   * @param texture
   * @param unit
   */;
  _proto.bindTexture = function bindTexture(name, texture, unit) {
    if (!this.allocated) {
      return false;
    }
    var sampler = this.samplers[name];
    if (sampler) {
      return sampler.bindTexture(texture, unit);
    } else {
      return false;
    }
  }
  /**
   * Destroys this program.
   */;
  _proto.destroy = function destroy() {
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
  };
  return GLProgram;
}();
function logErrors(errors) {
  console.error(errors.join("\n"));
}

/**
 * Canvas2Image v0.1
 * Copyright (c) 2008 Jacob Seidelin, cupboy@gmail.com
 * MIT License [http://www.opensource.org/licenses/mit-license.php]
 *
 * Modified by @xeolabs to permit vertical flipping, so that snapshot can be taken from WebGL frame buffers,
 * which vertically flip image data as part of the way that WebGL renders textures.
 */
var Canvas2Image = function () {
  // check if we have canvas support
  var oCanvas = document.createElement("canvas"),
    sc = String.fromCharCode;
  // no canvas, bail out.
  if (!oCanvas.getContext) {
    return {
      saveAsBMP: function saveAsBMP() {},
      saveAsPNG: function saveAsPNG() {},
      saveAsJPEG: function saveAsJPEG() {}
    };
  }
  // @ts-ignore
  var bHasImageData = !!oCanvas.getContext("2d").getImageData,
    bHasDataURL = !!oCanvas.toDataURL,
    bHasBase64 = !!window.btoa;
  // ok, we're good
  var readCanvasData = function readCanvasData(oCanvas) {
    // @ts-ignore
    var iWidth = parseInt(oCanvas.width),
      iHeight = parseInt(oCanvas.height);
    // @ts-ignore
    return oCanvas.getContext("2d").getImageData(0, 0, iWidth, iHeight);
  };
  // base64 encodes either a string or an array of charcodes
  var encodeData = function encodeData(data) {
    var i,
      aData,
      strData = "";
    if (typeof data == "string") {
      strData = data;
    } else {
      aData = data;
      for (i = 0; i < aData.length; i++) {
        strData += sc(aData[i]);
      }
    }
    return btoa(strData);
  };
  // creates a base64 encoded string containing BMP data takes an imagedata object as argument
  var createBMP = function createBMP(oData) {
    var strHeader = '';
    var iWidth = oData.width;
    var iHeight = oData.height;
    strHeader += 'BM';
    var iFileSize = iWidth * iHeight * 4 + 54; // total header size = 54 bytes
    strHeader += sc(iFileSize % 256);
    iFileSize = Math.floor(iFileSize / 256);
    strHeader += sc(iFileSize % 256);
    iFileSize = Math.floor(iFileSize / 256);
    strHeader += sc(iFileSize % 256);
    iFileSize = Math.floor(iFileSize / 256);
    strHeader += sc(iFileSize % 256);
    strHeader += sc(0, 0, 0, 0, 54, 0, 0, 0); // data offset
    strHeader += sc(40, 0, 0, 0); // info header size
    var iImageWidth = iWidth;
    strHeader += sc(iImageWidth % 256);
    iImageWidth = Math.floor(iImageWidth / 256);
    strHeader += sc(iImageWidth % 256);
    iImageWidth = Math.floor(iImageWidth / 256);
    strHeader += sc(iImageWidth % 256);
    iImageWidth = Math.floor(iImageWidth / 256);
    strHeader += sc(iImageWidth % 256);
    var iImageHeight = iHeight;
    strHeader += sc(iImageHeight % 256);
    iImageHeight = Math.floor(iImageHeight / 256);
    strHeader += sc(iImageHeight % 256);
    iImageHeight = Math.floor(iImageHeight / 256);
    strHeader += sc(iImageHeight % 256);
    iImageHeight = Math.floor(iImageHeight / 256);
    strHeader += sc(iImageHeight % 256);
    strHeader += sc(1, 0, 32, 0); // num of planes & num of bits per pixel
    strHeader += sc(0, 0, 0, 0); // compression = none
    var iDataSize = iWidth * iHeight * 4;
    strHeader += sc(iDataSize % 256);
    iDataSize = Math.floor(iDataSize / 256);
    strHeader += sc(iDataSize % 256);
    iDataSize = Math.floor(iDataSize / 256);
    strHeader += sc(iDataSize % 256);
    iDataSize = Math.floor(iDataSize / 256);
    strHeader += sc(iDataSize % 256);
    strHeader += sc(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); // these bytes are not used
    var aImgData = oData.data;
    var strPixelData = "";
    var x;
    var y = iHeight;
    var iOffsetX;
    var iOffsetY;
    var strPixelRow;
    do {
      iOffsetY = iWidth * (y - 1) * 4;
      strPixelRow = "";
      for (x = 0; x < iWidth; x++) {
        iOffsetX = 4 * x;
        strPixelRow += sc(aImgData[iOffsetY + iOffsetX + 2],
        // B
        aImgData[iOffsetY + iOffsetX + 1],
        // G
        aImgData[iOffsetY + iOffsetX],
        // R
        aImgData[iOffsetY + iOffsetX + 3] // A
        );
      }

      strPixelData += strPixelRow;
    } while (--y);
    return encodeData(strHeader + strPixelData);
  };
  // sends the generated file to the client
  var saveFile = function saveFile(strData) {
    if (!window.open(strData)) {
      document.location.href = strData;
    }
  };
  var makeDataURI = function makeDataURI(strData, strMime) {
    return "data:" + strMime + ";base64," + strData;
  };
  // generates a <img> object containing the imagedata
  var makeImageObject = function makeImageObject(strSource) {
    var oImgElement = document.createElement("img");
    oImgElement.src = strSource;
    return oImgElement;
  };
  var scaleCanvas = function scaleCanvas(oCanvas, iWidth, iHeight, flipy) {
    if (iWidth && iHeight) {
      var oSaveCanvas = document.createElement("canvas");
      oSaveCanvas.width = iWidth;
      oSaveCanvas.height = iHeight;
      oSaveCanvas.style.width = iWidth + "px";
      oSaveCanvas.style.height = iHeight + "px";
      var oSaveCtx = oSaveCanvas.getContext("2d");
      if (flipy) {
        // @ts-ignore
        oSaveCtx.save();
        // @ts-ignore
        oSaveCtx.scale(1.0, -1.0);
        // @ts-ignore
        oSaveCtx.imageSmoothingEnabled = true;
        // @ts-ignore
        oSaveCtx.drawImage(oCanvas, 0, 0, oCanvas.width, oCanvas.height, 0, 0, iWidth, -iHeight);
        // @ts-ignore
        oSaveCtx.restore();
      } else {
        // @ts-ignore
        oSaveCtx.imageSmoothingEnabled = true;
        // @ts-ignore
        oSaveCtx.drawImage(oCanvas, 0, 0, oCanvas.width, oCanvas.height, 0, 0, iWidth, iHeight);
      }
      return oSaveCanvas;
    }
    return oCanvas;
  };
  return {
    saveAsPNG: function saveAsPNG(oCanvas, bReturnImg, iWidth, iHeight, flipy) {
      if (!bHasDataURL) return false;
      var oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight, flipy);
      var strMime = "image/png";
      var strData = oScaledCanvas.toDataURL(strMime);
      if (bReturnImg) {
        return makeImageObject(strData);
      } else {
        saveFile(strData);
      }
      return true;
    },
    saveAsJPEG: function saveAsJPEG(oCanvas, bReturnImg, iWidth, iHeight, flipy) {
      if (!bHasDataURL) return false;
      var oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight, flipy);
      var strMime = "image/jpeg";
      var strData = oScaledCanvas.toDataURL(strMime);
      // check if browser actually supports jpeg by looking for the mime type in the data uri. if not, return false
      if (strData.indexOf(strMime) != 5) return false;
      if (bReturnImg) {
        return makeImageObject(strData);
      } else {
        saveFile(strData);
      }
      return true;
    },
    saveAsBMP: function saveAsBMP(oCanvas, bReturnImg, iWidth, iHeight, flipy) {
      if (!(bHasDataURL && bHasImageData && bHasBase64)) return false;
      var oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight, flipy);
      var strMime = "image/bmp";
      var oData = readCanvasData(oScaledCanvas),
        strImgData = createBMP(oData);
      if (bReturnImg) {
        return makeImageObject(makeDataURI(strImgData, strMime));
      } else {
        saveFile(makeDataURI(strImgData, strMime));
      }
      return true;
    }
  };
}();

/**
 * Represents a WebGL2 render buffer.
 */
var _canvas = /*#__PURE__*/_classPrivateFieldLooseKey("canvas");
var _gl = /*#__PURE__*/_classPrivateFieldLooseKey("gl");
var _allocated = /*#__PURE__*/_classPrivateFieldLooseKey("allocated");
var _buffer = /*#__PURE__*/_classPrivateFieldLooseKey("buffer");
var _bound = /*#__PURE__*/_classPrivateFieldLooseKey("bound");
var _size = /*#__PURE__*/_classPrivateFieldLooseKey("size");
var _hasDepthTexture = /*#__PURE__*/_classPrivateFieldLooseKey("hasDepthTexture");
var _imageDataCache = /*#__PURE__*/_classPrivateFieldLooseKey("imageDataCache");
var _texture = /*#__PURE__*/_classPrivateFieldLooseKey("texture");
var _depthTexture = /*#__PURE__*/_classPrivateFieldLooseKey("depthTexture");
var _touch = /*#__PURE__*/_classPrivateFieldLooseKey("touch");
var _getImageDataCache = /*#__PURE__*/_classPrivateFieldLooseKey("getImageDataCache");
var GLRenderBuffer = /*#__PURE__*/function () {
  /**
   * Creates a new render buffer.
   * @param canvas
   * @param gl
   * @param options
   */
  function GLRenderBuffer(_canvas2, _gl2, options) {
    Object.defineProperty(this, _getImageDataCache, {
      value: _getImageDataCache2
    });
    Object.defineProperty(this, _touch, {
      value: _touch2
    });
    Object.defineProperty(this, _canvas, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gl, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _allocated, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _buffer, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _bound, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _size, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _hasDepthTexture, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _imageDataCache, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _texture, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _depthTexture, {
      writable: true,
      value: void 0
    });
    _classPrivateFieldLooseBase(this, _canvas)[_canvas] = _canvas2;
    _classPrivateFieldLooseBase(this, _gl)[_gl] = _gl2;
    _classPrivateFieldLooseBase(this, _allocated)[_allocated] = false;
    _classPrivateFieldLooseBase(this, _buffer)[_buffer] = null;
    _classPrivateFieldLooseBase(this, _bound)[_bound] = false;
    _classPrivateFieldLooseBase(this, _size)[_size] = options.size;
    _classPrivateFieldLooseBase(this, _hasDepthTexture)[_hasDepthTexture] = !!options.depthTexture;
  }
  /**
   * Sets the size of this render buffer.
   * @param size
   */
  var _proto = GLRenderBuffer.prototype;
  _proto.setSize = function setSize(size) {
    _classPrivateFieldLooseBase(this, _size)[_size] = size;
  }
  /**
   * Binds this render buffer.
   */;
  _proto.bind = function bind() {
    _classPrivateFieldLooseBase(this, _touch)[_touch]();
    if (_classPrivateFieldLooseBase(this, _bound)[_bound]) {
      return;
    }
    var gl = _classPrivateFieldLooseBase(this, _gl)[_gl];
    gl.bindFramebuffer(gl.FRAMEBUFFER, _classPrivateFieldLooseBase(this, _buffer)[_buffer].framebuf);
    _classPrivateFieldLooseBase(this, _bound)[_bound] = true;
  };
  /**
   * Clears this render buffer.
   */
  _proto.clear = function clear() {
    if (!_classPrivateFieldLooseBase(this, _bound)[_bound]) {
      throw "Render buffer not bound";
    }
    var gl = _classPrivateFieldLooseBase(this, _gl)[_gl];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  /**
   * Reads a pixel from this render buffer.
   * @param pickX
   * @param pickY
   */;
  _proto.read = function read(pickX, pickY) {
    var x = pickX;
    var y = _classPrivateFieldLooseBase(this, _gl)[_gl].drawingBufferHeight - pickY;
    var pix = new Uint8Array(4);
    var gl = _classPrivateFieldLooseBase(this, _gl)[_gl];
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    return pix;
  }
  /**
   * Redas an image from this render buffer.
   * @param params
   */;
  _proto.readImage = function readImage(params) {
    var gl = _classPrivateFieldLooseBase(this, _gl)[_gl];
    var imageDataCache = _classPrivateFieldLooseBase(this, _getImageDataCache)[_getImageDataCache]();
    var pixelData = imageDataCache.pixelData;
    var canvas = imageDataCache.canvas;
    var imageData = imageDataCache.imageData;
    var context = imageDataCache.context;
    gl.readPixels(0, 0, _classPrivateFieldLooseBase(this, _buffer)[_buffer].width, _classPrivateFieldLooseBase(this, _buffer)[_buffer].height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
    imageData.data.set(pixelData);
    context.putImageData(imageData, 0, 0);
    var imageWidth = params.width || canvas.width;
    var imageHeight = params.height || canvas.height;
    var format = params.format || "jpeg";
    var flipy = true; // Account for WebGL texture flipping
    var image;
    switch (format) {
      case "jpeg":
        image = Canvas2Image.saveAsJPEG(canvas, true, imageWidth, imageHeight, flipy);
        break;
      case "png":
        image = Canvas2Image.saveAsPNG(canvas, true, imageWidth, imageHeight, flipy);
        break;
      case "bmp":
        image = Canvas2Image.saveAsBMP(canvas, true, imageWidth, imageHeight, flipy);
        break;
      default:
        console.error("Unsupported image format: '" + format + "' - supported types are 'jpeg', 'bmp' and 'png' - defaulting to 'jpeg'");
        image = Canvas2Image.saveAsJPEG(canvas, true, imageWidth, imageHeight, flipy);
    }
    // @ts-ignore
    return image.src;
  };
  /**
   * Unbinds this render buffer.
   */
  _proto.unbind = function unbind() {
    var gl = _classPrivateFieldLooseBase(this, _gl)[_gl];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    _classPrivateFieldLooseBase(this, _bound)[_bound] = false;
  }
  /**
   * Gets a texture that has the contents of this render buffer.
   */;
  _proto.getTexture = function getTexture() {
    var _this = this;
    return _classPrivateFieldLooseBase(this, _texture)[_texture] || (_classPrivateFieldLooseBase(this, _texture)[_texture] = {
      bind: function bind(unit) {
        if (_classPrivateFieldLooseBase(_this, _buffer)[_buffer] && _classPrivateFieldLooseBase(_this, _buffer)[_buffer].texture) {
          // @ts-ignore
          _classPrivateFieldLooseBase(_this, _gl)[_gl].activeTexture(_classPrivateFieldLooseBase(_this, _gl)[_gl]["TEXTURE" + unit]);
          _classPrivateFieldLooseBase(_this, _gl)[_gl].bindTexture(_classPrivateFieldLooseBase(_this, _gl)[_gl].TEXTURE_2D, _classPrivateFieldLooseBase(_this, _buffer)[_buffer].texture);
          return true;
        }
        return false;
      },
      unbind: function unbind(unit) {
        if (_classPrivateFieldLooseBase(_this, _buffer)[_buffer] && _classPrivateFieldLooseBase(_this, _buffer)[_buffer].texture) {
          // @ts-ignore
          _classPrivateFieldLooseBase(_this, _gl)[_gl].activeTexture(_classPrivateFieldLooseBase(_this, _gl)[_gl]["TEXTURE" + unit]);
          _classPrivateFieldLooseBase(_this, _gl)[_gl].bindTexture(_classPrivateFieldLooseBase(_this, _gl)[_gl].TEXTURE_2D, null);
        }
      }
    });
  }
  /**
   * Does this render buffer have a depth texture component?
   */;
  _proto.hasDepthTexture = function hasDepthTexture() {
    return _classPrivateFieldLooseBase(this, _hasDepthTexture)[_hasDepthTexture];
  }
  /**
   * Gets the depth texture component of this render buffer, if any.
   */;
  _proto.getDepthTexture = function getDepthTexture() {
    var _this2 = this;
    if (!_classPrivateFieldLooseBase(this, _hasDepthTexture)[_hasDepthTexture]) {
      return null;
    }
    return _classPrivateFieldLooseBase(this, _depthTexture)[_depthTexture] || (_classPrivateFieldLooseBase(this, _depthTexture)[_depthTexture] = {
      bind: function bind(unit) {
        if (_classPrivateFieldLooseBase(_this2, _buffer)[_buffer] && _classPrivateFieldLooseBase(_this2, _buffer)[_buffer].depthTexture) {
          // @ts-ignore
          _classPrivateFieldLooseBase(_this2, _gl)[_gl].activeTexture(_classPrivateFieldLooseBase(_this2, _gl)[_gl]["TEXTURE" + unit]);
          _classPrivateFieldLooseBase(_this2, _gl)[_gl].bindTexture(_classPrivateFieldLooseBase(_this2, _gl)[_gl].TEXTURE_2D, _classPrivateFieldLooseBase(_this2, _buffer)[_buffer].depthTexture);
          return true;
        }
        return false;
      },
      unbind: function unbind(unit) {
        if (_classPrivateFieldLooseBase(_this2, _buffer)[_buffer] && _classPrivateFieldLooseBase(_this2, _buffer)[_buffer].depthTexture) {
          // @ts-ignore
          _classPrivateFieldLooseBase(_this2, _gl)[_gl].activeTexture(_classPrivateFieldLooseBase(_this2, _gl)[_gl]["TEXTURE" + unit]);
          _classPrivateFieldLooseBase(_this2, _gl)[_gl].bindTexture(_classPrivateFieldLooseBase(_this2, _gl)[_gl].TEXTURE_2D, null);
        }
      }
    });
  }
  /**
   * Destroys this render buffer.
   */;
  _proto.destroy = function destroy() {
    if (_classPrivateFieldLooseBase(this, _allocated)[_allocated]) {
      var gl = _classPrivateFieldLooseBase(this, _gl)[_gl];
      gl.deleteTexture(_classPrivateFieldLooseBase(this, _buffer)[_buffer].texture);
      gl.deleteTexture(_classPrivateFieldLooseBase(this, _buffer)[_buffer].depthTexture);
      gl.deleteFramebuffer(_classPrivateFieldLooseBase(this, _buffer)[_buffer].framebuf);
      gl.deleteRenderbuffer(_classPrivateFieldLooseBase(this, _buffer)[_buffer].renderbuf);
      _classPrivateFieldLooseBase(this, _allocated)[_allocated] = false;
      _classPrivateFieldLooseBase(this, _buffer)[_buffer] = null;
      _classPrivateFieldLooseBase(this, _bound)[_bound] = false;
    }
    _classPrivateFieldLooseBase(this, _imageDataCache)[_imageDataCache] = null;
  };
  return GLRenderBuffer;
}();
function _touch2() {
  var width;
  var height;
  var gl = _classPrivateFieldLooseBase(this, _gl)[_gl];
  if (_classPrivateFieldLooseBase(this, _size)[_size]) {
    width = _classPrivateFieldLooseBase(this, _size)[_size][0];
    height = _classPrivateFieldLooseBase(this, _size)[_size][1];
  } else {
    width = gl.drawingBufferWidth;
    height = gl.drawingBufferHeight;
  }
  if (_classPrivateFieldLooseBase(this, _buffer)[_buffer]) {
    if (_classPrivateFieldLooseBase(this, _buffer)[_buffer].width === width && _classPrivateFieldLooseBase(this, _buffer)[_buffer].height === height) {
      return;
    } else {
      gl.deleteTexture(_classPrivateFieldLooseBase(this, _buffer)[_buffer].texture);
      gl.deleteFramebuffer(_classPrivateFieldLooseBase(this, _buffer)[_buffer].framebuf);
      gl.deleteRenderbuffer(_classPrivateFieldLooseBase(this, _buffer)[_buffer].renderbuf);
    }
  }
  var colorTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, colorTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  var depthTexture;
  if (_classPrivateFieldLooseBase(this, _hasDepthTexture)[_hasDepthTexture]) {
    depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  }
  var renderbuf = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuf);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
  var framebuf = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuf);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
  if (_classPrivateFieldLooseBase(this, _hasDepthTexture)[_hasDepthTexture]) {
    // @ts-ignore
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
  } else {
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuf);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // Verify framebuffer is OK
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuf);
  if (!gl.isFramebuffer(framebuf)) {
    throw "Invalid framebuffer";
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
      break;
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      throw "Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      throw "Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      throw "Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS";
    case gl.FRAMEBUFFER_UNSUPPORTED:
      throw "Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED";
    default:
      throw "Incomplete framebuffer: " + status;
  }
  _classPrivateFieldLooseBase(this, _buffer)[_buffer] = {
    framebuf: framebuf,
    renderbuf: renderbuf,
    texture: colorTexture,
    depthTexture: depthTexture,
    width: width,
    height: height
  };
  _classPrivateFieldLooseBase(this, _bound)[_bound] = false;
}
function _getImageDataCache2() {
  var bufferWidth = _classPrivateFieldLooseBase(this, _buffer)[_buffer].width;
  var bufferHeight = _classPrivateFieldLooseBase(this, _buffer)[_buffer].height;
  var imageDataCache = _classPrivateFieldLooseBase(this, _imageDataCache)[_imageDataCache];
  if (imageDataCache) {
    if (imageDataCache.width !== bufferWidth || imageDataCache.height !== bufferHeight) {
      _classPrivateFieldLooseBase(this, _imageDataCache)[_imageDataCache] = null;
      imageDataCache = null;
    }
  }
  if (!imageDataCache) {
    var canvas = document.createElement('canvas');
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
    var context = canvas.getContext('2d');
    // @ts-ignore
    var imageData = context.createImageData(bufferWidth, bufferHeight);
    imageDataCache = {
      pixelData: new Uint8Array(bufferWidth * bufferHeight * 4),
      canvas: canvas,
      context: context,
      imageData: imageData,
      width: bufferWidth,
      height: bufferHeight
    };
    _classPrivateFieldLooseBase(this, _imageDataCache)[_imageDataCache] = imageDataCache;
  }
  return imageDataCache;
}

/**
 * Gets a WebGL2 extension.
 * @param gl
 * @param name
 */
function getExtension(gl, name) {
  // @ts-ignore
  if (gl._cachedExtensions === undefined) {
    // @ts-ignore
    gl._cachedExtensions = {};
  }
  // @ts-ignore
  if (gl._cachedExtensions[name] !== undefined) {
    // @ts-ignore
    return gl._cachedExtensions[name];
  }
  var extension;
  switch (name) {
    case 'WEBGL_depth_texture':
      extension = gl.getExtension('WEBGL_depth_texture') || gl.getExtension('MOZ_WEBGL_depth_texture') || gl.getExtension('WEBKIT_WEBGL_depth_texture');
      break;
    case 'EXT_texture_filter_anisotropic':
      extension = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('MOZ_EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      break;
    case 'WEBGL_compressed_texture_s3tc':
      extension = gl.getExtension('WEBGL_compressed_texture_s3tc') || gl.getExtension('MOZ_WEBGL_compressed_texture_s3tc') || gl.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc');
      break;
    case 'WEBGL_compressed_texture_pvrtc':
      extension = gl.getExtension('WEBGL_compressed_texture_pvrtc') || gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc');
      break;
    default:
      extension = gl.getExtension(name);
  }
  // @ts-ignore
  gl._cachedExtensions[name] = extension;
  return extension;
}

/**
 * Converts a xeokit SDK constant to its eauivalent WebGL2 constant/enumeration value.
 *
 * @param gl
 * @param constantVal
 * @param encoding
 */
function convertConstant(gl, constantVal, encoding) {
  var extension;
  var p = constantVal;
  if (p === constants.UnsignedByteType) return gl.UNSIGNED_BYTE;
  if (p === constants.UnsignedShort4444Type) return gl.UNSIGNED_SHORT_4_4_4_4;
  if (p === constants.UnsignedShort5551Type) return gl.UNSIGNED_SHORT_5_5_5_1;
  if (p === constants.ByteType) return gl.BYTE;
  if (p === constants.ShortType) return gl.SHORT;
  if (p === constants.UnsignedShortType) return gl.UNSIGNED_SHORT;
  if (p === constants.IntType) return gl.INT;
  if (p === constants.UnsignedIntType) return gl.UNSIGNED_INT;
  if (p === constants.FloatType) return gl.FLOAT;
  if (p === constants.HalfFloatType) {
    return gl.HALF_FLOAT;
  }
  if (p === constants.AlphaFormat) return gl.ALPHA;
  if (p === constants.RGBAFormat) return gl.RGBA;
  if (p === constants.LuminanceFormat) return gl.LUMINANCE;
  if (p === constants.LuminanceAlphaFormat) return gl.LUMINANCE_ALPHA;
  if (p === constants.DepthFormat) return gl.DEPTH_COMPONENT;
  if (p === constants.DepthStencilFormat) return gl.DEPTH_STENCIL;
  if (p === constants.RedFormat) return gl.RED;
  if (p === constants.RGBFormat) {
    return gl.RGBA;
  }
  // WebGL formats.
  if (p === constants.RedIntegerFormat) return gl.RED_INTEGER;
  if (p === constants.RGFormat) return gl.RG;
  if (p === constants.RGIntegerFormat) return gl.RG_INTEGER;
  if (p === constants.RGBAIntegerFormat) return gl.RGBA_INTEGER;
  // S3TC
  if (p === constants.RGB_S3TC_DXT1_Format || p === constants.RGBA_S3TC_DXT1_Format || p === constants.RGBA_S3TC_DXT3_Format || p === constants.RGBA_S3TC_DXT5_Format) {
    if (encoding === constants.sRGBEncoding) {
      var _extension = getExtension(gl, 'WEBGL_compressed_texture_s3tc_srgb');
      if (_extension !== null) {
        if (p === constants.RGB_S3TC_DXT1_Format) return _extension.COMPRESSED_SRGB_S3TC_DXT1_EXT;
        if (p === constants.RGBA_S3TC_DXT1_Format) return _extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
        if (p === constants.RGBA_S3TC_DXT3_Format) return _extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
        if (p === constants.RGBA_S3TC_DXT5_Format) return _extension.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
      } else {
        return null;
      }
    } else {
      extension = getExtension(gl, 'WEBGL_compressed_texture_s3tc');
      if (extension !== null) {
        if (p === constants.RGB_S3TC_DXT1_Format) return extension.COMPRESSED_RGB_S3TC_DXT1_EXT;
        if (p === constants.RGBA_S3TC_DXT1_Format) return extension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
        if (p === constants.RGBA_S3TC_DXT3_Format) return extension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
        if (p === constants.RGBA_S3TC_DXT5_Format) return extension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
      } else {
        return null;
      }
    }
  }
  // PVRTC
  if (p === constants.RGB_PVRTC_4BPPV1_Format || p === constants.RGB_PVRTC_2BPPV1_Format || p === constants.RGBA_PVRTC_4BPPV1_Format || p === constants.RGBA_PVRTC_2BPPV1_Format) {
    var _extension2 = getExtension(gl, 'WEBGL_compressed_texture_pvrtc');
    if (_extension2 !== null) {
      if (p === constants.RGB_PVRTC_4BPPV1_Format) return _extension2.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
      if (p === constants.RGB_PVRTC_2BPPV1_Format) return _extension2.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
      if (p === constants.RGBA_PVRTC_4BPPV1_Format) return _extension2.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
      if (p === constants.RGBA_PVRTC_2BPPV1_Format) return _extension2.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
    } else {
      return null;
    }
  }
  // ETC1
  if (p === constants.RGB_ETC1_Format) {
    var _extension3 = getExtension(gl, 'WEBGL_compressed_texture_etc1');
    if (_extension3 !== null) {
      return _extension3.COMPRESSED_RGB_ETC1_WEBGL;
    } else {
      return null;
    }
  }
  // ETC2
  if (p === constants.RGB_ETC2_Format || p === constants.RGBA_ETC2_EAC_Format) {
    var _extension4 = getExtension(gl, 'WEBGL_compressed_texture_etc');
    if (_extension4 !== null) {
      if (p === constants.RGB_ETC2_Format) return encoding === constants.sRGBEncoding ? _extension4.COMPRESSED_SRGB8_ETC2 : _extension4.COMPRESSED_RGB8_ETC2;
      if (p === constants.RGBA_ETC2_EAC_Format) return encoding === constants.sRGBEncoding ? _extension4.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC : _extension4.COMPRESSED_RGBA8_ETC2_EAC;
    } else {
      return null;
    }
  }
  // ASTC
  if (p === constants.RGBA_ASTC_4x4_Format || p === constants.RGBA_ASTC_5x4_Format || p === constants.RGBA_ASTC_5x5_Format || p === constants.RGBA_ASTC_6x5_Format || p === constants.RGBA_ASTC_6x6_Format || p === constants.RGBA_ASTC_8x5_Format || p === constants.RGBA_ASTC_8x6_Format || p === constants.RGBA_ASTC_8x8_Format || p === constants.RGBA_ASTC_10x5_Format || p === constants.RGBA_ASTC_10x6_Format || p === constants.RGBA_ASTC_10x8_Format || p === constants.RGBA_ASTC_10x10_Format || p === constants.RGBA_ASTC_12x10_Format || p === constants.RGBA_ASTC_12x12_Format) {
    var _extension5 = getExtension(gl, 'WEBGL_compressed_texture_astc');
    if (_extension5 !== null) {
      if (p === constants.RGBA_ASTC_4x4_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR : _extension5.COMPRESSED_RGBA_ASTC_4x4_KHR;
      if (p === constants.RGBA_ASTC_5x4_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR : _extension5.COMPRESSED_RGBA_ASTC_5x4_KHR;
      if (p === constants.RGBA_ASTC_5x5_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR : _extension5.COMPRESSED_RGBA_ASTC_5x5_KHR;
      if (p === constants.RGBA_ASTC_6x5_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR : _extension5.COMPRESSED_RGBA_ASTC_6x5_KHR;
      if (p === constants.RGBA_ASTC_6x6_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR : _extension5.COMPRESSED_RGBA_ASTC_6x6_KHR;
      if (p === constants.RGBA_ASTC_8x5_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR : _extension5.COMPRESSED_RGBA_ASTC_8x5_KHR;
      if (p === constants.RGBA_ASTC_8x6_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR : _extension5.COMPRESSED_RGBA_ASTC_8x6_KHR;
      if (p === constants.RGBA_ASTC_8x8_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR : _extension5.COMPRESSED_RGBA_ASTC_8x8_KHR;
      if (p === constants.RGBA_ASTC_10x5_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR : _extension5.COMPRESSED_RGBA_ASTC_10x5_KHR;
      if (p === constants.RGBA_ASTC_10x6_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR : _extension5.COMPRESSED_RGBA_ASTC_10x6_KHR;
      if (p === constants.RGBA_ASTC_10x8_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR : _extension5.COMPRESSED_RGBA_ASTC_10x8_KHR;
      if (p === constants.RGBA_ASTC_10x10_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR : _extension5.COMPRESSED_RGBA_ASTC_10x10_KHR;
      if (p === constants.RGBA_ASTC_12x10_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR : _extension5.COMPRESSED_RGBA_ASTC_12x10_KHR;
      if (p === constants.RGBA_ASTC_12x12_Format) return encoding === constants.sRGBEncoding ? _extension5.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR : _extension5.COMPRESSED_RGBA_ASTC_12x12_KHR;
    } else {
      return null;
    }
  }
  // BPTC
  if (p === constants.RGBA_BPTC_Format) {
    var _extension6 = getExtension(gl, 'EXT_texture_compression_bptc');
    if (_extension6 !== null) {
      if (p === constants.RGBA_BPTC_Format) {
        return encoding === constants.sRGBEncoding ? _extension6.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT : _extension6.COMPRESSED_RGBA_BPTC_UNORM_EXT;
      }
    } else {
      return null;
    }
  }
  //
  if (p === constants.UnsignedInt248Type) {
    return gl.UNSIGNED_INT_24_8;
  }
  if (p === constants.RepeatWrapping) {
    return gl.REPEAT;
  }
  if (p === constants.ClampToEdgeWrapping) {
    return gl.CLAMP_TO_EDGE;
  }
  if (p === constants.NearestMipMapNearestFilter) {
    return gl.NEAREST_MIPMAP_LINEAR;
  }
  if (p === constants.NearestMipMapLinearFilter) {
    return gl.NEAREST_MIPMAP_LINEAR;
  }
  if (p === constants.LinearMipMapNearestFilter) {
    return gl.LINEAR_MIPMAP_NEAREST;
  }
  if (p === constants.LinearMipMapLinearFilter) {
    return gl.LINEAR_MIPMAP_LINEAR;
  }
  if (p === constants.NearestFilter) {
    return gl.NEAREST;
  }
  if (p === constants.LinearFilter) {
    return gl.LINEAR;
  }
  return null;
}

var color = new Uint8Array([0, 0, 0, 1]);
/**
 * Represents a WebGL2 texture.
 */
var GLTexture = /*#__PURE__*/function () {
  function GLTexture(params) {
    this.gl = void 0;
    this.target = void 0;
    this.format = void 0;
    this.type = void 0;
    this.internalFormat = void 0;
    this.premultiplyAlpha = void 0;
    this.flipY = void 0;
    this.unpackAlignment = void 0;
    this.wrapS = void 0;
    this.wrapT = void 0;
    this.wrapR = void 0;
    this.texture = void 0;
    this.allocated = void 0;
    this.minFilter = void 0;
    this.magFilter = void 0;
    this.encoding = void 0;
    this.gl = params.gl;
    this.target = params.target || params.gl.TEXTURE_2D;
    this.format = params.format || constants.RGBAFormat;
    this.type = params.type || constants.UnsignedByteType;
    this.internalFormat = -1;
    this.premultiplyAlpha = !!params.premultiplyAlpha;
    this.flipY = !!params.flipY;
    this.unpackAlignment = 4;
    this.wrapS = params.wrapS || constants.RepeatWrapping;
    this.wrapT = params.wrapT || constants.RepeatWrapping;
    this.wrapR = params.wrapR || constants.RepeatWrapping;
    // @ts-ignore
    this.texture = params.gl.createTexture();
    if (params.preloadColor) {
      this.setPreloadColor(params.preloadColor); // Prevents "there is no texture bound to the unit 0" error
    }

    this.allocated = true;
  }
  var _proto = GLTexture.prototype;
  _proto.setPreloadColor = function setPreloadColor(value) {
    if (!value) {
      color[0] = 0;
      color[1] = 0;
      color[2] = 0;
      color[3] = 255;
    } else {
      color[0] = Math.floor(value[0] * 255);
      color[1] = Math.floor(value[1] * 255);
      color[2] = Math.floor(value[2] * 255);
      color[3] = Math.floor((value[3] !== undefined ? value[3] : 1) * 255);
    }
    var gl = this.gl;
    gl.bindTexture(this.target, this.texture);
    if (this.target === gl.TEXTURE_CUBE_MAP) {
      var faces = [gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];
      for (var i = 0, len = faces.length; i < len; i++) {
        gl.texImage2D(faces[i], 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, color);
      }
    } else {
      gl.texImage2D(this.target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, color);
    }
    gl.bindTexture(this.target, null);
  };
  _proto.setTarget = function setTarget(target) {
    this.target = target || this.gl.TEXTURE_2D;
  };
  _proto.setImage = function setImage(image, props) {
    if (props === void 0) {
      props = {};
    }
    var gl = this.gl;
    if (props.format !== undefined) {
      this.format = props.format;
    }
    if (props.internalFormat !== undefined) {
      this.internalFormat = props.internalFormat;
    }
    if (props.encoding !== undefined) {
      this.encoding = props.encoding;
    }
    if (props.type !== undefined) {
      this.type = props.type;
    }
    if (props.flipY !== undefined) {
      this.flipY = props.flipY;
    }
    if (props.premultiplyAlpha !== undefined) {
      this.premultiplyAlpha = props.premultiplyAlpha;
    }
    if (props.unpackAlignment !== undefined) {
      this.unpackAlignment = props.unpackAlignment;
    }
    if (props.minFilter !== undefined) {
      this.minFilter = props.minFilter;
    }
    if (props.magFilter !== undefined) {
      this.magFilter = props.magFilter;
    }
    if (props.wrapS !== undefined) {
      this.wrapS = props.wrapS;
    }
    if (props.wrapT !== undefined) {
      this.wrapT = props.wrapT;
    }
    if (props.wrapR !== undefined) {
      this.wrapR = props.wrapR;
    }
    gl.bindTexture(this.target, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, this.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    var minFilter = convertConstant(gl, this.minFilter);
    gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, minFilter);
    var magFilter = convertConstant(gl, this.magFilter);
    if (magFilter) {
      gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, magFilter);
    }
    var wrapS = convertConstant(gl, this.wrapS);
    if (wrapS) {
      gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, wrapS);
    }
    var wrapT = convertConstant(gl, this.wrapT);
    if (wrapT) {
      gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, wrapT);
    }
    var glFormat = convertConstant(gl, this.format, this.encoding);
    var glType = convertConstant(gl, this.type);
    var glInternalFormat = getInternalFormat(gl, this.internalFormat, glFormat, glType, this.encoding, false);
    if (this.target === gl.TEXTURE_CUBE_MAP) {
      if (utils.isArray(image)) {
        var images = image;
        var faces = [gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];
        for (var i = 0, len = faces.length; i < len; i++) {
          // @ts-ignore
          gl.texImage2D(faces[i], 0, glInternalFormat, glFormat, glType, images[i]);
        }
      }
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
    }
    // if (generateMipMap) {
    //     gl.generateMipmap(this.target);
    // }
    gl.bindTexture(this.target, null);
  };
  _proto.setCompressedData = function setCompressedData(params) {
    var gl = this.gl;
    var mipmaps = params.mipmaps || [];
    var levels = mipmaps.length;
    var props = params.props;
    // Cache props
    if (props.format !== undefined) {
      this.format = props.format;
    }
    if (props.internalFormat !== undefined) {
      this.internalFormat = props.internalFormat;
    }
    if (props.encoding !== undefined) {
      this.encoding = props.encoding;
    }
    if (props.type !== undefined) {
      this.type = props.type;
    }
    if (props.flipY !== undefined) {
      this.flipY = props.flipY;
    }
    if (props.premultiplyAlpha !== undefined) {
      this.premultiplyAlpha = props.premultiplyAlpha;
    }
    if (props.unpackAlignment !== undefined) {
      this.unpackAlignment = props.unpackAlignment;
    }
    if (props.minFilter !== undefined) {
      this.minFilter = props.minFilter;
    }
    if (props.magFilter !== undefined) {
      this.magFilter = props.magFilter;
    }
    if (props.wrapS !== undefined) {
      this.wrapS = props.wrapS;
    }
    if (props.wrapT !== undefined) {
      this.wrapT = props.wrapT;
    }
    if (props.wrapR !== undefined) {
      this.wrapR = props.wrapR;
    }
    gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(this.target, this.texture);
    var supportsMips = mipmaps.length > 1;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, this.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    var wrapS = convertConstant(gl, this.wrapS);
    if (wrapS) {
      gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, wrapS);
    }
    var wrapT = convertConstant(gl, this.wrapT);
    if (wrapT) {
      gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, wrapT);
    }
    // @ts-ignore
    if (this.type === gl.TEXTURE_3D || this.type === gl.TEXTURE_2D_ARRAY) {
      var wrapR = convertConstant(gl, this.wrapR);
      if (wrapR) {
        gl.texParameteri(this.target, gl.TEXTURE_WRAP_R, wrapR);
      }
      gl.texParameteri(this.type, gl.TEXTURE_WRAP_R, wrapR);
    }
    if (supportsMips) {
      gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, filterFallback(gl, this.minFilter));
      gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, filterFallback(gl, this.magFilter));
    } else {
      gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, convertConstant(gl, this.minFilter));
      gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, convertConstant(gl, this.magFilter));
    }
    var glFormat = convertConstant(gl, this.format, this.encoding);
    var glType = convertConstant(gl, this.type);
    var glInternalFormat = getInternalFormat(gl, this.internalFormat, glFormat, glType, this.encoding, false);
    gl.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
    for (var i = 0, len = mipmaps.length; i < len; i++) {
      var mipmap = mipmaps[i];
      if (this.format !== constants.RGBAFormat) {
        if (glFormat !== null) {
          gl.compressedTexSubImage2D(gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, mipmap.data);
        } else {
          console.warn('Attempt to load unsupported compressed texture format in .setCompressedData()');
        }
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
      }
    }
    gl.bindTexture(this.target, null);
  };
  _proto.setProps = function setProps(props) {
    var gl = this.gl;
    gl.bindTexture(this.target, this.texture);
    this._uploadProps(props);
    gl.bindTexture(this.target, null);
  };
  _proto._uploadProps = function _uploadProps(props) {
    var gl = this.gl;
    if (props.format !== undefined) {
      this.format = props.format;
    }
    if (props.internalFormat !== undefined) {
      this.internalFormat = props.internalFormat;
    }
    if (props.encoding !== undefined) {
      this.encoding = props.encoding;
    }
    if (props.type !== undefined) {
      this.type = props.type;
    }
    if (props.minFilter !== undefined) {
      var minFilter = convertConstant(gl, props.minFilter);
      if (minFilter) {
        this.minFilter = props.minFilter;
        gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, minFilter);
        if (minFilter === gl.NEAREST_MIPMAP_NEAREST || minFilter === gl.LINEAR_MIPMAP_NEAREST || minFilter === gl.NEAREST_MIPMAP_LINEAR || minFilter === gl.LINEAR_MIPMAP_LINEAR) {
          gl.generateMipmap(this.target);
        }
      }
    }
    if (props.magFilter !== undefined) {
      var magFilter = convertConstant(gl, props.magFilter);
      if (magFilter) {
        this.magFilter = props.magFilter;
        gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, magFilter);
      }
    }
    if (props.wrapS !== undefined) {
      var wrapS = convertConstant(gl, props.wrapS);
      if (wrapS) {
        this.wrapS = props.wrapS;
        gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, wrapS);
      }
    }
    if (props.wrapT !== undefined) {
      var wrapT = convertConstant(gl, props.wrapT);
      if (wrapT) {
        this.wrapT = props.wrapT;
        gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, wrapT);
      }
    }
  };
  _proto.bind = function bind(unit) {
    if (!this.allocated) {
      return false;
    }
    if (this.texture) {
      var gl = this.gl;
      // @ts-ignore
      gl.activeTexture(gl["TEXTURE" + unit]);
      gl.bindTexture(this.target, this.texture);
      return true;
    }
    return false;
  };
  _proto.unbind = function unbind(unit) {
    if (!this.allocated) {
      return;
    }
    if (this.texture) {
      var gl = this.gl;
      // @ts-ignore
      gl.activeTexture(gl["TEXTURE" + unit]);
      gl.bindTexture(this.target, null);
    }
  };
  _proto.destroy = function destroy() {
    if (!this.allocated) {
      return;
    }
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      // @ts-ignore
      this.texture = null;
    }
  };
  return GLTexture;
}();
function getInternalFormat(gl, internalFormatName, glFormat, glType, encoding, isVideoTexture) {
  if (isVideoTexture === void 0) {
    isVideoTexture = false;
  }
  if (internalFormatName !== null) {
    // @ts-ignore
    if (gl[internalFormatName] !== undefined) {
      // @ts-ignore
      return gl[internalFormatName];
    }
    console.warn('Attempt to use non-existing WebGL internal format \'' + internalFormatName + '\'');
  }
  var internalFormat = glFormat;
  if (glFormat === gl.RED) {
    if (glType === gl.FLOAT) internalFormat = gl.R32F;
    if (glType === gl.HALF_FLOAT) internalFormat = gl.R16F;
    if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.R8;
  }
  if (glFormat === gl.RG) {
    if (glType === gl.FLOAT) internalFormat = gl.RG32F;
    if (glType === gl.HALF_FLOAT) internalFormat = gl.RG16F;
    if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.RG8;
  }
  if (glFormat === gl.RGBA) {
    if (glType === gl.FLOAT) internalFormat = gl.RGBA32F;
    if (glType === gl.HALF_FLOAT) internalFormat = gl.RGBA16F;
    if (glType === gl.UNSIGNED_BYTE) internalFormat = encoding === constants.sRGBEncoding && isVideoTexture === false ? gl.SRGB8_ALPHA8 : gl.RGBA8;
    if (glType === gl.UNSIGNED_SHORT_4_4_4_4) internalFormat = gl.RGBA4;
    if (glType === gl.UNSIGNED_SHORT_5_5_5_1) internalFormat = gl.RGB5_A1;
  }
  if (internalFormat === gl.R16F || internalFormat === gl.R32F || internalFormat === gl.RG16F || internalFormat === gl.RG32F || internalFormat === gl.RGBA16F || internalFormat === gl.RGBA32F) {
    getExtension(gl, 'EXT_color_buffer_float');
  }
  return internalFormat;
}
function filterFallback(gl, f) {
  if (f === constants.NearestFilter || f === constants.NearestMipmapNearestFilter || f === constants.NearestMipmapLinearFilter) {
    return gl.NEAREST;
  }
  return gl.LINEAR;
}

/**
 * Information about WebGL2 support on the client machine.
 */
var WEBGL_INFO = {
  WEBGL: false,
  SUPPORTED_EXTENSIONS: {}
};
var canvas = document.createElement("canvas");
if (canvas) {
  // @ts-ignore
  var gl = canvas.getContext("webgl2", {
    antialias: true
  });
  WEBGL_INFO.WEBGL = !!gl;
  if (WEBGL_INFO.WEBGL) {
    // @ts-ignore
    WEBGL_INFO.ANTIALIAS = gl.getContextAttributes().antialias;
    if (gl.getShaderPrecisionFormat) {
      // @ts-ignore
      if (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0) {
        WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "highp";
      } else {
        // @ts-ignore
        if (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision > 0) {
          WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "mediump";
        } else {
          WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "lowp";
        }
      }
    } else {
      WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "mediump";
    }
    WEBGL_INFO.DEPTH_BUFFER_BITS = gl.getParameter(gl.DEPTH_BITS);
    WEBGL_INFO.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    WEBGL_INFO.MAX_CUBE_MAP_SIZE = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    WEBGL_INFO.MAX_RENDERBUFFER_SIZE = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    WEBGL_INFO.MAX_TEXTURE_UNITS = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    WEBGL_INFO.MAX_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    WEBGL_INFO.MAX_VERTEX_ATTRIBS = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    WEBGL_INFO.MAX_VERTEX_UNIFORM_VECTORS = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    WEBGL_INFO.MAX_FRAGMENT_UNIFORM_VECTORS = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    WEBGL_INFO.MAX_VARYING_VECTORS = gl.getParameter(gl.MAX_VARYING_VECTORS);
    // @ts-ignore
    gl.getSupportedExtensions().forEach(function (ext) {
      WEBGL_INFO.SUPPORTED_EXTENSIONS[ext] = true;
    });
    WEBGL_INFO.depthTexturesSupported = WEBGL_INFO.SUPPORTED_EXTENSIONS["WEBGL_depth_texture"];
  }
}

exports.Canvas2Image = Canvas2Image;
exports.GLArrayBuf = GLArrayBuf;
exports.GLAttribute = GLAttribute;
exports.GLDataTexture = GLDataTexture;
exports.GLProgram = GLProgram;
exports.GLRenderBuffer = GLRenderBuffer;
exports.GLSampler = GLSampler;
exports.GLShader = GLShader;
exports.GLTexture = GLTexture;
exports.WEBGL_INFO = WEBGL_INFO;
exports.convertConstant = convertConstant;
exports.getExtension = getExtension;
//# sourceMappingURL=index.cjs.map
