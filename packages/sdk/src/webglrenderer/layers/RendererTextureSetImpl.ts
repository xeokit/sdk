import type {RendererTextureSet} from "../../scene";
import type {RendererTextureImpl} from "./RendererTextureImpl";

/**
 * @private
 */
export class RendererTextureSetImpl implements RendererTextureSet {

  public readonly id: string;
  public readonly colorRendererTexture: RendererTextureImpl;
  public readonly metallicRoughnessRendererTexture: RendererTextureImpl;
  public readonly emissiveRendererTexture: RendererTextureImpl;
  public readonly occlusionRendererTexture: RendererTextureImpl;

  constructor(params: {
    id: string;
    colorRendererTexture: RendererTextureImpl;
    metallicRoughnessRendererTexture: RendererTextureImpl;
    emissiveRendererTexture: RendererTextureImpl;
    occlusionRendererTexture: RendererTextureImpl;
  }) {
    this.id = params.id;
    this.colorRendererTexture = params.colorRendererTexture;
    this.metallicRoughnessRendererTexture = params.metallicRoughnessRendererTexture;
    this.emissiveRendererTexture = params.emissiveRendererTexture;
    this.occlusionRendererTexture = params.occlusionRendererTexture;
  }
}
