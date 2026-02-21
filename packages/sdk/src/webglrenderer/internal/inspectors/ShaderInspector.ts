import {DrawOps} from "../drawOps/DrawOps";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {DrawTechnique} from "../drawOps";


export interface ShaderSource {

  /**
   * The original shader source code, with comments removed.
   */
  vertexSrc: string;

  /**
   * The original shader source code, with comments included. This may be more readable for debugging purposes, but may not be valid GLSL source that can be compiled by WebGL.
   */
  vertexCommentedSrc: string;

  /**
   * The original shader source code, with comments removed.
   */
  fragmentSrc: string;

  /**
   * The original shader source code, with comments included. This may be more readable for debugging purposes, but may not be valid GLSL source that can be compiled by WebGL.
   */
  fragmentCommentedSrc: string;
}

/**
 * Read-only view of the shader programs used by a {@link WebGLRenderer}.
 */
export class ShaderInspector {

  public readonly techniques: {
    triangles: {
      opaque: ShaderSource,
      opaqueEdges: ShaderSource,
      transparent: ShaderSource,
      transparentEdges:ShaderSource,
      selected: ShaderSource,
      highlighted: ShaderSource,
      xrayed: ShaderSource,
      pick: ShaderSource
    },
    lines: {
      opaque:ShaderSource,
      transparent: ShaderSource,
      selected: ShaderSource,
      highlighted:ShaderSource,
      xrayed: ShaderSource,
      pick: ShaderSource
    },
    points: {
      opaque: ShaderSource,
      transparent: ShaderSource,
      // selected: {
      //   vertexSrc: string,
      //   fragmentSrc: string
      // },
      // highlighted: {
      //   vertexSrc: string,
      //   fragmentSrc: string
      // },
      // xrayed: {
      //   vertexSrc: string,
      //   fragmentSrc: string
      // },
      // pick: {
      //   vertexSrc: string,
      //   fragmentSrc: string
      // }
    }
  };

  constructor(drawOps: DrawOps) {

    const getShaderSource = (tech: DrawTechnique): ShaderSource => ({
      vertexSrc: tech.vertexShaderSrc,
      vertexCommentedSrc: tech.vertexShaderCommentedSrc,
      fragmentSrc: tech.fragmentShaderSrc,
      fragmentCommentedSrc: tech.fragmentShaderCommentedSrc
    });

    this.techniques = {
      triangles: {
        opaque: getShaderSource(drawOps.prims[TrianglesPrimitive].opaque.technique),
        opaqueEdges: getShaderSource(drawOps.prims[TrianglesPrimitive].opaqueEdges.technique),
        transparent: getShaderSource(drawOps.prims[TrianglesPrimitive].transparent.technique),
        transparentEdges: getShaderSource(drawOps.prims[TrianglesPrimitive].transparentEdges.technique),
        highlighted: getShaderSource(drawOps.prims[TrianglesPrimitive].highlighted.technique),
        selected: getShaderSource(drawOps.prims[TrianglesPrimitive].selected.technique),
        xrayed: getShaderSource(drawOps.prims[TrianglesPrimitive].xrayed.technique),
        pick: getShaderSource(drawOps.prims[TrianglesPrimitive].pick.technique)
      },
      lines: {
        opaque: getShaderSource(drawOps.prims[LinesPrimitive].opaque.technique),
        transparent: getShaderSource(drawOps.prims[LinesPrimitive].transparent.technique),
        highlighted: getShaderSource(drawOps.prims[LinesPrimitive].highlighted.technique),
        selected: getShaderSource( drawOps.prims[LinesPrimitive].selected.technique),
        xrayed: getShaderSource(drawOps.prims[LinesPrimitive].xrayed.technique),
        pick: getShaderSource( drawOps.prims[LinesPrimitive].pick.technique)
      },
      points: {
        opaque: getShaderSource(drawOps.prims[PointsPrimitive].opaque.technique),
        transparent: getShaderSource(drawOps.prims[PointsPrimitive].transparent.technique),
        // highlighted: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].highlighted.technique.vertexShaderCommentedSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].highlighted.technique.fragmentShaderCommentedSrc
        // },
      //  selected: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].selected.technique.vertexShaderCommentedSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].selected.technique.fragmentShaderCommentedSrc
        // },
        // xrayed: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].xrayed.technique.vertexShaderCommentedSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].xrayed.technique.fragmentShaderCommentedSrc
        // },
        // pick: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].pick.technique.vertexShaderCommentedSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].pick.technique.fragmentShaderCommentedSrc
        // }
      }
    };
  }

}
