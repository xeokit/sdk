/**
 * A set of capability flags.
 */
export interface Capabilities {

    /**
     * Maximum number of Views allowed.
     */
    maxViews: number;

    /**
     * Does the renderer run headless?
     *
     * This is `true` when the renderer is a "mock renderer", that works without rendering anything.
     */
    headless: boolean;

    /**
     * Support for ASTC texture compression?
     */
    astcSupported: boolean;

    /**
     * Support for ETC1 texture compression?
     */
    etc1Supported: boolean;

    /**
     * Support for PVRTC texture compression?
     */
    pvrtcSupported: boolean;

    /**
     * Support for ETC2 texture compression?
     */
    etc2Supported: boolean;

    /**
     * Support for DXT texture compression?
     */
    dxtSupported: boolean;

    /**
     * Support for BPTC texture format(s)?
     */
    bptcSupported: boolean;
}