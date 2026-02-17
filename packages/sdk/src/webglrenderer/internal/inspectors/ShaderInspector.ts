import {DrawOps} from "../drawOps/DrawOps";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";

/**
 * Read-only view of the shader programs used by a {@link WebGLRenderer}.
 */
export class ShaderInspector {

  public readonly techniques: {
    triangles: {
      opaque: {
        vertexSrc: string,
        fragmentSrc: string
      },
      opaqueEdges: {
        vertexSrc: string,
        fragmentSrc: string
      },
      transparent: {
        vertexSrc: string,
        fragmentSrc: string
      },
      transparentEdges: {
        vertexSrc: string,
        fragmentSrc: string
      },
      selected: {
        vertexSrc: string,
        fragmentSrc: string
      },
      highlighted: {
        vertexSrc: string,
        fragmentSrc: string
      },
      xrayed: {
        vertexSrc: string,
        fragmentSrc: string
      },
      pick: {
        vertexSrc: string,
        fragmentSrc: string
      }
    },
    lines: {
      opaque: {
        vertexSrc: string,
        fragmentSrc: string
      },
      transparent: {
        vertexSrc: string,
        fragmentSrc: string
      },
      selected: {
        vertexSrc: string,
        fragmentSrc: string
      },
      highlighted: {
        vertexSrc: string,
        fragmentSrc: string
      },
      xrayed: {
        vertexSrc: string,
        fragmentSrc: string
      },
      pick: {
        vertexSrc: string,
        fragmentSrc: string
      }
    },
    points: {
      opaque: {
        vertexSrc: string,
        fragmentSrc: string
      },
      transparent: {
        vertexSrc: string,
        fragmentSrc: string
      },
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
    this.techniques = {
      triangles: {
        opaque: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].opaque.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].opaque.technique.fragmentShaderSrc
        },
        opaqueEdges: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].opaqueEdges.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].opaqueEdges.technique.fragmentShaderSrc
        },
        transparent: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].transparent.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].transparent.technique.fragmentShaderSrc
        },
        transparentEdges: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].transparentEdges.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].transparentEdges.technique.fragmentShaderSrc
        },
        highlighted: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].highlighted.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].highlighted.technique.fragmentShaderSrc
        },
        selected: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].selected.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].selected.technique.fragmentShaderSrc
        },
        xrayed: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].xrayed.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].xrayed.technique.fragmentShaderSrc
        },
        pick: {
          vertexSrc: drawOps.prims[TrianglesPrimitive].pick.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[TrianglesPrimitive].pick.technique.fragmentShaderSrc
        }
      },
      lines: {
        opaque: {
          vertexSrc: drawOps.prims[LinesPrimitive].opaque.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[LinesPrimitive].opaque.technique.fragmentShaderSrc
        },
        transparent: {
          vertexSrc: drawOps.prims[LinesPrimitive].transparent.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[LinesPrimitive].transparent.technique.fragmentShaderSrc
        },
        highlighted: {
          vertexSrc: drawOps.prims[LinesPrimitive].highlighted.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[LinesPrimitive].highlighted.technique.fragmentShaderSrc
        },
        selected: {
          vertexSrc: drawOps.prims[LinesPrimitive].selected.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[LinesPrimitive].selected.technique.fragmentShaderSrc
        },
        xrayed: {
          vertexSrc: drawOps.prims[LinesPrimitive].xrayed.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[LinesPrimitive].xrayed.technique.fragmentShaderSrc
        },
        pick: {
          vertexSrc: drawOps.prims[LinesPrimitive].pick.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[LinesPrimitive].pick.technique.fragmentShaderSrc
        }
      },
      points: {
        opaque: {
          vertexSrc: drawOps.prims[PointsPrimitive].opaque.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[PointsPrimitive].opaque.technique.fragmentShaderSrc
        },
        transparent: {
          vertexSrc: drawOps.prims[PointsPrimitive].transparent.technique.vertexShaderSrc,
          fragmentSrc: drawOps.prims[PointsPrimitive].transparent.technique.fragmentShaderSrc
        },
        // highlighted: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].highlighted.technique.vertexShaderSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].highlighted.technique.fragmentShaderSrc
        // },
      //  selected: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].selected.technique.vertexShaderSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].selected.technique.fragmentShaderSrc
        // },
        // xrayed: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].xrayed.technique.vertexShaderSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].xrayed.technique.fragmentShaderSrc
        // },
        // pick: {
        //   vertexSrc: drawOps.prims[PointsPrimitive].pick.technique.vertexShaderSrc,
        //   fragmentSrc: drawOps.prims[PointsPrimitive].pick.technique.fragmentShaderSrc
        // }
      }
    };
  }

}
