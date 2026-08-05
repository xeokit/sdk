import type {TriangleGeometryVBOViewState} from "./TriangleGeometryVBOState";

/**
 * VBO shader layout requested by a draw technique.
 *
 * @internal
 */
export type TriangleGeometryVBOVAOLayout = "vbo-only" | "hybrid" | "lean-static";

/**
 * Primitive topology for the VAO being created.
 *
 * @internal
 */
export type TriangleGeometryVBOTopology = "triangles" | "edges";

export function getTriangleGeometryVBOVAO(params: {
  gl: WebGL2RenderingContext;
  view: TriangleGeometryVBOViewState;
  layout: TriangleGeometryVBOVAOLayout;
  topology: TriangleGeometryVBOTopology;
  positionBuffer: WebGLBuffer | null;
  meshIndexBuffer: WebGLBuffer | null;
  geometryVertexIndexBuffer: WebGLBuffer | null;
}): WebGLVertexArrayObject | null {
  const existing = params.layout === "lean-static"
    ? params.view.leanStaticVAO
    : params.topology === "edges"
    ? (params.layout === "vbo-only" ? params.view.bakedEdgeVAO : params.view.hybridEdgeVAO)
    : (params.layout === "vbo-only" ? params.view.bakedVAO : params.view.hybridVAO);
  if (existing) {
    return existing;
  }
  const indexBuffer = params.topology === "edges" ? params.view.edgeIndexBuffer : params.view.indexBuffer;
  if (!params.positionBuffer || !params.meshIndexBuffer || !params.geometryVertexIndexBuffer || !indexBuffer || !params.view.colorBuffer) {
    return null;
  }
  if (params.layout === "lean-static" && !params.view.renderFlagBuffer) {
    return null;
  }
  const gl = params.gl;
  const vao = gl.createVertexArray();
  if (!vao) {
    return null;
  }
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, params.positionBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  if (params.layout === "lean-static") {
    gl.bindBuffer(gl.ARRAY_BUFFER, params.meshIndexBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, params.geometryVertexIndexBuffer);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribIPointer(2, 1, gl.UNSIGNED_INT, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, params.view.colorBuffer);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, params.view.renderFlagBuffer);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribIPointer(4, 4, gl.UNSIGNED_BYTE, 0, 0);
    setTriangleGeometryVBOVAO(params.view, params.layout, params.topology, vao);
  } else if (params.layout === "vbo-only") {
    gl.bindBuffer(gl.ARRAY_BUFFER, params.view.colorBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    setTriangleGeometryVBOVAO(params.view, params.layout, params.topology, vao);
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, params.meshIndexBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 0, 0);
    setTriangleGeometryVBOVAO(params.view, params.layout, params.topology, vao);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, params.geometryVertexIndexBuffer);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribIPointer(2, 1, gl.UNSIGNED_INT, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return vao;
}

export function deleteTriangleGeometryVBOVAOs(gl: WebGL2RenderingContext, view: TriangleGeometryVBOViewState): void {
  if (view.bakedVAO) {
    gl.deleteVertexArray(view.bakedVAO);
  }
  if (view.hybridVAO) {
    gl.deleteVertexArray(view.hybridVAO);
  }
  if (view.leanStaticVAO) {
    gl.deleteVertexArray(view.leanStaticVAO);
  }
  if (view.bakedEdgeVAO) {
    gl.deleteVertexArray(view.bakedEdgeVAO);
  }
  if (view.hybridEdgeVAO) {
    gl.deleteVertexArray(view.hybridEdgeVAO);
  }
  view.bakedVAO = null;
  view.hybridVAO = null;
  view.leanStaticVAO = null;
  view.bakedEdgeVAO = null;
  view.hybridEdgeVAO = null;
}

function setTriangleGeometryVBOVAO(
  view: TriangleGeometryVBOViewState,
  layout: TriangleGeometryVBOVAOLayout,
  topology: TriangleGeometryVBOTopology,
  vao: WebGLVertexArrayObject
): void {
  if (layout === "lean-static") {
    view.leanStaticVAO = vao;
    return;
  }
  if (topology === "edges") {
    if (layout === "vbo-only") {
      view.bakedEdgeVAO = vao;
    } else {
      view.hybridEdgeVAO = vao;
    }
  } else if (layout === "vbo-only") {
    view.bakedVAO = vao;
  } else {
    view.hybridVAO = vao;
  }
}
