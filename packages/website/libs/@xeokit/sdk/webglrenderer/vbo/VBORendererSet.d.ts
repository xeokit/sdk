import { RenderContext } from "../RenderContext";
import { VBORenderer } from "./VBORenderer";
import { RenderStats } from "../RenderStats";
import { WebGLRenderer } from "../WebGLRenderer";
/**
 * @private
 */
export declare class VBORendererSet {
    #private;
    renderContext: RenderContext;
    renderStats: RenderStats;
    constructor(webglRenderer: WebGLRenderer);
    _compile(): void;
    _eagerCreate(): void;
    get colorRenderer(): VBORenderer;
    get colorSAORenderer(): VBORenderer;
    get drawDepthRenderer(): VBORenderer;
    get silhouetteRenderer(): VBORenderer;
    get edgesColorRenderer(): VBORenderer;
    get edgesSilhouetteRenderer(): VBORenderer;
    get pickMeshRenderer(): VBORenderer;
    get pickDepthRenderer(): VBORenderer;
    get occlusionRenderer(): VBORenderer;
    get snapInitRenderer(): VBORenderer;
    get snapRenderer(): VBORenderer;
    protected createDrawColorRenderer(): VBORenderer;
    protected createDrawColorSAORenderer(): VBORenderer;
    protected createDrawDepthRenderer(): VBORenderer;
    protected createSilhouetteRenderer(): VBORenderer;
    protected createEdgesColorRenderer(): VBORenderer;
    protected createEdgesSilhouetteRenderer(): VBORenderer;
    protected createPickMeshRenderer(): VBORenderer;
    protected createPickDepthRenderer(): VBORenderer;
    protected createOcclusionRenderer(): VBORenderer;
    protected createSnapInitRenderer(): VBORenderer;
    protected createSnapRenderer(): VBORenderer;
    _destroy(): void;
}
/**
 * @private
 */
export declare class RendererSetFactory {
    #private;
    constructor(createRendererSet: (webglRenderer: any) => VBORendererSet);
    getRenderers(webglRenderer: WebGLRenderer): VBORendererSet;
}
//# sourceMappingURL=VBORendererSet.d.ts.map