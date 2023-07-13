import type {FloatArrayParam} from "@xeokit/math";
import type {MockRendererMesh} from "./MockRendererMesh";
import type {RendererViewObject} from "@xeokit/viewer";
import type {RendererModel, RendererObject, SceneObject} from "@xeokit/scene";

/**
 * TODO
 *
 * @internal
 */
export class MockRendererObject implements RendererObject, RendererViewObject {

    readonly id: string;
    readonly rendererModel: RendererModel;
    readonly sceneObject: SceneObject;
    readonly layerId: string | null;

    readonly rendererMeshes: MockRendererMesh[];


    constructor(params: {
        id: string,
        sceneObject: SceneObject,
        rendererModel: RendererModel,
        rendererMeshes: MockRendererMesh[],
        aabb: any,
        layerId?: string
    }) {
        this.sceneObject = params.sceneObject;
    }

    get aabb(): FloatArrayParam {
        return this.sceneObject.aabb;
    }

    setVisible(viewIndex: number, visible: boolean): void {

    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {

    }

    setXRayed(viewIndex: number, xrayed: boolean): void {

    }

    setSelected(viewIndex: number, selected: boolean): void {

    }

    setEdges(viewIndex: number, edges: boolean): void {

    }

    setCulled(viewIndex: number, culled: boolean): void {

    }

    setClippable(viewIndex: number, clippable: boolean): void {

    }

    setCollidable(viewIndex: number, collidable: boolean): void {

    }

    setPickable(viewIndex: number, pickable: boolean): void {

    }

    setColorize(viewIndex: number, color?: FloatArrayParam): void {

    }

    setOpacity(viewIndex: number, opacity?: number): void {

    }

    setOffset(viewIndex: number, offset: FloatArrayParam): void {

    }

    destroy(): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].destroy();
        }
    }
}
