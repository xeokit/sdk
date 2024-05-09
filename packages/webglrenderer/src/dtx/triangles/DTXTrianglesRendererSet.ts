import {DTXTrianglesFastColorRenderer} from "./DTXTrianglesFastColorRenderer";
import {DTXTrianglesSilhouetteRenderer} from "./DTXTrianglesSilhouetteRenderer";
import {DTXTrianglesEdgesColorRenderer} from "./DTXTrianglesEdgesColorRenderer";
import {DTXTrianglesQualityColorRenderer} from "./DTXTrianglesQualityColorRenderer";

import {RenderContext} from "../../RenderContext";
import {RenderStats} from "../../RenderStats";
import {WebGLRenderer} from "../../WebGLRenderer";


/**
 * @private
 */
export class DTXTrianglesRendererSet {
    colorRenderer: DTXTrianglesFastColorRenderer;
    silhouetteRenderer: DTXTrianglesSilhouetteRenderer;
    edgesColorRenderer: DTXTrianglesEdgesColorRenderer;
    qualityColorRenderer: DTXTrianglesQualityColorRenderer;
    renderContext: RenderContext;
    renderStats: RenderStats;

    constructor(renderContext: RenderContext, renderStats: RenderStats) {
        this.renderContext = renderContext;
        this.renderStats = renderStats;
        this.colorRenderer = new DTXTrianglesFastColorRenderer(renderContext, renderStats);
    //    this.silhouetteRenderer = new TrianglesSilhouetteRenderer(renderContext, renderStats);
        // this.edgesColorRenderer = new TrianglesEdgesColorRenderer(renderContext);
        // this.qualityColorRenderer = new TrianglesQualityColorRenderer(renderContext);
    }

    needRebuild() {
        this.colorRenderer.needRebuild();
  //      this.silhouetteRenderer.needRebuild();
        // this.edgesColorRenderer.needRebuild();
        // this.qualityColorRenderer.needRebuild();
    }

    destroy() {
        this.colorRenderer.destroy();
      //  this.silhouetteRenderer.destroy();
        // this.edgesColorRenderer.destroy();
        // this.qualityColorRenderer.destroy();
    }
}


const cachdRenderers = {};

/**
 * @private
 */
export function getRenderers(webglRenderer: WebGLRenderer) {
    const viewerId = webglRenderer.viewer.id;
    let dataTextureRenderers = cachdRenderers[viewerId];
    if (!dataTextureRenderers) {
        dataTextureRenderers = new DTXTrianglesRendererSet(webglRenderer.renderContext, webglRenderer.renderStats);
        cachdRenderers[viewerId] = dataTextureRenderers;
        dataTextureRenderers._compile();
        dataTextureRenderers.eagerCreateRenders();
        webglRenderer.onCompiled.sub(() => {
            dataTextureRenderers._compile();
            dataTextureRenderers.eagerCreateRenders();
        });
        webglRenderer.onDestroyed.sub(() => {
            delete cachdRenderers[viewerId];
            dataTextureRenderers._destroy();
        });
    }
    return dataTextureRenderers;
}
