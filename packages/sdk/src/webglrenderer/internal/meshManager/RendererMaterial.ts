
/**
 * Represents a set of renderer textures for a mesh.
 *
 * @internal
 */
export class RendererMaterial  {

  public readonly id: string;
  // public readonly colorRendererTexture: SceneTextureRendererProxy;
  // public readonly metallicRoughnessRendererTexture: SceneTextureRendererProxy;
  // public readonly emissiveRendererTexture: SceneTextureRendererProxy;
  // public readonly occlusionRendererTexture: SceneTextureRendererProxy;

  constructor(params: {
    id: string;
    // colorRendererTexture: SceneTextureRendererProxy;
    // metallicRoughnessRendererTexture: SceneTextureRendererProxy;
    // emissiveRendererTexture: SceneTextureRendererProxy;
    // occlusionRendererTexture: SceneTextureRendererProxy;
  }) {
    this.id = params.id;
    // this.colorRendererTexture = params.colorRendererTexture;
    // this.metallicRoughnessRendererTexture = params.metallicRoughnessRendererTexture;
    // this.emissiveRendererTexture = params.emissiveRendererTexture;
    // this.occlusionRendererTexture = params.occlusionRendererTexture;
  }
}
