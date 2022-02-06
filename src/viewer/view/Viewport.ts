import {Component} from '../Component';
import {View} from "./View";
import {Canvas} from "./Canvas";

/**
 * Controls the canvas viewport for a {@link View}.
 */
class Viewport extends Component {

    /**
     * The View to which this Viewport belongs.
     */
    public readonly view: View;

    readonly #state: { boundary: number[] };
    #autoBoundary: boolean;
    #onCanvasSize: any;

    /**
     @private
     */
    constructor(view:View, cfg: any) {
        super(view, cfg);
        this.view = view;
        this.#state = {
            boundary: [0, 0, 100, 100]
        };
        this.boundary = [0, 0, 100, 100];
        this.autoBoundary = true;
    }

    /**
     * Sets the canvas-space boundary of this Viewport, indicated as ````[min, max, width, height]````.
     *
     * When {@link Viewport.autoBoundary} is ````true````, ignores calls to this method and automatically synchronizes with {@link Canvas.boundary}.
     *
     * Fires a "boundary"" event on change.
     *
     * Defaults to the {@link Canvas} extents.
     *
     * @param value New Viewport extents.
     */
    set boundary(value: number[]) {
        if (this.#autoBoundary) {
            return;
        }
        if (!value) {
            const canvasBoundary = this.view.canvas.boundary;
            const width = canvasBoundary[2];
            const height = canvasBoundary[3];
            value = [0, 0, width, height];
        }
        this.#state.boundary = value;
        this.view.redraw();
        this.events.fire("boundary", this.#state.boundary);
    }

    /**
     * Gets the canvas-space boundary of this Viewport, indicated as ````[min, max, width, height]````.
     *
     * @returns {Number[]} The Viewport extents.
     */
    get boundary(): number[] {
        return this.#state.boundary;
    }

    /**
     * Sets if {@link Viewport.boundary} automatically synchronizes with {@link Canvas.boundary}.
     *
     * Default is ````false````.
     *
     * @param value Set true to automatically synchronize.
     */
    set autoBoundary(value: boolean) {
        value = !!value;
        if (value === this.#autoBoundary) {
            return;
        }
        this.#autoBoundary = value;
        if (this.#autoBoundary) {
            this.#onCanvasSize = this.view.canvas.events.on("boundary", (boundary) => {
                const width = boundary[2];
                const height = boundary[3];
                this.#state.boundary = [0, 0, width, height];
                this.view.redraw();
                this.events.fire("boundary", this.#state.boundary);
            });
        } else if (this.#onCanvasSize) {
            this.view.canvas.events.off(this.#onCanvasSize);
            this.#onCanvasSize = null;
        }
    }

    /**
     * Gets if {@link Viewport.boundary} automatically synchronizes with {@link Canvas.boundary}.
     *
     * Default is ````false````.
     *
     * @returns {Boolean} Returns ````true```` when automatically sycnhronizing.
     */
    get autoBoundary(): boolean {
        return this.#autoBoundary;
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
    }
}

export {Viewport};