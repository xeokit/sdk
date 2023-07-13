import type { RendererMesh, SceneObject} from "@xeokit/scene";
import type {FloatArrayParam} from "@xeokit/math";
import type {Pickable} from "./Pickable";
import type {PickResult} from "@xeokit/viewer";


/**
 * TODO
 *
 * @internal
 */
export class MockRendererMesh implements RendererMesh, Pickable {

    constructor(params: {

    }) {

    }

    delegatePickedEntity(): SceneObject {
        throw new Error("Method not implemented.");
    }

    setMatrix(matrix: FloatArrayParam): void {
    }

    setMetallic(metallic: number): void {
    }

    setRoughness(roughness: number): void {
    }

    setColor(color: FloatArrayParam) {
    }

    canPickTriangle(): boolean {
        return false;
    }

    canPickWorldPos(): boolean {
        return false;
    }

    pickTriangleSurface(pickResult: PickResult): void {
    }

    destroy() {

    }
}
