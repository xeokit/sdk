import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {Mat4} from "../../../../base/math/matrix";
import type {RenderPassValue} from "../RENDER_PASSES";
import type {BatchGPUResources} from "../gpuMemoryManager/BatchGPUResources";
import type {PrimRange} from "../gpuMemoryManager/geometry/PrimRange";
import type {
  TriangleGeometryVBODrawState,
  TriangleGeometryVBOTileDrawState
} from "../gpuMemoryManager/vbos/TriangleGeometryVBOBatch";
import type {MatrixTexture} from "../gpuMemoryManager/dataTextures/MatrixTexture";

type TextureLike = { texture: WebGLTexture | null } | null | undefined;

export type DrawTechniqueGeometryBindingSamplers = {
  primitiveMeshIndex: WebGLUniformLocation | null;
  meshMatrixTexture: WebGLUniformLocation | null;
  geometryQuantRangeTexture: WebGLUniformLocation | null;
  vertexPositionTexture: WebGLUniformLocation | null;
  vertexColorTexture: WebGLUniformLocation | null;
  indexTexture: WebGLUniformLocation | null;
};

export type DrawTechniqueGeometryTextureBinder = (
  sampler: WebGLUniformLocation | null,
  dataTexture: TextureLike
) => void;

type DrawTechniqueGeometryBindingParams = {
  batchResources: BatchGPUResources;
  primitive: number | undefined;
  viewIndex: number;
  renderPass: RenderPassValue;
  edges: boolean;
  picking: boolean;
  snap: 0 | 1 | 2 | 3;
  thickLines: boolean;
  vboGeometry: boolean;
  vboTileUniform: boolean;
  vboViewAttributes: boolean;
  tileMatrixTexture?: MatrixTexture | null;
  setTileViewMatrix?: (matrix: Mat4) => void;
};

type DrawTechniqueGeometryBindingInspector = {
  vboGeometryTriangles(stats: {
    handledBatches?: number;
    handledPrims?: number;
  }): void;
};

/**
 * Runtime geometry binding selected for one DrawTechnique draw call.
 *
 * DTX draws bind primitive/index/position textures and use drawArrays. VBO
 * triangle draws bind a VAO and use drawElements, while the surrounding
 * DrawTechnique still binds shared mesh/material/view data textures.
 */
export class DrawTechniqueGeometryBinding {
  readonly kind: "dtx" | "vbo" | "vboTileUniform";
  readonly drawRange: PrimRange;
  private readonly _params: DrawTechniqueGeometryBindingParams;
  private readonly _primitiveMeshIndexTexture: TextureLike;
  private readonly _vboDrawState: TriangleGeometryVBODrawState | null;
  private readonly _vboTileDrawState: {
    vao: WebGLVertexArrayObject;
    primRange: PrimRange;
    tileDrawStates: TriangleGeometryVBOTileDrawState[];
  } | null;

  private constructor(params: {
    kind: "dtx" | "vbo" | "vboTileUniform";
    drawRange: PrimRange;
    bindingParams: DrawTechniqueGeometryBindingParams;
    primitiveMeshIndexTexture?: TextureLike;
    vboDrawState?: TriangleGeometryVBODrawState | null;
    vboTileDrawState?: {
      vao: WebGLVertexArrayObject;
      primRange: PrimRange;
      tileDrawStates: TriangleGeometryVBOTileDrawState[];
    } | null;
  }) {
    this.kind = params.kind;
    this.drawRange = params.drawRange;
    this._params = params.bindingParams;
    this._primitiveMeshIndexTexture = params.primitiveMeshIndexTexture;
    this._vboDrawState = params.vboDrawState ?? null;
    this._vboTileDrawState = params.vboTileDrawState ?? null;
  }

  get inspectorRange(): PrimRange {
    return this._vboTileDrawState?.primRange ?? this._vboDrawState?.primRange ?? this.drawRange;
  }

  static resolve(params: DrawTechniqueGeometryBindingParams): DrawTechniqueGeometryBinding | null {
    const {batchResources, viewIndex, renderPass, edges, picking, snap} = params;
    const batchViewResources = batchResources.views[viewIndex];
    const primitiveMeshIndexTexture = edges
      ? batchViewResources.edgeMeshIndexTexture
      : batchViewResources.primitiveMeshIndexTexture;
    const drawRange = snap
      ? (edges
          ? batchViewResources.pickEdgePrimitiveRange
          : batchViewResources.pickPrimitiveRange)
      : (edges
          ? batchViewResources.renderPassEdgePrimitiveRanges.get(renderPass)
          : (picking
              ? batchViewResources.pickPrimitiveRange
              : batchViewResources.renderPassPrimitiveRanges.get(renderPass)));

    if (!drawRange || drawRange.numPrims === 0) {
      return null;
    }

    const useVBOGeometry = params.vboGeometry
      && params.primitive === TrianglesPrimitive
      && !params.thickLines;

    if (useVBOGeometry) {
      if (params.vboTileUniform && !params.picking && !params.snap && !params.edges) {
        const vboTileDrawState = getVBOTileDrawState(params, params.vboViewAttributes ? "lean-static" : "hybrid");
        if (vboTileDrawState) {
          return new DrawTechniqueGeometryBinding({
            kind: "vboTileUniform",
            drawRange,
            bindingParams: params,
            vboTileDrawState
          });
        }
      }
      const vboDrawState = getVBODrawState(params);
      return vboDrawState
        ? new DrawTechniqueGeometryBinding({
          kind: "vbo",
          drawRange,
          bindingParams: params,
          vboDrawState
        })
        : null;
    }

    if (!hasDTXGeometryResources(params, primitiveMeshIndexTexture)) {
      return null;
    }

    return new DrawTechniqueGeometryBinding({
      kind: "dtx",
      drawRange,
      bindingParams: params,
      primitiveMeshIndexTexture
    });
  }

  bindGeometryTextures(
    samplers: DrawTechniqueGeometryBindingSamplers,
    bindTexture: DrawTechniqueGeometryTextureBinder
  ): void {
    if (this.kind !== "dtx") {
      return;
    }
    const batchResources = this._params.batchResources;
    bindTexture(samplers.primitiveMeshIndex, this._primitiveMeshIndexTexture);
    bindTexture(samplers.vertexPositionTexture, batchResources.vertexPositionTexture);
    bindTexture(samplers.vertexColorTexture, batchResources.vertexColorTexture);
    bindTexture(samplers.meshMatrixTexture, batchResources.meshMatrixTexture);
    bindTexture(samplers.geometryQuantRangeTexture, batchResources.geometryQuantRangeTexture);
    bindTexture(
      samplers.indexTexture,
      this._params.edges
        ? batchResources.edgeIndexTexture
        : batchResources.indexTexture
    );
  }

  draw(gl: WebGL2RenderingContext, drawInspector: DrawTechniqueGeometryBindingInspector | null): SDKResult<void> {
    const {primitive, snap, edges, thickLines} = this._params;
    const drawRange = this.drawRange;

    switch (primitive) {
      case TrianglesPrimitive:
        if (this.kind === "vbo") {
          const vboDrawState = this._vboDrawState!;
          const drawMode = snap === 1
            ? gl.POINTS
            : (snap === 2 || edges)
              ? gl.LINES
              : gl.TRIANGLES;
          gl.bindVertexArray(vboDrawState.vao);
          gl.drawElements(drawMode, vboDrawState.indexCount, gl.UNSIGNED_INT, vboDrawState.firstIndex * 4);
          gl.bindVertexArray(null);
          drawInspector?.vboGeometryTriangles({
            handledBatches: 1,
            handledPrims: vboDrawState.primRange.numPrims
          });
        } else if (this.kind === "vboTileUniform") {
          const vboTileDrawState = this._vboTileDrawState!;
          const tileMatrixTexture = this._params.tileMatrixTexture;
          const setTileViewMatrix = this._params.setTileViewMatrix;
          if (!tileMatrixTexture || !setTileViewMatrix) {
            return {
              ok: false,
              type: SDKErrorType.InvalidInput,
              error: "[DrawTechniqueGeometryBinding.draw] Missing tile matrix binding for VBO tile-uniform draw"
            };
          }
          gl.bindVertexArray(vboTileDrawState.vao);
          let handledPrims = 0;
          for (const tileDrawState of vboTileDrawState.tileDrawStates) {
            setTileViewMatrix(tileMatrixTexture.getItem(tileDrawState.tileIndex).matrix);
            for (const span of tileDrawState.spans) {
              gl.drawElements(gl.TRIANGLES, span.indexCount, gl.UNSIGNED_INT, span.firstIndex * 4);
              handledPrims += span.primCount;
            }
          }
          gl.bindVertexArray(null);
          drawInspector?.vboGeometryTriangles({
            handledBatches: 1,
            handledPrims
          });
        } else if (snap === 1) {
          // Vertex-snap rides the edge index buffer: two endpoint vertices
          // per edge, rendered as POINTS.
          gl.drawArrays(gl.POINTS, drawRange.firstPrim * 2, drawRange.numPrims * 2);
        } else if (edges && thickLines) {
          gl.drawArrays(gl.TRIANGLES, drawRange.firstPrim * 6, drawRange.numPrims * 6);
        } else if (snap === 2 || edges) {
          gl.drawArrays(gl.LINES, drawRange.firstPrim * 2, drawRange.numPrims * 2);
        } else {
          gl.drawArrays(gl.TRIANGLES, drawRange.firstPrim * 3, drawRange.numPrims * 3);
        }
        break;
      case LinesPrimitive:
        if (snap === 1) {
          gl.drawArrays(gl.POINTS, drawRange.firstPrim * 2, drawRange.numPrims * 2);
        } else if (snap === 2) {
          gl.drawArrays(gl.LINES, drawRange.firstPrim * 2, drawRange.numPrims * 2);
        } else if (thickLines) {
          gl.drawArrays(gl.TRIANGLES, drawRange.firstPrim * 6, drawRange.numPrims * 6);
        } else {
          gl.drawArrays(gl.LINES, drawRange.firstPrim * 2, drawRange.numPrims * 2);
        }
        break;
      case PointsPrimitive:
        gl.drawArrays(gl.POINTS, drawRange.firstPrim, drawRange.numPrims);
        break;
      default:
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[DrawTechniqueGeometryBinding.draw] Unsupported Batch primitive type: ${primitive}`
        };
    }

    return {ok: true, value: undefined};
  }
}

function getVBOTileDrawState(params: DrawTechniqueGeometryBindingParams, layout: "hybrid" | "lean-static"): {
  vao: WebGLVertexArrayObject;
  primRange: PrimRange;
  tileDrawStates: TriangleGeometryVBOTileDrawState[];
} | null {
  const {batchResources, viewIndex, renderPass} = params;
  return batchResources.triangleGeometryVBO?.getTileDrawStates(viewIndex, renderPass, layout) ?? null;
}

function getVBODrawState(params: DrawTechniqueGeometryBindingParams): TriangleGeometryVBODrawState | null {
  const {batchResources, viewIndex, renderPass, edges, picking, snap} = params;
  return (picking
    ? batchResources.triangleGeometryVBO?.getPickDrawState(viewIndex, "hybrid")
    : snap
      ? (edges
          ? batchResources.triangleGeometryVBO?.getPickEdgeDrawState(viewIndex, "hybrid")
          : batchResources.triangleGeometryVBO?.getPickDrawState(viewIndex, "hybrid"))
      : (edges
          ? batchResources.triangleGeometryVBO?.getEdgeDrawState(viewIndex, renderPass, "hybrid")
          : batchResources.triangleGeometryVBO?.getDrawState(viewIndex, renderPass, "hybrid"))) ?? null;
}

function hasDTXGeometryResources(
  params: DrawTechniqueGeometryBindingParams,
  primitiveMeshIndexTexture: TextureLike
): boolean {
  const batchResources = params.batchResources;
  return !!primitiveMeshIndexTexture
    && !!batchResources.vertexPositionTexture
    && !!batchResources.vertexColorTexture
    && !!batchResources.geometryQuantRangeTexture
    && !!(params.edges ? batchResources.edgeIndexTexture : batchResources.indexTexture);
}
