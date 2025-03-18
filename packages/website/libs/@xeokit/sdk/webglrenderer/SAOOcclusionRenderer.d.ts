import { WebGLRenderBuffer } from "../webglutils";
import { RenderContext } from "./RenderContext";
import { View } from "../viewer";
/**
 * @private
 */
export declare class SAOOcclusionRenderer {
    #private;
    constructor(params: {
        renderContext: RenderContext;
    });
    render(params: {
        depthRenderBuffer: WebGLRenderBuffer;
        view: View;
    }): void;
    destroy(): void;
}
//# sourceMappingURL=SAOOcclusionRenderer.d.ts.map