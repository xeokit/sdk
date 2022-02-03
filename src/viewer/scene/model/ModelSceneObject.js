import Events from "events";
import {Component} from "../../Component";
import {OBJECT_FLAGS} from "../webgl/OBJECT_FLAGS";

/**
 * @desc A scene object within a {@link Model}.
 * @implements {SceneObject}
 */
class ModelSceneObject extends Component {

    /**
     * @constructor
     * @private
     */
    constructor(model, metaObject, modelMeshes, cfg = {}) {

        super(model, cfg);

        /**
         * Unique ID of this ModelSceneObject.
         * @property id
         * @final
         * @type {String}
         */
        this.id = metaObject.id;

        /**
         * The Model to which this ModelSceneObject belongs.
         *
         * @property model
         * @final
         * @type {Model}
         */
        this.model = model;

        /**
         * The corresponding {@link MetaObject}.
         *
         * @property metaObject
         * @final
         * @type {MetaObject}
         */
        this.metaObject = metaObject;

        /**
         * Manages events on this ModelSceneObject.
         * @property events
         * @final
         * @type {Events}
         */
        this.events = new Events();

        this._viewFlags = []; // Render flags for each View

        this._modelMeshes = modelMeshes;
    }

    /**
     * @private
     */
    setVisible(viewIndex, visible) {
        let flags = this._viewFlags[viewIndex];
        if (flags === undefined || flags === null || !!(flags & OBJECT_FLAGS.VISIBLE) === visible) {
            return; // Redundant update
        }
        if (visible) {
            flags = flags | OBJECT_FLAGS.VISIBLE;
        } else {
            flags = flags & ~OBJECT_FLAGS.VISIBLE;
        }
        for (let i = 0, len = this._modelMeshes.length; i < len; i++) {
            this._modelMeshes[i].setVisible(viewIndex, flags);
        }
        this._viewFlags[viewIndex] = flags;
    }

    /**
     * @private
     */
    setCulled(viewIndex, culled) {
    }

    /**
     * @private
     */
    setHighlighted(viewIndex, highlighted) {
    }

    /**
     * @private
     */
    setSelected(viewIndex, selected) {
    }

    /**
     * @private
     */
    setXRayed(viewIndex, xrayed) {
    }

    /**
     * @private
     */
    _setPickable(viewIndex, pickable) {
    }

    /**
     * @private
     */
    _setClippable(viewIndex, clippable) {
    }

    /**
     * @private
     */
    _setColorize(viewIndex, value) {
    }

    /**
     * @private
     */
    _setOpacity(viewIndex, opacity) {
    }

    /**
     * Destroys this ModelSceneObject.
     */
    destroy() {
        super.destroy();
    }
}

export {ModelSceneObject};