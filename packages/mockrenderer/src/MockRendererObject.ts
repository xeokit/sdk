import type {FloatArrayParam} from "@xeokit/math";
import type {MockRendererMesh} from "./MockRendererMesh";
import type {RendererViewObject} from "@xeokit/viewer";
import type {RendererModel, RendererObject, SceneObject} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";

/**
 * Mock rendering strategy for a {@link @xeokit/scene!SceneObject | SceneObject}.
 *
 * See {@link @xeokit/mockrenderer} for usage.
 */
export class MockRendererObject implements RendererObject, RendererViewObject {

    readonly id: string;
    readonly rendererModel: RendererModel;
    readonly sceneObject: SceneObject;
    readonly layerId: string;

    readonly rendererMeshes: MockRendererMesh[];

    /**
     * @private
     */
    constructor(params: {
        id: string,
        sceneObject: SceneObject,
        rendererModel: RendererModel,
        rendererMeshes: MockRendererMesh[],
        aabb: any,
        layerId?: string
    }) {
        this.id = params.id;
        this.sceneObject = params.sceneObject;
        this.rendererModel = params.rendererModel;
        this.rendererMeshes = params.rendererMeshes;
      //  this.layerId = params.layerId;
    }

    /**
     * @Inheritdoc
     */
    get aabb(): FloatArrayParam {
        return this.sceneObject.aabb;
    }

    /**
     * @Inheritdoc
     */
    setVisible(viewIndex: number, visible: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setHighlighted(viewIndex: number, highlighted: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setXRayed(viewIndex: number, xrayed: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setSelected(viewIndex: number, selected: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setEdges(viewIndex: number, edges: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setCulled(viewIndex: number, culled: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setClippable(viewIndex: number, clippable: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setCollidable(viewIndex: number, collidable: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setPickable(viewIndex: number, pickable: boolean): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setColorize(viewIndex: number, color?: FloatArrayParam): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setOpacity(viewIndex: number, opacity?: number): void | SDKError {

    }

    /**
     * @Inheritdoc
     */
    setOffset(viewIndex: number, offset: FloatArrayParam): void | SDKError {

    }

    destroy(): void {
        for (let i = 0, len = this.rendererMeshes.length; i < len; i++) {
            this.rendererMeshes[i].destroy();
        }
    }
}
