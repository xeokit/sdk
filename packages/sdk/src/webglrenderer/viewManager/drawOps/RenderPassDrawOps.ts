import {DrawOp} from "./DrawOp";

/**
 * A collection of draw operations (draw ops) for different render passes.
 */
export interface RenderPassDrawOps {
    opaque?: DrawOp; // Render opaque objects with color and lighting
    opaqueEdges?: DrawOp; // Render opaque edges with color
    transparent?: DrawOp; // Render transparent objects with color and lighting
    transparentEdges?: DrawOp; // Render transparent edges with color
    highlighted?: DrawOp; // Render highlighted silhouettes
    selected?: DrawOp; // Render selected silhouettes
    xrayed?: DrawOp; // Render x-rayed silhouettes
    highlightedEdges?: DrawOp; // Render highlighted silhouettes edges
    selectedEdges?: DrawOp; // Render selected silhouettes edges
    xrayedEdges?: DrawOp; // Render x-rayed silhouettes edges
    pick?: DrawOp; // Render meshes as their RGBA-encoded mesh IDs to the pick buffer
    pickDepth?: DrawOp; // Render screen-space depths to depth buffer
}