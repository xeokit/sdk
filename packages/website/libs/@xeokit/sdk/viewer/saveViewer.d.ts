import { SAOParams } from "./SAOParams";
import { SAO } from "./SAO";
import { View } from "./View";
import { ViewParams } from "./ViewParams";
import { EdgesParams } from "./EdgesParams";
import { Edges } from "./Edges";
import { CameraParams } from "./CameraParams";
import { Camera } from "./Camera";
export declare function saveView(view: View, mask: any): ViewParams;
/**
 * Gets an SAO as JSON.
 */
export declare function saveSAO(sao: SAO): SAOParams;
/**
 * Gets an Edges as JSON.
 */
export declare function saveEdges(edges: Edges): EdgesParams;
/**
 * Saves Camera state as JSON.
 */
export declare function saveCamera(camera: Camera): CameraParams;
//# sourceMappingURL=saveViewer.d.ts.map