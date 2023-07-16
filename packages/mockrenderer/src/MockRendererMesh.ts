import type { RendererMesh, SceneObject} from "@xeokit/scene";
import type {FloatArrayParam} from "@xeokit/math";
import type {Pickable} from "./Pickable";
import type {PickResult} from "@xeokit/viewer";


/**
 * Mock rendering strategy for a {@link @xeokit/scene!Mesh | Mesh}.
 *
 * See {@link @xeokit/mockrenderer} for usage.
 */
export class MockRendererMesh implements RendererMesh, Pickable {

    /**
     * @private
     */
    constructor(params: {

    }) {

    }

    /**
     * @inheritdoc
     */
    delegatePickedEntity(): SceneObject {
        throw new Error("Method not implemented.");
    }

    /**
     * @inheritdoc
     */
    setMatrix(matrix: FloatArrayParam): void {
    }

    /**
     * @inheritdoc
     */
    setMetallic(metallic: number): void {
    }

    /**
     * @inheritdoc
     */
    setRoughness(roughness: number): void {
    }

    /**
     * @inheritdoc
     */
    setColor(color: FloatArrayParam) {
    }

    /**
     * @inheritdoc
     */
    canPickTriangle(): boolean {
        return false;
    }

    /**
     * @inheritdoc
     */
    canPickWorldPos(): boolean {
        return false;
    }

    /**
     * @inheritdoc
     */
    pickTriangleSurface(pickResult: PickResult): void {
    }

    /**
     * @inheritdoc
     */
    destroy() {

    }
}
