import type {Texture} from "./Texture";

export interface TextureSet {
    textureSetId: string;
    colorTexture?: Texture;
    metallicRoughnessTexture?: Texture
    occlusionTexture?: Texture;
    emissiveTexture?: Texture;
}