/**
 * Defines the format the glTF file manifests output by gltf.
 */
export class Ifc2gltfManifestParams {

  /**
   * Paths to glTF files created by if2gltf.
   */
  gltfOutFiles: string[];

  /**
   * Paths to JSON metadata files created by if2gltf.
   *
   * Metadata file format is described by {@link metamodel!MetaModelParams | MetaModelParams}.
   */
  metadataOutFiles: string[];
}
