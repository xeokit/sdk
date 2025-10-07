import type {RendererTexture, RendererTextureSet} from "../../scene";


/**
 * @private
 */
export class RendererTextureSetImpl implements RendererTextureSet {

  public readonly id: string;
  public readonly colorRendererTexture: RendererTexture;
  public readonly metallicRoughnessRendererTexture: RendererTexture;
  public readonly emissiveRendererTexture: RendererTexture;
  public readonly occlusionRendererTexture: RendererTexture;

  constructor(params: {
    id: string;
    colorRendererTexture: RendererTexture;
    metallicRoughnessRendererTexture: RendererTexture;
    emissiveRendererTexture: RendererTexture;
    occlusionRendererTexture: RendererTexture;
  }) {
    this.id = params.id;
    this.colorRendererTexture = params.colorRendererTexture;
    this.metallicRoughnessRendererTexture = params.metallicRoughnessRendererTexture;
    this.emissiveRendererTexture = params.emissiveRendererTexture;
    this.occlusionRendererTexture = params.occlusionRendererTexture;
  }
}
