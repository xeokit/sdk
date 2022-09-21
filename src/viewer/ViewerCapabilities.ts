/**
 * The capabilities of a {@link Viewer}.
 */
export interface ViewerCapabilities {

    /**
     * Flag set ````true```` if the {@link Viewer} supports ASTC texture compression.
     */
    astcSupported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports ETC1 texture compression.
     */
    etc1Supported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports PVRTC texture compression.
     */
    pvrtcSupported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports ETC2 texture compression.
     */
    etc2Supported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports DXT texture compression.
     */
    dxtSupported: boolean;

    /**
     * Flag set ````true```` if the {@link Viewer} supports BPTC texture format(s).
     */
    bptcSupported: boolean;
}