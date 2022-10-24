import {DrawFlags} from "./DrawFlags";
import {FrameContext} from "./FrameContext";

/**
 * A drawable that can be drawn by {@link WebGLRenderer}.
 */
export interface Drawable {

    // get visible(): boolean;
    //
    // get culled(): boolean;

    /**
     * Whether quality rendering is enabled for this Drawable.
     *
     * Default is ````true````.
     */
    qualityRender: boolean;

    /**
     * Called by xeokit when about to render this Drawable, to generate {@link Drawable.drawFlags}.
     */
    rebuildDrawFlags(): void;

    /**
     * Called by xeokit when about to render this Drawable, to get flags indicating what rendering effects to apply for it.
     */
    get drawFlags(): DrawFlags;

    /**
     * Renders opaque filled surfaces.
     *
     * See {@link DrawFlags.colorOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawColorOpaque(frameContext: FrameContext): void;

    /**
     * Renders transparent filled surfaces.
     *
     * See {@link DrawFlags.colorTransparent}.
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
     * See {@link DrawFlags.xrayedSilhouetteOpaque} and {@link DrawFlags.xrayedSilhouetteTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawSilhouetteXRayed(frameContext: FrameContext): void;

    /**
     * Renders highlighted transparent fill using {@link View.highlightMaterial}.
     *
     * See {@link DrawFlags.highlightedSilhouetteOpaque} and {@link DrawFlags.highlightedSilhouetteTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawSilhouetteHighlighted(frameContext: FrameContext): void;

    /**
     * Renders selected fill using {@link View.selectedMaterial}.
     *
     * See {@link DrawFlags.selectedSilhouetteOpaque} and {@link DrawFlags.selectedSilhouetteTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawSilhouetteSelected(frameContext: FrameContext): void;

    /**
     * Renders opaque normal edges using {@link View.edgeMaterial}.
     *
     * See {@link DrawFlags.edgesOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesColorOpaque(frameContext: FrameContext): void;

    /**
     * Renders transparent normal edges using {@link View.edgeMaterial}.
     *
     * See {@link DrawFlags.edgesTransparent}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesColorTransparent(frameContext: FrameContext): void;

    /**
     * Renders x-rayed edges using {@link View.xrayMaterial}.
     *
     * See {@link DrawFlags.xrayedEdgesOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesXRayed(frameContext: FrameContext): void;

    /**
     * Renders highlighted edges using {@link View.highlightMaterial}.
     *
     * See {@link DrawFlags.highlightedEdgesOpaque}.
     *
     * @param frameContext Renderer frame context.
     */
    drawEdgesHighlighted(frameContext: FrameContext): void;

    /**
     * Renders selected edges using {@link View.selectedMaterial}.
     *
     * See {@link DrawFlags.selectedEdgesOpaque}.
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
