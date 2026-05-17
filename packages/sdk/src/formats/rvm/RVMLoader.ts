import {ModelLoader} from "../ModelLoader";
import {parse as parse_v2} from "./versions/v2/parse";
import {ChunkReader} from "./versions/v2/chunkReader";

/**
 * Loads an AVEVA RVM file into a {@link model!scene.SceneModel | SceneModel}.
 *
 * RVM is the binary plant-design format produced by AVEVA PDMS / E3D.
 * It carries a tree of containers (`CNTB` / `CNTE`) holding parametric
 * primitives (boxes, cylinders, spheres, snouts, toruses, dishes,
 * facet groups). This loader currently understands the RVM v2 dialect.
 *
 * Implementation status:
 *   - Header / Model chunk metadata: parsed and skipped.
 *   - Container hierarchy: walked; one `SceneObject` per CNTB.
 *   - Primitives decoded: Pyramid, Box, RectTorus, CircTorus,
 *     EllipDish, SpherDish, Snout, Cylinder, Sphere, FacetGroup.
 *     Line primitives are recognised but skipped (1D data — the
 *     triangle-based render path can't represent them).
 *   - Paired `.attr` / `.att` text-attribute files are not yet
 *     consumed; without them, object IDs come from the CNTB hierarchy.
 *
 * @example
 * ```ts
 * const loader = new RVMLoader();
 * await loader.load({ fileData, sceneModel });
 * ```
 */
export class RVMLoader extends ModelLoader {
  constructor() {
    super({
      format: "RVM",
      fileDataType: "arraybuffer",
      parsers: {
        "2": parse_v2
      },
      // RVM v1, v2, and v3 share the same chunk frame; this loader
      // routes everything through the v2 parser, which is forgiving
      // about chunk-version dwords. Confirm the file at least starts
      // with a HEAD chunk before dispatching.
      getVersion: (fileData: any): string => {
        try {
          const reader = new ChunkReader(fileData);
          const id = reader.readChunkId();
          return id === "HEAD" ? "2" : "";
        } catch {
          return "";
        }
      }
    });
  }
}
