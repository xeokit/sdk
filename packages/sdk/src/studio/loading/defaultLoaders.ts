import {XGFLoader} from "../../formats/xgf";
import {XGFStreamingLoader} from "../../formats/xgfstream/XGFStreamingLoader";
import {readXGFStreamingIndex} from "../../formats/xgfstream/index/readXGFStreamingIndex";
import {readXGFStreamingRuntimeIndex} from "../../formats/xgfstream/index/readXGFStreamingRuntimeIndex";
import {createXGFStreamingIndexLookup} from "../../formats/xgfstream/index/createXGFStreamingIndexLookup";
import type {XGFStreamingIndex} from "../../formats/xgfstream/index/XGFStreamingIndex";
import {IFCLoader} from "../../formats/ifc";
import {GLTFLoader} from "../../formats/gltf";
import {FBXLoader} from "../../formats/fbx";
import {USDZLoader} from "../../formats/usdz";
import {E57Loader} from "../../formats/e57";
import {LASLoader} from "../../formats/las";
import {GaussianSplatLoader} from "../../formats/gaussiansplat";
import {MTLLoader} from "../../formats/mtl";
import {OBJLoader} from "../../formats/obj";
import {PLYLoader} from "../../formats/ply";
import {DotBIMLoader} from "../../formats/dotbim";
import {CityJSONLoader} from "../../formats/cityjson";
import {FDSLoader} from "../../formats/fds";
import {ThreeDXMLLoader} from "../../formats/threedxml";
import {ThreeDTilesLoader} from "../../formats/threedtiles";
import {XKTLoader} from "../../formats/legacy/xkt";
import {MetaModelLoader} from "../../formats/legacy/metamodel";
import {DataModelImporter} from "../../formats/datamodel";
import {SceneModelImporter} from "../../formats/scenemodel";
import {SDKErrorType, type SDKResult} from "../../base/core";

import {LoaderRegistry} from "./LoaderRegistry";

/**
 * Returns a {@link LoaderRegistry} pre-populated with the built-in
 * formats Studio supports by default.
 *
 * Studio uses this by default; callers wanting a slimmer bundle or a
 * different set construct their own registry and pass it via
 * {@link StudioConfig.loaders}.
 * @private
 */
export function createDefaultLoaderRegistry(): LoaderRegistry {

  const r = new LoaderRegistry();

  r.register("xgf", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new XGFLoader().load(input, options),
  });

  r.register("xgfstream", {
    fetch: "json",
    needsScene: true,
    needsData: false,
    load: async (input, options) => loadXGFStream(input, options),
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

  r.register("fbx", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new FBXLoader().load(input, options),
  });

  r.register("usdz", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new USDZLoader().load(input, options),
  });

  r.register("e57", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: true,
    load: (input, options) => new E57Loader().load(input, options),
  });

  // LAS/LAZ point clouds — the same LASLoader handles both extensions.
  const lasDescriptor = {
    fetch: "arrayBuffer" as const,
    needsScene: true,
    needsData: true,
    load: (input: any, options: any) => new LASLoader().load(input, options),
  };
  r.register("las", lasDescriptor);
  r.register("laz", lasDescriptor);

  r.register("splat", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new GaussianSplatLoader().load(input, options),
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

  r.register("ply", {
    fetch: "text",
    needsScene: true,
    needsData: false,
    load: (input, options) => new PLYLoader().load(input, options),
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

  r.register("fds", {
    fetch: "text",
    needsScene: true,
    needsData: true,
    load: (input, options) => new FDSLoader().load(input, options),
  });

  r.register("threedxml", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new ThreeDXMLLoader().load(input, options),
  });

  r.register("threedtiles", {
    fetch: "json",
    needsScene: true,
    needsData: true,
    load: (input, options) => new ThreeDTilesLoader().load(input, options),
  });

  r.register("xkt", {
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: true,
    load: (input, options) => new XKTLoader().load(input, options),
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
    load: (input, options) => new DataModelImporter().load(input, options),
  });

  r.register("scenemodel", {
    fetch: "json",
    needsScene: true,
    needsData: false,
    load: (input, options) => new SceneModelImporter().load(input, options),
  });

  return r;
}

async function loadXGFStream(input: any, options: any): Promise<SDKResult<void>> {
  if (!input.sceneModel) {
    return invalid("[xgfstream] SceneModel expected");
  }

  const indexResult = readXGFStreamIndex(input.fileData);
  if (indexResult.ok === false) {
    return indexResult;
  }

  const index = indexResult.value;
  const lookup = createXGFStreamingIndexLookup(index);
  const sceneChunkIds = index.rootChunkIds && index.rootChunkIds.length > 0
    ? index.rootChunkIds
    : index.chunks.filter(chunk => chunk.role !== "assetLibrary").map(chunk => chunk.id);
  const sceneChunks = [];
  for (const chunkId of sceneChunkIds) {
    const chunk = lookup.byId[chunkId];
    if (!chunk) {
      return invalid(`[xgfstream] Stream index references missing root chunk '${chunkId}'`);
    }
    sceneChunks.push(chunk);
  }

  await new XGFStreamingLoader().loadChunks(
    {
      manifests: sceneChunks,
      sceneModel: input.sceneModel,
      dataModel: input.dataModel
    },
    {
      ...options,
      manifests: lookup,
      getFileData: async (manifest) => {
        if (!manifest.uri) {
          return undefined;
        }
        const uri = resolveStreamUri(options?.baseUri, manifest.uri);
        const response = await fetch(uri);
        return response.ok ? response.arrayBuffer() : undefined;
      }
    }
  );

  return {ok: true, value: undefined};
}

function readXGFStreamIndex(json: any): SDKResult<XGFStreamingIndex> {
  if (json?.format === "XGFStreamingRuntimeIndex") {
    return readXGFStreamingRuntimeIndex(json);
  }
  return readXGFStreamingIndex(json);
}

function resolveStreamUri(baseUri: string | undefined, uri: string): string {
  if (!baseUri || /^(?:[a-z]+:)?\/\//i.test(uri) || uri.startsWith("blob:") || uri.startsWith("data:")) {
    return uri;
  }
  return `${baseUri.replace(/\/?$/, "/")}${uri.replace(/^\/+/, "")}`;
}

function invalid<T>(error: string): SDKResult<T> {
  return {
    ok: false,
    type: SDKErrorType.InvalidInput,
    error
  };
}
