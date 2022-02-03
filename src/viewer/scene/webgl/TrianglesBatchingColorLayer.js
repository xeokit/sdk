/**
 *
 * @interface
 */
import * as math from "../../math";
import {geometryCompressionUtils} from "../../math/geometryCompressionUtils";

const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempVec4c = math.vec4([0, 0, 0, 1]);
const tempOBB3 = math.OBB3();

const tempVec3a = math.vec3();
const tempVec3b = math.vec3();
const tempVec3c = math.vec3();
const tempVec3d = math.vec3();
const tempVec3e = math.vec3();
const tempVec3f = math.vec3();
const tempVec3g = math.vec3();

class TrianglesBatchingColorLayer {

    constructor(model, cfg) {

        this.sortId = "TrianglesBatchingLayer" + (cfg.solid ? "-solid" : "-surface") + (cfg.autoNormals ? "-autonormals" : "-normals");
        this.layerIndex = cfg.layerIndex;
        this.model = model;
        this._buffer = new TrianglesBatchingBuffer(cfg.maxGeometryBatchSize);
        this._scratchMemory = cfg.scratchMemory;




        this._state = {
            positionsBuf: null,
            offsetsBuf: null,
            normalsBuf: null,
            colorsBuf: null,
            metallicRoughnessBuf: null,
            flagsBuf: null,
            flags2Buf: null,
            indicesBuf: null,
            edgeIndicesBuf: null,
            positionsDecodeMatrix: math.mat4()
        };

        this._numPortions = 0;
        this._numVisibleLayerPortions = 0;
        this._numTransparentLayerPortions = 0;
        this._numXRayedLayerPortions = 0;
        this._numSelectedLayerPortions = 0;
        this._numHighlightedLayerPortions = 0;
        this._numClippableLayerPortions = 0;
        this._numEdgesLayerPortions = 0;
        this._numPickableLayerPortions = 0;
        this._numCulledLayerPortions = 0;

        this._modelAABB = math.collapseAABB3(); // Model-space AABB
        this._portions = [];

        this._finalized = false;

        this._state.positionsDecodeMatrix.set(cfg.positionsDecodeMatrix);

        if (cfg.rtcCenter) {
            this._state.rtcCenter = math.vec3(cfg.rtcCenter);
        }

        this.aabb = math.collapseAABB3();
        this.solid = !!cfg.solid;
    }

    createPortion(cfg) {

        if (this._finalized) {
            throw "Already finalized";
        }

        const positions = cfg.positions;
        const normals = cfg.normals;
        const indices = cfg.indices;
        const edgeIndices = cfg.edgeIndices;
        const color = cfg.color;
        const metallic = cfg.metallic;
        const roughness = cfg.roughness;
        const colors = cfg.colors;
        const opacity = cfg.opacity;
        const meshMatrix = cfg.meshMatrix;
        const worldMatrix = cfg.worldMatrix;
        const portionAABB = cfg.portionAABB;
        const pickColor = cfg.pickColor;

        const buffer = this._buffer;
        const positionsIndex = buffer.positions.length;
        const vertsIndex = positionsIndex / 3;
        const numVerts = positions.length / 3;
        const lenPositions = positions.length;

        for (let i = 0, len = positions.length; i < len; i++) {
            buffer.positions.push(positions[i]);
        }

        const min = tempVec3a;
        const max = tempVec3b;

        geometryCompressionUtils.getPositionsBounds(positions, min, max);
        geometryCompressionUtils.decompressPosition(min, this._state.positionsDecodeMatrix, min);
        geometryCompressionUtils.decompressPosition(max, this._state.positionsDecodeMatrix, max);

        portionAABB[0] = min[0];
        portionAABB[1] = min[1];
        portionAABB[2] = min[2];
        portionAABB[3] = max[0];
        portionAABB[4] = max[1];
        portionAABB[5] = max[2];

        if (worldMatrix) {
            math.AABB3ToOBB3(portionAABB, tempOBB3);
            math.transformOBB3(worldMatrix, tempOBB3);
            math.OBB3ToAABB3(tempOBB3, portionAABB);
        }

        if (this._state.rtcCenter) {
            const rtcCenter = this._state.rtcCenter;
            portionAABB[0] += rtcCenter[0];
            portionAABB[1] += rtcCenter[1];
            portionAABB[2] += rtcCenter[2];
            portionAABB[3] += rtcCenter[0];
            portionAABB[4] += rtcCenter[1];
            portionAABB[5] += rtcCenter[2];
        }

        math.expandAABB3(this.aabb, portionAABB);

        if (normals && normals.length > 0) {
            for (let i = 0, len = normals.length; i < len; i++) {
                buffer.normals.push(normals[i]);
            }
        }

        if (colors) {
            for (let i = 0, len = colors.length; i < len; i += 3) {
                buffer.colors.push(colors[i] * 255);
                buffer.colors.push(colors[i + 1] * 255);
                buffer.colors.push(colors[i + 2] * 255);
                buffer.colors.push(255);
            }
        } else if (color) {
            const r = color[0]; // Color is pre-quantized by PerformanceModel
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

        const portionId = this._portions.length;

        const portion = {
            vertsBase: vertsIndex,
            numVerts: numVerts
        };

        // Quantized in-memory positions are initialized in finalize()
        if (indices) {
            portion.indices = indices;
        }

        this._portions.push(portion);

        this._numPortions++;
        this.model.numPortions++;

        return portionId;
    }

    setVisible(portionId, viewIndex, flags) {
    }

    setHighlighted(portionId, flags) {
    }

    setXRayed(portionId, flags) {
    }

    setSelected(portionId, flags) {
    }

    setEdges(portionId, flags) {
    }

    setClippable(portionId, flags) {
    }

    setCollidable(portionId, flags) {
    }

    setPickable(portionId, flags) {
    }

    setCulled(portionId, flags) {
    }

    setColor(portionId, color) { // RGBA color is normalized as ints
    }

    setTransparent(portionId, flags) {
    }

    finalize() {

        if (this._finalized) {
            this.model.error("Already finalized");
            return;
        }

        const state = this._state;
        const gl = this.model.scene.canvas.gl;
        const buffer = this._buffer;

        if (buffer.positions.length > 0) {
            const positions = new Uint16Array(buffer.positions);
            state.positionsBuf = device.createBuffer({
                size: positions.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });
            new Uint16Array(state.positionsBuf.getMappedRange()).set(positions);
            state.positionsBuf.unmap();
        }

        if (buffer.normals.length > 0) {
            const normals = new Int8Array(buffer.normals);
            state.normalsBuf = device.createBuffer({
                size: normals.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });
            new Uint8Array(state.positionsBuf.getMappedRange()).set(positions);
            state.positionsBuf.unmap();
        }

        if (buffer.colors.length > 0) {
            const colors = new Uint8Array(buffer.colors);
            let normalized = false;
            state.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colors, buffer.colors.length, 4, gl.DYNAMIC_DRAW, normalized);
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

        if (this.model.scene.entityOffsetsEnabled) {
            if (buffer.offsets.length > 0) {
                const offsets = new Float32Array(buffer.offsets);
                state.offsetsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, offsets, buffer.offsets.length, 3, gl.DYNAMIC_DRAW);
            }
        }

        const bigIndicesSupported = WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"];

        if (buffer.indices.length > 0) {
            const indices = bigIndicesSupported ? new Uint32Array(buffer.indices) : new Uint16Array(buffer.indices);
            state.indicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, indices, buffer.indices.length, 1, gl.STATIC_DRAW);
        }
        if (buffer.edgeIndices.length > 0) {
            const edgeIndices = bigIndicesSupported ? new Uint32Array(buffer.edgeIndices) : new Uint16Array(buffer.edgeIndices);
            state.edgeIndicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, edgeIndices, buffer.edgeIndices.length, 1, gl.STATIC_DRAW);
        }
        this._buffer = null;
        this._finalized = true;
    }
}

export {TrianglesBatchingColorLayer};