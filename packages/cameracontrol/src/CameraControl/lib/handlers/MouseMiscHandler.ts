import { View } from "@xeokit/viewer";


/**
 * @private
 */
class MouseMiscHandler {
    #view: View;
    #mouseEnterHandler: any;
    #mouseMoveHandler: any;
    #mouseLeaveHandler: any;
    #mouseDownHandler: any;
    #mouseUpHandler: any;

    constructor(components: any, controllers: any, configs: any, states: any, updates: any) {

        this.#view = components.view;

        const canvasElement = this.#view.canvasElement;

        canvasElement.addEventListener("mouseenter", this.#mouseEnterHandler = () => {
            states.mouseover = true;
        });

        canvasElement.addEventListener("mouseleave", this.#mouseLeaveHandler = () => {
            states.mouseover = false;
            // @ts-ignore
            canvasElement.style.cursor = null;
        });

        document.addEventListener("mousemove", this.#mouseMoveHandler = (e: any) => {
            getViewPosFromEvent(e, canvasElement, states.pointerViewPos);
        });

        canvasElement.addEventListener("mousedown", this.#mouseDownHandler = (e: Event) => {
            if (!(configs.active && configs.pointerEnabled)) {
                return;
            }
            getViewPosFromEvent(e, canvasElement, states.pointerViewPos);
            states.mouseover = true;
        });

        canvasElement.addEventListener("mouseup",
            this.#mouseUpHandler = (e:Event) => {
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

function getViewPosFromEvent(event: any, canvasElement: any, canvasPos: number[]) {
    if (!event) {
        event = window.event;
        canvasPos[0] = event.x;
        canvasPos[1] = event.y;
    } else {
        const {x, y} = canvasElement.getBoundingClientRect();
        canvasPos[0] = event.clientX - x;
        canvasPos[1] = event.clientY - y;
    }
    return canvasPos;
}

export {MouseMiscHandler};
