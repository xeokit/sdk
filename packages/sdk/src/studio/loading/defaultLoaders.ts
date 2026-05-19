import {XGFLoader} from "../../formats/xgf";
import {IFCLoader} from "../../formats/ifc";
import {GLTFLoader} from "../../formats/gltf";
import {MTLLoader} from "../../formats/mtl";
import {OBJLoader} from "../../formats/obj";
import {DotBIMLoader} from "../../formats/dotbim";
import {CityJSONLoader} from "../../formats/cityjson";
import {MetaModelLoader} from "../../formats/metamodel";
import {DataModelParamsLoader} from "../../formats/datamodel";
import {SceneModelParamsLoader} from "../../formats/scenemodel";

import {LoaderRegistry} from "./LoaderRegistry";

/**
 * Returns a {@link LoaderRegistry} pre-populated with the built-in
 * formats Studio supports out of the box.
 *
 * Studio uses this by default; callers wanting a slimmer bundle or a
 * different set construct their own registry and pass it via
 * {@link StudioConfig.loaders}.
 */
export function createDefaultLoaderRegistry(): LoaderRegistry {

  const r = new LoaderRegistry();

  r.register("xgf", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new XGFLoader().load(input, options),
  });

  r.register("ifc", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: true,
    load: (input, options) => new IFCLoader().load(input, options),
  });

  r.register("gltf", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new GLTFLoader().load(input, options),
  });

  r.register("mtl", {
    fetch: "text",
    needsScene: true,
    needsData: false,
    load: (input, options) => new MTLLoader().load(input, options),
  });

  r.register("obj", {
    fetch: "text",
    needsScene: true,
    needsData: false,
    load: (input, options) => new OBJLoader().load(input, options),
  });

  // Matches pre-registry behaviour: Studio fetched dotbim as
  // ArrayBuffer even though DotBIMLoader declares fileDataType "json".
  // Preserved here so the refactor is byte-identical; if it turns out
  // to be a latent bug, fix it as a follow-up in the loader, not here.
  r.register("dotbim", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: true,
    load: (input, options) => new DotBIMLoader().load(input, options),
  });

  r.register("cityjson", {
    fetch: "json",
    needsScene: true,
    needsData: true,
    load: (input, options) => new CityJSONLoader().load(input, options),
  });

  r.register("metamodel", {
    fetch: "json",
    needsScene: false,
    needsData: true,
    load: (input, options) => new MetaModelLoader().load(input, options),
  });

  r.register("datamodel", {
    fetch: "json",
    needsScene: false,
    needsData: true,
    load: (input, options) => new DataModelParamsLoader().load(input, options),
  });

  r.register("scenemodel", {
    fetch: "json",
    needsScene: true,
    needsData: false,
    load: (input, options) => new SceneModelParamsLoader().load(input, options),
  });

  return r;
}
