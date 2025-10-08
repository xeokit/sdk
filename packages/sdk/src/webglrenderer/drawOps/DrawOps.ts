import {RenderContext} from "../RenderContext";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import {TrianglesColorDrawTechnique} from "./triangles/TrianglesColorDrawTechnique";
import {GenericSilhouetteDrawTechnique} from "./generic/GenericSilhouetteDrawTechnique";
import {PointsSilhouetteDrawTechnique} from "./points/PointsSilhouetteDrawTechnique";
import {PointsColorDrawTechnique} from "./points/PointsColorDrawTechnique";
import {type DTXMemoryReader} from "../dtxMemory/DTXMemoryReader";
import {LinesColorDrawTechnique} from "./lines/LinesColorDrawTechnique";
import {RenderPassDrawOps} from "./RenderPassDrawOps";
import {DrawOp} from "./DrawOp";
import {RENDER_PASSES} from "./RENDER_PASSES";
import {TrianglesDepthDrawTechnique} from "./triangles/TrianglesDepthDrawTechnique";
import {TrianglesEdgeSilhouetteDrawTechnique} from "./triangles/TrianglesEdgeSilhouetteDrawTechnique";
import {TrianglesPickMeshDrawTechnique} from "./triangles/TrianglesPickMeshDrawTechnique";
import {DrawTechnique} from "./DrawTechnique";

/**
 * Manages a set of draw operations for different primitive types.
 */
export class DrawOps {

    _useCount: number = 0;
    _renderContext: RenderContext;

    private _drawTechniques: DrawTechnique[];

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
     * @param dtxMemoryReader - Reads GPU memory - provides data textures.
     */
    constructor(renderContext: RenderContext, dtxMemoryReader: DTXMemoryReader) {

        this._renderContext = renderContext;
        this._drawTechniques = [];

        const saveForCleanup = (drawTechnique: DrawTechnique): DrawTechnique => {
            this._drawTechniques.push(drawTechnique);
            return drawTechnique;
        }

        // Some draw techniques are shared between multiple draw ops.
        // A draw op applies a draw technique to a specific render pass.
        // E.g. the silhouette draw technique is used for highlighted, selected and xrayed triangles.

        const silhouette = saveForCleanup(new GenericSilhouetteDrawTechnique(renderContext, dtxMemoryReader));

        const trianglesColor = saveForCleanup(new TrianglesColorDrawTechnique(renderContext, dtxMemoryReader));
        const trianglesEdgeSilhouette = saveForCleanup(new TrianglesEdgeSilhouetteDrawTechnique(renderContext, dtxMemoryReader));
        const trianglesDepth = saveForCleanup(new TrianglesDepthDrawTechnique(renderContext, dtxMemoryReader));
        const trianglesPick = saveForCleanup(new TrianglesPickMeshDrawTechnique(renderContext, dtxMemoryReader));

        const linesColor = saveForCleanup(new LinesColorDrawTechnique(renderContext, dtxMemoryReader));
        const pointsColor = saveForCleanup(new PointsColorDrawTechnique(renderContext, dtxMemoryReader));

        this.prims = {

            [TrianglesPrimitive]: {
                opaque: new DrawOp(trianglesColor, RENDER_PASSES.OPAQUE),
                opaqueEdges: null,
                transparent: new DrawOp(trianglesColor, RENDER_PASSES.TRANSPARENT),
                transparentEdges: null,
                highlighted: new DrawOp(silhouette, RENDER_PASSES.HIGHLIGHTED),
                highlightedEdges: new DrawOp(trianglesEdgeSilhouette, RENDER_PASSES.HIGHLIGHTED),
                selected: new DrawOp(silhouette, RENDER_PASSES.SELECTED),
                selectedEdges: new DrawOp(trianglesEdgeSilhouette, RENDER_PASSES.SELECTED),
                xrayed: new DrawOp(silhouette, RENDER_PASSES.XRAYED),
                xrayedEdges: new DrawOp(trianglesEdgeSilhouette, RENDER_PASSES.XRAYED),
                pick: new DrawOp(trianglesPick, RENDER_PASSES.PICK),
                pickDepth: new DrawOp(trianglesDepth, RENDER_PASSES.PICK)
            },

            [LinesPrimitive]: {
                opaque: new DrawOp(linesColor, RENDER_PASSES.OPAQUE),
                transparent: new DrawOp(linesColor, RENDER_PASSES.TRANSPARENT)
            },

            [PointsPrimitive]: {
                opaque: new DrawOp(pointsColor, RENDER_PASSES.OPAQUE),
                transparent: new DrawOp(pointsColor, RENDER_PASSES.TRANSPARENT)
            }
        };
    }

    _destroy() {
        // @ts-ignore
        Object.values(this._drawTechniques).forEach(drawTechnique => drawTechnique.destroy());
    }
}

const drawOpsInstances = {};

/**
 * Gets or creates a DrawOps for the given RenderContext.
 * @param renderContext
 * @param dtxMemoryReader
 */
export function getDrawOps(renderContext: RenderContext, dtxMemoryReader: DTXMemoryReader): DrawOps {
    const viewerId = renderContext.viewer.id;
    let drawOps = drawOpsInstances[viewerId];
    if (!drawOps) {
        drawOps = new DrawOps(renderContext, dtxMemoryReader);
        drawOpsInstances[viewerId] = drawOps;
    }
    drawOps._useCount++;
    return drawOps;
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