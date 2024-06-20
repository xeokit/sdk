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

    _compile() {

    }

    _eagerCreate() {

    }
}


const rendererSets = {};

/**
 * @private
 */
export function getRenderers(webglRenderer: WebGLRenderer) {
    const viewerId = webglRenderer.viewer.id;
    let rendererSet = rendererSets[viewerId];
    if (!rendererSet) {
        rendererSet = new DTXTrianglesRendererSet(webglRenderer.renderContext, webglRenderer.renderStats);
        rendererSets[viewerId] = rendererSet;
        rendererSet._compile();
        rendererSet._eagerCreate();
        webglRenderer.onCompiled.sub(() => {
            rendererSet._compile();
            rendererSet._eagerCreate();
        });
        webglRenderer.onDestroyed.sub(() => {
            delete rendererSets[viewerId];
            rendererSet._destroy();
        });
    }
    return rendererSet;
}
