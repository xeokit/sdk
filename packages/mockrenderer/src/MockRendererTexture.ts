import type {RendererTexture, Texture} from "@xeokit/scene";

/**
 * TODO
 *
 * @internal
 */
export class MockRendererTexture implements RendererTexture {

    texture: Texture | null;

    constructor(texture: Texture | null) {
        this.texture = texture
    }

    destroy() {
    }
}
