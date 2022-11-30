/**
 * The capabilities of a {@link Viewer}.
 *
 * * Located at {@link Viewer.capabilities}
 *
 */
export interface ViewerCapabilities {

    /**
     * The number of {@link View}s we are allowed to create with {@link Viewer.createView}.
     *
     * This will be determined by the {@link Renderer} implementation the Viewer is configured with.
     */
    maxViews: number;

    /**
     * Flag set ````true```` if the {@link Viewer} supports ASTC texture compression.
     *
     * This will be determined by the {@link Renderer} implementation the Viewer is configured with.
     */
    astcSupported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports ETC1 texture compression.
     *
     * This will be determined by the {@link Renderer} implementation the Viewer is configured with.
     */
    etc1Supported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports PVRTC texture compression.
     *
     * This will be determined by the {@link Renderer} implementation the Viewer is configured with.
     */
    pvrtcSupported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports ETC2 texture compression.
     *
     * This will be determined by the {@link Renderer} implementation the Viewer is configured with.
     */
    etc2Supported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports DXT texture compression.
     *
     * This will be determined by the {@link Renderer} implementation the Viewer is configured with.
     */
    dxtSupported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports BPTC texture format(s).
     *
     * This will be determined by the {@link Renderer} implementation the Viewer is configured with.
     */
    bptcSupported: boolean;
}