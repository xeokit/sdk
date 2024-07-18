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

        const htmlElement = this.#view.htmlElement;

        htmlElement.addEventListener("mouseenter", this.#mouseEnterHandler = () => {
            states.mouseover = true;
        });

        htmlElement.addEventListener("mouseleave", this.#mouseLeaveHandler = () => {
            states.mouseover = false;
            htmlElement.style.cursor = null;
        });

        document.addEventListener("mousemove", this.#mouseMoveHandler = (e) => {
            getCanvasPosFromEvent(e, htmlElement, states.pointerCanvasPos);
        });

        htmlElement.addEventListener("mousedown", this.#mouseDownHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            getCanvasPosFromEvent(e, htmlElement, states.pointerCanvasPos);
            states.mouseover = true;
        });

        htmlElement.addEventListener("mouseup", this.#mouseUpHandler = (e) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
        });
    }

    reset() {
    }

    destroy() {

        const htmlElement = this.#view.htmlElement;

        document.removeEventListener("mousemove", this.#mouseMoveHandler);
        htmlElement.removeEventListener("mouseenter", this.#mouseEnterHandler);
        htmlElement.removeEventListener("mouseleave", this.#mouseLeaveHandler);
        htmlElement.removeEventListener("mousedown", this.#mouseDownHandler);
        htmlElement.removeEventListener("mouseup", this.#mouseUpHandler);
    }
}

function getCanvasPosFromEvent(event, htmlElement, canvasPos) {
    if (!event) {
        event = window.event;
        canvasPos[0] = event.x;
        canvasPos[1] = event.y;
    } else {
        const { left, top } = htmlElement.getBoundingClientRect();
        canvasPos[0] = event.clientX - left;
        canvasPos[1] = event.clientY - top;
    }
    return canvasPos;
}

export {MouseMiscHandler};
