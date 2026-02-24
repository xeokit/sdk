import {DrawOps} from "../drawOps/DrawOps";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {DrawTechnique} from "../drawOps";


export interface ShaderSource {

  /**
   * The original shader source code, with comments removed.
   */
  vertexShaderSrc: string;

  /**
   * The original shader source code, with comments included. This may be more readable for debugging purposes, but may not be valid GLSL source that can be compiled by WebGL.
   */
  vertexShaderCommentedSrc: string;

  /**
   * The original shader source code, with comments removed.
   */
  fragmentShaderSrc: string;

  /**
   * The original shader source code, with comments included. This may be more readable for debugging purposes, but may not be valid GLSL source that can be compiled by WebGL.
   */
  fragmentShaderCommentedSrc: string;
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
      //   vertexShaderSrc: string,
      //   fragmentShaderSrc: string
      // },
      // highlighted: {
      //   vertexShaderSrc: string,
      //   fragmentShaderSrc: string
      // },
      // xrayed: {
      //   vertexShaderSrc: string,
      //   fragmentShaderSrc: string
      // },
      // pick: {
      //   vertexShaderSrc: string,
      //   fragmentShaderSrc: string
      // }
    }
  };

  constructor(drawOps: DrawOps) {

    const getShaderSource = (tech: DrawTechnique): ShaderSource => ({
      vertexShaderSrc: tech.vertexShaderSrc,
      vertexShaderCommentedSrc: tech.vertexShaderCommentedSrc,
      fragmentShaderSrc: tech.fragmentShaderSrc,
      fragmentShaderCommentedSrc: tech.fragmentShaderCommentedSrc
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
        //   vertexShaderSrc: drawOps.prims[PointsPrimitive].highlighted.technique.vertexShaderCommentedSrc,
        //   fragmentShaderSrc: drawOps.prims[PointsPrimitive].highlighted.technique.fragmentShaderCommentedSrc
        // },
      //  selected: {
        //   vertexShaderSrc: drawOps.prims[PointsPrimitive].selected.technique.vertexShaderCommentedSrc,
        //   fragmentShaderSrc: drawOps.prims[PointsPrimitive].selected.technique.fragmentShaderCommentedSrc
        // },
        // xrayed: {
        //   vertexShaderSrc: drawOps.prims[PointsPrimitive].xrayed.technique.vertexShaderCommentedSrc,
        //   fragmentShaderSrc: drawOps.prims[PointsPrimitive].xrayed.technique.fragmentShaderCommentedSrc
        // },
        // pick: {
        //   vertexShaderSrc: drawOps.prims[PointsPrimitive].pick.technique.vertexShaderCommentedSrc,
        //   fragmentShaderSrc: drawOps.prims[PointsPrimitive].pick.technique.fragmentShaderCommentedSrc
        // }
      }
    };
  }

}
