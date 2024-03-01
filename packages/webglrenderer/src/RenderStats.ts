/**
 * Collects statistics during each rendered frame.
 */
export class RenderStats {

    /**
     * Number of WebGL programs that were bound in the rendered frame.
     */
    numProgramBinds: number;

    /**
     * Number of WebGL drawArrays calls performed during the rendered frame.
     */
    numDrawArrays: number;

    /**
     * Number of WebGL textures that were bound in the rendered frame.
     */
    numTextureBinds: number;

    /**
     * Creates a new RenderStats.
     */
    constructor() {
        this.reset();
    }

    /**
     * Called by the renderers before each frame.
     */
    reset() {
        this.numProgramBinds = 0;
        this.numDrawArrays = 0;
        this.numTextureBinds = 0;
    }
}
