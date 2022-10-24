import {ENTITY_FLAGS} from '../../../ENTITY_FLAGS';
import {RENDER_PASSES} from '../../../RENDER_PASSES';
import * as math from "../../../../../../viewer/math/index"
import {BatchingBuffer} from "../BatchingBuffer";
import {WebGLSceneModel} from "../../../../WebGLSceneModel";
import {getBatchingRenderers} from "./LinesBatchingRenderers";
import {RenderState} from "../../../../../../viewer/utils/RenderState";
import {FrameContext} from "../../../../../WebGLRenderer/FrameContext";
import {DrawFlags} from "../../../../../WebGLRenderer/DrawFlags";
import {ArrayBuf} from "../../../../../lib/ArrayBuf";

const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempVec4c = math.vec4([0, 0, 0, 1]);
const tempOBB3 = math.boundaries.OBB3();

/**
 * @private
 */
export class LinesBatchingLayer {
    layerIndex: number;
    sceneModel: WebGLSceneModel;
    state: any;
    aabb: math.FloatArrayType;
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
    #modelAABB: math.FloatArrayType;
    #portions: number[];
    #numVerts: number;
    #finalized: boolean;
    #preCompressedPositionsExpected: boolean;
    #setDeferredFlag2Values: any;
    #deferredFlagValues: any;

    constructor(params: {
        layerIndex: number;
        sceneModel: WebGLSceneModel;
        maxGeometryBatchSize: number;
        scratchMemory: any;
        positionsDecompressMatrix: any;
        origin: any;
    }) {

        this.layerIndex = params.layerIndex;
        this.sceneModel = params.sceneModel;

        this.#buffer = new BatchingBuffer(params.maxGeometryBatchSize);
        this.#scratchMemory = params.scratchMemory;

        this.#batchingRenderers = getBatchingRenderers(params.sceneModel.view);

        this.state = new RenderState({
            positionsBuf: null,
            offsetsBuf: null,
            colorsBuf: null,
            flagsBuf: null,
            flags2Buf: null,
            indicesBuf: null,
            positionsDecompressMatrix: math.mat4(),
            origin: null
        });

        // These counts are used to avoid unnecessary render passes
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

        this.#modelAABB = math.boundaries.collapseAABB3();
        this.#portions = [];
        this.#numVerts = 0;
        this.#finalized = false;

        if (params.positionsDecompressMatrix) {
            this.state.positionsDecompressMatrix.set(params.positionsDecompressMatrix);
            this.#preCompressedPositionsExpected = true;
        } else {
            this.#preCompressedPositionsExpected = false;
        }

        if (params.origin) {
            this.state.origin = math.vec3(params.origin);
        }

        this.aabb = math.boundaries.collapseAABB3();
    }

    canCreatePortion(lenPositions: number, lenIndices: number): boolean {
        if (this.#finalized) {
            throw "Already finalized";
        }
        return ((this.#buffer.positions.length + lenPositions) < (this.#buffer.maxVerts * 3) && (this.#buffer.indices.length + lenIndices) < (this.#buffer.maxIndices));
    }

    createPortion(params: {
        positions: math.FloatArrayType;
        positionsCompressed: math.FloatArrayType;
        indices: math.FloatArrayType;
        color: math.FloatArrayType;
        opacity: number;
        meshMatrix: math.FloatArrayType;
        worldMatrix: math.FloatArrayType;
        worldAABB: math.FloatArrayType;
        pickColor: math.FloatArrayType;
    }): number {
        if (this.#finalized) {
            throw "Already finalized";
        }
        const positions = params.positions;
        const positionsCompressed = params.positionsCompressed;
        const indices = params.indices;
        const color = params.color;
        const opacity = params.opacity;
        const meshMatrix = params.meshMatrix;
        const worldMatrix = params.worldMatrix;
        const worldAABB = params.worldAABB;
        const pickColor = params.pickColor;
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
                    math.boundaries.expandAABB3Point3(this.#modelAABB, tempVec4b);
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
                    math.boundaries.expandAABB3Point3(this.#modelAABB, tempVec4a);
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

        if (color) {
            const r = color[0]; // Color is pre-quantized by VBOSceneModel
            const g = color[1];
            const b = color[2];
            const a = opacity;
            for (let i = 0; i < numVerts; i++) {
                buffer.colors.push(r);
                buffer.colors.push(g);
                buffer.colors.push(b);
                buffer.colors.push(a);
            }
        }

        if (indices) {
            for (let i = 0, len = indices.length; i < len; i++) {
                buffer.indices.push(indices[i] + vertsIndex);
            }
        }

        for (let i = 0; i < numVerts; i++) {
            buffer.offsets.push(0);
            buffer.offsets.push(0);
            buffer.offsets.push(0);
        }

        const portionId = this.#portions.length / 2;
        this.#portions.push(vertsIndex);
        this.#portions.push(numVerts);
        this.#numPortions++;
        this.#numVerts += numVerts;

        return portionId;
    }

    finalize() {

        if (this.#finalized) {
            this.sceneModel.error("Already finalized");
            return;
        }

        const state = this.state;
        // @ts-ignore
        const gl = this.sceneModel.viewer.renderer.gl;
        const buffer = this.#buffer;
        if (buffer.positions.length > 0) {
            if (this.#preCompressedPositionsExpected) {
                const positions = new Uint16Array(buffer.positions);
                state.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, positions, buffer.positions.length, 3, gl.STATIC_DRAW);
            } else {
                const positions = new Float32Array(buffer.positions);
                const quantizedPositions = math.compression.quantizePositions(positions, this.#modelAABB, state.positionsDecompressMatrix);
                state.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, buffer.positions.length, 3, gl.STATIC_DRAW);
            }
        }
        if (buffer.colors.length > 0) {
            const colors = new Uint8Array(buffer.colors);
            let normalized = false;
            state.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colors, buffer.colors.length, 4, gl.DYNAMIC_DRAW, normalized);
        }
        if (buffer.colors.length > 0) { // Because we build flags arrays here, get their length from the colors array
            const flagsLength = buffer.colors.length;
            const flags = new Uint8Array(flagsLength);
            const flags2 = new Uint8Array(flagsLength);
            let notNormalized = false;
            let normalized = true;
            state.flagsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, flags, flags.length, 4, gl.DYNAMIC_DRAW, notNormalized);
            state.flags2Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, flags2, flags2.length, 4, gl.DYNAMIC_DRAW, normalized);
        }
        if (buffer.offsets.length > 0) {
            const offsets = new Float32Array(buffer.offsets);
            state.offsetsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, offsets, buffer.offsets.length, 3, gl.DYNAMIC_DRAW);
        }
        if (buffer.indices.length > 0) {
            const indices = new Uint32Array(buffer.indices);
            state.indicesBuf = new ArrayBuf(gl, gl.ELEMENT_ARRAY_BUFFER, indices, buffer.indices.length, 1, gl.STATIC_DRAW);
        }
        this.#buffer = null;
        this.#finalized = true;
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

    setClippable(portionId: number, flags: number) {
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
        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
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
        this.state.colorsBuf.setData(tempArray, firstColor, lenColor);
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

    setOffset(portionId: number, offset: math.FloatArrayType) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
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
        this.state.offsetsBuf.setData(tempArray, firstOffset, lenOffsets);
    }

    drawColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        if (this.#batchingRenderers.colorRenderer) {
            this.#batchingRenderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === 0 || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        if (this.#batchingRenderers.colorRenderer) {
            this.#batchingRenderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
        }
    }

    drawDepth(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawNormals(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    //-- RENDERING ----------------------------------------------------------------------------------------------

    drawSilhouetteXRayed(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.silhouetteRenderer) {
            this.#batchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.silhouetteRenderer) {
            this.#batchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        if (this.#batchingRenderers.silhouetteRenderer) {
            this.#batchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesHighlighted(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesSelected(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesXRayed(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawPickMesh(frameContext: FrameContext) {
    }

    drawPickDepths(frameContext: FrameContext) {
    }

    drawPickNormals(frameContext: FrameContext) {
    }

    drawOcclusion(frameContext: FrameContext) {
    }

    drawShadow(frameContext: FrameContext) {
    }

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
        if (state.colorsBuf) {
            state.colorsBuf.destroy();
            state.colorsBuf = null;
        }
        if (state.flagsBuf) {
            state.flagsBuf.destroy();
            state.flagsBuf = null;
        }
        if (state.flags2Buf) {
            state.flags2Buf.destroy();
            state.flags2Buf = null;
        }
        if (state.indicesBuf) {
            state.indicesBuf.destroy();
            state.indicessBuf = null;
        }
        state.destroy();
    }

    #setFlags(portionId: number, flags: number, transparent: boolean, deferred: boolean = false) {

        if (!this.#finalized) {
            throw "Not finalized";
        }

        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
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
        if (!visible || culled || xrayed || highlighted || selected) {
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

        // Pick

        let f3 = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
        if (deferred) {
            if (!this.#deferredFlagValues) {
                this.#deferredFlagValues = new Uint8Array(this.#numVerts * 4);
            }
            for (let i = firstFlag, len = (firstFlag + lenFlags); i < len; i += 4) {
                this.#deferredFlagValues[i + 0] = f0;
                this.#deferredFlagValues[i + 1] = f1;
                this.#deferredFlagValues[i + 2] = 0;
                this.#deferredFlagValues[i + 3] = f3;
            }
        } else if (this.state.flagsBuf) {
            const tempArray = this.#scratchMemory.getUInt8Array(lenFlags);
            for (let i = 0; i < lenFlags; i += 4) {
                tempArray[i + 0] = f0; // x - color
                tempArray[i + 1] = f1; // y - silhouette - select/highlight/xray
                tempArray[i + 2] = 0; // z - edges
                tempArray[i + 3] = f3; // w - pickable
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

    #setFlags2(portionId: number, flags: number, deferred = false) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
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
        } else {
            const tempArray = this.#scratchMemory.getUInt8Array(lenFlags);
            for (let i = 0; i < lenFlags; i += 4) {
                tempArray[i + 0] = clippable;
            }
            this.state.flags2Buf.setData(tempArray, firstFlag, lenFlags);
        }
    }

    #setDeferredFlags2() {
        if (this.#setDeferredFlag2Values) {
            this.state.flags2Buf.setData(this.#setDeferredFlag2Values);
            this.#setDeferredFlag2Values = null;
        }
    }
}
