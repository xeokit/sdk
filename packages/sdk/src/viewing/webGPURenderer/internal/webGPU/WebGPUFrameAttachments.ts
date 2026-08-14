export interface WebGPUClearColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Current-frame color and depth/stencil attachment views.
 *
 * @internal
 */
export class WebGPUFrameAttachments {

  private readonly _colorView: unknown;
  private readonly _depthStencilView: unknown;

  constructor(params: {
    colorView: unknown;
    depthStencilView: unknown;
  }) {
    this._colorView = params.colorView;
    this._depthStencilView = params.depthStencilView;
  }

  public get colorView(): unknown {
    return this._colorView;
  }

  public get depthStencilView(): unknown {
    return this._depthStencilView;
  }

  public createDepthPrepassDescriptor(): unknown {
    return {
      colorAttachments: [],
      depthStencilAttachment: {
        view: this._depthStencilView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        stencilClearValue: 0,
        stencilLoadOp: "clear",
        stencilStoreOp: "store"
      }
    };
  }

  public createMainColorPassDescriptor(params: {
    clearColor: WebGPUClearColor;
    loadDepthStencil: boolean;
  }): unknown {
    return {
      colorAttachments: [{
        view: this._colorView,
        clearValue: params.clearColor,
        loadOp: "clear",
        storeOp: "store"
      }],
      depthStencilAttachment: {
        view: this._depthStencilView,
        depthClearValue: 1,
        depthLoadOp: params.loadDepthStencil ? "load" : "clear",
        depthStoreOp: "store",
        stencilClearValue: 0,
        stencilLoadOp: params.loadDepthStencil ? "load" : "clear",
        stencilStoreOp: "store"
      }
    };
  }

  public createLoadedColorPassDescriptor(): unknown {
    return {
      colorAttachments: [{
        view: this._colorView,
        loadOp: "load",
        storeOp: "store"
      }],
      depthStencilAttachment: {
        view: this._depthStencilView,
        depthLoadOp: "load",
        depthStoreOp: "store",
        stencilLoadOp: "load",
        stencilStoreOp: "store"
      }
    };
  }

  public createSectionPlaneStencilMaskDescriptor(): unknown {
    return {
      colorAttachments: [{
        view: this._colorView,
        loadOp: "load",
        storeOp: "store"
      }],
      depthStencilAttachment: {
        view: this._depthStencilView,
        depthLoadOp: "load",
        depthStoreOp: "store",
        stencilClearValue: 0,
        stencilLoadOp: "clear",
        stencilStoreOp: "store"
      }
    };
  }
}
