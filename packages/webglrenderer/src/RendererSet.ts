import {TrianglesFastColorRenderer} from "./triangles/TrianglesFastColorRenderer";
import {TrianglesSilhouetteRenderer} from "./triangles/TrianglesSilhouetteRenderer";
import {TrianglesEdgesColorRenderer} from "./triangles/TrianglesEdgesColorRenderer";
import {PointsColorRenderer} from "./points/PointsColorRenderer";
import {PointsSilhouetteRenderer} from "./points/PointsSilhouetteRenderer";
import {LinesColorRenderer} from "./lines/LinesColorRenderer";
import {LinesSilhouetteRenderer} from "./lines/LinesSilhouetteRenderer";

class TrianglesFastQualityColorRenderer {
}

/**
 * @private
 */
export interface RendererSet {

    trianglesFastColorRenderer: TrianglesFastColorRenderer;
    trianglesQualityColorRenderer: TrianglesFastQualityColorRenderer;
    trianglesSilhouetteRenderer: TrianglesSilhouetteRenderer;
    trianglesEdgesColorRenderer: TrianglesEdgesColorRenderer;

    pointsColorRenderer: PointsColorRenderer;
    pointsSilhouetteRenderer: PointsSilhouetteRenderer;

    linesColorRenderer: LinesColorRenderer;
    linesSilhouetteRenderer: LinesSilhouetteRenderer;
}