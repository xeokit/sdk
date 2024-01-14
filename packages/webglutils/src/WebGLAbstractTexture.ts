/**
 * Abstract WebGL texture that can be bound and unbound.
 */
export type WebGLAbstractTexture = {

    /**
     * Binds the texture to the given WebGL texture unit.
     * @param unit
     */
    bind(unit: number): boolean;

    /**
     * Unbinds the texture from the given WebGL texture unit.
     * @param unit
     */
    unbind(unit: number): void;
}