import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipMapLinearFilter,
  LinearMipMapNearestFilter,
  LinesPrimitive,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipMapLinearFilter,
  NearestMipMapNearestFilter,
  PointsPrimitive,
  RepeatWrapping,
  TrianglesPrimitive
} from "../../base/constants";
import {createMat4Float64, identityMat4, type Mat4, mulMat4, scalingMat4v, translationMat4v} from "../../base/math/matrix";
import {createUUID, yieldToHost} from "../../base/utils";
import {GLTFLoader as glGLTFLoader, postProcessGLTF} from '@loaders.gl/gltf';
import type {ModelLoadParams} from "../ModelLoadParams";
import type {GLTFLoadOptions} from "./GLTFLoadOptions";
import {ModelLoader} from "../ModelLoader";
import type {SceneGeometryParams, SceneMeshParams, SceneModel, SceneMaterialParams} from "../../model/scene";
import type {DataModel} from "../../model/data/DataModel";
import {parse} from '@loaders.gl/core';
import {quatToMat4} from "../../base/math/quat";
import type {LoaderProgress} from "../LoaderProgress";

/**
 * Loads a glTF file into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link gltf | @xeokit/sdk/formats/gltf}.
 */
export class GLTFLoader extends ModelLoader {
  constructor() {
    super({
      format: "glTF",
      fileDataType: "arraybuffer",
      parsers: {
        "*": parseGLTF
      },
      getVersion: (fileData: any): string => {
        return "*";
      }
    });
  }

  load(params: ModelLoadParams, options: GLTFLoadOptions = {}): Promise<any> {
    return super.load(params, options);
  }
}

interface ParsingContext {
  nodesHaveNames: boolean,
  baseId: string,
  gltfData: any;
  nextId: number;
  errors: string[];
  dataModel?: DataModel;
  sceneModel?: SceneModel;
  meshIds: any;
  meshIdsStack: string[];
  objectIdStack: string[];
  options: any;
}

async function parseGLTF(params: ModelLoadParams, options: any): Promise<any> {
  const {fileData, sceneModel, dataModel} = params;
  if (!sceneModel && !dataModel) {
    return;
  }
  // baseUri lets loaders.gl resolve external buffers + textures (`.bin`,
  // `.jpg`, etc.) referenced by relative URIs in the .gltf JSON. Without
  // it, multi-file models can only be loaded once their resources have
  // been pre-fetched. Single-file `.glb` doesn't need it.
  const parseOptions: any = {};
  if (options && options.baseUri) {
    parseOptions.baseUri = options.baseUri;
  }
  // Caller-injected Draco decoder for KHR_draco_mesh_compression. The glTF
  // decoder decompresses meshes by default; it just needs the draco3d module,
  // which the SDK does not bundle.
  if (options && options.dracoModule) {
    parseOptions.modules = {draco3d: options.dracoModule};
  }

  const onProgress: ((p: LoaderProgress) => void) | undefined = options?.onProgress;
  const signal: AbortSignal | undefined = options?.signal;
  // Reusable progress payload — see the LoaderProgress
  // contract: consumers must copy out fields they retain.
  const progress: LoaderProgress = {phase: "Decoding glTF", current: 0, total: 0};
  const emit = (phase: string, current: number, total: number): void => {
    if (!onProgress) return;
    progress.phase = phase;
    progress.current = current;
    progress.total = total;
    onProgress(progress);
  };

  emit("Decoding glTF", 0, 0);
  await yieldToHost(signal);

  let processedGLTF: any;
  try {
    const gltfData = await parse(fileData, glGLTFLoader, parseOptions);
    processedGLTF = postProcessGLTF(gltfData);
  } catch (errMsg) {
    throw new Error(`[GLTFLoader.load] Error parsing glTF -> ${errMsg}`);
  }
  await yieldToHost(signal);

  const ctx: ParsingContext = {
    nodesHaveNames: false, // determined in testIfNodesHaveNames()
    meshIds: [],
    meshIdsStack: [],
    objectIdStack: [],
    baseId: createUUID(),
    gltfData: processedGLTF,
    nextId: 0,
    errors: [],
    dataModel,
    sceneModel,
    options: options || {}
  };

  // Phase boundaries — yield + emit between each so the dialog
  // paints during the heaviest phase transitions. Per-item
  // yields inside the recursive scene walker are a future
  // refinement; this minimum gives huge glTFs three or four
  // paint opportunities mid-load instead of zero.
  emit("Decoding textures", 0, 0);
  if (!parseTextures(ctx)) {
    throw new Error(ctx.errors.length > 0 ? ctx.errors[0] : `[GLTFLoader.load] Error parsing glTF`);
  }
  await yieldToHost(signal);

  emit("Building materials", 0, 0);
  if (!parseMaterials(ctx)) {
    throw new Error(ctx.errors.length > 0 ? ctx.errors[0] : `[GLTFLoader.load] Error parsing glTF`);
  }
  await yieldToHost(signal);

  emit("Building scene", 0, 0);
  if (!parseDefaultScene(ctx)) {
    throw new Error(ctx.errors.length > 0 ? ctx.errors[0] : `[GLTFLoader.load] Error parsing glTF`);
  }
  emit("Building scene", 1, 1);

  parseStructuralMetadata(ctx);
}

const METADATA_COMPONENTS: Record<string, number> = {
  VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
};

/**
 * Value of property row `i` from a decoded `EXT_structural_metadata` column.
 * loaders.gl returns fixed-size numeric vectors / matrices as one flat typed
 * array, so a `VEC*` / `MAT*` row is the matching slice; SCALAR and everything
 * else is indexed directly.
 */
function featureMetadataValue(data: any, i: number, type: string | undefined): any {
  if (data == null) return undefined;
  const components = type ? METADATA_COMPONENTS[type] : undefined;
  if (components && typeof data[i * components] === "number") {
    return Array.from(data.slice(i * components, i * components + components));
  }
  return data[i];
}

/**
 * Stable id shared between a feature's DataObject (from an
 * `EXT_structural_metadata` property table) and the SceneObject holding that
 * feature's geometry (split out per `EXT_mesh_features` feature id). A
 * SceneObject and DataObject with the same id are the same logical object, so
 * matching ids is what links a picked feature to its metadata.
 */
function featureObjectId(baseId: string, tableIndex: number, featureIndex: number): string {
  return `${baseId}-pt${tableIndex}-f${featureIndex}`;
}

/**
 * Maps `EXT_structural_metadata` property tables onto the DataModel: one
 * DataObject (with a property set) per feature row, typed by the table's
 * schema class. loaders.gl decodes each property column into
 * `propertyTableProperty.data`, indexed by feature. When `dataParentId` is
 * set, each feature aggregates under that DataObject (the 3D Tiles loader
 * passes the tileset's root). Feature ids are shared with the geometry split in
 * {@link splitPrimitiveByFeature}, so a feature's DataObject and SceneObject
 * carry the same id.
 */
function parseStructuralMetadata(ctx: ParsingContext): void {
  const dataModel = ctx.dataModel;
  const sm = ctx.gltfData?.extensions?.EXT_structural_metadata;
  if (!dataModel || !sm?.propertyTables) {
    return;
  }
  const parentId: string | undefined = ctx.options.dataParentId;
  for (let t = 0; t < sm.propertyTables.length; t++) {
    const table = sm.propertyTables[t];
    const count = table.count || 0;
    const className = table.class || "Feature";
    const schemaClass = sm.schema?.classes?.[className];
    const propNames = Object.keys(table.properties || {});
    for (let i = 0; i < count; i++) {
      const objectId = featureObjectId(ctx.baseId, t, i);
      const propertySetId = `${objectId}-props`;
      dataModel.createPropertySet({
        id: propertySetId,
        name: className,
        type: className,
        properties: propNames.map(name => ({
          name,
          value: featureMetadataValue(table.properties[name]?.data, i, schemaClass?.properties?.[name]?.type),
        })),
      });
      dataModel.createObject({id: objectId, type: className, name: `${className} ${i}`, propertySetIds: [propertySetId]});
      if (parentId) {
        dataModel.createRelationship({type: "BasicAggregation", relatingObjectId: parentId, relatedObjectId: objectId});
      }
    }
  }
}

function parseTextures(ctx: any): boolean {
  if (!ctx.sceneModel) {
    return true;
  }
  const gltfData = ctx.gltfData;
  const textures = gltfData.textures;
  if (textures) {
    for (let i = 0, len = textures.length; i < len; i++) {
      if (!parseTexture(ctx, textures[i])) {
        return false;
      }
    }
  }
  return true;
}

function parseTexture(ctx: any, texture: any): boolean {
  if (!texture.source || !texture.source.image) {
    ctx.errors.push(`[GLTFLoader.load] Texture has no image source`);
    return false;
  }
  const textureId = `texture-${ctx.baseId}-${ctx.nextId++}`;
  let minFilter = NearestMipMapLinearFilter;
  switch (texture.sampler.minFilter) {
    case 9728:
      minFilter = NearestFilter;
      break;
    case 9729:
      minFilter = LinearFilter;
      break;
    case 9984:
      minFilter = NearestMipMapNearestFilter;
      break;
    case 9985:
      minFilter = LinearMipMapNearestFilter;
      break;
    case 9986:
      minFilter = NearestMipMapLinearFilter;
      break;
    case 9987:
      minFilter = LinearMipMapLinearFilter;
      break;
  }
  let magFilter = LinearFilter;
  switch (texture.sampler.magFilter) {
    case 9728:
      magFilter = NearestFilter;
      break;
    case 9729:
      magFilter = LinearFilter;
      break;
  }
  let wrapS = RepeatWrapping;
  switch (texture.sampler.wrapS) {
    case 33071:
      wrapS = ClampToEdgeWrapping;
      break;
    case 33648:
      wrapS = MirroredRepeatWrapping;
      break;
    case 10497:
      wrapS = RepeatWrapping;
      break;
  }
  let wrapT = RepeatWrapping;
  switch (texture.sampler.wrapT) {
    case 33071:
      wrapT = ClampToEdgeWrapping;
      break;
    case 33648:
      wrapT = MirroredRepeatWrapping;
      break;
    case 10497:
      wrapT = RepeatWrapping;
      break;
  }
  let wrapR = RepeatWrapping;
  switch (texture.sampler.wrapR) {
    case 33071:
      wrapR = ClampToEdgeWrapping;
      break;
    case 33648:
      wrapR = MirroredRepeatWrapping;
      break;
    case 10497:
      wrapR = RepeatWrapping;
      break;
  }
  const result = ctx.sceneModel.createTexture({
    id: textureId,
    image: texture.source.image,
    mediaType: texture.source.mediaType,
    compressed: true,
    width: texture.source.image.width,
    height: texture.source.image.height,
    minFilter,
    magFilter,
    wrapS,
    wrapT,
    wrapR,
    flipY: !!texture.flipY,
    //     encoding: "sRGB"
  });
  if (result.ok === false) {
    ctx.errors.push(`[GLTFLoader.load] Failed to create texture -> ${result.error}`);
    return false;
  }
  texture._textureId = textureId;
  return true;
}

function parseMaterials(ctx: ParsingContext): boolean {
  const gltfData = ctx.gltfData;
  const materials = gltfData.materials;
  if (materials) {
    for (let i = 0, len = materials.length; i < len; i++) {
      const material = materials[i];
      // Always-create: every glTF material maps to one SceneMaterial,
      // even ones without textures, so meshes referencing them get
      // their PBR factors via `materialId` rather than via a
      // per-mesh fallback. color/opacity/roughness/metallic are baked
      // into the SceneMaterial up front.
      const materialCfg = parseMaterial(ctx, material);
      const materialResult = ctx.sceneModel.createMaterial(materialCfg);
      if (materialResult.ok === false) {
        ctx.errors.push(`Failed to create SceneMaterial set -> ${materialResult.error}`);
        return false;
      }
      material._materialId = materialResult.value.id;
    }
  }
  return true;
}

/**
 * Translates a glTF material into a {@link SceneMaterialParams}.
 *
 * Maps:
 *   - `pbrMetallicRoughness.baseColorFactor` → `color` + `opacity`
 *   - `pbrMetallicRoughness.metallicFactor`  → `metallic` (default 1)
 *   - `pbrMetallicRoughness.roughnessFactor` → `roughness` (default 1)
 *   - `pbrMetallicRoughness.baseColorTexture`         → `colorTextureId`
 *   - `pbrMetallicRoughness.metallicRoughnessTexture` → `metallicRoughnessTextureId`
 *   - `normalTexture`                                  → `normalsTextureId`
 *   - `occlusionTexture`                               → `occlusionTextureId`
 *   - `emissiveTexture`                                → `emissiveTextureId`
 *
 * Falls back to legacy `KHR_materials_pbrSpecularGlossiness` when no
 * MetallicRoughness block is present (some older models use it).
 *
 * Texture references rely on `parseTextures` having run first — that
 * stamps a `_textureId` on each glTF texture entry which we look up
 * here. The chain is `material.<map>.texture._textureId` (after
 * `postProcessGLTF` resolves indices to objects); when the texture
 * field hasn't been resolved we fall back to the raw `index` lookup.
 */
function parseMaterial(ctx: ParsingContext, material: any): SceneMaterialParams {
  const materialCfg: SceneMaterialParams = {
    id: `material-${ctx.baseId}-${ctx.nextId++}`,
    color: [1, 1, 1],
    opacity: 1,
    roughness: 1,
    metallic: 1  // glTF default — texture-driven materials use 1×1; lit materials override.
  };

  // ── Factors (always present in glTF 2.0 PBR) ───────────────────────────
  const metallicPBR = material.pbrMetallicRoughness;
  if (metallicPBR) {
    const baseColorFactor = metallicPBR.baseColorFactor;
    if (baseColorFactor) {
      materialCfg.color   = [baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]];
      materialCfg.opacity = baseColorFactor[3] ?? 1;
    }
    if (metallicPBR.metallicFactor !== undefined && metallicPBR.metallicFactor !== null) {
      materialCfg.metallic = metallicPBR.metallicFactor;
    }
    if (metallicPBR.roughnessFactor !== undefined && metallicPBR.roughnessFactor !== null) {
      materialCfg.roughness = metallicPBR.roughnessFactor;
    }
    // ── PBR maps ─────────────────────────────────────────────────────────
    const baseColorTexture = metallicPBR.baseColorTexture || metallicPBR.colorTexture;
    if (baseColorTexture) {
      materialCfg.colorTextureId = resolveTextureId(ctx, baseColorTexture);
    }
    if (metallicPBR.metallicRoughnessTexture) {
      materialCfg.metallicRoughnessTextureId = resolveTextureId(ctx, metallicPBR.metallicRoughnessTexture);
    }
  }

  // ── Alpha mode + cutoff (glTF 2.0 alphaMode/alphaCutoff) ───────────────
  // OPAQUE is the glTF default. MASK + cutoff drives cutout cases like
  // Sponza's drape and the leaves on foliage glTFs; BLEND lets the
  // sampled alpha through to the framebuffer for translucent materials.
  if (material.alphaMode === "MASK" || material.alphaMode === "BLEND") {
    materialCfg.alphaMode = material.alphaMode;
  }
  if (material.alphaCutoff !== undefined && material.alphaCutoff !== null) {
    materialCfg.alphaCutoff = material.alphaCutoff;
  }

  // ── Standard non-PBR maps ──────────────────────────────────────────────
  if (material.normalTexture) {
    materialCfg.normalsTextureId = resolveTextureId(ctx, material.normalTexture);
  }
  if (material.occlusionTexture) {
    materialCfg.occlusionTextureId = resolveTextureId(ctx, material.occlusionTexture);
  }
  if (material.emissiveTexture) {
    materialCfg.emissiveTextureId = resolveTextureId(ctx, material.emissiveTexture);
  }
  // Emissive factor (glTF `emissiveFactor`, RGB), scaled by
  // KHR_materials_emissive_strength when present. When the factor is omitted,
  // we leave `emissiveColor` unset so createMaterial auto-defaults it to
  // `[1,1,1]` for textured materials (glow without restating the factor).
  // The per-mesh slot is RGB8, so HDR strengths > 1 clamp to white.
  if (material.emissiveFactor) {
    const strength = material.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    materialCfg.emissiveColor = [
      Math.min(1, material.emissiveFactor[0] * strength),
      Math.min(1, material.emissiveFactor[1] * strength),
      Math.min(1, material.emissiveFactor[2] * strength),
    ];
  }

  // ── Legacy KHR_materials_pbrSpecularGlossiness fallback ────────────────
  // Older glTFs (especially exported from Substance) still ship this
  // extension with a diffuseFactor + diffuseTexture instead of base-
  // colour. Map the diffuse colour onto our base colour so the
  // material at least picks up the right tint; we don't try to convert
  // the gloss/spec textures to MR here.
  const extensions = material.extensions;
  if (extensions) {
    const specularPBR = extensions["KHR_materials_pbrSpecularGlossiness"];
    if (specularPBR) {
      const diffuseFactor = specularPBR.diffuseFactor;
      if (diffuseFactor) {
        materialCfg.color   = [diffuseFactor[0], diffuseFactor[1], diffuseFactor[2]];
        materialCfg.opacity = diffuseFactor[3] ?? materialCfg.opacity;
      }
      if (specularPBR.diffuseTexture && !materialCfg.colorTextureId) {
        materialCfg.colorTextureId = resolveTextureId(ctx, specularPBR.diffuseTexture);
      }
    }
  }

  return materialCfg;
}

/**
 * Resolves a glTF textureInfo into the SceneTexture id that
 * {@link parseTexture} stamped onto the texture entry. Handles both
 * post-processed form (`textureInfo.texture._textureId`) and the raw
 * index form (`gltfData.textures[textureInfo.index]._textureId`).
 * Returns `undefined` if the texture entry is missing — surfaces fall
 * back to factor-only rendering when that happens.
 */
function resolveTextureId(ctx: ParsingContext, textureInfo: any): string | undefined {
  if (!textureInfo) return undefined;
  if (textureInfo.texture && textureInfo.texture._textureId) {
    return textureInfo.texture._textureId;
  }
  if (typeof textureInfo.index === "number" && ctx.gltfData.textures) {
    const entry = ctx.gltfData.textures[textureInfo.index];
    return entry && entry._textureId;
  }
  return undefined;
}

function parseDefaultScene(ctx: ParsingContext): boolean {
  const gltfData = ctx.gltfData;
  const scene = gltfData.scene || gltfData.scenes[0];
  if (!scene) {
    ctx.errors.push("[GLTFLoader.load] Cannot load glTF - glTF has no default scene");
    return false;
  }
  return parseScene(ctx, scene);
}

function parseScene(ctx: ParsingContext, scene: any): boolean {
  const nodes = scene.nodes;
  if (!nodes) {
    return true;
  }
  for (let i = 0, len = nodes.length; i < len && !ctx.nodesHaveNames; i++) {
    const node = nodes[i];
    if (testIfNodesHaveNames(node)) {
      ctx.nodesHaveNames = true;
    }
  }
  // Optional root transform pre-multiplied into every node's world matrix.
  // Used by the 3D Tiles loader to place a tile's glTF content with the tile's
  // composed world transform without baking it into the geometry.
  const rootMatrix = ctx.options.rootMatrix || null;
  if (!ctx.nodesHaveNames) {
    //   ctx.log(`Warning: No "name" attributes found on glTF scene nodes - objects in XKT may not be what you expect`);
    ctx.meshIds = [];
    for (let i = 0, len = nodes.length; i < len; i++) {
      const node = nodes[i];
      if (!parseNodesWithoutNames(ctx, node, 0, rootMatrix)) {
        return false;
      }
    }
  } else {
    ctx.meshIds = null;
    for (let i = 0, len = nodes.length; i < len; i++) {
      const node = nodes[i];
      if (!parseNodesWithNames(ctx, node, 0, rootMatrix)) {
        return false;
      }
    }
  }
  return true;
}

function createPrimitiveHash(ctx, primitive) {
  const hash = [ctx.baseId];
  const attributes = primitive.attributes;
  if (attributes) {
    for (const key in attributes) {
      hash.push(attributes[key].id);
      hash.push(attributes[key].count);
    }
  }
  hash.push(primitive.mode);
  if (primitive.indices) {
    hash.push(primitive.indices.id);
    hash.push(primitive.indices.count);
  }
  return hash.join(".");
}

function testIfNodesHaveNames(node, level = 0): boolean {
  if (!node) {
    return false;
  }
  if (node.name) {
    return true;
  }
  if (node.children) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
      const childNode = children[i];
      if (testIfNodesHaveNames(childNode, level + 1)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Parses a glTF node hierarchy that is known to NOT contain "name" attributes on the nodes.
 * Create a XKTMesh for each mesh primitive, and a single XKTEntity.
 */
// State lives on `ctx` (not in a closure) so concurrent glTF loads — e.g. the
// 3D Tiles streamer decoding several tiles at once — don't corrupt each other.
function parseNodesWithoutNames(ctx, node, depth, matrix): boolean {
  if (!node) {
    return true;
  }
  const meshIds = ctx.meshIds;
  matrix = parseNodeMatrix(node, matrix);
  if (node.mesh) {
    parseMesh(node, ctx, matrix, meshIds);
  }
  if (node.children) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
      const childNode = children[i];
      parseNodesWithoutNames(ctx, childNode, depth + 1, matrix);
    }
  }
  if (depth === 0) {
    const objectId = `entity-${ctx.baseId}-${ctx.nextId++}`;
    if (meshIds && meshIds.length > 0) {
      const result = ctx.sceneModel.createObject({
        id: objectId,
        meshIds,
        layerId: ctx.options.layerId
      });
      if (result.ok === false) {
        ctx.errors.push(`[GLTFLoader.load] Failed to create SceneObject -> ${result.error}`);
        return false;
      }
      meshIds.length = 0;
    }
  }
  return true;
}


/**
 * Parses a glTF node hierarchy that is known to contain "name" attributes on the nodes.
 *
 * Create a XKTMesh for each mesh primitive, and XKTEntity for each named node.
 *
 * Following a depth-first traversal, each XKTEntity is created on post-visit of each named node,
 * and gets all the XKTMeshes created since the last XKTEntity created.
 */
// State lives on `ctx` (not in a closure) so concurrent glTF loads don't
// corrupt each other (see parseNodesWithoutNames).
function parseNodesWithNames(ctx, node, depth, matrix): boolean {
    const objectIdStack = ctx.objectIdStack;
    const meshIdsStack = ctx.meshIdsStack;
    if (!node) {
      return true;
    }
    matrix = parseNodeMatrix(node, matrix);
    if (node.name) {
      ctx.meshIds = [];
      let objectId = node.name;
      // Some exporters (notably 3DS Max) emit duplicate node names like
      // `3DSMeshMatrix` across many nodes. We can't fail the whole load
      // on that — synthesize a unique fallback ID instead and warn once
      // per duplicate so the issue is still visible in the console.
      if (objectId && ctx.sceneModel.objects[objectId]) {
        console.warn(`[GLTFLoader.load] Duplicate glTF node 'name' attribute: '${objectId}' — assigning a synthetic ID`);
        objectId = "";
      }
      while (!objectId || ctx.sceneModel.objects[objectId]) {
        objectId = `entity-${ctx.baseId}-${ctx.nextId++}`;
      }
      objectIdStack.push(objectId);
      meshIdsStack.push(ctx.meshIds);
    }
    if (ctx.meshIds && node.mesh) {
      if (!parseMesh(node, ctx, matrix, ctx.meshIds)) {
        return false;
      }
    }
    if (node.children) {
      const children = node.children;
      for (let i = 0, len = children.length; i < len; i++) {
        const childNode = children[i];
        if (!parseNodesWithNames(ctx, childNode, depth + 1, matrix)) {
          return false;
        }
      }
    }
    const nodeName = node.name;
    if ((nodeName !== undefined && nodeName !== null) || depth === 0) {
      let objectId = objectIdStack.pop();
      if (!objectId) { // For when there are no nodes with names
        objectId = `entity-${ctx.baseId}-${ctx.nextId++}`;
      }
      const entityMeshIds = meshIdsStack.pop();
      if (ctx.meshIds && ctx.meshIds.length > 0) {
        const result = ctx.sceneModel.createObject({
          id: objectId,
          meshIds: entityMeshIds
        });
        if (result.ok === false) {
          ctx.errors.push(`[GLTFLoader.load] Failed to create SceneObject -> ${result.error}`);
          return false;
        }
      }
      ctx.meshIds = meshIdsStack.length > 0 ? meshIdsStack[meshIdsStack.length - 1] : null;
    }
    return true;
}

function parseNodeMatrix(node, matrix) {
  if (!node) {
    return;
  }
  let localMatrix;
  if (node.matrix) {
    localMatrix = node.matrix;
    if (matrix) {
      matrix = mulMat4(matrix, localMatrix, createMat4Float64());
    } else {
      matrix = localMatrix;
    }
  }
  if (node.translation) {
    localMatrix = translationMat4v(node.translation);
    if (matrix) {
      matrix = mulMat4(matrix, localMatrix, createMat4Float64());
    } else {
      matrix = localMatrix;
    }
  }
  if (node.rotation) {
    localMatrix = quatToMat4(node.rotation);
    if (matrix) {
      matrix = mulMat4(matrix, localMatrix, createMat4Float64());
    } else {
      matrix = localMatrix;
    }
  }
  if (node.scale) {
    localMatrix = scalingMat4v(node.scale);
    if (matrix) {
      matrix = mulMat4(matrix, localMatrix, createMat4Float64());
    } else {
      matrix = localMatrix;
    }
  }
  return matrix;
}

function parseMesh(node: any, ctx: ParsingContext, matrix: Mat4, meshIds: string[]): boolean {

  if (node.mesh) {

    const mesh = node.mesh;
    const numPrimitives = mesh.primitives.length;

    for (let i = 0; i < numPrimitives; i++) {
      const primitive = mesh.primitives[i];

      // A primitive whose EXT_mesh_features feature id is a per-vertex attribute
      // bound to a property table is split into one SceneObject per feature, so
      // each feature is an individually pickable object linked to its metadata.
      if (splitPrimitiveByFeature(ctx, primitive, matrix)) {
        continue;
      }

      const geometryId = createPrimitiveHash(ctx, primitive);

      //  geometryId = createUUID();
      if (!ctx.sceneModel.geometries[geometryId]) {
        const POSITION = primitive.attributes.POSITION;
        if (!POSITION) {
          ctx.errors.push(`[GLTFLoader.load] Primitive has no POSITION attribute`);
          return false;
        }
        const geometryParams: SceneGeometryParams = {
          id: geometryId,
          primitive: 0,
          // @ts-ignore
          positions: undefined
        };
        switch (primitive.mode) {
          case 0: // POINTS
            geometryParams.primitive = PointsPrimitive;
            break;
          case 1: // LINES
            geometryParams.primitive = LinesPrimitive;
            break;
          case 2: // LINE_LOOP
            geometryParams.primitive = LinesPrimitive;
            break;
          case 3: // LINE_STRIP
            geometryParams.primitive = LinesPrimitive;
            break;
          case 4: // TRIANGLES
            geometryParams.primitive = TrianglesPrimitive;
            break;
          case 5: // TRIANGLE_STRIP
            geometryParams.primitive = TrianglesPrimitive;
            break;
          case 6: // TRIANGLE_FAN
            geometryParams.primitive = TrianglesPrimitive;
            break;
          default:
            geometryParams.primitive = TrianglesPrimitive;
        }
        geometryParams.positions = primitive.attributes.POSITION.value;
        if (primitive.attributes.COLOR_0) {
          geometryParams.colors = primitive.attributes.COLOR_0.value;
        }
        if (primitive.attributes.NORMAL) {
          geometryParams.normals = primitive.attributes.NORMAL.value;
        }
        if (primitive.attributes.TEXCOORD_0) {
          geometryParams.uvs = primitive.attributes.TEXCOORD_0.value;
        }
        if (primitive.indices) {
          geometryParams.indices = primitive.indices.value;
        }
        // @ts-ignore
        const result = ctx.sceneModel.createGeometry(geometryParams);
        if (result.ok === false) {
          ctx.errors.push(`[GLTFLoader.load] Failed to create SceneGeometry -> ${result.error}`);
          return false;
        }
      }

      const meshId = `${ctx.baseId}-${ctx.nextId++}`;
      const meshParams: SceneMeshParams = {
        id: meshId,
        geometryId,
        matrix: matrix ? createMat4Float64(matrix) : identityMat4(createMat4Float64()),
        materialId: undefined
      };
      const material = primitive.material;
      if (material && material._materialId) {
        meshParams.materialId = material._materialId;
      } else {
        meshParams.color = [1.0, 1.0, 1.0];
        meshParams.opacity = 1.0;
      }
      // @ts-ignore
      const result = ctx.sceneModel.createMesh(meshParams);
      if (result.ok === false) {
        ctx.errors.push(`[GLTFLoader.load] Failed to create SceneMesh -> ${result.error}`);
        return false;
      }
      meshIds.push(meshId);
    }
  }

  return true;
}

/**
 * If `primitive` is a triangle mesh whose `EXT_mesh_features` declares a feature
 * id carried by a per-vertex attribute (`_FEATURE_ID_n`) and bound to a property
 * table, splits it into one geometry + mesh + SceneObject per distinct feature
 * value and returns `true` (the caller then skips its normal per-primitive
 * path). Each SceneObject's id is {@link featureObjectId}, matching the feature's
 * property-table DataObject so the two are the same logical object. Returns
 * `false` for any primitive without that structure, leaving it to the normal
 * path.
 *
 * Triangles by feature: a triangle belongs to the feature of its first corner
 * (feature regions don't straddle triangles in well-formed assets). Feature
 * id textures, non-triangle primitives, and vertex colours are not split.
 */
function splitPrimitiveByFeature(ctx: ParsingContext, primitive: any, matrix: Mat4): boolean {
  if (primitive.mode != null && primitive.mode !== 4) {
    return false;
  }
  const featureId = primitive.extensions?.EXT_mesh_features?.featureIds?.find(
    (f: any) => f.attribute != null && f.propertyTable != null,
  );
  if (!featureId) {
    return false;
  }
  const featureValues = primitive.attributes[`_FEATURE_ID_${featureId.attribute}`]?.value;
  const positions = primitive.attributes.POSITION?.value;
  if (!featureValues || !positions) {
    return false;
  }
  const normals = primitive.attributes.NORMAL?.value;
  const uvs = primitive.attributes.TEXCOORD_0?.value;
  const srcIndices = primitive.indices?.value;
  const triangleCount = srcIndices ? srcIndices.length / 3 : positions.length / 9;

  const cornersByFeature = new Map<number, number[]>();
  for (let t = 0; t < triangleCount; t++) {
    const a = srcIndices ? srcIndices[t * 3] : t * 3;
    const b = srcIndices ? srcIndices[t * 3 + 1] : t * 3 + 1;
    const c = srcIndices ? srcIndices[t * 3 + 2] : t * 3 + 2;
    const feature = featureValues[a];
    let corners = cornersByFeature.get(feature);
    if (!corners) {
      corners = [];
      cornersByFeature.set(feature, corners);
    }
    corners.push(a, b, c);
  }

  let materialId: string | undefined;
  const material = primitive.material;
  if (material && material._materialId) {
    materialId = material._materialId;
  }

  for (const [feature, corners] of cornersByFeature) {
    const remap = new Map<number, number>();
    const outPositions: number[] = [];
    const outNormals: number[] | null = normals ? [] : null;
    const outUvs: number[] | null = uvs ? [] : null;
    const outIndices: number[] = [];
    for (const v of corners) {
      let local = remap.get(v);
      if (local === undefined) {
        local = remap.size;
        remap.set(v, local);
        outPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
        if (outNormals) outNormals.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
        if (outUvs) outUvs.push(uvs[v * 2], uvs[v * 2 + 1]);
      }
      outIndices.push(local);
    }

    const objectId = featureObjectId(ctx.baseId, featureId.propertyTable, feature);
    const geometryId = `${objectId}-geometry`;
    const geometryParams: SceneGeometryParams = {
      id: geometryId,
      primitive: TrianglesPrimitive,
      positions: new Float32Array(outPositions),
      indices: new Uint32Array(outIndices),
    };
    if (outNormals) geometryParams.normals = new Float32Array(outNormals);
    if (outUvs) geometryParams.uvs = new Float32Array(outUvs);
    if (ctx.sceneModel.createGeometry(geometryParams).ok === false) {
      continue;
    }

    const meshId = `${objectId}-mesh`;
    const meshParams: SceneMeshParams = {
      id: meshId,
      geometryId,
      matrix: matrix ? createMat4Float64(matrix) : identityMat4(createMat4Float64()),
      materialId,
    };
    if (!materialId) {
      meshParams.color = [1.0, 1.0, 1.0];
      meshParams.opacity = 1.0;
    }
    if (ctx.sceneModel.createMesh(meshParams).ok === false) {
      continue;
    }
    ctx.sceneModel.createObject({id: objectId, meshIds: [meshId], layerId: ctx.options.layerId});
  }
  return true;
}
