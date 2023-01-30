import type {Texture} from "./Texture";

export interface TextureSet {
    id: string;
    colorTexture?: Texture;
    metallicRoughnessTexture?: Texture
    occlusionTexture?: Texture;
    emissiveTexture?: Texture;
}