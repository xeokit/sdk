import {RenderFlags} from "./WebGLSceneModel/lib/RenderFlags";
import {FrameContext} from "./lib/FrameContext";

/**
 * A model that can be drawn by {@link WebGLSceneRenderer}.
 *
 * @private
 */
export interface WebGLSceneRendererDrawableModel {

    /**
     * Called by xeokit when about to render this WebGLSceneRendererDrawableModel, to generate {@link WebGLSceneRendererDrawableModel.renderFlags}.
     */
    rebuildRenderFlags(): void;

    /**
     * Called by xeokit when about to render this WebGLSceneRendererDrawableModel, to get flags indicating what rendering effects to apply for it.
     */
    get renderFlags(): RenderFlags;

    /**
     * Renders opaque filled surfaces.
     *
     * See {@link RenderFlags.colorOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawColorOpaque(frameContext: FrameContext): void;

    /**
     * Renders transparent filled surfaces.
     *
     * See {@link RenderFlags.colorTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawColorTransparent(frameContext: FrameContext): void;

    /**
     * Renders pixel depths to an internally-managed depth target, for use in post-effects (eg. SAO).
     *
     * @param frameContext Renderer frame context.
     */
    drawDepth(frameContext: FrameContext): void;

    /**
     * Renders pixel normals to an internally-managed target, for use in post-effects (eg. SAO).
     *
     * @param frameContext Renderer frame context.
     */
    drawNormals(frameContext: FrameContext): void;

    /**
     * Renders x-ray fill using {@link View.xrayMaterial}.
     *
     * See {@link RenderFlags.xrayedSilhouetteOpaque} and {@link RenderFlags.xrayedSilhouetteTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawSilhouetteXRayed(frameContext: FrameContext): void;

    /**
     * Renders highlighted transparent fill using {@link View.highlightMaterial}.
     *
     * See {@link RenderFlags.highlightedSilhouetteOpaque} and {@link RenderFlags.highlightedSilhouetteTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawSilhouetteHighlighted(frameContext: FrameContext): void;

    /**
     * Renders selected fill using {@link View.selectedMaterial}.
     *
     * See {@link RenderFlags.selectedSilhouetteOpaque} and {@link RenderFlags.selectedSilhouetteTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawSilhouetteSelected(frameContext: FrameContext): void;

    /**
     * Renders opaque normal edges using {@link View.edgeMaterial}.
     *
     * See {@link RenderFlags.edgesOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesColorOpaque(frameContext: FrameContext): void;

    /**
     * Renders transparent normal edges using {@link View.edgeMaterial}.
     *
     * See {@link RenderFlags.edgesTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesColorTransparent(frameContext: FrameContext): void;

    /**
     * Renders x-rayed edges using {@link View.xrayMaterial}.
     *
     * See {@link RenderFlags.xrayedEdgesOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesXRayed(frameContext: FrameContext): void;

    /**
     * Renders highlighted edges using {@link View.highlightMaterial}.
     *
     * See {@link RenderFlags.highlightedEdgesOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesHighlighted(frameContext: FrameContext): void;

    /**
     * Renders selected edges using {@link View.selectedMaterial}.
     *
     * See {@link RenderFlags.selectedEdgesOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesSelected(frameContext: FrameContext): void;

    /**
     * Renders occludable elements to a frame buffer where they will be tested to see if they occlude any occlusion probe markers.
     *
     * @param frameContext Renderer frame context.
     */
    drawOcclusion(frameContext: FrameContext): void;
}
