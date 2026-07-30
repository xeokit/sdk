import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import {
  clearTriangleGeometryVBOViewState,
  TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT,
  type TriangleGeometryVBOViewState
} from "./TriangleGeometryVBOState";
import {TriangleGeometryVBOSpanAllocator} from "./TriangleGeometryVBOSpanAllocator";

/**
 * Owns the CPU arrays and WebGL buffers used by one triangle VBO batch.
 *
 * The batch writes mesh data into the CPU arrays, marks the changed vertex or
 * index ranges dirty, then asks this store to upload only those ranges to WebGL.
 *
 * @internal
 */
export class TriangleGeometryVBOBuffers {
  private _positions: Float32Array | null = null;
  private _meshIndices: Uint32Array | null = null;
  private _geometryVertexIndices: Uint32Array | null = null;
  private _positionBuffer: WebGLBuffer | null = null;
  private _meshIndexBuffer: WebGLBuffer | null = null;
  private _geometryVertexIndexBuffer: WebGLBuffer | null = null;
  private _positionDirtyMinVertex = Number.POSITIVE_INFINITY;
  private _positionDirtyMaxVertex = -1;
  private _meshIndexDirtyMinVertex = Number.POSITIVE_INFINITY;
  private _meshIndexDirtyMaxVertex = -1;
  private _geometryVertexIndexDirtyMinVertex = Number.POSITIVE_INFINITY;
  private _geometryVertexIndexDirtyMaxVertex = -1;

  get positions(): Float32Array | null {
    return this._positions;
  }

  get meshIndices(): Uint32Array | null {
    return this._meshIndices;
  }

  get geometryVertexIndices(): Uint32Array | null {
    return this._geometryVertexIndices;
  }

  get positionBuffer(): WebGLBuffer | null {
    return this._positionBuffer;
  }

  get meshIndexBuffer(): WebGLBuffer | null {
    return this._meshIndexBuffer;
  }

  get geometryVertexIndexBuffer(): WebGLBuffer | null {
    return this._geometryVertexIndexBuffer;
  }

  allocateCPU(params: {
    vertexCapacity: number;
    indexCapacity: number;
    edgeIndexCapacity: number;
    views: TriangleGeometryVBOViewState[];
  }): SDKResult<void> {
    try {
      this._positions = new Float32Array(params.vertexCapacity * 4);
      this._meshIndices = new Uint32Array(params.vertexCapacity);
      this._geometryVertexIndices = new Uint32Array(params.vertexCapacity);
      for (const view of params.views) {
        view.indices = new Uint32Array(params.indexCapacity * TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT);
        view.edgeIndices = new Uint32Array(params.edgeIndexCapacity * TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT);
        view.colors = new Uint8Array(params.vertexCapacity * 4);
      }
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.MemoryExceeded,
        error: `[TriangleGeometryVBOBatch.allocate] CPU buffer allocation failed: ${e}`
      };
    }
    return {ok: true, value: undefined};
  }

  allocateGPU(params: {
    gl: WebGL2RenderingContext;
    vertexCapacity: number;
    indexCapacity: number;
    edgeIndexCapacity: number;
    views: TriangleGeometryVBOViewState[];
  }): SDKResult<void> {
    const gl = params.gl;
    const created: WebGLBuffer[] = [];
    const makeBuffer = (target: number, byteLength: number): WebGLBuffer | null => {
      const buffer = gl.createBuffer();
      if (!buffer) {
        return null;
      }
      created.push(buffer);
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(target, null);
      return buffer;
    };

    try {
      this._positionBuffer = makeBuffer(gl.ARRAY_BUFFER, params.vertexCapacity * 4 * 4);
      this._meshIndexBuffer = makeBuffer(gl.ARRAY_BUFFER, params.vertexCapacity * 4);
      this._geometryVertexIndexBuffer = makeBuffer(gl.ARRAY_BUFFER, params.vertexCapacity * 4);
      if (!this._positionBuffer || !this._meshIndexBuffer || !this._geometryVertexIndexBuffer) {
        throw new Error("Failed to allocate static VBO buffers");
      }
      for (const view of params.views) {
        view.indexBuffer = makeBuffer(gl.ELEMENT_ARRAY_BUFFER, params.indexCapacity * TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT * 4);
        view.edgeIndexBuffer = makeBuffer(gl.ELEMENT_ARRAY_BUFFER, params.edgeIndexCapacity * TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT * 4);
        view.colorBuffer = makeBuffer(gl.ARRAY_BUFFER, params.vertexCapacity * 4);
        if (!view.indexBuffer || !view.edgeIndexBuffer || !view.colorBuffer) {
          throw new Error("Failed to allocate per-view VBO buffers");
        }
      }
      return {ok: true, value: undefined};
    } catch (e) {
      for (const buffer of created) {
        gl.deleteBuffer(buffer);
      }
      this._positionBuffer = null;
      this._meshIndexBuffer = null;
      this._geometryVertexIndexBuffer = null;
      for (const view of params.views) {
        view.indexBuffer = null;
        view.edgeIndexBuffer = null;
        view.colorBuffer = null;
      }
      return {
        ok: false,
        type: SDKErrorType.MemoryExceeded,
        error: `[TriangleGeometryVBOBatch.allocate] GPU buffer allocation failed: ${e}`
      };
    }
  }

  deleteGPUResources(gl: WebGL2RenderingContext, views: TriangleGeometryVBOViewState[]): void {
    if (this._positionBuffer) {
      gl.deleteBuffer(this._positionBuffer);
      this._positionBuffer = null;
    }
    if (this._meshIndexBuffer) {
      gl.deleteBuffer(this._meshIndexBuffer);
      this._meshIndexBuffer = null;
    }
    if (this._geometryVertexIndexBuffer) {
      gl.deleteBuffer(this._geometryVertexIndexBuffer);
      this._geometryVertexIndexBuffer = null;
    }
    for (const view of views) {
      if (view.indexBuffer) {
        gl.deleteBuffer(view.indexBuffer);
        view.indexBuffer = null;
      }
      if (view.edgeIndexBuffer) {
        gl.deleteBuffer(view.edgeIndexBuffer);
        view.edgeIndexBuffer = null;
      }
      if (view.colorBuffer) {
        gl.deleteBuffer(view.colorBuffer);
        view.colorBuffer = null;
      }
    }
  }

  destroyCPU(views: TriangleGeometryVBOViewState[]): void {
    this._positions = null;
    this._meshIndices = null;
    this._geometryVertexIndices = null;
    this._positionDirtyMinVertex = Number.POSITIVE_INFINITY;
    this._positionDirtyMaxVertex = -1;
    this._meshIndexDirtyMinVertex = Number.POSITIVE_INFINITY;
    this._meshIndexDirtyMaxVertex = -1;
    this._geometryVertexIndexDirtyMinVertex = Number.POSITIVE_INFINITY;
    this._geometryVertexIndexDirtyMaxVertex = -1;
    for (const view of views) {
      clearTriangleGeometryVBOViewState(view);
    }
  }

  markAllDirty(nextVertex: number, views: TriangleGeometryVBOViewState[]): void {
    if (nextVertex <= 0) {
      return;
    }
    this.markPositionDirty(0, nextVertex);
    this.markMeshIndexDirty(0, nextVertex);
    this.markGeometryVertexIndexDirty(0, nextVertex);
    for (const view of views) {
      view.indicesDirty = true;
      this.markColorDirty(view, 0, nextVertex);
    }
  }

  markPositionDirty(vertexBase: number, vertexCount: number): void {
    this._positionDirtyMinVertex = Math.min(this._positionDirtyMinVertex, vertexBase);
    this._positionDirtyMaxVertex = Math.max(this._positionDirtyMaxVertex, vertexBase + vertexCount - 1);
  }

  markMeshIndexDirty(vertexBase: number, vertexCount: number): void {
    this._meshIndexDirtyMinVertex = Math.min(this._meshIndexDirtyMinVertex, vertexBase);
    this._meshIndexDirtyMaxVertex = Math.max(this._meshIndexDirtyMaxVertex, vertexBase + vertexCount - 1);
  }

  markGeometryVertexIndexDirty(vertexBase: number, vertexCount: number): void {
    this._geometryVertexIndexDirtyMinVertex = Math.min(this._geometryVertexIndexDirtyMinVertex, vertexBase);
    this._geometryVertexIndexDirtyMaxVertex = Math.max(this._geometryVertexIndexDirtyMaxVertex, vertexBase + vertexCount - 1);
  }

  markColorDirty(view: TriangleGeometryVBOViewState, vertexBase: number, vertexCount: number): void {
    view.colorDirtyMinVertex = Math.min(view.colorDirtyMinVertex, vertexBase);
    view.colorDirtyMaxVertex = Math.max(view.colorDirtyMaxVertex, vertexBase + vertexCount - 1);
  }

  markIndexRangeDirty(view: TriangleGeometryVBOViewState, base: number, count: number): void {
    if (count > 0) {
      view.indexDirtySpans.push({base, count});
    }
  }

  markEdgeIndexRangeDirty(view: TriangleGeometryVBOViewState, base: number, count: number): void {
    if (count > 0) {
      view.edgeIndexDirtySpans.push({base, count});
    }
  }

  uploadChanges(params: {
    gl: WebGL2RenderingContext;
    views: TriangleGeometryVBOViewState[];
    rebuildViewIndices: (view: TriangleGeometryVBOViewState, viewIndex: number) => void;
  }): boolean {
    let uploaded = false;
    for (let viewIndex = 0; viewIndex < params.views.length; viewIndex++) {
      const view = params.views[viewIndex];
      if (view.indicesDirty) {
        params.rebuildViewIndices(view, viewIndex);
      }
    }
    uploaded = this._uploadPositionRange(params.gl) || uploaded;
    uploaded = this._uploadMeshIndexRange(params.gl) || uploaded;
    uploaded = this._uploadGeometryVertexIndexRange(params.gl) || uploaded;
    for (const view of params.views) {
      uploaded = this._uploadViewColorRange(params.gl, view) || uploaded;
      uploaded = this._uploadViewIndexBuffer(params.gl, view) || uploaded;
      uploaded = this._uploadViewEdgeIndexBuffer(params.gl, view) || uploaded;
    }
    return uploaded;
  }

  getAllocatedBytes(params: {
    vertexCapacity: number;
    indexCapacity: number;
    edgeIndexCapacity: number;
    maxViews: number;
  }): number {
    return params.vertexCapacity * 4 * 4 +
      params.vertexCapacity * 4 +
      params.vertexCapacity * 4 +
      params.maxViews * (
        params.vertexCapacity * 4 +
        params.indexCapacity * TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT * 4 +
        params.edgeIndexCapacity * TRIANGLE_GEOMETRY_VBO_INDEX_REGION_COUNT * 4
      );
  }

  getUsedBytes(params: {
    activeVertices: number;
    maxViews: number;
    views: TriangleGeometryVBOViewState[];
  }): number {
    let activeIndices = 0;
    let activeEdgeIndices = 0;
    for (const view of params.views) {
      activeIndices += view.indexCount;
      activeEdgeIndices += view.edgeIndexCount;
    }
    return params.activeVertices * 4 * 4 +
      params.activeVertices * 4 +
      params.activeVertices * 4 +
      params.maxViews * (params.activeVertices * 4) +
      activeIndices * 4 +
      activeEdgeIndices * 4;
  }

  private _uploadPositionRange(gl: WebGL2RenderingContext): boolean {
    if (!this._positionBuffer || !this._positions || this._positionDirtyMaxVertex < this._positionDirtyMinVertex) {
      return false;
    }
    const start = this._positionDirtyMinVertex * 4;
    const end = (this._positionDirtyMaxVertex + 1) * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, start * 4, this._positions.subarray(start, end));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._positionDirtyMinVertex = Number.POSITIVE_INFINITY;
    this._positionDirtyMaxVertex = -1;
    return true;
  }

  private _uploadMeshIndexRange(gl: WebGL2RenderingContext): boolean {
    if (!this._meshIndexBuffer || !this._meshIndices || this._meshIndexDirtyMaxVertex < this._meshIndexDirtyMinVertex) {
      return false;
    }
    const start = this._meshIndexDirtyMinVertex;
    const end = this._meshIndexDirtyMaxVertex + 1;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._meshIndexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, start * 4, this._meshIndices.subarray(start, end));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._meshIndexDirtyMinVertex = Number.POSITIVE_INFINITY;
    this._meshIndexDirtyMaxVertex = -1;
    return true;
  }

  private _uploadGeometryVertexIndexRange(gl: WebGL2RenderingContext): boolean {
    if (!this._geometryVertexIndexBuffer || !this._geometryVertexIndices || this._geometryVertexIndexDirtyMaxVertex < this._geometryVertexIndexDirtyMinVertex) {
      return false;
    }
    const start = this._geometryVertexIndexDirtyMinVertex;
    const end = this._geometryVertexIndexDirtyMaxVertex + 1;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._geometryVertexIndexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, start * 4, this._geometryVertexIndices.subarray(start, end));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._geometryVertexIndexDirtyMinVertex = Number.POSITIVE_INFINITY;
    this._geometryVertexIndexDirtyMaxVertex = -1;
    return true;
  }

  private _uploadViewColorRange(gl: WebGL2RenderingContext, view: TriangleGeometryVBOViewState): boolean {
    if (!view.colorBuffer || !view.colors || view.colorDirtyMaxVertex < view.colorDirtyMinVertex) {
      return false;
    }
    const start = view.colorDirtyMinVertex * 4;
    const end = (view.colorDirtyMaxVertex + 1) * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, view.colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, start, view.colors.subarray(start, end));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    view.colorDirtyMinVertex = Number.POSITIVE_INFINITY;
    view.colorDirtyMaxVertex = -1;
    return true;
  }

  private _uploadViewIndexBuffer(gl: WebGL2RenderingContext, view: TriangleGeometryVBOViewState): boolean {
    if (!view.indexBuffer || !view.indices || view.indexDirtySpans.length === 0) {
      return false;
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, view.indexBuffer);
    TriangleGeometryVBOSpanAllocator.coalesceSpans(view.indexDirtySpans);
    for (const span of view.indexDirtySpans) {
      const end = span.base + span.count;
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, span.base * 4, view.indices.subarray(span.base, end));
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    view.indexDirtySpans.length = 0;
    return true;
  }

  private _uploadViewEdgeIndexBuffer(gl: WebGL2RenderingContext, view: TriangleGeometryVBOViewState): boolean {
    if (!view.edgeIndexBuffer || !view.edgeIndices || view.edgeIndexDirtySpans.length === 0) {
      return false;
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, view.edgeIndexBuffer);
    TriangleGeometryVBOSpanAllocator.coalesceSpans(view.edgeIndexDirtySpans);
    for (const span of view.edgeIndexDirtySpans) {
      const end = span.base + span.count;
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, span.base * 4, view.edgeIndices.subarray(span.base, end));
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    view.edgeIndexDirtySpans.length = 0;
    return true;
  }
}
