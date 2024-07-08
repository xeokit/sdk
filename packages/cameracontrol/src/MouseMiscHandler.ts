/**
 * @private
 */
import {View} from "@xeokit/viewer";

class MouseMiscHandler {

    #view: View;
    #mouseEnterHandler: () => void;
    #mouseLeaveHandler: () => void;
    #mouseMoveHandler: (e) => void;
    #mouseDownHandler: (e) => void;
    #mouseUpHandler: (e) => void;

    constructor(view:View, controllers, configs, states, updates) {

        this.#view = view;

        const canvasElement = this.#view.canvasElement;

        canvasElement.addEventListener("mouseenter", this.#mouseEnterHandler = () => {
            states.mouseover = true;
        });

        canvasElement.addEventListener("mouseleave", this.#mouseLeaveHandler = () => {
            states.mouseover = false;
            canvasElement.style.cursor = null;
        });

        document.addEventListener("mousemove", this.#mouseMoveHandler = (e) => {
            getCanvasPosFromEvent(e, canvasElement, states.pointerCanvasPos);
        });

        canvasElement.addEventListener("mousedown", this.#mouseDownHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            getCanvasPosFromEvent(e, canvasElement, states.pointerCanvasPos);
            states.mouseover = true;
        });

        canvasElement.addEventListener("mouseup", this.#mouseUpHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
        });
    }

    reset() {
    }

    destroy() {

        const canvasElement = this.#view.canvasElement;

        document.removeEventListener("mousemove", this.#mouseMoveHandler);
        canvasElement.removeEventListener("mouseenter", this.#mouseEnterHandler);
        canvasElement.removeEventListener("mouseleave", this.#mouseLeaveHandler);
        canvasElement.removeEventListener("mousedown", this.#mouseDownHandler);
        canvasElement.removeEventListener("mouseup", this.#mouseUpHandler);
    }
}

function getCanvasPosFromEvent(event, canvasElement, canvasPos) {
    if (!event) {
        event = window.event;
        canvasPos[0] = event.x;
        canvasPos[1] = event.y;
    } else {
        const { left, top } = canvasElement.getBoundingClientRect();
        canvasPos[0] = event.clientX - left;
        canvasPos[1] = event.clientY - top;
    }
    return canvasPos;
}

export {MouseMiscHandler};
