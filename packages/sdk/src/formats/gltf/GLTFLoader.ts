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
} from "../../constants";
import {createMat4Float64, identityMat4, type Mat4, mulMat4, scalingMat4v, translationMat4v} from "../../math/matrix";
import {createUUID, isString} from "../../utils";
import {GLTFLoader as glGLTFLoader, postProcessGLTF} from '@loaders.gl/gltf';
import type {ModelLoadParams} from "../ModelLoadParams";
import {ModelLoader} from "../ModelLoader";
import type {SceneGeometryParams, SceneMeshParams, SceneModel, SceneTextureSetParams} from "../../scene";
import type {DataModel} from "../../data/DataModel";
import {parse} from '@loaders.gl/core';
import {quatToMat4} from "../../math/quat";

/**
 * Loads a glTF file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
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
}

function parseGLTF(params: ModelLoadParams): Promise<any> {
  return new Promise<void>(function (resolve, reject) {
    const {fileData, sceneModel, dataModel} = params;
    if (!sceneModel && !dataModel) {
      return resolve();
    }
    parse(fileData, glGLTFLoader, {}).then((gltfData) => {
      const processedGLTF = postProcessGLTF(gltfData);
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
        sceneModel
      };
      if (parseTextures(ctx)
        && parseMaterials(ctx)
        && parseDefaultScene(ctx)) {
        return resolve();
      } else {
        return reject(ctx.errors.length > 0 ? ctx.errors[0] : `[GLTFLoader.load] Error parsing glTF`);
      }
    }, (errMsg) => {
      return reject(`[GLTFLoader.load] Error parsing glTF -> ${errMsg}`);
    });
  });
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
  const textureId = `texture-${ctx.nextId++}`;
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
    imageData: texture.source.image,
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
      const textureSetCfg = parseTextureSet(ctx, material);
      if (textureSetCfg) {
        const textureSetResult = ctx.sceneModel.createTextureSet(textureSetCfg);
        if (textureSetResult.ok === false) {
          ctx.errors.push(`Failed to create texture set -> ${textureSetResult.error}`);
          return false;
        }
        const textureSet = textureSetResult.value;
        material._textureSetId = textureSet.id;
      }
      material._attributes = parseMaterialAttributes(ctx, material);
    }
  }
  return true;
}

function parseTextureSet(ctx: ParsingContext, material: any): null | SceneTextureSetParams {
  const textureSetCfg: SceneTextureSetParams = {
    id: null,
    occlusionTextureId: undefined,
    emissiveTextureId: undefined,
    colorTextureId: undefined,
    metallicRoughnessTextureId: undefined
  };
  if (material.occlusionTexture) {
    textureSetCfg.occlusionTextureId = material.occlusionTexture.texture._textureId;
  }
  if (material.emissiveTexture) {
    textureSetCfg.emissiveTextureId = material.emissiveTexture.texture._textureId;
  }
  // const alphaMode = material.alphaMode;
  // switch (alphaMode) {
  //     case "NORMAL_OPAQUE":
  //         materialCfg.alphaMode = "opaque";
  //         break;
  //     case "MASK":
  //         materialCfg.alphaMode = "mask";
  //         break;
  //     case "BLEND":
  //         materialCfg.alphaMode = "blend";
  //         break;
  //     default:
  // }
  // const alphaCutoff = material.alphaCutoff;
  // if (alphaCutoff !== undefined) {
  //     materialCfg.alphaCutoff = alphaCutoff;
  // }
  const metallicPBR = material.pbrMetallicRoughness;
  if (material.pbrMetallicRoughness) {
    const pbrMetallicRoughness = material.pbrMetallicRoughness;
    const baseColorTexture = pbrMetallicRoughness.baseColorTexture || pbrMetallicRoughness.colorTexture;
    if (baseColorTexture) {
      if (baseColorTexture.texture) {
        textureSetCfg.colorTextureId = baseColorTexture.texture._textureId;
      } else {
        textureSetCfg.colorTextureId = ctx.gltfData.textures[baseColorTexture.index]._textureId;
      }
    }
    if (metallicPBR.metallicRoughnessTexture) {
      textureSetCfg.metallicRoughnessTextureId = metallicPBR.metallicRoughnessTexture.texture._textureId;
    }
  }
  const extensions = material.extensions;
  if (extensions) {
    const specularPBR = extensions["KHR_materials_pbrSpecularGlossiness"];
    if (specularPBR) {
      const specularTexture = specularPBR.specularTexture;
      if (specularTexture !== null && specularTexture !== undefined) {
        //  textureSetCfg.colorTextureId = ctx.gltfData.textures[specularColorTexture.tileIndex]._textureId;
      }
      const specularColorTexture = specularPBR.specularColorTexture;
      if (specularColorTexture !== null && specularColorTexture !== undefined) {
        textureSetCfg.colorTextureId = ctx.gltfData.textures[specularColorTexture.index]._textureId;
      }
    }
  }
  if (textureSetCfg.occlusionTextureId !== undefined ||
    textureSetCfg.emissiveTextureId !== undefined ||
    textureSetCfg.colorTextureId !== undefined ||
    textureSetCfg.metallicRoughnessTextureId !== undefined) {
    textureSetCfg.id = `textureSet-${ctx.nextId++};`
    return textureSetCfg;
  }
  return null;
}

function parseMaterialAttributes(ctx: ParsingContext, material: any): any { // Substitute RGBA for material, to use fast flat shading instead
  const extensions = material.extensions;
  const materialAttributes = {
    color: new Float32Array([1, 1, 1, 1]),
    opacity: 1,
    metallic: 0,
    roughness: 1
  };
  if (extensions) {
    const specularPBR = extensions["KHR_materials_pbrSpecularGlossiness"];
    if (specularPBR) {
      const diffuseFactor = specularPBR.diffuseFactor;
      if (diffuseFactor !== null && diffuseFactor !== undefined) {
        materialAttributes.color.set(diffuseFactor);
      }
    }
    const common = extensions["KHR_materials_common"];
    if (common) {
      const technique = common.technique;
      const values = common.values || {};
      const blinn = technique === "BLINN";
      const phong = technique === "PHONG";
      const lambert = technique === "LAMBERT";
      const diffuse = values.diffuse;
      if (diffuse && (blinn || phong || lambert)) {
        if (!isString(diffuse)) {
          materialAttributes.color.set(diffuse);
        }
      }
      const transparency = values.transparency;
      if (transparency !== null && transparency !== undefined) {
        materialAttributes.opacity = transparency;
      }
      const transparent = values.transparent;
      if (transparent !== null && transparent !== undefined) {
        materialAttributes.opacity = transparent;
      }
    }
  }
  const metallicPBR = material.pbrMetallicRoughness;
  if (metallicPBR) {
    const baseColorFactor = metallicPBR.baseColorFactor;
    if (baseColorFactor) {
      materialAttributes.color[0] = baseColorFactor[0];
      materialAttributes.color[1] = baseColorFactor[1];
      materialAttributes.color[2] = baseColorFactor[2];
      materialAttributes.opacity = baseColorFactor[3];
    }
    const metallicFactor = metallicPBR.metallicFactor;
    if (metallicFactor !== null && metallicFactor !== undefined) {
      materialAttributes.metallic = metallicFactor;
    }
    const roughnessFactor = metallicPBR.roughnessFactor;
    if (roughnessFactor !== null && roughnessFactor !== undefined) {
      materialAttributes.roughness = roughnessFactor;
    }
  }
  return materialAttributes;
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
  if (!ctx.nodesHaveNames) {
    //   ctx.log(`Warning: No "name" attributes found on glTF scene nodes - objects in XKT may not be what you expect`);
    for (let i = 0, len = nodes.length; i < len; i++) {
      const node = nodes[i];
      if (!parseNodesWithoutNames(ctx, node, 0, null)) {
        return false;
      }
    }
  } else {
    for (let i = 0, len = nodes.length; i < len; i++) {
      const node = nodes[i];
      if (!parseNodesWithNames(ctx, node, 0, null)) {
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
const parseNodesWithoutNames = (function () {

  const meshIds = [];

  return function (ctx, node, depth, matrix): boolean {
    if (!node) {
      return true;
    }
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
      const objectId = "entity-" + ctx.nextId++;
      if (meshIds && meshIds.length > 0) {
        const result = ctx.sceneModel.createObject({
          id: objectId,
          meshIds
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
})();


/**
 * Parses a glTF node hierarchy that is known to contain "name" attributes on the nodes.
 *
 * Create a XKTMesh for each mesh primitive, and XKTEntity for each named node.
 *
 * Following a depth-first traversal, each XKTEntity is created on post-visit of each named node,
 * and gets all the XKTMeshes created since the last XKTEntity created.
 */
const parseNodesWithNames = (function () {

  const objectIdStack = [];
  const meshIdsStack = [];
  let meshIds = null;

  return function (ctx, node, depth, matrix): boolean {
    if (!node) {
      return true;
    }
    matrix = parseNodeMatrix(node, matrix);
    if (node.name) {
      meshIds = [];
      let objectId = node.name;
      if (!!objectId && ctx.sceneModel.objects[objectId]) {
        ctx.errors.push(`[GLTFLoader.load] Two or more glTF nodes found with same value for 'name' attribute: '${objectId}'`);
        return false;
      }
      while (!objectId || ctx.sceneModel.objects[objectId]) {
        objectId = "entity-" + ctx.nextId++;
      }
      objectIdStack.push(objectId);
      meshIdsStack.push(meshIds);
    }
    if (meshIds && node.mesh) {
      if (!parseMesh(node, ctx, matrix, meshIds)) {
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
        objectId = "entity-" + ctx.nextId++;
      }
      const entityMeshIds = meshIdsStack.pop();
      if (meshIds && meshIds.length > 0) {
        const result = ctx.sceneModel.createObject({
          id: objectId,
          meshIds: entityMeshIds
        });
        if (result.ok === false) {
          ctx.errors.push(`[GLTFLoader.load] Failed to create SceneObject -> ${result.error}`);
          return false;
        }
      }
      meshIds = meshIdsStack.length > 0 ? meshIdsStack[meshIdsStack.length - 1] : null;
    }
    return true;
  }
})();

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

      const meshId = `${ctx.nextId++}`;
      const meshParams: SceneMeshParams = {
        id: meshId,
        geometryId,
        matrix: matrix ? createMat4Float64(matrix) : identityMat4(createMat4Float64()),
        textureSetId: undefined
      };
      const material = primitive.material;
      if (material) {
        //     meshParams.textureSetId = material._textureSetId;
        meshParams.color = material._attributes.color.slice(0, 3);
        meshParams.opacity = material._attributes.opacity;
        // meshParams.metallic = material._attributes.metallic;
        // meshParams.roughness = material._attributes.roughness;
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
