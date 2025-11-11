import {RenderContext} from "../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {TrianglesDrawColorTechnique} from "./techniques/triangles/TrianglesDrawColorTechnique";
import {GenericDrawSilhouetteTechnique} from "./techniques/generic/GenericDrawSilhouetteTechnique";
import {PointsDrawColorTechnique} from "./techniques/points/PointsDrawColorTechnique";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {LinesDrawColorTechnique} from "./techniques/lines/LinesDrawColorTechnique";
import {RenderPassDrawOps} from "./RenderPassDrawOps";
import {DrawOp} from "./DrawOp";
import {RENDER_PASSES} from "../RENDER_PASSES";
import {TrianglesDrawEdgeSilhouetteTechnique} from "./techniques/triangles/TrianglesDrawEdgeSilhouetteTechnique";
import {DrawTechnique} from "./DrawTechnique";
import {GenericPickMeshTechnique} from "./techniques/generic/GenericPickMeshTechnique";
import {GenericPickDepthTechnique} from "./techniques/generic/GenericPickDepthTechnique";
import {TrianglesDrawEdgeColorTechnique} from "./techniques/triangles/TrianglesDrawEdgeColorTechnique";
import {SDKResult} from "../../../core";

/**
 * Manages a set of draw operations for different primitive types.
 */
export class DrawOps {

     _useCount: number = 0;
     _renderContext: RenderContext;
    private _gpuMemoryReader: GPUMemoryReader;
    private _techniques: DrawTechnique[];

    /**
     * Draw operations organized by primitive type and rendering technique.
     *
     */
    prims: {
        [TrianglesPrimitive]?: RenderPassDrawOps;
        [LinesPrimitive]?: RenderPassDrawOps;
        [PointsPrimitive]?: RenderPassDrawOps;
    };


    /**
     * Initializes the DrawOps with the given rendering context and GPU memory.
     * @param renderContext - The rendering context used for WebGL operations.
     * @param gpuMemoryReader - Reads GPU memory - provides data textures.
     */
    constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader) {
        this._renderContext = renderContext;
        this._gpuMemoryReader = gpuMemoryReader;
    }

    /**
     * Initializes the draw operations and techniques.
     */
    init(): SDKResult<null, string> {

        const renderContext = this._renderContext;
        const gpuMemoryReader = this._gpuMemoryReader;

        this._techniques = [];
        this.prims = {};

        const saveForCleanup = (drawTechnique: DrawTechnique): DrawTechnique => {
            this._techniques.push(drawTechnique);
            return drawTechnique;
        }

        // Some draw techniques are shared between multiple draw ops.
        // A draw op applies a draw technique to a specific render pass.
        // E.g. the silhouetteTechnique draw technique is used for highlighted, selected and xrayed triangles.

        const silhouette = saveForCleanup(new GenericDrawSilhouetteTechnique(renderContext, gpuMemoryReader));
        const trianglesDrawColor = saveForCleanup(new TrianglesDrawColorTechnique(renderContext, gpuMemoryReader));
        const trianglesDrawEdgeSilhouette = saveForCleanup(new TrianglesDrawEdgeSilhouetteTechnique(renderContext, gpuMemoryReader));
        const trianglesDrawEdgeColor = saveForCleanup(new TrianglesDrawEdgeColorTechnique(renderContext, gpuMemoryReader));
        const pickMesh = saveForCleanup(new GenericPickMeshTechnique(renderContext, gpuMemoryReader));
        const pickDepth = saveForCleanup(new GenericPickDepthTechnique(renderContext, gpuMemoryReader));
        const linesDrawColor = saveForCleanup(new LinesDrawColorTechnique(renderContext, gpuMemoryReader));
        const pointsDrawColor = saveForCleanup(new PointsDrawColorTechnique(renderContext, gpuMemoryReader));

        for (let i = 0, len = this._techniques.length; i < len; i++) {
            const result = this._techniques[i].init();
            if (!result.ok) {
               for (let j = i-1; j >= 0; j--) {
                   this._techniques[j].destroy();
               }
               return result;
            }
        }

        const {OPAQUE, TRANSPARENT, HIGHLIGHTED, SELECTED, XRAYED, PICK} = RENDER_PASSES;

        this.prims = {

            [TrianglesPrimitive]: {
                opaque: new DrawOp(trianglesDrawColor, OPAQUE),
                opaqueEdges: new DrawOp(trianglesDrawEdgeColor, OPAQUE),
                transparent: new DrawOp(trianglesDrawColor, TRANSPARENT),
                transparentEdges: new DrawOp(trianglesDrawEdgeColor, TRANSPARENT),
                highlighted: new DrawOp(silhouette, HIGHLIGHTED),
                highlightedEdges: new DrawOp(trianglesDrawEdgeSilhouette, HIGHLIGHTED),
                selected: new DrawOp(silhouette, SELECTED),
                selectedEdges: new DrawOp(trianglesDrawEdgeSilhouette, SELECTED),
                xrayed: new DrawOp(silhouette, XRAYED),
                xrayedEdges: new DrawOp(trianglesDrawEdgeSilhouette, XRAYED),
                pick: new DrawOp(pickMesh, PICK),
                pickDepth: new DrawOp(pickDepth, PICK)
            },

            [LinesPrimitive]: {
                opaque: new DrawOp(linesDrawColor, OPAQUE),
                transparent: new DrawOp(linesDrawColor, TRANSPARENT),
                highlighted: new DrawOp(silhouette, HIGHLIGHTED),
                selected: new DrawOp(silhouette, SELECTED),
                xrayed: new DrawOp(silhouette, XRAYED),
                pick: new DrawOp(pickMesh, PICK),
                pickDepth: new DrawOp(pickDepth, PICK)
            },

            [PointsPrimitive]: {
                opaque: new DrawOp(pointsDrawColor, OPAQUE),
                transparent: new DrawOp(pointsDrawColor, TRANSPARENT),
                // highlighted: new DrawOp(pointsSilhouette, HIGHLIGHTED),
                // selected: new DrawOp(pointsSilhouette, SELECTED),
                // xrayed: new DrawOp(pointsSilhouette, XRAYED),
                pick: new DrawOp(pickMesh, PICK),
                pickDepth: new DrawOp(pickDepth, PICK)
            }
        };
    }

    _destroy() {
        // @ts-ignore
        Object.values(this._techniques).forEach(drawTechnique => drawTechnique.destroy());
    }
}

const drawOpsInstances = {};

/**
 * Gets or creates a DrawOps for the given RenderContext.
 * @param renderContext
 * @param gpuMemoryReader
 */
export function getDrawOps(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader): SDKResult<DrawOps, string> {
    const viewerId = renderContext.viewer.id;
    let drawOps = drawOpsInstances[viewerId];
    if (!drawOps) {
        drawOps = new DrawOps(renderContext, gpuMemoryReader);
        const result = drawOps.init();
        if (!result.ok) {
            return result;
        }
        drawOpsInstances[viewerId] = drawOps;
    }
    drawOps._useCount++;
    return {
        ok: true,
        value: drawOps
    };
}

/**
 * Releases a DrawOps, destroying it if no longer in use.
 * @param drawOps
 */
export function putDrawOps(drawOps: DrawOps) {
    if (drawOps._useCount === 0) {
        throw new Error("DrawOps use count is already zero");
    }
    drawOps._useCount--;
    if (drawOps._useCount === 0) {
        const viewerId = drawOps._renderContext.viewer.id;
        delete drawOpsInstances[viewerId];
        drawOps._destroy();
    }
}