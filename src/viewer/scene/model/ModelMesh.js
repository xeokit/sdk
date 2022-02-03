/**
 * @private
 */
class ModelMesh {

    constructor(modelRenderLayer, portionId, cfg = {}) {
       this._modelRenderLayer = modelRenderLayer;
       this._portionId = portionId;
    }

    setVisible(viewIndex, flags) {
        this._modelRenderLayer.setVisible(this._portionId, viewIndex, flags);
    }

    setCulled(viewIndex, flags) {
        this._modelRenderLayer.setCulled(this._portionId, viewIndex, flags);
    }

    setHighlighted(viewIndex, flags) {
        this._modelRenderLayer.setHighlighted(this._portionId, viewIndex, flags);
    }

    setSelected(viewIndex, flags) {
        this._modelRenderLayer.setSelected(this._portionId, viewIndex, flags);
    }

    setXRayed(viewIndex, flags) {
        this._modelRenderLayer.setXRayed(this._portionId, viewIndex, flags);
    }

    setPickable(viewIndex, flags) {
        this._modelRenderLayer.setPickable(this._portionId, viewIndex, flags);
    }

    setClippable(viewIndex, flags) {
        this._modelRenderLayer.setClippable(this._portionId, viewIndex, flags);
    }

    setColorize(viewIndex, flags) {
    }

    setOpacity(viewIndex, flags) {
    }
}

export {ModelMesh};