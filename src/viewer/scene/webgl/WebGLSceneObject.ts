import {SceneObject} from "../SceneObject";
import {FloatArrayType} from "../../math";

export class WebGLSceneObject extends SceneObject {
    setColorize(viewIndex: number, colorize?: FloatArrayType): void {
    }

    setCulled(viewIndex: number, culled: boolean): void {
    }

    setEdges(viewIndex: number, edges: boolean): void {
    }

    setHighlighted(viewIndex: number, highlighted: boolean): void {
    }

    setOpacity(viewIndex: number, opacity?: number): void {
    }

    setPickable(viewIndex: number, pickable: boolean): void {
    }

    setSelected(viewIndex: number, selected: boolean): void {
    }

    setVisible(viewIndex: number, visible: boolean): void {
    }

    setXRayed(viewIndex: number, xrayed: boolean): void {
    }

    destroy() {
        super.destroy();
    }
}