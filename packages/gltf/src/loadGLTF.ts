import {parse} from '@loaders.gl/core';
import {GLTFLoader} from '@loaders.gl/gltf';

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
} from "@xeokit/core/constants";
import {isString} from "@xeokit/core/utils";
import {createMat4, identityMat4, mulMat4, quaternionToMat4, scalingMat4v, translationMat4v} from "@xeokit/math/matrix";
import {FloatArrayParam} from "@xeokit/math/math";
import {GeometryParams, MeshParams, SceneModel, TextureSetParams} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";

interface ParsingContext {
    gltfData: any;
    nextId: number;
    log: any;
    error: (msg) => void;
    dataModel?:DataModel;
    sceneModel?: SceneModel;
    objectCreated: { [key: string]: boolean }
}

/**
 * Loads glTF file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel} and/or
 * a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link @xeokit/gltf} for usage.
 *
 * @param params - Loading parameters.
 * @param params.data - glTF file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into. For glTF, this will create a basic aggregation hierarchy (see {@link "@xeokit/datatypes/basicTypes"}).
 * @returns {Promise} Resolves when glTF has been loaded.
 */
export function loadGLTF(params: {
    data: ArrayBuffer,
    sceneModel?: SceneModel,
    dataModel?: DataModel,
    log?: Function
}): Promise<any> {
    const dataModel = params.dataModel;
    const sceneModel = params.sceneModel;
    if (sceneModel) {
        if (sceneModel.destroyed) {
            throw new Error("SceneModel already destroyed");
        }
        if (sceneModel.built) {
            throw new Error("SceneModel already built");
        }
    }
    if (dataModel) {
        if (dataModel.destroyed) {
            throw new Error("DataModel already destroyed");
        }
        if (dataModel.built) {
            throw new Error("DataModel already built");
        }
    }
    return new Promise<void>(function (resolve, reject) {
        parse(params.data, GLTFLoader, {}).then((gltfData) => {
            const ctx: ParsingContext = {
                gltfData,
                nextId: 0,
                log: (params.log || function (msg: string) {
                }),
                error: function (msg) {
                    console.error(msg);
                },
                dataModel,
                sceneModel,
                objectCreated: {}
            };
            parseTextures(ctx);
            parseMaterials(ctx);
            parseDefaultScene(ctx);
            resolve();
        }, (errMsg) => {
            reject(`Error parsing glTF: ${errMsg}`);
        });
    });
}

function parseTextures(ctx) {
    if (!ctx.sceneModel) {
        return;
    }
    const gltfData = ctx.gltfData;
    const textures = gltfData.textures;
    if (textures) {
        for (let i = 0, len = textures.length; i < len; i++) {
            parseTexture(ctx, textures[i]);
        }
    }
}

function parseTexture(ctx, texture) {
    if (!texture.source || !texture.source.image) {
        return;
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
    ctx.sceneModel.createTexture({
        textureId: textureId,
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
    texture._textureId = textureId;
}

function parseMaterials(ctx: ParsingContext): void {
    if (!ctx.sceneModel) {
        return;
    }
    const gltfData = ctx.gltfData;
    const materials = gltfData.materials;
    if (materials) {
        for (let i = 0, len = materials.length; i < len; i++) {
            const material = materials[i];
            material._textureSetId = parseTextureSet(ctx, material);
            material._attributes = parseMaterialAttributes(ctx, material);
        }
    }
}

function parseTextureSet(ctx: ParsingContext, material: any): null | string {
    const textureSetCfg: TextureSetParams = {
        id: null,
        occlusionTextureId: null,
        emissiveTextureId: null,
        colorTextureId: null,
        metallicRoughnessTextureId: null
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
                //  textureSetCfg.colorTextureId = ctx.gltfData.textures[specularColorTexture.index]._textureId;
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
        ctx.sceneModel.createTextureSet(textureSetCfg);
        return textureSetCfg.id;
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

function parseDefaultScene(ctx: ParsingContext) {
    const gltfData = ctx.gltfData;
    const scene = gltfData.scene || gltfData.scenes[0];
    if (!scene) {
        ctx.error("glTF has no default scene");
        return;
    }
    parseScene(ctx, scene);
}

function parseScene(ctx: ParsingContext, scene: any) {
    const nodes = scene.nodes;
    if (!nodes) {
        return;
    }
    for (let i = 0, len = nodes.length; i < len; i++) {
        const node = nodes[i];
        parseNode(ctx, node, 0, null);
    }
}

const deferredMeshIds = [];

function parseNode(ctx: ParsingContext, node: any, depth: number, matrix: null | FloatArrayParam) {

    // Pre-order visit scene node

    let localMatrix;
    if (node.matrix) {
        localMatrix = node.matrix;
        if (matrix) {
            matrix = mulMat4(matrix, localMatrix, createMat4());
        } else {
            matrix = localMatrix;
        }
    }
    if (node.translation) {
        localMatrix = translationMat4v(node.translation);
        if (matrix) {
            matrix = mulMat4(matrix, localMatrix, createMat4());
        } else {
            matrix = localMatrix;
        }
    }
    if (node.rotation) {
        localMatrix = quaternionToMat4(node.rotation);
        if (matrix) {
            matrix = mulMat4(matrix, localMatrix, createMat4());
        } else {
            matrix = localMatrix;
        }
    }
    if (node.scale) {
        localMatrix = scalingMat4v(node.scale);
        if (matrix) {
            matrix = mulMat4(matrix, localMatrix, createMat4());
        } else {
            matrix = localMatrix;
        }
    }

    if (node.mesh) {

        const mesh = node.mesh;
        const numPrimitives = mesh.primitives.length;

        if (numPrimitives > 0) {
            for (let i = 0; i < numPrimitives; i++) {
                const primitive = mesh.primitives[i];
                if (!primitive._geometryId) {
                    const geometryId = "geometry-" + ctx.nextId++;
                    const geometryParams: GeometryParams = {
                        id: geometryId,
                        primitive: 0,
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
                    const POSITION = primitive.attributes.POSITION;
                    if (!POSITION) {
                        continue;
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
                    ctx.sceneModel.createGeometry(geometryParams);
                    primitive._geometryId = geometryId;
                }

                const meshId = `${ctx.nextId++}`;
                const meshParams: MeshParams = {
                    id: meshId,
                    geometryId: primitive._geometryId,
                    matrix: matrix ? matrix.slice() : identityMat4(),
                    textureSetId: undefined
                };
                const material = primitive.material;
                if (material) {
                    meshParams.textureSetId = material._textureSetId;
                    meshParams.color = material._attributes.color;
                    meshParams.opacity = material._attributes.opacity;
                    meshParams.metallic = material._attributes.metallic;
                    meshParams.roughness = material._attributes.roughness;
                } else {
                    meshParams.color = [1.0, 1.0, 1.0];
                    meshParams.opacity = 1.0;
                }
                ctx.sceneModel.createMesh(meshParams);
                deferredMeshIds.push(meshId);
            }
        }
    }

    // Visit child scene nodes

    if (node.children) {
        const children = node.children;
        for (let i = 0, len = children.length; i < len; i++) {
            const childNode = children[i];
            parseNode(ctx, childNode, depth + 1, matrix);
        }
    }

    // Post-order visit scene node

    const nodeName = node.name;
    if (((nodeName !== undefined && nodeName !== null) || depth === 0) && deferredMeshIds.length > 0) {
        if (nodeName === undefined || nodeName === null) {
            ctx.log(`Warning: 'name' properties not found on glTF scene nodes - will randomly-generate object IDs in XKT`);
        }
        let objectId = nodeName; // Fall back on generated ID when `name` not found on glTF scene node(s)
        if (!!objectId && ctx.objectCreated[objectId]) {
            ctx.log(`Warning: Two or more glTF nodes found with same 'name' attribute: '${nodeName} - will randomly-generating an object ID in XKT`);
        }
        while (!objectId || ctx.objectCreated[objectId]) {
            objectId = "object-" + ctx.nextId++;
        }
        ctx.sceneModel.createObject({
            id: objectId,
            meshIds: deferredMeshIds
        });
        ctx.objectCreated[objectId] = true;
        deferredMeshIds.length = 0;

    }
}


