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
     * @Inheritdoc
     */
    delegatePickedEntity(): SceneObject {
        throw new Error("Method not implemented.");
    }

    /**
     * @Inheritdoc
     */
    setMatrix(matrix: FloatArrayParam): void {
    }

    /**
     * @Inheritdoc
     */
    setMetallic(metallic: number): void {
    }

    /**
     * @Inheritdoc
     */
    setRoughness(roughness: number): void {
    }

    /**
     * @Inheritdoc
     */
    setColor(color: FloatArrayParam) {
    }

    /**
     * @Inheritdoc
     */
    canPickTriangle(): boolean {
        return false;
    }

    /**
     * @Inheritdoc
     */
    canPickWorldPos(): boolean {
        return false;
    }

    /**
     * @Inheritdoc
     */
    pickTriangleSurface(pickResult: PickResult): void {
    }

    /**
     * @Inheritdoc
     */
    destroy() {

    }
}
