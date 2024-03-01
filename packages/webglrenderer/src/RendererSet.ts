import {TrianglesFastColorRenderer} from "./triangles/TrianglesFastColorRenderer";
import {TrianglesSilhouetteRenderer} from "./triangles/TrianglesSilhouetteRenderer";
import {TrianglesEdgesColorRenderer} from "./triangles/TrianglesEdgesColorRenderer";
import {TrianglesQualityColorRenderer} from "./triangles/TrianglesQualityColorRenderer";
import {RenderContext} from "./RenderContext";
import {RenderStats} from "./RenderStats";

/**
 * @private
 */
export class RendererSet {
    trianglesFastColorRenderer: TrianglesFastColorRenderer;
    trianglesSilhouetteRenderer: TrianglesSilhouetteRenderer;
    trianglesEdgesColorRenderer: TrianglesEdgesColorRenderer;
    trianglesQualityColorRenderer: TrianglesQualityColorRenderer;
    renderContext: RenderContext;
    renderStats: RenderStats;

    constructor(renderContext: RenderContext, renderStats: RenderStats) {
        this.renderContext = renderContext;
        this.renderStats = renderStats;
        this.trianglesFastColorRenderer = new TrianglesFastColorRenderer(renderContext, renderStats);
    //    this.trianglesSilhouetteRenderer = new TrianglesSilhouetteRenderer(renderContext, renderStats);
        // this.trianglesEdgesColorRenderer = new TrianglesEdgesColorRenderer(renderContext);
        // this.trianglesQualityColorRenderer = new TrianglesQualityColorRenderer(renderContext);
    }

    needRebuild() {
        this.trianglesFastColorRenderer.needRebuild();
  //      this.trianglesSilhouetteRenderer.needRebuild();
        // this.trianglesEdgesColorRenderer.needRebuild();
        // this.trianglesQualityColorRenderer.needRebuild();
    }

    destroy() {
        this.trianglesFastColorRenderer.destroy();
      //  this.trianglesSilhouetteRenderer.destroy();
        // this.trianglesEdgesColorRenderer.destroy();
        // this.trianglesQualityColorRenderer.destroy();
    }
}
