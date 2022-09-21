import {RenderFlags} from "../WebGLVBOSceneModel/lib/RenderFlags";
import {FrameContext} from "./FrameContext";


/**
 * Contract for objects drawn with {@link WebGLSceneRenderer}.
 *
 * @private
 */
export interface WebGLSceneRendererDrawable {

    /**
     * Called by xeokit when about to render this Drawable, to generate {@link WebGLSceneRendererDrawable#renderFlags}.
     */
    rebuildRenderFlags(): void;

    /**
     * Called by xeokit when about to render this Drawable, to get flags indicating what rendering effects to apply for it.
     */
    get renderFlags(): RenderFlags;

    /**
     * Renders opaque edges using {@link View#edgeMaterial}.
     *
     * See {@link RenderFlags#colorOpaque}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawColorOpaque(frameCtx: FrameContext): void;

    /**
     * Renders transparent filled surfaces using normal appearance attributes.
     *
     * See {@link RenderFlags#colorTransparent}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawColorTransparent(frameCtx: FrameContext): void;

    /**
     * Renders pixel depths to an internally-managed depth target, for use in post-effects (eg. SAO).
     *
     * @param frameCtx Renderer frame context.
     */
    drawDepth(frameCtx: FrameContext): void;

    /**
     * Renders pixel normals to an internally-managed target, for use in post-effects (eg. SAO).
     *
     * @param frameCtx Renderer frame context.
     */
    drawNormals(frameCtx: FrameContext): void;

    /**
     * Renders x-ray fill using {@link View#xrayMaterial}.
     *
     * See {@link RenderFlags#xrayedSilhouetteOpaque} and {@link RenderFlags#xrayedSilhouetteTransparent}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawSilhouetteXRayed(frameCtx: FrameContext): void;

    /**
     * Renders highlighted transparent fill using {@link View#highlightMaterial}.
     *
     * See {@link RenderFlags#highlightedSilhouetteOpaque} and {@link RenderFlags#highlightedSilhouetteTransparent}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawSilhouetteHighlighted(frameCtx: FrameContext): void;

    /**
     * Renders selected fill using {@link View#selectedMaterial}.
     *
     * See {@link RenderFlags#selectedSilhouetteOpaque} and {@link RenderFlags#selectedSilhouetteTransparent}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawSilhouetteSelected(frameCtx: FrameContext): void;

    /**
     * Renders opaque normal edges using {@link View#edgeMaterial}.
     *
     * See {@link RenderFlags#edgesOpaque}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawEdgesColorOpaque(frameCtx: FrameContext): void;

    /**
     * Renders transparent normal edges using {@link View#edgeMaterial}.
     *
     * See {@link RenderFlags#edgesTransparent}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawEdgesColorTransparent(frameCtx: FrameContext): void;

    /**
     * Renders x-rayed edges using {@link View#xrayMaterial}.
     *
     * See {@link RenderFlags#xrayedEdgesOpaque}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawEdgesXRayed(frameCtx: FrameContext): void;

    /**
     * Renders highlighted edges using {@link View#highlightMaterial}.
     *
     * See {@link RenderFlags#highlightedEdgesOpaque}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawEdgesHighlighted(frameCtx: FrameContext): void;

    /**
     * Renders selected edges using {@link View#selectedMaterial}.
     *
     * See {@link RenderFlags#selectedEdgesOpaque}.
     *
     * @param frameCtx Renderer frame context.
     */
    drawEdgesSelected(frameCtx: FrameContext): void;

    /**
     * Renders occludable elements to a frame buffer where they will be tested to see if they occlude any occlusion probe markers.
     *
     * @param frameCtx Renderer frame context.
     */
    drawOcclusion(frameCtx: FrameContext): void;
}
