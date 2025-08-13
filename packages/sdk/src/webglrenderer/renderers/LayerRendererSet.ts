import {RenderContext} from "../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import {TrianglesColorRenderer} from "./triangles/TrianglesColorRenderer";
import {GenericSilhouetteRenderer} from "./generic/GenericSilhouetteRenderer";
import {PointsSilhouetteRenderer} from "./points/PointsSilhouetteRenderer";
import {PointsColorRenderer} from "./points/PointsColorRenderer";
import {LayerRenderer} from "./LayerRenderer";

/**
 * Interface defining the structure of a renderer set for different primitives.
 */
export interface RendererSet {
  color?: LayerRenderer;
  colorEdges?: LayerRenderer;
  silhouette?: LayerRenderer;
  silhouetteEdges?: LayerRenderer;
}

/**
 * Manages a set of renderers for different primitive types.
 */
export class LayerRendererSet {
  renderContext: RenderContext;
  prims: {
    [TrianglesPrimitive]: RendererSet;
    [LinesPrimitive]: RendererSet;
    [PointsPrimitive]: RendererSet;
  };

  /**
   * Initializes the LayerRendererSet with the given rendering context.
   * @param renderContext - The rendering context used for WebGL operations.
   */
  constructor(renderContext: RenderContext) {
    this.renderContext = renderContext;

    const silhouette = new GenericSilhouetteRenderer(renderContext);

    this.prims = {
      [TrianglesPrimitive]: {
        color: new TrianglesColorRenderer(renderContext),
        silhouette,
      },
      [LinesPrimitive]: {
        color: new TrianglesColorRenderer(renderContext),
        silhouette,
      },
      [PointsPrimitive]: {
        color: new PointsColorRenderer(renderContext),
        silhouette: new PointsSilhouetteRenderer(renderContext),
      },
    };
  }

  /**
   * Destroys all renderers in the renderer set.
   * Ensures proper cleanup of resources.
   */
  destroy() {
    Object.values(this.prims).forEach(prim =>
      Object.values(prim).forEach(renderer => renderer.destroy())
    );
  }
}
