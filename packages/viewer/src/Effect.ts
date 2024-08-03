import {Component} from "@xeokit/core";
import type {Viewer} from "./Viewer";

/**
 * TODO
 */
export class Effect extends Component {

    #viewer: Viewer;

    /**
     * @private
     */
    constructor(options: {
        id: string;
        viewer: Viewer;
    }) {
        super(null, options);
        this.#viewer = options.viewer;
    }
}
