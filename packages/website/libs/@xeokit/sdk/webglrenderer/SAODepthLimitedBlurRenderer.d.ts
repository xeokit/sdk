import { RenderContext } from "./RenderContext";
import { WebGLRenderBuffer } from "../webglutils";
import { View } from "../viewer";
/**
 * SAO implementation inspired from previous SAO work in THREE.js by ludobaka / ludobaka.github.io and bhouston
 * @private
 */
export declare class SAODepthLimitedBlurRenderer {
    #private;
    constructor(params: {
        renderContext: RenderContext;
    });
    init(): void;
    render(params: {
        view: View;
        depthRenderBuffer: WebGLRenderBuffer;
        occlusionRenderBuffer: WebGLRenderBuffer;
        direction: number;
    }): void;
    destroy(): void;
}
//# sourceMappingURL=SAODepthLimitedBlurRenderer.d.ts.map