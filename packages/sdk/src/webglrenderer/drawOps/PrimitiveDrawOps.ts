import {RenderContext} from "../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import {TrianglesColorDrawOp} from "./triangles/TrianglesColorDrawOp";
import {GenericSilhouetteDrawOp} from "./generic/GenericSilhouetteDrawOp";
import {PointsSilhouetteDrawOp} from "./points/PointsSilhouetteDrawOp";
import {PointsColorDrawOp} from "./points/PointsColorDrawOp";
import {DrawOp} from "./DrawOp";
import {type GPUMemoryReadIF} from "../gpuMemory/GPUMemoryReadIF";
import {LinesColorDrawOp} from "./lines/LinesColorDrawOp";
import {TrianglesPickMeshDrawOp} from "./triangles/TrianglesPickMeshDrawOp";
import {TrianglesDepthDrawOp} from "./triangles/TrianglesDepthDrawOp";

/**
 * Set of draw operations for different rendering techniques.
 */
export interface DrawOpSet {
  color?: DrawOp; // Render objects with color and lighting
  colorEdges?: DrawOp; // Render edges of objects
  silhouette?: DrawOp; // Render silhouettes of objects in flat color
  silhouetteEdges?: DrawOp; // Render silhouettes of edges
  pick?: DrawOp; // Render meshes as their RGBA-encoded mesh IDs to the pick buffer
  depth?: DrawOp; // Render screen-space depths to depth buffer
}

/**
 * Manages a set of draw operations for different primitive types.
 */
export class PrimitiveDrawOps {

  _useCount:number = 0;
  _renderContext: RenderContext;

  prims: {
    [TrianglesPrimitive]: DrawOpSet;
    [LinesPrimitive]: DrawOpSet;
    [PointsPrimitive]: DrawOpSet;
  };

  /**
   * Initializes the PrimitiveDrawOps with the given rendering context and GPU memory.
   * @param renderContext - The rendering context used for WebGL operations.
   * @param gpuMemoryReadIF - Reads GPU memory - provides data textures.
   */
  constructor(renderContext: RenderContext, gpuMemoryReadIF: GPUMemoryReadIF) {
    this._renderContext = renderContext;
    const silhouette = new GenericSilhouetteDrawOp(renderContext, gpuMemoryReadIF);
    this.prims = {
      [TrianglesPrimitive]: {
        color: new TrianglesColorDrawOp(renderContext, gpuMemoryReadIF),
        silhouette,
      //  pick: new TrianglesPickMeshRenderer(renderContext, gpuMemoryReadIF),
      //  depth: new TrianglesDepthRenderer(renderContext, gpuMemoryReadIF)
      },
      [LinesPrimitive]: {
        color: new LinesColorDrawOp(renderContext, gpuMemoryReadIF),
        silhouette,
      },
      [PointsPrimitive]: {
        color: new PointsColorDrawOp(renderContext, gpuMemoryReadIF),
        silhouette: new PointsSilhouetteDrawOp(renderContext, gpuMemoryReadIF)
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

const primDrawOpsInstances = {};

/**
 * Gets or creates a LayerRendererSet for the given RenderContext.
 * @param renderContext
 * @param gpuMemoryReadIF
 */
export function getPrimitiveDrawOps(renderContext: RenderContext, gpuMemoryReadIF:GPUMemoryReadIF): PrimitiveDrawOps {
    const viewerId = renderContext.viewer.id;
    let primDrawOps = primDrawOpsInstances[viewerId];
    if (!primDrawOps) {
      primDrawOps = new PrimitiveDrawOps(renderContext, gpuMemoryReadIF);
      primDrawOpsInstances[viewerId] = primDrawOps;
    }
    primDrawOps._useCount++;
    return primDrawOps;
  }

/**
 * Releases a LayerRendererSet, destroying it if no longer in use.
 * @param primDrawOps
 */
export function putPrimitiveDrawOps(primDrawOps: PrimitiveDrawOps) {
  if (primDrawOps._useCount === 0) {
    throw new Error("PrimitiveDrawOps use count is already zero");
  }
    primDrawOps._useCount--;
    if (primDrawOps._useCount === 0) {
      const viewerId = primDrawOps._renderContext.viewer.id;
      delete primDrawOpsInstances[viewerId];
      primDrawOps._destroy();
    }
  }