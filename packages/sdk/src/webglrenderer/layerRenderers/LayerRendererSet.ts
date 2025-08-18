import {RenderContext} from "../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import {TrianglesColorRenderer} from "./triangles/TrianglesColorRenderer";
import {GenericSilhouetteRenderer} from "./generic/GenericSilhouetteRenderer";
import {PointsSilhouetteRenderer} from "./points/PointsSilhouetteRenderer";
import {PointsColorRenderer} from "./points/PointsColorRenderer";
import {LayerRenderer} from "./LayerRenderer";
import {type GPUDataMemoryView} from "../gpuDataMemory/GPUDataMemoryView";

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
   * @param dtxMemoryView - The DTX memory used for managing GPU resources.
   */
  constructor(renderContext: RenderContext, dtxMemoryView: GPUDataMemoryView) {
    this.renderContext = renderContext;
    const silhouette = new GenericSilhouetteRenderer(renderContext, dtxMemoryView);
    this.prims = {
      [TrianglesPrimitive]: {
        color: new TrianglesColorRenderer(renderContext, dtxMemoryView),
        silhouette,
      },
      [LinesPrimitive]: {
        color: new TrianglesColorRenderer(renderContext, dtxMemoryView),
        silhouette,
      },
      [PointsPrimitive]: {
        color: new PointsColorRenderer(renderContext, dtxMemoryView),
        silhouette: new PointsSilhouetteRenderer(renderContext, dtxMemoryView)
      },
    };
  }

  /**
   * Destroys all renderers in the renderer set.
   * Ensures proper cleanup of resources.
   */
  destroy() {
    // @ts-ignore
    Object.values(this.prims).forEach(prim =>
      Object.values(prim).forEach(renderer => renderer.destroy())
    );
  }
}
