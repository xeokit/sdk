/**
 *
 * @interface
 */
class RenderLayer {

    constructor (model, cfg) {
    }

    createPortion(cfg) {
        return 0;
    }

    setVisible(portionId, flags) {
    }

    setHighlighted(portionId, flags) {
    }

    setXRayed(portionId, flags) {
    }

    setSelected(portionId, flags) {
    }

    setEdges(portionId, flags) {
    }

    setClippable(portionId, flags) {
    }

    setCollidable(portionId, flags) {
    }

    setPickable(portionId, flags) {
    }

    setCulled(portionId, flags) {
    }

    setColor(portionId, color) { // RGBA color is normalized as ints
    }

    setTransparent(portionId, flags) {
    }

    finalize() {

    }
}