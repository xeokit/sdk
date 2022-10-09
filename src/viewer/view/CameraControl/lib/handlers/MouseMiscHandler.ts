import {View} from "../../../View";

/**
 * @private
 */
class MouseMiscHandler {
    #view: View;
    #mouseEnterHandler: () => void;
    #mouseMoveHandler: (this: Document, ev: MouseEvent) => any;
    #mouseLeaveHandler: (this: Document, ev: MouseEvent) => any;
    #mouseDownHandler: (this: Document, ev: MouseEvent) => any;
    #mouseUpHandler: (this: Document, ev: MouseEvent) => any;

    constructor(components: any, controllers: any, configs: any, states: any, updates: any) {

        this.#view = components.view;

        const canvas = this.#view.canvas.canvas;

        canvas.addEventListener("mouseenter", this.#mouseEnterHandler = () => {
            states.mouseover = true;
        });

        canvas.addEventListener("mouseleave", this.#mouseLeaveHandler = () => {
            states.mouseover = false;
            canvas.style.cursor = null;
        });

        document.addEventListener("mousemove", this.#mouseMoveHandler = (e) => {
            getCanvasPosFromEvent(e, canvas, states.pointerCanvasPos);
        });

        canvas.addEventListener("mousedown", this.#mouseDownHandler = (e: Event) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            getCanvasPosFromEvent(e, canvas, states.pointerCanvasPos);
            states.mouseover = true;
        });

        canvas.addEventListener("mouseup", this.#mouseUpHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
        });
    }

    reset() {
    }

    destroy() {
        const canvas = this.#view.canvas.canvas;
        document.removeEventListener("mousemove", this.#mouseMoveHandler);
        canvas.removeEventListener("mouseenter", this.#mouseEnterHandler);
        canvas.removeEventListener("mouseleave", this.#mouseLeaveHandler);
        canvas.removeEventListener("mousedown", this.#mouseDownHandler);
        canvas.removeEventListener("mouseup", this.#mouseUpHandler);
    }
}

function getCanvasPosFromEvent(event: any, canvas: any, canvasPos: number[]) {
    if (!event) {
        event = window.event;
        canvasPos[0] = event.x;
        canvasPos[1] = event.y;
    } else {
        const {x, y} = canvas.getBoundingClientRect();
        canvasPos[0] = event.clientX - x;
        canvasPos[1] = event.clientY - y;
    }
    return canvasPos;
}

export {MouseMiscHandler};
