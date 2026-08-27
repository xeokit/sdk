import type {ModelLoadOptions} from "../ModelLoadOptions";

/**
 * Options for {@link formats!e57.E57Loader.load | E57Loader.load}.
 *
 * For detailed usage, refer to {@link formats!e57 | @xeokit/sdk/formats/e57}.
 */
export interface E57LoaderOptions extends ModelLoadOptions {

  /**
   * Keep every `skip`-th valid point (decimation for large scans). Defaults to 1
   * (keep every point).
   */
  skip?: number;

  /**
   * When a scan has no RGB color but does carry `intensity`, map intensity to a
   * grayscale color (normalised across the scan). Off by default.
   */
  intensityAsColor?: boolean;

  /**
   * Optional layer ID assigned to every {@link model!scene.SceneObject | SceneObject}
   * the loader creates (one per scan).
   */
  layerId?: string;
}
