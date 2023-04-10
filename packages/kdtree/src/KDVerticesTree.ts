import {GeometryView, getSceneObjectGeometry, SceneObject} from "@xeokit/scene";
import {expandAABB3Point3, testAABB3ContainsPoint3} from "@xeokit/math/src/boundaries";
import {FloatArrayParam} from "@xeokit/math/math";
import {createVec3} from "@xeokit/math/matrix";

const MAX_KD_TREE_DEPTH = 10; // Increase if greater precision needed

const KDVerticesTreeDimLength = new Float32Array(3);

/**
 * Parameters for creating a {@link KDVerticesTree}.
 */
export interface KDVerticesTreeParams {

    /**
     * The {@link @xeokit/scene!SceneObject | SceneObject} whose vertex positions are searched by the new KDVerticesTree.
     */
    sceneObject: SceneObject;
}

/**
 * An item in a {@link KDVerticesNode}.
 */
export interface KDVerticesItem {

    position: FloatArrayParam;
}

/**
 * A node in a {@link KDVerticesTree}.
 */
export interface KDVerticesNode {

    /**
     * The axis-aligned World-space 3D boundary of this kd-tree node.
     */
    aabb: FloatArrayParam;

    /**
     * The left KDVerticesNode.
     */
    left?: KDVerticesNode;

    /**
     * The right KDVerticesNode.
     */
    right?: KDVerticesNode;

    /**
     * The {@link KDVerticesItem | KDVerticesItems} stored in this KDVerticesNode.
     */
    items?: KDVerticesItem[];
}

/**
 * Automatically organizes a {@link @xeokit/scene!SceneObject | SceneObject}'s geometry vertex positions into a
 * structure to support fast intersection and nearest-neighbour tests.
 *
 * See {@link "@xeokit/KDVerticesTree"} for usage.
 */
export class KDVerticesTree {

    public readonly sceneObject: SceneObject;

    public readonly root: KDVerticesNode;

    /**
     * Creates a new KDVerticesTree.
     *
     * @param params
     */
    constructor(params: KDVerticesTreeParams) {

        this.sceneObject = params.sceneObject;

        this.root = <KDVerticesNode>{
            aabb: this.sceneObject.aabb
        };

        getSceneObjectGeometry(this.sceneObject, (geometryView: GeometryView): boolean | undefined => {
            const position = createVec3();
            for (let i = 0, len = geometryView.positionsWorld.length; i < len; i += 3) {
                position[0] = geometryView.positionsWorld[i];
                position[1] = geometryView.positionsWorld[i + 1];
                position[2] = geometryView.positionsWorld[i + 2];
                this.#insertVertex(this.root, position, 1);
            }
            return false;
        });
    }

    #insertVertex(node: KDVerticesNode, position: FloatArrayParam, depth: number) {
        if (depth >= MAX_KD_TREE_DEPTH) {
            node.items = node.items || [];
            node.items.push(<KDVerticesItem>{
                position
            });
            expandAABB3Point3(node.aabb, position);
            return;
        }
        if (node.left) {
            if (testAABB3ContainsPoint3(node.left.aabb, position)) {
                this.#insertVertex(node.left, position, depth + 1);
                return;
            }
        }
        if (node.right) {
            if (testAABB3ContainsPoint3(node.right.aabb, position)) {
                this.#insertVertex(node.right, position, depth + 1);
                return;
            }
        }
        const nodeAABB = node.aabb;
        KDVerticesTreeDimLength[0] = nodeAABB[3] - nodeAABB[0];
        KDVerticesTreeDimLength[1] = nodeAABB[4] - nodeAABB[1];
        KDVerticesTreeDimLength[2] = nodeAABB[5] - nodeAABB[2];
        let dim = 0;
        if (KDVerticesTreeDimLength[1] > KDVerticesTreeDimLength[dim]) {
            dim = 1;
        }
        if (KDVerticesTreeDimLength[2] > KDVerticesTreeDimLength[dim]) {
            dim = 2;
        }
        if (!node.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 3] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.left = {
                aabb: aabbLeft
            };
            if (testAABB3ContainsPoint3(aabbLeft, position)) {
                this.#insertVertex(node.left, position, depth + 1);
                return;
            }
        }
        if (!node.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.right = {
                aabb: aabbRight
            };
            if (testAABB3ContainsPoint3(aabbRight, position)) {
                this.#insertVertex(node.right, position, depth + 1);
                return;
            }
        }
        node.items = node.items || [];
        node.items.push(<KDVerticesItem>{
            position
        });
        expandAABB3Point3(node.aabb, position);
    }
}
