import {RenderContext} from "../../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {TrianglesColorRenderer} from "./triangles/TrianglesColorRenderer";
import {GenericSilhouetteRenderer} from "./generic/GenericSilhouetteRenderer";
import {PointsSilhouetteRenderer} from "./points/PointsSilhouetteRenderer";
import {PointsColorRenderer} from "./points/PointsColorRenderer";
import {LayerRenderer} from "./LayerRenderer";
import {type GPUMemoryReadIF} from "../../gpuMemory/GPUMemoryReadIF";
import {LinesColorRenderer} from "./lines/LinesColorRenderer";
import {TrianglesPickMeshRenderer} from "./triangles/TrianglesPickMeshRenderer";
import {TrianglesDepthRenderer} from "./triangles/TrianglesDepthRenderer";

/**
 * Interface defining the structure of a renderer set for different primitives.
 */
export interface RendererSet {
  color?: LayerRenderer; // Render objects with color and lighting
  colorEdges?: LayerRenderer; // Render edges of objects
  silhouette?: LayerRenderer; // Render silhouettes of objects in flat color
  silhouetteEdges?: LayerRenderer; // Render silhouettes of edges
  pick?: LayerRenderer; // Render meshes as their RGBA-encoded mesh IDs to the pick buffer
  depth?: LayerRenderer; // Render screen-space depths to depth buffer
}

/**
 * Manages a set of renderers for different primitive types.
 */
export class LayerRendererSet {
  useCount:number = 0;
  renderContext: RenderContext;
  prims: {
    [TrianglesPrimitive]: RendererSet;
    [LinesPrimitive]: RendererSet;
    [PointsPrimitive]: RendererSet;
  };

  /**
   * Initializes the LayerRendererSet with the given rendering context.
   * @param renderContext - The rendering context used for WebGL operations.
   * @param gpuMemoryReadIF - The DTX gpuMemory used for managing GPU resources.
   */
  constructor(renderContext: RenderContext, gpuMemoryReadIF: GPUMemoryReadIF) {
    this.renderContext = renderContext;
    const silhouette = new GenericSilhouetteRenderer(renderContext, gpuMemoryReadIF);
    this.prims = {
      [TrianglesPrimitive]: {
        color: new TrianglesColorRenderer(renderContext, gpuMemoryReadIF),
        silhouette,
        pick: new TrianglesPickMeshRenderer(renderContext, gpuMemoryReadIF),
        depth: new TrianglesDepthRenderer(renderContext, gpuMemoryReadIF)
      },
      [LinesPrimitive]: {
        color: new LinesColorRenderer(renderContext, gpuMemoryReadIF),
        silhouette,
      },
      [PointsPrimitive]: {
        color: new PointsColorRenderer(renderContext, gpuMemoryReadIF),
        silhouette: new PointsSilhouetteRenderer(renderContext, gpuMemoryReadIF)
      },
    };
  }

  /**
   * Destroys all renderers in the renderer set.
   * Ensures proper cleanup of resources.
   */
  _destroy() {
    // @ts-ignore
    Object.values(this.prims).forEach(prim =>
      Object.values(prim).forEach(renderer => renderer.destroy())
    );
  }
}

const rendererSets = {};

/**
 * Gets or creates a LayerRendererSet for the given RenderContext.
 * @param renderContext
 * @param gpuMemoryReadIF
 */
export function getLayerRendererSet(
    renderContext: RenderContext,
    gpuMemoryReadIF:GPUMemoryReadIF): LayerRendererSet {
    const viewerId = renderContext.viewer.id;
    let rendererSet = rendererSets[viewerId];
    if (!rendererSet) {
      rendererSet = new LayerRendererSet(renderContext, gpuMemoryReadIF);
      rendererSets[viewerId] = rendererSet;
    }
    rendererSet.useCount++;
    return rendererSet;
  }

/**
 * Releases a LayerRendererSet, destroying it if no longer in use.
 * @param layerRendererSet
 */
export function putLayerRendererSet(layerRendererSet: LayerRendererSet) {
    layerRendererSet.useCount--;
    if (layerRendererSet.useCount <= 0) {
      const viewerId = layerRendererSet.renderContext.viewer.id;
      delete rendererSets[viewerId];
      layerRendererSet._destroy();
    }
  }