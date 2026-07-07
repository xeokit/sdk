/**
 * @jest-environment jsdom
 */

import {SDKErrorType} from "../../../base/core";
import {TrianglesPrimitive} from "../../../base/constants";
import type {RendererError} from "../../renderer";
import {WebGPURenderer, type WebGPUDeviceLike} from "../core";

type Handler = (...args: any[]) => void;

function createSubscribable() {
  const handlers: Handler[] = [];
  const unsubs: jest.Mock[] = [];
  const event = {
    subscribe: jest.fn((handler: Handler) => {
      handlers.push(handler);
      const unsub = jest.fn(() => {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      });
      unsubs.push(unsub);
      return unsub;
    })
  };

  return {
    event,
    unsubs,
    emit: (...args: any[]) => {
      for (const handler of handlers.slice()) {
        handler(...args);
      }
    }
  };
}

function getBufferSourceMetrics(data: ArrayBuffer | ArrayBufferView): {
  elementCount: number;
  bytesPerElement: number;
} {
  if (data instanceof ArrayBuffer || data instanceof DataView) {
    return {
      elementCount: data.byteLength,
      bytesPerElement: 1
    };
  }

  const typedArray = data as ArrayBufferView & {
    length: number;
    BYTES_PER_ELEMENT: number;
  };

  return {
    elementCount: typedArray.length,
    bytesPerElement: typedArray.BYTES_PER_ELEMENT
  };
}

function throwOperationError(message: string): never {
  throw new DOMException(message, "OperationError");
}

function createViewer(hasScene: boolean) {
  const onSceneAttached = createSubscribable();
  const onSceneDetached = createSubscribable();
  const onViewerDestroyed = createSubscribable();
  const onViewCreated = createSubscribable();
  const onViewUpdated = createSubscribable();
  const onViewDestroyed = createSubscribable();
  const onViewObjectVisibleChanged = createSubscribable();
  const onViewObjectCulledChanged = createSubscribable();
  const onViewObjectColorizeChanged = createSubscribable();
  const onViewObjectOpacityChanged = createSubscribable();

  const viewer = {
    scene: hasScene ? {} : null,
    viewList: [] as any[],
    events: {
      onSceneAttached: onSceneAttached.event,
      onSceneDetached: onSceneDetached.event,
      onViewerDestroyed: onViewerDestroyed.event,
      onViewCreated: onViewCreated.event,
      onViewUpdated: onViewUpdated.event,
      onViewDestroyed: onViewDestroyed.event,
      onViewObjectVisibleChanged: onViewObjectVisibleChanged.event,
      onViewObjectCulledChanged: onViewObjectCulledChanged.event,
      onViewObjectColorizeChanged: onViewObjectColorizeChanged.event,
      onViewObjectOpacityChanged: onViewObjectOpacityChanged.event
    }
  };

  return {
    viewer,
    onSceneAttached,
    onSceneDetached,
    onViewerDestroyed,
    onViewCreated,
    onViewUpdated,
    onViewDestroyed,
    onViewObjectVisibleChanged,
    onViewObjectCulledChanged,
    onViewObjectColorizeChanged,
    onViewObjectOpacityChanged
  };
}

function createWebGPUHarness() {
  const renderPipeline = {};
  const bindGroupLayout = {};
  const pipelineLayout = {};
  const shaderModule = {};
  const bindGroup = {};
  const renderPipelines: any[] = [];
  const bindGroups: any[] = [];
  const buffers: any[] = [];
  const depthTextures: any[] = [];
  const depthTextureView = {};
  const passEncoder = {
    setPipeline: jest.fn(),
    setVertexBuffer: jest.fn(),
    setIndexBuffer: jest.fn(),
    setBindGroup: jest.fn(),
    drawIndexed: jest.fn(),
    end: jest.fn()
  };
  const commandBuffer = {};
  const commandEncoder = {
    beginRenderPass: jest.fn(() => passEncoder),
    finish: jest.fn(() => commandBuffer)
  };
  const device = {
    queue: {
      submit: jest.fn(),
      writeBuffer: jest.fn((
        buffer: any,
        bufferOffset: number,
        data: ArrayBuffer | ArrayBufferView,
        dataOffset = 0,
        size?: number
      ) => {
        const {elementCount, bytesPerElement} = getBufferSourceMetrics(data);
        const contentsSize = size ?? elementCount - dataOffset;
        if (contentsSize < 0 || dataOffset + contentsSize > elementCount) {
          throwOperationError("Number of bytes to write is too large");
        }
        const contentsByteLength = contentsSize * bytesPerElement;
        if (contentsByteLength % 4 !== 0) {
          throwOperationError("Number of bytes to write is not a multiple of 4");
        }
        if (
          buffer?.descriptor?.size !== undefined &&
          bufferOffset + contentsByteLength > buffer.descriptor.size
        ) {
          throwOperationError("Number of bytes to write is too large");
        }
      })
    },
    createBuffer: jest.fn((descriptor: any) => {
      const buffer = {
        descriptor,
        destroy: jest.fn()
      };
      buffers.push(buffer);
      return buffer;
    }),
    createTexture: jest.fn((descriptor: any) => {
      const texture = {
        descriptor,
        createView: jest.fn(() => depthTextureView),
        destroy: jest.fn()
      };
      depthTextures.push(texture);
      return texture;
    }),
    createShaderModule: jest.fn(() => shaderModule),
    createBindGroupLayout: jest.fn(() => bindGroupLayout),
    createPipelineLayout: jest.fn(() => pipelineLayout),
    createRenderPipeline: jest.fn((descriptor: any) => {
      const pipeline = renderPipelines.length === 0 ? renderPipeline : {descriptor};
      renderPipelines.push(pipeline);
      return pipeline;
    }),
    createBindGroup: jest.fn(() => {
      const group = bindGroups.length === 0 ? bindGroup : {};
      bindGroups.push(group);
      return group;
    }),
    createCommandEncoder: jest.fn(() => commandEncoder),
    destroy: jest.fn(),
    lost: new Promise(() => {})
  } as unknown as WebGPUDeviceLike & {
    queue: {submit: jest.Mock; writeBuffer: jest.Mock};
    createBuffer: jest.Mock;
    createTexture: jest.Mock;
    createShaderModule: jest.Mock;
    createBindGroupLayout: jest.Mock;
    createPipelineLayout: jest.Mock;
    createRenderPipeline: jest.Mock;
    createBindGroup: jest.Mock;
    createCommandEncoder: jest.Mock;
    destroy: jest.Mock;
  };
  const textureView = {};
  const texture = {
    createView: jest.fn(() => textureView)
  };
  const context = {
    configure: jest.fn(),
    unconfigure: jest.fn(),
    getCurrentTexture: jest.fn(() => texture)
  };

  return {
    passEncoder,
    commandBuffer,
    commandEncoder,
    device,
    renderPipeline,
    renderPipelines,
    bindGroupLayout,
    pipelineLayout,
    shaderModule,
    bindGroup,
    bindGroups,
    buffers,
    depthTextures,
    depthTextureView,
    texture,
    textureView,
    context
  };
}

function createView(viewer: any, context: any, transparent = false) {
  const canvas = document.createElement("canvas");
  canvas.getContext = jest.fn((contextId: string) => contextId === "webgpu" ? context : null) as any;
  canvas.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 50,
    width: 100,
    height: 50,
    toJSON: () => ({})
  }));

  return {
    id: "view",
    viewer,
    htmlElement: canvas,
    boundary: [0, 0, 100, 50],
    camera: {
      viewMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      projMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    },
    objects: {},
    backgroundColor: [0.2, 0.3, 0.4],
    transparent,
    needsRender: jest.fn()
  };
}

function createTriangleMesh(meshId = "mesh") {
  const geometry = {
    id: "geometry",
    uniqueId: "model__geometry",
    primitive: TrianglesPrimitive,
    positionsCompressed: new Uint16Array([
      0, 0, 0,
      65535, 0, 0,
      0, 65535, 0
    ]),
    aabb: new Float32Array([0, 0, 0, 1, 1, 0]),
    indices: new Uint16Array([0, 1, 2]),
    destroyed: false
  };
  const mesh = {
    id: meshId,
    uniqueId: `model__${meshId}`,
    geometry,
    object: null,
    destroyed: false,
    worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    color: [0.5, 0.6, 0.7],
    effectiveColor: [0.5, 0.6, 0.7],
    opacity: 1,
    effectiveOpacity: 1
  };

  return {geometry, mesh};
}

function getLastWriteBufferCall(gpu: ReturnType<typeof createWebGPUHarness>, bufferLabel: string): any[] {
  const calls = gpu.device.queue.writeBuffer.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const buffer = calls[i][0] as any;
    if (buffer.descriptor?.label === bufferLabel) {
      return calls[i];
    }
  }
  throw new Error(`Expected writeBuffer call for ${bufferLabel}`);
}

function getLastWriteBufferData(gpu: ReturnType<typeof createWebGPUHarness>, bufferLabel: string): Float32Array {
  return getLastWriteBufferCall(gpu, bufferLabel)[2] as Float32Array;
}

function restoreNavigator(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(globalThis, "navigator", descriptor);
  } else {
    delete (globalThis as {navigator?: Navigator}).navigator;
  }
}

describe("WebGPURenderer contract", () => {
  test("reports attach as unsupported until a device exists", () => {
    const renderer = new WebGPURenderer({logging: false});
    const errors: RendererError[] = [];

    renderer.events.onError.subscribe((_renderer, error) => {
      errors.push(error);
    });

    const result = renderer.attachViewer({} as any);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected WebGPURenderer.attachViewer to fail");
    }
    expect(result.type).toBe(SDKErrorType.NotSupported);
    expect(renderer.viewer).toBeNull();
    expect(renderer.rendering).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe(SDKErrorType.NotSupported);
  });

  test("emits destroyed once", () => {
    const renderer = new WebGPURenderer({logging: false});
    const destroyed: boolean[] = [];

    renderer.events.onRendererDestroyed.subscribe((_renderer, value) => {
      destroyed.push(value);
    });

    renderer.destroy();
    renderer.destroy();

    expect(destroyed).toEqual([true]);
  });

  test("attaches with an injected device and clears dirty views", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });
    const rendered: any[] = [];
    const stopped: boolean[] = [];

    renderer.events.onViewRendered.subscribe((_renderer, renderedView) => {
      rendered.push(renderedView);
    });
    renderer.events.onRendererStopped.subscribe(() => {
      stopped.push(true);
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(renderer.viewer).toBe(testViewer.viewer);
    expect(renderer.rendering).toBe(true);
    expect(gpu.context.configure).toHaveBeenCalledWith({
      device: gpu.device,
      format: "rgba8unorm",
      alphaMode: "opaque"
    });
    expect(gpu.device.createTexture).toHaveBeenCalledWith({
      label: "xeokit-webgpu-depth:view",
      size: {
        width: 100,
        height: 50,
        depthOrArrayLayers: 1
      },
      format: "depth24plus",
      usage: 16
    });
    expect(gpu.commandEncoder.beginRenderPass).toHaveBeenCalledTimes(1);
    expect(gpu.passEncoder.end).toHaveBeenCalledTimes(1);
    expect(gpu.device.queue.submit).toHaveBeenCalledWith([gpu.commandBuffer]);
    expect(rendered).toEqual([]);

    testViewer.onViewUpdated.emit(view, view);

    expect(rendered).toEqual([view]);
    expect(gpu.context.configure).toHaveBeenCalledTimes(1);
    expect(gpu.device.createTexture).toHaveBeenCalledTimes(1);
    expect(gpu.commandEncoder.beginRenderPass).toHaveBeenCalledTimes(2);
    const calls = gpu.commandEncoder.beginRenderPass.mock.calls;
    const descriptor = calls[calls.length - 1][0] as any;
    expect(descriptor.colorAttachments[0].clearValue).toEqual({
      r: 0.2,
      g: 0.3,
      b: 0.4,
      a: 1
    });
    expect(descriptor.depthStencilAttachment).toEqual({
      view: gpu.depthTextureView,
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store"
    });

    const firstDepthTexture = gpu.depthTextures[0];
    (view.htmlElement.getBoundingClientRect as jest.Mock).mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 120,
      bottom: 60,
      width: 120,
      height: 60,
      toJSON: () => ({})
    });

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.context.configure).toHaveBeenCalledTimes(2);
    expect(gpu.device.createTexture).toHaveBeenCalledTimes(2);
    expect(firstDepthTexture.destroy).toHaveBeenCalledTimes(1);

    testViewer.onSceneDetached.emit(testViewer.viewer, testViewer.viewer.scene);

    expect(renderer.rendering).toBe(false);
    expect(gpu.context.unconfigure).toHaveBeenCalledTimes(1);
    expect(gpu.depthTextures[1].destroy).toHaveBeenCalledTimes(1);
    expect(stopped).toEqual([true]);
  });

  test("draws supported indexed triangle meshes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [mesh.id]: mesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createShaderModule).toHaveBeenCalledTimes(1);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    const pipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    expect(pipelineDescriptor.depthStencil).toEqual({
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less"
    });
    expect(gpu.device.createBuffer).toHaveBeenCalledTimes(5);
    expect(gpu.device.queue.writeBuffer).toHaveBeenCalledTimes(5);
    expect(gpu.passEncoder.setPipeline).toHaveBeenCalledWith(gpu.renderPipeline);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(0, gpu.buffers[0]);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(1, gpu.buffers[1]);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(2, gpu.buffers[3]);
    expect(gpu.passEncoder.setIndexBuffer).toHaveBeenCalledWith(gpu.buffers[2], "uint16");
    expect(gpu.passEncoder.setBindGroup).toHaveBeenCalledWith(0, gpu.bindGroup);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);

    expect(pipelineDescriptor.vertex.buffers).toEqual([
      {
        arrayStride: 12,
        attributes: [{
          shaderLocation: 0,
          offset: 0,
          format: "float32x3"
        }]
      },
      {
        arrayStride: 12,
        attributes: [{
          shaderLocation: 1,
          offset: 0,
          format: "float32x3"
        }]
      },
      {
        arrayStride: 144,
        stepMode: "instance",
        attributes: [
          {
            shaderLocation: 2,
            offset: 0,
            format: "float32x4"
          },
          {
            shaderLocation: 3,
            offset: 16,
            format: "float32x4"
          },
          {
            shaderLocation: 4,
            offset: 32,
            format: "float32x4"
          },
          {
            shaderLocation: 5,
            offset: 48,
            format: "float32x4"
          },
          {
            shaderLocation: 6,
            offset: 64,
            format: "float32x4"
          },
          {
            shaderLocation: 7,
            offset: 80,
            format: "float32x4"
          },
          {
            shaderLocation: 8,
            offset: 96,
            format: "float32x4"
          },
          {
            shaderLocation: 9,
            offset: 112,
            format: "float32x4"
          },
          {
            shaderLocation: 10,
            offset: 128,
            format: "float32x4"
          }
        ]
      }
    ]);

    const positionUpload = gpu.device.queue.writeBuffer.mock.calls[0][2] as Float32Array;
    expect(Array.from(positionUpload)).toEqual([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0
    ]);
    const normalUpload = gpu.device.queue.writeBuffer.mock.calls[1][2] as Float32Array;
    for (let i = 0; i < normalUpload.length; i += 3) {
      expect(normalUpload[i]).toBeCloseTo(0, 3);
      expect(normalUpload[i + 1]).toBeCloseTo(0, 3);
      expect(normalUpload[i + 2]).toBeCloseTo(1, 3);
    }
    const indexUpload = gpu.device.queue.writeBuffer.mock.calls[2][2] as Uint8Array;
    expect(indexUpload.byteLength).toBe(8);
    expect(Array.from(new Uint16Array(indexUpload.buffer, indexUpload.byteOffset, geometry.indices.length))).toEqual(Array.from(geometry.indices));
    const instanceWrite = getLastWriteBufferCall(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceWrite[4]).toBe(36);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(Array.from(instanceUpload.slice(0, 16))).toEqual(mesh.worldMatrix);
    expect(Array.from(instanceUpload.slice(16, 32))).toEqual(view.camera.projMatrix);
    expect(instanceUpload[32]).toBeCloseTo(0.5);
    expect(instanceUpload[33]).toBeCloseTo(0.6);
    expect(instanceUpload[34]).toBeCloseTo(0.7);
    expect(instanceUpload[35]).toBeCloseTo(1);
    const frameUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-frame-uniforms");
    expect(Array.from(frameUpload.slice(0, 16))).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0.5, 0,
      0, 0, 0.5, 1
    ]);
    expect(frameUpload[19]).toBeCloseTo(0.35);

    renderer.detachViewer();

    expect(gpu.buffers[0].destroy).toHaveBeenCalledTimes(1);
    expect(gpu.buffers[1].destroy).toHaveBeenCalledTimes(1);
    expect(gpu.buffers[2].destroy).toHaveBeenCalledTimes(1);
    expect(gpu.buffers[3].destroy).toHaveBeenCalledTimes(1);
    expect(gpu.buffers[4].destroy).toHaveBeenCalledTimes(1);
  });

  test("batches opaque meshes with shared geometry into one instanced draw", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: meshA} = createTriangleMesh("meshA");
    const meshB = {
      ...meshA,
      id: "meshB",
      uniqueId: "model__meshB",
      color: [0.1, 0.2, 0.3],
      effectiveColor: [0.1, 0.2, 0.3],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1]
    };

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [meshA.id]: meshA,
          [meshB.id]: meshB
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(1);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 2, 0, 0, 0);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[32]).toBeCloseTo(0.5);
    expect(instanceUpload[33]).toBeCloseTo(0.6);
    expect(instanceUpload[34]).toBeCloseTo(0.7);
    expect(instanceUpload[36 + 12]).toBeCloseTo(2);
    expect(instanceUpload[36 + 32]).toBeCloseTo(0.1);
    expect(instanceUpload[36 + 33]).toBeCloseTo(0.2);
    expect(instanceUpload[36 + 34]).toBeCloseTo(0.3);
  });

  test("draws transparent meshes with transparent pipeline after depth sorting", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: nearMesh} = createTriangleMesh("nearMesh");
    nearMesh.effectiveOpacity = 0.4;
    nearMesh.opacity = 0.4;
    nearMesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1, 1];
    const farMesh = {
      ...nearMesh,
      id: "farMesh",
      uniqueId: "model__farMesh",
      effectiveOpacity: 0.4,
      opacity: 0.4,
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -2, 1]
    };

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [nearMesh.id]: nearMesh,
          [farMesh.id]: farMesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    const transparentPipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    expect(transparentPipelineDescriptor.label).toBe("xeokit-webgpu-basic-triangle-transparent-pipeline");
    expect(transparentPipelineDescriptor.depthStencil.depthWriteEnabled).toBe(false);
    expect(gpu.passEncoder.setPipeline).toHaveBeenCalledWith(gpu.renderPipeline);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(1);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 2, 0, 0, 0);
    expect(gpu.passEncoder.setBindGroup.mock.calls[0]).toEqual([0, gpu.bindGroup]);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[14]).toBeCloseTo(-2);
    expect(instanceUpload[36 + 14]).toBeCloseTo(-1);
  });

  test("draws opaque meshes before transparent meshes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: opaqueMesh} = createTriangleMesh("opaqueMesh");
    const transparentMesh = {
      ...opaqueMesh,
      id: "transparentMesh",
      uniqueId: "model__transparentMesh",
      opacity: 0.5,
      effectiveOpacity: 0.5
    };

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [opaqueMesh.id]: opaqueMesh,
          [transparentMesh.id]: transparentMesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(2);
    expect((gpu.device.createRenderPipeline.mock.calls[0][0] as any).label).toBe("xeokit-webgpu-basic-triangle-opaque-pipeline");
    expect((gpu.device.createRenderPipeline.mock.calls[1][0] as any).label).toBe("xeokit-webgpu-basic-triangle-transparent-pipeline");
    expect(gpu.passEncoder.setPipeline.mock.calls[0]).toEqual([gpu.renderPipelines[0]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[0]).toEqual([0, gpu.bindGroup]);
    expect(gpu.passEncoder.drawIndexed.mock.calls[0]).toEqual([3, 1, 0, 0, 0]);
    expect(gpu.passEncoder.setPipeline.mock.calls[1]).toEqual([gpu.renderPipelines[1]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[1]).toEqual([0, gpu.bindGroup]);
    expect(gpu.passEncoder.drawIndexed.mock.calls[1]).toEqual([3, 1, 0, 0, 1]);
  });

  test("respects basic per-view object render state", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();
    const sceneObject = {
      id: "object",
      meshes: [mesh]
    };
    const viewObject = {
      id: sceneObject.id,
      view,
      sceneObject,
      visible: false,
      culled: false,
      colorize: null as number[] | null,
      opacityUpdated: false,
      opacity: 1
    };

    mesh.object = sceneObject as any;
    (view.objects as any)[sceneObject.id] = viewObject;
    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [mesh.id]: mesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();

    viewObject.visible = true;
    viewObject.colorize = [0.9, 0.1, 0.2];
    viewObject.opacityUpdated = true;
    viewObject.opacity = 0.35;

    testViewer.onViewObjectColorizeChanged.emit(view, viewObject);
    expect(view.needsRender).toHaveBeenCalledTimes(1);

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[32]).toBeCloseTo(0.9);
    expect(instanceUpload[33]).toBeCloseTo(0.1);
    expect(instanceUpload[34]).toBeCloseTo(0.2);
    expect(instanceUpload[35]).toBeCloseTo(0.35);

    gpu.passEncoder.drawIndexed.mockClear();
    viewObject.culled = true;

    testViewer.onViewObjectCulledChanged.emit(view, viewObject);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
  });

  test("create requests a WebGPU device and owns it by default", async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const gpu = createWebGPUHarness();
    const adapter = {
      requestDevice: jest.fn(async () => gpu.device)
    };
    const navigatorGPU = {
      requestAdapter: jest.fn(async () => adapter),
      getPreferredCanvasFormat: jest.fn(() => "rgba8unorm")
    };

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        gpu: navigatorGPU
      }
    });

    try {
      const result = await WebGPURenderer.create({logging: false});

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("Expected WebGPURenderer.create to succeed");
      }
      expect(navigatorGPU.requestAdapter).toHaveBeenCalledTimes(1);
      expect(adapter.requestDevice).toHaveBeenCalledTimes(1);
      expect(result.value.supported).toBe(true);

      result.value.destroy();

      expect(gpu.device.destroy).toHaveBeenCalledTimes(1);
    } finally {
      restoreNavigator(originalNavigator);
    }
  });
});
