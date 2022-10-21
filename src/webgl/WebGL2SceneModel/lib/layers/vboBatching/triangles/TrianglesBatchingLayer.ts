import {ENTITY_FLAGS} from '../../../ENTITY_FLAGS';
import {RENDER_PASSES} from '../../../RENDER_PASSES';

import * as math from "../../../../../../viewer/math";
import {RenderState} from "../../../../../../viewer/utils";
import {ArrayBuf} from "../../../../../lib/ArrayBuf";
import {getTrianglesBatchingRenderers} from "./TrianglesBatchingRenderers";
import {BatchingBuffer} from "../BatchingBuffer";

import {TextureSet} from "../../../TextureSet";

import {FrameContext} from "../../../../../lib/FrameContext";
import {WebGL2SceneModel} from "../../../../WebGL2SceneModel";
import {DrawFlags} from "../../../DrawFlags";

const tempVec3a = math.vec3();
const tempVec3b = math.vec3();
const tempVec3c = math.vec3();
const tempVec3d = math.vec3();
const tempVec3e = math.vec3();
const tempVec3f = math.vec3();
const tempVec3g = math.vec3();
const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempVec4c = math.vec4([0, 0, 0, 1]);
const tempOBB3 = math.boundaries.OBB3();

/**
 * @private
 */
class TrianglesBatchingLayer {

    state: any;
    aabb: math.FloatArrayType;
    solid: boolean;
    sceneModel: any;
    sortId: string;
    layerIndex: any;
    #batchingRenderers: any;
    #buffer: BatchingBuffer;
    #scratchMemory: any;
    #numPortions: number;
    #numVisibleLayerPortions: number;
    #numTransparentLayerPortions: number;
    #numXRayedLayerPortions: number;
    #numSelectedLayerPortions: number;
    #numHighlightedLayerPortions: number;
    #numClippableLayerPortions: number;
    #numEdgesLayerPortions: number;
    #numPickableLayerPortions: number;
    #numCulledLayerPortions: number;
    #positionsCompressionAABB: math.FloatArrayType;
    #portions: any[];
    #numVerts: number;
    #finalized: boolean;
    #preCompressedPositionsExpected: boolean;
    #preCompressedNormalsExpected: boolean;
    #deferredFlagValues: any;
    #setDeferredFlag2Values: any;

    constructor(params: {
        origin: math.FloatArrayType;
        uvsDecompressMatrix: math.FloatArrayType;
        positionsDecompressMatrix: math.FloatArrayType;
        scratchMemory: any;
        maxGeometryBatchSize: number;
        layerIndex: any;
        textureSet: TextureSet;
        autoNormals: boolean;
        solid: boolean;
        sceneModel: WebGL2SceneModel;
    }) {
        this.sceneModel = params.sceneModel;
        this.sortId = "TrianglesBatchingLayer"
            + (params.solid ? "-solid" : "-surface")
            + (params.autoNormals ? "-autonormals" : "-normals")

            // TODO: These two parts need to be IDs (ie. unique):

            + (params.textureSet && params.textureSet.colorTexture ? "-colorTexture" : "")
            + (params.textureSet && params.textureSet.metallicRoughnessTexture ? "-metallicRoughnessTexture" : "");

        this.layerIndex = params.layerIndex;
        this.#batchingRenderers = getTrianglesBatchingRenderers(params.sceneModel.view);
        this.#buffer = new BatchingBuffer(params.maxGeometryBatchSize);
        this.#scratchMemory = params.scratchMemory;

        this.state = new RenderState({
            origin: math.vec3(),
            positionsBuf: null,
            offsetsBuf: null,
            normalsBuf: null,
            colorsBuf: null,
            uvBuf: null,
            metallicRoughnessBuf: null,
            flagsBuf: null,
            flags2Buf: null,
            indicesBuf: null,
            edgeIndicesBuf: null,
            positionsDecompressMatrix: math.mat4(),
            uvsDecompressMatrix: null,
            textureSet: params.textureSet,
            pbrSupported: false,
            colorTextureSupported: false
        });

        this.#numPortions = 0;
        this.#numVisibleLayerPortions = 0;
        this.#numTransparentLayerPortions = 0;
        this.#numXRayedLayerPortions = 0;
        this.#numSelectedLayerPortions = 0;
        this.#numHighlightedLayerPortions = 0;
        this.#numClippableLayerPortions = 0;
        this.#numEdgesLayerPortions = 0;
        this.#numPickableLayerPortions = 0;
        this.#numCulledLayerPortions = 0;
        this.#positionsCompressionAABB = math.boundaries.collapseAABB3();
        this.#portions = [];
        this.#numVerts = 0;
        this.#finalized = false;

        if (params.positionsDecompressMatrix) {
            this.state.positionsDecompressMatrix.set(params.positionsDecompressMatrix);
            this.#preCompressedPositionsExpected = true;
        } else {
            this.#preCompressedPositionsExpected = false;
        }

        if (params.uvsDecompressMatrix) {
            this.state.uvsDecompressMatrix = math.mat3(params.uvsDecompressMatrix);
            this.#preCompressedNormalsExpected = true;
        } else {
            this.#preCompressedNormalsExpected = false;
        }

        if (params.origin) {
            this.state.origin.set(params.origin);
        }

        this.aabb = math.boundaries.collapseAABB3();
        this.solid = !!params.solid;
    }

    canCreatePortion(lenPositions: number, lenIndices: number) {
        if (this.#finalized) {
            throw "Already finalized";
        }
        return ((this.#buffer.positions.length + lenPositions) < (this.#buffer.maxVerts * 3) && (this.#buffer.indices.length + lenIndices) < (this.#buffer.maxIndices));
    }

    createPortion(params: {
        positions: math.FloatArrayType;
        positionsCompressed: math.FloatArrayType;
        normals: math.FloatArrayType;
        normalsCompressed: math.FloatArrayType;
        uv: math.FloatArrayType;
        uvsCompressed: math.FloatArrayType;
        colors: math.FloatArrayType;
        colorsCompressed: math.FloatArrayType;
        indices: math.FloatArrayType;
        edgeIndices: math.FloatArrayType;
        color: math.FloatArrayType;
        metallic: number;
        roughness: number;
        opacity: number;
        meshMatrix: math.FloatArrayType;
        worldMatrix: math.FloatArrayType;
        worldAABB: math.FloatArrayType;
        pickColor: math.FloatArrayType;
    }) {

        if (this.#finalized) {
            throw "Already finalized";
        }

        const positions = params.positions;
        const positionsCompressed = params.positionsCompressed;
        const normals = params.normals;
        const normalsCompressed = params.normalsCompressed;
        const uv = params.uv;
        const uvsCompressed = params.uvsCompressed;
        const colors = params.colors;
        const colorsCompressed = params.colorsCompressed;
        const indices = params.indices;
        const edgeIndices = params.edgeIndices;
        const color = params.color;
        const metallic = params.metallic;
        const roughness = params.roughness;
        const opacity = params.opacity;
        const meshMatrix = params.meshMatrix;
        const worldMatrix = params.worldMatrix;
        const worldAABB = params.worldAABB;
        const pickColor = params.pickColor;

        const scene = this.sceneModel.scene;
        const buffer = this.#buffer;
        const positionsIndex = buffer.positions.length;
        const vertsIndex = positionsIndex / 3;

        let numVerts;


        if (this.#preCompressedPositionsExpected) {

            if (!positionsCompressed) {
                throw "positionsCompressed expected";
            }

            numVerts = positionsCompressed.length / 3;

            for (let i = 0, len = positionsCompressed.length; i < len; i++) {
                buffer.positions.push(positionsCompressed[i]);
            }

            const bounds = math.compression.getPositionsBounds(positionsCompressed);

            const min = math.compression.decompressPosition(bounds.min, this.state.positionsDecompressMatrix, []);
            const max = math.compression.decompressPosition(bounds.max, this.state.positionsDecompressMatrix, []);

            worldAABB[0] = min[0];
            worldAABB[1] = min[1];
            worldAABB[2] = min[2];
            worldAABB[3] = max[0];
            worldAABB[4] = max[1];
            worldAABB[5] = max[2];

            if (worldMatrix) {
                math.boundaries.AABB3ToOBB3(worldAABB, tempOBB3);
                math.boundaries.transformOBB3(worldMatrix, tempOBB3);
                math.boundaries.OBB3ToAABB3(tempOBB3, worldAABB);
            }

        } else {

            if (!positions) {
                throw "positions expected";
            }

            numVerts = positions.length / 3;

            const lenPositions = positions.length;

            const positionsBase = buffer.positions.length;

            for (let i = 0, len = positions.length; i < len; i++) {
                buffer.positions.push(positions[i]);
            }

            if (meshMatrix) {

                for (let i = positionsBase, len = positionsBase + lenPositions; i < len; i += 3) {

                    tempVec4a[0] = buffer.positions[i + 0];
                    tempVec4a[1] = buffer.positions[i + 1];
                    tempVec4a[2] = buffer.positions[i + 2];

                    math.transformPoint4(meshMatrix, tempVec4a, tempVec4b);

                    buffer.positions[i + 0] = tempVec4b[0];
                    buffer.positions[i + 1] = tempVec4b[1];
                    buffer.positions[i + 2] = tempVec4b[2];

                    math.boundaries.expandAABB3Point3(this.#positionsCompressionAABB, tempVec4b);

                    if (worldMatrix) {
                        math.transformPoint4(worldMatrix, tempVec4b, tempVec4c);
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4c);
                    } else {
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
                    }
                }

            } else {

                for (let i = positionsBase, len = positionsBase + lenPositions; i < len; i += 3) {

                    tempVec4a[0] = buffer.positions[i + 0];
                    tempVec4a[1] = buffer.positions[i + 1];
                    tempVec4a[2] = buffer.positions[i + 2];

                    math.boundaries.expandAABB3Point3(this.#positionsCompressionAABB, tempVec4a);

                    if (worldMatrix) {
                        math.transformPoint4(worldMatrix, tempVec4a, tempVec4b);
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
                    } else {
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4a);
                    }
                }
            }
        }

        if (this.state.origin) {
            const origin = this.state.origin;
            worldAABB[0] += origin[0];
            worldAABB[1] += origin[1];
            worldAABB[2] += origin[2];
            worldAABB[3] += origin[0];
            worldAABB[4] += origin[1];
            worldAABB[5] += origin[2];
        }

        math.boundaries.expandAABB3(this.aabb, worldAABB);

        if (normalsCompressed && normalsCompressed.length > 0) {
            for (let i = 0, len = normalsCompressed.length; i < len; i++) {
                buffer.normals.push(normalsCompressed[i]);
            }
        } else if (normals && normals.length > 0) {
            const worldNormalMatrix = tempMat4;
            if (meshMatrix) {
                math.inverseMat4(math.transposeMat4(meshMatrix, tempMat4b), worldNormalMatrix); // Note: order of inverse and transpose doesn't matter
            } else {
                math.identityMat4(worldNormalMatrix);
            }
            math.compression.transformAndOctEncodeNormals(worldNormalMatrix, normals, normals.length, buffer.normals, buffer.normals.length);
        }

        if (colors) {
            for (let i = 0, len = colors.length; i < len; i += 3) {
                buffer.colors.push(colors[i] * 255);
                buffer.colors.push(colors[i + 1] * 255);
                buffer.colors.push(colors[i + 2] * 255);
                buffer.colors.push(255);
            }
        } else if (colorsCompressed) {
            for (let i = 0, len = colors.length; i < len; i += 3) {
                buffer.colors.push(colors[i]);
                buffer.colors.push(colors[i + 1]);
                buffer.colors.push(colors[i + 2]);
                buffer.colors.push(255);
            }
        } else if (color) {
            const r = color[0]; // Color is pre-quantized by VBOSceneModel
            const g = color[1];
            const b = color[2];
            const a = opacity;
            const metallicValue = (metallic !== null && metallic !== undefined) ? metallic : 0;
            const roughnessValue = (roughness !== null && roughness !== undefined) ? roughness : 255;
            for (let i = 0; i < numVerts; i++) {
                buffer.colors.push(r);
                buffer.colors.push(g);
                buffer.colors.push(b);
                buffer.colors.push(a);
                buffer.metallicRoughness.push(metallicValue);
                buffer.metallicRoughness.push(roughnessValue);
            }
        }

        if (uv && uv.length > 0) {
            for (let i = 0, len = uv.length; i < len; i++) {
                buffer.uv.push(uv[i]);
            }
        } else if (uvsCompressed && uvsCompressed.length > 0) {
            for (let i = 0, len = uvsCompressed.length; i < len; i++) {
                buffer.uv.push(uvsCompressed[i]);
            }
        }

        if (indices) {
            for (let i = 0, len = indices.length; i < len; i++) {
                buffer.indices.push(indices[i] + vertsIndex);
            }
        }

        if (edgeIndices) {
            for (let i = 0, len = edgeIndices.length; i < len; i++) {
                buffer.edgeIndices.push(edgeIndices[i] + vertsIndex);
            }
        }

        {
            const pickColorsBase = buffer.pickColors.length;
            const lenPickColors = numVerts * 4;
            for (let i = pickColorsBase, len = pickColorsBase + lenPickColors; i < len; i += 4) {
                buffer.pickColors.push(pickColor[0]);
                buffer.pickColors.push(pickColor[1]);
                buffer.pickColors.push(pickColor[2]);
                buffer.pickColors.push(pickColor[3]);
            }
        }

        if (scene.entityOffsetsEnabled) {
            for (let i = 0; i < numVerts; i++) {
                buffer.offsets.push(0);
                buffer.offsets.push(0);
                buffer.offsets.push(0);
            }
        }

        const portionId = this.#portions.length;

        const portion = {
            vertsBase: vertsIndex,
            numVerts: numVerts
        };

        if (scene.pickSurfacePrecisionEnabled) {
            // Quantized in-memory positions are initialized in finalize()
            if (indices) {
                // @ts-ignore
                portion.indices = indices;
            }
            if (scene.entityOffsetsEnabled) {
                // @ts-ignore
                portion.offset = new Float32Array(3);
            }
        }

        this.#portions.push(portion);

        this.#numPortions++;

        this.sceneModel.numPortions++;

        this.#numVerts += portion.numVerts;

        return portionId;
    }

    finalize() {

        if (this.#finalized) {
            this.sceneModel.error("Already finalized");
            return;
        }

        const state = this.state;
        const gl = this.sceneModel.scene.canvas.gl;
        const buffer = this.#buffer;

        if (buffer.positions.length > 0) {

            const quantizedPositions = (this.#preCompressedPositionsExpected)
                ? new Uint16Array(buffer.positions)
                : math.compression.quantizePositions(buffer.positions, this.#positionsCompressionAABB, state.positionsDecompressMatrix); // BOTTLENECK

            state.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, quantizedPositions.length, 3, gl.STATIC_DRAW);

            if (this.sceneModel.scene.pickSurfacePrecisionEnabled) {
                for (let i = 0, numPortions = this.#portions.length; i < numPortions; i++) {
                    const portion = this.#portions[i];
                    const start = portion.vertsBase * 3;
                    const end = start + (portion.numVerts * 3);
                    portion.quantizedPositions = quantizedPositions.slice(start, end);
                }
            }
        }

        if (buffer.normals.length > 0) {
            const normals = new Int8Array(buffer.normals);
            let normalized = true; // For oct encoded UInts
            state.normalsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, normals, buffer.normals.length, 3, gl.STATIC_DRAW, normalized);
        }

        if (buffer.colors.length > 0) {
            const colors = new Uint8Array(buffer.colors);
            let normalized = false;
            state.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colors, buffer.colors.length, 4, gl.DYNAMIC_DRAW, normalized);
        }

        if (buffer.uv.length > 0) {
            if (!state.uvsDecompressMatrix) {
                const bounds = math.compression.getUVBounds(buffer.uv);
                const result = math.compression.compressUVs(buffer.uv, bounds.min, bounds.max);
                const uv = result.quantized;
                let notNormalized = false;
                state.uvsDecompressMatrix = math.mat3(result.decompressMatrix);
                state.uvBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, uv, uv.length, 2, gl.STATIC_DRAW, notNormalized);
            } else {
                let notNormalized = false;
                state.uvBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, buffer.uv, buffer.uv.length, 2, gl.STATIC_DRAW, notNormalized);
            }
        }

        if (buffer.metallicRoughness.length > 0) {
            const metallicRoughness = new Uint8Array(buffer.metallicRoughness);
            let normalized = false;
            state.metallicRoughnessBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, metallicRoughness, buffer.metallicRoughness.length, 2, gl.STATIC_DRAW, normalized);
        }

        if (buffer.positions.length > 0) { // Because we build flags arrays here, get their length from the positions array
            const flagsLength = (buffer.positions.length / 3) * 4;
            const flags = new Uint8Array(flagsLength);
            const flags2 = new Uint8Array(flagsLength);
            let notNormalized = false;
            let normalized = true;
            state.flagsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, flags, flags.length, 4, gl.DYNAMIC_DRAW, notNormalized);
            state.flags2Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, flags2, flags2.length, 4, gl.DYNAMIC_DRAW, normalized);
        }

        if (buffer.pickColors.length > 0) {
            const pickColors = new Uint8Array(buffer.pickColors);
            let normalized = false;
            state.pickColorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, pickColors, buffer.pickColors.length, 4, gl.STATIC_DRAW, normalized);
        }

        if (this.sceneModel.scene.entityOffsetsEnabled) {
            if (buffer.offsets.length > 0) {
                const offsets = new Float32Array(buffer.offsets);
                state.offsetsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, offsets, buffer.offsets.length, 3, gl.DYNAMIC_DRAW);
            }
        }

        if (buffer.indices.length > 0) {
            const indices = new Uint32Array(buffer.indices);
            state.indicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, indices, buffer.indices.length, 1, gl.STATIC_DRAW);
        }
        if (buffer.edgeIndices.length > 0) {
            const edgeIndices = new Uint32Array(buffer.edgeIndices);
            state.edgeIndicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, edgeIndices, buffer.edgeIndices.length, 1, gl.STATIC_DRAW);
        }

        this.state.pbrSupported
            = !!state.metallicRoughnessBuf
            && !!state.uvBuf
            && !!state.normalsBuf
            && !!state.textureSet
            && !!state.textureSet.colorTexture
            && !!state.textureSet.metallicRoughnessTexture;

        this.state.colorTextureSupported
            = !!state.uvBuf
            && !!state.textureSet
            && !!state.textureSet.colorTexture;

        this.#buffer = null;
        this.#finalized = true;
    }

    isEmpty() {
        return (!this.state.indicesBuf);
    }

    initFlags(portionId: number, flags: number, meshTransparent: boolean) {
        if (flags & ENTITY_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.EDGES) {
            this.#numEdgesLayerPortions++;
            this.sceneModel.numEdgesLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.CULLED) {
            this.#numCulledLayerPortions++;
            this.sceneModel.numCulledLayerPortions++;
        }
        if (meshTransparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        }
        const deferred = true;
        this.#setFlags(portionId, flags, meshTransparent, deferred);
        this.#setFlags2(portionId, flags, deferred);
    }

    flushInitFlags() {
        this.#setDeferredFlags();
        this.#setDeferredFlags2();
    }

    setVisible(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        } else {
            this.#numVisibleLayerPortions--;
            this.sceneModel.numVisibleLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setHighlighted(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        } else {
            this.#numHighlightedLayerPortions--;
            this.sceneModel.numHighlightedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setXRayed(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        } else {
            this.#numXRayedLayerPortions--;
            this.sceneModel.numXRayedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setSelected(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        } else {
            this.#numSelectedLayerPortions--;
            this.sceneModel.numSelectedLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setEdges(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.EDGES) {
            this.#numEdgesLayerPortions++;
            this.sceneModel.numEdgesLayerPortions++;
        } else {
            this.#numEdgesLayerPortions--;
            this.sceneModel.numEdgesLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setClippable(portionId: any, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        } else {
            this.#numClippableLayerPortions--;
            this.sceneModel.numClippableLayerPortions--;
        }
        this.#setFlags2(portionId, flags);
    }

    setCulled(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.CULLED) {
            this.#numCulledLayerPortions++;
            this.sceneModel.numCulledLayerPortions++;
        } else {
            this.#numCulledLayerPortions--;
            this.sceneModel.numCulledLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setCollidable(portionId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
    }

    setPickable(portionId: number, flags: number, transparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        } else {
            this.#numPickableLayerPortions--;
            this.sceneModel.numPickableLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setColor(portionId: number, color: math.FloatArrayType) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const portionsIdx = portionId;
        const portion = this.#portions[portionsIdx];
        const vertexBase = portion.vertsBase;
        const numVerts = portion.numVerts;
        const firstColor = vertexBase * 4;
        const lenColor = numVerts * 4;
        const tempArray = this.#scratchMemory.getUInt8Array(lenColor);
        const r = color[0];
        const g = color[1];
        const b = color[2];
        const a = color[3];
        for (let i = 0; i < lenColor; i += 4) {
            tempArray[i + 0] = r;
            tempArray[i + 1] = g;
            tempArray[i + 2] = b;
            tempArray[i + 3] = a;
        }
        if (this.state.colorsBuf) {
            this.state.colorsBuf.setData(tempArray, firstColor, lenColor);
        }
    }

    setTransparent(portionId: number, flags: number, transparent: boolean) {
        if (transparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        } else {
            this.#numTransparentLayerPortions--;
            this.sceneModel.numTransparentLayerPortions--;
        }
        this.#setFlags(portionId, flags, transparent);
    }

    setOffset(portionId: any, offset: math.FloatArrayType) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (!this.sceneModel.scene.entityOffsetsEnabled) {
            this.sceneModel.error("Entity#offset not enabled for this Viewer"); // See Viewer entityOffsetsEnabled
            return;
        }
        const portionsIdx = portionId;
        const portion = this.#portions[portionsIdx];
        const vertexBase = portion.vertsBase;
        const numVerts = portion.numVerts;
        const firstOffset = vertexBase * 3;
        const lenOffsets = numVerts * 3;
        const tempArray = this.#scratchMemory.getFloat32Array(lenOffsets);
        const x = offset[0];
        const y = offset[1];
        const z = offset[2];
        for (let i = 0; i < lenOffsets; i += 3) {
            tempArray[i + 0] = x;
            tempArray[i + 1] = y;
            tempArray[i + 2] = z;
        }
        if (this.state.offsetsBuf) {
            this.state.offsetsBuf.setData(tempArray, firstOffset, lenOffsets);
        }
        if (this.sceneModel.scene.pickSurfacePrecisionEnabled) {
            portion.offset[0] = offset[0];
            portion.offset[1] = offset[1];
            portion.offset[2] = offset[2];
        }
    }

    drawColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (frameContext.withSAO && this.sceneModel.saoEnabled) {
            if (frameContext.pbrEnabled && this.sceneModel.pbrEnabled && this.state.pbrSupported) {
                if (this.#batchingRenderers.pbrRendererWithSAO) {
                    this.#batchingRenderers.pbrRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else if (frameContext.colorTextureEnabled && this.sceneModel.colorTextureEnabled && this.state.colorTextureSupported) {
                if (this.#batchingRenderers.colorTextureRendererWithSAO) {
                    this.#batchingRenderers.colorTextureRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else if (this.state.normalsBuf) {
                if (this.#batchingRenderers.colorRendererWithSAO) {
                    this.#batchingRenderers.colorRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else {
                if (this.#batchingRenderers.flatColorRendererWithSAO) {
                    this.#batchingRenderers.flatColorRendererWithSAO.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            }
        } else {
            if (frameContext.pbrEnabled && this.sceneModel.pbrEnabled && this.state.pbrSupported) {
                if (this.#batchingRenderers.pbrRenderer) {
                    this.#batchingRenderers.pbrRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else if (frameContext.colorTextureEnabled && this.sceneModel.colorTextureEnabled && this.state.colorTextureSupported) {
                if (this.#batchingRenderers.colorTextureRenderer) {
                    this.#batchingRenderers.colorTextureRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else if (this.state.normalsBuf) {
                if (this.#batchingRenderers.colorRenderer) {
                    this.#batchingRenderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            } else {
                if (this.#batchingRenderers.flatColorRenderer) {
                    this.#batchingRenderers.flatColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
                }
            }
        }
    }

    drawColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === 0 || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (frameContext.pbrEnabled && this.sceneModel.pbrEnabled && this.state.pbrSupported) {
            if (this.#batchingRenderers.pbrRenderer) {
                this.#batchingRenderers.pbrRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        } else if (frameContext.colorTextureEnabled && this.sceneModel.colorTextureEnabled && this.state.colorTextureSupported) {
            if (this.#batchingRenderers.colorTextureRenderer) {
                this.#batchingRenderers.colorTextureRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        } else if (this.state.normalsBuf) {
            if (this.#batchingRenderers.colorRenderer) {
                this.#batchingRenderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        } else {
            if (this.#batchingRenderers.flatColorRenderer) {
                this.#batchingRenderers.flatColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
            }
        }
    }

    drawDepth(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.depthRenderer) {
            this.#batchingRenderers.depthRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        }
    }

    drawNormals(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.normalsRenderer) {
            this.#batchingRenderers.normalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        }
    }

    // ---------------------- COLOR RENDERING -----------------------------------

    drawSilhouetteXRayed(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.silhouetteRenderer) {
            this.#batchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.silhouetteRenderer) {
            this.#batchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.silhouetteRenderer) {
            this.#batchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    // ---------------------- RENDERING SAO POST EFFECT TARGETS --------------

    drawEdgesColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.edgesColorRenderer) {
            this.#batchingRenderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_OPAQUE);
        }
    }

    drawEdgesColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numEdgesLayerPortions === 0 || this.#numTransparentLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.edgesColorRenderer) {
            this.#batchingRenderers.edgesColorRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_COLOR_TRANSPARENT);
        }
    }

    // ---------------------- SILHOUETTE RENDERING -----------------------------------

    drawEdgesHighlighted(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.edgesRenderer) {
            this.#batchingRenderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_HIGHLIGHTED);
        }
    }

    drawEdgesSelected(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.edgesRenderer) {
            this.#batchingRenderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_SELECTED);
        }
    }

    drawEdgesXRayed(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.edgesRenderer) {
            this.#batchingRenderers.edgesRenderer.drawLayer(frameContext, this, RENDER_PASSES.EDGES_XRAYED);
        }
    }

    // ---------------------- EDGES RENDERING -----------------------------------

    drawOcclusion(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.occlusionRenderer) {
            this.#batchingRenderers.occlusionRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawShadow(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.shadowRenderer) {
            this.#batchingRenderers.shadowRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawPickMesh(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.pickMeshRenderer) {
            this.#batchingRenderers.pickMeshRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);
        if (this.#batchingRenderers.pickDepthRenderer) {
            this.#batchingRenderers.pickDepthRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        this.#updateBackfaceCull(drawFlags, frameContext);

        ////////////////////////////////////////////////////////////////////////////////////////////////////
        // TODO
        // if (this.state.normalsBuf) {
        //     if (this.#batchingRenderers.pickNormalsRenderer) {
        //         this.#batchingRenderers.pickNormalsRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        //     }
        ////////////////////////////////////////////////////////////////////////////////////////////////////
        // } else {
        if (this.#batchingRenderers.pickNormalsFlatRenderer) {
            this.#batchingRenderers.pickNormalsFlatRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
        // }
    }

    // ---------------------- OCCLUSION CULL RENDERING -----------------------------------

    precisionRayPickSurface(portionId: number, worldRayOrigin: math.FloatArrayType, worldRayDir: math.FloatArrayType, worldSurfacePos: { set: (arg0: any) => void; }, worldNormal: any) {

        if (!this.sceneModel.scene.pickSurfacePrecisionEnabled) {
            return false;
        }

        const state = this.state;
        const portion = this.#portions[portionId];

        if (!portion) {
            this.sceneModel.error("portion not found: " + portionId);
            return false;
        }

        const positions = portion.quantizedPositions;
        const indices = portion.indices;
        const origin = state.origin;
        const offset = portion.offset;

        const rtcRayOrigin = tempVec3a;
        const rtcRayDir = tempVec3b;

        // @ts-ignore
        rtcRayOrigin.set(origin ? math.subVec3(worldRayOrigin, origin, tempVec3c) : worldRayOrigin);  // World -> RTC

        // @ts-ignore
        rtcRayDir.set(worldRayDir);

        if (offset) {
            math.subVec3(rtcRayOrigin, offset);
        }

        math.rays.transformRay(this.sceneModel.worldNormalMatrix, rtcRayOrigin, rtcRayDir, rtcRayOrigin, rtcRayDir); // RTC -> local

        const a = tempVec3d;
        const b = tempVec3e;
        const c = tempVec3f;

        let gotIntersect = false;
        let closestDist = 0;
        const closestIntersectPos = tempVec3g;

        for (let i = 0, len = indices.length; i < len; i += 3) {

            const ia = indices[i] * 3;
            const ib = indices[i + 1] * 3;
            const ic = indices[i + 2] * 3;

            a[0] = positions[ia];
            a[1] = positions[ia + 1];
            a[2] = positions[ia + 2];

            b[0] = positions[ib];
            b[1] = positions[ib + 1];
            b[2] = positions[ib + 2];

            c[0] = positions[ic];
            c[1] = positions[ic + 1];
            c[2] = positions[ic + 2];

            math.compression.decompressPosition(a, state.positionsDecompressMatrix);
            math.compression.decompressPosition(b, state.positionsDecompressMatrix);
            math.compression.decompressPosition(c, state.positionsDecompressMatrix);

            if (math.rays.rayTriangleIntersect(rtcRayOrigin, rtcRayDir, a, b, c, closestIntersectPos)) {

                math.transformPoint3(this.sceneModel.worldMatrix, closestIntersectPos, closestIntersectPos);

                if (offset) {
                    math.addVec3(closestIntersectPos, offset);
                }

                if (origin) {
                    math.addVec3(closestIntersectPos, origin);
                }

                const dist = Math.abs(math.lenVec3(math.subVec3(closestIntersectPos, worldRayOrigin, [])));

                if (!gotIntersect || dist > closestDist) {
                    closestDist = dist;
                    worldSurfacePos.set(closestIntersectPos);
                    if (worldNormal) { // Not that wasteful to eagerly compute - unlikely to hit >2 surfaces on most geometry
                        math.triangleNormal(a, b, c, worldNormal);
                    }
                    gotIntersect = true;
                }
            }
        }

        if (gotIntersect && worldNormal) {
            math.transformVec3(this.sceneModel.worldNormalMatrix, worldNormal, worldNormal);
            math.normalizeVec3(worldNormal);
        }

        return gotIntersect;
    }

    // ---------------------- SHADOW BUFFER RENDERING -----------------------------------

    destroy() {
        const state = this.state;
        if (state.positionsBuf) {
            state.positionsBuf.destroy();
            state.positionsBuf = null;
        }
        if (state.offsetsBuf) {
            state.offsetsBuf.destroy();
            state.offsetsBuf = null;
        }
        if (state.normalsBuf) {
            state.normalsBuf.destroy();
            state.normalsBuf = null;
        }
        if (state.colorsBuf) {
            state.colorsBuf.destroy();
            state.colorsBuf = null;
        }
        if (state.metallicRoughnessBuf) {
            state.metallicRoughnessBuf.destroy();
            state.metallicRoughnessBuf = null;
        }
        if (state.flagsBuf) {
            state.flagsBuf.destroy();
            state.flagsBuf = null;
        }
        if (state.flags2Buf) {
            state.flags2Buf.destroy();
            state.flags2Buf = null;
        }
        if (state.pickColorsBuf) {
            state.pickColorsBuf.destroy();
            state.pickColorsBuf = null;
        }
        if (state.indicesBuf) {
            state.indicesBuf.destroy();
            state.indicessBuf = null;
        }
        if (state.edgeIndicesBuf) {
            state.edgeIndicesBuf.destroy();
            state.edgeIndicessBuf = null;
        }
        state.destroy();
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    #setFlags(portionId: number, flags: number, transparent: boolean, deferred: boolean = false) {

        if (!this.#finalized) {
            throw "Not finalized";
        }

        const portionsIdx = portionId;
        const portion = this.#portions[portionsIdx];
        const vertexBase = portion.vertsBase;
        const numVerts = portion.numVerts;
        const firstFlag = vertexBase * 4;
        const lenFlags = numVerts * 4;

        const visible = !!(flags & ENTITY_FLAGS.VISIBLE);
        const xrayed = !!(flags & ENTITY_FLAGS.XRAYED);
        const highlighted = !!(flags & ENTITY_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & ENTITY_FLAGS.SELECTED);
        const edges = !!(flags & ENTITY_FLAGS.EDGES);
        const pickable = !!(flags & ENTITY_FLAGS.PICKABLE);
        const culled = !!(flags & ENTITY_FLAGS.CULLED);

        // Color

        let f0;
        if (!visible || culled || xrayed
            || (highlighted && !this.sceneModel.scene.highlightMaterial.glowThrough)
            || (selected && !this.sceneModel.scene.selectedMaterial.glowThrough)) {
            f0 = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (transparent) {
                f0 = RENDER_PASSES.COLOR_TRANSPARENT;
            } else {
                f0 = RENDER_PASSES.COLOR_OPAQUE;
            }
        }

        // Silhouette

        let f1;
        if (!visible || culled) {
            f1 = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            f1 = RENDER_PASSES.SILHOUETTE_SELECTED;
        } else if (highlighted) {
            f1 = RENDER_PASSES.SILHOUETTE_HIGHLIGHTED;
        } else if (xrayed) {
            f1 = RENDER_PASSES.SILHOUETTE_XRAYED;
        } else {
            f1 = RENDER_PASSES.NOT_RENDERED;
        }

        // Edges

        let f2 = 0;
        if (!visible || culled) {
            f2 = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            f2 = RENDER_PASSES.EDGES_SELECTED;
        } else if (highlighted) {
            f2 = RENDER_PASSES.EDGES_HIGHLIGHTED;
        } else if (xrayed) {
            f2 = RENDER_PASSES.EDGES_XRAYED;
        } else if (edges) {
            if (transparent) {
                f2 = RENDER_PASSES.EDGES_COLOR_TRANSPARENT;
            } else {
                f2 = RENDER_PASSES.EDGES_COLOR_OPAQUE;
            }
        } else {
            f2 = RENDER_PASSES.NOT_RENDERED;
        }

        // Pick

        let f3 = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;

        if (deferred) {
            // Avoid zillions of individual WebGL bufferSubData calls - buffer them to apply in one shot
            if (!this.#deferredFlagValues) {
                this.#deferredFlagValues = new Uint8Array(this.#numVerts * 4);
            }
            for (let i = firstFlag, len = (firstFlag + lenFlags); i < len; i += 4) {
                this.#deferredFlagValues[i + 0] = f0;
                this.#deferredFlagValues[i + 1] = f1;
                this.#deferredFlagValues[i + 2] = f2;
                this.#deferredFlagValues[i + 3] = f3;
            }
        } else if (this.state.flagsBuf) {
            const tempArray = this.#scratchMemory.getUInt8Array(lenFlags);
            for (let i = 0; i < lenFlags; i += 4) {
                tempArray[i + 0] = f0; // x - normal fill
                tempArray[i + 1] = f1; // y - emphasis fill
                tempArray[i + 2] = f2; // z - edges
                tempArray[i + 3] = f3; // w - pick
            }
            this.state.flagsBuf.setData(tempArray, firstFlag, lenFlags);
        }
    }

    #setDeferredFlags() {
        if (this.#deferredFlagValues) {
            this.state.flagsBuf.setData(this.#deferredFlagValues);
            this.#deferredFlagValues = null;
        }
    }

    #setFlags2(portionId: number, flags: number, deferred: boolean = false) {

        if (!this.#finalized) {
            throw "Not finalized";
        }

        const portionsIdx = portionId;
        const portion = this.#portions[portionsIdx];
        const vertexBase = portion.vertsBase;
        const numVerts = portion.numVerts;
        const firstFlag = vertexBase * 4;
        const lenFlags = numVerts * 4;
        const clippable = !!(flags & ENTITY_FLAGS.CLIPPABLE) ? 255 : 0;

        if (deferred) {
            if (!this.#setDeferredFlag2Values) {
                this.#setDeferredFlag2Values = new Uint8Array(this.#numVerts * 4);
            }
            for (let i = firstFlag, len = (firstFlag + lenFlags); i < len; i += 4) {
                this.#setDeferredFlag2Values[i] = clippable;
            }
        } else if (this.state.flags2Buf) {
            const tempArray = this.#scratchMemory.getUInt8Array(lenFlags);
            for (let i = 0; i < lenFlags; i += 4) {
                tempArray[i + 0] = clippable;
            }
            this.state.flags2Buf.setData(tempArray, firstFlag, lenFlags);
        }
    }

    //------------------------------------------------------------------------------------------------

    #setDeferredFlags2() {
        if (this.#setDeferredFlag2Values) {
            this.state.flags2Buf.setData(this.#setDeferredFlag2Values);
            this.#setDeferredFlag2Values = null;
        }
    }

    // ---------

    #updateBackfaceCull(drawFlags: DrawFlags, frameContext: FrameContext): void {
        const backfaces = this.sceneModel.backfaces || (!this.solid) || drawFlags.sectioned;
        if (frameContext.backfaces !== backfaces) {
            const gl = frameContext.gl;
            if (backfaces) {
                gl.disable(gl.CULL_FACE);
            } else {
                gl.enable(gl.CULL_FACE);
            }
            frameContext.backfaces = backfaces;
        }
    }
}

export {TrianglesBatchingLayer};