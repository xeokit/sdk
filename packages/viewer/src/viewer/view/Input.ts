import {Component} from '../Component';
import * as math from '../math/index';

/**
 * Meditates mouse, touch and keyboard events for various interaction controls.
 *
 * Ordinarily, you would only use this component as a utility to help manage input events and state for your
 * own custom input handlers.
 *
 * * Located at {@link Scene.input}
 * * Used by (at least) {@link CameraControl}
 *
 * ## Usage
 *
 * Subscribing to mouse events on the canvas:
 *
 * ````javascript
 * import {Viewer} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
 *      canvasId: "myCanvas"
 * });
 *
 * const input = viewer.scene.input;
 *
 * const onMouseDown = input.events.on("mousedown", (canvasCoords) => {
 *       console.log("Mouse down at: x=" + canvasCoords[0] + ", y=" + coords[1]);
 * });
 *
 * const onMouseUp = input.events.on("mouseup", (canvasCoords) => {
 *       console.log("Mouse up at: x=" + canvasCoords[0] + ", y=" + canvasCoords[1]);
 * });
 *
 * const onMouseClicked = input.events.on("mouseclicked", (canvasCoords) => {
 *      console.log("Mouse clicked at: x=" + canvasCoords[0] + ", y=" + canvasCoords[1]);
 * });
 *
 * const onDblClick = input.events.on("dblclick", (canvasCoords) => {
 *       console.log("Double-click at: x=" + canvasCoords[0] + ", y=" + canvasCoords[1]);
 * });
 * ````
 *
 * Subscribing to keyboard events on the canvas:
 *
 * ````javascript
 * const onKeyDown = input.events.on("keydown", (keyCode) => {
 *      switch (keyCode) {
 *          case this.KEY_A:
 *              console.log("The 'A' key is down");
 *              break;
 *
 *          case this.KEY_B:
 *              console.log("The 'B' key is down");
 *              break;
 *
 *          case this.KEY_C:
 *              console.log("The 'C' key is down");
 *              break;
 *
 *          default:
 *              console.log("Some other key is down");
 *      }
 * });
 *
 * const onKeyUp = input.events.on("keyup", (keyCode) => {
 *      switch (keyCode) {
 *          case this.KEY_A:
 *              console.log("The 'A' key is up");
 *              break;
 *
 *          case this.KEY_B:
 *              console.log("The 'B' key is up");
 *              break;
 *
 *          case this.KEY_C:
 *              console.log("The 'C' key is up");
 *              break;
 *
 *          default:
 *              console.log("Some other key is up");
 *      }
 *  });
 * ````
 *
 * Checking if keys are down:
 *
 * ````javascript
 * const isCtrlDown = input.ctrlDown;
 * const isAltDown = input.altDown;
 * const shiftDown = input.shiftDown;
 * //...
 *
 * const isAKeyDown = input.keyDown[input.KEY_A];
 * const isBKeyDown = input.keyDown[input.KEY_B];
 * const isShiftKeyDown = input.keyDown[input.KEY_SHIFT];
 * //...
 *
 * ````
 * Unsubscribing from events:
 *
 * ````javascript
 * input.off(onMouseDown);
 * input.off(onMouseUp);
 * //...
 * ````
 *
 * ## Disabling all events
 *
 * Event handling is enabled by default.
 *
 * To disable all events:
 *
 * ````javascript
 * myViewer.scene.input.setEnabled(false);
 * ````
 * To enable all events again:
 *
 * ````javascript
 * myViewer.scene.input.setEnabled(true);
 * ````
 *
 * ## Disabling keyboard input
 *
 * When the mouse is over the canvas, the canvas will consume keyboard events. Therefore, sometimes we need
 * to disable keyboard control, so that other UI elements can get those events.
 *
 * To disable keyboard events:
 *
 * ````javascript
 * myViewer.scene.input.setKeyboardEnabled(false);
 * ````
 *
 * To enable keyboard events again:
 *
 * ````javascript
 * myViewer.scene.input.setKeyboardEnabled(true)
 * ````
 */
class Input extends Component {

    /**
     * Code for the BACKSPACE key.
     */
    public readonly KEY_BACKSPACE: number = 8;

    /**
     * Code for the TAB key.
     */
    public readonly KEY_TAB: number = 9;

    /**
     * Code for the ENTER key.
     */
    public readonly KEY_ENTER: number = 13;

    /**
     * Code for the SHIFT key.
     */
    public readonly KEY_SHIFT: number = 16;

    /**
     * Code for the CTRL key.
     */
    public readonly KEY_CTRL: number = 17;

    /**
     * Code for the ALT key.
     */
    public readonly KEY_ALT: number = 18;

    /**
     * Code for the PAUSE_BREAK key.
     */
    public readonly KEY_PAUSE_BREAK: number = 19;

    /**
     * Code for the CAPS_LOCK key.
     */
    public readonly KEY_CAPS_LOCK: number = 20;

    /**
     * Code for the ESCAPE key.
     */
    public readonly KEY_ESCAPE: number = 27;

    /**
     * Code for the PAGE_UP key.
     */
    public readonly KEY_PAGE_UP: number = 33;

    /**
     * Code for the PAGE_DOWN key.
     */
    public readonly KEY_PAGE_DOWN: number = 34;

    /**
     * Code for the END key.
     */
    public readonly KEY_END: number = 35;

    /**
     * Code for the HOME key.
     */
    public readonly KEY_HOME: number = 36;

    /**
     * Code for the LEFT_ARROW key.
     */
    public readonly KEY_LEFT_ARROW: number = 37;

    /**
     * Code for the UP_ARROW key.

     */
    public readonly KEY_UP_ARROW: number = 38;

    /**
     * Code for the RIGHT_ARROW key.
     */
    public readonly KEY_RIGHT_ARROW: number = 39;

    /**
     * Code for the DOWN_ARROW key.
     */
    public readonly KEY_DOWN_ARROW: number = 40;

    /**
     * Code for the INSERT key.
     */
    public readonly KEY_INSERT: number = 45;

    /**
     * Code for the DELETE key.
     */
    public readonly KEY_DELETE: number = 46;

    /**
     * Code for the 0 key.
     */
    public readonly KEY_NUM_0: number = 48;

    /**
     * Code for the 1 key.
     */
    public readonly KEY_NUM_1: number = 49;

    /**
     * Code for the 2 key.
     */
    public readonly KEY_NUM_2: number = 50;

    /**
     * Code for the 3 key.
     */
    public readonly KEY_NUM_3: number = 51;

    /**
     * Code for the 4 key.
     */
    public readonly KEY_NUM_4: number = 52;

    /**
     * Code for the 5 key.
     */
    public readonly KEY_NUM_5: number = 53;

    /**
     * Code for the 6 key.
     */
    public readonly KEY_NUM_6: number = 54;

    /**
     * Code for the 7 key.
     */
    public readonly KEY_NUM_7: number = 55;

    /**
     * Code for the 8 key.
     */
    public readonly KEY_NUM_8: number = 56;

    /**
     * Code for the 9 key.
     */
    public readonly KEY_NUM_9: number = 57;

    /**
     * Code for the A key.
     */
    public readonly KEY_A: number = 65;

    /**
     * Code for the B key.
     */
    public readonly KEY_B: number = 66;

    /**
     * Code for the C key.
     */
    public readonly KEY_C: number = 67;

    /**
     * Code for the D key.
     */
    public readonly KEY_D: number = 68;

    /**
     * Code for the E key.
     */
    public readonly KEY_E: number = 69;

    /**
     * Code for the F key.
     */
    public readonly KEY_F: number = 70;

    /**
     * Code for the G key.
     */
    public readonly KEY_G: number = 71;

    /**
     * Code for the H key.
     */
    public readonly KEY_H: number = 72;

    /**
     * Code for the I key.
     */
    public readonly KEY_I: number = 73;

    /**
     * Code for the J key.
     */
    public readonly KEY_J: number = 74;

    /**
     * Code for the K key.
     */
    public readonly KEY_K: number = 75;

    /**
     * Code for the L key.
     */
    public readonly KEY_L: number = 76;

    /**
     * Code for the M key.
     */
    public readonly KEY_M: number = 77;

    /**
     * Code for the N key.
     */
    public readonly KEY_N: number = 78;

    /**
     * Code for the O key.
     */
    public readonly KEY_O: number = 79;

    /**
     * Code for the P key.
     */
    public readonly KEY_P: number = 80;

    /**
     * Code for the Q key.
     */
    public readonly KEY_Q: number = 81;

    /**
     * Code for the R key.
     */
    public readonly KEY_R: number = 82;

    /**
     * Code for the S key.
     */
    public readonly KEY_S: number = 83;

    /**
     * Code for the T key.
     */
    public readonly KEY_T: number = 84;

    /**
     * Code for the U key.
     */
    public readonly KEY_U: number = 85;

    /**
     * Code for the V key.
     */
    public readonly KEY_V: number = 86;

    /**
     * Code for the W key.
     */
    public readonly KEY_W: number = 87;

    /**
     * Code for the X key.
     */
    public readonly KEY_X: number = 88;

    /**
     * Code for the Y key.
     */
    public readonly KEY_Y: number = 89;

    /**
     * Code for the Z key.
     */
    public readonly KEY_Z: number = 90;

    /**
     * Code for the LEFT_WINDOW key.
     */
    public readonly KEY_LEFT_WINDOW: number = 91;

    /**
     * Code for the RIGHT_WINDOW key.
     */
    public readonly KEY_RIGHT_WINDOW: number = 92;

    /**
     * Code for the SELECT key.
     */
    public readonly KEY_SELECT_KEY: number = 93;

    /**
     * Code for the number pad 0 key.
     */
    public readonly KEY_NUMPAD_0: number = 96;

    /**
     * Code for the number pad 1 key.
     */
    public readonly KEY_NUMPAD_1: number = 97;

    /**
     * Code for the number pad 2 key.
     */
    public readonly KEY_NUMPAD_2: number = 98;

    /**
     * Code for the number pad 3 key.
     */
    public readonly KEY_NUMPAD_3: number = 99;

    /**
     * Code for the number pad 4 key.
     */
    public readonly KEY_NUMPAD_4: number = 100;

    /**
     * Code for the number pad 5 key.
     */
    public readonly KEY_NUMPAD_5: number = 101;

    /**
     * Code for the number pad 6 key.
     */
    public readonly KEY_NUMPAD_6: number = 102;

    /**
     * Code for the number pad 7 key.
     */
    public readonly KEY_NUMPAD_7: number = 103;

    /**
     * Code for the number pad 8 key.
     */
    public readonly KEY_NUMPAD_8: number = 104;

    /**
     * Code for the number pad 9 key.
     */
    public readonly KEY_NUMPAD_9: number = 105;

    /**
     * Code for the MULTIPLY key.
     */
    public readonly KEY_MULTIPLY: number = 106;

    /**
     * Code for the ADD key.
     */
    public readonly KEY_ADD: number = 107;

    /**
     * Code for the SUBTRACT key.
     */
    public readonly KEY_SUBTRACT: number = 109;

    /**
     * Code for the DECIMAL POINT key.
     */
    public readonly KEY_DECIMAL_POINT: number = 110;

    /**
     * Code for the DIVIDE key.
     */
    public readonly KEY_DIVIDE: number = 111;

    /**
     * Code for the F1 key.
     */
    public readonly KEY_F1: number = 112;

    /**
     * Code for the F2 key.
     */
    public readonly KEY_F2: number = 113;

    /**
     * Code for the F3 key.
     */
    public readonly KEY_F3: number = 114;

    /**
     * Code for the F4 key.
     */
    public readonly KEY_F4: number = 115;

    /**
     * Code for the F5 key.
     */
    public readonly KEY_F5: number = 116;

    /**
     * Code for the F6 key.
     */
    public readonly KEY_F6: number = 117;

    /**
     * Code for the F7 key.
     */
    public readonly KEY_F7: number = 118;

    /**
     * Code for the F8 key.
     */
    public readonly KEY_F8: number = 119;

    /**
     * Code for the F9 key.
     */
    public readonly KEY_F9: number = 120;

    /**
     * Code for the F10 key.
     */
    public readonly KEY_F10: number = 121;

    /**
     * Code for the F11 key.
     */
    public readonly KEY_F11: number = 122;

    /**
     * Code for the F12 key.
     */
    public readonly KEY_F12: number = 123;

    /**
     * Code for the NUM_LOCK key.
     */
    public readonly KEY_NUM_LOCK: number = 144;

    /**
     * Code for the SCROLL_LOCK key.
     */
    public readonly KEY_SCROLL_LOCK: number = 145;

    /**
     * Code for the SEMI_COLON key.
     */
    public readonly KEY_SEMI_COLON: number = 186;

    /**
     * Code for the EQUAL_SIGN key.
     */
    public readonly KEY_EQUAL_SIGN: number = 187;

    /**
     * Code for the COMMA key.
     */
    public readonly KEY_COMMA: number = 188;

    /**
     * Code for the DASH key.
     */
    public readonly KEY_DASH: number = 189;

    /**
     * Code for the PERIOD key.
     */
    public readonly KEY_PERIOD: number = 190;

    /**
     * Code for the FORWARD_SLASH key.
     */
    public readonly KEY_FORWARD_SLASH: number = 191;

    /**
     * Code for the GRAVE_ACCENT key.
     */
    public readonly KEY_GRAVE_ACCENT: number = 192;

    /**
     * Code for the OPEN_BRACKET key.
     */
    public readonly KEY_OPEN_BRACKET: number = 219;

    /**
     * Code for the BACK_SLASH key.
     */
    public readonly KEY_BACK_SLASH: number = 220;

    /**
     * Code for the CLOSE_BRACKET key.
     */
    public readonly KEY_CLOSE_BRACKET: number = 221;

    /**
     * Code for the SINGLE_QUOTE key.
     */
    public readonly KEY_SINGLE_QUOTE: number = 222;

    /**
     * Code for the SPACE key.
     */
    public readonly KEY_SPACE: number = 32;

    /**
     * The canvas element that mouse and keyboards are bound to.
     */
    private element: HTMLCanvasElement;

    /** True whenever ALT key is down.
     */
    public altDown: boolean = false;

    /** True whenever CTRL key is down.
     */
    public ctrlDown: boolean = false;

    /** True whenever left mouse button is down.
     */
    public mouseDownLeft: boolean = false;

    /**
     * True whenever middle mouse button is down.
     */
    public mouseDownMiddle: boolean = false;

    /**
     * True whenever the right mouse button is down.
     */
    public mouseDownRight: boolean = false;

    /**
     * Flag for each key that's down.
     */
    public keyDown: boolean[] = [];

    /** True while input enabled
     */
    public enabled: boolean = true;

    /** True while keyboard input is enabled.
     *
     * Default value is ````true````.
     */
    public keyboardEnabled: boolean = true;

    /** True while the mouse is over the canvas.
     */
    public mouseover: boolean = false;

    public shiftDown: boolean|undefined;

    /**
     * Current mouse position within the canvas.
     */
    public mouseCanvasPos: math.FloatArrayParam = math.vec2();

    #eventsBound: any;
    #keyUpListener: (e: any) => void;
    #mouseEnterListener: (e: any) => void;
    #mouseLeaveListener: (e: any) => void;
    #keyDownListener: (e: any) => void;
    #mouseDownListener: (e: any) => void;
    #clickListener: (e: any) => void;
    #mouseUpListener: (e: any) => void;
    #dblClickListener: (e: any) => void;
    #mouseMoveListener: (e: any) => void;
    #mouseWheelListener: (e: any) => void;



    /**
     * @private
     */
    constructor(owner: Component, cfg: { element: HTMLCanvasElement } = {
        // @ts-ignore
        element: undefined
    }) {
        super(owner, cfg);

        this.element = cfg.element;

        document.addEventListener("keydown", this.#keyDownListener = (e) => {
            if (!this.enabled || (!this.keyboardEnabled)) {
                return;
            }
            if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
                if (e.keyCode === this.KEY_CTRL) {
                    this.ctrlDown = true;
                } else if (e.keyCode === this.KEY_ALT) {
                    this.altDown = true;
                } else if (e.keyCode === this.KEY_SHIFT) {
                    this.shiftDown = true;
                }
                this.keyDown[e.keyCode] = true;
                this.events.fire("keydown", e.keyCode, true);
            }
        }, false);

        document.addEventListener("keyup", this.#keyUpListener = (e) => {
            if (!this.enabled || (!this.keyboardEnabled)) {
                return;
            }
            if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
                if (e.keyCode === this.KEY_CTRL) {
                    this.ctrlDown = false;
                } else if (e.keyCode === this.KEY_ALT) {
                    this.altDown = false;
                } else if (e.keyCode === this.KEY_SHIFT) {
                    this.shiftDown = false;
                }
                this.keyDown[e.keyCode] = false;
                this.events.fire("keyup", e.keyCode, true);
            }
        });

        this.element.addEventListener("mouseenter", this.#mouseEnterListener = (e) => {
            if (!this.enabled) {
                return;
            }
            this.mouseover = true;
            this.#getMouseCanvasPos(e);
            this.events.fire("mouseenter", this.mouseCanvasPos, true);
        });

        this.element.addEventListener("mouseleave", this.#mouseLeaveListener = (e) => {
            if (!this.enabled) {
                return;
            }
            this.mouseover = false;
            this.#getMouseCanvasPos(e);
            this.events.fire("mouseleave", this.mouseCanvasPos, true);
        });

        this.element.addEventListener("mousedown", this.#mouseDownListener = (e) => {
            if (!this.enabled) {
                return;
            }
            switch (e.which) {
                case 1:// Left button
                    this.mouseDownLeft = true;
                    break;
                case 2:// Middle/both buttons
                    this.mouseDownMiddle = true;
                    break;
                case 3:// Right button
                    this.mouseDownRight = true;
                    break;
                default:
                    break;
            }
            this.#getMouseCanvasPos(e);
            this.element.focus();
            this.events.fire("mousedown", this.mouseCanvasPos, true);
            if (this.mouseover) {
                e.preventDefault();
            }
        });

        document.addEventListener("mouseup", this.#mouseUpListener = (e) => {
            if (!this.enabled) {
                return;
            }
            switch (e.which) {
                case 1:// Left button
                    this.mouseDownLeft = false;
                    break;
                case 2:// Middle/both buttons
                    this.mouseDownMiddle = false;
                    break;
                case 3:// Right button
                    this.mouseDownRight = false;
                    break;
                default:
                    break;
            }
            this.events.fire("mouseup", this.mouseCanvasPos, true);
            // if (this.mouseover) {
            //     e.preventDefault();
            // }
        }, true);

        document.addEventListener("click", this.#clickListener = (e) => {
            if (!this.enabled) {
                return;
            }
            switch (e.which) {
                case 1:// Left button
                    this.mouseDownLeft = false;
                    this.mouseDownRight = false;
                    break;
                case 2:// Middle/both buttons
                    this.mouseDownMiddle = false;
                    break;
                case 3:// Right button
                    this.mouseDownLeft = false;
                    this.mouseDownRight = false;
                    break;
                default:
                    break;
            }
            this.#getMouseCanvasPos(e);
            this.events.fire("click", this.mouseCanvasPos, true);
            if (this.mouseover) {
                e.preventDefault();
            }
        });

        document.addEventListener("dblclick", this.#dblClickListener = (e) => {
            if (!this.enabled) {
                return;
            }
            switch (e.which) {
                case 1:// Left button
                    this.mouseDownLeft = false;
                    this.mouseDownRight = false;
                    break;
                case 2:// Middle/both buttons
                    this.mouseDownMiddle = false;
                    break;
                case 3:// Right button
                    this.mouseDownLeft = false;
                    this.mouseDownRight = false;
                    break;
                default:
                    break;
            }
            this.#getMouseCanvasPos(e);
            this.events.fire("dblclick", this.mouseCanvasPos, true);
            if (this.mouseover) {
                e.preventDefault();
            }
        });

        this.element.addEventListener("mousemove", this.#mouseMoveListener = (e) => {
            if (!this.enabled) {
                return;
            }
            this.#getMouseCanvasPos(e);
            this.events.fire("mousemove", this.mouseCanvasPos, true);
            if (this.mouseover) {
                e.preventDefault();
            }
        });

        this.element.addEventListener("wheel", this.#mouseWheelListener = (e) => {
            if (!this.enabled) {
                return;
            }
            const delta = Math.max(-1, Math.min(1, -e.deltaY * 40));
            this.events.fire("mousewheel", delta, true);
        }, {passive: true});

        // mouseclicked

        {
            let downX:number;
            let downY:number;
            // Tolerance between down and up positions for a mouse click
            const tolerance = 2;
            this.events.on("mousedown", (params:any) => {
                downX = params[0];
                downY = params[1];
            });
            this.events.on("mouseup", (params:any) => {
                if (downX >= (params[0] - tolerance) &&
                    downX <= (params[0] + tolerance) &&
                    downY >= (params[1] - tolerance) &&
                    downY <= (params[1] + tolerance)) {
                    this.events.fire("mouseclicked", params, true);
                }
            });


        }
        this.#eventsBound = true;
    }

    #unbindEvents() {
        if (!this.#eventsBound) {
            return;
        }
        document.removeEventListener("keydown", this.#keyDownListener);
        document.removeEventListener("keyup", this.#keyUpListener);
        this.element.removeEventListener("mouseenter", this.#mouseEnterListener);
        this.element.removeEventListener("mouseleave", this.#mouseLeaveListener);
        this.element.removeEventListener("mousedown", this.#mouseDownListener);
        document.removeEventListener("mouseup", this.#mouseDownListener);
        document.removeEventListener("click", this.#clickListener);
        document.removeEventListener("dblclick", this.#dblClickListener);
        this.element.removeEventListener("mousemove", this.#mouseMoveListener);
        this.element.removeEventListener("wheel", this.#mouseWheelListener);
        this.#eventsBound = false;
    }

    #getMouseCanvasPos(event: any) {
        if (!event) {
            event = window.event;
            this.mouseCanvasPos[0] = event.x;
            this.mouseCanvasPos[1] = event.y;
        } else {
            let element = event.target;
            let totalOffsetLeft = 0;
            let totalOffsetTop = 0;
            while (element.offsetParent) {
                totalOffsetLeft += element.offsetLeft;
                totalOffsetTop += element.offsetTop;
                element = element.offsetParent;
            }
            this.mouseCanvasPos[0] = event.pageX - totalOffsetLeft;
            this.mouseCanvasPos[1] = event.pageY - totalOffsetTop;
        }
    }

    /**
     * Sets whether input handlers are enabled.
     *
     * Default value is ````true````.
     */
    setEnabled(enable: boolean) {
        if (this.enabled !== enable) {
            this.events.fire("enabled", this.enabled = enable);
        }
    }

    /**
     * Gets whether input handlers are enabled.
     *
     * Default value is ````true````.
     */
    getEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Sets whether or not keyboard input is enabled.
     *
     * Default value is ````true````.
     */
    setKeyboardEnabled(value: boolean) {
        this.keyboardEnabled = value;
    }

    /**
     * Gets whether keyboard input is enabled.
     *
     * Default value is ````true````.
     */
    getKeyboardEnabled(): boolean {
        return this.keyboardEnabled;
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
        this.#unbindEvents();
    }
}

export {Input};
