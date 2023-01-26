/**
 * The capabilities of a {@link WebViewer}.
 *
 * * Located at {@link WebViewer.capabilities}
 * * Determined by the {@link Renderer} implementation, GPU, browser, O/S and other system resources
 */
export interface WebViewerCapabilities {
    /**
     * The number of {@link View|Views} we are allowed to create with {@link WebViewer.createView}.
     *
     * This will be determined by the {@link Renderer} implementation the WebViewer is configured with.
     */
    maxViews: number;
    /**
     * Flag set ````true```` if {@link ViewerModel.createTexture} supports ASTC texture compression.
     *
     * This capability would be supported by {@link ViewerModel.createTexture},
     * and is determined by the {@link Renderer} implementation the WebViewer is configured with.
     */
    astcSupported: boolean;
    /**
     * Flag set ````true```` if the {@link WebViewer} supports ETC1 texture compression.
     *
     * This capability would be supported by {@link ViewerModel.createTexture},
     * and is determined by the {@link Renderer} implementation the WebViewer is configured with.
     */
    etc1Supported: boolean;
    /**
     * Flag set ````true```` if the {@link WebViewer} supports PVRTC texture compression.
     *
     * This capability would be supported by {@link ViewerModel.createTexture},
     * and is determined by the {@link Renderer} implementation the WebViewer is configured with.
     */
    pvrtcSupported: boolean;
    /**
     * Flag set ````true```` if the {@link WebViewer} supports ETC2 texture compression.
     *
     * This capability would be supported by {@link ViewerModel.createTexture},
     * and is determined by the {@link Renderer} implementation the WebViewer is configured with.
     */
    etc2Supported: boolean;
    /**
     * Flag set ````true```` if the {@link WebViewer} supports DXT texture compression.
     *
     * This will be determined by the {@link Renderer} implementation the WebViewer is configured with.
     */
    dxtSupported: boolean;
    /**
     * Flag set ````true```` if the {@link WebViewer} supports BPTC texture format(s).
     *
     * This capability would be supported by {@link ViewerModel.createTexture},
     * and is determined by the {@link Renderer} implementation the WebViewer is configured with.
     */
    bptcSupported: boolean;
}
