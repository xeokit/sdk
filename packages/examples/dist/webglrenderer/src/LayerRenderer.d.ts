import type { RenderContext } from "./RenderContext";
import type { Layer } from "./Layer";
/**
 * @private
 */
export declare abstract class LayerRenderer {
    #private;
    /**
     * Initialization error messages
     */
    errors: string[] | undefined;
    protected renderContext: RenderContext;
    protected constructor(renderContext: RenderContext);
    /**
     * Generates vertex shader GLSL for the current View state
     */
    protected abstract buildVertexShader(): string;
    /**
     * Generates fragment shader GLSL for the current View state
     */
    protected abstract buildFragmentShader(): string;
    /**
     * Gets a hash for the View's current configuration as pertaining to the LayerRenderer.
     */
    protected abstract getHash(): string;
    /**
     * Indicates that the LayerRenderer may need to rebuild shaders
     */
    needRebuild(): void;
    /**
     * Draws the given Layer.
     *
     * @param layer The Layer to draw
     */
    draw(layer: Layer): void;
    protected get vertHeader(): string;
    protected get vertDataTextureDefs(): string;
    protected get vertLogDepthBufDefs(): string;
    protected get vertDataTextureSamples(): string;
    protected get vertLogDepthBufOutputs(): string;
    protected get fragmentShader(): string;
    protected get fragHeader(): string;
    protected get fragGammaDefs(): string;
    protected get fragLightDefs(): string;
    protected get fragLogDepthBufDefs(): string;
    protected get fragLogDepthBufOutput(): string;
    protected get fragLighting(): string;
    protected get fragSAOOutput(): string;
    protected get fragOutput(): string;
    protected get fragSectionPlaneDefs(): string;
    protected get fragLightSourceUniforms(): string;
    protected get fragSectionPlanesSlice(): string;
    protected get fragFlatShading(): string;
    destroy(): void;
}
