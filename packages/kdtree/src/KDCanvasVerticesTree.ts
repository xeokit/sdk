import {GeometryView, getSceneObjectGeometry, SceneObject} from "@xeokit/scene";
import {testAABB3ContainsPoint3} from "@xeokit/math/src/boundaries";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";
import {createVec3, createVec4, transformPoint3, transformPoint4} from "@xeokit/math/matrix";

const MAX_KD_TREE_DEPTH = 10; // Increase if greater precision needed

const KDCanvasVertsTreeDimLength = new Float32Array(3);

/**
 * Parameters for creating a {@link KDCanvasVertsTree}.
 */
export interface KDCanvasVertsTreeParams {
    projMatrix: FloatArrayParam;
    viewMatrix: FloatArrayParam;

    /**
     * The {@link @xeokit/scene!SceneObject | SceneObject} whose vertex positions are searched by the new KDCanvasVertsTree.
     */
    sceneObject: SceneObject;
}

/**
 * An item in a {@link KDCanvasVertsNode}.
 */
export interface KDCanvasVertsItem {

    position: FloatArrayParam;

    canvasPos: IntArrayParam;
}

/**
 * A node in a {@link KDCanvasVertsTree}.
 */
export interface KDCanvasVertsNode {

    /**
     * The axis-aligned Canvas-space 2D boundary of this kd-tree node.
     */
    aabb: FloatArrayParam;

    /**
     * The left KDCanvasVertsNode.
     */
    left?: KDCanvasVertsNode;

    /**
     * The right KDCanvasVertsNode.
     */
    right?: KDCanvasVertsNode;

    /**
     * The {@link KDCanvasVertsItem | KDCanvasVertsItems} stored in this KDCanvasVertsNode.
     */
    items?: KDCanvasVertsItem[];
}

function testAABB2ContainsPoint2(aabb: FloatArrayParam, canvasPos: IntArrayParam) {
    return false;
}

/**
 * Automatically organizes a {@link @xeokit/scene!SceneObject | SceneObject}'s geometry vertex positions into a
 * structure to support fast intersection and nearest-neighbour tests.
 *
 * See {@link "@xeokit/KDCanvasVertsTree"} for usage.
 */
export class KDCanvasVertsTree {

    public readonly sceneObject: SceneObject;

    public readonly root: KDCanvasVertsNode;

    /**
     * Creates a new KDCanvasVertsTree.
     *
     * @param params
     */
    constructor(params: KDCanvasVertsTreeParams) {

        const viewMatrix = params.viewMatrix;
        const projMatrix = params.projMatrix;

        this.sceneObject = params.sceneObject;

        this.root = <KDCanvasVertsNode>{
            aabb: this.sceneObject.aabb
        };

        getSceneObjectGeometry(this.sceneObject, (geometryView: GeometryView): boolean | undefined => {

            const worldPos = createVec4();
            worldPos[3] = 1.0;

            const viewPos = createVec4();
            const projPos = createVec4();


            for (let i = 0, len = geometryView.positionsWorld.length; i < len; i += 3) {

                worldPos[0] = geometryView.positionsWorld[i];
                worldPos[1] = geometryView.positionsWorld[i + 1];
                worldPos[2] = geometryView.positionsWorld[i + 2];

                transformPoint4(viewMatrix, worldPos, viewPos);
                transformPoint4(projMatrix, viewPos, projPos);

                // TODO canvasPos

                // TODO view transform and project

                this.#insertVertex(this.root, canvasPos, worldPos, 1);
            }
            return false;
        });
    }

    #insertVertex(node: KDCanvasVertsNode, canvasPos: IntArrayParam, position: FloatArrayParam, depth: number) {
        if (depth >= MAX_KD_TREE_DEPTH) {
            node.items = node.items || [];
            node.items.push(<KDCanvasVertsItem>{
                position
            });
            expandAABB2Point2(node.aabb, canvasPos, );
            return;
        }
        if (node.left) {
            if (testAABB2ContainsPoint2(node.left.aabb, canvasPos)) {
                this.#insertVertex(node.left, canvasPos, position, depth + 1);
                return;
            }
        }
        if (node.right) {
            if (testAABB2ContainsPoint2(node.right.aabb, canvasPos)) {
                this.#insertVertex(node.right, canvasPos, position, depth + 1);
                return;
            }
        }
        const nodeAABB = node.aabb;
        KDCanvasVertsTreeDimLength[0] = nodeAABB[3] - nodeAABB[0];
        KDCanvasVertsTreeDimLength[1] = nodeAABB[4] - nodeAABB[1];
        KDCanvasVertsTreeDimLength[2] = nodeAABB[5] - nodeAABB[2];
        let dim = 0;
        if (KDCanvasVertsTreeDimLength[1] > KDCanvasVertsTreeDimLength[dim]) {
            dim = 1;
        }
        if (KDCanvasVertsTreeDimLength[2] > KDCanvasVertsTreeDimLength[dim]) {
            dim = 2;
        }
        if (!node.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 3] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.left = {
                aabb: aabbLeft
            };
            if (testAABB2ContainsPoint2(aabbLeft, canvasPos)) {
                this.#insertVertex(node.left, canvasPos, position, depth + 1);
                return;
            }
        }
        if (!node.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.right = {
                aabb: aabbRight
            };
            if (testAABB2ContainsPoint2(aabbRight, canvasPos)) {
                this.#insertVertex(node.right, canvasPos, position, depth + 1);
                return;
            }
        }
        node.items = node.items || [];
        node.items.push(<KDCanvasVertsItem>{
            position
        });
        expandAABB2Point2(node.aabb, position);
    }
}
