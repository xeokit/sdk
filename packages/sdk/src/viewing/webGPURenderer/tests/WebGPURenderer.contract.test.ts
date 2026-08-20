/**
 * @jest-environment jsdom
 */

import {SDKErrorType} from "../../../base/core";
import {DetailedRender, GaussianSplatsPrimitive, LinearFilter, LinearMipMapNearestFilter, LinesPrimitive, NavigationRender, PerspectiveProjectionType, PointsPrimitive, RealisticRender, RepeatWrapping, sRGBEncoding, TrianglesPrimitive} from "../../../base/constants";
import {
  createMat4Float64,
  lookAtMat4v,
  mulMat4,
  perspectiveMat4,
  transformVec4,
  type Mat4
} from "../../../base/math/matrix";
import {Scene} from "../../../model/scene";
import type {RendererError} from "../../renderer";
import {WebGPURenderer, type WebGPUDeviceLike} from "../core";
import {
  AMBIENT_LIGHT_UNIFORM_OFFSET,
  DIR_LIGHT_COLOR_UNIFORM_OFFSET,
  DIR_LIGHT_DIRECTION_UNIFORM_OFFSET,
  HEMISPHERE_GROUND_UNIFORM_OFFSET,
  HEMISPHERE_SKY_UNIFORM_OFFSET,
  HEMISPHERE_UP_UNIFORM_OFFSET,
  INSTANCE_BYTES,
  INSTANCE_FLOATS,
  RTC_TILE_BYTES,
  DEPTH_PARAMS_UNIFORM_OFFSET,
  SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET,
  SECTION_PLANE_STATE_UNIFORM_OFFSET,
  SECTION_PLANE_UNIFORM_OFFSET
} from "../internal/constants";
import {RENDER_PASSES} from "../internal/RENDER_PASSES";
import {RenderContext} from "../internal/RenderContext";
import {encodePackedTriangleBatches} from "../internal/drawOps/techniques/triangles/PackedTriangleBatchEncoder";
import {createTrianglesDrawColorNoNormalsShader} from "../internal/drawOps/techniques/triangles/TrianglesDrawColorNoNormalsShader";
import {InstanceBufferManager} from "../internal/gpuMemoryManager/InstanceBufferManager";
import {TriangleBatchManager} from "../internal/gpuMemoryManager/TriangleBatchManager";
import {WebGPUPickBuffer, WebGPUSnapBufferCache} from "../internal/webGPU";
import {createMemoryConfigs} from "../createMemoryConfigs";
import {createWebGPURenderConfigs} from "../createWebGPURenderConfigs";

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
    }),
    dispatch: jest.fn((...args: any[]) => {
      for (const handler of handlers.slice()) {
        handler(...args);
      }
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
  const onEffectCreated = createSubscribable();
  const onEffectDestroyed = createSubscribable();
  const onViewCreated = createSubscribable();
  const onViewUpdated = createSubscribable();
  const onViewDestroyed = createSubscribable();
  const onViewObjectVisibleChanged = createSubscribable();
  const onViewObjectXRayedChanged = createSubscribable();
  const onViewObjectClippableChanged = createSubscribable();
  const onViewObjectCulledChanged = createSubscribable();
  const onViewObjectHighlightedChanged = createSubscribable();
  const onViewObjectSelectedChanged = createSubscribable();
  const onViewObjectColorizeChanged = createSubscribable();
  const onViewObjectOpacityChanged = createSubscribable();
  const onViewObjectPickableChanged = createSubscribable();
  const onCameraViewMatrixUpdated = createSubscribable();
  const onCameraProjMatrixUpdated = createSubscribable();
  const onSectionPlaneCreated = createSubscribable();
  const onSectionPlaneDestroyed = createSubscribable();
  const onSectionPlanePosChanged = createSubscribable();
  const onSectionPlaneDirChanged = createSubscribable();
  const onSectionPlaneActive = createSubscribable();
  const onSceneModelCreated = createSubscribable();
  const onSceneModelSealed = createSubscribable();
  const onSceneModelDestroyed = createSubscribable();
  const onSceneModelBuildStarted = createSubscribable();
  const onSceneModelBuildFinished = createSubscribable();
  const onSceneModelBatchStarted = createSubscribable();
  const onSceneModelBatchCommitted = createSubscribable();
  const onSceneModelBatchRolledBack = createSubscribable();
  const onSceneGeometryCreated = createSubscribable();
  const onSceneGeometryDestroyed = createSubscribable();
  const onSceneGeometryUpdated = createSubscribable();
  const onSceneMeshCreated = createSubscribable();
  const onSceneMeshDestroyed = createSubscribable();
  const onSceneObjectCreated = createSubscribable();
  const onSceneObjectDestroyed = createSubscribable();
  const onSceneObjectMeshAdded = createSubscribable();
  const onSceneObjectMeshRemoved = createSubscribable();
  const onSceneMeshMatrixChanged = createSubscribable();
  const onSceneMeshMoved = createSubscribable();
  const onSceneMeshColorChanged = createSubscribable();
  const onSceneMeshOpacityChanged = createSubscribable();
  const onSceneMaterialPatternChanged = createSubscribable();
  const onSceneMaterialColorChanged = createSubscribable();
  const onSceneMaterialEmissiveColorChanged = createSubscribable();
  const onSceneMaterialOpacityChanged = createSubscribable();
  const onSceneTextureImageDataChanged = createSubscribable();
  const onSceneTransformMatrixChanged = createSubscribable();
  const scene = hasScene ? {
    models: {},
    events: {
      onSceneModelCreated: onSceneModelCreated.event,
      onSceneModelSealed: onSceneModelSealed.event,
      onSceneModelDestroyed: onSceneModelDestroyed.event,
      onSceneModelBuildStarted: onSceneModelBuildStarted.event,
      onSceneModelBuildFinished: onSceneModelBuildFinished.event,
      onSceneModelBatchStarted: onSceneModelBatchStarted.event,
      onSceneModelBatchCommitted: onSceneModelBatchCommitted.event,
      onSceneModelBatchRolledBack: onSceneModelBatchRolledBack.event,
      onSceneGeometryCreated: onSceneGeometryCreated.event,
      onSceneGeometryDestroyed: onSceneGeometryDestroyed.event,
      onSceneGeometryUpdated: onSceneGeometryUpdated.event,
      onSceneMeshCreated: onSceneMeshCreated.event,
      onSceneMeshDestroyed: onSceneMeshDestroyed.event,
      onSceneObjectCreated: onSceneObjectCreated.event,
      onSceneObjectDestroyed: onSceneObjectDestroyed.event,
      onSceneObjectMeshAdded: onSceneObjectMeshAdded.event,
      onSceneObjectMeshRemoved: onSceneObjectMeshRemoved.event,
      onSceneMeshMatrixChanged: onSceneMeshMatrixChanged.event,
      onSceneMeshMoved: onSceneMeshMoved.event,
      onSceneMeshColorChanged: onSceneMeshColorChanged.event,
      onSceneMeshOpacityChanged: onSceneMeshOpacityChanged.event,
      onSceneMaterialPatternChanged: onSceneMaterialPatternChanged.event,
      onSceneMaterialColorChanged: onSceneMaterialColorChanged.event,
      onSceneMaterialEmissiveColorChanged: onSceneMaterialEmissiveColorChanged.event,
      onSceneMaterialOpacityChanged: onSceneMaterialOpacityChanged.event,
      onSceneTextureImageDataChanged: onSceneTextureImageDataChanged.event,
      onSceneTransformMatrixChanged: onSceneTransformMatrixChanged.event
    }
  } : null;

  const viewer = {
    scene,
    viewList: [] as any[],
    events: {
      onSceneAttached: onSceneAttached.event,
      onSceneDetached: onSceneDetached.event,
      onViewerDestroyed: onViewerDestroyed.event,
      onEffectCreated: onEffectCreated.event,
      onEffectDestroyed: onEffectDestroyed.event,
      onViewCreated: onViewCreated.event,
      onViewUpdated: onViewUpdated.event,
      onViewDestroyed: onViewDestroyed.event,
      onViewObjectVisibleChanged: onViewObjectVisibleChanged.event,
      onViewObjectXRayedChanged: onViewObjectXRayedChanged.event,
      onViewObjectClippableChanged: onViewObjectClippableChanged.event,
      onViewObjectCulledChanged: onViewObjectCulledChanged.event,
      onViewObjectHighlightedChanged: onViewObjectHighlightedChanged.event,
      onViewObjectSelectedChanged: onViewObjectSelectedChanged.event,
      onViewObjectColorizeChanged: onViewObjectColorizeChanged.event,
      onViewObjectOpacityChanged: onViewObjectOpacityChanged.event,
      onViewObjectPickableChanged: onViewObjectPickableChanged.event,
      onCameraViewMatrixUpdated: onCameraViewMatrixUpdated.event,
      onCameraProjMatrixUpdated: onCameraProjMatrixUpdated.event,
      onSectionPlaneCreated: onSectionPlaneCreated.event,
      onSectionPlaneDestroyed: onSectionPlaneDestroyed.event,
      onSectionPlanePosChanged: onSectionPlanePosChanged.event,
      onSectionPlaneDirChanged: onSectionPlaneDirChanged.event,
      onSectionPlaneActive: onSectionPlaneActive.event
    }
  };

  const emitViewUpdated = onViewUpdated.emit;
  onViewUpdated.emit = (...args: any[]) => {
    if ((viewer as any).__dispatchingViewUpdate) {
      return;
    }
    (viewer as any).__dispatchingViewUpdate = true;
    try {
      emitViewUpdated(...args);
    } finally {
      (viewer as any).__dispatchingViewUpdate = false;
    }
  };

  return {
    viewer,
    onSceneAttached,
    onSceneDetached,
    onViewerDestroyed,
    onEffectCreated,
    onEffectDestroyed,
    onViewCreated,
    onViewUpdated,
    onViewDestroyed,
    onViewObjectVisibleChanged,
    onViewObjectXRayedChanged,
    onViewObjectClippableChanged,
    onViewObjectCulledChanged,
    onViewObjectHighlightedChanged,
    onViewObjectSelectedChanged,
    onViewObjectColorizeChanged,
    onViewObjectOpacityChanged,
    onViewObjectPickableChanged,
    onCameraViewMatrixUpdated,
    onCameraProjMatrixUpdated,
    onSectionPlaneCreated,
    onSectionPlaneDestroyed,
    onSectionPlanePosChanged,
    onSectionPlaneDirChanged,
    onSectionPlaneActive,
    onSceneModelCreated,
    onSceneModelSealed,
    onSceneModelDestroyed,
    onSceneModelBuildStarted,
    onSceneModelBuildFinished,
    onSceneModelBatchStarted,
    onSceneModelBatchCommitted,
    onSceneModelBatchRolledBack,
    onSceneGeometryCreated,
    onSceneGeometryDestroyed,
    onSceneGeometryUpdated,
    onSceneMeshCreated,
    onSceneMeshDestroyed,
    onSceneObjectCreated,
    onSceneObjectDestroyed,
    onSceneObjectMeshAdded,
    onSceneObjectMeshRemoved,
    onSceneMeshMatrixChanged,
    onSceneMeshMoved,
    onSceneMeshColorChanged,
    onSceneMeshOpacityChanged,
    onSceneMaterialPatternChanged,
    onSceneMaterialColorChanged,
    onSceneMaterialEmissiveColorChanged,
    onSceneMaterialOpacityChanged,
    onSceneTextureImageDataChanged,
    onSceneTransformMatrixChanged
  };
}

function createWebGPUHarness() {
  const renderPipeline = {};
  const bindGroupLayout = {};
  const pipelineLayout = {};
  const shaderModule = {};
  const bindGroup = {};
  const sampler = {};
  const renderPipelines: any[] = [];
  const bindGroups: any[] = [];
  const buffers: any[] = [];
  const querySets: any[] = [];
  const pickReadbackBytes = new Uint8Array(4);
  const depthTextures: any[] = [];
  const depthTextureView = {};
  const passEncoder = {
    setPipeline: jest.fn(),
    setVertexBuffer: jest.fn(),
    setIndexBuffer: jest.fn(),
    setBindGroup: jest.fn(),
    drawIndexed: jest.fn(),
    draw: jest.fn(),
    end: jest.fn()
  };
  const commandBuffer = {};
  const commandEncoder = {
    beginRenderPass: jest.fn(() => passEncoder),
    copyBufferToBuffer: jest.fn((_source: any, _sourceOffset: number, destination: any, _destinationOffset: number, size: number) => {
      const target = destination?.__mappedRange;
      if (target instanceof ArrayBuffer) {
        const timestamps = new BigUint64Array(target);
        for (let i = 0; i < size / 8; i += 2) {
          timestamps[i] = BigInt(i / 2) * 10000000n;
          timestamps[i + 1] = timestamps[i] + 2000000n;
        }
      }
    }),
    copyTextureToBuffer: jest.fn((_source: any, destination: any) => {
      const target = destination?.buffer?.__mappedRange;
      if (target instanceof ArrayBuffer) {
        new Uint8Array(target).set(pickReadbackBytes);
      }
    }),
    resolveQuerySet: jest.fn(),
    finish: jest.fn(() => commandBuffer)
  };
  const device = {
    features: {
      has: jest.fn((feature: string) => feature === "timestamp-query")
    },
    queue: {
      submit: jest.fn(),
      writeTexture: jest.fn(),
      writeBuffer: jest.fn((
        buffer: any,
        bufferOffset: number,
        data: ArrayBuffer | ArrayBufferView,
        dataOffset = 0,
        size?: number
      ) => {
        if (bufferOffset % 4 !== 0) {
          throwOperationError("Buffer offset is not a multiple of 4");
        }
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
      const mappedRange = new ArrayBuffer(descriptor.size ?? 0);
      const supportsReadbackMapping = (descriptor.usage & 1) !== 0;
      const buffer: any = {
        descriptor,
        destroy: jest.fn()
      };
      if (supportsReadbackMapping) {
        let mapPending = false;
        let mapped = false;
        buffer.__mappedRange = mappedRange;
        buffer.mapAsync = jest.fn(async () => {
          if (mapPending || mapped) {
            throw new Error("Buffer already has an outstanding map pending.");
          }
          mapPending = true;
          try {
            await Promise.resolve();
            mapped = true;
          } finally {
            mapPending = false;
          }
        });
        buffer.getMappedRange = jest.fn(() => mappedRange);
        buffer.unmap = jest.fn(() => {
          mapped = false;
        });
      }
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
    createQuerySet: jest.fn((descriptor: any) => {
      const querySet = {
        descriptor,
        destroy: jest.fn()
      };
      querySets.push(querySet);
      return querySet;
    }),
    createShaderModule: jest.fn(() => shaderModule),
    createBindGroupLayout: jest.fn(() => bindGroupLayout),
    createPipelineLayout: jest.fn(() => pipelineLayout),
    createSampler: jest.fn(() => sampler),
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
    queue: {submit: jest.Mock; writeBuffer: jest.Mock; writeTexture: jest.Mock};
    features: {has: jest.Mock};
    createBuffer: jest.Mock;
    createTexture: jest.Mock;
    createQuerySet: jest.Mock;
    createShaderModule: jest.Mock;
    createBindGroupLayout: jest.Mock;
    createPipelineLayout: jest.Mock;
    createSampler: jest.Mock;
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
    pickReadbackBytes,
    device,
    renderPipeline,
    renderPipelines,
    bindGroupLayout,
    pipelineLayout,
    shaderModule,
    bindGroup,
    sampler,
    bindGroups,
    buffers,
    querySets,
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

  const view: any = {
    id: "view",
    viewer,
    htmlElement: canvas,
    boundary: [0, 0, 100, 50],
    camera: {
      viewMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      projMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    },
    objects: {},
    pointsMaterial: {
      pointSize: 5,
      roundPoints: true,
      perspectivePoints: false,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 10
    },
    linesMaterial: {
      lineWidth: 5
    },
    backgroundColor: [0.2, 0.3, 0.4],
    transparent,
    needsRender: jest.fn(() => {
      if (viewer.__dispatchingViewUpdate) {
        return;
      }
      viewer.__dispatchingViewUpdate = true;
      try {
        viewer.events.onViewUpdated.dispatch(view, view);
      } finally {
        viewer.__dispatchingViewUpdate = false;
      }
    })
  };
  view.camera.view = view;
  return view;
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
    edgeIndices: new Uint16Array([0, 1, 1, 2, 2, 0]),
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

function createTriangleMeshWithNormals(meshId = "mesh") {
  const {geometry, mesh} = createTriangleMesh(meshId);
  (geometry as any).normalsCompressed = new Uint16Array([
    32767, 32767,
    32767, 32767,
    32767, 32767
  ]);
  return {geometry, mesh};
}

function createPointMesh(meshId = "points") {
  const geometry = {
    id: `${meshId}Geometry`,
    uniqueId: `model__${meshId}Geometry`,
    primitive: PointsPrimitive,
    positionsCompressed: new Uint16Array([
      0, 0, 0,
      65535, 0, 0
    ]),
    colorsCompressed: new Uint8Array([
      255, 128, 0, 255,
      0, 96, 255, 255
    ]),
    aabb: new Float32Array([0, 0, 0, 1, 0, 0]),
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

function createLineMesh(meshId = "lines") {
  const geometry = {
    id: `${meshId}Geometry`,
    uniqueId: `model__${meshId}Geometry`,
    primitive: LinesPrimitive,
    positionsCompressed: new Uint16Array([
      0, 0, 0,
      65535, 0, 0
    ]),
    colorsCompressed: new Uint8Array([
      32, 200, 255, 255,
      255, 64, 32, 255
    ]),
    aabb: new Float32Array([0, 0, 0, 1, 0, 0]),
    indices: new Uint16Array([0, 1]),
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

function createSplatMesh(meshId = "splats") {
  const geometry = {
    id: `${meshId}Geometry`,
    uniqueId: `model__${meshId}Geometry`,
    primitive: GaussianSplatsPrimitive,
    positionsCompressed: new Uint16Array([
      0, 0, 0,
      65535, 0, 0
    ]),
    colorsCompressed: new Uint8Array([
      255, 128, 0, 255,
      0, 96, 255, 192
    ]),
    scales: new Float32Array([
      0.1, 0.1, 0.1,
      0.2, 0.1, 0.1
    ]),
    rotations: new Float32Array([
      0, 0, 0, 1,
      0, 0, 0, 1
    ]),
    aabb: new Float32Array([0, 0, -1, 1, 0, 0]),
    destroyed: false
  };
  const mesh = {
    id: meshId,
    uniqueId: `model__${meshId}`,
    geometry,
    object: null,
    destroyed: false,
    worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1, 1],
    color: [0.5, 0.6, 0.7],
    effectiveColor: [0.5, 0.6, 0.7],
    opacity: 1,
    effectiveOpacity: 1
  };

  return {geometry, mesh};
}

function createLargeTriangleMesh(meshId: string, vertexCount: number) {
  const positionsCompressed = new Uint16Array(vertexCount * 3);
  positionsCompressed[3] = 65535;
  positionsCompressed[7] = 65535;
  const geometry = {
    id: `${meshId}Geometry`,
    uniqueId: `model__${meshId}Geometry`,
    primitive: TrianglesPrimitive,
    positionsCompressed,
    aabb: new Float32Array([0, 0, 0, 1, 1, 0]),
    indices: new Uint16Array([0, 1, 2]),
    edgeIndices: new Uint16Array([0, 1, 1, 2, 2, 0]),
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

function createQuadMesh(meshId = "mesh", aabb: Float32Array | number[] = [0, 0, 0, 1, 1, 0]) {
  const geometry = {
    id: `${meshId}Geometry`,
    uniqueId: `model__${meshId}Geometry`,
    primitive: TrianglesPrimitive,
    positionsCompressed: new Uint16Array([
      0, 0, 0,
      65535, 0, 0,
      0, 65535, 0,
      65535, 65535, 0
    ]),
    aabb: new Float32Array(aabb),
    indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
    edgeIndices: new Uint16Array([0, 1, 1, 3, 3, 2, 2, 0]),
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

function createBoxGeometry(geometryId = "boxGeometry") {
  const one = 65535;
  const zero = 0;
  return {
    id: geometryId,
    uniqueId: `model__${geometryId}`,
    primitive: TrianglesPrimitive,
    positionsCompressed: new Uint16Array([
      one, one, one, zero, one, one, zero, zero, one, one, zero, one,
      one, one, one, one, zero, one, one, zero, zero, one, one, zero,
      one, one, one, one, one, zero, zero, one, zero, zero, one, one,
      zero, one, one, zero, one, zero, zero, zero, zero, zero, zero, one,
      zero, zero, zero, one, zero, zero, one, zero, one, zero, zero, one,
      one, zero, zero, zero, zero, zero, zero, one, zero, one, one, zero
    ]),
    aabb: new Float32Array([-1, -1, -1, 1, 1, 1]),
    indices: new Uint16Array([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ]),
    edgeIndices: new Uint16Array([
      0, 1, 1, 2, 2, 3, 3, 0,
      4, 5, 5, 6, 6, 7, 7, 4,
      8, 9, 9, 10, 10, 11, 11, 8,
      12, 13, 13, 14, 14, 15, 15, 12,
      16, 17, 17, 18, 18, 19, 19, 16,
      20, 21, 21, 22, 22, 23, 23, 20
    ]),
    destroyed: false
  };
}

function createBoxMesh(meshId: string, geometry: any, worldMatrix: Mat4) {
  return {
    id: meshId,
    uniqueId: `model__${meshId}`,
    geometry,
    object: null,
    destroyed: false,
    worldMatrix,
    color: [0.5, 0.6, 0.7],
    effectiveColor: [0.5, 0.6, 0.7],
    opacity: 1,
    effectiveOpacity: 1
  };
}

function createTableSceneModelParams() {
  const one = 1;
  const neg = -1;
  return {
    id: "webgpuSnapTable",
    geometries: [
      {
        id: "demoBoxGeometry",
        primitive: TrianglesPrimitive,
        positions: [
          one, one, one, neg, one, one, neg, neg, one, one, neg, one,
          one, one, one, one, neg, one, one, neg, neg, one, one, neg,
          one, one, one, one, one, neg, neg, one, neg, neg, one, one,
          neg, one, one, neg, one, neg, neg, neg, neg, neg, neg, one,
          neg, neg, neg, one, neg, neg, one, neg, one, neg, neg, one,
          one, neg, neg, neg, neg, neg, neg, one, neg, one, one, neg
        ],
        indices: [
          0, 1, 2, 0, 2, 3,
          4, 5, 6, 4, 6, 7,
          8, 9, 10, 8, 10, 11,
          12, 13, 14, 12, 14, 15,
          16, 17, 18, 16, 18, 19,
          20, 21, 22, 20, 22, 23
        ],
        edgeIndices: [
          0, 1, 1, 2, 2, 3, 3, 0,
          4, 5, 5, 6, 6, 7, 7, 4,
          8, 9, 9, 10, 10, 11, 11, 8,
          12, 13, 13, 14, 14, 15, 15, 12,
          16, 17, 17, 18, 18, 19, 19, 16,
          20, 21, 21, 22, 22, 23, 23, 20
        ]
      }
    ],
    meshes: [
      {
        id: "redLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [-4, -4, 3],
        scale: [1, 1, 3],
        color: [1, 0.3, 0.3],
        opacity: 1
      },
      {
        id: "tableTop-mesh",
        geometryId: "demoBoxGeometry",
        position: [0, 0, 6],
        scale: [6, 6, 0.5],
        color: [1.0, 0.3, 1.0],
        opacity: 1
      }
    ],
    objects: [
      {
        id: "redLeg",
        meshIds: ["redLeg-mesh"]
      },
      {
        id: "purpleTableTop",
        meshIds: ["tableTop-mesh"]
      }
    ]
  };
}

function createScaleTranslateMatrix(position: [number, number, number], scale: [number, number, number]): Mat4 {
  return createMat4Float64([
    scale[0], 0, 0, 0,
    0, scale[1], 0, 0,
    0, 0, scale[2], 0,
    position[0], position[1], position[2], 1
  ]);
}

function setPerspectiveTableCamera(view: any): void {
  view.camera.viewMatrix = lookAtMat4v(
    new Float64Array([14, -14, 10]),
    new Float64Array([0, 0, 3]),
    new Float64Array([0, 0, 1])
  );
  view.camera.projMatrix = perspectiveMat4(60 * Math.PI / 180, view.boundary[2] / view.boundary[3], 0.1, 1000);
}

function projectWorldToCanvas(view: any, worldPos: [number, number, number]): [number, number] {
  const viewProjection = createMat4Float64();
  const world = new Float64Array([worldPos[0], worldPos[1], worldPos[2], 1]);
  const clip = new Float64Array(4);
  mulMat4(view.camera.projMatrix, view.camera.viewMatrix, viewProjection);
  transformVec4(viewProjection, world, clip);
  const width = view.boundary[2];
  const height = view.boundary[3];
  const ndcX = clip[0] / clip[3];
  const ndcY = clip[1] / clip[3];
  return [
    (ndcX * 0.5 + 0.5) * width,
    (0.5 - ndcY * 0.5) * height
  ];
}

function attachMeshToObject(mesh: any, view: any, model: any, objectId = `${mesh.id}Object`) {
  const sceneObject = {
    id: objectId,
    model,
    meshes: [mesh],
    destroyed: false
  };
  const viewObject = {
    id: sceneObject.id,
    view,
    sceneObject,
    visible: true,
    culled: false,
    pickable: true,
    colorize: null as number[] | null,
    opacityUpdated: false,
    opacity: 1
  };

  mesh.object = sceneObject;
  if (model.objects) {
    model.objects[sceneObject.id] = sceneObject;
  }
  view.objects[sceneObject.id] = viewObject;
  return {sceneObject, viewObject};
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

function getLastWriteBufferData<T extends ArrayBufferView = Float32Array>(
  gpu: ReturnType<typeof createWebGPUHarness>,
  bufferLabel: string
): T {
  return getLastWriteBufferCall(gpu, bufferLabel)[2] as T;
}

function getLastWriteBufferDataAtOffset<T extends ArrayBufferView = Float32Array>(
  gpu: ReturnType<typeof createWebGPUHarness>,
  bufferLabel: string,
  offset: number
): T {
  const calls = gpu.device.queue.writeBuffer.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const buffer = calls[i][0] as any;
    if (buffer.descriptor?.label === bufferLabel && calls[i][1] === offset) {
      return calls[i][2] as T;
    }
  }
  throw new Error(`Expected writeBuffer call for ${bufferLabel} at offset ${offset}`);
}

function getWriteBufferRecordsAtOffset<T extends ArrayBufferView = Float32Array>(
  gpu: ReturnType<typeof createWebGPUHarness>,
  bufferLabel: string,
  offset: number
): Array<{call: any[]; data: T; order: number}> {
  const calls = gpu.device.queue.writeBuffer.mock.calls;
  const orders = gpu.device.queue.writeBuffer.mock.invocationCallOrder;
  const records: Array<{call: any[]; data: T; order: number}> = [];
  for (let i = 0; i < calls.length; i++) {
    const buffer = calls[i][0] as any;
    if (buffer.descriptor?.label === bufferLabel && calls[i][1] === offset) {
      records.push({
        call: calls[i],
        data: calls[i][2] as T,
        order: orders[i]
      });
    }
  }
  return records;
}

function countWriteBufferCalls(gpu: ReturnType<typeof createWebGPUHarness>, bufferLabel: string): number {
  return gpu.device.queue.writeBuffer.mock.calls.filter((call) => {
    const buffer = call[0] as any;
    return buffer.descriptor?.label === bufferLabel;
  }).length;
}

function getBufferByLabel(gpu: ReturnType<typeof createWebGPUHarness>, bufferLabel: string): any {
  const buffer = gpu.buffers.find((candidate) => candidate.descriptor?.label === bufferLabel);
  if (!buffer) {
    throw new Error(`Expected buffer ${bufferLabel}`);
  }
  return buffer;
}

function createPackedTriangleBatch(
  label: string,
  segmentKey: string,
  vertexBuffer: any,
  vertexMetadataBuffer: any,
  positionDecodeBindGroup: any,
  indexBuffer: any,
  bufferPageKey?: string,
  renderStateKey?: string
): any {
  const indexCountByLabel: {[key: string]: number} = {
    a0: 3,
    a1: 6,
    b0: 9
  };
  return {
    packedBatch: {
      label,
      segmentKey,
      bufferPageKey,
      renderStateKey,
      vertexBuffer,
      vertexMetadataBuffer,
      positionDecodeBindGroup,
      indexBuffer,
      indexFormat: "uint16",
      indexCount: indexCountByLabel[label] ?? 3,
      destroy: jest.fn()
    }
  };
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
      logging: false,
      renderConfigs: {
        transparentSortStrategy: "object"
      }
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
      format: "depth24plus-stencil8",
      usage: 20
    });
    expect(gpu.commandEncoder.beginRenderPass).toHaveBeenCalledTimes(1);
    expect(gpu.passEncoder.end).toHaveBeenCalledTimes(1);
    expect(gpu.device.queue.submit).toHaveBeenCalledWith([gpu.commandBuffer]);
    expect(rendered).toEqual([view]);

    testViewer.onViewUpdated.emit(view, view);

    expect(rendered).toEqual([view, view]);
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
      depthStoreOp: "store",
      stencilClearValue: 0,
      stencilLoadOp: "clear",
      stencilStoreOp: "store"
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
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createShaderModule).toHaveBeenCalledTimes(2);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(2);
    const depthPipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    const colorPipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[1][0] as any;
    expect(depthPipelineDescriptor.label).toBe("xeokit-webgpu-triangles-depth-prepass-pipeline");
    expect(depthPipelineDescriptor.depthStencil).toEqual({
      format: "depth24plus-stencil8",
      depthWriteEnabled: true,
      depthCompare: "less"
    });
    expect(depthPipelineDescriptor.fragment.targets).toEqual([]);
    expect(colorPipelineDescriptor.label).toBe("xeokit-webgpu-triangles-draw-color-no-normals-opaque-pipeline");
    expect(colorPipelineDescriptor.depthStencil).toEqual({
      format: "depth24plus-stencil8",
      depthWriteEnabled: true,
      depthCompare: "less-equal"
    });
    expect(gpu.device.createBuffer).toHaveBeenCalledTimes(12);
    expect(gpu.device.queue.writeBuffer).toHaveBeenCalledTimes(13);
    expect(gpu.passEncoder.setPipeline).toHaveBeenCalledWith(gpu.renderPipeline);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(0, getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0"));
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(1, getBufferByLabel(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0"));
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(2, getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0"));
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(3, getBufferByLabel(gpu, "xeokit-webgpu-packed-materials:triangles:unowned_dynamic_stream_page_0"));
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(4, getBufferByLabel(gpu, "xeokit-webgpu-packed-normals:triangles:unowned_dynamic_stream_page_0"));
    expect(gpu.passEncoder.setIndexBuffer).toHaveBeenCalledWith(getBufferByLabel(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_page_0"), "uint16");
    expect(gpu.passEncoder.setBindGroup).toHaveBeenCalledWith(0, gpu.bindGroup);
    expect(gpu.passEncoder.setBindGroup).toHaveBeenCalledWith(1, gpu.bindGroups[1]);
    expect(gpu.passEncoder.setBindGroup).toHaveBeenCalledWith(2, gpu.bindGroups[2]);
    expect(gpu.passEncoder.setBindGroup).toHaveBeenCalledWith(3, gpu.bindGroups[3]);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);

    expect(colorPipelineDescriptor.vertex.buffers).toEqual([
      {
        arrayStride: 8,
        attributes: [{
          shaderLocation: 0,
          offset: 0,
          format: "unorm16x4"
        }]
      },
      {
        arrayStride: 8,
        attributes: [{
          shaderLocation: 1,
          offset: 0,
          format: "uint32x2"
        }]
      },
      {
        arrayStride: 8,
        attributes: [{
          shaderLocation: 2,
          offset: 0,
          format: "float32x2"
        }]
      },
      {
        arrayStride: 32,
        attributes: [{
          shaderLocation: 3,
          offset: 0,
          format: "float32x4"
        }, {
          shaderLocation: 4,
          offset: 16,
          format: "float32x4"
        }]
      },
      {
        arrayStride: 16,
        attributes: [{
          shaderLocation: 5,
          offset: 0,
          format: "float32x4"
        }]
      }
    ]);

    const positionUpload = getLastWriteBufferData<Uint16Array>(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0");
    expect(Array.from(positionUpload)).toEqual([
      0, 0, 0, 0,
      65535, 0, 0, 0,
      0, 65535, 0, 0
    ]);
    const vertexMetadataUpload = getLastWriteBufferData<Uint32Array>(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0");
    expect(Array.from(vertexMetadataUpload)).toEqual([0, 0, 0, 0, 0, 0]);
    const positionDecodeUpload = getLastWriteBufferData<Float32Array>(gpu, "xeokit-webgpu-triangle-position-decodes:triangles:unowned_dynamic_stream_page_0");
    expect(Array.from(positionDecodeUpload)).toEqual([
      0, 0, 0, 0,
      1, 1, 0, 0
    ]);
    const materialUpload = getLastWriteBufferData<Float32Array>(gpu, "xeokit-webgpu-packed-materials:triangles:unowned_dynamic_stream_page_0");
    expect(Array.from(materialUpload)).toEqual([
      1, 0, 0, 0, 0, 0, 0.5, 0,
      1, 0, 0, 0, 0, 0, 0.5, 0,
      1, 0, 0, 0, 0, 0, 0.5, 0
    ]);
    const normalUpload = getLastWriteBufferData<Float32Array>(gpu, "xeokit-webgpu-packed-normals:triangles:unowned_dynamic_stream_page_0");
    expect(Array.from(normalUpload)).toEqual([
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    ]);
    const instanceWrite = getLastWriteBufferCall(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceWrite[4]).toBe(INSTANCE_FLOATS);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(Array.from(instanceUpload.slice(0, 16))).toEqual(mesh.worldMatrix);
    expect(instanceUpload[16]).toBeCloseTo(0.5);
    expect(instanceUpload[17]).toBeCloseTo(0.6);
    expect(instanceUpload[18]).toBeCloseTo(0.7);
    expect(instanceUpload[19]).toBeCloseTo(1);
    expect(instanceUpload[20]).toBeCloseTo(1);
    expect(instanceUpload[21]).toBeCloseTo(0);
    const frameUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-frame-uniforms");
    expect(Array.from(frameUpload.slice(0, 16))).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0.5, 0,
      0, 0, 0.5, 1
    ]);
    expect(Array.from(frameUpload.slice(AMBIENT_LIGHT_UNIFORM_OFFSET, AMBIENT_LIGHT_UNIFORM_OFFSET + 4))).toEqual([
      0.5, 0.5, 0.5, 1
    ]);

    renderer.detachViewer();

    for (const buffer of gpu.buffers) {
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
    }
  });

  test("renders procedural sky before scene geometry when the view sky effect is applied", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

    view.effects = {
      sky: {
        applied: true,
        skyColor: [0.1, 0.2, 0.7],
        horizonColor: [0.6, 0.7, 0.8],
        groundColor: [0.2, 0.25, 0.22],
        horizonBlend: 0.35,
        sunEnabled: true,
        sunDirection: [2, 0, 0],
        sunColor: [1, 0.9, 0.7],
        sunAngularSize: 4,
        sunGlowSize: 18,
        sunGlowIntensity: 0.3,
        worldUp: [0, 0, 1]
      }
    };
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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createShaderModule).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-sky-shader"
    }));
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-sky-pipeline",
      fragment: expect.objectContaining({
        targets: [{format: "rgba8unorm"}]
      }),
      depthStencil: {
        format: "depth24plus-stencil8",
        depthWriteEnabled: false,
        depthCompare: "always"
      },
      primitive: {
        topology: "triangle-strip",
        cullMode: "none"
      }
    }));

    const skyUniformWrites = getWriteBufferRecordsAtOffset<Float32Array>(gpu, "xeokit-webgpu-sky-uniforms", 0);
    expect(skyUniformWrites).toHaveLength(1);
    expect(skyUniformWrites[0].data.length).toBe(48);
    expect(skyUniformWrites[0].data[20]).toBeCloseTo(0.1);
    expect(skyUniformWrites[0].data[21]).toBeCloseTo(0.2);
    expect(skyUniformWrites[0].data[22]).toBeCloseTo(0.7);
    expect(Array.from(skyUniformWrites[0].data.slice(32, 35))).toEqual([1, 0, 0]);
    expect(skyUniformWrites[0].data[40]).toBeCloseTo(0.35);
    expect(skyUniformWrites[0].data[44]).toBe(1);
    expect(gpu.passEncoder.draw).toHaveBeenCalledWith(4, 1, 0, 0);

    const skyPipelineIndex = gpu.device.createRenderPipeline.mock.calls.findIndex((call) =>
      (call[0] as any).label === "xeokit-webgpu-sky-pipeline"
    );
    const colorPipelineIndex = gpu.device.createRenderPipeline.mock.calls.findIndex((call) =>
      (call[0] as any).label === "xeokit-webgpu-triangles-draw-color-no-normals-opaque-pipeline"
    );
    expect(skyPipelineIndex).toBeGreaterThan(-1);
    expect(colorPipelineIndex).toBeGreaterThan(skyPipelineIndex);
  });

  test("renders the infinite grid when enabled through the WebGPU renderer", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.camera.eye = [10, 20, 30];
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const gridResult = renderer.setInfiniteGridEnabled(true);
    expect(gridResult.ok).toBe(true);
    expect(gpu.device.createShaderModule).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-infinite-grid-shader"
    }));
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-infinite-grid-pipeline",
      fragment: expect.objectContaining({
        targets: [expect.objectContaining({
          format: "rgba8unorm",
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        })]
      }),
      depthStencil: {
        format: "depth24plus-stencil8",
        depthWriteEnabled: false,
        depthCompare: "less-equal"
      },
      primitive: {
        topology: "triangle-strip",
        cullMode: "none"
      }
    }));

    const gridUniformWrites = getWriteBufferRecordsAtOffset<Float32Array>(gpu, "xeokit-webgpu-infinite-grid-uniforms", 0);
    expect(gridUniformWrites).toHaveLength(1);
    expect(gridUniformWrites[0].data.length).toBe(56);
    expect(gridUniformWrites[0].data[18]).toBeCloseTo(-30);
    expect(gridUniformWrites[0].data[48]).toBeCloseTo(1000);
    expect(gridUniformWrites[0].data[49]).toBeCloseTo(1);
    expect(gridUniformWrites[0].data[50]).toBeCloseTo(10);
    expect(gridUniformWrites[0].data[51]).toBeCloseTo(0.06);
    expect(gridUniformWrites[0].data[52]).toBeCloseTo(80);
    expect(gridUniformWrites[0].data[53]).toBeCloseTo(500);
    expect(gpu.passEncoder.draw).toHaveBeenCalledWith(4, 1, 0, 0);
  });

  test("uploads and binds textured triangle meshes with packed UVs", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const imageData = {
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 0, 255, 255,
        255, 255, 255, 255
      ]),
      width: 2,
      height: 2
    };
    const sceneTexture = {
      id: "albedo",
      model: {id: "model"},
      imageData,
      image: null,
      width: 2,
      height: 2,
      compressed: false,
      destroyed: false,
      magFilter: LinearFilter,
      minFilter: LinearMipMapNearestFilter,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      flipY: false,
      encoding: sRGBEncoding
    };
    geometry.uvsCompressed = new Float32Array([
      0, 0,
      1, 0,
      0, 1
    ]);
    mesh.effectiveColorTexture = sceneTexture;

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createTexture).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-scene-texture:model:albedo",
      size: {width: 2, height: 2, depthOrArrayLayers: 1},
      format: "rgba8unorm-srgb"
    }));
    expect(gpu.device.queue.writeTexture).toHaveBeenCalledWith(
      {texture: expect.objectContaining({descriptor: expect.objectContaining({label: "xeokit-webgpu-scene-texture:model:albedo"})})},
      imageData.data,
      {bytesPerRow: 8, rowsPerImage: 2},
      {width: 2, height: 2, depthOrArrayLayers: 1}
    );
    const uvBuffer = gpu.buffers.find((candidate) => {
      return candidate.descriptor?.label?.startsWith("xeokit-webgpu-packed-uvs:triangles:unowned_dynamic_stream_texture_model_albedo_2x2_");
    });
    expect(uvBuffer).toBeDefined();
    expect(Array.from(getLastWriteBufferData<Float32Array>(gpu, uvBuffer.descriptor.label))).toEqual([
      0, 0,
      1, 0,
      0, 1
    ]);
    const materialBuffer = gpu.buffers.find((candidate) => {
      return candidate.descriptor?.label?.startsWith("xeokit-webgpu-packed-materials:triangles:unowned_dynamic_stream_texture_model_albedo_2x2_");
    });
    expect(materialBuffer).toBeDefined();
    const materialUpload = getLastWriteBufferData<Float32Array>(gpu, materialBuffer.descriptor.label);
    expect(materialUpload[7]).toBe(-1);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(2, uvBuffer);
    expect(gpu.passEncoder.setBindGroup).toHaveBeenCalledWith(2, expect.any(Object));
  });

  test("updates same-sized scene texture image data without destroying the WebGPU texture", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const imageData = {
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 0, 255, 255,
        255, 255, 255, 255
      ]),
      width: 2,
      height: 2
    };
    const sceneTexture = {
      id: "animatedAlbedo",
      model: {id: "model"},
      imageData,
      image: null,
      width: 2,
      height: 2,
      compressed: false,
      destroyed: false,
      magFilter: LinearFilter,
      minFilter: LinearMipMapNearestFilter,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      flipY: false,
      encoding: sRGBEncoding
    };
    geometry.uvsCompressed = new Float32Array([
      0, 0,
      1, 0,
      0, 1
    ]);
    mesh.effectiveColorTexture = sceneTexture;

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    const gpuTexture = gpu.depthTextures.find((texture: any) =>
      texture.descriptor?.label === "xeokit-webgpu-scene-texture:model:animatedAlbedo");
    expect(gpuTexture).toBeDefined();
    expect(gpuTexture.destroy).not.toHaveBeenCalled();

    imageData.data.fill(64);
    testViewer.onSceneTextureImageDataChanged.emit(testViewer.viewer.scene, sceneTexture);

    expect(gpuTexture.destroy).not.toHaveBeenCalled();
    expect(gpu.device.createTexture.mock.calls.filter((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-scene-texture:model:animatedAlbedo")).toHaveLength(1);
    expect(gpu.device.queue.writeTexture).toHaveBeenLastCalledWith(
      {texture: gpuTexture},
      imageData.data,
      {bytesPerRow: 8, rowsPerImage: 2},
      {width: 2, height: 2, depthOrArrayLayers: 1}
    );
  });

  test("renders sized round point meshes and exposes them to async picking", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createPointMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "gpuPickedPointObject");

    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);

    expect(attachResult.ok).toBe(true);
    expect(gpu.device.createRenderPipeline.mock.calls.some((call) => {
      return call[0]?.label === "xeokit-webgpu-points-draw-color-opaque-pipeline";
    })).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(12, 1, 0, 0, 0);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(
      0,
      getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_primitive_20000_page_0")
    );
    expect(gpu.passEncoder.setIndexBuffer).toHaveBeenCalledWith(
      getBufferByLabel(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_primitive_20000_page_0"),
      "uint16"
    );
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(
      2,
      getBufferByLabel(gpu, "xeokit-webgpu-packed-colors:points:unowned_dynamic_stream_primitive_20000_page_0")
    );
    const colorUpload = getLastWriteBufferData<Uint8Array>(gpu, "xeokit-webgpu-packed-colors:points:unowned_dynamic_stream_primitive_20000_page_0");
    expect(Array.from(colorUpload.slice(0, 24))).toEqual([
      255, 128, 0, 255,
      255, 128, 0, 255,
      255, 128, 0, 255,
      255, 128, 0, 255,
      255, 128, 0, 255,
      255, 128, 0, 255
    ]);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {
      canvasPos: [25, 25]
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneMesh).toBe(mesh);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
    expect(pickResult.value?.viewObject).toBe(viewObject);
    expect(gpu.device.createRenderPipeline.mock.calls.some((call) => {
      return call[0]?.label === "xeokit-webgpu-points-pick-pipeline";
    })).toBe(true);
  });

  test("renders thick line segment meshes and exposes them to async picking", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createLineMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "gpuPickedLineObject");

    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);

    expect(attachResult.ok).toBe(true);
    expect(gpu.device.createRenderPipeline.mock.calls.some((call) => {
      return call[0]?.label === "xeokit-webgpu-lines-draw-color-opaque-pipeline";
    })).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(6, 1, 0, 0, 0);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(
      0,
      getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_primitive_20001_page_0")
    );
    expect(gpu.passEncoder.setIndexBuffer).toHaveBeenCalledWith(
      getBufferByLabel(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_primitive_20001_page_0"),
      "uint16"
    );
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(
      2,
      getBufferByLabel(gpu, "xeokit-webgpu-packed-colors:lines:unowned_dynamic_stream_primitive_20001_page_0")
    );
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(
      3,
      getBufferByLabel(gpu, "xeokit-webgpu-packed-line-other-positions:lines:unowned_dynamic_stream_primitive_20001_page_0")
    );

    const colorUpload = getLastWriteBufferData<Uint8Array>(gpu, "xeokit-webgpu-packed-colors:lines:unowned_dynamic_stream_primitive_20001_page_0");
    expect(Array.from(colorUpload.slice(0, 24))).toEqual([
      32, 200, 255, 255,
      255, 64, 32, 255,
      255, 64, 32, 255,
      32, 200, 255, 255,
      255, 64, 32, 255,
      32, 200, 255, 255
    ]);
    const otherUpload = getLastWriteBufferData<Uint16Array>(gpu, "xeokit-webgpu-packed-line-other-positions:lines:unowned_dynamic_stream_primitive_20001_page_0");
    expect(Array.from(otherUpload.slice(0, 24))).toEqual([
      65535, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      65535, 0, 0, 0,
      0, 0, 0, 0,
      65535, 0, 0, 0
    ]);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {
      canvasPos: [25, 25]
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneMesh).toBe(mesh);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
    expect(pickResult.value?.viewObject).toBe(viewObject);
    expect(gpu.device.createRenderPipeline.mock.calls.some((call) => {
      return call[0]?.label === "xeokit-webgpu-lines-pick-pipeline";
    })).toBe(true);
  });

  test("renders gaussian splat meshes and exposes them to async picking", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createSplatMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "gpuPickedSplatObject");

    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);

    expect(attachResult.ok).toBe(true);
    expect(gpu.device.createRenderPipeline.mock.calls.some((call) => {
      return call[0]?.label === "xeokit-webgpu-splats-draw-color-pipeline";
    })).toBe(true);
    expect(gpu.passEncoder.draw).toHaveBeenCalledWith(6, 2, 0, 0);
    const cpuPickResult = renderer.pick(view as any, {
      canvasPos: [25, 25]
    });
    expect(cpuPickResult.ok).toBe(true);
    expect(cpuPickResult.value).toBeNull();
    const splatUpload = getLastWriteBufferData<Float32Array>(gpu, "xeokit-webgpu-splat-data");
    expect(splatUpload[0]).toBeCloseTo(0);
    expect(splatUpload[1]).toBeCloseTo(0);
    expect(splatUpload[2]).toBeCloseTo(-2);
    expect(splatUpload[3]).toBeCloseTo(1);
    expect(splatUpload[4]).toBeCloseTo(1);
    expect(splatUpload[5]).toBeCloseTo(128 / 255);
    expect(splatUpload[6]).toBeCloseTo(0);
    expect(splatUpload[7]).toBeCloseTo(0);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {
      canvasPos: [25, 25]
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneMesh).toBe(mesh);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
    expect(pickResult.value?.viewObject).toBe(viewObject);
    expect(gpu.device.createRenderPipeline.mock.calls.some((call) => {
      return call[0]?.label === "xeokit-webgpu-splats-pick-pipeline";
    })).toBe(true);
  });

  test("uploads WebGPU mesh instances relative to RTC tiles", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();
    mesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000000, 300, 0, 1];

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[12]).toBeCloseTo(0);
    expect(instanceUpload[13]).toBeCloseTo(-100);
    expect(instanceUpload[14]).toBeCloseTo(0);
    expect(instanceUpload[21]).toBeCloseTo(1);

    const tileUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-rtc-tile-buffer");
    expect(tileUpload[16]).toBeCloseTo(1000000);
    expect(tileUpload[17]).toBeCloseTo(400);
    expect(tileUpload[18]).toBeCloseTo(0);

    mesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000400, 300, 0, 1];
    testViewer.onSceneMeshMatrixChanged.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    const movedInstanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(movedInstanceUpload[12]).toBeCloseTo(0);
    expect(movedInstanceUpload[13]).toBeCloseTo(-100);
    expect(movedInstanceUpload[14]).toBeCloseTo(0);
    expect(movedInstanceUpload[21]).toBeCloseTo(1);

    const movedTileUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-rtc-tile-buffer");
    expect(movedTileUpload[16]).toBeCloseTo(1000400);
    expect(movedTileUpload[17]).toBeCloseTo(400);
    expect(movedTileUpload[18]).toBeCloseTo(0);

    renderer.detachViewer();
  });

  test("uploads ambient and directional lights to WebGPU frame uniforms", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.lightsList = [{
      color: [0.1, 0.2, 0.3],
      intensity: 0.4
    }, {
      dir: [0, 0, -2],
      color: [1, 0.5, 0.25],
      intensity: 0.8,
      space: "world"
    }, {
      dir: [0, 3, 0],
      color: [0.25, 0.75, 1],
      intensity: 0.6,
      space: "view"
    }];
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const frameUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-frame-uniforms");
    expect(Array.from(frameUpload.slice(AMBIENT_LIGHT_UNIFORM_OFFSET, AMBIENT_LIGHT_UNIFORM_OFFSET + 4))).toEqual([
      0.10000000149011612, 0.20000000298023224, 0.30000001192092896, 0.4000000059604645
    ]);
    expect(Array.from(frameUpload.slice(DIR_LIGHT_DIRECTION_UNIFORM_OFFSET, DIR_LIGHT_DIRECTION_UNIFORM_OFFSET + 12))).toEqual([
      0, 0, -1, 0,
      0, 1, 0, 0,
      0, 1, 1, 0
    ]);
    expect(Array.from(frameUpload.slice(DIR_LIGHT_COLOR_UNIFORM_OFFSET, DIR_LIGHT_COLOR_UNIFORM_OFFSET + 12))).toEqual([
      1, 0.5, 0.25, 0.800000011920929,
      0.25, 0.75, 1, 0.6000000238418579,
      0, 0, 0, 0
    ]);
  });

  test("uploads hemisphere ambient to WebGPU frame uniforms", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.lights = {
      hemispheric: {
        applied: true,
        possible: true,
        intensity: 0.35,
        skyColor: [0.6, 0.7, 0.8],
        groundColor: [0.2, 0.25, 0.3],
        worldUp: [0, 0, 2]
      }
    };
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const frameUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-frame-uniforms");
    expect(Array.from(frameUpload.slice(HEMISPHERE_SKY_UNIFORM_OFFSET, HEMISPHERE_SKY_UNIFORM_OFFSET + 4))).toEqual([
      0.6000000238418579, 0.699999988079071, 0.800000011920929, 0.3499999940395355
    ]);
    expect(Array.from(frameUpload.slice(HEMISPHERE_GROUND_UNIFORM_OFFSET, HEMISPHERE_GROUND_UNIFORM_OFFSET + 4))).toEqual([
      0.20000000298023224, 0.25, 0.30000001192092896, 0
    ]);
    expect(Array.from(frameUpload.slice(HEMISPHERE_UP_UNIFORM_OFFSET, HEMISPHERE_UP_UNIFORM_OFFSET + 4))).toEqual([
      0, 0, 1, 0
    ]);
  });

  test("uploads inverse-transpose normal matrix for authored triangle normals", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMeshWithNormals();
    mesh.worldMatrix = [
      2.7, 0, 0, 0,
      0, 2.0, 0, 0,
      0, 0, 0.06, 0,
      0, 0, 0, 1
    ];

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
      logging: false,
      renderConfigs: {
        depthPrepass: false
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[24]).toBeCloseTo(1 / 2.7);
    expect(instanceUpload[25]).toBeCloseTo(0);
    expect(instanceUpload[26]).toBeCloseTo(0);
    expect(instanceUpload[28]).toBeCloseTo(0);
    expect(instanceUpload[29]).toBeCloseTo(1 / 2.0);
    expect(instanceUpload[30]).toBeCloseTo(0);
    expect(instanceUpload[32]).toBeCloseTo(0);
    expect(instanceUpload[33]).toBeCloseTo(0);
    expect(instanceUpload[34]).toBeCloseTo(1 / 0.06);

    const triangleShader = gpu.device.createShaderModule.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-triangles-draw-color-shader"
    )?.[0] as any;
    expect(triangleShader?.code).toContain("dot(instance.normalMatrix0.xyz, input.normal.xyz)");
    expect(triangleShader?.code).toContain("if (dot(normalView, viewPosForIBL) > 0.0)");
    expect(triangleShader?.code).toContain("fn perturbNormalTriplanar");
    expect(triangleShader?.code).toContain("let useUVTextures = textureMode < 0.0");
    expect(triangleShader?.code).toContain("let uvNormal = perturbNormal(input, normal, uv)");
    expect(triangleShader?.code).toContain("normal = select(normal, uvNormal, useUVTextures)");
    expect(triangleShader?.code).toContain("normal = perturbNormalTriplanar(input.worldPos, normal, triplanarScale)");
    expect(triangleShader?.code).not.toContain("nmX.y = -nmX.y");
    expect(triangleShader?.code).not.toContain("nmY.y = -nmY.y");
    expect(triangleShader?.code).not.toContain("nmZ.y = -nmZ.y");

    renderer.detachViewer();
  });

  test("renders WebGPU directional shadow cascades for opaque triangles", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMeshWithNormals();

    view.camera.eye = [0, 0, 5];
    view.camera.look = [0, 0, 0];
    view.camera.up = [0, 1, 0];
    view.camera.projectionType = PerspectiveProjectionType;
    view.camera.perspectiveProjection = {
      fov: 60,
      far: 1000
    };
    view.effects = {
      shadows: {
        applied: true,
        possible: true,
        intensity: 0.4,
        bias: 0.002,
        normalOffsetBias: 0.01,
        resolution: 512,
        direction: [-0.5, -1, -0.3],
        autoFit: true,
        maxDistance: 80,
        lightDistance: 100,
        projectionSize: 30,
        padding: 1.1,
        cascadeCount: 4,
        cascadeSplitLambda: 0.5
      }
    };

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
    expect(gpu.device.createTexture).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-shadow-depth-texture",
      format: "depth32float",
      size: {
        width: 512,
        height: 512,
        depthOrArrayLayers: 4
      }
    }));
    const shadowTexture = gpu.depthTextures.find((texture: any) =>
      texture.descriptor?.label === "xeokit-webgpu-shadow-depth-texture"
    );
    expect(shadowTexture?.createView).toHaveBeenCalledWith(expect.objectContaining({
      dimension: "2d-array",
      arrayLayerCount: 4
    }));
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(3);
    expect((gpu.device.createRenderPipeline.mock.calls[0][0] as any).label).toBe("xeokit-webgpu-triangles-shadow-depth-pipeline");
    expect((gpu.device.createRenderPipeline.mock.calls[1][0] as any).label).toBe("xeokit-webgpu-triangles-depth-prepass-pipeline");
    expect((gpu.device.createRenderPipeline.mock.calls[2][0] as any).label).toBe("xeokit-webgpu-triangles-draw-color-opaque-pipeline");
    const shadowPipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    expect(shadowPipelineDescriptor.depthStencil).toEqual({
      format: "depth32float",
      depthWriteEnabled: true,
      depthCompare: "less"
    });
    expect(shadowPipelineDescriptor.primitive.cullMode).toBe("front");
    expect(gpu.device.createSampler).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-shadow-comparison-sampler",
      compare: "less"
    }));
    const colorShader = gpu.device.createShaderModule.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-triangles-draw-color-shader"
    )?.[0] as any;
    expect(colorShader.code).toContain("var shadowSampler: sampler_comparison");
    expect(colorShader.code).toContain("vec2<f32>(shadowNdc.x * 0.5 + 0.5, 0.5 - shadowNdc.y * 0.5)");
    expect(colorShader.code).toContain("shadow.lightDirection.w * slopeFactor");
    expect(colorShader.code).toContain("var shadowMap: texture_depth_2d_array");
    expect(colorShader.code).toContain("textureLoad(shadowMap, texelCoord, cascade, 0)");
    expect(colorShader.code).toContain("textureSampleCompareLevel(shadowMap, shadowSampler, shadowUV, cascade, refDepth)");
    expect(colorShader.code).toContain("debug: vec4<f32>");
    expect(colorShader.code).toContain("cameraView: mat4x4<f32>");
    expect(colorShader.code).toContain("lightViewProjections: array<mat4x4<f32>, 6>");
    expect(colorShader.code).toContain("selectShadowCascade(-viewPos.z)");
    expect(colorShader.code).toContain("let shadowOffset = shadow.lightViewProjections[cascade] * vec4<f32>(viewNormal * shadow.params.w, 0.0)");
    expect(colorShader.code).toContain("let lightDirView = normalize((shadow.cameraView * vec4<f32>(shadow.lightDirection.xyz, 0.0)).xyz)");
    expect(colorShader.code).toContain("shadow.debug.x > 0.5");
    expect(colorShader.code).toContain("textureSampleCompareLevel(shadowMap, shadowSampler");
    expect(colorShader.code).toContain("var iblSampler: sampler");
    expect(colorShader.code).toContain("var iblIrradianceCubemap: texture_cube<f32>");
    expect(colorShader.code).toContain("var iblPrefilteredCubemap: texture_cube<f32>");
    expect(colorShader.code).toContain("var iblBRDFLUT: texture_2d<f32>");
    expect(colorShader.code).toContain("let viewDirView = normalize(-viewPosForIBL)");
    expect(colorShader.code).toContain("let faceNormalView = normalize((frame.viewMatrix * vec4<f32>(faceNormal, 0.0)).xyz)");
    expect(colorShader.code).toContain("let viewPosForIBL = (frame.viewMatrix * vec4<f32>(input.worldPos, 1.0)).xyz");
    expect(colorShader.code).toContain("let viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz)");
    expect(colorShader.code).toContain("let lightDir = normalize((frame.viewMatrix * vec4<f32>(frame.dirLightDirections[i].xyz, 0.0)).xyz)");
    expect(colorShader.code).toContain("ibl.viewToWorld0.xyz * dir.x");
    expect(colorShader.code).toContain("let worldViewDir = viewToWorldDirection(viewDirView)");
    expect(colorShader.code).toContain("let tangentSample = vec3<f32>(tangentSampleRaw.x, -tangentSampleRaw.y, tangentSampleRaw.z)");
    expect(colorShader.code).toContain("let viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz)");
    expect(colorShader.code).toContain("let viewPos = (frame.viewMatrix * vec4<f32>(input.rtcPos, 1.0)).xyz");
    expect(colorShader.code).toContain("let perturbedViewNormal = normalize(tbn * tangentSample)");
    expect(colorShader.code).toContain("return normalize(transpose(viewRotation) * perturbedViewNormal)");
    expect(colorShader.code).toContain("let xUV = vec2<f32>(p.y, -p.z)");
    expect(colorShader.code).toContain("let yUV = vec2<f32>(p.x, -p.z)");
    expect(colorShader.code).toContain("let zUV = vec2<f32>(p.x, -p.y)");
    expect(colorShader.code).toContain("let iblSpec = iblSpecEnv * (f0 * brdfLUT.x + brdfLUT.y)");
    expect(colorShader.code).toContain("let iblIntensity = max(ibl.params.x, 0.0)");
    expect(colorShader.code).toContain("let ambientScale = mix(1.0, 0.75, clamp(iblIntensity, 0.0, 1.0))");
    expect(colorShader.code).toContain("let flatAmbientColor = frame.ambientLight.rgb * frame.ambientLight.a * ambientScale * baseColor * ao");
    expect(colorShader.code).toContain("let hemisphereAmbient = mix(frame.hemisphereGround.rgb, frame.hemisphereSky.rgb, hemisphereFacing)");
    expect(colorShader.code).toContain("let ambientColor = flatAmbientColor + hemisphereColor");
    expect(colorShader.code).toContain("let iblColor = (iblDiff + iblSpec) * iblIntensity * ao");
    expect(colorShader.code).toContain("let litColor = ambientColor + iblColor + directColor * shadowFactor + emissive");
    expect(gpu.device.createTexture).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-ibl-placeholder-irradiance-cubemap",
      format: "rgba16float"
    }));
    expect(gpu.device.queue.writeTexture).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.objectContaining({z: 0})
      }),
      expect.any(Uint16Array),
      expect.objectContaining({
        bytesPerRow: 8
      }),
      expect.objectContaining({
        width: 1,
        height: 1,
        depthOrArrayLayers: 1
      })
    );
    const shadowUniforms = getLastWriteBufferData(gpu, "xeokit-webgpu-shadow-uniforms");
    expect(shadowUniforms[99]).toBeCloseTo(0.01);
    expect(shadowUniforms[104]).toBe(0);
    expect(shadowUniforms[105]).toBe(4);
    expect(shadowUniforms[108]).toBeCloseTo(view.camera.viewMatrix[0]);
    expect(shadowUniforms[123]).toBeCloseTo(view.camera.viewMatrix[15]);
    expect(shadowUniforms[124]).toBeGreaterThan(0.1);
    expect(shadowUniforms[126]).toBeLessThanOrEqual(80);
    expect(gpu.commandEncoder.beginRenderPass).toHaveBeenCalledTimes(6);
    expect(gpu.device.createCommandEncoder).toHaveBeenCalledTimes(5);
    expect(gpu.device.queue.submit).toHaveBeenCalledTimes(5);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(6);
  });

  test("uses Lambert lighting without IBL for no-normal triangle shader", () => {
    const shader = createTrianglesDrawColorNoNormalsShader();

    expect(shader).toContain("let dpdxRTC = dpdx(input.rtcPos)");
    expect(shader).toContain("let dpdyRTC = dpdy(input.rtcPos)");
    expect(shader).toContain("let useUVTexture = textureMode < -0.5");
    expect(shader).toContain("var baseColorSample = vec4<f32>(1.0, 1.0, 1.0, 1.0)");
    expect(shader).toContain("var emissiveSample = vec4<f32>(0.0, 0.0, 0.0, 1.0)");
    expect(shader).toContain("var aoSample = vec4<f32>(1.0, 1.0, 1.0, 1.0)");
    expect(shader).toContain("directColor += baseColor * lightColor.rgb * lightColor.a * lambertian");
    expect(shader).toContain("let litColor = max(ambientColor + directColor * shadowFactor + emissive, ambientColor + emissive)");
    expect(shader).toContain("var shadowMap: texture_depth_2d_array");
    expect(shader).not.toContain("IBLUniforms");
    expect(shader).not.toContain("iblIrradianceCubemap");
    expect(shader).not.toContain("iblPrefilteredCubemap");
    expect(shader).not.toContain("iblBRDFLUT");
    expect(shader).not.toContain("distributionGGX");
    expect(shader).not.toContain("geometrySmith");
    expect(shader).not.toContain("fresnelSchlick");
  });

  test("submits WebGPU shadow cascades with RTC tile matrices before rewriting them", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();
    mesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000000, 300, 0, 1];

    view.camera.eye = [1000000, 300, 20];
    view.camera.look = [1000001, 301, 0];
    view.camera.up = [0, 0, 1];
    view.camera.projectionType = PerspectiveProjectionType;
    view.camera.perspectiveProjection = {
      fov: 60,
      far: 1000
    };
    view.effects = {
      shadows: {
        applied: true,
        possible: true,
        intensity: 0.4,
        bias: 0.002,
        normalOffsetBias: 0.01,
        resolution: 512,
        direction: [-0.5, -1, -0.3],
        autoFit: true,
        maxDistance: 80,
        lightDistance: 100,
        projectionSize: 30,
        padding: 1.1,
        cascadeCount: 4,
        cascadeSplitLambda: 0.5
      }
    };

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

    const rtcTileWrites = getWriteBufferRecordsAtOffset(gpu, "xeokit-webgpu-rtc-tile-buffer", RTC_TILE_BYTES);
    expect(rtcTileWrites.length).toBeGreaterThanOrEqual(6);
    for (const record of rtcTileWrites) {
      expect(record.data[16]).toBeCloseTo(1000000);
      expect(record.data[17]).toBeCloseTo(400);
      expect(record.data[18]).toBeCloseTo(0);
    }

    const submitOrders = gpu.device.queue.submit.mock.invocationCallOrder;
    expect(submitOrders).toHaveLength(5);
    for (let cascade = 0; cascade < 4; cascade++) {
      const cascadeTileWrite = rtcTileWrites[cascade + 1];
      expect(submitOrders[cascade]).toBeGreaterThan(cascadeTileWrite.order);
      if (cascade < 3) {
        expect(submitOrders[cascade]).toBeLessThan(rtcTileWrites[cascade + 2].order);
      }
    }
  });

  test("routes active WebGPU View FX through post-process target and composite pass", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

    view.renderMode = DetailedRender;
    view.effects = {
      tonemap: {
        applied: true,
        possible: true,
        exposure: 0.75,
        mode: "aces",
        sRGBEncode: true
      },
      antiAliasing: {
        applied: true,
        possible: true,
        mode: "fxaa"
      },
      sao: {
        applied: true,
        possible: true,
        intensity: 0.35,
        kernelRadius: 90,
        bias: 0.5,
        scale: 1,
        minResolution: 0,
        blendFactor: 1,
        blendCutoff: 0.3,
        numSamples: 12
      }
    };
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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createTexture).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-postprocess-scene-color",
      format: "rgba16float",
      usage: 21
    }));
    const hdrTrianglePipeline = gpu.device.createRenderPipeline.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-triangles-draw-color-no-normals-opaque-pipeline"
    )?.[0] as any;
    expect(hdrTrianglePipeline?.fragment.targets[0].format).toBe("rgba16float");
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-postprocess-pipeline"
    }));
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-sao-occlusion-pipeline"
    }));
    const postProcessShader = gpu.device.createShaderModule.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-postprocess-shader"
    )?.[0] as any;
    expect(postProcessShader?.code).toContain("0.5 - pos.y * 0.5");
    expect(postProcessShader?.code).toContain("color = color * select(1.0, saoFactor, params.saoEnabled > 0.5)");
    expect(postProcessShader?.code).not.toContain("return 0.5;");
    expect(postProcessShader?.code).not.toContain("color = vec3<f32>(params.saoEnabled)");
    const saoOcclusionShader = gpu.device.createShaderModule.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-sao-occlusion-shader"
    )?.[0] as any;
    expect(saoOcclusionShader?.code).toContain("cross(dpdy(centerViewPosition), dpdx(centerViewPosition))");
    expect(gpu.device.createBindGroupLayout).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-postprocess-bind-group-layout",
      entries: expect.arrayContaining([
        expect.objectContaining({
          binding: 3,
          texture: expect.objectContaining({
            sampleType: "float"
          })
        })
      ])
    }));
    expect(gpu.device.createBindGroupLayout).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-sao-occlusion-bind-group-layout",
      entries: expect.arrayContaining([
        expect.objectContaining({
          binding: 1,
          texture: expect.objectContaining({
            sampleType: "depth"
          })
        })
      ])
    }));
    expect(gpu.device.createSampler).toHaveBeenCalledWith(expect.objectContaining({
      label: "xeokit-webgpu-postprocess-sampler",
      magFilter: "linear",
      minFilter: "linear"
    }));
    expect(gpu.commandEncoder.beginRenderPass).toHaveBeenCalled();
    const scenePass = gpu.commandEncoder.beginRenderPass.mock.calls[1][0] as any;
    expect(scenePass.colorAttachments[0].view).toBe(gpu.depthTextureView);
  });

  test("routes sRGB encode through post-process when tonemap curve is inactive", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

    view.effects = {
      tonemap: {
        applied: false,
        possible: true,
        exposure: 0.5,
        mode: "aces",
        sRGBEncode: true
      },
      antiAliasing: {
        applied: false,
        possible: true,
        mode: "none"
      },
      sao: {
        applied: false,
        possible: true,
        intensity: 0
      }
    };
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
      contextFormat: "bgra8unorm",
      logging: false,
      renderConfigs: {
        depthPrepass: false
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    const scenePipeline = gpu.device.createRenderPipeline.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-triangles-draw-color-no-normals-opaque-pipeline"
    )?.[0] as any;
    expect(scenePipeline?.fragment.targets[0].format).toBe("rgba16float");
    const postProcessPipeline = gpu.device.createRenderPipeline.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-postprocess-pipeline"
    )?.[0] as any;
    expect(postProcessPipeline?.fragment.targets[0].format).toBe("bgra8unorm");

    const postProcessParams = getLastWriteBufferData<Float32Array>(gpu, "xeokit-webgpu-postprocess-params");
    expect(postProcessParams[2]).toBe(1);
    expect(postProcessParams[3]).toBe(0);
    expect(postProcessParams[4]).toBe(1);
    expect(postProcessParams[5]).toBe(0);
    expect(postProcessParams[6]).toBe(0);
  });

  test("assigns multiple WebGPU mesh instances to independent RTC tile matrices", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: westMesh} = createTriangleMesh("westMesh");
    const {mesh: eastMesh} = createTriangleMesh("eastMesh");
    westMesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000000, 300, 0, 1];
    eastMesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000400, 300, 0, 1];

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [westMesh.id]: westMesh,
          [eastMesh.id]: eastMesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[12]).toBeCloseTo(0);
    expect(instanceUpload[13]).toBeCloseTo(-100);
    expect(instanceUpload[14]).toBeCloseTo(0);
    expect(instanceUpload[21]).toBeCloseTo(1);
    expect(instanceUpload[INSTANCE_FLOATS + 12]).toBeCloseTo(0);
    expect(instanceUpload[INSTANCE_FLOATS + 13]).toBeCloseTo(-100);
    expect(instanceUpload[INSTANCE_FLOATS + 14]).toBeCloseTo(0);
    expect(instanceUpload[INSTANCE_FLOATS + 21]).toBeCloseTo(2);

    const westTileUpload = getLastWriteBufferDataAtOffset(gpu, "xeokit-webgpu-rtc-tile-buffer", RTC_TILE_BYTES);
    expect(westTileUpload[16]).toBeCloseTo(1000000);
    expect(westTileUpload[17]).toBeCloseTo(400);
    expect(westTileUpload[18]).toBeCloseTo(0);

    const eastTileUpload = getLastWriteBufferDataAtOffset(gpu, "xeokit-webgpu-rtc-tile-buffer", RTC_TILE_BYTES * 2);
    expect(eastTileUpload[16]).toBeCloseTo(1000400);
    expect(eastTileUpload[17]).toBeCloseTo(400);
    expect(eastTileUpload[18]).toBeCloseTo(0);

    renderer.detachViewer();
  });

  test("falls back to origin RTC tile when WebGPU RTC tile capacity is exhausted", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const meshes: any = {};

    for (let i = 0; i < 3; i++) {
      const {geometry, mesh} = createTriangleMesh(`mesh${i}`);
      geometry.id = `geometry${i}`;
      geometry.uniqueId = `model__geometry${i}`;
      mesh.geometry = geometry;
      mesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000000 + i * 400, 300, 0, 1];
      meshes[mesh.id] = mesh;
    }

    testViewer.viewer.scene.models = {
      model: {
        meshes
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxTiles: 2
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;
    testViewer.onViewUpdated.emit(view, view);

    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[21]).toBeCloseTo(1);
    expect(instanceUpload[INSTANCE_FLOATS + 12]).toBeCloseTo(1000400);
    expect(instanceUpload[INSTANCE_FLOATS + 21]).toBeCloseTo(0);
    expect(instanceUpload[INSTANCE_FLOATS * 2 + 12]).toBeCloseTo(1000800);
    expect(instanceUpload[INSTANCE_FLOATS * 2 + 21]).toBeCloseTo(0);

    const frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats).toMatchObject({
      numRTCTiles: 1,
      numRTCTileMatrixUploads: 2,
      numMeshesWithRTCTile: 1,
      numMeshesUsingRTCFallback: 2
    });
    expect(renderer.getViewRenderStats(0)).toMatchObject({
      numRTCTiles: 1,
      numRTCTileMatrixUploads: 2,
      numMeshesWithRTCTile: 1,
      numMeshesUsingRTCFallback: 2
    });

    renderer.detachViewer();
  });

  test("can render opaque triangles without the depth prepass", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

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
      logging: false,
      renderConfigs: {
        depthPrepass: false
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    expect((gpu.device.createRenderPipeline.mock.calls[0][0] as any).label).toBe("xeokit-webgpu-triangles-draw-color-no-normals-opaque-pipeline");
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(1);
    expect(gpu.commandEncoder.beginRenderPass).toHaveBeenCalledTimes(1);
    expect(gpu.commandEncoder.beginRenderPass.mock.calls[0][0]).toMatchObject({
      colorAttachments: [expect.any(Object)],
      depthStencilAttachment: {
        view: gpu.depthTextureView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        stencilClearValue: 0,
        stencilLoadOp: "clear",
        stencilStoreOp: "store"
      }
    });

    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }

    inspectorResult.value.enabled = true;
    testViewer.onViewUpdated.emit(view, view);

    const frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.numDrawCalls).toBe(1);
    expect(frameStats?.renderBins.map((bin) => bin.name)).toEqual(["OPAQUE"]);
  });

  test("enables logarithmic depth only when requested", () => {
    expect(createWebGPURenderConfigs({}).logDepth).toBe(false);
    expect(createWebGPURenderConfigs({logDepth: true}).logDepth).toBe(true);
    expect(createWebGPURenderConfigs({}).triangleColorMode).toBe("pbr");
    expect(createWebGPURenderConfigs({triangleColorMode: "flat"}).triangleColorMode).toBe("flat");
    expect(createMemoryConfigs({grossMemoryMB: 128, device: "medium", utilization: 0.5}).compactStreamPages).toBe(false);
    expect(createMemoryConfigs({
      grossMemoryMB: 128,
      device: "medium",
      utilization: 0.5,
      user: {
        compactStreamPages: true
      }
    }).compactStreamPages).toBe(true);

    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.camera.perspectiveProjection = {far: 999};
    const {mesh} = createTriangleMesh();

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
      logging: false,
      renderConfigs: {
        depthPrepass: false,
        logDepth: true
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    const shaderDescriptor = gpu.device.createShaderModule.mock.calls[0][0] as any;
    expect(shaderDescriptor.label).toBe("xeokit-webgpu-triangles-draw-color-no-normals-log-depth-shader");
    expect(shaderDescriptor.code).toContain("@builtin(frag_depth)");
    expect(shaderDescriptor.code).toContain("log2(max(1.0e-6, input.fragDepth))");

    const frameUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-frame-uniforms");
    expect(frameUpload[DEPTH_PARAMS_UNIFORM_OFFSET]).toBeCloseTo(2 / Math.log2(1000));
    expect(frameUpload[DEPTH_PARAMS_UNIFORM_OFFSET + 1]).toBe(1);
  });

  test("uses flat triangle color mode without PBR-only vertex streams", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

    view.lights = {
      ibl: {
        applied: true,
        possible: true,
        intensity: 1,
        environmentVersion: 3
      }
    };
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
      logging: false,
      renderConfigs: {
        depthPrepass: false,
        edges: false,
        triangleColorMode: "flat"
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    const pipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    expect(pipelineDescriptor.label).toBe("xeokit-webgpu-triangles-draw-flat-color-scene-opaque-pipeline");
    expect(pipelineDescriptor.depthStencil).toEqual({
      format: "depth24plus-stencil8",
      depthWriteEnabled: true,
      depthCompare: "less-equal"
    });
    expect(pipelineDescriptor.vertex.buffers).toEqual([
      {
        arrayStride: 8,
        attributes: [{
          shaderLocation: 0,
          offset: 0,
          format: "unorm16x4"
        }]
      },
      {
        arrayStride: 8,
        attributes: [{
          shaderLocation: 1,
          offset: 0,
          format: "uint32x2"
        }]
      }
    ]);
    const bufferLabels = gpu.buffers.map((buffer) => buffer.descriptor?.label);
    expect(bufferLabels).toContain("xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0");
    expect(bufferLabels).toContain("xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0");
    expect(bufferLabels).toContain("xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_page_0");
    expect(bufferLabels).not.toContain("xeokit-webgpu-packed-materials:triangles:unowned_dynamic_stream_page_0");
    expect(bufferLabels).not.toContain("xeokit-webgpu-packed-normals:triangles:unowned_dynamic_stream_page_0");
    expect(bufferLabels).not.toContain("xeokit-webgpu-packed-edge-indices:triangles:unowned_dynamic_stream_page_0");
    const textureLabels = gpu.device.createTexture.mock.calls.map((call: any[]) => call[0]?.label);
    expect(textureLabels).toContain("xeokit-webgpu-ibl-placeholder-irradiance-cubemap");
    expect(textureLabels).toContain("xeokit-webgpu-ibl-placeholder-prefiltered-cubemap");
    expect(textureLabels).not.toContain("xeokit-webgpu-ibl-irradiance-cubemap");
    expect(textureLabels).not.toContain("xeokit-webgpu-ibl-prefiltered-cubemap");
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(0, getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0"));
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(1, getBufferByLabel(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0"));
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("uses post-process color target format for flat scene triangle pipelines", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

    view.effects = {
      tonemap: {
        applied: true,
        possible: true,
        exposure: 1,
        mode: "aces",
        sRGBEncode: true
      }
    };
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
      contextFormat: "bgra8unorm",
      logging: false,
      renderConfigs: {
        depthPrepass: false,
        edges: false,
        triangleColorMode: "flat"
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    const flatScenePipeline = gpu.device.createRenderPipeline.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-triangles-draw-flat-color-scene-opaque-pipeline"
    )?.[0] as any;
    expect(flatScenePipeline?.fragment.targets[0].format).toBe("rgba16float");
    const postProcessPipeline = gpu.device.createRenderPipeline.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-postprocess-pipeline"
    )?.[0] as any;
    expect(postProcessPipeline?.fragment.targets[0].format).toBe("bgra8unorm");
  });

  test("encodes packed triangle batches with conservative decode binds", () => {
    const gpu = createWebGPUHarness();
    const vertexBufferA = {label: "vertexA"} as any;
    const vertexMetadataBufferA = {label: "vertexMetadataA"} as any;
    const decodeBindGroupA = {label: "decodeA"} as any;
    const vertexBufferB = {label: "vertexB"} as any;
    const vertexMetadataBufferB = {label: "vertexMetadataB"} as any;
    const decodeBindGroupB = {label: "decodeB"} as any;
    const indexBufferA = {label: "indexA"} as any;
    const indexBufferB0 = {label: "indexB0"} as any;
    const commandStats = {
      pipelineBound: jest.fn(),
      vertexBufferBound: jest.fn(),
      indexBufferBound: jest.fn(),
      bindGroupBound: jest.fn(),
      submissionGroupsSubmitted: jest.fn()
    };

    const result = encodePackedTriangleBatches({
      device: gpu.device,
      passEncoder: gpu.passEncoder,
      renderPass: RENDER_PASSES.OPAQUE,
      validateLabel: "test",
      commandStats,
      batches: [
        createPackedTriangleBatch("a0", "segmentA0", vertexBufferA, vertexMetadataBufferA, decodeBindGroupA, indexBufferA, "pageA", "fill"),
        createPackedTriangleBatch("b0", "segmentB0", vertexBufferB, vertexMetadataBufferB, decodeBindGroupB, indexBufferB0, "pageB", "fill"),
        createPackedTriangleBatch("a1", "segmentA1", vertexBufferA, vertexMetadataBufferA, decodeBindGroupA, indexBufferA, "pageA", "emphasis")
      ]
    });

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.setVertexBuffer.mock.calls).toEqual([
      [0, vertexBufferA],
      [1, vertexMetadataBufferA],
      [0, vertexBufferB],
      [1, vertexMetadataBufferB]
    ]);
    expect(gpu.passEncoder.setBindGroup.mock.calls).toEqual([
      [2, decodeBindGroupA],
      [2, decodeBindGroupA],
      [2, decodeBindGroupB]
    ]);
    expect(gpu.passEncoder.setIndexBuffer.mock.calls).toEqual([
      [indexBufferA, "uint16"],
      [indexBufferB0, "uint16"]
    ]);
    expect(gpu.passEncoder.drawIndexed.mock.calls).toEqual([
      [3, 1, 0, 0, 0],
      [6, 1, 0, 0, 0],
      [9, 1, 0, 0, 0]
    ]);
    expect(commandStats.vertexBufferBound.mock.calls).toEqual([[0], [1], [0], [1]]);
    expect(commandStats.bindGroupBound.mock.calls).toEqual([[2], [2], [2]]);
    expect(commandStats.indexBufferBound).toHaveBeenCalledTimes(2);
    expect(commandStats.submissionGroupsSubmitted).toHaveBeenCalledWith({
      submissionGroups: 3,
      bufferPageGroups: 2,
      renderStateGroups: 3
    });
  });

  test("keeps position decode bound when per-draw setup only adds vertex buffers", () => {
    const gpu = createWebGPUHarness();
    const vertexBuffer = {label: "vertex"} as any;
    const vertexMetadataBuffer = {label: "vertexMetadata"} as any;
    const decodeBindGroup = {label: "decode"} as any;
    const colorBuffer = {label: "color"} as any;
    const indexBuffer = {label: "index"} as any;
    const batch = createPackedTriangleBatch(
      "a0",
      "segmentA0",
      vertexBuffer,
      vertexMetadataBuffer,
      decodeBindGroup,
      indexBuffer,
      "pageA",
      "fill"
    );
    batch.packedBatch.colorBuffer = colorBuffer;

    const result = encodePackedTriangleBatches({
      device: gpu.device,
      passEncoder: gpu.passEncoder,
      renderPass: RENDER_PASSES.OPAQUE,
      validateLabel: "test",
      batches: [batch],
      bindBeforeDraw: (packedBatch) => {
        gpu.passEncoder.setVertexBuffer(2, packedBatch.colorBuffer);
      }
    });

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.setBindGroup.mock.calls).toEqual([
      [2, decodeBindGroup]
    ]);
    expect(gpu.passEncoder.setVertexBuffer.mock.calls).toEqual([
      [0, vertexBuffer],
      [1, vertexMetadataBuffer],
      [2, colorBuffer]
    ]);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("encodes compatible packed triangle batches with multi-draw indirect", () => {
    const gpu = createWebGPUHarness();
    const vertexBuffer = {label: "vertex"} as any;
    const vertexMetadataBuffer = {label: "vertexMetadata"} as any;
    const decodeBindGroup = {label: "decode"} as any;
    const indexBuffer = {label: "index"} as any;
    (gpu.passEncoder as any).multiDrawIndexedIndirect = jest.fn();
    gpu.device.features.has.mockImplementation((feature: string) =>
      feature === "timestamp-query" || feature === "chromium-experimental-multi-draw-indirect"
    );

    const batchA = createPackedTriangleBatch(
      "a0",
      "segmentA0",
      vertexBuffer,
      vertexMetadataBuffer,
      decodeBindGroup,
      indexBuffer,
      "pageA",
      "fill"
    );
    const batchB = createPackedTriangleBatch(
      "a1",
      "segmentA1",
      vertexBuffer,
      vertexMetadataBuffer,
      decodeBindGroup,
      indexBuffer,
      "pageA",
      "fill"
    );
    batchB.packedBatch.vertexBufferOffset = 32;
    batchB.packedBatch.vertexMetadataBufferOffset = 32;
    batchB.packedBatch.indexBufferOffset = 12;
    batchA.packedBatch.indicesPageLocal = true;
    batchB.packedBatch.indicesPageLocal = true;

    const result = encodePackedTriangleBatches({
      device: gpu.device,
      passEncoder: gpu.passEncoder,
      renderPass: RENDER_PASSES.OPAQUE,
      validateLabel: "test",
      batches: [batchA, batchB]
    });

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.setVertexBuffer.mock.calls).toEqual([
      [0, vertexBuffer],
      [1, vertexMetadataBuffer]
    ]);
    expect(gpu.passEncoder.setBindGroup.mock.calls).toEqual([
      [2, decodeBindGroup]
    ]);
    expect(gpu.passEncoder.setIndexBuffer.mock.calls).toEqual([
      [indexBuffer, "uint16"]
    ]);
    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
    expect((gpu.passEncoder as any).multiDrawIndexedIndirect).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptor: expect.objectContaining({
          label: "xeokit-webgpu-packed-triangle-multi-draw-indirect"
        })
      }),
      0,
      2
    );
    const writeCall = gpu.device.queue.writeBuffer.mock.calls.find((call: any[]) =>
      call[0]?.descriptor?.label === "xeokit-webgpu-packed-triangle-multi-draw-indirect"
    );
    expect(writeCall).toBeDefined();
    if (!writeCall) {
      throw new Error("Expected multi-draw indirect commands to be uploaded");
    }
    expect(Array.from(writeCall[2] as Uint32Array)).toEqual([
      3, 1, 0, 0, 0,
      6, 1, 6, 0, 0
    ]);
  });

  test("falls back from multi-draw indirect for offset packed triangle vertices", () => {
    const gpu = createWebGPUHarness();
    const vertexBuffer = {label: "vertex"} as any;
    const vertexMetadataBuffer = {label: "vertexMetadata"} as any;
    const decodeBindGroup = {label: "decode"} as any;
    const indexBuffer = {label: "index"} as any;
    (gpu.passEncoder as any).multiDrawIndexedIndirect = jest.fn();
    gpu.device.features.has.mockImplementation((feature: string) =>
      feature === "timestamp-query" || feature === "chromium-experimental-multi-draw-indirect"
    );

    const batchA = createPackedTriangleBatch(
      "a0",
      "segmentA0",
      vertexBuffer,
      vertexMetadataBuffer,
      decodeBindGroup,
      indexBuffer,
      "pageA",
      "fill"
    );
    const batchB = createPackedTriangleBatch(
      "a1",
      "segmentA1",
      vertexBuffer,
      vertexMetadataBuffer,
      decodeBindGroup,
      indexBuffer,
      "pageA",
      "fill"
    );
    batchB.packedBatch.vertexBufferOffset = 32;
    batchB.packedBatch.vertexMetadataBufferOffset = 32;
    batchB.packedBatch.indexBufferOffset = 12;

    const result = encodePackedTriangleBatches({
      device: gpu.device,
      passEncoder: gpu.passEncoder,
      renderPass: RENDER_PASSES.OPAQUE,
      validateLabel: "test",
      batches: [batchA, batchB]
    });

    expect(result.ok).toBe(true);
    expect((gpu.passEncoder as any).multiDrawIndexedIndirect).not.toHaveBeenCalled();
    expect(gpu.passEncoder.drawIndexed.mock.calls).toEqual([
      [3, 1, 0, 0, 0],
      [6, 1, 0, 0, 0]
    ]);
    expect(gpu.passEncoder.setVertexBuffer.mock.calls).toEqual([
      [0, vertexBuffer],
      [1, vertexMetadataBuffer],
      [0, vertexBuffer, 32],
      [1, vertexMetadataBuffer, 32]
    ]);
    expect(gpu.passEncoder.setIndexBuffer.mock.calls).toEqual([
      [indexBuffer, "uint16"],
      [indexBuffer, "uint16", 12]
    ]);
  });

  test("packs opaque meshes with shared geometry into one draw", () => {
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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalled();
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(6, 1, 0, 0, 0);
    const vertexMetadataUpload = getLastWriteBufferData<Uint32Array>(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0");
    expect(Array.from(vertexMetadataUpload)).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0]);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[16]).toBeCloseTo(0.5);
    expect(instanceUpload[17]).toBeCloseTo(0.6);
    expect(instanceUpload[18]).toBeCloseTo(0.7);
    expect(instanceUpload[INSTANCE_FLOATS + 12]).toBeCloseTo(2);
    expect(instanceUpload[INSTANCE_FLOATS + 16]).toBeCloseTo(0.1);
    expect(instanceUpload[INSTANCE_FLOATS + 17]).toBeCloseTo(0.2);
    expect(instanceUpload[INSTANCE_FLOATS + 18]).toBeCloseTo(0.3);
  });

  test("reports WebGPU render inspector stats", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }

    inspectorResult.value.enabled = true;
    testViewer.onViewUpdated.emit(view, view);

    let frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.numDrawCalls).toBe(2);
    expect(frameStats?.numPrims).toBe(2);
    expect(frameStats?.numBatches).toBe(2);
    expect(frameStats?.renderReason).toBe("cacheReuse");
    expect(frameStats?.commandState).toMatchObject({
      numPipelineBinds: 2,
      numVertexBufferBinds: 7,
      numIndexBufferBinds: 2,
      numBindGroupBinds: 7,
      bindGroupBindsBySlot: {
        "0": 2,
        "1": 2,
        "2": 2,
        "3": 1
      }
    });
    expect(frameStats?.renderBins.map((bin) => bin.name)).toEqual(["DEPTH_PREPASS", "OPAQUE"]);
    expect(frameStats?.renderBins[0].commandState).toMatchObject({
      numPipelineBinds: 1,
      numVertexBufferBinds: 2,
      numIndexBufferBinds: 1,
      numBindGroupBinds: 3
    });
    expect(frameStats?.renderBins[0].drawCalls[0]).toMatchObject({
      renderPass: "DEPTH_PREPASS",
      primitive: "TRIANGLES",
      technique: "TrianglesDepthPrepassTechnique",
      indexCount: 3,
      numPrims: 1
    });
    expect(frameStats?.renderBins[1].drawCalls[0]).toMatchObject({
      renderPass: "OPAQUE",
      primitive: "TRIANGLES",
      technique: "TrianglesDrawColorNoNormalsTechnique",
      indexCount: 3,
      numPrims: 1
    });
    expect(renderer.getViewRenderStats(0)).toMatchObject({
      numDrawCalls: 2,
      numPrimitives: 2,
      numBatches: 2
    });

    view.camera.viewMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 0, 0, 1];
    testViewer.onCameraViewMatrixUpdated.emit(view, view.camera);
    testViewer.onViewUpdated.emit(view, view);

    frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.renderReason).toBe("cameraOnlyReuse");
  });

  test("reports optional WebGPU render pass GPU timestamps", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

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
      logging: false,
      renderConfigs: {
        gpuTimestamps: true
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;

    testViewer.onViewUpdated.emit(view, view);
    let frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.gpuTime).toMatchObject({
      available: true,
      pending: true
    });
    expect(gpu.device.createQuerySet).toHaveBeenCalledWith({
      label: "xeokit-webgpu-render-timestamp-query-set",
      type: "timestamp",
      count: 4
    });
    expect(gpu.commandEncoder.resolveQuerySet).toHaveBeenCalled();
    expect(gpu.commandEncoder.copyBufferToBuffer).toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.gpuTime.available).toBe(true);
    expect(frameStats?.gpuTime.pending).toBe(false);
    expect(frameStats?.gpuTime.passes).toEqual({
      DEPTH_PREPASS: 2,
      MAIN_COLOR: 2
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(gpu.querySets[0].destroy).toHaveBeenCalledTimes(1);
  });

  test("packs active section planes into WebGPU frame uniforms", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.sectionPlanesList = [
      {active: true, dir: [1, 0, 0], dist: -0.25, capColor: [0.2, 0.4, 0.6]},
      {active: false, dir: [0, 1, 0], dist: -0.5},
      {active: true, dir: [0, 0, 1], dist: -0.75}
    ];
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const frameUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-frame-uniforms");
    expect(frameUpload[SECTION_PLANE_STATE_UNIFORM_OFFSET]).toBe(2);
    expect(Array.from(frameUpload.slice(SECTION_PLANE_UNIFORM_OFFSET, SECTION_PLANE_UNIFORM_OFFSET + 8))).toEqual([
      1, 0, 0, -0.25,
      0, 0, 1, -0.75
    ]);
    expect(Array.from(frameUpload.slice(SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET, SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET + 8))).toEqual([
      0.20000000298023224, 0.4000000059604645, 0.6000000238418579, 1,
      0, 0, 0, 0
    ]);
  });

  test("draws WebGPU section plane caps only when the caps effect applies", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.effects = {
      sectionPlaneCaps: {
        applied: true
      }
    };
    view.sectionPlanesList = [{active: true, dir: [1, 0, 0], dist: -0.25, capColor: [0.2, 0.4, 0.6]}];
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });
    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(4);
    expect(gpu.passEncoder.draw).toHaveBeenCalledTimes(1);

    gpu.passEncoder.drawIndexed.mockClear();
    gpu.passEncoder.draw.mockClear();
    view.effects.sectionPlaneCaps.applied = false;
    testViewer.onViewUpdated.emit(view, view);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(gpu.passEncoder.draw).not.toHaveBeenCalled();
  });

  test("enabling WebGPU section plane caps reuses packed geometry", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.effects = {
      sectionPlaneCaps: {
        applied: false
      }
    };
    view.sectionPlanesList = [{active: true, dir: [1, 0, 0], dist: -0.25, capColor: [0.2, 0.4, 0.6]}];
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });
    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const packedPositionWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0");
    const packedIndexWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_page_0");
    gpu.passEncoder.drawIndexed.mockClear();
    view.effects.sectionPlaneCaps.applied = true;
    testViewer.onViewUpdated.emit(view, view);

    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0")).toBe(packedPositionWrites);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_page_0")).toBe(packedIndexWrites);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(4);
    expect(gpu.passEncoder.draw).toHaveBeenCalledTimes(1);
  });

  test("packs opaque meshes with different geometries into one draw", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: meshA} = createTriangleMesh("meshA");
    const {geometry: geometryB, mesh: meshB} = createTriangleMesh("meshB");
    geometryB.id = "geometryB";
    geometryB.uniqueId = "model__geometryB";
    meshB.geometry = geometryB;
    meshB.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1];

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(6, 1, 0, 0, 0);
    const vertexMetadataUpload = getLastWriteBufferData<Uint32Array>(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0");
    expect(Array.from(vertexMetadataUpload)).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0]);
  });

  test("renders WebGPU triangle edges from scene edge indices", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view as any).effects = {
      edges: {
        applied: true
      }
    };
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(3);
    expect(gpu.passEncoder.drawIndexed.mock.calls[0]).toEqual([3, 1, 0, 0, 0]);
    expect(gpu.passEncoder.drawIndexed.mock.calls[1]).toEqual([3, 1, 0, 0, 0]);
    expect(gpu.passEncoder.drawIndexed.mock.calls[2]).toEqual([6, 1, 0, 0, 0]);
    expect(gpu.passEncoder.setIndexBuffer.mock.calls[2][0].descriptor.label).toBe("xeokit-webgpu-packed-edge-indices:triangles:unowned_dynamic_stream_page_0");
    expect(gpu.renderPipelines[2].descriptor.primitive.topology).toBe("line-list");
  });

  test("rebuilds cached WebGPU batches when render mode disables edges", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.renderMode = RealisticRender;
    (view as any).effects = {
      edges: {
        get applied() {
          return view.renderMode === RealisticRender;
        }
      }
    };
    const {mesh} = createTriangleMesh();

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
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed.mock.calls).toEqual([
      [3, 1, 0, 0, 0],
      [3, 1, 0, 0, 0],
      [6, 1, 0, 0, 0]
    ]);

    gpu.passEncoder.drawIndexed.mockClear();
    gpu.passEncoder.setIndexBuffer.mockClear();
    view.renderMode = NavigationRender;
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed.mock.calls).toEqual([
      [3, 1, 0, 0, 0],
      [3, 1, 0, 0, 0]
    ]);
    expect(gpu.passEncoder.setIndexBuffer.mock.calls.map((call) => call[0].descriptor.label))
      .not.toContain("xeokit-webgpu-packed-edge-indices:triangles:unowned_dynamic_stream_page_0");
  });

  test("can disable WebGPU edge batch construction through render configs", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view as any).effects = {
      edges: {
        applied: true
      }
    };
    const {mesh} = createTriangleMesh();

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
      logging: false,
      renderConfigs: {
        edges: false
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(gpu.passEncoder.drawIndexed.mock.calls[0]).toEqual([3, 1, 0, 0, 0]);
    expect(gpu.passEncoder.drawIndexed.mock.calls[1]).toEqual([3, 1, 0, 0, 0]);
    expect(gpu.passEncoder.setIndexBuffer.mock.calls.map((call) => call[0].descriptor.label))
      .not.toContain("xeokit-webgpu-packed-edge-indices:triangles:unowned_dynamic_stream_page_0");
    expect(gpu.buffers.map((buffer) => buffer.descriptor?.label))
      .not.toContain("xeokit-webgpu-packed-edge-indices:triangles:unowned_dynamic_stream_page_0");
    expect(gpu.renderPipelines
      .map((pipeline) => pipeline.descriptor?.primitive?.topology)
      .filter((topology) => topology !== undefined))
      .not.toContain("line-list");
  });

  test("uses memoryConfigs to size packed triangle segments", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const meshes: any = {};

    for (let i = 0; i < 3; i++) {
      const {geometry, mesh} = createTriangleMesh(`mesh${i}`);
      geometry.id = `geometry${i}`;
      geometry.uniqueId = `model__geometry${i}`;
      mesh.geometry = geometry;
      meshes[mesh.id] = mesh;
    }

    testViewer.viewer.scene.models = {
      model: {
        meshes
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchMeshes: 1,
        maxBatchGeometries: 1,
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(6);
    const packedIndexBuffer = getBufferByLabel(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_page_0");
    expect(gpu.passEncoder.setIndexBuffer.mock.calls).toEqual([
      [packedIndexBuffer, "uint16"],
      [packedIndexBuffer, "uint16", 8],
      [packedIndexBuffer, "uint16", 16],
      [packedIndexBuffer, "uint16"],
      [packedIndexBuffer, "uint16", 8],
      [packedIndexBuffer, "uint16", 16]
    ]);
    expect(gpu.passEncoder.drawIndexed.mock.calls).toEqual([
      [3, 1, 0, 0, 0],
      [3, 1, 0, 0, 0],
      [3, 1, 0, 0, 0],
      [3, 1, 0, 0, 0],
      [3, 1, 0, 0, 0],
      [3, 1, 0, 0, 0]
    ]);
    expect(getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0")).toBeTruthy();
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0")).toBe(3);

    const memoryStats = renderer.getMemoryStats();
    expect(memoryStats).toMatchObject({
      packedTrianglePages: 1,
      packedTriangleSegments: 3,
      packedTriangleUsedVertexBytes: 3 * 3 * 8,
      packedTriangleUsedVertexMetadataBytes: 3 * 3 * 8,
      packedTriangleUsedIndexBytes: (3 * 3 + 2) * Uint16Array.BYTES_PER_ELEMENT,
      packedTriangleUsedEdgeIndexBytes: 3 * 6 * Uint16Array.BYTES_PER_ELEMENT,
      instanceBufferCapacity: 4,
      instanceBufferFrames: 1,
      instanceBufferBytes: INSTANCE_BYTES * 4,
      rtcTileCapacity: 4096,
      rtcTileBufferBytes: RTC_TILE_BYTES * 4096,
      rtcTiles: 0,
      segmentsByLifecycle: {
        dynamic: 3
      },
      segmentsByMemoryPolicy: {
        stream: 3
      }
    });
    expect(memoryStats?.packedTriangleBytes).toBeGreaterThan(0);
    expect(memoryStats?.packedTriangleUsedPositionDecodeBytes).toBeGreaterThan(0);
    expect(memoryStats?.packedTrianglePageDetails).toHaveLength(1);
    expect(memoryStats?.packedTrianglePageDetails[0]).toMatchObject({
      indexFormat: "uint16",
      segmentCount: 3,
      vertexCapacity: 12,
      usedVertices: 9,
      indexCapacity: 12,
      usedIndices: 11,
      edgeIndexCapacity: 24,
      usedEdgeIndices: 18,
      positionDecodeCapacity: 4,
      usedPositionDecodes: 3
    });
    expect(memoryStats?.totalBytes)
      .toBe((memoryStats?.packedTriangleBytes ?? 0) + INSTANCE_BYTES * 4 + RTC_TILE_BYTES * 4096);
  });

  test("builds all render-frame packed triangle segments before drawing", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const meshes: any = {};

    for (let i = 0; i < 3; i++) {
      const {geometry, mesh} = createTriangleMesh(`mesh${i}`);
      geometry.id = `geometry${i}`;
      geometry.uniqueId = `model__geometry${i}`;
      mesh.geometry = geometry;
      meshes[mesh.id] = mesh;
    }

    testViewer.viewer.scene.models = {
      model: {
        meshes
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchMeshes: 1,
        maxBatchGeometries: 1,
        maxBatchBuildTimeMs: 0,
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(6);

    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);
    let frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(6);
    expect(frameStats?.numBuiltSegments).toBe(3);
    expect(frameStats?.numPendingSegments).toBe(0);
    expect(frameStats?.renderReason).toBe("cacheReuse");

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);
    frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(6);
    expect(frameStats?.numBuiltSegments).toBe(3);
    expect(frameStats?.numPendingSegments).toBe(0);

    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0")).toBe(3);
  });

  test("appends new stream segments after render-frame segment build completes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const model = {
      id: "model",
      building: false,
      geometries: {} as Record<string, any>,
      meshes: {} as Record<string, any>,
      objects: {}
    };
    const addMesh = (meshId: string) => {
      const {geometry, mesh} = createTriangleMesh(meshId);
      geometry.id = `${meshId}Geometry`;
      geometry.uniqueId = `model__${meshId}Geometry`;
      mesh.geometry = geometry;
      mesh.uniqueId = `model__${meshId}`;
      (geometry as any).model = model;
      (mesh as any).model = model;
      model.geometries[geometry.id] = geometry;
      model.meshes[mesh.id] = mesh;
      return {geometry, mesh};
    };

    addMesh("mesh0");
    addMesh("mesh1");
    addMesh("mesh2");
    testViewer.viewer.scene.models = {model};
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchMeshes: 1,
        maxBatchGeometries: 1,
        maxBatchBuildTimeMs: 0,
        maxBatchBuildSegments: -1
      }
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);
    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;

    testViewer.onViewUpdated.emit(view, view);
    let frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.renderReason).toBe("cacheReuse");
    expect(frameStats?.numPendingSegments).toBe(0);

    const {geometry, mesh} = addMesh("mesh3");
    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometry);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.numPendingSegments).toBe(0);
    expect(frameStats?.renderReason).not.toBe("pendingSegmentAppend");
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalled();
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBeGreaterThanOrEqual(instanceWrites + 1);
    const instanceWrite = getLastWriteBufferCall(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceWrite[4]).toBeLessThan(4 * INSTANCE_FLOATS);
    if (frameStats?.numRenderedMeshes && typeof frameStats.instanceUploadMaxRangeSlots === "number") {
      expect(frameStats.instanceUploadMaxRangeSlots).toBeLessThan(frameStats.numRenderedMeshes);
    }
  });

  test("keeps copied instance buffer growth append-friendly", () => {
    const gpu = createWebGPUHarness();
    const renderContext = new RenderContext({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      memoryConfigs: createMemoryConfigs({
        grossMemoryMB: 512,
        device: "medium",
        utilization: 0.5
      }),
      renderConfigs: createWebGPURenderConfigs({})
    });
    const manager = new InstanceBufferManager(renderContext);

    const firstFrameResult = manager.beginFrame(2, "view");
    expect(firstFrameResult.ok).toBe(true);
    if (!firstFrameResult.ok) {
      throw new Error("Expected InstanceBufferManager.beginFrame to succeed");
    }
    const firstFrame = firstFrameResult.value;
    firstFrame.data[0] = 42;
    firstFrame.data[INSTANCE_FLOATS] = 84;
    firstFrame.instanceCount = 2;
    InstanceBufferManager.markDirtySlotRange(firstFrame, 0, 2);
    manager.upload(firstFrame);
    const bufferVersion = firstFrame.bufferVersion;
    const initialCopies = gpu.commandEncoder.copyBufferToBuffer.mock.calls.length;

    const grownFrameResult = manager.beginFrame(3, "view");
    expect(grownFrameResult.ok).toBe(true);
    if (!grownFrameResult.ok) {
      throw new Error("Expected InstanceBufferManager.beginFrame to grow");
    }
    const grownFrame = grownFrameResult.value;
    expect(grownFrame.bufferVersion).toBe(bufferVersion);
    expect(grownFrame.forceFullUpload).toBe(false);
    expect(grownFrame.copiedByteLength).toBe(2 * INSTANCE_BYTES);
    expect(grownFrame.data[0]).toBe(42);
    expect(grownFrame.data[INSTANCE_FLOATS]).toBe(84);
    expect(gpu.commandEncoder.copyBufferToBuffer).toHaveBeenCalledTimes(initialCopies + 1);

    grownFrame.data[2 * INSTANCE_FLOATS] = 126;
    grownFrame.instanceCount = 3;
    InstanceBufferManager.markDirtySlotRange(grownFrame, 2, 1);
    const uploadStats = manager.upload(grownFrame);
    expect(uploadStats).toMatchObject({
      writeCount: 1,
      byteLength: INSTANCE_BYTES,
      rangeCount: 1,
      maxRangeSlots: 1,
      fullUpload: false,
      copiedByteLength: 2 * INSTANCE_BYTES
    });
    const instanceWrites = gpu.device.queue.writeBuffer.mock.calls.filter((call) => {
      const buffer = call[0] as any;
      return buffer.descriptor?.label === "xeokit-webgpu-instance-buffer";
    });
    const instanceWrite = instanceWrites[instanceWrites.length - 1];
    expect(instanceWrite[1]).toBe(2 * INSTANCE_BYTES);
    expect(instanceWrite[3]).toBe(2 * INSTANCE_FLOATS);
    expect(instanceWrite[4]).toBe(INSTANCE_FLOATS);
  });

  test("dirties only rewritten slots for incremental triangle segments", () => {
    const manager = Object.create(TriangleBatchManager.prototype) as TriangleBatchManager;
    const view = {id: "view"} as any;
    const meshStates = [0, 1, 2].map((index) => ({
      id: `mesh${index}`,
      instanceDataVersion: 1
    }));
    const slots = meshStates.map((meshState, index) => ({
      meshState,
      signature: "triangles",
      globalSlot: 10 + index,
      indexStart: 0,
      indexCount: 3,
      edgeIndexStart: 0,
      edgeIndexCount: 0,
      instanceWriteStateByViewId: index === 1 ? {} : {
        view: {
          bufferVersion: 4,
          meshInstanceDataVersion: 1,
          viewStateVersion: 7
        }
      }
    }));
    const segment = {
      key: "segment",
      baseKey: "segment",
      bufferPageKey: "page",
      label: "segment",
      signature: "triangles",
      baseSlot: 10,
      slotCount: 3,
      slotEnd: 13,
      slots,
      slotByMeshId: {}
    } as any;
    const instanceFrame = {
      buffer: null,
      bindGroup: null,
      bindGroupLayout: null,
      data: new Float32Array(32 * INSTANCE_FLOATS),
      capacity: 32,
      instanceCount: 0,
      bufferVersion: 4,
      forceFullUpload: false,
      dirtySlotRanges: [],
      copiedByteLength: 0
    };
    const meshManager = {
      getViewStateVersion: jest.fn(() => 7),
      getMeshOpacityInView: jest.fn(() => 1),
      writeInstanceData: jest.fn((_drawItem, _view, target: Float32Array, offset: number) => {
        target[offset] = 123;
      })
    };

    manager.writeInstances({
      batchSet: {
        segments: [segment],
        instanceCapacity: 32
      } as any,
      segments: [segment],
      view,
      meshManager: meshManager as any,
      instanceFrame
    });

    expect(meshManager.writeInstanceData).toHaveBeenCalledTimes(1);
    expect(instanceFrame.dirtySlotRanges).toEqual([{base: 11, count: 1}]);
    expect(instanceFrame.instanceCount).toBe(32);
  });

  test("keeps model segment storage stable when another lifecycle segment is replaced", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);

    const createSegmentedModel = (modelId: string, meshId: string) => {
      const {geometry, mesh} = createTriangleMesh(meshId);
      geometry.id = `${meshId}Geometry`;
      geometry.uniqueId = `${modelId}__${meshId}Geometry`;
      mesh.uniqueId = `${modelId}__${meshId}`;
      const model = {
        id: modelId,
        lifecycle: "sealed",
        memoryPolicy: "compact",
        building: false,
        geometries: {
          [geometry.id]: geometry
        },
        meshes: {
          [mesh.id]: mesh
        },
        objects: {}
      };
      (geometry as any).model = model;
      (mesh as any).model = model;
      return model;
    };

    const modelA = createSegmentedModel("modelA", "meshA");
    const modelB = createSegmentedModel("modelB", "meshB");
    const modelC = createSegmentedModel("modelC", "meshC");

    testViewer.viewer.scene.models = {
      modelA,
      modelB
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(4);

    const modelAPositionLabel = "xeokit-webgpu-packed-positions:triangles:modelA_sealed_compact_page_0";
    const modelBPositionLabel = "xeokit-webgpu-packed-positions:triangles:modelB_sealed_compact_page_0";
    const modelCPositionLabel = "xeokit-webgpu-packed-positions:triangles:modelC_sealed_compact_page_0";
    const memoryStats = renderer.getMemoryStats();
    expect(memoryStats?.packedTrianglePageDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        segmentCount: 1,
        vertexCapacity: 3,
        usedVertices: 3,
        indexCapacity: 3,
        usedIndices: 3,
        edgeIndexCapacity: 6,
        usedEdgeIndices: 6,
        positionDecodeCapacity: 1,
        usedPositionDecodes: 1
      })
    ]));
    expect(memoryStats?.packedTrianglePageDetails.every((page) => page.bytes === page.usedBytes)).toBe(true);
    expect(countWriteBufferCalls(gpu, modelAPositionLabel)).toBe(1);
    expect(countWriteBufferCalls(gpu, modelBPositionLabel)).toBe(1);

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onSceneModelDestroyed.emit(testViewer.viewer.scene, modelB);
    delete testViewer.viewer.scene.models.modelB;
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(4);
    expect(getBufferByLabel(gpu, modelBPositionLabel).destroy).toHaveBeenCalledTimes(1);

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.viewer.scene.models.modelC = modelC;
    testViewer.onSceneModelCreated.emit(testViewer.viewer.scene, modelC);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(8);
    expect(countWriteBufferCalls(gpu, modelAPositionLabel)).toBe(1);
    expect(countWriteBufferCalls(gpu, modelBPositionLabel)).toBe(1);
    expect(countWriteBufferCalls(gpu, modelCPositionLabel)).toBe(1);
  });

  test("reuses cached opaque instance data on camera-only redraws", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view.camera as any).view = view;
    const {mesh} = createTriangleMesh();

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

    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");
    const frameWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-frame-uniforms");
    gpu.passEncoder.drawIndexed.mockClear();

    testViewer.onCameraViewMatrixUpdated.emit(view, view.camera);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBe(instanceWrites);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-frame-uniforms")).toBe(frameWrites + 1);
  });

  test("frustum culls meshes while building draw batches", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: visibleMesh} = createTriangleMesh("visibleMesh");
    const offscreenMesh = {
      ...visibleMesh,
      id: "offscreenMesh",
      uniqueId: "model__offscreenMesh",
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1]
    };

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [visibleMesh.id]: visibleMesh,
          [offscreenMesh.id]: offscreenMesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        frustumCulling: true
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(6, 1, 0, 0, 0);
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numCullCandidates: 2,
      numRenderedMeshes: 2,
      numFrustumCulledMeshes: 0,
      numCullSegmentCandidates: 1,
      numFullyDrawnSegments: 1,
      numPartiallyRefinedSegments: 0,
      numTemporaryIndexBuffers: 0
    });

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numTemporaryIndexBuffers: 0
    });
  });

  test("camera-dependent frustum culling rebuilds draw batches without repacking triangle storage", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view.camera as any).view = view;
    const {mesh} = createTriangleMesh();
    mesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1];

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
      logging: false,
      memoryConfigs: {
        frustumCulling: true
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();

    const positionLabel = "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0";
    const initialPositionWrites = countWriteBufferCalls(gpu, positionLabel);
    expect(initialPositionWrites).toBe(1);

    gpu.passEncoder.drawIndexed.mockClear();
    view.camera.viewMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -5, 0, 0, 1];
    testViewer.onCameraViewMatrixUpdated.emit(view, view.camera);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
    expect(countWriteBufferCalls(gpu, positionLabel)).toBe(initialPositionWrites);
  });

  test("skips camera-culling rebuilds when camera events do not change matrices", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view.camera as any).view = view;
    const {mesh: visibleMesh} = createTriangleMesh("visibleMesh");
    const offscreenMesh = {
      ...visibleMesh,
      id: "offscreenMesh",
      uniqueId: "model__offscreenMesh",
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1]
    };

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [visibleMesh.id]: visibleMesh,
          [offscreenMesh.id]: offscreenMesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        frustumCulling: true
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);
    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;

    testViewer.onViewUpdated.emit(view, view);
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numTemporaryIndexBuffers: 0
    });

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onCameraViewMatrixUpdated.emit(view, view.camera);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(6, 1, 0, 0, 0);
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numTemporaryIndexBuffers: 0
    });
  });

  test("uses coarse segment culling for large camera moves", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view.camera as any).view = view;
    const {mesh: visibleMesh} = createTriangleMesh("visibleMesh");
    const offscreenMesh = {
      ...visibleMesh,
      id: "offscreenMesh",
      uniqueId: "model__offscreenMesh",
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1]
    };

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [visibleMesh.id]: visibleMesh,
          [offscreenMesh.id]: offscreenMesh
        }
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        frustumCulling: true,
        maxBatchMeshes: 1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);
    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;

    testViewer.onViewUpdated.emit(view, view);
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numRenderedMeshes: 1,
      numFrustumCulledMeshes: 1
    });

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onCameraViewMatrixUpdated.emit(view, view.camera);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numRenderedMeshes: 1,
      numFrustumCulledMeshes: 1,
      numCullSegmentCandidates: 2,
      numTemporaryIndexBuffers: 0
    });
  });

  test("projected canvas size culls tiny meshes while building draw batches", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    geometry.aabb = new Float32Array([0, 0, 0, 0.01, 0.01, 0]);

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
      logging: false,
      memoryConfigs: {
        minProjectedCanvasSize: 2
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numCullCandidates: 0,
      numRenderedMeshes: 0,
      numProjectedSizeCulledMeshes: 1,
      numCullSegmentCandidates: 1,
      numPartiallyRefinedSegments: 0
    });
  });

  test("updates instance data without repacking triangle storage", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh();

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

    const positionWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0");
    const vertexMetadataWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0");
    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");

    mesh.color = [0.2, 0.3, 0.4];
    mesh.effectiveColor = [0.2, 0.3, 0.4];
    testViewer.onSceneMeshColorChanged.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0")).toBe(positionWrites);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0")).toBe(vertexMetadataWrites);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBe(instanceWrites + 1);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[16]).toBeCloseTo(0.2);
    expect(instanceUpload[17]).toBeCloseTo(0.3);
    expect(instanceUpload[18]).toBeCloseTo(0.4);
  });

  test("updates only moved mesh instance data when crossing WebGPU RTC tile boundaries", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: stationaryMesh} = createTriangleMesh("stationaryMesh");
    const {geometry: movingGeometry, mesh: movingMesh} = createTriangleMesh("movingMesh");
    movingGeometry.id = "movingGeometry";
    movingGeometry.uniqueId = "model__movingGeometry";
    movingMesh.geometry = movingGeometry;
    stationaryMesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000000, 300, 0, 1];
    movingMesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000400, 150, 0, 1];

    testViewer.viewer.scene.models = {
      model: {
        meshes: {
          [stationaryMesh.id]: stationaryMesh,
          [movingMesh.id]: movingMesh
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

    const positionWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0");
    const indexWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_page_0");
    const vertexMetadataWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0");
    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");

    movingMesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000800, 150, 0, 1];
    testViewer.onSceneMeshMatrixChanged.emit(testViewer.viewer.scene, movingMesh);
    testViewer.onViewUpdated.emit(view, view);

    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:unowned_dynamic_stream_page_0")).toBe(positionWrites);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-indices:triangles:unowned_dynamic_stream_page_0")).toBe(indexWrites);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:unowned_dynamic_stream_page_0")).toBe(vertexMetadataWrites);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBe(instanceWrites + 1);

    const movedInstanceWrite = getLastWriteBufferCall(gpu, "xeokit-webgpu-instance-buffer");
    expect(movedInstanceWrite[1]).toBe(INSTANCE_BYTES);
    expect(movedInstanceWrite[3]).toBe(INSTANCE_FLOATS);
    expect(movedInstanceWrite[4]).toBe(INSTANCE_FLOATS);

    const movedInstanceData = movedInstanceWrite[2] as Float32Array;
    const movedInstanceUpload = movedInstanceData.subarray(movedInstanceWrite[3], movedInstanceWrite[3] + movedInstanceWrite[4]);
    expect(movedInstanceUpload[12]).toBeCloseTo(0);
    expect(movedInstanceUpload[13]).toBeCloseTo(-50);
    expect(movedInstanceUpload[14]).toBeCloseTo(0);
    expect(movedInstanceUpload[21]).toBeGreaterThan(0);

    const movedTileUpload = getLastWriteBufferDataAtOffset(gpu, "xeokit-webgpu-rtc-tile-buffer", RTC_TILE_BYTES * movedInstanceUpload[21]);
    expect(movedTileUpload[16]).toBeCloseTo(1000800);
    expect(movedTileUpload[17]).toBeCloseTo(200);
    expect(movedTileUpload[18]).toBeCloseTo(0);

    renderer.detachViewer();
  });

  test("uploads only dirty instance slots when one mesh changes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh: meshA} = createTriangleMesh("meshA");
    const {geometry: geometryB, mesh: meshB} = createTriangleMesh("meshB");
    geometryB.id = "geometryB";
    geometryB.uniqueId = "model__geometryB";
    meshB.geometry = geometryB;

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

    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");
    meshB.color = [0.1, 0.2, 0.3];
    meshB.effectiveColor = [0.1, 0.2, 0.3];
    testViewer.onSceneMeshColorChanged.emit(testViewer.viewer.scene, meshB);
    testViewer.onViewUpdated.emit(view, view);

    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBe(instanceWrites + 1);
    const instanceWrite = getLastWriteBufferCall(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceWrite[1]).toBe(INSTANCE_BYTES);
    expect(instanceWrite[3]).toBe(INSTANCE_FLOATS);
    expect(instanceWrite[4]).toBe(INSTANCE_FLOATS);
  });

  test("appends dynamic model meshes without repacking existing triangle pages", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry: geometryA, mesh: meshA} = createTriangleMesh("meshA");
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometryA.id]: geometryA
      },
      meshes: {
        [meshA.id]: meshA
      },
      objects: {}
    };

    (geometryA as any).model = model;
    (meshA as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const firstPagePositionLabel = "xeokit-webgpu-packed-positions:triangles:model_dynamic_stream_page_0";
    expect(countWriteBufferCalls(gpu, firstPagePositionLabel)).toBe(1);
    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");
    const bufferCopies = gpu.commandEncoder.copyBufferToBuffer.mock.calls.length;

    const {geometry: geometryB, mesh: meshB} = createTriangleMesh("meshB");
    geometryB.id = "geometryB";
    geometryB.uniqueId = "model__geometryB";
    meshB.geometry = geometryB;
    meshB.uniqueId = "model__meshB";
    (geometryB as any).model = model;
    (meshB as any).model = model;
    (model.geometries as any)[geometryB.id] = geometryB;
    (model.meshes as any)[meshB.id] = meshB;

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometryB);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, meshB);
    testViewer.onViewUpdated.emit(view, view);

    expect(countWriteBufferCalls(gpu, firstPagePositionLabel)).toBe(2);
    expect(gpu.commandEncoder.copyBufferToBuffer).toHaveBeenCalledTimes(bufferCopies + 1);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBe(instanceWrites + 1);
    const instanceWrite = getLastWriteBufferCall(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceWrite[1]).toBe(INSTANCE_BYTES);
    expect(instanceWrite[3]).toBe(INSTANCE_FLOATS);
    expect(instanceWrite[4]).toBe(INSTANCE_FLOATS);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(8);
  });

  test("keeps uint16 packed indices segment-local when sharing a large vertex page", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const model = {
      id: "model",
      building: false,
      geometries: {},
      meshes: {},
      objects: {}
    };
    const addMesh = (meshId: string) => {
      const {geometry, mesh} = createLargeTriangleMesh(meshId, 40000);
      (geometry as any).model = model;
      (mesh as any).model = model;
      (model.geometries as any)[geometry.id] = geometry;
      (model.meshes as any)[mesh.id] = mesh;
      return {geometry, mesh};
    };
    addMesh("meshA");
    addMesh("meshB");
    addMesh("meshC");

    testViewer.viewer.scene.models = {model};
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchVertices: 40000,
        maxBatchIndices: 64,
        maxBatchMeshes: 1,
        maxBatchGeometries: 1,
        maxBatchPrims: 64,
        maxBatchBuildTimeMs: -1,
        maxBatchBuildSegments: -1,
        frustumCulling: false,
        minProjectedCanvasSize: 0
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const packedIndexLabel = "xeokit-webgpu-packed-indices:triangles:model_dynamic_stream_page_0";
    const lastIndexWrite = getLastWriteBufferCall(gpu, packedIndexLabel);
    expect(lastIndexWrite[1]).toBe(16);
    const uploadedIndexBytes = lastIndexWrite[2] as Uint8Array;
    const uploadedIndices = new Uint16Array(uploadedIndexBytes.buffer, uploadedIndexBytes.byteOffset, 3);
    expect(Array.from(uploadedIndices)).toEqual([0, 1, 2]);

    const positionBuffer = getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:model_dynamic_stream_page_0");
    const metadataBuffer = getBufferByLabel(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:model_dynamic_stream_page_0");
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(0, positionBuffer, 640000);
    expect(gpu.passEncoder.setVertexBuffer).toHaveBeenCalledWith(1, metadataBuffer, 640000);
  });

  test("keeps shared-page packed segment indices segment-local", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry: geometryA, mesh: meshA} = createTriangleMesh("meshA");
    const {geometry: geometryB, mesh: meshB} = createTriangleMesh("meshB");
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometryA.id]: geometryA,
        [geometryB.id]: geometryB
      },
      meshes: {
        [meshA.id]: meshA,
        [meshB.id]: meshB
      },
      objects: {}
    };
    (geometryA as any).model = model;
    (geometryB as any).model = model;
    (meshA as any).model = model;
    (meshB as any).model = model;

    testViewer.viewer.scene.models = {model};
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchVertices: 3,
        maxBatchIndices: 3,
        maxBatchMeshes: 1,
        maxBatchGeometries: 1,
        maxBatchPrims: 1,
        maxBatchBuildTimeMs: -1,
        maxBatchBuildSegments: -1,
        frustumCulling: false,
        minProjectedCanvasSize: 0
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const packedIndexLabel = "xeokit-webgpu-packed-indices:triangles:model_dynamic_stream_page_0";
    const secondIndexWrite = getLastWriteBufferDataAtOffset<Uint8Array>(gpu, packedIndexLabel, 8);
    const secondIndices = new Uint16Array(secondIndexWrite.buffer, secondIndexWrite.byteOffset, 3);
    expect(Array.from(secondIndices)).toEqual([0, 1, 2]);

    const positionBuffer = getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:model_dynamic_stream_page_0");
    const metadataBuffer = getBufferByLabel(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:model_dynamic_stream_page_0");
    expect(gpu.passEncoder.setVertexBuffer.mock.calls).toContainEqual([0, positionBuffer, 24]);
    expect(gpu.passEncoder.setVertexBuffer.mock.calls).toContainEqual([1, metadataBuffer, 24]);
  });

  test("reuses cached opaque batches on append-only structure changes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const model = {
      id: "model",
      building: false,
      geometries: {},
      meshes: {},
      objects: {}
    };
    const addMesh = (meshId: string) => {
      const {geometry, mesh} = createTriangleMesh(meshId);
      geometry.id = `${meshId}Geometry`;
      geometry.uniqueId = `model__${meshId}Geometry`;
      mesh.geometry = geometry;
      mesh.uniqueId = `model__${meshId}`;
      (geometry as any).model = model;
      (mesh as any).model = model;
      (model.geometries as any)[geometry.id] = geometry;
      (model.meshes as any)[mesh.id] = mesh;
      return {geometry, mesh};
    };
    addMesh("meshA");
    addMesh("meshB");
    addMesh("meshC");

    testViewer.viewer.scene.models = {model};
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const firstPagePositions = getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:model_dynamic_stream_page_0");
    const firstPageVertexMetadata = getBufferByLabel(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:model_dynamic_stream_page_0");
    const firstPageIndices = getBufferByLabel(gpu, "xeokit-webgpu-packed-indices:triangles:model_dynamic_stream_page_0");
    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");
    const {geometry, mesh} = addMesh("meshD");

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometry);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    expect(firstPagePositions.destroy).not.toHaveBeenCalled();
    expect(firstPageVertexMetadata.destroy).not.toHaveBeenCalled();
    expect(firstPageIndices.destroy).not.toHaveBeenCalled();
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBe(instanceWrites + 1);
    const instanceWrite = getLastWriteBufferCall(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceWrite[1]).toBe(3 * INSTANCE_BYTES);
    expect(instanceWrite[3]).toBe(3 * INSTANCE_FLOATS);
    expect(instanceWrite[4]).toBe(INSTANCE_FLOATS);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(8);
  });

  test("uses segment rebuilds instead of append-only cache updates when camera culling is enabled", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const model = {
      id: "model",
      building: false,
      geometries: {},
      meshes: {},
      objects: {}
    };
    const addMesh = (meshId: string) => {
      const {geometry, mesh} = createTriangleMesh(meshId);
      geometry.id = `${meshId}Geometry`;
      geometry.uniqueId = `model__${meshId}Geometry`;
      mesh.geometry = geometry;
      mesh.uniqueId = `model__${meshId}`;
      (geometry as any).model = model;
      (mesh as any).model = model;
      (model.geometries as any)[geometry.id] = geometry;
      (model.meshes as any)[mesh.id] = mesh;
      return {geometry, mesh};
    };
    addMesh("meshA");

    testViewer.viewer.scene.models = {model};
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        frustumCulling: true
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);
    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;

    const {geometry, mesh} = addMesh("meshB");

    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometry);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalled();
    expect(inspectorResult.value.renderStats.views?.[0]).toMatchObject({
      numCullSegmentCandidates: 2,
      numFullyDrawnSegments: 2
    });
  });

  test("compacts streaming model pages when the model is sealed", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry: geometryA, mesh: meshA} = createTriangleMesh("meshA");
    const model = {
      id: "model",
      lifecycle: "streaming",
      memoryPolicy: "stream",
      building: false,
      geometries: {
        [geometryA.id]: geometryA
      },
      meshes: {
        [meshA.id]: meshA
      },
      objects: {}
    };

    (geometryA as any).model = model;
    (meshA as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const {geometry: geometryB, mesh: meshB} = createTriangleMesh("meshB");
    geometryB.id = "geometryB";
    geometryB.uniqueId = "model__geometryB";
    meshB.geometry = geometryB;
    meshB.uniqueId = "model__meshB";
    (geometryB as any).model = model;
    (meshB as any).model = model;
    (model.geometries as any)[geometryB.id] = geometryB;
    (model.meshes as any)[meshB.id] = meshB;

    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometryB);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, meshB);
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(4);
    const firstPageBuffer = getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:model_streaming_stream_page_0");

    (model as any).lifecycle = "sealed";
    testViewer.onSceneModelSealed.emit(testViewer.viewer.scene, model);
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(firstPageBuffer.destroy).toHaveBeenCalledTimes(1);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:model_sealed_stream_page_0")).toBe(1);
    expect(renderer.getMemoryStats()?.packedTrianglePageDetails).toEqual([
      expect.objectContaining({
        segmentCount: 1,
        vertexCapacity: 6,
        usedVertices: 6,
        indexCapacity: 6,
        usedIndices: 6,
        edgeIndexCapacity: 12,
        usedEdgeIndices: 12,
        positionDecodeCapacity: 1,
        usedPositionDecodes: 1
      })
    ]);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(6, 1, 0, 0, 0);
  });

  test("can keep sealed stream pages append-friendly when sealed compaction is disabled", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh("mesh");
    const model = {
      id: "model",
      lifecycle: "sealed",
      memoryPolicy: "stream",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        compactSealedStreamPages: false
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(renderer.getMemoryStats()?.packedTrianglePageDetails).toEqual([
      expect.objectContaining({
        segmentCount: 1,
        vertexCapacity: 12,
        usedVertices: 3,
        indexCapacity: 12,
        usedIndices: 3,
        edgeIndexCapacity: 24,
        usedEdgeIndices: 6,
        positionDecodeCapacity: 4,
        usedPositionDecodes: 1
      })
    ]);
  });

  test("can compact live stream pages when append headroom is disabled", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh("mesh");
    const model = {
      id: "model",
      lifecycle: "streaming",
      memoryPolicy: "stream",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        compactStreamPages: true,
        compactSealedStreamPages: false
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(renderer.getMemoryStats()?.packedTrianglePageDetails).toEqual([
      expect.objectContaining({
        segmentCount: 1,
        vertexCapacity: 3,
        usedVertices: 3,
        indexCapacity: 3,
        usedIndices: 3,
        edgeIndexCapacity: 6,
        usedEdgeIndices: 6,
        positionDecodeCapacity: 1,
        usedPositionDecodes: 1
      })
    ]);
  });

  test("keeps streaming pages packed when sealing without sealed compaction", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry: geometryA, mesh: meshA} = createTriangleMesh("meshA");
    const model = {
      id: "model",
      lifecycle: "streaming",
      memoryPolicy: "stream",
      building: false,
      geometries: {
        [geometryA.id]: geometryA
      },
      meshes: {
        [meshA.id]: meshA
      },
      objects: {}
    };

    (geometryA as any).model = model;
    (meshA as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchBuildSegments: -1,
        compactSealedStreamPages: false
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    const {geometry: geometryB, mesh: meshB} = createTriangleMesh("meshB");
    geometryB.id = "geometryB";
    geometryB.uniqueId = "model__geometryB";
    meshB.geometry = geometryB;
    meshB.uniqueId = "model__meshB";
    (geometryB as any).model = model;
    (meshB as any).model = model;
    (model.geometries as any)[geometryB.id] = geometryB;
    (model.meshes as any)[meshB.id] = meshB;

    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometryB);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, meshB);
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    const firstPageBuffer = getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:model_streaming_stream_page_0");
    const writesBeforeSeal = countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:model_streaming_stream_page_0");

    (model as any).lifecycle = "sealed";
    testViewer.onSceneModelSealed.emit(testViewer.viewer.scene, model);
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(firstPageBuffer.destroy).not.toHaveBeenCalled();
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:model_streaming_stream_page_0")).toBe(writesBeforeSeal);
    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-packed-positions:triangles:model_sealed_stream_page_0")).toBe(0);
    expect(renderer.getMemoryStats()?.packedTrianglePageDetails).toEqual([
      expect.objectContaining({
        segmentCount: 2,
        vertexCapacity: 12,
        usedVertices: 6,
        indexCapacity: 12,
        usedIndices: 7,
        edgeIndexCapacity: 24,
        usedEdgeIndices: 12,
        positionDecodeCapacity: 4,
        usedPositionDecodes: 2
      })
    ]);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(4);
  });

  test("rebuilds transparent index order without reuploading instances on camera redraws", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view.camera as any).view = view;
    const {mesh} = createTriangleMesh();
    mesh.opacity = 0.5;
    mesh.effectiveOpacity = 0.5;

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

    const instanceWrites = countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer");
    const transparentIndexLabel = "xeokit-webgpu-packed-indices:view:transparent:unowned_dynamic_stream_page_0:0";
    const transparentIndexWrites = countWriteBufferCalls(gpu, transparentIndexLabel);
    const firstTransparentIndexBuffer = getBufferByLabel(gpu, transparentIndexLabel);

    testViewer.onCameraViewMatrixUpdated.emit(view, view.camera);
    testViewer.onViewUpdated.emit(view, view);

    expect(countWriteBufferCalls(gpu, "xeokit-webgpu-instance-buffer")).toBe(instanceWrites);
    expect(countWriteBufferCalls(gpu, transparentIndexLabel)).toBe(transparentIndexWrites);
    expect(firstTransparentIndexBuffer.destroy).not.toHaveBeenCalled();
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
    expect(transparentPipelineDescriptor.label).toBe("xeokit-webgpu-triangles-draw-color-no-normals-transparent-pipeline");
    expect(transparentPipelineDescriptor.depthStencil.depthWriteEnabled).toBe(false);
    expect(transparentPipelineDescriptor.depthStencil.depthCompare).toBe("less-equal");
    expect(transparentPipelineDescriptor.fragment.targets[0].blend.color.srcFactor).toBe("one");
    expect(gpu.passEncoder.setPipeline).toHaveBeenCalledWith(gpu.renderPipeline);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(1);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(6, 1, 0, 0, 0);
    expect(gpu.passEncoder.setBindGroup.mock.calls[0]).toEqual([0, gpu.bindGroup]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[1]).toEqual([1, gpu.bindGroups[1]]);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[14]).toBeCloseTo(-1);
    expect(instanceUpload[INSTANCE_FLOATS + 14]).toBeCloseTo(-2);
    const transparentIndices = getLastWriteBufferData<Uint16Array>(gpu, "xeokit-webgpu-packed-indices:view:transparent:unowned_dynamic_stream_page_0:0");
    expect(Array.from(transparentIndices)).toEqual([3, 4, 5, 0, 1, 2]);
  });

  test("draws BLEND alpha-mode triangle meshes with the transparent pipeline", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh("blendMesh");
    mesh.effectiveOpacity = 1;
    mesh.opacity = 1;
    mesh.effectiveAlphaMode = 2;

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
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    const pipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    expect(pipelineDescriptor.label).toBe("xeokit-webgpu-triangles-draw-color-no-normals-transparent-pipeline");
    expect(pipelineDescriptor.depthStencil).toEqual({
      format: "depth24plus-stencil8",
      depthWriteEnabled: false,
      depthCompare: "less-equal"
    });
    const shaderDescriptor = gpu.device.createShaderModule.mock.calls.find((call: any[]) =>
      call[0]?.label === "xeokit-webgpu-triangles-draw-color-no-normals-shader"
    )?.[0] as any;
    expect(shaderDescriptor?.code).toContain("input.material1.y > 0.5 && input.material1.y < 1.5 && alpha < input.material1.z");
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("draws transparent overlay triangles with the flat overlay pipeline", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {mesh} = createTriangleMesh("overlayPlane");
    mesh.bin = "overlay";
    mesh.opacity = 0.45;
    mesh.effectiveOpacity = 0.45;
    mesh.color = [1, 0.8, 0.1];
    mesh.effectiveColor = [1, 0.8, 0.1];

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
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    const pipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    expect(pipelineDescriptor.label).toBe("xeokit-webgpu-triangles-draw-flat-color-transparent-pipeline");
    expect(pipelineDescriptor.fragment.targets[0].format).toBe("rgba8unorm");
    expect(pipelineDescriptor.fragment.targets[0].blend.color.srcFactor).toBe("one");
    expect(pipelineDescriptor.depthStencil).toEqual({
      format: "depth24plus-stencil8",
      depthWriteEnabled: false,
      depthCompare: "always"
    });
    expect(gpu.passEncoder.setPipeline).toHaveBeenCalledWith(gpu.renderPipeline);
    expect(gpu.passEncoder.setBindGroup.mock.calls.map((call: any[]) => call[0])).toEqual([0, 1, 2]);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(1);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("appends opaque overlay triangles to the flat overlay pipeline", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);

    const createModel = (modelId: string, meshId: string, overlay = false) => {
      const {geometry, mesh} = createTriangleMesh(meshId);
      geometry.id = `${meshId}Geometry`;
      geometry.uniqueId = `${modelId}__${geometry.id}`;
      mesh.uniqueId = `${modelId}__${mesh.id}`;
      if (overlay) {
        mesh.bin = "overlay";
        mesh.color = [1, 0.1, 0.15];
        mesh.effectiveColor = [1, 0.1, 0.15];
      }
      const model = {
        id: modelId,
        building: false,
        geometries: {
          [geometry.id]: geometry
        },
        meshes: {
          [mesh.id]: mesh
        },
        objects: {}
      };
      (geometry as any).model = model;
      (mesh as any).model = model;
      return model;
    };

    const baseModel = createModel("baseModel", "baseMesh");
    const overlayModel = createModel("overlayModel", "rotateHoop", true);
    testViewer.viewer.scene.models = {
      baseModel
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    gpu.device.createRenderPipeline.mockClear();
    gpu.passEncoder.setPipeline.mockClear();
    gpu.passEncoder.drawIndexed.mockClear();

    testViewer.viewer.scene.models.overlayModel = overlayModel;
    testViewer.onSceneModelCreated.emit(testViewer.viewer.scene, overlayModel);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    const pipelineDescriptor = gpu.device.createRenderPipeline.mock.calls[0][0] as any;
    expect(pipelineDescriptor.label).toBe("xeokit-webgpu-triangles-draw-flat-color-opaque-pipeline");
    expect(pipelineDescriptor.depthStencil.depthCompare).toBe("always");
    gpu.passEncoder.setPipeline.mockClear();
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.setPipeline).toHaveBeenCalledWith(gpu.renderPipelines[1]);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[INSTANCE_FLOATS + 16]).toBeCloseTo(1);
    expect(instanceUpload[INSTANCE_FLOATS + 17]).toBeCloseTo(0.1);
    expect(instanceUpload[INSTANCE_FLOATS + 18]).toBeCloseTo(0.15);
    expect(instanceUpload[INSTANCE_FLOATS + 19]).toBeCloseTo(1);
  });

  test("skips appended overlay picker triangles in the color pass", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry: baseGeometry, mesh: baseMesh} = createTriangleMesh("baseMesh");
    const {geometry: visibleGeometry, mesh: visibleMesh} = createTriangleMesh("visibleHoop");
    const {geometry: pickerGeometry, mesh: pickerMesh} = createTriangleMesh("pickerHoop");

    visibleGeometry.id = "visibleGeometry";
    visibleGeometry.uniqueId = "overlayModel__visibleGeometry";
    visibleMesh.uniqueId = "overlayModel__visibleHoop";
    visibleMesh.geometry = visibleGeometry;
    visibleMesh.bin = "overlay";
    visibleMesh.color = [1, 0.1, 0.15];
    visibleMesh.effectiveColor = [1, 0.1, 0.15];

    pickerGeometry.id = "pickerGeometry";
    pickerGeometry.uniqueId = "overlayModel__pickerGeometry";
    pickerMesh.uniqueId = "overlayModel__pickerHoop";
    pickerMesh.geometry = pickerGeometry;
    pickerMesh.bin = "overlayPicker";
    pickerMesh.color = [0, 0, 0];
    pickerMesh.effectiveColor = [0, 0, 0];

    const baseModel = {
      id: "baseModel",
      building: false,
      geometries: {
        [baseGeometry.id]: baseGeometry
      },
      meshes: {
        [baseMesh.id]: baseMesh
      },
      objects: {}
    };
    const overlayModel = {
      id: "overlayModel",
      building: false,
      geometries: {
        [visibleGeometry.id]: visibleGeometry,
        [pickerGeometry.id]: pickerGeometry
      },
      meshes: {
        [visibleMesh.id]: visibleMesh,
        [pickerMesh.id]: pickerMesh
      },
      objects: {}
    };
    (baseGeometry as any).model = baseModel;
    (baseMesh as any).model = baseModel;
    (visibleGeometry as any).model = overlayModel;
    (visibleMesh as any).model = overlayModel;
    (pickerGeometry as any).model = overlayModel;
    (pickerMesh as any).model = overlayModel;

    testViewer.viewer.scene.models = {
      baseModel
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    gpu.device.createRenderPipeline.mockClear();
    gpu.passEncoder.drawIndexed.mockClear();

    testViewer.viewer.scene.models.overlayModel = overlayModel;
    testViewer.onSceneModelCreated.emit(testViewer.viewer.scene, overlayModel);
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(1);
    expect(gpu.device.createRenderPipeline.mock.calls[0][0].label).toBe("xeokit-webgpu-triangles-draw-flat-color-opaque-pipeline");
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(3);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("groups transparent draws by segment by default", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const meshes: any = {};

    for (let i = 0; i < 4; i++) {
      const {geometry, mesh} = createTriangleMesh(`mesh${i}`);
      geometry.id = `geometry${i}`;
      geometry.uniqueId = `model__geometry${i}`;
      mesh.geometry = geometry;
      mesh.uniqueId = `model__mesh${i}`;
      mesh.opacity = 0.5;
      mesh.effectiveOpacity = 0.5;
      mesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -i, 1];
      meshes[mesh.id] = mesh;
    }

    testViewer.viewer.scene.models = {
      model: {
        meshes
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchMeshes: 2,
        maxBatchGeometries: 2
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
    expect(gpu.passEncoder.drawIndexed.mock.calls).toEqual([
      [6, 1, 0, 0, 0],
      [6, 1, 0, 0, 0]
    ]);
  });

  test("reorders cached transparent segment batches on camera redraws", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const meshes: any = {};

    for (let i = 0; i < 2; i++) {
      const {geometry, mesh} = createTriangleMesh(`mesh${i}`);
      geometry.id = `geometry${i}`;
      geometry.uniqueId = `model__geometry${i}`;
      mesh.geometry = geometry;
      mesh.uniqueId = `model__mesh${i}`;
      mesh.opacity = 0.5;
      mesh.effectiveOpacity = 0.5;
      mesh.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 - i, 1];
      meshes[mesh.id] = mesh;
    }

    testViewer.viewer.scene.models = {
      model: {
        meshes
      }
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false,
      memoryConfigs: {
        maxBatchMeshes: 1,
        maxBatchGeometries: 1
      }
    });

    const result = renderer.attachViewer(testViewer.viewer as any);
    expect(result.ok).toBe(true);
    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;

    gpu.passEncoder.setIndexBuffer.mockClear();
    view.camera.viewMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 0, 0, 1];
    testViewer.onCameraViewMatrixUpdated.emit(view, view.camera);
    testViewer.onViewUpdated.emit(view, view);

    expect(inspectorResult.value.renderStats.views?.[0]?.renderReason).toBe("transparentSegmentBatch");
    expect(gpu.passEncoder.setIndexBuffer.mock.calls.map((call) => call[0].descriptor.label)).toEqual([
      "xeokit-webgpu-packed-indices:view:transparent:unowned_dynamic_stream_page_1:0",
      "xeokit-webgpu-packed-indices:view:transparent:unowned_dynamic_stream_page_0:1"
    ]);
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
    expect(gpu.device.createRenderPipeline).toHaveBeenCalledTimes(3);
    expect((gpu.device.createRenderPipeline.mock.calls[0][0] as any).label).toBe("xeokit-webgpu-triangles-depth-prepass-pipeline");
    expect((gpu.device.createRenderPipeline.mock.calls[1][0] as any).label).toBe("xeokit-webgpu-triangles-draw-color-no-normals-opaque-pipeline");
    expect((gpu.device.createRenderPipeline.mock.calls[2][0] as any).label).toBe("xeokit-webgpu-triangles-draw-color-no-normals-transparent-pipeline");
    expect(gpu.passEncoder.setPipeline.mock.calls[0]).toEqual([gpu.renderPipelines[0]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[0]).toEqual([0, gpu.bindGroup]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[1]).toEqual([1, gpu.bindGroups[1]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[2][0]).toBe(2);
    expect(gpu.passEncoder.drawIndexed.mock.calls[0]).toEqual([3, 1, 0, 0, 0]);
    expect(gpu.passEncoder.setPipeline.mock.calls[1]).toEqual([gpu.renderPipelines[1]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[3]).toEqual([0, gpu.bindGroup]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[4]).toEqual([1, gpu.bindGroups[1]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[5]).toEqual([3, gpu.bindGroups[3]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls[6][0]).toBe(2);
    expect(gpu.passEncoder.drawIndexed.mock.calls[1]).toEqual([3, 1, 0, 0, 0]);
    expect(gpu.passEncoder.setPipeline.mock.calls[2]).toEqual([gpu.renderPipelines[2]]);
    expect(gpu.passEncoder.setBindGroup.mock.calls.slice(7)).toEqual([
      [0, gpu.bindGroup],
      [1, gpu.bindGroups[1]],
      [3, gpu.bindGroups[3]],
      expect.arrayContaining([2])
    ]);
    expect(gpu.passEncoder.drawIndexed.mock.calls[2]).toEqual([3, 1, 0, 0, 0]);
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
    view.needsRender.mockClear();

    viewObject.visible = true;
    viewObject.colorize = [0.9, 0.1, 0.2];
    viewObject.opacityUpdated = true;
    viewObject.opacity = 0.35;

    testViewer.onViewObjectColorizeChanged.emit(view, viewObject);
    expect(view.needsRender).toHaveBeenCalledTimes(1);

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[16]).toBeCloseTo(0.9);
    expect(instanceUpload[17]).toBeCloseTo(0.1);
    expect(instanceUpload[18]).toBeCloseTo(0.2);
    expect(instanceUpload[19]).toBeCloseTo(0.35);

    gpu.passEncoder.drawIndexed.mockClear();
    viewObject.culled = true;

    testViewer.onViewObjectCulledChanged.emit(view, viewObject);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
  });

  test("routes emphasized view objects through WebGPU state bins and packs emphasis style", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view as any).xrayMaterial = {
      fill: true,
      fillColor: [0.85, 0.9, 1.0],
      fillAlpha: 0.35,
      edges: true
    };
    (view as any).highlightMaterial = {
      fill: true,
      fillColor: [1.0, 0.78, 0.25],
      fillAlpha: 0.4,
      edges: true
    };
    (view as any).selectedMaterial = {
      fill: true,
      fillColor: [0.1, 0.7, 1.0],
      fillAlpha: 0.4,
      edges: true
    };
    const {mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {viewObject} = attachMeshToObject(mesh, view, model);
    viewObject.xrayed = true;
    viewObject.highlighted = true;
    viewObject.selected = true;
    viewObject.colorize = [1, 0, 0];
    viewObject.opacityUpdated = true;
    viewObject.opacity = 1;

    testViewer.viewer.scene.models = {model};
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });
    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const instanceUpload = getLastWriteBufferData(gpu, "xeokit-webgpu-instance-buffer");
    expect(instanceUpload[16]).toBeCloseTo(0.1);
    expect(instanceUpload[17]).toBeCloseTo(0.7);
    expect(instanceUpload[18]).toBeCloseTo(1.0);
    expect(instanceUpload[19]).toBeCloseTo(0.4);

    const inspectorResult = renderer.getRenderInspector();
    expect(inspectorResult.ok).toBe(true);
    if (!inspectorResult.ok) {
      throw new Error("Expected WebGPURenderer.getRenderInspector to succeed");
    }
    inspectorResult.value.enabled = true;
    gpu.passEncoder.drawIndexed.mockClear();
    testViewer.onViewUpdated.emit(view, view);

    const frameStats = inspectorResult.value.renderStats.views?.[0];
    expect(frameStats?.renderBins.map((bin) => bin.name)).toEqual([
      "SELECTED_TRANSPARENT",
      "SELECTED_EDGES_TRANSPARENT"
    ]);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledTimes(2);
  });

  test("keeps emphasized WebGPU objects available to GPU picking", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    (view as any).selectedMaterial = {
      fill: true,
      fillColor: [0.1, 0.7, 1.0],
      fillAlpha: 1,
      edges: false
    };
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      meshes: {
        [mesh.id]: mesh
      },
      geometries: {
        [geometry.id]: geometry
      },
      objects: {}
    };
    const {viewObject} = attachMeshToObject(mesh, view, model, "selectedObject");
    viewObject.selected = true;

    testViewer.viewer.scene.models = {model};
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });
    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {canvasPos: [5, 5]});
    expect(pickResult.ok).toBe(true);
    if (!pickResult.ok) {
      throw new Error(pickResult.error);
    }
    expect(pickResult.value?.sceneMesh).toBe(mesh);
    expect(pickResult.value?.viewObject?.id).toBe("selectedObject");
  });

  test("picks a visible triangle mesh through the WebGPU renderer", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [60, 20]
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneMesh).toBe(mesh);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
    expect(pickResult.value?.viewObject).toBe(viewObject);
    expect(Array.from(pickResult.value!.canvasPos)).toEqual([60, 20]);
    expect(Array.from(pickResult.value!.indices!)).toEqual([0, 1, 2]);
    expect(Array.from(pickResult.value!.localPos!).map((value) => Number(value.toFixed(3)))).toEqual([0.2, 0.2, 0]);
    expect(Array.from(pickResult.value!.worldPos!).map((value) => Number(value.toFixed(3)))).toEqual([0.2, 0.2, 0]);
    expect(Array.from(pickResult.value!.viewPos!).map((value) => Number(value.toFixed(3)))).toEqual([0.2, 0.2, 0]);
  });

  test("does not CPU-pick WebGPU triangle hits clipped by section planes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.sectionPlanesList = [{active: true, dir: [1, 0, 0], dist: 0}];
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "clippedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [60, 20]
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value).toBeNull();
  });

  test("CPU-picks WebGPU triangle hits when the ViewObject is not clippable", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.sectionPlanesList = [{active: true, dir: [1, 0, 0], dist: 0}];
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "unclippableObject");
    viewObject.clippable = false;

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [60, 20]
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
  });

  test("can resolve a visible triangle mesh through the async WebGPU pick pass", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "gpuPickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "bgra8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {
      canvasPos: [60, 20]
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneMesh).toBe(mesh);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
    expect(pickResult.value?.viewObject).toBe(viewObject);
    expect(Array.from(pickResult.value!.indices!)).toEqual([0, 1, 2]);
    expect(gpu.commandEncoder.copyTextureToBuffer).toHaveBeenCalled();
    const copyCall = gpu.commandEncoder.copyTextureToBuffer.mock.calls.at(-1)!;
    expect(copyCall[0].origin).toEqual({
      x: 60,
      y: 20,
      z: 0
    });
    const pickPipeline = gpu.renderPipelines.find((pipeline: any) => pipeline.descriptor?.label === "xeokit-webgpu-triangles-pick-pipeline");
    expect(pickPipeline?.descriptor.fragment.targets[0].format).toBe("rgba8unorm");
    const readbackBuffer = getBufferByLabel(gpu, "xeokit-webgpu-pick-readback-buffer");
    expect(readbackBuffer.mapAsync).toHaveBeenCalledWith(1);
    expect(readbackBuffer.unmap).toHaveBeenCalled();
  });

  test("serializes overlapping async WebGPU pick readbacks", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "gpuQueuedPickObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const [firstPick, secondPick] = await Promise.all([
      renderer.pickGPUAsync(view as any, {
        canvasPos: [60, 20]
      }),
      renderer.pickGPUAsync(view as any, {
        canvasPos: [61, 21]
      })
    ]);

    expect(firstPick.ok).toBe(true);
    expect(secondPick.ok).toBe(true);
    expect(firstPick.value?.sceneMesh).toBe(mesh);
    expect(secondPick.value?.sceneMesh).toBe(mesh);
    const readbackBuffer = getBufferByLabel(gpu, "xeokit-webgpu-pick-readback-buffer");
    expect(readbackBuffer.mapAsync).toHaveBeenCalledTimes(2);
    expect(readbackBuffer.unmap).toHaveBeenCalledTimes(2);
  });

  test("can resolve vertex snapping through the async WebGPU snap pass", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "gpuSnappedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {
      canvasPos: [52, 24],
      snapToVertex: true,
      snapRadius: 8
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
    expect(pickResult.value?.viewObject).toBe(viewObject);
    expect(pickResult.value?.snappedToVertex).toBe(true);
    expect(pickResult.value?.snappedToEdge).toBe(false);
    expect(Array.from(pickResult.value!.snappedCanvasPos!).map(Math.round)).toEqual([50, 25]);
    expect(Array.from(pickResult.value!.worldPos!).map((value) => Number(value.toFixed(3)))).toEqual([0, 0, 0]);

    const snapReadbackBuffer = getBufferByLabel(gpu, "xeokit-webgpu-snap-readback-buffer:8");
    expect(snapReadbackBuffer.mapAsync).toHaveBeenCalledWith(1);
    expect(snapReadbackBuffer.unmap).toHaveBeenCalled();
    const copyCall = gpu.commandEncoder.copyTextureToBuffer.mock.calls.at(-1)!;
    expect(copyCall[2]).toEqual({
      width: 17,
      height: 17,
      depthOrArrayLayers: 1
    });
  });

  test("can resolve edge snapping through the async WebGPU snap pass", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {sceneObject, viewObject} = attachMeshToObject(mesh, view, model, "gpuEdgeSnappedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {
      canvasPos: [75, 24],
      snapToEdge: true,
      snapRadius: 8
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject).toBe(sceneObject);
    expect(pickResult.value?.viewObject).toBe(viewObject);
    expect(pickResult.value?.snappedToVertex).toBe(false);
    expect(pickResult.value?.snappedToEdge).toBe(true);
    expect(Array.from(pickResult.value!.snappedCanvasPos!).map(Math.round)).toEqual([75, 25]);
    expect(Array.from(pickResult.value!.worldPos!).map((value) => Number(value.toFixed(3)))).toEqual([0.5, 0, 0]);

    const snapReadbackBuffer = getBufferByLabel(gpu, "xeokit-webgpu-snap-readback-buffer:8");
    expect(snapReadbackBuffer.mapAsync).toHaveBeenCalledWith(1);
    expect(snapReadbackBuffer.unmap).toHaveBeenCalled();
    expect(gpu.commandEncoder.beginRenderPass).toHaveBeenCalledWith(expect.objectContaining({
      depthStencilAttachment: expect.objectContaining({
        depthLoadOp: "load"
      })
    }));
  });

  test("async WebGPU edge snapping respects explicit edge indices", async () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createQuadMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "gpuQuadObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    gpu.pickReadbackBytes.set([1, 0, 0, 0]);
    const pickResult = await renderer.pickGPUAsync(view as any, {
      canvasPos: [75, 12],
      snapToEdge: true,
      snapRadius: 5
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.snappedToEdge).not.toBe(true);
  });

  test("respects WebGPU view-object pickable and visibility state when picking", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    const {viewObject} = attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    viewObject.pickable = false;
    expect(renderer.pick(view as any, {canvasPos: [60, 20]}).value).toBeNull();

    viewObject.pickable = true;
    viewObject.visible = false;
    expect(renderer.pick(view as any, {canvasPos: [60, 20]}).value).toBeNull();

    const invisiblePick = renderer.pick(view as any, {
      canvasPos: [60, 20],
      pickInvisible: true
    });
    expect(invisiblePick.ok).toBe(true);
    expect(invisiblePick.value?.sceneMesh).toBe(mesh);
  });

  test("updates WebGPU picking after dynamic mesh destruction", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);
    expect(renderer.pick(view as any, {canvasPos: [60, 20]}).value?.sceneMesh).toBe(mesh);

    testViewer.onSceneMeshDestroyed.emit(testViewer.viewer.scene, mesh);

    expect(renderer.pick(view as any, {canvasPos: [60, 20]}).value).toBeNull();
  });

  test("snaps WebGPU picks to nearby triangle vertices", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [52, 24],
      snapToVertex: true,
      snapRadius: 8
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.snappedToVertex).toBe(true);
    expect(pickResult.value?.snappedToEdge).toBe(false);
    expect(Array.from(pickResult.value!.snappedCanvasPos!).map(Math.round)).toEqual([50, 25]);
    expect(Array.from(pickResult.value!.worldPos!).map((value) => Number(value.toFixed(3)))).toEqual([0, 0, 0]);
  });

  test("snaps WebGPU picks to the third triangle vertex", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [52, 2],
      snapToVertex: true,
      snapRadius: 8
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.snappedToVertex).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("pickedObject");
    expect(Array.from(pickResult.value!.snappedCanvasPos!).map(Math.round)).toEqual([50, 0]);
    expect(Array.from(pickResult.value!.worldPos!).map((value) => Number(value.toFixed(3)))).toEqual([0, 1, 0]);
  });

  test("snaps WebGPU picks to nearby triangle edges", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [75, 24],
      snapToEdge: true,
      snapRadius: 8
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.snappedToVertex).toBe(false);
    expect(pickResult.value?.snappedToEdge).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("pickedObject");
    expect(Array.from(pickResult.value!.snappedCanvasPos!).map(Math.round)).toEqual([75, 25]);
    expect(Array.from(pickResult.value!.worldPos!).map((value) => Number(value.toFixed(3)))).toEqual([0.5, 0, 0]);
  });

  test("snaps WebGPU edge picks when the cursor is near but outside the triangle surface", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [75, 28],
      snapToEdge: true,
      snapRadius: 5
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("pickedObject");
    expect(pickResult.value?.snappedToEdge).toBe(true);
    expect(Array.from(pickResult.value!.snappedCanvasPos!).map(Math.round)).toEqual([75, 25]);
  });

  test("does not snap WebGPU edge picks to hidden triangulation diagonals", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createQuadMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [75, 12],
      snapToEdge: true,
      snapRadius: 5
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.snappedToEdge).not.toBe(true);
  });

  test("snaps WebGPU edge picks to visible silhouette edges without a covering triangle", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createQuadMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };
    attachMeshToObject(mesh, view, model, "pickedObject");

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [75, -3],
      snapToEdge: true,
      snapRadius: 5
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("pickedObject");
    expect(pickResult.value?.snappedToEdge).toBe(true);
    expect(Array.from(pickResult.value!.snappedCanvasPos!).map(Math.round)).toEqual([75, 0]);
  });

  test("does not snap WebGPU edge picks to occluded boundary edges", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const front = createQuadMesh("frontQuad", [0, 0, 0, 1, 1, 0]);
    const back = createQuadMesh("backQuad", [0.2, 0.2, 0.5, 0.8, 0.3, 0.5]);
    const model = {
      id: "model",
      building: false,
      geometries: {
        [front.geometry.id]: front.geometry,
        [back.geometry.id]: back.geometry
      },
      meshes: {
        [front.mesh.id]: front.mesh,
        [back.mesh.id]: back.mesh
      },
      objects: {}
    };
    attachMeshToObject(front.mesh, view, model, "frontObject");
    attachMeshToObject(back.mesh, view, model, "backObject");

    (front.geometry as any).model = model;
    (front.mesh as any).model = model;
    (back.geometry as any).model = model;
    (back.mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: [75, 18],
      snapToEdge: true,
      snapRadius: 3
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.snappedToEdge).not.toBe(true);
  });

  test("snaps WebGPU edge picks to transformed shared-geometry table legs", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    setPerspectiveTableCamera(view);

    const geometry = createBoxGeometry();
    const legMesh = createBoxMesh(
      "redLeg-mesh",
      geometry,
      createScaleTranslateMatrix([-4, -4, 3], [1, 1, 3])
    );
    const tableTopMesh = createBoxMesh(
      "tableTop-mesh",
      geometry,
      createScaleTranslateMatrix([0, 0, 6], [6, 6, 0.5])
    );
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [legMesh.id]: legMesh,
        [tableTopMesh.id]: tableTopMesh
      },
      objects: {}
    };
    attachMeshToObject(legMesh, view, model, "redLeg");
    attachMeshToObject(tableTopMesh, view, model, "purpleTableTop");

    (geometry as any).model = model;
    (legMesh as any).model = model;
    (tableTopMesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: projectWorldToCanvas(view, [-5, -5, 3]),
      snapToEdge: true,
      snapRadius: 10
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.snappedToEdge).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("redLeg");
  });

  test("surface-picks transformed shared-geometry table legs", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    setPerspectiveTableCamera(view);

    const geometry = createBoxGeometry();
    const legMesh = createBoxMesh(
      "redLeg-mesh",
      geometry,
      createScaleTranslateMatrix([-4, -4, 3], [1, 1, 3])
    );
    const tableTopMesh = createBoxMesh(
      "tableTop-mesh",
      geometry,
      createScaleTranslateMatrix([0, 0, 6], [6, 6, 0.5])
    );
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [legMesh.id]: legMesh,
        [tableTopMesh.id]: tableTopMesh
      },
      objects: {}
    };
    attachMeshToObject(legMesh, view, model, "redLeg");
    attachMeshToObject(tableTopMesh, view, model, "purpleTableTop");

    (geometry as any).model = model;
    (legMesh as any).model = model;
    (tableTopMesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: projectWorldToCanvas(view, [-5, -5, 3])
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("redLeg");
  });

  test("snaps WebGPU edge picks while hovering over a transformed table leg face", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    view.boundary[2] = 780;
    view.boundary[3] = 441;
    setPerspectiveTableCamera(view);

    const geometry = createBoxGeometry();
    const legMesh = createBoxMesh(
      "redLeg-mesh",
      geometry,
      createScaleTranslateMatrix([-4, -4, 3], [1, 1, 3])
    );
    const tableTopMesh = createBoxMesh(
      "tableTop-mesh",
      geometry,
      createScaleTranslateMatrix([0, 0, 6], [6, 6, 0.5])
    );
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [legMesh.id]: legMesh,
        [tableTopMesh.id]: tableTopMesh
      },
      objects: {}
    };
    attachMeshToObject(legMesh, view, model, "redLeg");
    attachMeshToObject(tableTopMesh, view, model, "purpleTableTop");

    (geometry as any).model = model;
    (legMesh as any).model = model;
    (tableTopMesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: projectWorldToCanvas(view, [-5, -4, 3]),
      snapToEdge: true,
      snapRadius: 22
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("redLeg");
    expect(pickResult.value?.snappedToEdge).toBe(true);
  });

  test("snaps real SceneModel position-scale table leg vertices", () => {
    const gpu = createWebGPUHarness();
    const scene = new Scene({logging: false});
    const testViewer = createViewer(false);
    testViewer.viewer.scene = scene;
    const view = createView(testViewer.viewer, gpu.context);
    view.boundary[2] = 780;
    view.boundary[3] = 441;
    setPerspectiveTableCamera(view);
    testViewer.viewer.viewList.push(view);

    const modelResult = scene.createModel(createTableSceneModelParams() as any);
    expect(modelResult.ok).toBe(true);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const attachResult = renderer.attachViewer(testViewer.viewer as any);
    expect(attachResult.ok).toBe(true);

    const pickResult = renderer.pick(view as any, {
      canvasPos: projectWorldToCanvas(view, [-5, -5, 0]),
      snapToVertex: true,
      snapRadius: 12
    });

    expect(pickResult.ok).toBe(true);
    expect(pickResult.value?.sceneObject?.id).toBe("redLeg");
    expect(pickResult.value?.snappedToVertex).toBe(true);
  });

  test("handles dynamic scene mesh creation and destruction events", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();

    view.needsRender.mockClear();
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometry);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, mesh);

    expect(view.needsRender).toHaveBeenCalledTimes(1);

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
    const packedPositions = getBufferByLabel(gpu, "xeokit-webgpu-packed-positions:triangles:model_dynamic_stream_page_0");
    const packedVertexMetadata = getBufferByLabel(gpu, "xeokit-webgpu-packed-vertex-metadata:triangles:model_dynamic_stream_page_0");
    const packedIndices = getBufferByLabel(gpu, "xeokit-webgpu-packed-indices:triangles:model_dynamic_stream_page_0");

    gpu.passEncoder.drawIndexed.mockClear();
    view.needsRender.mockClear();
    testViewer.onSceneMeshDestroyed.emit(testViewer.viewer.scene, mesh);

    expect(view.needsRender).toHaveBeenCalledTimes(1);

    testViewer.onViewUpdated.emit(view, view);

    expect(packedPositions.destroy).toHaveBeenCalledTimes(1);
    expect(packedVertexMetadata.destroy).toHaveBeenCalledTimes(1);
    expect(packedIndices.destroy).toHaveBeenCalledTimes(1);
    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
  });

  test("responds to dynamic object mesh attachment and removal", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: false,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.scene.models = {
      model
    };
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);
    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);

    const sceneObject = {
      id: "object",
      model,
      meshes: [mesh],
      destroyed: false
    };
    const viewObject = {
      id: sceneObject.id,
      view,
      sceneObject,
      visible: false,
      culled: false,
      colorize: null,
      opacityUpdated: false,
      opacity: 1
    };

    (model.objects as any)[sceneObject.id] = sceneObject;
    (mesh as any).object = sceneObject;
    (view.objects as any)[sceneObject.id] = viewObject;

    gpu.passEncoder.drawIndexed.mockClear();
    view.needsRender.mockClear();
    testViewer.onSceneObjectMeshAdded.emit(sceneObject, mesh);

    expect(view.needsRender).toHaveBeenCalledTimes(1);

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();

    (mesh as any).object = undefined;
    sceneObject.meshes.length = 0;
    gpu.passEncoder.drawIndexed.mockClear();
    view.needsRender.mockClear();
    testViewer.onSceneObjectMeshRemoved.emit(sceneObject, mesh);

    expect(view.needsRender).toHaveBeenCalledTimes(1);

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("defers building-model registrations until build finishes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const model = {
      id: "model",
      building: true,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);

    view.needsRender.mockClear();
    testViewer.onSceneModelBuildStarted.emit(testViewer.viewer.scene, model);
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometry);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.device.createBuffer).not.toHaveBeenCalled();
    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
    expect(view.needsRender).not.toHaveBeenCalled();

    model.building = false;
    testViewer.onSceneModelBuildFinished.emit(testViewer.viewer.scene, model);

    expect(view.needsRender).toHaveBeenCalled();

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("defers batched model registrations until batch commit", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const batch = {
      id: "hospital:xgf",
      committed: false,
      geometries: [geometry],
      meshes: [mesh],
      objects: [],
      includesGeometry: (value: unknown) => value === geometry,
      includesMesh: (value: unknown) => value === mesh,
      includesObject: () => false
    };
    const model = {
      id: "model",
      building: false,
      activeBatch: batch,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);

    view.needsRender.mockClear();
    testViewer.onSceneModelBatchStarted.emit(model, batch);
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometry);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.device.createBuffer).not.toHaveBeenCalled();
    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
    expect(view.needsRender).not.toHaveBeenCalled();

    batch.committed = true;
    (model as any).activeBatch = null;
    testViewer.onSceneModelBatchCommitted.emit(model, batch);

    expect(view.needsRender).toHaveBeenCalled();

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
  });

  test("keeps batched model registrations hidden until build finishes", () => {
    const gpu = createWebGPUHarness();
    const testViewer = createViewer(true);
    const view = createView(testViewer.viewer, gpu.context);
    const {geometry, mesh} = createTriangleMesh();
    const batch = {
      id: "hospital:xgf",
      committed: false,
      geometries: [geometry],
      meshes: [mesh],
      objects: [],
      includesGeometry: (value: unknown) => value === geometry,
      includesMesh: (value: unknown) => value === mesh,
      includesObject: () => false
    };
    const model = {
      id: "model",
      building: true,
      activeBatch: batch,
      geometries: {
        [geometry.id]: geometry
      },
      meshes: {
        [mesh.id]: mesh
      },
      objects: {}
    };

    (geometry as any).model = model;
    (mesh as any).model = model;
    testViewer.viewer.viewList.push(view);

    const renderer = new WebGPURenderer({
      device: gpu.device,
      contextFormat: "rgba8unorm",
      logging: false
    });

    const result = renderer.attachViewer(testViewer.viewer as any);

    expect(result.ok).toBe(true);

    view.needsRender.mockClear();
    testViewer.onSceneModelBuildStarted.emit(testViewer.viewer.scene, model);
    testViewer.onSceneModelBatchStarted.emit(model, batch);
    testViewer.onSceneGeometryCreated.emit(testViewer.viewer.scene, geometry);
    testViewer.onSceneMeshCreated.emit(testViewer.viewer.scene, mesh);
    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).not.toHaveBeenCalled();
    expect(view.needsRender).not.toHaveBeenCalled();

    batch.committed = true;
    (model as any).activeBatch = null;
    testViewer.onSceneModelBatchCommitted.emit(model, batch);

    expect(view.needsRender).not.toHaveBeenCalled();

    model.building = false;
    testViewer.onSceneModelBuildFinished.emit(testViewer.viewer.scene, model);

    expect(view.needsRender).toHaveBeenCalled();

    testViewer.onViewUpdated.emit(view, view);

    expect(gpu.passEncoder.drawIndexed).toHaveBeenCalledWith(3, 1, 0, 0, 0);
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

  test("create requests timestamp-query when GPU timestamps are enabled", async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const gpu = createWebGPUHarness();
    const adapter = {
      features: {
        has: jest.fn((feature: string) => feature === "timestamp-query")
      },
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
      const result = await WebGPURenderer.create({
        logging: false,
        renderConfigs: {
          gpuTimestamps: true
        }
      });

      expect(result.ok).toBe(true);
      expect(adapter.requestDevice).toHaveBeenCalledWith({
        requiredFeatures: ["timestamp-query"]
      });
    } finally {
      restoreNavigator(originalNavigator);
    }
  });

  test("create requests multi-draw indirect when the adapter exposes it", async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const gpu = createWebGPUHarness();
    const adapter = {
      features: {
        has: jest.fn((feature: string) => feature === "chromium-experimental-multi-draw-indirect")
      },
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
      expect(adapter.requestDevice).toHaveBeenCalledWith({
        requiredFeatures: ["chromium-experimental-multi-draw-indirect"]
      });
    } finally {
      restoreNavigator(originalNavigator);
    }
  });

  test("owns WebGPU pick and snap render targets behind manager-style resources", () => {
    const gpu = createWebGPUHarness();
    const renderContext = new RenderContext({
      device: gpu.device,
      contextFormat: "bgra8unorm",
      memoryConfigs: createMemoryConfigs({
        grossMemoryMB: 64,
        device: "medium",
        utilization: 0.5
      }),
      renderConfigs: createWebGPURenderConfigs()
    });
    const pickBuffer = new WebGPUPickBuffer(renderContext);
    const snapBufferCache = new WebGPUSnapBufferCache(renderContext);

    expect(pickBuffer.ensureSize(1, 1).ok).toBe(true);
    const snapBufferResult = snapBufferCache.get(32);
    expect(snapBufferResult.ok).toBe(true);
    expect(snapBufferCache.get(32).ok).toBe(true);

    expect(gpu.device.createTexture).toHaveBeenCalledTimes(4);
    expect(gpu.device.createTexture.mock.calls[0][0]).toMatchObject({
      label: "xeokit-webgpu-pick-color-texture",
      format: "rgba8unorm"
    });
    expect(gpu.device.createTexture.mock.calls[2][0]).toMatchObject({
      label: "xeokit-webgpu-snap-color-texture:32",
      format: "rgba8unorm"
    });
    const snapReadbackBuffer = getBufferByLabel(gpu, "xeokit-webgpu-snap-readback-buffer:32");
    expect(snapReadbackBuffer.descriptor.size).toBe(512 * 65);
    expect(snapBufferResult.value.getCopyDestination()?.bytesPerRow).toBe(512);

    pickBuffer.destroy();
    snapBufferCache.destroy();
    expect(gpu.depthTextures.every((texture: any) => texture.destroy.mock.calls.length === 1)).toBe(true);
  });
});
