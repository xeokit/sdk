var utils = require('@xeokit/utils');
var core = require('@xeokit/core');
var stronglyTypedEvents = require('strongly-typed-events');
var scene = require('@xeokit/scene');
var constants = require('@xeokit/constants');
var matrix = require('@xeokit/matrix');
var math = require('@xeokit/math');
var boundaries = require('@xeokit/boundaries');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return n;
}

var matrix__namespace = /*#__PURE__*/_interopNamespace(matrix);

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
  }
}
function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}
function _inheritsLoose(subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  _setPrototypeOf(subClass, superClass);
}
function _setPrototypeOf(o, p) {
  _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
    o.__proto__ = p;
    return o;
  };
  return _setPrototypeOf(o, p);
}
function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return self;
}
function _toPrimitive(input, hint) {
  if (typeof input !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default");
    if (typeof res !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return typeof key === "symbol" ? key : String(key);
}
var id = 0;
function _classPrivateFieldLooseKey(name) {
  return "__private_" + id++ + "_" + name;
}
function _classPrivateFieldLooseBase(receiver, privateKey) {
  if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) {
    throw new TypeError("attempted to use private field on non-instance");
  }
  return receiver;
}

var _rendererViewObject = /*#__PURE__*/_classPrivateFieldLooseKey("rendererViewObject");
var _state$e = /*#__PURE__*/_classPrivateFieldLooseKey("state");
/**
 * Represents and controls the visual state of a {@link @xeokit/scene!SceneModel | SceneObject} in
 * a {@link @xeokit/viewer!View |View's} canvas.
 *
 * ## Summary
 *
 * * Stored in {@link View.objects | View.objects} and {@link ViewLayer.objects | ViewLayer.objects}
 * * Viewer automatically creates one of these in each existing {@link @xeokit/viewer!View} for each {@link @xeokit/scene!SceneModel | SceneObject} created
 * * {@link SceneObject.layerId | SceneObject.layerId} determines which of the View's {@link ViewLayer | ViewLayers} to put the ViewObject in
 *
 * ## Overview
 *
 * Every View automatically maintains within itself a ViewObject for each {@link @xeokit/scene!SceneModel | SceneObject} that exists in the {@link @xeokit/viewer!Viewer}.
 *
 * Whenever we create a SceneObject, each View will automatically create a corresponding ViewObject within itself. When
 * we destroy a SceneObject, each View will automatically destroy its corresponding ViewObject. The ViewObjects in a View
 * are therefore a manifest of the ViewerObjects in the View.
 *
 * {@link ViewLayer}.
 */
var ViewObject = /*#__PURE__*/function () {
  /**
   * @private
   */
  function ViewObject(layer, sceneObject, rendererViewObject) {
    /**
     * Unique ID of this ViewObject within {@link ViewLayer.objects}.
     */
    this.id = void 0;
    /**
     * The ViewLayer to which this ViewObject belongs.
     */
    this.layer = void 0;
    /**
     * The corresponding {@link SceneObject}.
     */
    this.sceneObject = void 0;
    /**
     * The corresponding {@link RendererViewObject}.
     * @internal
     */
    Object.defineProperty(this, _rendererViewObject, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _state$e, {
      writable: true,
      value: void 0
    });
    this.id = sceneObject.id;
    this.layer = layer;
    this.sceneObject = sceneObject;
    _classPrivateFieldLooseBase(this, _rendererViewObject)[_rendererViewObject] = rendererViewObject;
    _classPrivateFieldLooseBase(this, _state$e)[_state$e] = {
      visible: true,
      culled: false,
      pickable: true,
      clippable: true,
      collidable: true,
      xrayed: false,
      selected: false,
      highlighted: false,
      edges: false,
      colorize: new Float32Array(4),
      colorized: false,
      opacityUpdated: false
    };
    _classPrivateFieldLooseBase(this, _rendererViewObject)[_rendererViewObject].setVisible(this.layer.view.viewIndex, _classPrivateFieldLooseBase(this, _state$e)[_state$e].visible);
    this.layer.objectVisibilityUpdated(this, _classPrivateFieldLooseBase(this, _state$e)[_state$e].visible, true);
  }
  /**
   * Gets the World-space axis-aligned 3D boundary of this ViewObject.
   */
  var _proto = ViewObject.prototype;
  /**
   * @private
   */
  _proto._destroy = function _destroy() {
    // Called by ViewLayer#destroyViewObjects
    if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].visible) {
      this.layer.objectVisibilityUpdated(this, false, false);
    }
    if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].xrayed) {
      this.layer.objectXRayedUpdated(this, false);
    }
    if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].selected) {
      this.layer.objectSelectedUpdated(this, false);
    }
    if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].highlighted) {
      this.layer.objectHighlightedUpdated(this, false);
    }
    if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].colorized) {
      this.layer.objectColorizeUpdated(this, false);
    }
    if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].opacityUpdated) {
      this.layer.objectOpacityUpdated(this, false);
    }
    this.layer.redraw();
  };
  _createClass(ViewObject, [{
    key: "aabb",
    get: function get() {
      return this.sceneObject.aabb;
    }
    /**
     * Gets if this ViewObject is visible.
     *
     * * When {@link ViewObject.visible} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
  }, {
    key: "visible",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].visible;
    }
    /**
     * Sets if this ViewObject is visible.
     *
     * * When {@link ViewObject.visible} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Fires an "objectVisibility" event on associated {@link ViewLayer}s.
     * * Use {@link ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */,
    set: function set(visible) {
      if (visible === _classPrivateFieldLooseBase(this, _state$e)[_state$e].visible) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].visible = visible;
      _classPrivateFieldLooseBase(this, _rendererViewObject)[_rendererViewObject].setVisible(this.layer.view.viewIndex, visible);
      this.layer.objectVisibilityUpdated(this, visible, true);
      this.layer.redraw();
    }
    /**
     * Gets if this ViewObject is X-rayed.
     *
     * * When {@link ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */
  }, {
    key: "xrayed",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].xrayed;
    }
    /**
     * Sets if this ViewObject is X-rayed.
     *
     * * When {@link ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */,
    set: function set(xrayed) {
      if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].xrayed === xrayed) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].xrayed = xrayed;
      _classPrivateFieldLooseBase(this, _rendererViewObject)[_rendererViewObject].setXRayed(this.layer.view.viewIndex, xrayed);
      this.layer.objectXRayedUpdated(this, xrayed);
      this.layer.redraw();
    }
    /**
     * Gets if this ViewObject shows edges.
     */
  }, {
    key: "edges",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].edges;
    }
    /**
     * Sets if this ViewObject shows edges.
     */,
    set: function set(edges) {
      if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].edges === edges) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].edges = edges;
      _classPrivateFieldLooseBase(this, _rendererViewObject)[_rendererViewObject].setEdges(this.layer.view.viewIndex, edges);
      this.layer.redraw();
    }
    /**
     * Gets if this ViewObject is highlighted.
     *
     * * When {@link ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */
  }, {
    key: "highlighted",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].highlighted;
    }
    /**
     * Sets if this ViewObject is highlighted.
     *
     * * When {@link ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */,
    set: function set(highlighted) {
      if (highlighted === _classPrivateFieldLooseBase(this, _state$e)[_state$e].highlighted) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].highlighted = highlighted;
      _classPrivateFieldLooseBase(this, _rendererViewObject)[_rendererViewObject].setHighlighted(this.layer.view.viewIndex, highlighted);
      this.layer.objectHighlightedUpdated(this, highlighted);
      this.layer.redraw();
    }
    /**
     * Gets if this ViewObject is selected.
     *
     * * When {@link ViewObject.selected} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */
  }, {
    key: "selected",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].selected;
    }
    /**
     * Sets if this ViewObject is selected.
     *
     * * When {@link ViewObject.selected} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */,
    set: function set(selected) {
      if (selected === _classPrivateFieldLooseBase(this, _state$e)[_state$e].selected) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].selected = selected;
      _classPrivateFieldLooseBase(this, _rendererViewObject)[_rendererViewObject].setSelected(this.layer.view.viewIndex, selected);
      this.layer.objectSelectedUpdated(this, selected);
      this.layer.redraw();
    }
    /**
     * Gets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
  }, {
    key: "culled",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].culled;
    }
    /**
     * Sets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */,
    set: function set(culled) {
      if (culled === _classPrivateFieldLooseBase(this, _state$e)[_state$e].culled) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].culled = culled;
      this.layer.redraw();
    }
    /**
     * Gets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane}s in {@link ViewLayer.sectionPlanes}.
     * * Use {@link ViewLayer.setObjectsClippable} to batch-update the clippable state of ViewObjects.
     */
  }, {
    key: "clippable",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].clippable;
    }
    /**
     * Sets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane}s in {@link ViewLayer.sectionPlanes}.
     * * Use {@link ViewLayer.setObjectsClippable} to batch-update the clippable state of ViewObjects.
     */,
    set: function set(value) {
      if (value === _classPrivateFieldLooseBase(this, _state$e)[_state$e].clippable) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].clippable = value;
      this.layer.redraw();
    }
    /**
     * Gets if this ViewObject is included in boundary calculations.
     *
     * * When ````true````, the 3D World boundaries returned by {@link ViewLayer.aabb} will include this ViewObject's boundary.
     * * The ViewObject's 3D boundary is held in {@link SceneObject.aabb}.
     * * Use {@link ViewLayer.setObjectsCollidable} to batch-update the collidable state of ViewObjects.
     */
  }, {
    key: "collidable",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].collidable;
    }
    /**
     * Sets if this ViewObject included in boundary calculations.
     *
     * * When ````true````, the 3D World boundaries returned by {@link ViewLayer.aabb} will include this ViewObject's boundary.
     * * The ViewObject's 3D boundary is held in {@link SceneObject.aabb}.
     * * Use {@link ViewLayer.setObjectsCollidable} to batch-update the collidable state of ViewObjects.
     */,
    set: function set(value) {
      if (value === _classPrivateFieldLooseBase(this, _state$e)[_state$e].collidable) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].collidable = value;
      // this._setAABBDirty();
      // this.layer._aabbDirty = true;
    }
    /**
     * Gets if this ViewObject is pickable.
     *
     * * Picking is done with {@link ViewLayer.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
  }, {
    key: "pickable",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].pickable;
    }
    /**
     * Sets if this ViewObject is pickable.
     *
     * * Picking is done with {@link ViewLayer.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */,
    set: function set(pickable) {
      if (_classPrivateFieldLooseBase(this, _state$e)[_state$e].pickable === pickable) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].pickable = pickable;
      // No need to trigger a render;
      // state is only used when picking
    }
    /**
     * Gets the RGB colorize color for this ViewObject.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Use {@link ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */
  }, {
    key: "colorize",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].colorize;
    }
    /**
     * Sets the RGB colorize color for this ViewObject.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Set to ````null```` or ````undefined```` to reset the colorize color to its default value of ````[1,1,1]````.
     * * Use {@link ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */,
    set: function set(value) {
      var colorize = _classPrivateFieldLooseBase(this, _state$e)[_state$e].colorize;
      if (value) {
        colorize[0] = value[0];
        colorize[1] = value[1];
        colorize[2] = value[2];
      } else {
        colorize[0] = 1;
        colorize[1] = 1;
        colorize[2] = 1;
      }
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].colorized = !!value;
      this.layer.objectColorizeUpdated(this, _classPrivateFieldLooseBase(this, _state$e)[_state$e].colorized);
      this.layer.redraw();
    }
    /**
     * Gets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Use {@link ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
  }, {
    key: "opacity",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$e)[_state$e].colorize[3];
    }
    /**
     * Sets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Set to ````null```` or ````undefined```` to reset the opacity to its default value of ````1````.
     * * Use {@link ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */,
    set: function set(opacity) {
      var colorize = _classPrivateFieldLooseBase(this, _state$e)[_state$e].colorize;
      _classPrivateFieldLooseBase(this, _state$e)[_state$e].opacityUpdated = opacity !== null && opacity !== undefined;
      // @ts-ignore
      colorize[3] = _classPrivateFieldLooseBase(this, _state$e)[_state$e].opacityUpdated ? opacity : 1.0;
      this.layer.objectOpacityUpdated(this, _classPrivateFieldLooseBase(this, _state$e)[_state$e].opacityUpdated);
      this.layer.redraw();
    }
  }]);
  return ViewObject;
}();

/**
 *  An arbitrarily-aligned World-space clipping plane.
 *
 * ## Summary
 *
 * * Belongs to a {@link @xeokit/viewer!View}.
 * * Slices portions off {@link ViewObject | ViewObjects} to create cross-section views or reveal interiors.
 * * Registered by {@link SectionPlane.id} in {@link View.sectionPlanes}.
 * * Indicates its World-space position in {@link SectionPlane.pos} and orientation vector in {@link SectionPlane.dir}.
 * * Discards elements from the half-space in the direction of {@link SectionPlane.dir}.
 * * Can be be enabled or disabled via {@link SectionPlane.active}.
 *
 * ## Usage
 *
 * In the example below, we'll create two SectionPlanes to slice a model loaded from glTF. Note that we could also create them
 * using a {@link SectionPlanesPlugin}.
 *
 * ````javascript
 * import {Viewer, GLTFLoaderPlugin, SectionPlane} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
 *      canvasId: "myCanvas"
 * });
 *
 * const gltfLoaderPlugin = new GLTFModelsPlugin(viewer, {
 *      id: "GLTFModels"
 * });
 *
 * const model = gltfLoaderPlugin.load({
 *      id: "myModel",
 *      src: "./models/gltf/mygltfmodel.gltf"
 * });
 *
 * // Create a SectionPlane on negative diagonal
 * const sectionPlane1 = new SectionPlane(viewer.scene, {
 *     pos: [1.0, 1.0, 1.0],
 *     dir: [-1.0, -1.0, -1.0],
 *     active: true
 * }),
 *
 * // Create a SectionPlane on positive diagonal
 * const sectionPlane2 = new SectionPlane(viewer.scene, {
 *     pos: [-1.0, -1.0, -1.0],
 *     dir: [1.0, 1.0, 1.0],
 *     active: true
 * });
 * ````
 */
var _state$d = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var SectionPlane = /*#__PURE__*/function (_Component) {
  _inheritsLoose(SectionPlane, _Component);
  /**
   * @private
   * @constructor
   */
  function SectionPlane(view, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, view, cfg) || this;
    /**
     * The View to which this DirLight belongs.
     *
     * @property view
     * @type {View}
     * @final
     */
    _this.view = void 0;
    /**
     * Emits an event each time {@link SectionPlane.pos} changes.
     *
     * @event
     */
    _this.onPos = void 0;
    /**
     * Emits an event each time {@link SectionPlane.dir} changes.
     *
     * @event
     */
    _this.onDir = void 0;
    /**
     * Emits an event each time {@link SectionPlane.active} changes.
     *
     * @event
     */
    _this.onActive = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$d, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$d)[_state$d] = {
      active: cfg.active !== false,
      pos: new Float64Array(cfg.pos || [0, 0, 0]),
      dir: new Float32Array(cfg.pos || [0, 0, -1]),
      dist: 0
    };
    _this.onPos = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onDir = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onActive = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    return _this;
  }
  /**
   * Gets if this SectionPlane is active or not.
   *
   * Default value is ````true````.
   *
   * @returns Returns ````true```` if active.
   */
  var _proto = SectionPlane.prototype;
  /**
   * Inverts the direction of {@link SectionPlane.dir}.
   */
  _proto.flipDir = function flipDir() {
    var dir = _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir;
    dir[0] *= -1.0;
    dir[1] *= -1.0;
    dir[2] *= -1.0;
    _classPrivateFieldLooseBase(this, _state$d)[_state$d].dist = -matrix__namespace.dotVec3(_classPrivateFieldLooseBase(this, _state$d)[_state$d].pos, _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir);
    this.onDir.dispatch(this, _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir);
    this.view.redraw();
  }
  /**
   * Destroys this SectionPlane.
   */;
  _proto.destroy = function destroy() {
    this.onPos.clear();
    this.onDir.clear();
    _Component.prototype.destroy.call(this);
  };
  _createClass(SectionPlane, [{
    key: "active",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$d)[_state$d].active;
    }
    /**
     * Sets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @param value Set ````true```` to activate else ````false```` to deactivate.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$d)[_state$d].active === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$d)[_state$d].active = value;
      this.view.redraw();
      this.onActive.dispatch(this, _classPrivateFieldLooseBase(this, _state$d)[_state$d].active);
    }
    /**
     * Gets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @returns  Current position.
     */
  }, {
    key: "pos",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$d)[_state$d].pos;
    }
    /**
     * Sets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @param value New position.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$d)[_state$d].pos.set(value);
      _classPrivateFieldLooseBase(this, _state$d)[_state$d].dist = -matrix__namespace.dotVec3(_classPrivateFieldLooseBase(this, _state$d)[_state$d].pos, _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir);
      this.onPos.dispatch(this, _classPrivateFieldLooseBase(this, _state$d)[_state$d].pos);
    }
    /**
     * Gets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @returns value Current direction.
     */
  }, {
    key: "dir",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir;
    }
    /**
     * Sets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @param value New direction.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir.set(value);
      _classPrivateFieldLooseBase(this, _state$d)[_state$d].dist = -matrix__namespace.dotVec3(_classPrivateFieldLooseBase(this, _state$d)[_state$d].pos, _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir);
      this.view.redraw();
      this.onDir.dispatch(this, _classPrivateFieldLooseBase(this, _state$d)[_state$d].dir);
    }
    /**
     * Gets this SectionPlane's distance to the origin of the World-space coordinate system.
     *
     * This is the dot product of {@link SectionPlane.pos} and {@link SectionPlane.dir} and is automatically re-calculated
     * each time either of two properties are updated.
     *
     * @returns Distance to the origin of the World-space coordinate system.
     */
  }, {
    key: "dist",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$d)[_state$d].dist;
    }
  }]);
  return SectionPlane;
}(core.Component);

var _unitsInfo;
var unitsInfo = (_unitsInfo = {}, _unitsInfo[constants.MetersUnit] = {
  abbrev: "m"
}, _unitsInfo[constants.CentimetersUnit] = {
  abbrev: "cm"
}, _unitsInfo[constants.MillimetersUnit] = {
  abbrev: "mm"
}, _unitsInfo[constants.YardsUnit] = {
  abbrev: "yd"
}, _unitsInfo[constants.FeetUnit] = {
  abbrev: "ft"
}, _unitsInfo[constants.InchesUnit] = {
  abbrev: "in"
}, _unitsInfo);
/**
 * Configures its {@link @xeokit/viewer!View}'s measurement unit and mapping between the Real-space and World-space 3D Cartesian coordinate systems.
 *
 *
 * ## Summary
 *
 * * Located at {@link View.metrics}.
 * * {@link Metrics.units} configures the Real-space unit type, which is {@link MetersUnit} by default.
 * * {@link Metrics.scale} configures the number of Real-space units represented by each unit within the World-space 3D coordinate system. This is ````1.0```` by default.
 * * {@link Metrics.origin} configures the 3D Real-space origin, in current Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin sits, This is ````[0,0,0]```` by default.
 *
 * ## Usage
 *
 * ````JavaScript
 * import {Viewer, constants} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer();
 *
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myCanvas1"
 * });
 *
 * const metrics = view1.metrics;
 *
 * metrics.units = MetersUnit;
 * metrics.scale = 10.0;
 * metrics.origin = [100.0, 0.0, 200.0];
 * ````
 */
var _units = /*#__PURE__*/_classPrivateFieldLooseKey("units");
var _scale = /*#__PURE__*/_classPrivateFieldLooseKey("scale");
var _origin$1 = /*#__PURE__*/_classPrivateFieldLooseKey("origin");
var Metrics = /*#__PURE__*/function (_Component) {
  _inheritsLoose(Metrics, _Component);
  /**
   * @private
   */
  function Metrics(view, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {
        units: constants.MetersUnit,
        scale: 1.0,
        origin: [1, 1, 1]
      };
    }
    _this = _Component.call(this, view, cfg) || this;
    Object.defineProperty(_assertThisInitialized(_this), _units, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _scale, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _origin$1, {
      writable: true,
      value: void 0
    });
    /**
     * Emits an event each time {@link Metrics.units} changes.
     *
     * @event
     */
    _this.onUnits = void 0;
    /**
     * Emits an event each time {@link Metrics.scale} changes.
     *
     * @event
     */
    _this.onScale = void 0;
    /**
     * Emits an event each time {@link Metrics.origin} changes.
     *
     * @event
     */
    _this.onOrigin = void 0;
    _this.onUnits = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onScale = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onOrigin = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _units)[_units] = constants.MetersUnit;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _scale)[_scale] = 1.0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _origin$1)[_origin$1] = matrix.createVec3([0, 0, 0]);
    _this.units = cfg.units;
    _this.scale = cfg.scale;
    _this.origin = cfg.origin;
    return _this;
  }
  /**
   * Gets info about the supported Real-space unit types.
   *
   * With {@link constants} indicating each unit type, the info will be:
   *
   * ````javascript
   * {
   *     [MetersUnit]: {
   *         abbrev: "m"
   *     },
   *     [CentimetersUnit]: {
   *         abbrev: "cm"
   *     },
   *     [MillimetersUnit]: {
   *         abbrev: "mm"
   *     },
   *     [YardsUnit]: {
   *         abbrev: "yd"
   *     },
   *     [FeetUnit]: {
   *         abbrev: "ft"
   *     },
   *     [InchesUnit]: {
   *         abbrev: "in"
   *     }
   * }
   * ````
   *
   * @type {*}
   */
  var _proto = Metrics.prototype;
  /**
   * Converts a 3D position from World-space to Real-space.
   *
   * This is equivalent to ````realPos = #origin + (worldPos * #scale)````.
   *
   * @param worldPos World-space 3D position, in World coordinate system units.
   * @param [realPos] Destination for Real-space 3D position.
   * @returns  Real-space 3D position, in units indicated by {@link Metrics#units}.
   */
  _proto.worldToRealPos = function worldToRealPos(worldPos, realPos) {
    if (realPos === void 0) {
      realPos = matrix.createVec3();
    }
    realPos[0] = _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][0] + _classPrivateFieldLooseBase(this, _scale)[_scale] * worldPos[0];
    realPos[1] = _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][1] + _classPrivateFieldLooseBase(this, _scale)[_scale] * worldPos[1];
    realPos[2] = _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][2] + _classPrivateFieldLooseBase(this, _scale)[_scale] * worldPos[2];
    return realPos;
  }
  /**
   * Converts a 3D position from Real-space to World-space.
   *
   * This is equivalent to ````worldPos = (worldPos - #origin) / #scale````.
   *
   * @param realPos Real-space 3D position.
   * @param [worldPos] Destination for World-space 3D position.
   * @returns  World-space 3D position.
   */;
  _proto.realToWorldPos = function realToWorldPos(realPos, worldPos) {
    if (worldPos === void 0) {
      worldPos = matrix.createVec3();
    }
    worldPos[0] = (realPos[0] - _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][0]) / _classPrivateFieldLooseBase(this, _scale)[_scale];
    worldPos[1] = (realPos[1] - _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][1]) / _classPrivateFieldLooseBase(this, _scale)[_scale];
    worldPos[2] = (realPos[2] - _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][2]) / _classPrivateFieldLooseBase(this, _scale)[_scale];
    return worldPos;
  }
  /**
   * @private
   */;
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.onUnits.clear();
    this.onScale.clear();
    this.onOrigin.clear();
  };
  _createClass(Metrics, [{
    key: "unitsInfo",
    get: function get() {
      return unitsInfo;
    }
    /**
     * Gets the {@link @xeokit/viewer!View}'s Real-space unit type.
     */
  }, {
    key: "units",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _units)[_units];
    }
    /**
     * Sets the {@link @xeokit/viewer!View}'s Real-space unit type.
     *
     * Accepted values are {@link MetersUnit}, {@link CentimetersUnit}, {@link MillimetersUnit}, {@link YardsUnit}, {@link FeetUnit} and {@link InchesUnit}.
     */,
    set: function set(value) {
      if (!value) {
        value = constants.MetersUnit;
      }
      // @ts-ignore
      var info = unitsInfo[value];
      if (!info) {
        this.error("Unsupported value for 'units': " + value + " defaulting to MetersUnit");
        value = constants.MetersUnit;
      }
      _classPrivateFieldLooseBase(this, _units)[_units] = value;
      this.onUnits.dispatch(this, _classPrivateFieldLooseBase(this, _units)[_units]);
    }
    /**
     * Gets the number of Real-space units represented by each unit of the {@link @xeokit/viewer!View}'s World-space coordinate system.
     */
  }, {
    key: "scale",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _scale)[_scale];
    }
    /**
     * Sets the number of Real-space units represented by each unit of the {@link @xeokit/viewer!View}'s World-space coordinate system.
     *
     * For example, if {@link Metrics.units} is {@link MetersUnit}, and there are ten meters per World-space coordinate system unit, then ````scale```` would have a value of ````10.0````.
     */,
    set: function set(value) {
      value = value || 1;
      if (value <= 0) {
        this.error("scale value should be larger than zero");
        return;
      }
      _classPrivateFieldLooseBase(this, _scale)[_scale] = value;
      this.onScale.dispatch(this, _classPrivateFieldLooseBase(this, _scale)[_scale]);
    }
    /**
     * Gets the 3D Real-space origin, in Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */
  }, {
    key: "origin",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _origin$1)[_origin$1];
    }
    /**
     * Sets the Real-space 3D origin, in Real-space units, at which this {@link @xeokit/viewer!View}'s World-space coordinate origin ````[0,0,0]```` sits.
     */,
    set: function set(value) {
      if (!value) {
        _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][0] = 0;
        _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][1] = 0;
        _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][2] = 0;
        return;
      }
      _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][0] = value[0];
      _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][1] = value[1];
      _classPrivateFieldLooseBase(this, _origin$1)[_origin$1][2] = value[2];
      this.onOrigin.dispatch(this, _classPrivateFieldLooseBase(this, _origin$1)[_origin$1]);
    }
  }]);
  return Metrics;
}(core.Component);

/**
 * Configures Scalable Ambient Obscurance (SAO) for a {@link @xeokit/viewer!View}.
 */
var _state$c = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var SAO = /*#__PURE__*/function (_Component) {
  _inheritsLoose(SAO, _Component);
  /** @private */
  function SAO(view, params) {
    var _this;
    _this = _Component.call(this, view, params) || this;
    /**
     * The View to which this SAO belongs.
     */
    _this.view = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$c, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$c)[_state$c] = {
      renderModes: [constants.QualityRender],
      enabled: params.enabled !== false,
      kernelRadius: params.kernelRadius || 100.0,
      intensity: params.intensity !== undefined ? params.intensity : 0.15,
      bias: params.bias !== undefined ? params.bias : 0.5,
      scale: params.scale !== undefined ? params.scale : 1.0,
      minResolution: params.minResolution !== undefined ? params.minResolution : 0.0,
      numSamples: params.numSamples !== undefined ? params.numSamples : 10,
      blur: !!params.blur,
      blendCutoff: params.blendCutff !== undefined ? params.blendCutoff : 0.3,
      blendFactor: params.blendFactor !== undefined ? params.blendFactor : 1.0
    };
    return _this;
  }
  /**
   * Gets which rendering modes in which to render SAO.
   *
   * Accepted modes are {@link QualityRender} and {@link FastRender}.
   *
   * Default value is [{@link QualityRender}].
   */
  var _proto = SAO.prototype;
  /**
   * @private
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
  };
  _createClass(SAO, [{
    key: "renderModes",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].renderModes;
    }
    /**
     * Sets which rendering modes in which to render SAO.
     *
     * Accepted modes are {@link QualityRender} and {@link FastRender}.
     *
     * Default value is [{@link QualityRender}].
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].renderModes = value;
      this.view.redraw();
    }
    /**
     * Gets whether or not SAO is supported by this browser and GPU.
     *
     * Even when enabled, SAO will only work if supported.
     */
  }, {
    key: "supported",
    get: function get() {
      return this.view.viewer.renderer.getSAOSupported();
    }
    /**
     * Gets whether SAO is enabled for the {@link @xeokit/viewer!View}.
     *
     * Even when enabled, SAO will only apply if supported.
     *
     * Default value is ````false````.
     */
  }, {
    key: "enabled",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].enabled;
    }
    /**
     * Sets whether SAO is enabled for the {@link @xeokit/viewer!View}.
     *
     * Even when enabled, SAO will only work if supported.
     *
     * Default value is ````false````.
     */,
    set: function set(value) {
      value = !!value;
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].enabled === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].enabled = value;
      this.view.redraw();
    }
    /**
     * Returns true if SAO is currently possible, where it is supported, enabled, and the current view state is compatible.
     * Called internally by renderer logic.
     * @private
     */
  }, {
    key: "possible",
    get: function get() {
      if (!this.supported) {
        return false;
      }
      if (!_classPrivateFieldLooseBase(this, _state$c)[_state$c].enabled) {
        return false;
      }
      var projectionType = this.view.camera.projectionType;
      if (projectionType === constants.CustomProjectionType) {
        return false;
      }
      if (projectionType === constants.FrustumProjectionType) {
        return false;
      }
      return true;
    }
    /**
     * Gets the maximum area that SAO takes into account when checking for possible occlusion for each fragment.
     *
     * Default value is ````100.0````.
     */
  }, {
    key: "kernelRadius",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].kernelRadius;
    }
    /**
     * Sets the maximum area that SAO takes into account when checking for possible occlusion for each fragment.
     *
     * Default value is ````100.0````.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 100.0;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].kernelRadius === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].kernelRadius = value;
      this.view.redraw();
    }
    /**
     * Gets the degree of darkening (ambient obscurance) produced by the SAO effect.
     *
     * Default value is ````0.15````.
     */
  }, {
    key: "intensity",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].intensity;
    }
    /**
     * Sets the degree of darkening (ambient obscurance) produced by the SAO effect.
     *
     * Default value is ````0.15````.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 0.15;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].intensity === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].intensity = value;
      this.view.redraw();
    }
    /**
     * Gets the SAO bias.
     *
     * Default value is ````0.5````.
     */
  }, {
    key: "bias",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].bias;
    }
    /**
     * Sets the SAO bias.
     *
     * Default value is ````0.5````.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 0.5;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].bias === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].bias = value;
      this.view.redraw();
    }
    /**
     * Gets the SAO occlusion scale.
     *
     * Default value is ````1.0````.
     */
  }, {
    key: "scale",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].scale;
    }
    /**
     * Sets the SAO occlusion scale.
     *
     * Default value is ````1.0````.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 1.0;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].scale === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].scale = value;
      this.view.redraw();
    }
    /**
     * Gets the SAO minimum resolution.
     *
     * Default value is ````0.0````.
     */
  }, {
    key: "minResolution",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].minResolution;
    }
    /**
     * Sets the SAO minimum resolution.
     *
     * Default value is ````0.0````.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 0.0;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].minResolution === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].minResolution = value;
      this.view.redraw();
    }
    /**
     * Gets the number of SAO samples.
     *
     * Default value is ````10````.
     */
  }, {
    key: "numSamples",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].numSamples;
    }
    /**
     * Sets the number of SAO samples.
     *
     * Default value is ````10````.
     *
     * Update this sparingly, since it causes a shader recompile.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 10;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].numSamples === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].numSamples = value;
      this.view.redraw();
    }
    /**
     * Gets whether Guassian blur is enabled.
     *
     * Default value is ````true````.
     */
  }, {
    key: "blur",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].blur;
    }
    /**
     * Sets whether Guassian blur is enabled.
     *
     * Default value is ````true````.
     */,
    set: function set(value) {
      value = value !== false;
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].blur === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].blur = value;
      this.view.redraw();
    }
    /**
     * Gets the SAO blend cutoff.
     *
     * Default value is ````0.3````.
     *
     * Normally you don't need to alter this.
     */
  }, {
    key: "blendCutoff",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].blendCutoff;
    }
    /**
     * Sets the SAO blend cutoff.
     *
     * Default value is ````0.3````.
     *
     * Normally you don't need to alter this.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 0.3;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].blendCutoff === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].blendCutoff = value;
      this.view.redraw();
    }
    /**
     * Gets the SAO blend scale.
     *
     * Default value is ````1.0````.
     *
     * Normally you don't need to alter this.
     */
  }, {
    key: "blendFactor",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$c)[_state$c].blendFactor;
    }
    /**
     * Sets the SAO blend factor.
     *
     * Default value is ````1.0````.
     *
     * Normally you don't need to alter this.
     */,
    set: function set(value) {
      if (value === undefined || value === null) {
        value = 1.0;
      }
      if (_classPrivateFieldLooseBase(this, _state$c)[_state$c].blendFactor === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$c)[_state$c].blendFactor = value;
      this.view.redraw();
    }
  }]);
  return SAO;
}(core.Component);

/**
 * Configures the shape of "lines" geometry primitives.
 *
 * * Located at {@link View#linesMaterial}.
 */
var _state$b = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var LinesMaterial = /*#__PURE__*/function (_Component) {
  _inheritsLoose(LinesMaterial, _Component);
  /**
   * @private
   */
  function LinesMaterial(view, options) {
    var _this;
    if (options === void 0) {
      options = {
        lineWidth: 1
      };
    }
    _this = _Component.call(this, view, options) || this;
    /**
     * The View to which this LinesMaterial belongs.
     */
    _this.view = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$b, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$b)[_state$b] = {
      lineWidth: options.lineWidth !== undefined && options.lineWidth !== null ? options.lineWidth : 1
    };
    return _this;
  }
  /**
   * Sets line width.
   *
   * Default value is ````1```` pixels.
   */
  _createClass(LinesMaterial, [{
    key: "lineWidth",
    get:
    /**
     * Gets the line width.
     *
     * Default value is ````1```` pixels.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$b)[_state$b].lineWidth;
    },
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$b)[_state$b].lineWidth = value || 1;
      this.view.redraw();
    }
  }]);
  return LinesMaterial;
}(core.Component);

/**
 * A layer of {@link ViewObject | ViewObjects} in a {@link @xeokit/viewer!View}.
 *
 * See {@link "@xeokit/viewer"} for usage.
 *
 * ## Summary
 *
 * * Automatically stores a {@link ViewObject} for each existing {@link RendererObject} that has a matching {@link RendererObject.layerId | ViewerObject.layerId}
 * * Useful for segreggating {@link ViewObject | ViewObjects} into layers
 * * Created automatically or manually (see {@link View.createLayer | View.createLayer})
 * * Stored in {@link View.layers | View.layers}
 *
 * ## Overview
 *
 * ViewLayers organize a {@link View |View's} {@link ViewObject | ViewObjects} into layers, according to which aspects of
 * the view they represent. They make it easier for us to focus our interactions on the ViewObjects that are relevant
 * to the particular aspects we're interested in.
 *
 * ### Typical use case: segregating model objects from environment objects
 *
 * A typical use case for this feature is to group environmental {@link ViewObject | ViewObjects} (e.g. ground, skybox) in an "environment" ViewLayer,
 * and group model ViewObjects in a "model" ViewLayer. Then we can focus our model interactions (show, hide, highlight,
 * save/load BCF viewpoints, etc.) on the ViewObjects in the "model" ViewLayer, without involving the "environment"
 * ViewObjects at all, which are effectively in the background. We can basically ignore the environment objects as we
 * do various batch operations on our model objects, i.e. "X-ray all", "X-ray everything except for walls" and so on.
 *
 * ### Automatic ViewLayers
 *
 * By default, each {@link @xeokit/viewer!View} automatically lazy-creates ViewLayers within itself as required. As {@link RendererObject | ViewerObjects} appear in the
 * {@link @xeokit/viewer!Viewer}, {@link ViewObject | ViewObjects} and Viewlayers magically appear in each existing View.
 *
 * Recall that, whenever a {@link RendererObject} is created, each existing {@link @xeokit/viewer!View} will automatically create a
 * corresponding {@link ViewObject} to represent and control that ViewerObject's appearance within the View's canvas.
 *
 * If the {@link RendererObject} also happens to have a value set on its {@link RendererObject.layerId} ID property, then the View
 * will also automatically ensure that it contains a matching {@link ViewLayer}, and will register the new ViewObject
 * in that ViewLayer. Note that each ViewObject can belong to a maximum of one ViewLayer.
 *
 * When a {@link @xeokit/viewer!View} automatically creates Viewlayers, it will also automatically destroy them again whenever
 * their {@link RendererObject | ViewerObjects} have all been destroyed.
 *
 * ### Manual ViewLayers
 *
 * We can configure a {@link @xeokit/viewer!View} to **not** automatically create ViewLayers, and instead rely on us to manually create them.
 *
 * When we do that, the View will only create the {@link ViewObject | ViewObjects} within itself for the ViewLayers that we created. The
 * View will ignore all ViewerObjects that don't have {@link RendererObject.layerId} values that match the IDs of our
 * manually-created ViewLayers.
 *
 * This feature is useful for ensuring that aspect-focused Views don't contain huge numbers of unused ViewObjects for
 * ViewerObjects that they never need to show.
 *
 * When we manually create ViewLayers like this, then the View will not automatically destroy them whenever
 * their {@link RendererObject | ViewerObjects} have all been destroyed. This keeps the ViewLayers around, in case
 * we create matching ViewerObjects again in future.
 *
 * ## Examples
 *
 * ### Exampe 1: Automatic ViewLayers
 *
 * Create a {@link @xeokit/viewer!Viewer}:
 *
 *````javascript
 * import {Viewer} from "@xeokit/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 *````
 *
 * Create a {@link @xeokit/viewer!View}, with the default setting of ````false```` for {@link ViewParams.autoLayers}:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myView1",
 *      autoLayers: true // <<----------- Default
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 * ````
 *
 * Next, we'll create a {@link @xeokit/scene!SceneModel | SceneModel} containing two model {@link RendererObject | ViewerObjects} that represent a building
 * foundation and walls, along with two environmental ViewerObjects that represent a skybox and ground plane.
 *
 * The ground and skybox ViewerObjects specify that their {@link ViewObject | ViewObjects} belong
 * to "environment" ViewLayers, while the model ViewerObjects specify that their ViewObjects belong to "model" ViewLayers.
 *
 * ````javascript
 * const sceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * // (calls to SceneModel createGeometry and
 * // createMesh omitted for brevity)
 *
 * sceneModel.createObject({
 *      id: "ground",
 *      meshIds: ["groundMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "skyBox",
 *      meshIds: ["skyBoxMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseFoundation",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseWalls",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.build();
 * ````
 *
 * Our {@link @xeokit/viewer!View} has now automatically created an "environment" {@link ViewLayer}, which contains {@link ViewObject | ViewObjects} for the skybox and
 * ground plane ViewerObjects, and a "model" ViewLayer, which contains ViewObjects for the house foundation and walls.
 *
 * We can now batch-update the ViewObjects in each ViewLayer independently. As mentioned, this is useful when we need to ignore things
 * like UI or environmental objects in batch-updates, BCF viewpoints etc.
 *
 * ````javascript
 * // viewer.objects contains four ViewerObjects with IDs "ground", "skyBox", "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.objects contains four ViewObjects with IDs "ground", "skyBox", "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.layers contains two ViewLayers with IDs "environment" and "model"
 *
 * const environmentLayer = view1.layers["environment"];
 * environmentLayer.setObjectsVisible(environmentLayer.objectIds, true);

 * const modelLayer = view1.layers["model"];
 * modelLayer.setObjectsVisible(modelLayer.objectIds, true);
 * ````
 *
 * ### Example 2: Manual ViewLayers
 *
 * Create a {@link @xeokit/viewer!Viewer}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 * ````
 *
 * Create a {@link @xeokit/viewer!View}, this time with ````false```` for {@link ViewParams.autoLayers}, in order to **not**
 * automatically create ViewLayers on demand:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myCanvas1",
 *      autoLayers: false // <<----------- Override default
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 * ````
 *
 * We'll manually create the "model" ViewLayer, and won't create an "environment" ViewLayer:
 *
 * ````javascript
 * const modelViewLayer = view1.createLayer({
 *     id: "model",
 *     visible: true
 * });
 * ````
 *
 * As we did in the previous example, we'll now create a {@link @xeokit/scene!SceneModel | SceneModel} containing two model
 * {@link RendererObject | ViewerObjects} that represent a building foundation and walls, along with two environmental
 * ViewerObjects that represent a skybox and ground plane.
 *
 * As before, the ground and skybox ViewerObjects specify that their {@link ViewObject | ViewObjects} belong to "environment" ViewLayers,
 * while the model ViewerObjects specify that their ViewObjects belong to "model" ViewLayers.
 *
 * ````javascript
 * const sceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * // (calls to SceneModel createGeometry and
 * // createMesh omitted for brevity)
 *
 * sceneModel.createObject({
 *      id: "ground",
 *      meshIds: ["groundMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "skyBox",
 *      meshIds: ["skyBoxMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseFoundation",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseWalls",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.build();
 * ````
 *
 * This time, however, our {@link @xeokit/viewer!View} has now created {@link ViewObject | ViewObjects} for the "model" ViewerObjects, while
 * ignoring the "environment" ViewerObjects.
 *
 * As far as this View is concerned, the "environment" ViewerObjects do not exist.
 *
 * ````javascript
 * // viewer.scene.objects contains four SceneObjects with IDs "ground", "skyBox", "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.objects contains two ViewObjects with IDs "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.layers contains one ViewLayer with ID "model"
 *
 * const modelLayer = view1.layers["model"];
 * modelLayer.setObjectsVisible(modelLayer.objectIds, true);
 * ````
 */
var _numObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("numObjects");
var _objectIds$1 = /*#__PURE__*/_classPrivateFieldLooseKey("objectIds");
var _numVisibleObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("numVisibleObjects");
var _visibleObjectIds$1 = /*#__PURE__*/_classPrivateFieldLooseKey("visibleObjectIds");
var _numXRayedObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("numXRayedObjects");
var _xrayedObjectIds$1 = /*#__PURE__*/_classPrivateFieldLooseKey("xrayedObjectIds");
var _numHighlightedObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("numHighlightedObjects");
var _highlightedObjectIds$1 = /*#__PURE__*/_classPrivateFieldLooseKey("highlightedObjectIds");
var _numSelectedObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("numSelectedObjects");
var _selectedObjectIds$1 = /*#__PURE__*/_classPrivateFieldLooseKey("selectedObjectIds");
var _numColorizedObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("numColorizedObjects");
var _colorizedObjectIds$1 = /*#__PURE__*/_classPrivateFieldLooseKey("colorizedObjectIds");
var _numOpacityObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("numOpacityObjects");
var _opacityObjectIds$1 = /*#__PURE__*/_classPrivateFieldLooseKey("opacityObjectIds");
var _qualityRender$1 = /*#__PURE__*/_classPrivateFieldLooseKey("qualityRender");
var _initObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("initObjects");
var _createObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("createObjects");
var _destroyObjects$1 = /*#__PURE__*/_classPrivateFieldLooseKey("destroyObjects");
var ViewLayer = /*#__PURE__*/function (_Component) {
  _inheritsLoose(ViewLayer, _Component);
  function ViewLayer(options) {
    var _this;
    _this = _Component.call(this, options.view, options) || this;
    Object.defineProperty(_assertThisInitialized(_this), _destroyObjects$1, {
      value: _destroyObjects2$1
    });
    Object.defineProperty(_assertThisInitialized(_this), _createObjects$1, {
      value: _createObjects2$1
    });
    Object.defineProperty(_assertThisInitialized(_this), _initObjects$1, {
      value: _initObjects2$1
    });
    /**
     * Map of the all {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * These are the ViewObjects for which {@link ViewObject.layerId} has the same value as {@link ViewLayer.id}.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     *
     * The ViewLayer automatically ensures that there is a {@link ViewObject} here for
     * each {@link RendererObject} in the {@link @xeokit/viewer!Viewer}
     */
    _this.objects = void 0;
    /**
     * Map of the currently visible {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.visibleObjects = void 0;
    /**
     * Map of currently x-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.xrayedObjects = void 0;
    /**
     * Map of currently highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.highlightedObjects = void 0;
    /**
     * Map of currently selected {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.selectedObjects = void 0;
    /**
     * Map of currently colorized {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.colorizedObjects = void 0;
    /**
     * Map of {@link ViewObject | ViewObjects} in this ViewLayer whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.opacityObjects = void 0;
    /**
     * When true, View destroys this ViewLayer as soon as there are no ViewObjects
     * that need it. When false, View retains it.
     * @private
     */
    _this.autoDestroy = void 0;
    /**
     * Emits an event each time the visibility of a {@link ViewObject} changes.
     *
     * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link ViewLayer.setObjectsVisible} or {@link ViewObject.visible}.
     *
     * @event
     */
    _this.onObjectVisibility = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _numObjects$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _objectIds$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numVisibleObjects$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _visibleObjectIds$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numXRayedObjects$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _xrayedObjectIds$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numHighlightedObjects$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _highlightedObjectIds$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numSelectedObjects$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _selectedObjectIds$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numColorizedObjects$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _colorizedObjectIds$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numOpacityObjects$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _opacityObjectIds$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _qualityRender$1, {
      writable: true,
      value: void 0
    });
    _this.gammaOutput = void 0;
    _this.id = options.id;
    _this.viewer = options.viewer;
    _this.view = options.view;
    _this.objects = {};
    _this.visibleObjects = {};
    _this.xrayedObjects = {};
    _this.highlightedObjects = {};
    _this.selectedObjects = {};
    _this.colorizedObjects = {};
    _this.opacityObjects = {};
    _this.autoDestroy = options.autoDestroy !== false;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numObjects$1)[_numObjects$1] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numVisibleObjects$1)[_numVisibleObjects$1] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numXRayedObjects$1)[_numXRayedObjects$1] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numHighlightedObjects$1)[_numHighlightedObjects$1] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numSelectedObjects$1)[_numSelectedObjects$1] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numColorizedObjects$1)[_numColorizedObjects$1] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numOpacityObjects$1)[_numOpacityObjects$1] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _qualityRender$1)[_qualityRender$1] = !!options.qualityRender;
    _this.onObjectVisibility = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _initObjects$1)[_initObjects$1]();
    return _this;
  }
  /**
   * Gets the gamma factor.
   */
  var _proto = ViewLayer.prototype;
  /**
   * @private
   */
  _proto.registerViewObject = function registerViewObject(viewObject) {
    this.objects[viewObject.id] = viewObject;
    _classPrivateFieldLooseBase(this, _numObjects$1)[_numObjects$1]++;
    _classPrivateFieldLooseBase(this, _objectIds$1)[_objectIds$1] = null; // Lazy regenerate
  }
  /**
   * @private
   */;
  _proto.deregisterViewObject = function deregisterViewObject(viewObject) {
    delete this.objects[viewObject.id];
    delete this.visibleObjects[viewObject.id];
    delete this.xrayedObjects[viewObject.id];
    delete this.highlightedObjects[viewObject.id];
    delete this.selectedObjects[viewObject.id];
    delete this.colorizedObjects[viewObject.id];
    delete this.opacityObjects[viewObject.id];
    _classPrivateFieldLooseBase(this, _numObjects$1)[_numObjects$1]--;
    _classPrivateFieldLooseBase(this, _objectIds$1)[_objectIds$1] = null; // Lazy regenerate
  }
  /**
   * @private
   */;
  _proto.redraw = function redraw() {
    this.viewer.renderer.setImageDirty(this.view.viewIndex);
  }
  /**
   * @private
   */;
  _proto.objectVisibilityUpdated = function objectVisibilityUpdated(viewObject, visible, notify) {
    if (notify === void 0) {
      notify = true;
    }
    if (visible) {
      this.visibleObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numVisibleObjects$1)[_numVisibleObjects$1]++;
    } else {
      delete this.visibleObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numVisibleObjects$1)[_numVisibleObjects$1]--;
    }
    _classPrivateFieldLooseBase(this, _visibleObjectIds$1)[_visibleObjectIds$1] = null; // Lazy regenerate
    if (notify) {
      this.onObjectVisibility.dispatch(this, viewObject);
    }
    this.view.objectVisibilityUpdated(viewObject, visible, notify);
  }
  /**
   * @private
   */;
  _proto.objectXRayedUpdated = function objectXRayedUpdated(viewObject, xrayed) {
    if (xrayed) {
      this.xrayedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numXRayedObjects$1)[_numXRayedObjects$1]++;
    } else {
      delete this.xrayedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numXRayedObjects$1)[_numXRayedObjects$1]--;
    }
    _classPrivateFieldLooseBase(this, _xrayedObjectIds$1)[_xrayedObjectIds$1] = null; // Lazy regenerate
    this.view.objectXRayedUpdated(viewObject, xrayed);
  }
  /**
   * @private
   */;
  _proto.objectHighlightedUpdated = function objectHighlightedUpdated(viewObject, highlighted) {
    if (highlighted) {
      this.highlightedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numHighlightedObjects$1)[_numHighlightedObjects$1]++;
    } else {
      delete this.highlightedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numHighlightedObjects$1)[_numHighlightedObjects$1]--;
    }
    _classPrivateFieldLooseBase(this, _highlightedObjectIds$1)[_highlightedObjectIds$1] = null; // Lazy regenerate
    this.view.objectHighlightedUpdated(viewObject, highlighted);
  }
  /**
   * @private
   */;
  _proto.objectSelectedUpdated = function objectSelectedUpdated(viewObject, selected) {
    if (selected) {
      this.selectedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numSelectedObjects$1)[_numSelectedObjects$1]++;
    } else {
      delete this.selectedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numSelectedObjects$1)[_numSelectedObjects$1]--;
    }
    _classPrivateFieldLooseBase(this, _selectedObjectIds$1)[_selectedObjectIds$1] = null; // Lazy regenerate
    this.view.objectSelectedUpdated(viewObject, selected);
  }
  /**
   * @private
   */;
  _proto.objectColorizeUpdated = function objectColorizeUpdated(viewObject, colorized) {
    if (colorized) {
      this.colorizedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numColorizedObjects$1)[_numColorizedObjects$1]++;
    } else {
      delete this.colorizedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numColorizedObjects$1)[_numColorizedObjects$1]--;
    }
    _classPrivateFieldLooseBase(this, _colorizedObjectIds$1)[_colorizedObjectIds$1] = null; // Lazy regenerate
    this.view.objectColorizeUpdated(viewObject, colorized);
  }
  /**
   * @private
   */;
  _proto.objectOpacityUpdated = function objectOpacityUpdated(viewObject, opacityUpdated) {
    if (opacityUpdated) {
      this.opacityObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numOpacityObjects$1)[_numOpacityObjects$1]++;
    } else {
      delete this.opacityObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numOpacityObjects$1)[_numOpacityObjects$1]--;
    }
    _classPrivateFieldLooseBase(this, _opacityObjectIds$1)[_opacityObjectIds$1] = null; // Lazy regenerate
    this.view.objectOpacityUpdated(viewObject, opacityUpdated);
  }
  /**
   * Updates the visibility of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.visible} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.visibleObjects} and {@link ViewLayer.numVisibleObjects}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param visible Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsVisible = function setObjectsVisible(objectIds, visible) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.visible !== visible;
      viewObject.visible = visible;
      return changed;
    });
  }
  /**
   * Updates the collidability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param collidable Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsCollidable = function setObjectsCollidable(objectIds, collidable) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.collidable !== collidable;
      viewObject.collidable = collidable;
      return changed;
    });
  }
  /**
   * Updates the culled status of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * Updates {@link ViewObject.culled} on the Objects with the given IDs.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param culled Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsCulled = function setObjectsCulled(objectIds, culled) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.culled !== culled;
      viewObject.culled = culled;
      return changed;
    });
  }
  /**
   * Selects or deselects the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.selected} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.selectedObjects} and {@link ViewLayer.numSelectedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param selected Whether or not to select.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsSelected = function setObjectsSelected(objectIds, selected) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.selected !== selected;
      viewObject.selected = selected;
      return changed;
    });
  }
  /**
   * Highlights or un-highlights the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.highlighted} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.highlightedObjects} and {@link ViewLayer.numHighlightedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param highlighted Whether or not to highlight.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsHighlighted = function setObjectsHighlighted(objectIds, highlighted) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.highlighted !== highlighted;
      viewObject.highlighted = highlighted;
      return changed;
    });
  }
  /**
   * Applies or removes X-ray rendering for the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.xrayed} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.xrayedObjects} and {@link ViewLayer.numXRayedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param xrayed Whether or not to xray.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsXRayed = function setObjectsXRayed(objectIds, xrayed) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.xrayed !== xrayed;
      if (changed) {
        viewObject.xrayed = xrayed;
      }
      return changed;
    });
  }
  /**
   * Colorizes the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.colorize} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.colorizedObjects} and {@link ViewLayer.numColorizedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsColorized = function setObjectsColorized(objectIds, colorize) {
    return this.withObjects(objectIds, function (viewObject) {
      viewObject.colorize = colorize;
    });
  }
  /**
   * Sets the opacity of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.opacity} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.opacityObjects} and {@link ViewLayer.numOpacityObjects}.
   *
   * @param  objectIds - One or more {@link ViewObject.id} values.
   * @param opacity - Opacity factor in range ````[0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsOpacity = function setObjectsOpacity(objectIds, opacity) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.opacity !== opacity;
      if (changed) {
        viewObject.opacity = opacity;
      }
      return changed;
    });
  }
  /**
   * Sets the pickability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link ViewLayer.pick}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param pickable Whether or not to set pickable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsPickable = function setObjectsPickable(objectIds, pickable) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.pickable !== pickable;
      if (changed) {
        viewObject.pickable = pickable;
      }
      return changed;
    });
  }
  /**
   * Sets the clippability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link ViewLayer.pick}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param clippable Whether or not to set clippable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsClippable = function setObjectsClippable(objectIds, clippable) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.clippable !== clippable;
      if (changed) {
        viewObject.clippable = clippable;
      }
      return changed;
    });
  }
  /**
   * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param callback Callback to execute on each {@link ViewObject}.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.withObjects = function withObjects(objectIds, callback) {
    var changed = false;
    for (var i = 0, len = objectIds.length; i < len; i++) {
      var id = objectIds[i];
      var viewObject = this.objects[id];
      if (viewObject) {
        changed = callback(viewObject) || changed;
      }
    }
    return changed;
  };
  /**
   * Destroys this ViewLayer.
   *
   * Causes {@link @xeokit/viewer!Viewer} to fire a "viewDestroyed" event.
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
  };
  _createClass(ViewLayer, [{
    key: "gammaFactor",
    get: function get() {
      return 1.0;
    }
    /**
     * Sets whether quality rendering is enabled for this ViewLayer.
     *
     * Default is ````false````.
     */
  }, {
    key: "qualityRender",
    get:
    /**
     * Gets whether quality rendering is enabled for this ViewLayer.
     *
     * Default is ````false````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _qualityRender$1)[_qualityRender$1];
    }
    /**
     * Gets the number of {@link ViewObject | ViewObjects} in this ViewLayer.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _qualityRender$1)[_qualityRender$1] === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _qualityRender$1)[_qualityRender$1] = value;
      this.redraw();
    }
  }, {
    key: "numObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numObjects$1)[_numObjects$1];
    }
    /**
     * Gets the IDs of the {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "objectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _objectIds$1)[_objectIds$1]) {
        _classPrivateFieldLooseBase(this, _objectIds$1)[_objectIds$1] = Object.keys(this.objects);
      }
      return _classPrivateFieldLooseBase(this, _objectIds$1)[_objectIds$1];
    }
    /**
     * Gets the number of visible {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "numVisibleObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numVisibleObjects$1)[_numVisibleObjects$1];
    }
    /**
     * Gets the IDs of the visible {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "visibleObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _visibleObjectIds$1)[_visibleObjectIds$1]) {
        _classPrivateFieldLooseBase(this, _visibleObjectIds$1)[_visibleObjectIds$1] = Object.keys(this.visibleObjects);
      }
      return _classPrivateFieldLooseBase(this, _visibleObjectIds$1)[_visibleObjectIds$1];
    }
    /**
     * Gets the number of X-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "numXRayedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numXRayedObjects$1)[_numXRayedObjects$1];
    }
    /**
     * Gets the IDs of the X-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "xrayedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _xrayedObjectIds$1)[_xrayedObjectIds$1]) {
        _classPrivateFieldLooseBase(this, _xrayedObjectIds$1)[_xrayedObjectIds$1] = Object.keys(this.xrayedObjects);
      }
      return _classPrivateFieldLooseBase(this, _xrayedObjectIds$1)[_xrayedObjectIds$1];
    }
    /**
     * Gets the number of highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "numHighlightedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numHighlightedObjects$1)[_numHighlightedObjects$1];
    }
    /**
     * Gets the IDs of the highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "highlightedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _highlightedObjectIds$1)[_highlightedObjectIds$1]) {
        _classPrivateFieldLooseBase(this, _highlightedObjectIds$1)[_highlightedObjectIds$1] = Object.keys(this.highlightedObjects);
      }
      return _classPrivateFieldLooseBase(this, _highlightedObjectIds$1)[_highlightedObjectIds$1];
    }
    /**
     * Gets the number of selected {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "numSelectedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numSelectedObjects$1)[_numSelectedObjects$1];
    }
    /**
     * Gets the IDs of the selected {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "selectedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _selectedObjectIds$1)[_selectedObjectIds$1]) {
        _classPrivateFieldLooseBase(this, _selectedObjectIds$1)[_selectedObjectIds$1] = Object.keys(this.selectedObjects);
      }
      return _classPrivateFieldLooseBase(this, _selectedObjectIds$1)[_selectedObjectIds$1];
    }
    /**
     * Gets the number of colorized {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "numColorizedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numColorizedObjects$1)[_numColorizedObjects$1];
    }
    /**
     * Gets the IDs of the colorized {@link ViewObject | ViewObjects} in this ViewLayer.
     */
  }, {
    key: "colorizedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _colorizedObjectIds$1)[_colorizedObjectIds$1]) {
        _classPrivateFieldLooseBase(this, _colorizedObjectIds$1)[_colorizedObjectIds$1] = Object.keys(this.colorizedObjects);
      }
      return _classPrivateFieldLooseBase(this, _colorizedObjectIds$1)[_colorizedObjectIds$1];
    }
    /**
     * Gets the IDs of the {@link ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
     */
  }, {
    key: "opacityObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _opacityObjectIds$1)[_opacityObjectIds$1]) {
        _classPrivateFieldLooseBase(this, _opacityObjectIds$1)[_opacityObjectIds$1] = Object.keys(this.opacityObjects);
      }
      return _classPrivateFieldLooseBase(this, _opacityObjectIds$1)[_opacityObjectIds$1];
    }
    /**
     * Gets the number of {@link ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
     */
  }, {
    key: "numOpacityObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numOpacityObjects$1)[_numOpacityObjects$1];
    }
  }]);
  return ViewLayer;
}(core.Component);
function _initObjects2$1() {
  var _this2 = this;
  var models = this.viewer.scene.models;
  for (var id in models) {
    var model = models[id];
    _classPrivateFieldLooseBase(this, _createObjects$1)[_createObjects$1](model);
  }
  this.viewer.scene.onModelCreated.subscribe(function (scene, model) {
    _classPrivateFieldLooseBase(_this2, _createObjects$1)[_createObjects$1](model);
  });
  this.viewer.scene.onModelDestroyed.subscribe(function (scene, model) {
    _classPrivateFieldLooseBase(_this2, _destroyObjects$1)[_destroyObjects$1](model);
  });
}
function _createObjects2$1(model) {
  var sceneObjects = model.objects;
  for (var id in sceneObjects) {
    var sceneObject = sceneObjects[id];
    var rendererViewObject = this.viewer.renderer.rendererViewObjects[id];
    if (rendererViewObject.layerId == this.id) {
      var viewObject = new ViewObject(this, sceneObject, rendererViewObject);
      this.objects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numObjects$1)[_numObjects$1]++;
      _classPrivateFieldLooseBase(this, _objectIds$1)[_objectIds$1] = null; // Lazy regenerate
    }
  }
}
function _destroyObjects2$1(model) {
  var viewerObjects = model.objects;
  for (var id in viewerObjects) {
    var viewerObject = viewerObjects[id];
    var viewObject = this.objects[viewerObject.id];
    viewObject._destroy();
    _classPrivateFieldLooseBase(this, _numObjects$1)[_numObjects$1]--;
    _classPrivateFieldLooseBase(this, _objectIds$1)[_objectIds$1] = null; // Lazy regenerate
  }
}

/**
 * Configures the appearance of {@link ViewObject | ViewObjects} when they are xrayed, highlighted or selected.
 *
 * ## Summary
 *
 * * Located at {@link View.xrayMaterial}, {@link View.highlightMaterial} and {@link View.selectedMaterial}.
 * * XRay a {@link ViewObject} by setting {@link ViewObject.xrayed} ````true````.
 * * Highlight a {@link ViewObject} by setting {@link ViewObject.highlighted} ````true````.
 * * Select a {@link ViewObject} by setting {@link ViewObject.selected} ````true````.
 */
var _state$a = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var EmphasisMaterial = /*#__PURE__*/function (_Component) {
  _inheritsLoose(EmphasisMaterial, _Component);
  /**
   * @private
   */
  function EmphasisMaterial(view, options) {
    var _this;
    if (options === void 0) {
      options = {};
    }
    _this = _Component.call(this, view, options) || this;
    /**
     * The View to which this EmphasisMaterial belongs.
     */
    _this.view = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$a, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$a)[_state$a] = {
      fill: !!options.fill,
      fillColor: new Float32Array(options.fillColor || [0.4, 0.4, 0.4]),
      fillAlpha: options.fillAlpha !== undefined && options.fillAlpha !== null ? options.fillAlpha : 0.2,
      edges: options.edges !== false,
      edgeColor: new Float32Array(options.edgeColor || [0.2, 0.2, 0.2]),
      edgeAlpha: options.edgeAlpha !== undefined && options.edgeAlpha !== null ? options.edgeAlpha : 0.5,
      edgeWidth: options.edgeWidth !== undefined && options.edgeWidth !== null ? options.edgeWidth : 1,
      backfaces: !!options.backfaces
    };
    return _this;
  }
  /**
   * Sets if the surfaces of emphasized {@link ViewObject | ViewObjects} are filled with color.
   *
   * Default is ````true````.
   */
  var _proto = EmphasisMaterial.prototype;
  /**
   * @private
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
  };
  _createClass(EmphasisMaterial, [{
    key: "fill",
    get:
    /**
     * Gets if the surfaces of emphasized {@link ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].fill;
    }
    /**
     * Sets the RGB surface fill color for the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$a)[_state$a].fill === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$a)[_state$a].fill = value;
      this.view.redraw();
    }
  }, {
    key: "fillColor",
    get:
    /**
     * Gets the RGB surface fill color for the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].fillColor;
    }
    /**
     * Sets the transparency of the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */,
    set: function set(value) {
      var fillColor = _classPrivateFieldLooseBase(this, _state$a)[_state$a].fillColor;
      if (fillColor[0] === value[0] && fillColor[1] === value[1] && fillColor[2] === value[2]) {
        return;
      }
      fillColor[0] = 0.4;
      fillColor[1] = 0.4;
      fillColor[2] = 0.4;
      this.view.redraw();
    }
  }, {
    key: "fillAlpha",
    get:
    /**
     * Gets the transparency of the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].fillAlpha;
    }
    /**
     * Sets if the edges on emphasized {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$a)[_state$a].fillAlpha === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$a)[_state$a].fillAlpha = value;
      this.view.redraw();
    }
  }, {
    key: "edges",
    get:
    /**
     * Gets if the edges on emphasized {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].edges;
    }
    /**
     * Sets the RGB color of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$a)[_state$a].edges === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$a)[_state$a].edges = value;
      this.view.redraw();
    }
  }, {
    key: "edgeColor",
    get:
    /**
     * Gets the RGB color of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].edgeColor;
    }
    /**
     * Sets the transparency of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */,
    set: function set(value) {
      var edgeColor = _classPrivateFieldLooseBase(this, _state$a)[_state$a].edgeColor;
      if (edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
        return;
      }
      edgeColor[0] = 0.2;
      edgeColor[1] = 0.2;
      edgeColor[2] = 0.2;
      this.view.redraw();
    }
  }, {
    key: "edgeAlpha",
    get:
    /**
     * Gets the transparency of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].edgeAlpha;
    }
    /**
     * Sets the width of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$a)[_state$a].edgeAlpha === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$a)[_state$a].edgeAlpha = value;
      this.view.redraw();
    }
  }, {
    key: "edgeWidth",
    get:
    /**
     * Gets the width of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].edgeWidth;
    }
    /**
     * Sets whether to render backfaces of emphasized {@link ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$a)[_state$a].edgeWidth = value;
      this.view.redraw();
    }
  }, {
    key: "backfaces",
    get:
    /**
     * Gets whether to render backfaces of emphasized {@link ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$a)[_state$a].backfaces;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$a)[_state$a].backfaces === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$a)[_state$a].backfaces = value;
      this.view.redraw();
    }
  }, {
    key: "hash",
    get: function get() {
      return "";
    }
  }]);
  return EmphasisMaterial;
}(core.Component);

/**
 * Configures the appearance of {@link ViewObject | ViewObjects} when their edges are emphasised.
 *
 * ## Summary
 *
 * * Located at {@link View.edgeMaterial}.
 * * Emphasise edges of a {@link ViewObject} by setting {@link ViewObject.edges} ````true````.
 */
var _state$9 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var EdgeMaterial = /*#__PURE__*/function (_Component) {
  _inheritsLoose(EdgeMaterial, _Component);
  /**
   * @private
   */
  function EdgeMaterial(view, options) {
    var _this;
    if (options === void 0) {
      options = {};
    }
    _this = _Component.call(this, view, options) || this;
    /**
     * The View to which this EdgeMaterial belongs.
     */
    _this.view = void 0;
    /**
     * @private
     */
    Object.defineProperty(_assertThisInitialized(_this), _state$9, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$9)[_state$9] = {
      renderModes: options.renderModes || [constants.QualityRender],
      edges: options.edges !== false,
      edgeColor: new Float32Array(options.edgeColor || [0.2, 0.2, 0.2]),
      edgeAlpha: options.edgeAlpha !== undefined && options.edgeAlpha !== null ? options.edgeAlpha : 0.5,
      edgeWidth: options.edgeWidth !== undefined && options.edgeWidth !== null ? options.edgeWidth : 1
    };
    return _this;
  }
  /**
   * Sets which rendering modes in which to render edges.
   *
   * Accepted modes are {@link QualityRender} and {@link FastRender}.
   *
   * Default value is [{@link QualityRender}].
   */
  var _proto = EdgeMaterial.prototype;
  /**
   * @private
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
  };
  _createClass(EdgeMaterial, [{
    key: "renderModes",
    get:
    /**
     * Gets which rendering modes in which to render edges.
     *
     * Accepted modes are {@link QualityRender} and {@link FastRender}.
     *
     * Default value is [{@link QualityRender}].
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$9)[_state$9].renderModes;
    }
    /**
     * Sets if edges of {@link ViewObjects} are visible.
     *
     * Default is ````true````.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$9)[_state$9].renderModes = value;
      this.view.redraw();
    }
  }, {
    key: "edges",
    get:
    /**
     * Gets if edges of {@link ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$9)[_state$9].edges;
    }
    /**
     * Sets RGB edge color for {@link ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$9)[_state$9].edges === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$9)[_state$9].edges = value;
      this.view.redraw();
    }
  }, {
    key: "edgeColor",
    get:
    /**
     * Gets RGB edge color for {@link ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeColor;
    }
    /**
     * Sets edge transparency for {@link ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */,
    set: function set(value) {
      var edgeColor = _classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeColor;
      if (value && edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
        return;
      }
      edgeColor[0] = 0.2;
      edgeColor[1] = 0.2;
      edgeColor[2] = 0.2;
      this.view.redraw();
    }
  }, {
    key: "edgeAlpha",
    get:
    /**
     * Gets edge transparency for {@link ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeAlpha;
    }
    /**
     * Sets edge width for {@link ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeAlpha === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeAlpha = value;
      this.view.redraw();
    }
  }, {
    key: "edgeWidth",
    get:
    /**
     * Gets edge width for {@link ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeWidth;
    },
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeWidth === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$9)[_state$9].edgeWidth = value;
      this.view.redraw();
    }
  }]);
  return EdgeMaterial;
}(core.Component);

/**
 * Configures the size and shape of {@link ViewObject | ViewObjects} that represent clouds of points.
 *
 * ## Summary
 *
 * * Located at {@link View.pointsMaterial}.
 * * Supports round and square points.
 * * Optional perspective point scaling.
 */
var _state$8 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var PointsMaterial = /*#__PURE__*/function (_Component) {
  _inheritsLoose(PointsMaterial, _Component);
  /**
   * @private
   */
  function PointsMaterial(view, options) {
    var _this;
    if (options === void 0) {
      options = {};
    }
    _this = _Component.call(this, view, options) || this;
    /**
     * The View to which this PointsMaterial belongs.
     */
    _this.view = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$8, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$8)[_state$8] = {
      pointSize: options.pointSize !== undefined && options.pointSize !== null ? options.pointSize : 1,
      roundPoints: options.roundPoints !== false,
      perspectivePoints: options.perspectivePoints !== false,
      minPerspectivePointSize: options.minPerspectivePointSize !== undefined && options.minPerspectivePointSize !== null ? options.minPerspectivePointSize : 1,
      maxPerspectivePointSize: options.maxPerspectivePointSize !== undefined && options.maxPerspectivePointSize !== null ? options.maxPerspectivePointSize : 6,
      filterIntensity: !!options.filterIntensity,
      minIntensity: options.minIntensity !== undefined && options.minIntensity !== null ? options.minIntensity : 0,
      maxIntensity: options.maxIntensity !== undefined && options.maxIntensity !== null ? options.maxIntensity : 1
    };
    return _this;
  }
  /**
   * Sets point size.
   *
   * Default value is ````2.0```` pixels.
   */
  var _proto = PointsMaterial.prototype;
  /**
   * @private
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
  };
  _createClass(PointsMaterial, [{
    key: "pointSize",
    get:
    /**
     * Gets point size.
     *
     * Default value is ````2.0```` pixels.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].pointSize;
    }
    /**
     * Sets if points are round or square.
     *
     * Default is ````true```` to set points round.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].pointSize = value;
      this.view.redraw();
    }
  }, {
    key: "roundPoints",
    get:
    /**
     * Gets if points are round or square.
     *
     * Default is ````true```` to set points round.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].roundPoints;
    }
    /**
     * Sets if rendered point size reduces with distance when {@link Camera.projection} is set to ````PerspectiveProjectionType````.
     *
     * Default is ````true````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$8)[_state$8].roundPoints === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].roundPoints = value;
      this.view.rebuild();
    }
  }, {
    key: "perspectivePoints",
    get:
    /**
     * Gets if rendered point size reduces with distance when {@link Camera.projection} is set to PerspectiveProjectionType.
     *
     * Default is ````false````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].perspectivePoints;
    }
    /**
     * Sets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````1.0```` pixels.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$8)[_state$8].perspectivePoints === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].perspectivePoints = value;
      this.view.rebuild();
    }
  }, {
    key: "minPerspectivePointSize",
    get:
    /**
     * Gets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````1.0```` pixels.
     *
     * @type {Number}
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].minPerspectivePointSize;
    }
    /**
     * Sets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````6```` pixels.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$8)[_state$8].minPerspectivePointSize === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].minPerspectivePointSize = value;
      this.view.rebuild();
    }
  }, {
    key: "maxPerspectivePointSize",
    get:
    /**
     * Gets the maximum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````6```` pixels.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].maxPerspectivePointSize;
    }
    /**
     * Sets if rendered point size reduces with distance when {@link Camera.projection} is set to ````PerspectiveProjectionType````.
     *
     * Default is ````false````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$8)[_state$8].maxPerspectivePointSize === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].maxPerspectivePointSize = value;
      this.view.rebuild();
    }
  }, {
    key: "filterIntensity",
    get:
    /**
     * Gets if rendered point size reduces with distance when {@link Camera.projection} is set to PerspectiveProjectionType.
     *
     * Default is ````false````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].filterIntensity;
    }
    /**
     * Sets the minimum rendered size of points when {@link PointsMaterial.perspectivePoints} is ````true````.
     *
     * Default value is ````0````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$8)[_state$8].filterIntensity === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].filterIntensity = value;
      this.view.rebuild();
    }
  }, {
    key: "minIntensity",
    get:
    /**
     * Gets the minimum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````0````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].minIntensity;
    }
    /**
     * Sets the maximum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````1````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$8)[_state$8].minIntensity === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].minIntensity = value;
      this.view.redraw();
    }
  }, {
    key: "maxIntensity",
    get:
    /**
     * Gets the maximum rendered size of points when {@link PointsMaterial.filterIntensity} is ````true````.
     *
     * Default value is ````1````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$8)[_state$8].maxIntensity;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$8)[_state$8].maxIntensity === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$8)[_state$8].maxIntensity = value;
      this.view.redraw();
    }
  }, {
    key: "hash",
    get: function get() {
      var state = _classPrivateFieldLooseBase(this, _state$8)[_state$8];
      return state.pointSize + ";\n        " + state.roundPoints + ";\n        " + state.perspectivePoints + ";\n        " + state.minPerspectivePointSize + ";\n        " + state.maxPerspectivePointSize + ";\n        " + state.filterIntensity;
    }
  }]);
  return PointsMaterial;
}(core.Component);

/**
 * PerspectiveProjection projection configuration for a {@link @xeokit/viewer!Camera} .
 *
 * ## Summary
 *
 * * Located at {@link Camera.perspectiveProjection}.
 * * Implicitly sets the left, right, top, bottom frustum planes using {@link PerspectiveProjection.fov}.
 * * {@link PerspectiveProjection.near} and {@link PerspectiveProjection.far} specify the distances to the clipping planes.
 * * {@link PerspectiveProjection.onProjMatrix} will fire an event whenever {@link PerspectiveProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
var _state$7 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var _inverseMatrixDirty$2 = /*#__PURE__*/_classPrivateFieldLooseKey("inverseMatrixDirty");
var _transposedProjMatrixDirty$3 = /*#__PURE__*/_classPrivateFieldLooseKey("transposedProjMatrixDirty");
var _onViewBoundary$1 = /*#__PURE__*/_classPrivateFieldLooseKey("onViewBoundary");
var PerspectiveProjection = /*#__PURE__*/function (_Component) {
  _inheritsLoose(PerspectiveProjection, _Component);
  /**
   * @private
   */
  function PerspectiveProjection(camera, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, camera, cfg) || this;
    /**
     * The Camera this PerspectiveProjection belongs to.
     */
    _this.camera = void 0;
    /**
     * Emits an event each time {@link PerspectiveProjection.projMatrix} updates.
     *
     * @event
     */
    _this.onProjMatrix = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$7, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _inverseMatrixDirty$2, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _transposedProjMatrixDirty$3, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _onViewBoundary$1, {
      writable: true,
      value: void 0
    });
    _this.camera = camera;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$7)[_state$7] = {
      near: cfg.near || 0.1,
      far: cfg.far || 2000.0,
      fov: cfg.fov || 60.0,
      fovAxis: cfg.fovAxis || "min",
      projMatrix: matrix.createMat4(),
      inverseProjMatrix: matrix.createMat4(),
      transposedProjMatrix: matrix.createMat4()
    };
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _inverseMatrixDirty$2)[_inverseMatrixDirty$2] = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _transposedProjMatrixDirty$3)[_transposedProjMatrixDirty$3] = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _onViewBoundary$1)[_onViewBoundary$1] = _this.camera.view.onBoundary.subscribe(function () {
      _this.setDirty();
    });
    _this.onProjMatrix = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    return _this;
  }
  /**
   * Gets the PerspectiveProjection's field-of-view angle (FOV).
   *
   * Default value is ````60.0````.
   *
   * @returns {Number} Current field-of-view.
   */
  var _proto = PerspectiveProjection.prototype;
  /**
   * @private
   */
  _proto.clean = function clean() {
    var WIDTH_INDEX = 2;
    var HEIGHT_INDEX = 3;
    var boundary = this.camera.view.boundary;
    var aspect = boundary[WIDTH_INDEX] / boundary[HEIGHT_INDEX];
    var fovAxis = _classPrivateFieldLooseBase(this, _state$7)[_state$7].fovAxis;
    var fov = _classPrivateFieldLooseBase(this, _state$7)[_state$7].fov;
    if (fovAxis === "x" || fovAxis === "min" && aspect < 1 || fovAxis === "max" && aspect > 1) {
      fov = fov / aspect;
    }
    fov = Math.min(fov, 120);
    matrix.perspectiveMat4(fov * (Math.PI / 180.0), aspect, _classPrivateFieldLooseBase(this, _state$7)[_state$7].near, _classPrivateFieldLooseBase(this, _state$7)[_state$7].far, _classPrivateFieldLooseBase(this, _state$7)[_state$7].projMatrix);
    _classPrivateFieldLooseBase(this, _inverseMatrixDirty$2)[_inverseMatrixDirty$2] = true;
    _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$3)[_transposedProjMatrixDirty$3] = true;
    this.camera.view.redraw();
    this.onProjMatrix.dispatch(this, _classPrivateFieldLooseBase(this, _state$7)[_state$7].projMatrix);
  }
  /**
   * Un-projects the given View-space coordinates and Screen-space depth, using this PerspectiveProjection projection.
   *
   * @param canvasPos Inputs 2D View-space coordinates.
   * @param screenZ Inputs Screen-space Z coordinate.
   * @param screenPos Outputs 3D Screen/Clip-space coordinates.
   * @param viewPos Outputs un-projected 3D View-space coordinates.
   * @param worldPos Outputs un-projected 3D World-space coordinates.
   */;
  _proto.unproject = function unproject(canvasPos, screenZ, screenPos, viewPos, worldPos) {
    var canvasElement = this.camera.view.canvasElement;
    var halfViewWidth = canvasElement.offsetWidth / 2.0;
    var halfViewHeight = canvasElement.offsetHeight / 2.0;
    screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
    screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
    screenPos[2] = screenZ;
    screenPos[3] = 1.0;
    matrix.mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
    matrix.mulVec3Scalar(viewPos, 1.0 / viewPos[3]);
    viewPos[3] = 1.0;
    viewPos[1] *= -1;
    matrix.mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);
    return worldPos;
  }
  /** @private
   *
   */;
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.camera.view.onBoundary.unsubscribe(_classPrivateFieldLooseBase(this, _onViewBoundary$1)[_onViewBoundary$1]);
    this.onProjMatrix.clear();
  };
  _createClass(PerspectiveProjection, [{
    key: "fov",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$7)[_state$7].fov;
    }
    /**
     * Sets the PerspectiveProjection's field-of-view angle (FOV).
     *
     * Default value is ````60.0````.
     *
     * @param value New field-of-view.
     */,
    set: function set(value) {
      if (value === _classPrivateFieldLooseBase(this, _state$7)[_state$7].fov) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$7)[_state$7].fov = value;
      this.setDirty();
    }
    /**
     * Gets the PerspectiveProjection's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value is ````"min"````.
     *
     * @returns {String} The current FOV axis value.
     */
  }, {
    key: "fovAxis",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$7)[_state$7].fovAxis;
    }
    /**
     * Sets the PerspectiveProjection's FOV axis.
     *
     * Options are ````"x"````, ````"y"```` or ````"min"````, to use the minimum axis.
     *
     * Default value ````"min"````.
     *
     * @param value New FOV axis value.
     */,
    set: function set(value) {
      value = value || "min";
      if (_classPrivateFieldLooseBase(this, _state$7)[_state$7].fovAxis === value) {
        return;
      }
      if (value !== "x" && value !== "y" && value !== "min") {
        this.error("Unsupported value for 'fovAxis': " + value + " - defaulting to 'min'");
        value = "min";
      }
      _classPrivateFieldLooseBase(this, _state$7)[_state$7].fovAxis = value;
      this.setDirty();
    }
    /**
     * Gets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @returns The PerspectiveProjection's near plane position.
     */
  }, {
    key: "near",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$7)[_state$7].near;
    }
    /**
     * Sets the position of the PerspectiveProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New PerspectiveProjection near plane position.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$7)[_state$7].near === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$7)[_state$7].near = value;
      this.setDirty();
    }
    /**
     * Gets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
     *
     * @return {Number} The PerspectiveProjection's far plane position.
     */
  }, {
    key: "far",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$7)[_state$7].far;
    }
    /**
     * Sets the position of this PerspectiveProjection's far plane on the positive View-space Z-axis.
     *
     * @param value New PerspectiveProjection far plane position.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$7)[_state$7].far === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$7)[_state$7].far = value;
      this.setDirty();
    }
    /**
     * Gets the PerspectiveProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The PerspectiveProjection's projection matrix.
     */
  }, {
    key: "projMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      return _classPrivateFieldLooseBase(this, _state$7)[_state$7].projMatrix;
    }
    /**
     * Gets the inverse of {@link PerspectiveProjection.projMatrix}.
     *
     * @returns  The inverse of {@link PerspectiveProjection.projMatrix}.
     */
  }, {
    key: "inverseProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _inverseMatrixDirty$2)[_inverseMatrixDirty$2]) {
        matrix.inverseMat4(_classPrivateFieldLooseBase(this, _state$7)[_state$7].projMatrix, _classPrivateFieldLooseBase(this, _state$7)[_state$7].inverseProjMatrix);
        _classPrivateFieldLooseBase(this, _inverseMatrixDirty$2)[_inverseMatrixDirty$2] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$7)[_state$7].inverseProjMatrix;
    }
    /**
     * Gets the transpose of {@link PerspectiveProjection.projMatrix}.
     *
     * @returns  The transpose of {@link PerspectiveProjection.projMatrix}.
     */
  }, {
    key: "transposedProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$3)[_transposedProjMatrixDirty$3]) {
        matrix.transposeMat4(_classPrivateFieldLooseBase(this, _state$7)[_state$7].projMatrix, _classPrivateFieldLooseBase(this, _state$7)[_state$7].transposedProjMatrix);
        _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$3)[_transposedProjMatrixDirty$3] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$7)[_state$7].transposedProjMatrix;
    }
  }]);
  return PerspectiveProjection;
}(core.Component);
/**
 * The type of this projection.
 */
PerspectiveProjection.type = constants.PerspectiveProjectionType;

/**
 * Orthographic projection configuration for a {@link @xeokit/viewer!Camera} .
 *
 * * Located at {@link Camera.orthoProjection}.
 * * Works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are implicitly
 * indicated with a single {@link OrthoProjection.scale} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 * contain the number of units given by {@link OrthoProjection.scale}.
 * * {@link OrthoProjection.near} and {@link OrthoProjection.far} indicated the distances to the clipping planes.
 * * {@link OrthoProjection.onProjMatrix} will fire an event whenever {@link OrthoProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
var _state$6 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var _inverseMatrixDirty$1 = /*#__PURE__*/_classPrivateFieldLooseKey("inverseMatrixDirty");
var _transposedProjMatrixDirty$2 = /*#__PURE__*/_classPrivateFieldLooseKey("transposedProjMatrixDirty");
var _onViewBoundary = /*#__PURE__*/_classPrivateFieldLooseKey("onViewBoundary");
var OrthoProjection = /*#__PURE__*/function (_Component) {
  _inheritsLoose(OrthoProjection, _Component);
  /**
   * @private
   */
  function OrthoProjection(camera, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, camera, cfg) || this;
    /**
     * The Camera this OrthoProjection belongs to.
     */
    _this.camera = void 0;
    /**
     * Emits an event each time {@link OrthoProjection.projMatrix} updates.
     *
     * @event
     */
    _this.onProjMatrix = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$6, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _inverseMatrixDirty$1, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _transposedProjMatrixDirty$2, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _onViewBoundary, {
      writable: true,
      value: void 0
    });
    _this.camera = camera;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$6)[_state$6] = {
      near: cfg.near || 0.1,
      far: cfg.far || 2000.0,
      scale: cfg.scale || 1.0,
      projMatrix: matrix.createMat4(),
      inverseProjMatrix: matrix.createMat4(),
      transposedProjMatrix: matrix.createMat4()
    };
    _this.onProjMatrix = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _inverseMatrixDirty$1)[_inverseMatrixDirty$1] = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _transposedProjMatrixDirty$2)[_transposedProjMatrixDirty$2] = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _onViewBoundary)[_onViewBoundary] = _this.camera.view.onBoundary.subscribe(function () {
      _this.setDirty();
    });
    return _this;
  }
  /**
   * Gets scale factor for this OrthoProjection's extents on X and Y axis.
   *
   * Clamps to minimum value of ````0.01```.
   *
   * Default value is ````1.0````
   *
   * returns New OrthoProjection scale value.
   */
  var _proto = OrthoProjection.prototype;
  /**
   * @private
   */
  _proto.clean = function clean() {
    var WIDTH_INDEX = 2;
    var HEIGHT_INDEX = 3;
    var view = this.camera.view;
    var scale = _classPrivateFieldLooseBase(this, _state$6)[_state$6].scale;
    var halfSize = 0.5 * scale;
    var boundary = view.boundary;
    var boundaryWidth = boundary[WIDTH_INDEX];
    var boundaryHeight = boundary[HEIGHT_INDEX];
    var aspect = boundaryWidth / boundaryHeight;
    var left;
    var right;
    var top;
    var bottom;
    if (boundaryWidth > boundaryHeight) {
      left = -halfSize;
      right = halfSize;
      top = halfSize / aspect;
      bottom = -halfSize / aspect;
    } else {
      left = -halfSize * aspect;
      right = halfSize * aspect;
      top = halfSize;
      bottom = -halfSize;
    }
    matrix.orthoMat4c(left, right, bottom, top, _classPrivateFieldLooseBase(this, _state$6)[_state$6].near, _classPrivateFieldLooseBase(this, _state$6)[_state$6].far, _classPrivateFieldLooseBase(this, _state$6)[_state$6].projMatrix);
    _classPrivateFieldLooseBase(this, _inverseMatrixDirty$1)[_inverseMatrixDirty$1] = true;
    _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$2)[_transposedProjMatrixDirty$2] = true;
    this.camera.view.redraw();
    this.onProjMatrix.dispatch(this, _classPrivateFieldLooseBase(this, _state$6)[_state$6].projMatrix);
  }
  /**
   * Un-projects the given View-space coordinates, using this OrthoProjection projection.
   *
   * @param canvasPos Inputs 2D View-space coordinates.
   * @param screenZ Inputs Screen-space Z coordinate.
   * @param screenPos Outputs 3D Screen/Clip-space coordinates.
   * @param viewPos Outputs un-projected 3D View-space coordinates.
   * @param worldPos Outputs un-projected 3D World-space coordinates.
   */;
  _proto.unproject = function unproject(canvasPos, screenZ, screenPos, viewPos, worldPos) {
    var canvas = this.camera.view.canvasElement;
    var halfViewWidth = canvas.offsetWidth / 2.0;
    var halfViewHeight = canvas.offsetHeight / 2.0;
    screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
    screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
    screenPos[2] = screenZ;
    screenPos[3] = 1.0;
    matrix.mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
    matrix.mulVec3Scalar(viewPos, 1.0 / viewPos[3]);
    viewPos[3] = 1.0;
    viewPos[1] *= -1;
    matrix.mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);
    return worldPos;
  }
  /** @private
   *
   */;
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.camera.view.onBoundary.unsubscribe(_classPrivateFieldLooseBase(this, _onViewBoundary)[_onViewBoundary]);
    this.onProjMatrix.clear();
  };
  _createClass(OrthoProjection, [{
    key: "scale",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$6)[_state$6].scale;
    }
    /**
     * Sets scale factor for this OrthoProjection's extents on X and Y axis.
     *
     * Clamps to minimum value of ````0.01```.
     *
     * Default value is ````1.0````
     * @param value New scale value.
     */,
    set: function set(value) {
      if (value <= 0) {
        value = 0.01;
      }
      _classPrivateFieldLooseBase(this, _state$6)[_state$6].scale = value;
      this.setDirty();
    }
    /**
     * Gets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * returns New OrthoProjection near plane position.
     */
  }, {
    key: "near",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$6)[_state$6].near;
    }
    /**
     * Sets the position of the OrthoProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New OrthoProjection near plane position.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$6)[_state$6].near === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$6)[_state$6].near = value;
      this.setDirty();
    }
    /**
     * Gets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * returns New far ortho plane position.
     */
  }, {
    key: "far",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$6)[_state$6].far;
    }
    /**
     * Sets the position of the OrthoProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````2000.0````.
     *
     * @param value New far ortho plane position.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _state$6)[_state$6].far === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state$6)[_state$6].far = value;
      this.setDirty();
    }
    /**
     * Gets the OrthoProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns  The OrthoProjection's projection matrix.
     */
  }, {
    key: "projMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      return _classPrivateFieldLooseBase(this, _state$6)[_state$6].projMatrix;
    }
    /**
     * Gets the inverse of {@link OrthoProjection.projMatrix}.
     *
     * @returns  The inverse of {@link OrthoProjection.projMatrix}.
     */
  }, {
    key: "inverseProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _inverseMatrixDirty$1)[_inverseMatrixDirty$1]) {
        matrix.inverseMat4(_classPrivateFieldLooseBase(this, _state$6)[_state$6].projMatrix, _classPrivateFieldLooseBase(this, _state$6)[_state$6].inverseProjMatrix);
        _classPrivateFieldLooseBase(this, _inverseMatrixDirty$1)[_inverseMatrixDirty$1] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$6)[_state$6].inverseProjMatrix;
    }
    /**
     * Gets the transpose of {@link OrthoProjection.projMatrix}.
     *
     * @returns  The transpose of {@link OrthoProjection.projMatrix}.
     */
  }, {
    key: "transposedProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$2)[_transposedProjMatrixDirty$2]) {
        matrix.transposeMat4(_classPrivateFieldLooseBase(this, _state$6)[_state$6].projMatrix, _classPrivateFieldLooseBase(this, _state$6)[_state$6].transposedProjMatrix);
        _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$2)[_transposedProjMatrixDirty$2] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$6)[_state$6].transposedProjMatrix;
    }
  }]);
  return OrthoProjection;
}(core.Component);
/**
 * The type of this projection.
 */
OrthoProjection.type = constants.OrthoProjectionType;

/**
 *  FrustumProjection-based perspective projection configuration for a {@link @xeokit/viewer!Camera} .
 *
 * * Located at {@link Camera.frustumProjection}.
 * * Allows to explicitly set the positions of the left, right, top, bottom, near and far planes, which is useful for asymmetrical view volumes, such as for stereo viewing.
 * * {@link FrustumProjection.near} and {@link FrustumProjection.far} specify the distances to the clipping planes.
 * * {@link FrustumProjection.onProjMatrix} will fire an event whenever {@link FrustumProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
var _state$5 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var _inverseMatrixDirty = /*#__PURE__*/_classPrivateFieldLooseKey("inverseMatrixDirty");
var _transposedProjMatrixDirty$1 = /*#__PURE__*/_classPrivateFieldLooseKey("transposedProjMatrixDirty");
var FrustumProjection = /*#__PURE__*/function (_Component) {
  _inheritsLoose(FrustumProjection, _Component);
  /**
   * @private
   */
  function FrustumProjection(camera, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, camera, cfg) || this;
    /**
     * The Camera this FrustumProjection belongs to.
     */
    _this.camera = void 0;
    /**
     * Emits an event each time {@link FrustumProjection.projMatrix} updates.
     *
     * @event
     */
    _this.onProjMatrix = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$5, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _inverseMatrixDirty, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _transposedProjMatrixDirty$1, {
      writable: true,
      value: void 0
    });
    _this.camera = camera;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$5)[_state$5] = {
      projMatrix: matrix.createMat4(),
      inverseProjMatrix: matrix.createMat4(),
      transposedProjMatrix: matrix.createMat4(),
      near: 0.1,
      far: 10000.0,
      left: cfg.left !== undefined && cfg.left !== null ? cfg.left : -1.0,
      right: cfg.right !== undefined && cfg.right !== null ? cfg.right : 1.0,
      bottom: cfg.bottom !== undefined && cfg.bottom !== null ? cfg.bottom : -1.0,
      top: cfg.top !== undefined && cfg.top !== null ? cfg.top : 1.0
    };
    _this.onProjMatrix = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _inverseMatrixDirty)[_inverseMatrixDirty] = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _transposedProjMatrixDirty$1)[_transposedProjMatrixDirty$1] = true;
    return _this;
  }
  /**
   * Gets the position of the FrustumProjection's left plane on the View-space X-axis.
   *
   * @return {Number} Left frustum plane position.
   */
  var _proto = FrustumProjection.prototype;
  /**
   * @private
   */
  _proto.clean = function clean() {
    matrix.frustumMat4(_classPrivateFieldLooseBase(this, _state$5)[_state$5].left, _classPrivateFieldLooseBase(this, _state$5)[_state$5].right, _classPrivateFieldLooseBase(this, _state$5)[_state$5].bottom, _classPrivateFieldLooseBase(this, _state$5)[_state$5].top, _classPrivateFieldLooseBase(this, _state$5)[_state$5].near, _classPrivateFieldLooseBase(this, _state$5)[_state$5].far, _classPrivateFieldLooseBase(this, _state$5)[_state$5].projMatrix);
    _classPrivateFieldLooseBase(this, _inverseMatrixDirty)[_inverseMatrixDirty] = true;
    _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$1)[_transposedProjMatrixDirty$1] = true;
    this.camera.view.redraw();
    this.onProjMatrix.dispatch(this, _classPrivateFieldLooseBase(this, _state$5)[_state$5].projMatrix);
  }
  /**
   * Un-projects the given View-space coordinates, using this FrustumProjection projection.
   *
   * @param canvasPos Inputs 2D View-space coordinates.
   * @param screenZ Inputs Screen-space Z coordinate.
   * @param screenPos Outputs 3D Screen/Clip-space coordinates.
   * @param viewPos Outputs un-projected 3D View-space coordinates.
   * @param worldPos Outputs un-projected 3D World-space coordinates.
   */;
  _proto.unproject = function unproject(canvasPos, screenZ, screenPos, viewPos, worldPos) {
    var canvasElement = this.camera.view.canvasElement;
    var halfViewWidth = canvasElement.offsetWidth / 2.0;
    var halfViewHeight = canvasElement.offsetHeight / 2.0;
    screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
    screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
    screenPos[2] = screenZ;
    screenPos[3] = 1.0;
    matrix.mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
    matrix.mulVec3Scalar(viewPos, 1.0 / viewPos[3]);
    viewPos[3] = 1.0;
    viewPos[1] *= -1;
    matrix.mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);
    return worldPos;
  }
  /** @private
   *
   */;
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.onProjMatrix.clear();
  };
  _createClass(FrustumProjection, [{
    key: "left",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].left;
    }
    /**
     * Sets the position of the FrustumProjection's left plane on the View-space X-axis.
     *
     * @param value New left frustum plane position.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$5)[_state$5].left = value;
      this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's right plane on the View-space X-axis.
     *
     * @return {Number} Right frustum plane position.
     */
  }, {
    key: "right",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].right;
    }
    /**
     * Sets the position of the FrustumProjection's right plane on the View-space X-axis.
     *
     * @param value New right frustum plane position.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$5)[_state$5].right = value;
      this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's top plane on the View-space Y-axis.
     *
     * @return {Number} Top frustum plane position.
     */
  }, {
    key: "top",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].top;
    }
    /**
     * Sets the position of the FrustumProjection's top plane on the View-space Y-axis.
     *
     * @param value New top frustum plane position.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$5)[_state$5].top = value;
      this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
     *
     * @return {Number} Bottom frustum plane position.
     */
  }, {
    key: "bottom",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].bottom;
    }
    /**
     * Sets the position of the FrustumProjection's bottom plane on the View-space Y-axis.
     *
     * @param value New bottom frustum plane position.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$5)[_state$5].bottom = value;
      this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @return {Number} Near frustum plane position.
     */
  }, {
    key: "near",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].near;
    }
    /**
     * Sets the position of the FrustumProjection's near plane on the positive View-space Z-axis.
     *
     * Default value is ````0.1````.
     *
     * @param value New FrustumProjection near plane position.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$5)[_state$5].near = value;
      this.setDirty();
    }
    /**
     * Gets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @return {Number} Far frustum plane position.
     */
  }, {
    key: "far",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].far;
    }
    /**
     * Sets the position of the FrustumProjection's far plane on the positive View-space Z-axis.
     *
     * Default value is ````10000.0````.
     *
     * @param value New far frustum plane position.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$5)[_state$5].far = value;
      this.setDirty();
    }
    /**
     * Gets the FrustumProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @returns The FrustumProjection's projection matrix
     */
  }, {
    key: "projMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].projMatrix;
    }
    /**
     * Gets the inverse of {@link FrustumProjection.projMatrix}.
     *
     * @returns  The inverse orthographic projection projMatrix.
     */
  }, {
    key: "inverseProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _inverseMatrixDirty)[_inverseMatrixDirty]) {
        matrix.inverseMat4(_classPrivateFieldLooseBase(this, _state$5)[_state$5].projMatrix, _classPrivateFieldLooseBase(this, _state$5)[_state$5].inverseProjMatrix);
        _classPrivateFieldLooseBase(this, _inverseMatrixDirty)[_inverseMatrixDirty] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].inverseProjMatrix;
    }
    /**
     * Gets the transpose of {@link FrustumProjection.projMatrix}.
     *
     * @returns The transpose of {@link FrustumProjection.projMatrix}.
     */
  }, {
    key: "transposedProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$1)[_transposedProjMatrixDirty$1]) {
        matrix.transposeMat4(_classPrivateFieldLooseBase(this, _state$5)[_state$5].projMatrix, _classPrivateFieldLooseBase(this, _state$5)[_state$5].transposedProjMatrix);
        _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty$1)[_transposedProjMatrixDirty$1] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$5)[_state$5].transposedProjMatrix;
    }
  }]);
  return FrustumProjection;
}(core.Component);
/**
 * The type of this projection.
 */
FrustumProjection.type = constants.FrustumProjectionType;

/**
 * Configures a custom projection for a {@link @xeokit/viewer!Camera} .
 *
 * * Located at {@link Camera.customProjection}.
 * * {@link CustomProjection.onProjMatrix} will fire an event whenever {@link CustomProjection.projMatrix} updates, which indicates that one or more other properties have updated.
 */
var _state$4 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var _inverseProjMatrixDirty = /*#__PURE__*/_classPrivateFieldLooseKey("inverseProjMatrixDirty");
var _transposedProjMatrixDirty = /*#__PURE__*/_classPrivateFieldLooseKey("transposedProjMatrixDirty");
var CustomProjection = /*#__PURE__*/function (_Component) {
  _inheritsLoose(CustomProjection, _Component);
  /**
   * @private
   */
  function CustomProjection(camera, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, camera, cfg) || this;
    /**
     * The Camera this CustomProjection belongs to.
     */
    _this.camera = void 0;
    /**
     * Emits an event each time {@link CustomProjection.projMatrix} updates.
     *
     * @event
     */
    _this.onProjMatrix = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$4, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _inverseProjMatrixDirty, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _transposedProjMatrixDirty, {
      writable: true,
      value: void 0
    });
    _this.camera = camera;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$4)[_state$4] = {
      projMatrix: matrix.createMat4(cfg.projMatrix || matrix.identityMat4()),
      inverseProjMatrix: matrix.createMat4(),
      transposedProjMatrix: matrix.createMat4()
    };
    _this.onProjMatrix = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _inverseProjMatrixDirty)[_inverseProjMatrixDirty] = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _transposedProjMatrixDirty)[_transposedProjMatrixDirty] = false;
    return _this;
  }
  /**
   * Gets the CustomProjection's projection transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @return  New value for the CustomProjection's matrix.
   */
  var _proto = CustomProjection.prototype;
  /**
   * Un-projects the given View-space coordinates, using this CustomProjection.
   *
   * @param canvasPos Inputs 2D View-space coordinates.
   * @param screenZ Inputs Screen-space Z coordinate.
   * @param screenPos Outputs 3D Screen/Clip-space coordinates.
   * @param viewPos Outputs un-projected 3D View-space coordinates.
   * @param worldPos Outputs un-projected 3D World-space coordinates.
   */
  _proto.unproject = function unproject(canvasPos, screenZ, screenPos, viewPos, worldPos) {
    var canvasElement = this.camera.view.canvasElement;
    var halfViewWidth = canvasElement.offsetWidth / 2.0;
    var halfViewHeight = canvasElement.offsetHeight / 2.0;
    screenPos[0] = (canvasPos[0] - halfViewWidth) / halfViewWidth;
    screenPos[1] = (canvasPos[1] - halfViewHeight) / halfViewHeight;
    screenPos[2] = screenZ;
    screenPos[3] = 1.0;
    matrix.mulMat4v4(this.inverseProjMatrix, screenPos, viewPos);
    matrix.mulVec3Scalar(viewPos, 1.0 / viewPos[3]);
    viewPos[3] = 1.0;
    viewPos[1] *= -1;
    matrix.mulMat4v4(this.camera.inverseViewMatrix, viewPos, worldPos);
    return worldPos;
  }
  /** @private
   *
   */;
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.onProjMatrix.clear();
  };
  _createClass(CustomProjection, [{
    key: "projMatrix",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$4)[_state$4].projMatrix;
    }
    /**
     * Sets the CustomProjection's projection transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @param projMatrix New value for the CustomProjection's matrix.
     */,
    set: function set(projMatrix) {
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _state$4)[_state$4].projMatrix.set(projMatrix);
      _classPrivateFieldLooseBase(this, _inverseProjMatrixDirty)[_inverseProjMatrixDirty] = true;
      _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty)[_transposedProjMatrixDirty] = true;
      this.setDirty();
      this.camera.view.redraw();
      this.onProjMatrix.dispatch(this, _classPrivateFieldLooseBase(this, _state$4)[_state$4].projMatrix);
    }
    /**
     * Gets the inverse of {@link CustomProjection.projMatrix}.
     *
     * @returns The inverse of {@link CustomProjection.projMatrix}.
     */
  }, {
    key: "inverseProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _inverseProjMatrixDirty)[_inverseProjMatrixDirty]) {
        matrix.inverseMat4(_classPrivateFieldLooseBase(this, _state$4)[_state$4].projMatrix, _classPrivateFieldLooseBase(this, _state$4)[_state$4].inverseProjMatrix);
        _classPrivateFieldLooseBase(this, _inverseProjMatrixDirty)[_inverseProjMatrixDirty] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$4)[_state$4].inverseProjMatrix;
    }
    /**
     * Gets the transpose of {@link CustomProjection.projMatrix}.
     *
     * @returns The transpose of {@link CustomProjection.projMatrix}.
     */
  }, {
    key: "transposedProjMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      if (_classPrivateFieldLooseBase(this, _transposedProjMatrixDirty)[_transposedProjMatrixDirty]) {
        matrix.transposeMat4(_classPrivateFieldLooseBase(this, _state$4)[_state$4].projMatrix, _classPrivateFieldLooseBase(this, _state$4)[_state$4].transposedProjMatrix);
        _classPrivateFieldLooseBase(this, _transposedProjMatrixDirty)[_transposedProjMatrixDirty] = false;
      }
      return _classPrivateFieldLooseBase(this, _state$4)[_state$4].transposedProjMatrix;
    }
  }]);
  return CustomProjection;
}(core.Component);
/**
 * The type of this projection.
 */
CustomProjection.type = constants.CustomProjectionType;

var tempVec3$1 = matrix.createVec3();
var tempVec3b = matrix.createVec3();
var tempVec3c = matrix.createVec3();
var tempVec3d = matrix.createVec3();
var tempVec3e = matrix.createVec3();
var tempVec3f = matrix.createVec3();
var tempMat = matrix.createMat4();
var tempMatb = matrix.createMat4();
var eyeLookVec = matrix.createVec3();
var eyeLookVecNorm = matrix.createVec3();
var eyeLookOffset = matrix.createVec3();
var offsetEye = matrix.createVec3();
/**
 * Controls the viewpoint and projection for a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Located at {@link View.camera}
 * * Views are located at {@link Viewer.views}
 * * Controls camera viewing and projection transforms
 * * Provides methods to pan, zoom and orbit
 * * Dynamically configurable World-space axis
 * * Has {@link PerspectiveProjection}, {@link OrthoProjection} and {@link FrustumProjection} and {@link CustomProjection}, which you can dynamically switch between
 * * Switchable gimbal lock
 * * Can be flown to look at targets using the View's {@link CameraFlightAnimation}
 * * Can be animated along a path using a {@link CameraPathAnimation}
 *
 * ## Getting a View's Camera
 *
 * Let's create a {@link @xeokit/viewer!Viewer} with a single {@link @xeokit/viewer!View}, from which we'll get a Camera:
 *
 * ````javascript
 * const viewer = new Viewer();
 *
 * const view = new View(viewer, {
 *      canvasId: "myCanvas1"
 * });
 *
 * const camera = view.camera;
 * ````
 *
 * ## Setting the Camera Position
 *
 * Get and set the Camera's absolute position:
 *
 * ````javascript
 * camera.eye = [-10,0,0];
 * camera.look = [-10,0,0];
 * camera.up = [0,1,0];
 * ````
 *
 * ## Camera View and Projection Matrices
 *
 * The Camera's *view matrix* transforms coordinates from World-space to View-space:
 *
 * ````javascript
 * var viewMatrix = camera.viewMatrix;
 * ````
 *
 * {@link Camera.onViewMatrix} fires whenever {@link Camera.viewMatrix} updates:
 *
 * ````javascript
 * camera.onViewMatrix.subscribe((camera, matrix) => { ... });
 * ````
 *
 * ## Rotating the Camera
 *
 * Orbiting the {@link Camera.look} position:
 *
 * ````javascript
 * camera.orbitYaw(20.0);
 * camera.orbitPitch(10.0);
 * ````
 *
 * Perform a *first-person* rotation, in which we rotate {@link Camera.look} and {@link Camera.up} about {@link Camera.eye}:
 *
 * ````javascript
 * camera.yaw(5.0);
 * camera.pitch(-10.0);
 * ````
 *
 * ## Panning the Camera
 *
 * Pan along the Camera's local axis (ie. left/right, up/down, forward/backward):
 *
 * ````javascript
 * camera.pan([-20, 0, 10]);
 * ````
 *
 * ## Zooming the Camera
 *
 * Zoom to vary distance between {@link Camera.eye} and {@link Camera.look}:
 *
 * ````javascript
 * camera.zoom(-5); // Move five units closer
 * ````
 *
 * Get the current distance between {@link Camera.eye} and {@link Camera.look}:
 *
 * ````javascript
 * var distance = camera.eyeLookDist;
 * ````
 *
 * ## Projection
 *
 * The Camera has a Component to manage each projection type, which are: {@link PerspectiveProjection}, {@link OrthoProjection}
 * and {@link FrustumProjection} and {@link CustomProjection}.
 *
 * You can configure those components at any time, regardless of which is currently active:
 *
 * The Camera has a {@link PerspectiveProjection} to manage perspective
 * ````javascript
 *
 * // Set some properties on PerspectiveProjection
 * camera.perspectiveProjection.near = 0.4;
 * camera.perspectiveProjection.fov = 45;
 *
 * // Set some properties on OrthoProjection
 * camera.orthoProjection.near = 0.8;
 * camera.orthoProjection.far = 1000;
 *
 * // Set some properties on FrustumProjection
 * camera.frustumProjection.left = -1.0;
 * camera.frustumProjection.right = 1.0;
 * camera.frustumProjection.far = 1000.0;
 *
 * // Set the matrix property on CustomProjection
 * camera.customProjection.projMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
 *
 * // Switch between the projection types
 * Camera.projectionType = PerspectiveProjectionType; // Switch to perspective
 * Camera.projectionType = FrustumProjectiontype; // Switch to frustum
 * Camera.projectionType = OrthoProjectionType; // Switch to ortho
 * Camera.projectionType = CustomProjectionType; // Switch to custom
 * ````
 *
 * Camera provides the projection matrix for the currently active projection in {@link Camera.projMatrix}.
 *
 * Get the projection matrix:
 *
 * ````javascript
 * var projMatrix = camera.projMatrix;
 * ````
 *
 * Listen for projection matrix updates:
 *
 * ````javascript
 * camera.onProjMatrix((camera, matrix) => { ... });
 * ````
 *
 * ## Configuring World up direction
 *
 * We can dynamically configure the directions of the World-space coordinate system.
 *
 * Setting the +Y axis as World "up", +X as right and -Z as forwards (convention in some modeling software):
 *
 * ````javascript
 * camera.worldAxis = [
 *     1, 0, 0,    // Right
 *     0, 1, 0,    // Up
 *     0, 0,-1     // Forward
 * ];
 * ````
 *
 * Setting the +Z axis as World "up", +X as right and -Y as "up" (convention in most CAD and BIM viewers):
 *
 * ````javascript
 * camera.worldAxis = [
 *     1, 0, 0, // Right
 *     0, 0, 1, // Up
 *     0,-1, 0  // Forward
 * ];
 * ````
 *
 * The Camera has read-only convenience properties that provide each axis individually:
 *
 * ````javascript
 * var worldRight = camera.worldRight;
 * var worldForward = camera.worldForward;
 * var worldUp = camera.worldUp;
 * ````
 *
 * ## Gimbal locking
 *
 * By default, the Camera locks yaw rotation to pivot about the World-space "up" axis. We can dynamically lock and unlock that at any time:
 *
 * ````javascript
 * camera.gimbalLock = false; // Yaw rotation now happens about Camera's local Y-axis
 * camera.gimbalLock = true; // Yaw rotation now happens about World's "up" axis
 * ````
 *
 * See: <a href="https://en.wikipedia.org/wiki/Gimbal_lock">https://en.wikipedia.org/wiki/Gimbal_lock</a>
 */
var _state$3 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var _frustum = /*#__PURE__*/_classPrivateFieldLooseKey("frustum");
var _activeProjection = /*#__PURE__*/_classPrivateFieldLooseKey("activeProjection");
var Camera = /*#__PURE__*/function (_Component) {
  _inheritsLoose(Camera, _Component);
  /**
   * @private
   */
  function Camera(view, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, view, cfg) || this;
    /**
     * The View to which this Camera belongs.
     *
     * @property view
     * @type {View}
     * @final
     */
    _this.view = void 0;
    /**
     * The perspective projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link PerspectiveProjectionType}.
     */
    _this.perspectiveProjection = void 0;
    /**
     * The orthographic projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link OrthoProjectionType}.
     */
    _this.orthoProjection = void 0;
    /**
     * The frustum projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link FrustumProjectionType}.
     */
    _this.frustumProjection = void 0;
    /**
     * The custom projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link CustomProjectionType}.
     */
    _this.customProjection = void 0;
    /**
     * Emits an event each time {@link Camera.projectionType} updates.
     *
     * ````javascript
     * myView.camera.onProjectionType.subscribe((camera, projType) => { ... });
     * ````
     *
     * @event
     */
    _this.onProjectionType = void 0;
    /**
     * Emits an event each time {@link Camera.viewMatrix} updates.
     *
     * ````javascript
     * myView.camera.onViewMatrix.subscribe((camera, viewMatrix) => { ... });
     * ````
     *
     * @event
     */
    _this.onViewMatrix = void 0;
    /**
     * Emits an event each time {@link Camera.projMatrix} updates.
     *
     * ````javascript
     * myView.camera.onProjMatrix.subscribe((camera, projMatrix) => { ... });
     * ````
     *
     * @event
     */
    _this.onProjMatrix = void 0;
    /**
     * Emits an event each time {@link Camera.worldAxis} updates.
     *
     * ````javascript
     * myView.camera.onWorldAxis.subscribe((camera, worldAxis) => { ... });
     * ````
     *
     * @event
     */
    _this.onWorldAxis = void 0;
    /**
     * Emits an event each time {@link Camera.frustum} updates.
     *
     * ````javascript
     * myView.camera.onFrustum.subscribe((camera, frustum) => { ... });
     * ````
     *
     * @event
     */
    _this.onFrustum = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$3, {
      writable: true,
      value: void 0
    });
    /**
     * The viewing frustum.
     */
    Object.defineProperty(_assertThisInitialized(_this), _frustum, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _activeProjection, {
      writable: true,
      value: void 0
    });
    _this.onProjectionType = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onViewMatrix = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onProjMatrix = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onWorldAxis = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onFrustum = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$3)[_state$3] = {
      eye: matrix.createVec3(cfg.eye || [0, 0, 10]),
      look: matrix.createVec3(cfg.look || [0, 0, 0]),
      up: matrix.createVec3(cfg.up || [0, 1, 0]),
      worldUp: matrix.createVec3([0, 1, 0]),
      worldRight: matrix.createVec3([1, 0, 0]),
      worldForward: matrix.createVec3([0, 0, -1]),
      worldAxis: new Float32Array(cfg.worldAxis || [1, 0, 0, 0, 1, 0, 0, 0, 1]),
      gimbalLock: cfg.gimbalLock !== false,
      constrainPitch: cfg.constrainPitch === true,
      projectionType: cfg.projectionType || constants.PerspectiveProjectionType,
      deviceMatrix: cfg.deviceMatrix ? matrix.createMat4(cfg.deviceMatrix) : matrix.identityMat4(),
      hasDeviceMatrix: !!cfg.deviceMatrix,
      viewMatrix: matrix.createMat4(),
      viewNormalMatrix: matrix.createMat4(),
      inverseViewMatrix: matrix.createMat4()
    };
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _frustum)[_frustum] = new boundaries.Frustum3();
    _this.perspectiveProjection = new PerspectiveProjection(_assertThisInitialized(_this));
    _this.orthoProjection = new OrthoProjection(_assertThisInitialized(_this));
    _this.frustumProjection = new FrustumProjection(_assertThisInitialized(_this));
    _this.customProjection = new CustomProjection(_assertThisInitialized(_this));
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _activeProjection)[_activeProjection] = _this.perspectiveProjection;
    _this.perspectiveProjection.onProjMatrix.subscribe(function () {
      if (_classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$3)[_state$3].projectionType === constants.PerspectiveProjectionType) {
        _this.onProjMatrix.dispatch(_assertThisInitialized(_this), _this.perspectiveProjection.projMatrix);
      }
    });
    _this.orthoProjection.onProjMatrix.subscribe(function () {
      if (_classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$3)[_state$3].projectionType === constants.OrthoProjectionType) {
        _this.onProjMatrix.dispatch(_assertThisInitialized(_this), _this.orthoProjection.projMatrix);
      }
    });
    _this.frustumProjection.onProjMatrix.subscribe(function () {
      if (_classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$3)[_state$3].projectionType === constants.FrustumProjectionType) {
        _this.onProjMatrix.dispatch(_assertThisInitialized(_this), _this.frustumProjection.projMatrix);
      }
    });
    _this.customProjection.onProjMatrix.subscribe(function () {
      if (_classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$3)[_state$3].projectionType === constants.CustomProjectionType) {
        _this.onProjMatrix.dispatch(_assertThisInitialized(_this), _this.customProjection.projMatrix);
      }
    });
    return _this;
  }
  /**
   * Gets the currently active projection for this Camera.
   *
   * The currently active project is selected with {@link Camera.projectionType}.
   *
   * @returns {PerspectiveProjection|OrthoProjection|FrustumProjection|CustomProjection} The currently active projection is active.
   */
  var _proto = Camera.prototype;
  _proto.clean = function clean() {
    var state = _classPrivateFieldLooseBase(this, _state$3)[_state$3];
    // In ortho mode, build the view matrix with an eye position that's translated
    // well back from look, so that the front sectionPlane plane doesn't unexpectedly cut
    // the front off the view (not a problem with perspective, since objects close enough
    // to be clipped by the front plane are usually too big to see anything of their cross-sections).
    var eye;
    if (this.projectionType === constants.OrthoProjectionType) {
      matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, eyeLookVec);
      matrix.normalizeVec3(eyeLookVec, eyeLookVecNorm);
      matrix.mulVec3Scalar(eyeLookVecNorm, 1000.0, eyeLookOffset);
      matrix.addVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].look, eyeLookOffset, offsetEye);
      eye = offsetEye;
    } else {
      eye = _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye;
    }
    if (state.hasDeviceMatrix) {
      matrix.lookAtMat4v(eye, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempMatb);
      matrix.mulMat4(state.deviceMatrix, tempMatb, state.viewMatrix);
    } else {
      matrix.lookAtMat4v(eye, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, state.viewMatrix);
    }
    matrix.inverseMat4(_classPrivateFieldLooseBase(this, _state$3)[_state$3].viewMatrix, _classPrivateFieldLooseBase(this, _state$3)[_state$3].inverseViewMatrix);
    matrix.transposeMat4(_classPrivateFieldLooseBase(this, _state$3)[_state$3].inverseViewMatrix, _classPrivateFieldLooseBase(this, _state$3)[_state$3].viewNormalMatrix);
    this.view.redraw();
    boundaries.setFrustum3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].viewMatrix, _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection].projMatrix, _classPrivateFieldLooseBase(this, _frustum)[_frustum]);
    this.onViewMatrix.dispatch(this, _classPrivateFieldLooseBase(this, _state$3)[_state$3].viewMatrix);
    this.onFrustum.dispatch(this, _classPrivateFieldLooseBase(this, _frustum)[_frustum]);
  }
  /**
   * Rotates {@link Camera.eye} about {@link Camera.look}, around the {@link Camera.up} vector
   *
   * @param angleInc Angle of rotation in degrees
   */;
  _proto.orbitYaw = function orbitYaw(angleInc) {
    var lookEyeVec = matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, tempVec3$1);
    matrix.rotationMat4v(angleInc * 0.0174532925, _classPrivateFieldLooseBase(this, _state$3)[_state$3].gimbalLock ? _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp : _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempMat);
    lookEyeVec = matrix.transformPoint3(tempMat, lookEyeVec, tempVec3b);
    this.eye = matrix.addVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].look, lookEyeVec, tempVec3c); // Set eye position as 'look' plus 'eye' vector
    this.up = matrix.transformPoint3(tempMat, _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3d); // Rotate 'up' vector
  }
  /**
   * Rotates {@link Camera.eye} about {@link Camera.look} around the right axis (orthogonal to {@link Camera.up} and "look").
   *
   * @param angleInc Angle of rotation in degrees
   */;
  _proto.orbitPitch = function orbitPitch(angleInc) {
    if (_classPrivateFieldLooseBase(this, _state$3)[_state$3].constrainPitch) {
      angleInc = matrix.dotVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].up, _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp) / math.DEGTORAD;
      if (angleInc < 1) {
        return;
      }
    }
    var eye2 = matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, tempVec3$1);
    var left = matrix.cross3Vec3(matrix.normalizeVec3(eye2, tempVec3b), matrix.normalizeVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3c));
    matrix.rotationMat4v(angleInc * 0.0174532925, left, tempMat);
    eye2 = matrix.transformPoint3(tempMat, eye2, tempVec3d);
    this.up = matrix.transformPoint3(tempMat, _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3e);
    this.eye = matrix.addVec3(eye2, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, tempVec3f);
  }
  /**
   * Rotates {@link Camera.look} about {@link Camera.eye}, around the {@link Camera.up} vector.
   *
   * @param angleInc Angle of rotation in degrees
   */;
  _proto.yaw = function yaw(angleInc) {
    var look2 = matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].look, _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, tempVec3$1);
    matrix.rotationMat4v(angleInc * 0.0174532925, _classPrivateFieldLooseBase(this, _state$3)[_state$3].gimbalLock ? _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp : _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempMat);
    look2 = matrix.transformPoint3(tempMat, look2, tempVec3b);
    this.look = matrix.addVec3(look2, _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, tempVec3c);
    if (_classPrivateFieldLooseBase(this, _state$3)[_state$3].gimbalLock) {
      this.up = matrix.transformPoint3(tempMat, _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3d);
    }
  }
  /**
   * Rotates {@link Camera.look} about {@link Camera.eye}, around the right axis (orthogonal to {@link Camera.up} and "look").
    * @param angleInc Angle of rotation in degrees
   */;
  _proto.pitch = function pitch(angleInc) {
    if (_classPrivateFieldLooseBase(this, _state$3)[_state$3].constrainPitch) {
      angleInc = matrix.dotVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].up, _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp) / math.DEGTORAD;
      if (angleInc < 1) {
        return;
      }
    }
    var look2 = matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].look, _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, tempVec3$1);
    var left = matrix.cross3Vec3(matrix.normalizeVec3(look2, tempVec3b), matrix.normalizeVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3c));
    matrix.rotationMat4v(angleInc * 0.0174532925, left, tempMat);
    this.up = matrix.transformPoint3(tempMat, _classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3f);
    look2 = matrix.transformPoint3(tempMat, look2, tempVec3d);
    this.look = matrix.addVec3(look2, _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, tempVec3e);
  }
  /**
   * Pans the Camera along its local X, Y and Z axis.
   *
   * @param pan The pan vector
   */;
  _proto.pan = function pan(_pan) {
    var eye2 = matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, tempVec3$1);
    var vec = [0, 0, 0];
    var v;
    if (_pan[0] !== 0) {
      var left = matrix.cross3Vec3(matrix.normalizeVec3(eye2, []), matrix.normalizeVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3b));
      v = matrix.mulVec3Scalar(left, _pan[0]);
      vec[0] += v[0];
      vec[1] += v[1];
      vec[2] += v[2];
    }
    if (_pan[1] !== 0) {
      v = matrix.mulVec3Scalar(matrix.normalizeVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].up, tempVec3c), _pan[1]);
      vec[0] += v[0];
      vec[1] += v[1];
      vec[2] += v[2];
    }
    if (_pan[2] !== 0) {
      v = matrix.mulVec3Scalar(matrix.normalizeVec3(eye2, tempVec3d), _pan[2]);
      vec[0] += v[0];
      vec[1] += v[1];
      vec[2] += v[2];
    }
    this.eye = matrix.addVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, vec, tempVec3e);
    this.look = matrix.addVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].look, vec, tempVec3f);
  }
  /**
   * Increments/decrements the Camera's zoom factor, which is the distance between {@link Camera.eye} and {@link Camera.look}.
   *
   * @param delta Zoom factor increment.
   */;
  _proto.zoom = function zoom(delta) {
    var vec = matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, _classPrivateFieldLooseBase(this, _state$3)[_state$3].look, tempVec3$1);
    var lenLook = Math.abs(matrix.lenVec3(vec));
    var newLenLook = Math.abs(lenLook + delta);
    if (newLenLook < 0.5) {
      return;
    }
    var dir = matrix.normalizeVec3(vec, tempVec3c);
    this.eye = matrix.addVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].look, matrix.mulVec3Scalar(dir, newLenLook), tempVec3d);
  }
  /**
   * @private
   */;
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.onProjectionType.clear();
    this.onViewMatrix.clear();
    this.onProjMatrix.clear();
    this.onWorldAxis.clear();
  };
  _createClass(Camera, [{
    key: "project",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection];
    }
    /**
     * Gets the position of the Camera's eye.
     *
     * Default vale is ````[0,0,10]````.
     *
     * @type {Number[]} New eye position.
     */
  }, {
    key: "eye",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye;
    }
    /**
     * Sets the position of the Camera's eye.
     *
     * Default value is ````[0,0,10]````.
     *
     * @emits "eye" event on change, with the value of this property.
     * @type {Number[]} New eye position.
     */,
    set: function set(eye) {
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye.set(eye);
      this.setDirty(); // Ensure matrix built on next "tick"
    }
    /**
     * Gets the position of this Camera's point-of-interest.
     *
     * Default value is ````[0,0,0]````.
     *
     * @returns {Number[]} Camera look position.
     */
  }, {
    key: "look",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].look;
    }
    /**
     * Sets the position of this Camera's point-of-interest.
     *
     * Default value is ````[0,0,0]````.
     *
     * @param look Camera look position.
     */,
    set: function set(look) {
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].look.set(look);
      this.setDirty(); // Ensure matrix built on next "tick"
    }
    /**
     * Gets the direction of this Camera's {@link Camera.up} vector.
     *
     * @returns {Number[]} Direction of "up".
     */
  }, {
    key: "up",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].up;
    }
    /**
     * Sets the direction of this Camera's {@link Camera.up} vector.
     *
     * @param up Direction of "up".
     */,
    set: function set(up) {
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].up.set(up);
      this.setDirty();
    }
    /**
     * Gets the direction of World-space "up".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[0,1,0]````.
     *
     * @returns {Number[]} The "up" vector.
     */
  }, {
    key: "worldUp",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp;
    }
    /**
     * Gets the direction of World-space "right".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[1,0,0]````.
     *
     * @returns {Number[]} The "up" vector.
     */
  }, {
    key: "worldRight",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldRight;
    }
    /**
     * Gets the direction of World-space "forwards".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[0,0,1]````.
     *
     * @returns {Number[]} The "up" vector.
     */
  }, {
    key: "worldForward",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldForward;
    }
    /**
     * Gets whether to prevent camera from being pitched upside down.
     *
     * The camera is upside down when the angle between {@link Camera.up} and {@link Camera.worldUp} is less than one degree.
     *
     * Default value is ````false````.
     *
     * @returns {Boolean} ````true```` if pitch rotation is currently constrained.
     */
  }, {
    key: "constrainPitch",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].constrainPitch;
    }
    /**
     * Sets whether to prevent camera from being pitched upside down.
     *
     * The camera is upside down when the angle between {@link Camera.up} and {@link Camera.worldUp} is less than one degree.
     *
     * Default value is ````false````.
     *
     * @param value Set ````true```` to contrain pitch rotation.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].constrainPitch = value;
    }
    /**
     * Gets whether to lock yaw rotation to pivot about the World-space "up" axis.
     *
     * @returns {Boolean} Returns ````true```` if gimbal is locked.
     */
  }, {
    key: "gimbalLock",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].gimbalLock;
    }
    /**
     * Sets whether to lock yaw rotation to pivot about the World-space "up" axis.
     *
     * @params {Boolean} gimbalLock Set true to lock gimbal.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].gimbalLock = value;
    }
    /**
     * Gets the up, right and forward axis of the World coordinate system.
     *
     * Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````
     *
     * Default axis is ````[1, 0, 0, 0, 1, 0, 0, 0, 1]````
     *
     * @returns {Number[]} The current World coordinate axis.
     */
  }, {
    key: "worldAxis",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldAxis;
    }
    /**
     * Sets the up, right and forward axis of the World coordinate system.
     *
     * Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````
     *
     * Default axis is ````[1, 0, 0, 0, 1, 0, 0, 0, 1]````
     *
     * @param axis The new Wworld coordinate axis.
     */,
    set: function set(axis) {
      var state = _classPrivateFieldLooseBase(this, _state$3)[_state$3];
      // @ts-ignore
      state.worldAxis.set(axis);
      state.worldRight[0] = state.worldAxis[0];
      state.worldRight[1] = state.worldAxis[1];
      state.worldRight[2] = state.worldAxis[2];
      state.worldUp[0] = state.worldAxis[3];
      state.worldUp[1] = state.worldAxis[4];
      state.worldUp[2] = state.worldAxis[5];
      state.worldForward[0] = state.worldAxis[6];
      state.worldForward[1] = state.worldAxis[7];
      state.worldForward[2] = state.worldAxis[8];
      this.onWorldAxis.dispatch(this, state.worldAxis);
    }
    /**
     * Gets an optional matrix to premultiply into {@link Camera.projMatrix} matrix.
     *
     * @returns {Number[]} The matrix.
     */
  }, {
    key: "deviceMatrix",
    get: function get() {
      // @ts-ignore
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].deviceMatrix;
    }
    /**
     * Sets an optional matrix to premultiply into {@link Camera.projMatrix} matrix.
     *
     * This is intended to be used for stereo rendering with WebVR etc.
     *
     * @param matrix The matrix.
     */,
    set: function set(matrix) {
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].deviceMatrix.set(matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].hasDeviceMatrix = !!matrix;
      this.setDirty();
    }
    /**
     * Gets if the World-space X-axis is "up".
     * @returns {boolean}
     */
  }, {
    key: "xUp",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[0] > _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[1] && _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[0] > _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[2];
    }
    /**
     * Gets if the World-space Y-axis is "up".
     * @returns {boolean}
     */
  }, {
    key: "yUp",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[1] > _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[0] && _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[1] > _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[2];
    }
    /**
     * Gets if the World-space Z-axis is "up".
     * @returns {boolean}
     */
  }, {
    key: "zUp",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[2] > _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[0] && _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[2] > _classPrivateFieldLooseBase(this, _state$3)[_state$3].worldUp[1];
    }
    /**
     * Gets distance from {@link Camera.look} to {@link Camera.eye}.
     *
     * @returns {Number} The distance.
     */
  }, {
    key: "eyeLookDist",
    get: function get() {
      return matrix.lenVec3(matrix.subVec3(_classPrivateFieldLooseBase(this, _state$3)[_state$3].look, _classPrivateFieldLooseBase(this, _state$3)[_state$3].eye, tempVec3$1));
    }
    /**
     * Gets the Camera's viewing transformation matrix.
     *
     * @returns {Number[]} The viewing transform matrix.
     */
  }, {
    key: "viewMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].viewMatrix;
    }
    /**
     * Gets the inverse of the Camera's viewing transform matrix.
     *
     * @returns {Number[]} The inverse viewing transform matrix.
     */
  }, {
    key: "inverseViewMatrix",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].inverseViewMatrix;
    }
    /**
     * Gets the Camera's projection transformation projMatrix.
     *
     * @returns {Number[]} The projection matrix.
     */
  }, {
    key: "projMatrix",
    get: function get() {
      // @ts-ignore
      return _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection].projMatrix;
    }
    /**
     * Gets the Camera's 3D World-space viewing frustum.
     *
     * @returns {Frustum3} The frustum.
     */
  }, {
    key: "frustum",
    get: function get() {
      if (this.dirty) {
        this.cleanIfDirty();
      }
      return _classPrivateFieldLooseBase(this, _frustum)[_frustum];
    }
    /**
     * Gets the active projection type.
     *
     * Possible values are ````PerspectiveProjectionType````, ````OrthoProjectionType````, ````"frustum"```` and ````"customProjection"````.
     *
     * Default value is ````PerspectiveProjectionType````.
     *
     * @returns {number} Identifies the active projection type.
     */
  }, {
    key: "projectionType",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$3)[_state$3].projectionType;
    }
    /**
     * Sets the active projection type.
     *
     * Accepted values are ````PerspectiveProjectionType````, ````OrthoProjectionType````, ````"frustum"```` and ````"customProjection"````.
     *
     * Default value is ````PerspectiveProjectionType````.
     *
     * @param value Identifies the active projection type.
     */,
    set: function set(value) {
      value = value || constants.PerspectiveProjectionType;
      if (_classPrivateFieldLooseBase(this, _state$3)[_state$3].projectionType === value) {
        return;
      }
      if (value === constants.PerspectiveProjectionType) {
        _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection] = this.perspectiveProjection;
      } else if (value === constants.OrthoProjectionType) {
        _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection] = this.orthoProjection;
      } else if (value === constants.FrustumProjectionType) {
        _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection] = this.frustumProjection;
      } else if (value === constants.CustomProjectionType) {
        _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection] = this.customProjection;
      } else {
        this.error("Unsupported value for 'projection': " + value + " defaulting to PerspectiveProjectionType");
        _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection] = this.perspectiveProjection;
        value = constants.PerspectiveProjectionType;
      }
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection].clean();
      _classPrivateFieldLooseBase(this, _state$3)[_state$3].projectionType = value;
      this.clean();
      this.onProjectionType.dispatch(this, _classPrivateFieldLooseBase(this, _state$3)[_state$3].projectionType);
      this.onProjMatrix.dispatch(this, _classPrivateFieldLooseBase(this, _activeProjection)[_activeProjection].projMatrix);
    }
  }]);
  return Camera;
}(core.Component);

var tickEvent = {
  viewerId: "",
  time: 0,
  startTime: 0,
  prevTime: 0,
  deltaTime: 0
};
var _viewersRenderInfo = /*#__PURE__*/_classPrivateFieldLooseKey("viewersRenderInfo");
var _viewerIDMap = /*#__PURE__*/_classPrivateFieldLooseKey("viewerIDMap");
var _taskQueue = /*#__PURE__*/_classPrivateFieldLooseKey("taskQueue");
var _taskBudget = /*#__PURE__*/_classPrivateFieldLooseKey("taskBudget");
var _lastTime = /*#__PURE__*/_classPrivateFieldLooseKey("lastTime");
var _elapsedTime = /*#__PURE__*/_classPrivateFieldLooseKey("elapsedTime");
var _runTasks = /*#__PURE__*/_classPrivateFieldLooseKey("runTasks");
var _runTasksUntil = /*#__PURE__*/_classPrivateFieldLooseKey("runTasksUntil");
var _fireTickEvents = /*#__PURE__*/_classPrivateFieldLooseKey("fireTickEvents");
var _renderViewers = /*#__PURE__*/_classPrivateFieldLooseKey("renderViewers");
var Scheduler = /*#__PURE__*/function () {
  /**
   * @private
   */
  function Scheduler() {
    var _this = this;
    Object.defineProperty(this, _renderViewers, {
      value: _renderViewers2
    });
    Object.defineProperty(this, _fireTickEvents, {
      value: _fireTickEvents2
    });
    Object.defineProperty(this, _runTasksUntil, {
      value: _runTasksUntil2
    });
    Object.defineProperty(this, _runTasks, {
      value: _runTasks2
    });
    this.viewers = void 0;
    Object.defineProperty(this, _viewersRenderInfo, {
      writable: true,
      value: {}
    });
    // @ts-ignore
    Object.defineProperty(this, _viewerIDMap, {
      writable: true,
      value: new utils.Map()
    });
    // Ensures unique viewer IDs
    Object.defineProperty(this, _taskQueue, {
      writable: true,
      value: new utils.Queue()
    });
    // Task queue, which is pumped on each frame; tasks are pushed to it with calls to xeokit.schedule
    Object.defineProperty(this, _taskBudget, {
      writable: true,
      value: 10
    });
    // Millisecs we're allowed to spend on tasks in each frame
    Object.defineProperty(this, _lastTime, {
      writable: true,
      value: 0
    });
    Object.defineProperty(this, _elapsedTime, {
      writable: true,
      value: 0
    });
    this.viewers = {};
    var frame = function frame() {
      var time = Date.now();
      if (_classPrivateFieldLooseBase(_this, _lastTime)[_lastTime] > 0) {
        _classPrivateFieldLooseBase(_this, _elapsedTime)[_elapsedTime] = time - _classPrivateFieldLooseBase(_this, _lastTime)[_lastTime];
      }
      _classPrivateFieldLooseBase(_this, _runTasks)[_runTasks](time);
      _classPrivateFieldLooseBase(_this, _fireTickEvents)[_fireTickEvents](time);
      _classPrivateFieldLooseBase(_this, _renderViewers)[_renderViewers]();
      _classPrivateFieldLooseBase(_this, _lastTime)[_lastTime] = time;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  var _proto = Scheduler.prototype;
  _proto.registerViewer = function registerViewer(viewer) {
    if (viewer.id) {
      if (this.viewers[viewer.id]) {
        console.error("[ERROR] Viewer " + utils.inQuotes(viewer.id) + " already exists");
        return;
      }
    } else {
      // Auto-generated ID
      // @ts-ignore
      // noinspection JSConstantReassignment
      viewer.id = _classPrivateFieldLooseBase(this, _viewerIDMap)[_viewerIDMap].addItem({});
    }
    this.viewers[viewer.id] = viewer;
    // const ticksPerOcclusionTest = viewer.ticksPerOcclusionTest;
    // const ticksPerRender = viewer.ticksPerRender;
    _classPrivateFieldLooseBase(this, _viewersRenderInfo)[_viewersRenderInfo][viewer.id] = {
      // ticksPerOcclusionTest: ticksPerOcclusionTest,
      // ticksPerRender: ticksPerRender,
      // renderCountdown: ticksPerRender
    };
  };
  _proto.deregisterViewer = function deregisterViewer(viewer) {
    if (!this.viewers[viewer.id]) {
      return;
    }
    _classPrivateFieldLooseBase(this, _viewerIDMap)[_viewerIDMap].removeItem(viewer.id);
    delete this.viewers[viewer.id];
    delete _classPrivateFieldLooseBase(this, _viewersRenderInfo)[_viewersRenderInfo][viewer.id];
  };
  _proto.scheduleTask = function scheduleTask(callback, scope) {
    _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].push(callback);
    _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].push(scope);
  };
  _proto.getNumTasks = function getNumTasks() {
    return _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].length;
  };
  return Scheduler;
}();
function _runTasks2(time) {
  _classPrivateFieldLooseBase(this, _runTasksUntil)[_runTasksUntil](time + _classPrivateFieldLooseBase(this, _taskBudget)[_taskBudget]);
  this.getNumTasks();
  _classPrivateFieldLooseBase(this, _taskBudget)[_taskBudget];
}
function _runTasksUntil2(until) {
  if (until === void 0) {
    until = -1;
  }
  var time = new Date().getTime();
  var tasksRun = 0;
  while (_classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].length > 0 && (until < 0 || time < until)) {
    var callback = _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].shift();
    var scope = _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].shift();
    if (scope) {
      callback.call(scope);
    } else {
      callback();
    }
    time = new Date().getTime();
    tasksRun++;
  }
  return tasksRun;
}
function _fireTickEvents2(time) {
  tickEvent.time = time;
  for (var id in scheduler.viewers) {
    if (this.viewers.hasOwnProperty(id)) {
      var viewer = this.viewers[id];
      tickEvent.viewerId = id;
      tickEvent.startTime = viewer.startTime;
      tickEvent.deltaTime = tickEvent.prevTime != null ? tickEvent.time - tickEvent.prevTime : 0;
      viewer.onTick.dispatch(viewer, tickEvent);
    }
  }
  tickEvent.prevTime = time;
}
function _renderViewers2() {
  for (var id in this.viewers) {
    if (this.viewers.hasOwnProperty(id)) {
      var viewer = this.viewers[id];
      var renderInfo = _classPrivateFieldLooseBase(this, _viewersRenderInfo)[_viewersRenderInfo][id];
      if (!renderInfo) {
        renderInfo = _classPrivateFieldLooseBase(this, _viewersRenderInfo)[_viewersRenderInfo][id] = {}; // FIXME
      }
      // const ticksPerOcclusionTest = viewer.ticksPerOcclusionTest;
      // if (renderInfo.ticksPerOcclusionTest !== ticksPerOcclusionTest) {
      //     renderInfo.ticksPerOcclusionTest = ticksPerOcclusionTest;
      //     renderInfo.renderCountdown = ticksPerOcclusionTest;
      // }
      // if (--viewer.occlusionTestCountdown <= 0) {
      //     viewer.doOcclusionTest();
      //     viewer.occlusionTestCountdown = ticksPerOcclusionTest;
      // }
      //
      // ticksPerRender = viewer.ticksPerRender;
      // if (renderInfo.ticksPerRender !== ticksPerRender) {
      //     renderInfo.ticksPerRender = ticksPerRender;
      //     renderInfo.renderCountdown = ticksPerRender;
      // }
      // if (--renderInfo.renderCountdown === 0) {
      viewer.render({});
      //     renderInfo.renderCountdown = ticksPerRender;
      // }
    }
  }
}

var scheduler = new Scheduler();

var tempVec3 = matrix.createVec3();
var newLook = matrix.createVec3();
var newEye = matrix.createVec3();
var newUp = matrix.createVec3();
var newLookEyeVec = matrix.createVec3();
/**
 * Animates its {@link View |View's} {@link @xeokit/viewer!Camera}  to look at specified objects, boundaries or locations.
 *
 * ## Summary
 *
 * * Belongs to a {@link @xeokit/viewer!View}, and is located at {@link View.cameraFlight}
 * * Controls the View's {@link @xeokit/viewer!Camera} , which is located at {@link View.camera}
 * * Navigates the Camera to look at a {@link ViewerObject} or boundary
 * * Navigates the Camera to an explicit position given as ````eye````, ````look```` and ````up```` vectors
 * * Jumps or flies the Camera
 * * Smoothly transitions between projections
 */
var _duration = /*#__PURE__*/_classPrivateFieldLooseKey("duration");
var _look = /*#__PURE__*/_classPrivateFieldLooseKey("look1");
var _eye = /*#__PURE__*/_classPrivateFieldLooseKey("eye1");
var _up = /*#__PURE__*/_classPrivateFieldLooseKey("up1");
var _look2 = /*#__PURE__*/_classPrivateFieldLooseKey("look2");
var _eye2 = /*#__PURE__*/_classPrivateFieldLooseKey("eye2");
var _up2 = /*#__PURE__*/_classPrivateFieldLooseKey("up2");
var _orthoScale = /*#__PURE__*/_classPrivateFieldLooseKey("orthoScale1");
var _orthoScale2 = /*#__PURE__*/_classPrivateFieldLooseKey("orthoScale2");
var _fit = /*#__PURE__*/_classPrivateFieldLooseKey("fit");
var _trail = /*#__PURE__*/_classPrivateFieldLooseKey("trail");
var _flying = /*#__PURE__*/_classPrivateFieldLooseKey("flying");
var _flyEyeLookUp = /*#__PURE__*/_classPrivateFieldLooseKey("flyEyeLookUp");
var _flyingEye = /*#__PURE__*/_classPrivateFieldLooseKey("flyingEye");
var _flyingLook = /*#__PURE__*/_classPrivateFieldLooseKey("flyingLook");
var _callback = /*#__PURE__*/_classPrivateFieldLooseKey("callback");
var _callbackScope = /*#__PURE__*/_classPrivateFieldLooseKey("callbackScope");
var _time = /*#__PURE__*/_classPrivateFieldLooseKey("time1");
var _time2 = /*#__PURE__*/_classPrivateFieldLooseKey("time2");
var _flyingEyeLookUp = /*#__PURE__*/_classPrivateFieldLooseKey("flyingEyeLookUp");
var _fitFOV = /*#__PURE__*/_classPrivateFieldLooseKey("fitFOV");
var _projection = /*#__PURE__*/_classPrivateFieldLooseKey("projection2");
var _projMatrix = /*#__PURE__*/_classPrivateFieldLooseKey("projMatrix1");
var _projMatrix2 = /*#__PURE__*/_classPrivateFieldLooseKey("projMatrix2");
var _jumpTo = /*#__PURE__*/_classPrivateFieldLooseKey("jumpTo");
var _update = /*#__PURE__*/_classPrivateFieldLooseKey("update");
var _ease = /*#__PURE__*/_classPrivateFieldLooseKey("ease");
var _easeInCubic = /*#__PURE__*/_classPrivateFieldLooseKey("easeInCubic");
var _easeOutExpo = /*#__PURE__*/_classPrivateFieldLooseKey("easeOutExpo");
var CameraFlightAnimation = /*#__PURE__*/function (_Component) {
  _inheritsLoose(CameraFlightAnimation, _Component);
  /**
   @private
   */
  function CameraFlightAnimation(view, cfg) {
    var _this;
    _this = _Component.call(this, view, cfg) || this;
    Object.defineProperty(_assertThisInitialized(_this), _update, {
      value: _update2
    });
    Object.defineProperty(_assertThisInitialized(_this), _jumpTo, {
      value: _jumpTo2
    });
    /**
     * The View that owns this CameraFlightAnimation.
     */
    _this.view = void 0;
    /**
     * The Camera controlled by this CameraFlightAnimation.
     */
    _this.camera = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _duration, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _look, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _eye, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _up, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _look2, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _eye2, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _up2, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _orthoScale, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _orthoScale2, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _fit, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _trail, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _flying, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _flyEyeLookUp, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _flyingEye, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _flyingLook, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _callback, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _callbackScope, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _time, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _time2, {
      writable: true,
      value: void 0
    });
    _this.easing = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _flyingEyeLookUp, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _fitFOV, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _projection, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _projMatrix, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _projMatrix2, {
      writable: true,
      value: void 0
    });
    /**
     * Emits an event each time the animation starts.
     *
     * @event
     */
    _this.onStarted = void 0;
    /**
     * Emits an event each time the animation stops.
     *
     * @event
     */
    _this.onStopped = void 0;
    /**
     * Emits an event each time the animation stops.
     *
     * @event
     */
    _this.onCancelled = void 0;
    _this.view = view;
    _this.camera = view.camera;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _look)[_look] = matrix.createVec3();
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _eye)[_eye] = matrix.createVec3();
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _up)[_up] = matrix.createVec3();
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _look2)[_look2] = matrix.createVec3();
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _eye2)[_eye2] = matrix.createVec3();
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _up2)[_up2] = matrix.createVec3();
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _orthoScale)[_orthoScale] = 1;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _orthoScale2)[_orthoScale2] = 1;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _flying)[_flying] = false;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _flyEyeLookUp)[_flyEyeLookUp] = false;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _flyingEye)[_flyingEye] = false;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _flyingLook)[_flyingLook] = false;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _callback)[_callback] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _callbackScope)[_callbackScope] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _time)[_time] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _time2)[_time2] = null;
    _this.easing = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _trail)[_trail] = false;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _fit)[_fit] = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _duration)[_duration] = 500;
    _this.onStarted = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onStopped = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onCancelled = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    return _this;
  }
  /**
   * Flies the {@link @xeokit/viewer!Camera}  to a target.
   *
   *  * When the target is a boundary, the {@link @xeokit/viewer!Camera}  will fly towards the target and stop when the target fills most of the canvas.
   *  * When the target is an explicit {@link @xeokit/viewer!Camera}  position, given as ````eye````, ````look```` and ````up````, then CameraFlightAnimation will interpolate the {@link @xeokit/viewer!Camera}  to that target and stop there.
   *
   * @param {Object|Component} [params=Scene] Either a parameters object or a {@link @xeokit/core!Component} subtype that has
   * an AABB. Defaults to the {@link Scene}, which causes the {@link @xeokit/viewer!Camera}  to fit the Scene in view.
   * @param [params.arc=0] Factor in range ````[0..1]```` indicating how much the {@link Camera.eye} position
   * will swing away from its {@link Camera.look} position as it flies to the target.
   * @param {Number|String|Component} [params.component] ID or instance of a component to fly to. Defaults to the entire {@link Scene}.
   * @param [params.aabb] World-space axis-aligned bounding box (AABB) target to fly to.
   * @param [params.eye] Position to fly the eye position to.
   * @param [params.look] Position to fly the look position to.
   * @param [params.up] Position to fly the up vector to.
   * @param [params.projection] Projection type to transition into as we fly. Can be any of the values of {@link Camera.projectionType}.
   * @param [params.fit=true] Whether to fit the target to the view volume. Overrides {@link CameraFlightAnimation.fit}.
   * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link ViewerObject} or its AABB should
   * fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV}.
   * @param [params.duration] Flight duration in seconds.  Overrides {@link CameraFlightAnimation.duration}.
   * @param [params.orthoScale] Animate the Camera's orthographic scale to this target value. See {@link Ortho.scale}.
   * @param {Function} [callback] Callback fired on arrival.
   * @param {Object} [scope] Optional scope for callback.
   */
  var _proto = CameraFlightAnimation.prototype;
  _proto.flyTo = function flyTo(params, callback) {
    if (params === void 0) {
      params = {};
    }
    if (_classPrivateFieldLooseBase(this, _flying)[_flying]) {
      this.stop();
    }
    _classPrivateFieldLooseBase(this, _flying)[_flying] = false;
    _classPrivateFieldLooseBase(this, _flyingEye)[_flyingEye] = false;
    _classPrivateFieldLooseBase(this, _flyingLook)[_flyingLook] = false;
    _classPrivateFieldLooseBase(this, _flyingEyeLookUp)[_flyingEyeLookUp] = false;
    _classPrivateFieldLooseBase(this, _callback)[_callback] = callback;
    var camera = this.camera;
    var flyToProjection = !!params.projection && params.projection !== camera.projectionType;
    _classPrivateFieldLooseBase(this, _eye)[_eye][0] = camera.eye[0];
    _classPrivateFieldLooseBase(this, _eye)[_eye][1] = camera.eye[1];
    _classPrivateFieldLooseBase(this, _eye)[_eye][2] = camera.eye[2];
    _classPrivateFieldLooseBase(this, _look)[_look][0] = camera.look[0];
    _classPrivateFieldLooseBase(this, _look)[_look][1] = camera.look[1];
    _classPrivateFieldLooseBase(this, _look)[_look][2] = camera.look[2];
    _classPrivateFieldLooseBase(this, _up)[_up][0] = camera.up[0];
    _classPrivateFieldLooseBase(this, _up)[_up][1] = camera.up[1];
    _classPrivateFieldLooseBase(this, _up)[_up][2] = camera.up[2];
    _classPrivateFieldLooseBase(this, _orthoScale)[_orthoScale] = camera.orthoProjection.scale;
    _classPrivateFieldLooseBase(this, _orthoScale2)[_orthoScale2] = params.orthoScale || _classPrivateFieldLooseBase(this, _orthoScale)[_orthoScale];
    var aabb;
    var eye;
    var look;
    var up;
    if (params.aabb) {
      aabb = params.aabb;
    } else if (params.eye && params.look || params.up) {
      // @ts-ignore
      eye = params.eye;
      // @ts-ignore
      look = params.look;
      // @ts-ignore
      up = params.up;
    } else if (params.eye) {
      eye = params.eye;
    } else if (params.look) {
      look = params.look;
    } else {
      if (!flyToProjection) {
        aabb = this.view.aabb;
      }
    }
    var poi = params.poi;
    // @ts-ignore
    if (aabb) {
      if (aabb[3] < aabb[0] || aabb[4] < aabb[1] || aabb[5] < aabb[2]) {
        // Don't fly to an inverted boundary
        return;
      }
      if (aabb[3] === aabb[0] && aabb[4] === aabb[1] && aabb[5] === aabb[2]) {
        // Don't fly to an empty boundary
        return;
      }
      aabb = aabb.slice();
      var aabbCenter = boundaries.getAABB3Center(aabb);
      _classPrivateFieldLooseBase(this, _look2)[_look2] = poi || aabbCenter;
      var eyeLookVec = matrix.subVec3(_classPrivateFieldLooseBase(this, _eye)[_eye], _classPrivateFieldLooseBase(this, _look)[_look], tempVec3);
      var eyeLookVecNorm = matrix.normalizeVec3(eyeLookVec);
      var diag = poi ? boundaries.getAABB3DiagPoint(aabb, poi) : boundaries.getAABB3Diag(aabb);
      var fitFOV = params.fitFOV || _classPrivateFieldLooseBase(this, _fitFOV)[_fitFOV];
      var sca = Math.abs(diag / Math.tan(fitFOV * math.DEGTORAD));
      _classPrivateFieldLooseBase(this, _orthoScale2)[_orthoScale2] = diag * 1.1;
      _classPrivateFieldLooseBase(this, _eye2)[_eye2][0] = _classPrivateFieldLooseBase(this, _look2)[_look2][0] + eyeLookVecNorm[0] * sca;
      _classPrivateFieldLooseBase(this, _eye2)[_eye2][1] = _classPrivateFieldLooseBase(this, _look2)[_look2][1] + eyeLookVecNorm[1] * sca;
      _classPrivateFieldLooseBase(this, _eye2)[_eye2][2] = _classPrivateFieldLooseBase(this, _look2)[_look2][2] + eyeLookVecNorm[2] * sca;
      _classPrivateFieldLooseBase(this, _up2)[_up2][0] = _classPrivateFieldLooseBase(this, _up)[_up][0];
      _classPrivateFieldLooseBase(this, _up2)[_up2][1] = _classPrivateFieldLooseBase(this, _up)[_up][1];
      _classPrivateFieldLooseBase(this, _up2)[_up2][2] = _classPrivateFieldLooseBase(this, _up)[_up][2];
      _classPrivateFieldLooseBase(this, _flyingEyeLookUp)[_flyingEyeLookUp] = true;
      // @ts-ignore
    } else if (eye || look || up) {
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _flyingEyeLookUp)[_flyingEyeLookUp] = !!eye && !!look && !!up;
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _flyingEye)[_flyingEye] = !!eye && !look;
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _flyingLook)[_flyingLook] = !!look && !eye;
      // @ts-ignore
      if (eye) {
        _classPrivateFieldLooseBase(this, _eye2)[_eye2][0] = eye[0];
        _classPrivateFieldLooseBase(this, _eye2)[_eye2][1] = eye[1];
        _classPrivateFieldLooseBase(this, _eye2)[_eye2][2] = eye[2];
      }
      // @ts-ignore
      if (look) {
        _classPrivateFieldLooseBase(this, _look2)[_look2][0] = look[0];
        _classPrivateFieldLooseBase(this, _look2)[_look2][1] = look[1];
        _classPrivateFieldLooseBase(this, _look2)[_look2][2] = look[2];
      }
      // @ts-ignore
      if (up) {
        _classPrivateFieldLooseBase(this, _up2)[_up2][0] = up[0];
        _classPrivateFieldLooseBase(this, _up2)[_up2][1] = up[1];
        _classPrivateFieldLooseBase(this, _up2)[_up2][2] = up[2];
      }
    }
    if (flyToProjection) {
      if (params.projection === constants.OrthoProjectionType && camera.projectionType !== constants.OrthoProjectionType) {
        _classPrivateFieldLooseBase(this, _projection)[_projection] = constants.OrthoProjectionType;
        _classPrivateFieldLooseBase(this, _projMatrix)[_projMatrix] = camera.projMatrix.slice();
        _classPrivateFieldLooseBase(this, _projMatrix2)[_projMatrix2] = camera.orthoProjection.projMatrix.slice();
        camera.projectionType = constants.CustomProjectionType;
      }
      if (params.projection === constants.PerspectiveProjectionType && camera.projectionType !== constants.PerspectiveProjectionType) {
        _classPrivateFieldLooseBase(this, _projection)[_projection] = constants.PerspectiveProjectionType;
        _classPrivateFieldLooseBase(this, _projMatrix)[_projMatrix] = camera.projMatrix.slice();
        _classPrivateFieldLooseBase(this, _projMatrix2)[_projMatrix2] = camera.perspectiveProjection.projMatrix.slice();
        camera.projectionType = constants.CustomProjectionType;
      }
    } else {
      // @ts-ignore
      _classPrivateFieldLooseBase(this, _projection)[_projection] = null;
    }
    this.onStarted.dispatch(this, null);
    _classPrivateFieldLooseBase(this, _time)[_time] = Date.now();
    _classPrivateFieldLooseBase(this, _time2)[_time2] = _classPrivateFieldLooseBase(this, _time)[_time] + (params.duration ? params.duration * 1000 : _classPrivateFieldLooseBase(this, _duration)[_duration]);
    _classPrivateFieldLooseBase(this, _flying)[_flying] = true; // False as soon as we stop
    scheduler.scheduleTask(_classPrivateFieldLooseBase(this, _update)[_update], this);
  }
  /**
   * Jumps the {@link @xeokit/viewer!View}'s {@link @xeokit/viewer!Camera}  to the given target.
   *
   * * When the target is a boundary, this CameraFlightAnimation will position the {@link @xeokit/viewer!Camera}  at where the target fills most of the canvas.
   * * When the target is an explicit {@link @xeokit/viewer!Camera}  position, given as ````eye````, ````look```` and ````up```` vectors, then this CameraFlightAnimation will jump the {@link @xeokit/viewer!Camera}  to that target.
   *
   * @param {*|Component} params  Either a parameters object or a {@link @xeokit/core!Component} subtype that has a World-space AABB.
   * @param [params.arc=0]  Factor in range [0..1] indicating how much the {@link Camera.eye} will swing away from its {@link Camera.look} as it flies to the target.
   * @param {Number|String|Component} [params.component] ID or instance of a component to fly to.
   * @param [params.aabb]  World-space axis-aligned bounding box (AABB) target to fly to.
   * @param [params.eye] Position to fly the eye position to.
   * @param [params.look]  Position to fly the look position to.
   * @param [params.up] Position to fly the up vector to.
   * @param [params.projection] Projection type to transition into. Can be any of the values of {@link Camera.projectionType}.
   * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link ViewerObject} or its AABB should fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV}.
   * @param [params.fit] Whether to fit the target to the view volume. Overrides {@link CameraFlightAnimation.fit}.
   */;
  _proto.jumpTo = function jumpTo(params) {
    _classPrivateFieldLooseBase(this, _jumpTo)[_jumpTo](params);
  };
  /**
   * Stops an earlier {@link CameraFlightAnimation.flyTo}, fires arrival callback, then "stopped" event.
   */
  _proto.stop = function stop() {
    if (!_classPrivateFieldLooseBase(this, _flying)[_flying]) {
      return;
    }
    _classPrivateFieldLooseBase(this, _flying)[_flying] = false;
    _classPrivateFieldLooseBase(this, _time)[_time] = null;
    _classPrivateFieldLooseBase(this, _time2)[_time2] = null;
    if (_classPrivateFieldLooseBase(this, _projection)[_projection]) {
      this.camera.projectionType = _classPrivateFieldLooseBase(this, _projection)[_projection];
    }
    var callback = _classPrivateFieldLooseBase(this, _callback)[_callback];
    if (callback) {
      _classPrivateFieldLooseBase(this, _callback)[_callback] = null;
      callback();
    }
    this.onStopped.dispatch(this, null);
  }
  /**
   * Cancels a flight in progress, without calling the arrival callback.
   */;
  _proto.cancel = function cancel() {
    if (!_classPrivateFieldLooseBase(this, _flying)[_flying]) {
      return;
    }
    _classPrivateFieldLooseBase(this, _flying)[_flying] = false;
    _classPrivateFieldLooseBase(this, _time)[_time] = null;
    _classPrivateFieldLooseBase(this, _time2)[_time2] = null;
    if (_classPrivateFieldLooseBase(this, _callback)[_callback]) {
      _classPrivateFieldLooseBase(this, _callback)[_callback] = null;
    }
    this.onCancelled.dispatch(this, null);
  }
  /**
   * Sets the flight duration in seconds.
   *
   * Stops any flight currently in progress.
   *
   * Default value is ````0.5````.
   */;
  /**
   * @private
   */
  _proto.destroy = function destroy() {
    this.stop();
    _Component.prototype.destroy.call(this);
    this.onStarted.clear();
    this.onStopped.clear();
    this.onCancelled.clear();
  };
  _createClass(CameraFlightAnimation, [{
    key: "duration",
    get:
    /**
     * Gets the flight duration in seconds.
     *
     * Default value is ````0.5````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _duration)[_duration] / 1000.0;
    }
    /**
     * When flying to a {@link @xeokit/scene!SceneModel | SceneModel}, {@link ViewerObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link Camera.eye} from {@link Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _duration)[_duration] = value ? value * 1000.0 : 500;
      this.stop();
    }
  }, {
    key: "fit",
    get:
    /**
     * When flying to a {@link @xeokit/scene!SceneModel | SceneModel}, {@link ViewerObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link Camera.eye} from {@link Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _fit)[_fit];
    }
    /**
     * Sets how much of the perspective field-of-view, in degrees, that a target {@link ViewerObject.aabb} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _fit)[_fit] = value;
    }
  }, {
    key: "fitFOV",
    get:
    /**
     * Gets how much of the perspective field-of-view, in degrees, that a target {@link ViewerObject.aabb} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _fitFOV)[_fitFOV];
    }
    /**
     * Indicates if this CameraFlightAnimation will orient the {@link @xeokit/viewer!Camera}
     * in the direction that it is flying.
     *
     * Default value is ````false````.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _fitFOV)[_fitFOV] = value;
    }
  }, {
    key: "trail",
    get:
    /**
     * Indicates if this CameraFlightAnimation will orient the {@link @xeokit/viewer!Camera}
     * in the direction that it is flying.
     *
     * Default value is ````false````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _trail)[_trail];
    },
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _trail)[_trail] = value;
    }
  }]);
  return CameraFlightAnimation;
}(core.Component);
function _jumpTo2(params) {
  if (_classPrivateFieldLooseBase(this, _flying)[_flying]) {
    this.stop();
  }
  var camera = this.camera;
  var aabb;
  var newEye;
  var newLook;
  var newUp;
  if (params.aabb) {
    // Boundary3D
    aabb = params.aabb;
  } else if (params.eye || params.look || params.up) {
    // Camera pose
    newEye = params.eye;
    newLook = params.look;
    newUp = params.up;
  } else {
    aabb = this.view.aabb;
  }
  var poi = params.poi;
  // @ts-ignore
  if (aabb) {
    if (aabb[3] <= aabb[0] || aabb[4] <= aabb[1] || aabb[5] <= aabb[2]) {
      // Don't fly to an empty boundary
      return;
    }
    var diag = poi ? boundaries.getAABB3DiagPoint(aabb, poi) : boundaries.getAABB3Diag(aabb);
    // @ts-ignore
    newLook = poi || boundaries.getAABB3Center(aabb, newLook);
    if (_classPrivateFieldLooseBase(this, _trail)[_trail]) {
      matrix.subVec3(camera.look, newLook, newLookEyeVec);
    } else {
      matrix.subVec3(camera.eye, camera.look, newLookEyeVec);
    }
    matrix.normalizeVec3(newLookEyeVec);
    var dist;
    var fit = params.fit !== undefined ? params.fit : _classPrivateFieldLooseBase(this, _fit)[_fit];
    if (fit) {
      dist = Math.abs(diag / Math.tan((params.fitFOV || _classPrivateFieldLooseBase(this, _fitFOV)[_fitFOV]) * math.DEGTORAD));
    } else {
      dist = matrix.lenVec3(matrix.subVec3(camera.eye, camera.look, tempVec3));
    }
    matrix.mulVec3Scalar(newLookEyeVec, dist);
    camera.eye = matrix.addVec3(newLook, newLookEyeVec, tempVec3);
    camera.look = newLook;
    this.camera.orthoProjection.scale = diag * 1.1;
    // @ts-ignore
  } else if (newEye || newLook || newUp) {
    // @ts-ignore
    if (newEye) {
      camera.eye = newEye;
    } // @ts-ignore
    if (newLook) {
      camera.look = newLook;
    } // @ts-ignore
    if (newUp) {
      camera.up = newUp;
    }
  }
  if (params.projection) {
    camera.projectionType = params.projection;
  }
}
function _update2() {
  if (!_classPrivateFieldLooseBase(this, _flying)[_flying]) {
    return;
  }
  var time = Date.now();
  // @ts-ignore
  var t = (time - _classPrivateFieldLooseBase(this, _time)[_time]) / (_classPrivateFieldLooseBase(this, _time2)[_time2] - _classPrivateFieldLooseBase(this, _time)[_time]);
  var stopping = t >= 1;
  if (t > 1) {
    t = 1;
  }
  var tFlight = this.easing ? _classPrivateFieldLooseBase(CameraFlightAnimation, _ease)[_ease](t, 0, 1, 1) : t;
  var camera = this.camera;
  if (_classPrivateFieldLooseBase(this, _flyingEye)[_flyingEye] || _classPrivateFieldLooseBase(this, _flyingLook)[_flyingLook]) {
    if (_classPrivateFieldLooseBase(this, _flyingEye)[_flyingEye]) {
      matrix.subVec3(camera.eye, camera.look, newLookEyeVec);
      camera.eye = matrix.lerpVec3(tFlight, 0, 1, _classPrivateFieldLooseBase(this, _eye)[_eye], _classPrivateFieldLooseBase(this, _eye2)[_eye2], newEye);
      camera.look = matrix.subVec3(newEye, newLookEyeVec, newLook);
    } else if (_classPrivateFieldLooseBase(this, _flyingLook)[_flyingLook]) {
      camera.look = matrix.lerpVec3(tFlight, 0, 1, _classPrivateFieldLooseBase(this, _look)[_look], _classPrivateFieldLooseBase(this, _look2)[_look2], newLook);
      camera.up = matrix.lerpVec3(tFlight, 0, 1, _classPrivateFieldLooseBase(this, _up)[_up], _classPrivateFieldLooseBase(this, _up2)[_up2], newUp);
    }
  } else if (_classPrivateFieldLooseBase(this, _flyingEyeLookUp)[_flyingEyeLookUp]) {
    camera.eye = matrix.lerpVec3(tFlight, 0, 1, _classPrivateFieldLooseBase(this, _eye)[_eye], _classPrivateFieldLooseBase(this, _eye2)[_eye2], newEye);
    camera.look = matrix.lerpVec3(tFlight, 0, 1, _classPrivateFieldLooseBase(this, _look)[_look], _classPrivateFieldLooseBase(this, _look2)[_look2], newLook);
    camera.up = matrix.lerpVec3(tFlight, 0, 1, _classPrivateFieldLooseBase(this, _up)[_up], _classPrivateFieldLooseBase(this, _up2)[_up2], newUp);
  }
  if (_classPrivateFieldLooseBase(this, _projection)[_projection]) {
    var tProj = _classPrivateFieldLooseBase(this, _projection)[_projection] === constants.OrthoProjectionType ? _classPrivateFieldLooseBase(CameraFlightAnimation, _easeOutExpo)[_easeOutExpo](t, 0, 1, 1) : _classPrivateFieldLooseBase(CameraFlightAnimation, _easeInCubic)[_easeInCubic](t, 0, 1, 1);
    camera.customProjection.projMatrix = matrix.lerpMat4(tProj, 0, 1, _classPrivateFieldLooseBase(this, _projMatrix)[_projMatrix], _classPrivateFieldLooseBase(this, _projMatrix2)[_projMatrix2]);
  } else {
    camera.orthoProjection.scale = _classPrivateFieldLooseBase(this, _orthoScale)[_orthoScale] + t * (_classPrivateFieldLooseBase(this, _orthoScale2)[_orthoScale2] - _classPrivateFieldLooseBase(this, _orthoScale)[_orthoScale]);
  }
  if (stopping) {
    camera.orthoProjection.scale = _classPrivateFieldLooseBase(this, _orthoScale2)[_orthoScale2];
    this.stop();
    return;
  }
  scheduler.scheduleTask(_classPrivateFieldLooseBase(this, _update)[_update], this); // Keep flying
}
function _ease2(t, b, c, d) {
  t /= d;
  return -c * t * (t - 2) + b;
}
function _easeInCubic2(t, b, c, d) {
  t /= d;
  return c * t * t * t + b;
}
function _easeOutExpo2(t, b, c, d) {
  return c * (-Math.pow(2, -10 * t / d) + 1) + b;
}
Object.defineProperty(CameraFlightAnimation, _easeOutExpo, {
  value: _easeOutExpo2
});
Object.defineProperty(CameraFlightAnimation, _easeInCubic, {
  value: _easeInCubic2
});
Object.defineProperty(CameraFlightAnimation, _ease, {
  value: _ease2
});

/**
 * An independently-configurable view of the models in a {@link @xeokit/viewer!Viewer}.
 *
 * See {@link @xeokit/viewer} for usage.
 *
 * ## Overview
 *
 * A View is an independently-configurable view of the {@link RendererViewObject | ViewerObjects} existing within a Viewer, with
 * its own HTML canvas. A View automatically contains a {@link ViewObject} for each existing ViewerObject. ViewObjects
 * function as a kind of proxy for the ViewerObjects, through which we control their appearance
 * (show/hide/highlight etc.) within that particular View's canvas.
 *
 * Using Views, we can essentially have multiple canvases viewing the same model, each canvas perhaps showing a different subset
 * of the objects, with different visual effects, camera position etc.
 *
 * ## Quickstart
 *
 * * Create a View with {@link Viewer.createView}
 * * Control the View's viewpoint and projection with {@link View.camera}
 * * Create light sources with {@link View.createLightSource}
 * * Create slicing planes with {@link View createSectionPlane}
 * * Each View automatically has a {@link ViewObject} for every {@link RendererViewObject}
 * * Uses {@link ViewLayer | ViewLayers} to organize ViewObjects into layers
 * * Optionally uses ViewLayers to mask which ViewObjects are automatically maintained
 * * Control the visibility of ViewObjects with {@link View.setObjectsVisible}
 * * Emphasise ViewObjects with {@link View.setObjectsHighlighted}, {@link View.setObjectsSelected}, {@link View.setObjectsXRayed} and {@link View.setObjectsColorized}
 *
 * ## Examples
 *
 * Create a view in a given canvas, with three objects visible and a couple of object X-rayed (rendered translucent):
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * view1.setObjectsVisible(["myObject1", "myObject2", "myObject3", ...], true);
 * view1.setObjectsXRayed(["myObject1", "myObject", ...], true);
 * ````
 *
 * Create a second view, using a different canvas, that shows two objects visible, with one of them highlighted:
 *
 * ```` javascript
 * const view2 = myViewer.createView({
 *      id: "myView2",
 *      canvasId: "myView2"
 * });
 *
 * view2.camera.eye = [-1.4, 1.5, 15.8];
 * view2.camera.look = [4.0, 3.7, 1.8];
 * view2.camera.up = [0.0, 0.9, 0.0];
 *
 * view2.setObjectsVisible(["myObject1", "myObject3", ...], true);
 * view2.setObjectsHighlighted(["myObject3", ...], true);
 * ````
 */
var _onTick = /*#__PURE__*/_classPrivateFieldLooseKey("onTick");
var _backgroundColor = /*#__PURE__*/_classPrivateFieldLooseKey("backgroundColor");
var _backgroundColorFromAmbientLight = /*#__PURE__*/_classPrivateFieldLooseKey("backgroundColorFromAmbientLight");
var _resolutionScale = /*#__PURE__*/_classPrivateFieldLooseKey("resolutionScale");
var _numObjects = /*#__PURE__*/_classPrivateFieldLooseKey("numObjects");
var _objectIds = /*#__PURE__*/_classPrivateFieldLooseKey("objectIds");
var _numVisibleObjects = /*#__PURE__*/_classPrivateFieldLooseKey("numVisibleObjects");
var _visibleObjectIds = /*#__PURE__*/_classPrivateFieldLooseKey("visibleObjectIds");
var _numXRayedObjects = /*#__PURE__*/_classPrivateFieldLooseKey("numXRayedObjects");
var _xrayedObjectIds = /*#__PURE__*/_classPrivateFieldLooseKey("xrayedObjectIds");
var _numHighlightedObjects = /*#__PURE__*/_classPrivateFieldLooseKey("numHighlightedObjects");
var _highlightedObjectIds = /*#__PURE__*/_classPrivateFieldLooseKey("highlightedObjectIds");
var _numSelectedObjects = /*#__PURE__*/_classPrivateFieldLooseKey("numSelectedObjects");
var _selectedObjectIds = /*#__PURE__*/_classPrivateFieldLooseKey("selectedObjectIds");
var _numColorizedObjects = /*#__PURE__*/_classPrivateFieldLooseKey("numColorizedObjects");
var _colorizedObjectIds = /*#__PURE__*/_classPrivateFieldLooseKey("colorizedObjectIds");
var _numOpacityObjects = /*#__PURE__*/_classPrivateFieldLooseKey("numOpacityObjects");
var _opacityObjectIds = /*#__PURE__*/_classPrivateFieldLooseKey("opacityObjectIds");
var _qualityRender = /*#__PURE__*/_classPrivateFieldLooseKey("qualityRender");
var _lightsHash = /*#__PURE__*/_classPrivateFieldLooseKey("lightsHash");
var _sectionPlanesHash = /*#__PURE__*/_classPrivateFieldLooseKey("sectionPlanesHash");
var _registerSectionPlane = /*#__PURE__*/_classPrivateFieldLooseKey("registerSectionPlane");
var _deregisterSectionPlane = /*#__PURE__*/_classPrivateFieldLooseKey("deregisterSectionPlane");
var _initObjects = /*#__PURE__*/_classPrivateFieldLooseKey("initObjects");
var _createObjects = /*#__PURE__*/_classPrivateFieldLooseKey("createObjects");
var _destroyObjects = /*#__PURE__*/_classPrivateFieldLooseKey("destroyObjects");
var View = /*#__PURE__*/function (_Component) {
  _inheritsLoose(View, _Component);
  /**
   * @private
   */
  function View(options) {
    var _this;
    _this = _Component.call(this, null, options) || this;
    Object.defineProperty(_assertThisInitialized(_this), _destroyObjects, {
      value: _destroyObjects2
    });
    Object.defineProperty(_assertThisInitialized(_this), _createObjects, {
      value: _createObjects2
    });
    Object.defineProperty(_assertThisInitialized(_this), _initObjects, {
      value: _initObjects2
    });
    Object.defineProperty(_assertThisInitialized(_this), _deregisterSectionPlane, {
      value: _deregisterSectionPlane2
    });
    Object.defineProperty(_assertThisInitialized(_this), _registerSectionPlane, {
      value: _registerSectionPlane2
    });
    /**
     * The index of this View in {@link Viewer.viewList}.
     * @private
     */
    _this.viewIndex = void 0;
    /**
     * Manages the Camera for this View.
     */
    _this.camera = void 0;
    /**
     * The HTML canvas.
     */
    _this.canvasElement = void 0;
    /**
     * Indicates if this View is transparent.
     */
    _this.transparent = void 0;
    /**
     * Boundary of the canvas in absolute browser window coordinates.
     * Format is ````[xmin, ymin, xwidth, ywidth]````.
     */
    _this.boundary = void 0;
    /**
     * Whether the logarithmic depth buffer is enabled for this View.
     */
    _this.logarithmicDepthBufferEnabled = void 0;
    /**
     * Configures Scalable Ambient Obscurance (SAO) for this View.
     */
    _this.sao = void 0;
    /**
     * Flies or jumps the View's {@link @xeokit/viewer!Camera}  to given positions.
     */
    _this.cameraFlight = void 0;
    /**
     * Manages measurement units, origin and scale for this View.
     */
    _this.metrics = void 0;
    /**
     * Configures the X-rayed appearance of {@link ViewObject | ViewObjects} in this View.
     */
    _this.xrayMaterial = void 0;
    /**
     * Configures the highlighted appearance of {@link ViewObject | ViewObjects} in this View.
     */
    _this.highlightMaterial = void 0;
    /**
     * Configures the appearance of {@link ViewObject | ViewObjects} in this View.
     */
    _this.selectedMaterial = void 0;
    /**
     * Configures the appearance of edges belonging to {@link ViewObject} in this View.
     */
    _this.edgeMaterial = void 0;
    /**
     * Configures the appearance of point primitives belonging to {@link ViewObject | ViewObjects} in this View .
     */
    _this.pointsMaterial = void 0;
    /**
     * Configures the appearance of lines belonging to {@link ViewObject | ViewObjects} in this View.
     */
    _this.linesMaterial = void 0;
    /**
     * Map of the all {@link ViewObject | ViewObjects} in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     *
     * The View automatically ensures that there is a {@link ViewObject} here for
     * each {@link RendererViewObject} in the {@link @xeokit/viewer!Viewer}
     */
    _this.objects = void 0;
    /**
     * Map of the currently visible {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.visibleObjects = void 0;
    /**
     * Map of currently x-rayed {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.xrayedObjects = void 0;
    /**
     * Map of currently highlighted {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.highlightedObjects = void 0;
    /**
     * Map of currently selected {@link ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.selectedObjects = void 0;
    /**
     * Map of currently colorized {@link ViewObject | ViewObjects} in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.colorizedObjects = void 0;
    /**
     * Map of {@link ViewObject | ViewObjects} in this View whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    _this.opacityObjects = void 0;
    /**
     * Map of {@link SectionPlane}s in this View.
     *
     * Each {@link SectionPlane} is mapped here by {@link SectionPlane.id}.
     */
    _this.sectionPlanes = void 0;
    /**
     * List of {@link SectionPlane}s in this View.
     */
    _this.sectionPlanesList = [];
    /**
     * Map of light sources in this View.
     */
    _this.lights = void 0;
    /**
     * List of light sources in this View.
     */
    _this.lightsList = [];
    _this.gammaOutput = void 0;
    /**
     * Map of the all {@link ViewLayer}s in this View.
     *
     * Each {@link ViewLayer} is mapped here by {@link ViewLayer.id}.
     */
    _this.layers = void 0;
    /**
     * Whether the View will automatically create {@link ViewLayer | ViewLayers} on-demand
     * as {@link RendererViewObject | ViewerObjects} are created.
     *
     * When ````true```` (default), the View will automatically create {@link ViewLayer | ViewLayers} as needed for each new
     * {@link RendererViewObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects that have no
     * layerId. This default setting therefore ensures that a ViewObject is created in the View for every ViewerObject that is created.
     *
     * If you set this ````false````, however, then the View will only create {@link ViewObject | ViewObjects} for {@link RendererViewObject | ViewerObjects} that have
     * a {@link RendererViewObject.layerId} that matches the ID of a {@link ViewLayer} that you have explicitly created previously with {@link View.createLayer}.
     *
     * Setting this parameter false enables Views to contain only the ViewObjects that they actually need to show, i.e. to represent only
     * ViewerObjects that they need to view. This enables a View to avoid wastefully creating and maintaining ViewObjects for ViewerObjects
     * that it never needs to show.
     */
    _this.autoLayers = void 0;
    /**
     * Emits an event each time the canvas boundary changes.
     *
     * @event
     */
    _this.onBoundary = void 0;
    /**
     * Emits an event each time the visibility of a {@link ViewObject} changes in this View.
     *
     * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link ViewLayer.setObjectsVisible} or {@link ViewObject.visible}.
     *
     * @event
     */
    _this.onObjectVisibility = void 0;
    /**
     * Emits an event each time the X-ray state of a {@link ViewObject} changes in this View.
     *
     * ViewObjects are X-rayed with {@link View.setObjectsXRayed}, {@link ViewLayer.setObjectsXRayed} or {@link ViewObject.xrayed}.
     *
     * @event
     */
    _this.onObjectXRayed = void 0;
    /**
     * Emits an event each time a {@link ViewLayer} is created in this View.
     *
     * Layers are created explicitly with {@link View.createLayer}, or implicitly with {@link View.createModel} and {@link CreateModelParams.layerId}.
     *
     * @event
     */
    _this.onLayerCreated = void 0;
    /**
     * Emits an event each time a {@link ViewLayer} in this View is destroyed.
     *
     * ViewLayers are destroyed explicitly with {@link ViewLayer.destroy}, or implicitly when they become empty and {@link View.autoLayers} is false.
     *
     * @event
     */
    _this.onLayerDestroyed = void 0;
    /**
     * Emits an event each time a {@link SectionPlane} is created in this View.
     *
     * @event
     */
    _this.onSectionPlaneCreated = void 0;
    /**
     * Emits an event each time a {@link SectionPlane} in this View is destroyed.
     *
     * @event
     */
    _this.onSectionPlaneDestroyed = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _onTick, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _backgroundColor, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _backgroundColorFromAmbientLight, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _resolutionScale, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numObjects, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _objectIds, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numVisibleObjects, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _visibleObjectIds, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numXRayedObjects, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _xrayedObjectIds, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numHighlightedObjects, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _highlightedObjectIds, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numSelectedObjects, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _selectedObjectIds, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numColorizedObjects, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _colorizedObjectIds, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _numOpacityObjects, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _opacityObjectIds, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _qualityRender, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(_assertThisInitialized(_this), _lightsHash, {
      writable: true,
      value: null
    });
    Object.defineProperty(_assertThisInitialized(_this), _sectionPlanesHash, {
      writable: true,
      value: null
    });
    _this.viewer = options.viewer;
    var canvas = options.canvasElement || document.getElementById(options.canvasId);
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw "Mandatory View config expected: valid canvasId or canvasElement";
    }
    _this.canvasElement = canvas;
    _this.viewIndex = 0;
    _this.objects = {};
    _this.visibleObjects = {};
    _this.xrayedObjects = {};
    _this.highlightedObjects = {};
    _this.selectedObjects = {};
    _this.colorizedObjects = {};
    _this.opacityObjects = {};
    _this.sectionPlanes = {};
    _this.sectionPlanesList = [];
    _this.lights = {};
    _this.lightsList = [];
    _this.layers = {};
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numObjects)[_numObjects] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _objectIds)[_objectIds] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numVisibleObjects)[_numVisibleObjects] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _visibleObjectIds)[_visibleObjectIds] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numXRayedObjects)[_numXRayedObjects] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _xrayedObjectIds)[_xrayedObjectIds] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numHighlightedObjects)[_numHighlightedObjects] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _highlightedObjectIds)[_highlightedObjectIds] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numSelectedObjects)[_numSelectedObjects] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _selectedObjectIds)[_selectedObjectIds] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numColorizedObjects)[_numColorizedObjects] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _colorizedObjectIds)[_colorizedObjectIds] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _numOpacityObjects)[_numOpacityObjects] = 0;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _opacityObjectIds)[_opacityObjectIds] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _qualityRender)[_qualityRender] = !!options.qualityRender;
    _this.gammaOutput = true;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _sectionPlanesHash)[_sectionPlanesHash] = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _lightsHash)[_lightsHash] = null;
    // this.canvas = new View(this, {
    //     canvas: canvas,
    //     transparent: !!options.transparent,
    //     backgroundColor: options.backgroundColor,
    //     backgroundColorFromAmbientLight: !!options.backgroundColorFromAmbientLight,
    //     premultipliedAlpha: !!options.premultipliedAlpha
    // });
    //
    // this.canvas.onBoundary.subscribe(() => {
    //     this.redraw();
    // });
    _this.onBoundary = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _resolutionScale)[_resolutionScale] = 1;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _backgroundColor)[_backgroundColor] = matrix.createVec3([options.backgroundColor ? options.backgroundColor[0] : 1, options.backgroundColor ? options.backgroundColor[1] : 1, options.backgroundColor ? options.backgroundColor[2] : 1]);
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _backgroundColorFromAmbientLight)[_backgroundColorFromAmbientLight] = !!options.backgroundColorFromAmbientLight;
    _this.transparent = !!options.transparent;
    _this.canvasElement.width = _this.canvasElement.clientWidth;
    _this.canvasElement.height = _this.canvasElement.clientHeight;
    _this.boundary = [_this.canvasElement.offsetLeft, _this.canvasElement.offsetTop, _this.canvasElement.clientWidth, _this.canvasElement.clientHeight];
    // Publish canvasElement size and position changes on each scene tick
    var lastWindowWidth = 0;
    var lastWindowHeight = 0;
    var lastViewWidth = 0;
    var lastViewHeight = 0;
    var lastViewOffsetLeft = 0;
    var lastViewOffsetTop = 0;
    var lastParent = null;
    var lastResolutionScale = null;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _onTick)[_onTick] = _this.viewer.onTick.subscribe(function () {
      var canvasElement = _this.canvasElement;
      var newResolutionScale = _classPrivateFieldLooseBase(_assertThisInitialized(_this), _resolutionScale)[_resolutionScale] !== lastResolutionScale;
      var newWindowSize = window.innerWidth !== lastWindowWidth || window.innerHeight !== lastWindowHeight;
      var newViewSize = canvasElement.clientWidth !== lastViewWidth || canvasElement.clientHeight !== lastViewHeight;
      var newViewPos = canvasElement.offsetLeft !== lastViewOffsetLeft || canvasElement.offsetTop !== lastViewOffsetTop;
      var parent = canvasElement.parentElement;
      var newParent = parent !== lastParent;
      if (newResolutionScale || newWindowSize || newViewSize || newViewPos || newParent) {
        //   this._spinner._adjustPosition();
        if (newResolutionScale || newViewSize || newViewPos) {
          var newWidth = canvasElement.clientWidth;
          var newHeight = canvasElement.clientHeight;
          if (newResolutionScale || newViewSize) {
            canvasElement.width = Math.round(canvasElement.clientWidth * _classPrivateFieldLooseBase(_assertThisInitialized(_this), _resolutionScale)[_resolutionScale]);
            canvasElement.height = Math.round(canvasElement.clientHeight * _classPrivateFieldLooseBase(_assertThisInitialized(_this), _resolutionScale)[_resolutionScale]);
          }
          var boundary = _this.boundary;
          boundary[0] = canvasElement.offsetLeft;
          boundary[1] = canvasElement.offsetTop;
          boundary[2] = newWidth;
          boundary[3] = newHeight;
          if (!newResolutionScale || newViewSize) {
            _this.onBoundary.dispatch(_assertThisInitialized(_this), boundary);
          }
          lastViewWidth = newWidth;
          lastViewHeight = newHeight;
        }
        if (newResolutionScale) {
          lastResolutionScale = _classPrivateFieldLooseBase(_assertThisInitialized(_this), _resolutionScale)[_resolutionScale];
        }
        if (newWindowSize) {
          lastWindowWidth = window.innerWidth;
          lastWindowHeight = window.innerHeight;
        }
        if (newViewPos) {
          lastViewOffsetLeft = canvasElement.offsetLeft;
          lastViewOffsetTop = canvasElement.offsetTop;
        }
        lastParent = parent;
      }
    });
    _this.camera = new Camera(_assertThisInitialized(_this));
    _this.sao = new SAO(_assertThisInitialized(_this), {});
    _this.cameraFlight = new CameraFlightAnimation(_assertThisInitialized(_this), {
      duration: 0.5
    });
    _this.metrics = new Metrics(_assertThisInitialized(_this), {
      units: options.units,
      scale: options.scale,
      origin: options.origin
    });
    _this.xrayMaterial = new EmphasisMaterial(_assertThisInitialized(_this), {
      fill: true,
      fillColor: [0.9, 0.7, 0.6],
      fillAlpha: 0.4,
      edges: true,
      edgeColor: [0.5, 0.4, 0.4],
      edgeAlpha: 1.0,
      edgeWidth: 1
    });
    _this.highlightMaterial = new EmphasisMaterial(_assertThisInitialized(_this), {
      fill: true,
      fillColor: [1.0, 1.0, 0.0],
      fillAlpha: 0.5,
      edges: true,
      edgeColor: [0.5, 0.4, 0.4],
      edgeAlpha: 1.0,
      edgeWidth: 1
    });
    _this.selectedMaterial = new EmphasisMaterial(_assertThisInitialized(_this), {
      fill: true,
      fillColor: [0.0, 1.0, 0.0],
      fillAlpha: 0.5,
      edges: true,
      edgeColor: [0.4, 0.5, 0.4],
      edgeAlpha: 1.0,
      edgeWidth: 1
    });
    _this.edgeMaterial = new EdgeMaterial(_assertThisInitialized(_this), {
      edgeColor: [0.0, 0.0, 0.0],
      edgeAlpha: 1.0,
      edgeWidth: 1,
      edges: true,
      renderModes: [constants.QualityRender]
    });
    _this.pointsMaterial = new PointsMaterial(_assertThisInitialized(_this), {
      pointSize: 1,
      roundPoints: true,
      perspectivePoints: true,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 6,
      filterIntensity: false,
      minIntensity: 0,
      maxIntensity: 1
    });
    _this.linesMaterial = new LinesMaterial(_assertThisInitialized(_this), {
      lineWidth: 1
    });
    _this.lights = {};
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _qualityRender)[_qualityRender] = !!options.qualityRender;
    _this.autoLayers = options.autoLayers !== false;
    _this.logarithmicDepthBufferEnabled = !!options.logarithmicDepthBufferEnabled;
    _this.onObjectVisibility = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onObjectXRayed = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onLayerCreated = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onLayerDestroyed = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onSectionPlaneCreated = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onSectionPlaneDestroyed = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _initObjects)[_initObjects]();
    return _this;
  }
  /**
   *
   */
  var _proto = View.prototype;
  /**
   * @private
   */
  _proto.registerViewObject = function registerViewObject(viewObject) {
    this.objects[viewObject.id] = viewObject;
    _classPrivateFieldLooseBase(this, _numObjects)[_numObjects]++;
    _classPrivateFieldLooseBase(this, _objectIds)[_objectIds] = null; // Lazy regenerate
  }
  /**
   * @private
   */;
  _proto.deregisterViewObject = function deregisterViewObject(viewObject) {
    delete this.objects[viewObject.id];
    delete this.visibleObjects[viewObject.id];
    delete this.xrayedObjects[viewObject.id];
    delete this.highlightedObjects[viewObject.id];
    delete this.selectedObjects[viewObject.id];
    delete this.colorizedObjects[viewObject.id];
    delete this.opacityObjects[viewObject.id];
    _classPrivateFieldLooseBase(this, _numObjects)[_numObjects]--;
    _classPrivateFieldLooseBase(this, _objectIds)[_objectIds] = null; // Lazy regenerate
  }
  /**
   * @private
   */;
  _proto.objectVisibilityUpdated = function objectVisibilityUpdated(viewObject, visible, notify) {
    if (notify === void 0) {
      notify = true;
    }
    if (visible) {
      this.visibleObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numVisibleObjects)[_numVisibleObjects]++;
    } else {
      delete this.visibleObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numVisibleObjects)[_numVisibleObjects]--;
    }
    _classPrivateFieldLooseBase(this, _visibleObjectIds)[_visibleObjectIds] = null; // Lazy regenerate
    if (notify) {
      this.onObjectVisibility.dispatch(this, viewObject);
    }
  }
  /**
   * @private
   */;
  _proto.objectXRayedUpdated = function objectXRayedUpdated(viewObject, xrayed, notify) {
    if (notify === void 0) {
      notify = true;
    }
    if (xrayed) {
      this.xrayedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numXRayedObjects)[_numXRayedObjects]++;
    } else {
      delete this.xrayedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numXRayedObjects)[_numXRayedObjects]--;
    }
    _classPrivateFieldLooseBase(this, _xrayedObjectIds)[_xrayedObjectIds] = null; // Lazy regenerate
    if (notify) {
      this.onObjectXRayed.dispatch(this, viewObject);
    }
  }
  /**
   * @private
   */;
  _proto.objectHighlightedUpdated = function objectHighlightedUpdated(viewObject, highlighted) {
    if (highlighted) {
      this.highlightedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numHighlightedObjects)[_numHighlightedObjects]++;
    } else {
      delete this.highlightedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numHighlightedObjects)[_numHighlightedObjects]--;
    }
    _classPrivateFieldLooseBase(this, _highlightedObjectIds)[_highlightedObjectIds] = null; // Lazy regenerate
  }
  /**
   * @private
   */;
  _proto.objectSelectedUpdated = function objectSelectedUpdated(viewObject, selected) {
    if (selected) {
      this.selectedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numSelectedObjects)[_numSelectedObjects]++;
    } else {
      delete this.selectedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numSelectedObjects)[_numSelectedObjects]--;
    }
    _classPrivateFieldLooseBase(this, _selectedObjectIds)[_selectedObjectIds] = null; // Lazy regenerate
  }
  /**
   * @private
   */;
  _proto.objectColorizeUpdated = function objectColorizeUpdated(viewObject, colorized) {
    if (colorized) {
      this.colorizedObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numColorizedObjects)[_numColorizedObjects]++;
    } else {
      delete this.colorizedObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numColorizedObjects)[_numColorizedObjects]--;
    }
    _classPrivateFieldLooseBase(this, _colorizedObjectIds)[_colorizedObjectIds] = null; // Lazy regenerate
  }
  /**
   * @private
   */;
  _proto.objectOpacityUpdated = function objectOpacityUpdated(viewObject, opacityUpdated) {
    if (opacityUpdated) {
      this.opacityObjects[viewObject.id] = viewObject;
      _classPrivateFieldLooseBase(this, _numOpacityObjects)[_numOpacityObjects]++;
    } else {
      delete this.opacityObjects[viewObject.id];
      _classPrivateFieldLooseBase(this, _numOpacityObjects)[_numOpacityObjects]--;
    }
    _classPrivateFieldLooseBase(this, _opacityObjectIds)[_opacityObjectIds] = null; // Lazy regenerate
  }
  /**
   * Creates a {@link SectionPlane} in this View.
   *
   * @param sectionPlaneParams
   */;
  _proto.createSectionPlane = function createSectionPlane(sectionPlaneParams) {
    var _this2 = this;
    var id = sectionPlaneParams.id || utils.createUUID();
    if (this.sectionPlanes[id]) {
      this.error("SectionPlane with ID \"" + id + "\" already exists - will randomly-generate ID");
      id = utils.createUUID();
    }
    var sectionPlane = new SectionPlane(this, sectionPlaneParams);
    _classPrivateFieldLooseBase(this, _registerSectionPlane)[_registerSectionPlane](sectionPlane);
    sectionPlane.onDestroyed.one(function () {
      _classPrivateFieldLooseBase(_this2, _deregisterSectionPlane)[_deregisterSectionPlane](sectionPlane);
    });
    return sectionPlane;
  }
  /**
   * Destroys the {@link SectionPlane}s in this View.
   */;
  _proto.clearSectionPlanes = function clearSectionPlanes() {
    var objectIds = Object.keys(this.sectionPlanes);
    for (var i = 0, len = objectIds.length; i < len; i++) {
      this.sectionPlanes[objectIds[i]].destroy();
    }
    this.sectionPlanesList.length = 0;
    _classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash] = null;
  }
  /**
   * @private
   */;
  _proto.getSectionPlanesHash = function getSectionPlanesHash() {
    if (_classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash]) {
      return _classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash];
    }
    if (this.sectionPlanesList.length === 0) {
      return _classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash] = ";";
    }
    var hashParts = [];
    for (var i = 0, len = this.sectionPlanesList.length; i < len; i++) {
      hashParts.push("cp");
    }
    hashParts.push(";");
    _classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash] = hashParts.join("");
    return _classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash];
  }
  /**
   * @private
   */;
  _proto.registerLight = function registerLight(light) {
    this.lightsList.push(light);
    this.lights[light.id] = light;
    _classPrivateFieldLooseBase(this, _lightsHash)[_lightsHash] = null;
    this.rebuild();
  }
  /**
   * @private
   */;
  _proto.deregisterLight = function deregisterLight(light) {
    for (var i = 0, len = this.lightsList.length; i < len; i++) {
      if (this.lightsList[i].id === light.id) {
        this.lightsList.splice(i, 1);
        _classPrivateFieldLooseBase(this, _lightsHash)[_lightsHash] = null;
        delete this.lights[light.id];
        this.rebuild();
        return;
      }
    }
  }
  /**
   * Destroys the light sources in this View.
   */;
  _proto.clearLights = function clearLights() {
    var objectIds = Object.keys(this.lights);
    for (var i = 0, len = objectIds.length; i < len; i++) {
      this.lights[objectIds[i]].destroy();
    }
  }
  /**
   * @private
   */;
  _proto.getLightsHash = function getLightsHash() {
    if (_classPrivateFieldLooseBase(this, _lightsHash)[_lightsHash]) {
      return _classPrivateFieldLooseBase(this, _lightsHash)[_lightsHash];
    }
    if (this.lightsList.length === 0) {
      return _classPrivateFieldLooseBase(this, _lightsHash)[_lightsHash] = ";";
    }
    var hashParts = [];
    var lights = this.lightsList;
    for (var i = 0, len = lights.length; i < len; i++) {
      var light = lights[i];
      hashParts.push("/");
      hashParts.push(light.type);
      hashParts.push(light.space === "world" ? "w" : "v");
      if (light.castsShadow) {
        hashParts.push("sh");
      }
    }
    // if (this.lightMaps.length > 0) {
    //     hashParts.push("/lm");
    // }
    // if (this.reflectionMaps.length > 0) {
    //     hashParts.push("/rm");
    // }
    hashParts.push(";");
    _classPrivateFieldLooseBase(this, _lightsHash)[_lightsHash] = hashParts.join("");
    return _classPrivateFieldLooseBase(this, _lightsHash)[_lightsHash];
  }
  //createLight(lightParams) {
  //
  // }
  /**
   * @private
   */;
  _proto.rebuild = function rebuild() {
    this.viewer.renderer.needsRebuild(this.viewIndex);
  }
  /**
   * @private
   */;
  _proto.redraw = function redraw() {
    this.viewer.renderer.setImageDirty(this.viewIndex);
  }
  /**
   * Destroys this View.
   *
   * Causes {@link @xeokit/viewer!Viewer} to fire a "viewDestroyed" event.
   */;
  _proto.destroy = function destroy() {
    this.viewer.onTick.unsubscribe(_classPrivateFieldLooseBase(this, _onTick)[_onTick]);
    _Component.prototype.destroy.call(this);
    this.onObjectVisibility.clear();
    this.onObjectXRayed.clear();
    this.onLayerCreated.clear();
    this.onLayerDestroyed.clear();
    this.onSectionPlaneCreated.clear();
    this.onSectionPlaneDestroyed.clear();
  }
  /**
   * @private
   */;
  _proto.getAmbientColorAndIntensity = function getAmbientColorAndIntensity() {
    return [0, 0, 0, 1];
  }
  /**
   * Updates the visibility of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.visible} on the Objects with the given IDs.
   * - Updates {@link View.visibleObjects} and {@link View.numVisibleObjects}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param visible Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsVisible = function setObjectsVisible(objectIds, visible) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.visible !== visible;
      viewObject.visible = visible;
      return changed;
    });
  }
  /**
   * Updates the collidability of the given {@link ViewObject | ViewObjects} in this View.
   *
   * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param collidable Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsCollidable = function setObjectsCollidable(objectIds, collidable) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.collidable !== collidable;
      viewObject.collidable = collidable;
      return changed;
    });
  }
  /**
   * Updates the culled status of the given {@link ViewObject | ViewObjects} in this View.
   *
   * Updates {@link ViewObject.culled} on the Objects with the given IDs.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param culled Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsCulled = function setObjectsCulled(objectIds, culled) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.culled !== culled;
      viewObject.culled = culled;
      return changed;
    });
  }
  /**
   * Selects or deselects the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.selected} on the Objects with the given IDs.
   * - Updates {@link View.selectedObjects} and {@link View.numSelectedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param selected Whether or not to select.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsSelected = function setObjectsSelected(objectIds, selected) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.selected !== selected;
      viewObject.selected = selected;
      return changed;
    });
  }
  /**
   * Highlights or un-highlights the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.highlighted} on the Objects with the given IDs.
   * - Updates {@link View.highlightedObjects} and {@link View.numHighlightedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param highlighted Whether or not to highlight.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsHighlighted = function setObjectsHighlighted(objectIds, highlighted) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.highlighted !== highlighted;
      viewObject.highlighted = highlighted;
      return changed;
    });
  }
  /**
   * Applies or removes X-ray rendering for the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.xrayed} on the Objects with the given IDs.
   * - Updates {@link View.xrayedObjects} and {@link View.numXRayedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param xrayed Whether or not to xray.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsXRayed = function setObjectsXRayed(objectIds, xrayed) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.xrayed !== xrayed;
      if (changed) {
        viewObject.xrayed = xrayed;
      }
      return changed;
    });
  }
  /**
   * Colorizes the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.colorize} on the Objects with the given IDs.
   * - Updates {@link View.colorizedObjects} and {@link View.numColorizedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsColorized = function setObjectsColorized(objectIds, colorize) {
    return this.withObjects(objectIds, function (viewObject) {
      viewObject.colorize = colorize;
    });
  }
  /**
   * Sets the opacity of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.opacity} on the Objects with the given IDs.
   * - Updates {@link View.opacityObjects} and {@link View.numOpacityObjects}.
   *
   * @param  objectIds - One or more {@link ViewObject.id} values.
   * @param opacity - Opacity factor in range ````[0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsOpacity = function setObjectsOpacity(objectIds, opacity) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.opacity !== opacity;
      if (changed) {
        viewObject.opacity = opacity;
      }
      return changed;
    });
  }
  /**
   * Sets the pickability of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param pickable Whether or not to set pickable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsPickable = function setObjectsPickable(objectIds, pickable) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.pickable !== pickable;
      if (changed) {
        viewObject.pickable = pickable;
      }
      return changed;
    });
  }
  /**
   * Sets the clippability of the given {@link ViewObject | ViewObjects} in this View.
   *
   * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
   * - Enables or disables the ability to clip the given Objects with {@link SectionPlane}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param clippable Whether or not to set clippable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.setObjectsClippable = function setObjectsClippable(objectIds, clippable) {
    return this.withObjects(objectIds, function (viewObject) {
      var changed = viewObject.clippable !== clippable;
      if (changed) {
        viewObject.clippable = clippable;
      }
      return changed;
    });
  }
  /**
   * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this View.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param callback Callback to execute on each {@link ViewObject}.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */;
  _proto.withObjects = function withObjects(objectIds, callback) {
    var changed = false;
    for (var i = 0, len = objectIds.length; i < len; i++) {
      var id = objectIds[i];
      var viewObject = this.objects[id];
      if (viewObject) {
        changed = callback(viewObject) || changed;
      }
    }
    return changed;
  }
  /**
   * Creates a {@link ViewLayer} in this View.
   *
   * The ViewLayer is then registered in {@link View.layers}.
   *
   * Since the ViewLayer is created explicitly by this method, the ViewLayer will persist until {@link ViewLayer.destroy}
   * is called, or the {@link @xeokit/viewer!View} itself is destroyed. If a ViewLayer with the given ID already exists, then the method
   * returns that existing ViewLayer. The method will also ensure that the existing ViewLayer likewise persists.
   *
   * @param viewLayerParams
   * @returns The new ViewLayer
   */;
  _proto.createLayer = function createLayer(viewLayerParams) {
    var _this3 = this;
    var viewLayer = this.layers[viewLayerParams.id];
    if (!viewLayer) {
      viewLayer = new ViewLayer({
        // Automatically creates ViewObjects
        id: viewLayerParams.id,
        view: this,
        viewer: this.viewer
      });
      this.layers[viewLayerParams.id] = viewLayer;
      this.onLayerCreated.dispatch(this, viewLayer);
      viewLayer.onDestroyed.one(function () {
        delete _this3.layers[viewLayer.id];
        _this3.onLayerDestroyed.dispatch(_this3, viewLayer);
      });
    }
    viewLayer.autoDestroy = false;
    return viewLayer;
  };
  _createClass(View, [{
    key: "aabb",
    get: function get() {
      return this.viewer.scene.aabb;
    }
    /**
     * Gets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
  }, {
    key: "backgroundColor",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _backgroundColor)[_backgroundColor];
    }
    /**
     * Sets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _backgroundColor)[_backgroundColor][0] = value[0];
        _classPrivateFieldLooseBase(this, _backgroundColor)[_backgroundColor][1] = value[1];
        _classPrivateFieldLooseBase(this, _backgroundColor)[_backgroundColor][2] = value[2];
      } else {
        _classPrivateFieldLooseBase(this, _backgroundColor)[_backgroundColor][0] = 1.0;
        _classPrivateFieldLooseBase(this, _backgroundColor)[_backgroundColor][1] = 1.0;
        _classPrivateFieldLooseBase(this, _backgroundColor)[_backgroundColor][2] = 1.0;
      }
      this.redraw();
    }
    /**
     * Gets whether the canvas clear color will be derived from {@link AmbientLight} or {@link View#backgroundColor}
     * when {@link View#transparent} is ```true```.
     *
     * When {@link View#transparent} is ```true``` and this is ````true````, then the canvas clear color will
     * be taken from the ambient light color.
     *
     * When {@link View#transparent} is ```true``` and this is ````false````, then the canvas clear color will
     * be taken from {@link View#backgroundColor}.
     *
     * Default value is ````true````.
     */
  }, {
    key: "backgroundColorFromAmbientLight",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _backgroundColorFromAmbientLight)[_backgroundColorFromAmbientLight];
    }
    /**
     * Sets if the canvas background color is derived from an {@link AmbientLight}.
     *
     * This only has effect when the canvas is not transparent. When not enabled, the background color
     * will be the canvas element's HTML/CSS background color.
     *
     * Default value is ````true````.
     */,
    set: function set(backgroundColorFromAmbientLight) {
      _classPrivateFieldLooseBase(this, _backgroundColorFromAmbientLight)[_backgroundColorFromAmbientLight] = backgroundColorFromAmbientLight !== false;
    }
    /**
     * Gets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a kdtree3 way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @returns  The resolution scale.
     */
  }, {
    key: "resolutionScale",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _resolutionScale)[_resolutionScale];
    }
    /**
     * Sets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a kdtree3 way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @param resolutionScale The resolution scale.
     */,
    set: function set(resolutionScale) {
      resolutionScale = resolutionScale || 1.0;
      if (resolutionScale === _classPrivateFieldLooseBase(this, _resolutionScale)[_resolutionScale]) {
        return;
      }
      _classPrivateFieldLooseBase(this, _resolutionScale)[_resolutionScale] = resolutionScale;
      var canvasElement = this.canvasElement;
      canvasElement.width = Math.round(canvasElement.clientWidth * _classPrivateFieldLooseBase(this, _resolutionScale)[_resolutionScale]);
      canvasElement.height = Math.round(canvasElement.clientHeight * _classPrivateFieldLooseBase(this, _resolutionScale)[_resolutionScale]);
      this.redraw();
    }
    /**
     * Gets the gamma factor.
     */
  }, {
    key: "gammaFactor",
    get: function get() {
      // TODO
      return 1.0;
    }
    /**
     * Gets whether quality rendering is enabled for this View.
     *
     * Default is ````false````.
     */
  }, {
    key: "qualityRender",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _qualityRender)[_qualityRender];
    }
    /**
     * Sets whether quality rendering is enabled for this View.
     *
     * Default is ````false````.
     */,
    set: function set(value) {
      if (_classPrivateFieldLooseBase(this, _qualityRender)[_qualityRender] === value) {
        return;
      }
      _classPrivateFieldLooseBase(this, _qualityRender)[_qualityRender] = value;
      this.redraw();
    }
    /**
     * Gets the number of {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "numObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numObjects)[_numObjects];
    }
    /**
     * Gets the IDs of the {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "objectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _objectIds)[_objectIds]) {
        _classPrivateFieldLooseBase(this, _objectIds)[_objectIds] = Object.keys(this.objects);
      }
      return _classPrivateFieldLooseBase(this, _objectIds)[_objectIds];
    }
    /**
     * Gets the number of visible {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "numVisibleObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numVisibleObjects)[_numVisibleObjects];
    }
    /**
     * Gets the IDs of the visible {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "visibleObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _visibleObjectIds)[_visibleObjectIds]) {
        _classPrivateFieldLooseBase(this, _visibleObjectIds)[_visibleObjectIds] = Object.keys(this.visibleObjects);
      }
      return _classPrivateFieldLooseBase(this, _visibleObjectIds)[_visibleObjectIds];
    }
    /**
     * Gets the number of X-rayed {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "numXRayedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numXRayedObjects)[_numXRayedObjects];
    }
    /**
     * Gets the IDs of the X-rayed {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "xrayedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _xrayedObjectIds)[_xrayedObjectIds]) {
        _classPrivateFieldLooseBase(this, _xrayedObjectIds)[_xrayedObjectIds] = Object.keys(this.xrayedObjects);
      }
      return _classPrivateFieldLooseBase(this, _xrayedObjectIds)[_xrayedObjectIds];
    }
    /**
     * Gets the number of highlighted {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "numHighlightedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numHighlightedObjects)[_numHighlightedObjects];
    }
    /**
     * Gets the IDs of the highlighted {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "highlightedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _highlightedObjectIds)[_highlightedObjectIds]) {
        _classPrivateFieldLooseBase(this, _highlightedObjectIds)[_highlightedObjectIds] = Object.keys(this.highlightedObjects);
      }
      return _classPrivateFieldLooseBase(this, _highlightedObjectIds)[_highlightedObjectIds];
    }
    /**
     * Gets the number of selected {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "numSelectedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numSelectedObjects)[_numSelectedObjects];
    }
    /**
     * Gets the IDs of the selected {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "selectedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _selectedObjectIds)[_selectedObjectIds]) {
        _classPrivateFieldLooseBase(this, _selectedObjectIds)[_selectedObjectIds] = Object.keys(this.selectedObjects);
      }
      return _classPrivateFieldLooseBase(this, _selectedObjectIds)[_selectedObjectIds];
    }
    /**
     * Gets the number of colorized {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "numColorizedObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numColorizedObjects)[_numColorizedObjects];
    }
    /**
     * Gets the IDs of the colorized {@link ViewObject | ViewObjects} in this View.
     */
  }, {
    key: "colorizedObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _colorizedObjectIds)[_colorizedObjectIds]) {
        _classPrivateFieldLooseBase(this, _colorizedObjectIds)[_colorizedObjectIds] = Object.keys(this.colorizedObjects);
      }
      return _classPrivateFieldLooseBase(this, _colorizedObjectIds)[_colorizedObjectIds];
    }
    /**
     * Gets the IDs of the {@link ViewObject | ViewObjects} in this View that have updated opacities.
     */
  }, {
    key: "opacityObjectIds",
    get: function get() {
      if (!_classPrivateFieldLooseBase(this, _opacityObjectIds)[_opacityObjectIds]) {
        _classPrivateFieldLooseBase(this, _opacityObjectIds)[_opacityObjectIds] = Object.keys(this.opacityObjects);
      }
      return _classPrivateFieldLooseBase(this, _opacityObjectIds)[_opacityObjectIds];
    }
    /**
     * Gets the number of {@link ViewObject | ViewObjects} in this View that have updated opacities.
     */
  }, {
    key: "numOpacityObjects",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _numOpacityObjects)[_numOpacityObjects];
    }
  }]);
  return View;
}(core.Component);
function _registerSectionPlane2(sectionPlane) {
  this.sectionPlanesList.push(sectionPlane);
  this.sectionPlanes[sectionPlane.id] = sectionPlane;
  _classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash] = null;
  this.rebuild();
  this.onSectionPlaneCreated.dispatch(this, sectionPlane);
}
function _deregisterSectionPlane2(sectionPlane) {
  for (var i = 0, len = this.sectionPlanesList.length; i < len; i++) {
    if (this.sectionPlanesList[i].id === sectionPlane.id) {
      this.sectionPlanesList.splice(i, 1);
      _classPrivateFieldLooseBase(this, _sectionPlanesHash)[_sectionPlanesHash] = null;
      delete this.sectionPlanes[sectionPlane.id];
      this.rebuild();
      this.onSectionPlaneDestroyed.dispatch(this, sectionPlane);
      return;
    }
  }
}
function _initObjects2() {
  var _this4 = this;
  for (var id in this.viewer.scene.models) {
    _classPrivateFieldLooseBase(this, _createObjects)[_createObjects](this.viewer.scene.models[id]);
  }
  this.viewer.scene.onModelCreated.subscribe(function (scene, model) {
    _classPrivateFieldLooseBase(_this4, _createObjects)[_createObjects](model);
  });
  this.viewer.scene.onModelDestroyed.subscribe(function (scene, model) {
    _classPrivateFieldLooseBase(_this4, _destroyObjects)[_destroyObjects](model);
  });
}
function _createObjects2(model) {
  var _this5 = this;
  var sceneObjects = model.objects;
  var rendererObjects = this.viewer.renderer.rendererViewObjects;
  var _loop = function _loop() {
    var sceneObject = sceneObjects[id];
    var rendererObject = rendererObjects[id];
    //     const layerId = viewerObject.layerId || "default";
    var layerId = "default";
    var viewLayer = _this5.layers[layerId];
    if (!viewLayer) {
      if (!_this5.autoLayers) {
        return "continue";
      }
      viewLayer = new ViewLayer({
        id: layerId,
        view: _this5,
        viewer: _this5.viewer
      });
      _this5.layers[layerId] = viewLayer;
      viewLayer.onDestroyed.one(function () {
        delete _this5.layers[viewLayer.id];
        _this5.onLayerDestroyed.dispatch(_this5, viewLayer);
      });
      _this5.onLayerCreated.dispatch(_this5, viewLayer);
    }
    var viewObject = new ViewObject(viewLayer, sceneObject, rendererObject);
    viewLayer.registerViewObject(viewObject);
    _this5.registerViewObject(viewObject);
  };
  for (var id in sceneObjects) {
    var _ret = _loop();
    if (_ret === "continue") continue;
  }
}
function _destroyObjects2(model) {
  var objects = model.objects;
  for (var id in objects) {
    var object = objects[id];
    //     const layerId = object.layerId || "main";
    var layerId = "default";
    var viewLayer = this.layers[layerId];
    var viewObject = this.objects[object.id];
    this.deregisterViewObject(viewObject);
    if (viewLayer) {
      viewLayer.deregisterViewObject(viewObject);
      if (viewLayer.autoDestroy && viewLayer.numObjects === 0) {
        viewLayer.destroy();
      }
    }
  }
}

/**
 * A Browser-based 2D/3D model viewer.
 *
 * See {@link @xeokit/viewer} for usage.
 */
var _prefixMessageWithID = /*#__PURE__*/_classPrivateFieldLooseKey("prefixMessageWithID");
var _registerView = /*#__PURE__*/_classPrivateFieldLooseKey("registerView");
var _deregisterView = /*#__PURE__*/_classPrivateFieldLooseKey("deregisterView");
var Viewer = /*#__PURE__*/function (_Component) {
  _inheritsLoose(Viewer, _Component);
  /**
   Creates a Viewer.
    @param params - Viewer configuration.
   @param params.scene - Contains model representations.
   @param params.renderer - Manages rendering of models.
   @param params.id - ID for this Viewer, automatically generated by default.
   @param params.units - The measurement unit type. Accepted values are ````"meters"````, ````"metres"````, , ````"centimeters"````, ````"centimetres"````, ````"millimeters"````,  ````"millimetres"````, ````"yards"````, ````"feet"```` and ````"inches"````.
   @param params.scale - The number of Real-space units in each World-space coordinate system unit.
   @param params.origin - The Real-space 3D origin, in current measurement units, at which the World-space coordinate origin ````[0,0,0]```` sits.
   @param params.localeService - Locale-based translation service.
    */
  function Viewer(params) {
    var _this;
    _this = _Component.call(this, null, {}) || this;
    Object.defineProperty(_assertThisInitialized(_this), _deregisterView, {
      value: _deregisterView2
    });
    Object.defineProperty(_assertThisInitialized(_this), _registerView, {
      value: _registerView2
    });
    Object.defineProperty(_assertThisInitialized(_this), _prefixMessageWithID, {
      value: _prefixMessageWithID2
    });
    /**
     * Indicates the capabilities of this Viewer.
     */
    _this.capabilities = void 0;
    /**
     * Emits an event each time a Viewer "tick" occurs (~10-60 times per second).
     *
     * @event
     */
    _this.onTick = void 0;
    /**
     * Emits an event each time a {@link @xeokit/viewer!View} is created.
     *
     * @event
     */
    _this.onViewCreated = void 0;
    /**
     * Emits an event each time a {@link @xeokit/viewer!View} is destroyed.
     *
     * @event
     */
    _this.onViewDestroyed = void 0;
    /**
     * The Viewer's scene representation.
     */
    _this.scene = void 0;
    /**
     * Map of all the Views in this Viewer.
     *
     * Each {@link @xeokit/viewer!View} is an independently configurable view of the Viewer's models, with its own canvas, camera position, section planes, lights, and object visual states.
     */
    _this.views = void 0;
    /**
     * List of all the Views in this Viewer.
     *
     * Each {@link @xeokit/viewer!View} is an independently configurable view of the Viewer's models, with its own canvas, camera position, section planes, lights, and object visual states.
     */
    _this.viewList = void 0;
    /**
     *  The number of {@link View | Views} belonging to this Viewer.
     */
    _this.numViews = void 0;
    /**
     The time that this Viewer was created.
     */
    _this.startTime = new Date().getTime();
    /**
     * @private
     */
    _this.renderer = void 0;
    _this.onTick = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onViewCreated = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.onViewDestroyed = new core.EventEmitter(new stronglyTypedEvents.EventDispatcher());
    _this.id = params.id || utils.createUUID();
    _this.viewList = [];
    _this.numViews = 0;
    _this.views = {};
    _this.destroyed = false;
    _this.capabilities = {
      maxViews: 0,
      astcSupported: false,
      etc1Supported: false,
      etc2Supported: false,
      dxtSupported: false,
      bptcSupported: false,
      pvrtcSupported: false
    };
    _this.scene = params.scene || new scene.Scene();
    _this.renderer = params.renderer;
    _this.renderer.getCapabilities(_this.capabilities);
    _this.renderer.init(_assertThisInitialized(_this));
    scheduler.registerViewer(_assertThisInitialized(_this));
    return _this;
  }
  /**
   * Creates a new {@link @xeokit/viewer!View} within this Viewer.
   *
   * * The maximum number of views you're allowed to create is provided in {@link Capabilities.maxViews}. This
   * will be determined by the {@link Renderer} implementation the Viewer is configured with.
   * * To destroy the View after use, call {@link View.destroy}.
   * * You must add a View to the Viewer before you can create or load content into the Viewer's Viewer.
   *
   * ### Usage
   *
   * ````javascript
   * const view1 = myViewer.createView({
   *      id: "myView",
   *      canvasId: "myView1"
   *  });
   *
   * if (view1 instanceof SDKError) {
   *      console.log(view1.message);
   * } else {
   *      view1.camera.eye = [-3.933, 2.855, 27.018];
   *      view1.camera.look = [4.400, 3.724, 8.899];
   *      view1.camera.up = [-0.018, 0.999, 0.039];
   *
   *      //...
   * }
   * ````
   *
   * @param params View configuration.
   * @returns *{@link View}*
   * * On success.
   * @returns *{@link @xeokit/core!SDKError}*
   * * If View already exists with the given ID.
   * * Attempted to create too many Views - see {@link Capabilities.maxViews | Capabilities.maxViews}.
   */
  var _proto = Viewer.prototype;
  _proto.createView = function createView(params) {
    var _this2 = this;
    if (this.viewList.length >= this.capabilities.maxViews) {
      return new core.SDKError("Attempted to create too many Views with View.createView() - maximum of " + this.capabilities.maxViews + " is allowed");
    }
    var viewId = params.id || utils.createUUID();
    if (this.views[viewId]) {
      return new core.SDKError("View with ID \"" + viewId + "\" already exists");
    }
    // @ts-ignore
    var canvasElement = params.canvasElement || document.getElementById(params.canvasId);
    if (!(canvasElement instanceof HTMLCanvasElement)) {
      return new core.SDKError("Mandatory View config expected: valid canvasId or canvasElement");
    }
    var view = new View(utils.apply({
      viewId: viewId,
      viewer: this
    }, params));
    _classPrivateFieldLooseBase(this, _registerView)[_registerView](view);
    view.viewIndex = this.renderer.registerView(view);
    view.onDestroyed.one(function () {
      _classPrivateFieldLooseBase(_this2, _deregisterView)[_deregisterView](view);
      _this2.renderer.deregisterView(view.viewIndex);
      _this2.onViewDestroyed.dispatch(_this2, view);
    });
    this.onViewCreated.dispatch(this, view);
    this.log("View created: " + view.viewId);
    return view;
  }
  /**
   Trigger redraw of all {@link View | Views} belonging to this Viewer.
    @private
   */;
  _proto.redraw = function redraw() {
    for (var viewId in this.views) {
      this.views[viewId].redraw();
    }
  }
  /**
   Logs a console debugging message for this Viewer.
    The console message will have this format: *````[LOG] [<component type> <component id>: <message>````*
    @private
   @param message - The message to log
   */;
  _proto.log = function log(message) {
    message = "[LOG] " + _classPrivateFieldLooseBase(this, _prefixMessageWithID)[_prefixMessageWithID](message);
    window.console.log(message);
  }
  /**
   Logs a warning for this Viewer to the JavaScript console.
    The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*
    @private
   @param message - The warning message to log
   */;
  _proto.warn = function warn(message) {
    message = "[WARN] " + _classPrivateFieldLooseBase(this, _prefixMessageWithID)[_prefixMessageWithID](message);
    window.console.warn(message);
  }
  /**
   Logs an error for this Viewer to the JavaScript console.
    The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*
    @private
   @param message The error message to log
   */;
  _proto.error = function error(message) {
    message = "[ERROR] " + _classPrivateFieldLooseBase(this, _prefixMessageWithID)[_prefixMessageWithID](message);
    window.console.error(message);
  }
  /**
   * Destroys this Viewer and all {@link View | Views} and {@link Plugin}s we've created within it.
   */;
  _proto.destroy = function destroy() {
    if (this.destroyed) {
      return;
    }
    scheduler.deregisterViewer(this);
    for (var id in this.views) {
      this.views[id].destroy();
    }
    this.onTick.clear();
    this.onViewCreated.clear();
    this.onViewDestroyed.clear();
  }
  /**
   * @private
   * @param params
   */;
  _proto.render = function render(params) {
    for (var viewIndex = 0; viewIndex < this.viewList.length; viewIndex++) {
      this.renderer.render(viewIndex, {
        force: true
      });
    }
  };
  return Viewer;
}(core.Component);
function _prefixMessageWithID2(message) {
  return " [" + this.constructor.name + " \"" + utils.inQuotes(this.id) + "\"]: " + message;
}
function _registerView2(view) {
  if (this.views[view.id]) {
    return;
  }
  this.views[view.id] = view;
  for (var viewIndex = 0;; viewIndex++) {
    if (!this.viewList[viewIndex]) {
      this.viewList[viewIndex] = view;
      this.numViews++;
      view.viewIndex = viewIndex;
      return;
    }
  }
}
function _deregisterView2(view) {
  if (!this.views[view.id]) {
    return;
  }
  delete this.views[view.id];
  delete this.viewList[view.viewIndex];
  this.numViews--;
}

/**
 * An ambient light source within a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Has fixed color and intensity that illuminates all objects equally.
 * * {@link AmbientLight}s, {@link DirLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
var _state$2 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var AmbientLight = /*#__PURE__*/function (_Component) {
  _inheritsLoose(AmbientLight, _Component);
  /**
   * @param view Owner component. When destroyed, the owner will destroy this AmbientLight as well.
   * @param cfg AmbientLight configuration
   */
  function AmbientLight(view, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, view, cfg) || this;
    /**
     * The View to which this AmbientLight belongs.
     */
    _this.view = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$2, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$2)[_state$2] = {
      type: "ambient",
      color: new Float32Array(cfg.color || [0.7, 0.7, 0.7]),
      intensity: cfg.intensity !== undefined && cfg.intensity !== null ? cfg.intensity : 1.0
    };
    _this.view.registerLight(_assertThisInitialized(_this));
    return _this;
  }
  /**
   * Sets the RGB color of this AmbientLight.
   *
   * Default value is ````[0.7, 0.7, 0.7]````.
   *
   * @param color The AmbientLight's RGB color.
   */
  var _proto = AmbientLight.prototype;
  /**
   * Destroys this AmbientLight.
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.view.deregisterLight(this);
  };
  _createClass(AmbientLight, [{
    key: "color",
    get:
    /**
     * Gets the RGB color of this AmbientLight.
     *
     * Default value is ````[0.7, 0.7, 0.7]````.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$2)[_state$2].color;
    }
    /**
     * Sets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @param intensity The AmbientLight's intensity.
     */,
    set: function set(color) {
      _classPrivateFieldLooseBase(this, _state$2)[_state$2].color.set(color);
      this.view.redraw();
    }
  }, {
    key: "intensity",
    get:
    /**
     * Gets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The AmbientLight's intensity.
     */
    function get() {
      return _classPrivateFieldLooseBase(this, _state$2)[_state$2].intensity;
    },
    set: function set(intensity) {
      _classPrivateFieldLooseBase(this, _state$2)[_state$2].intensity = intensity !== undefined ? intensity : 1.0;
      this.view.redraw();
    }
  }]);
  return AmbientLight;
}(core.Component);

/**
 * A directional light source within a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Illuminates all objects equally from a given direction.
 * * Has an emission direction vector in {@link DirLight.dir}, but no position.
 * * Defined in either *World* or *View* coordinate space. When in World-space, {@link DirLight.dir} is relative to the
 * World coordinate system, and will appear to move as the {@link @xeokit/viewer!Camera}  moves. When in View-space, {@link DirLight.dir} is
 * relative to the View coordinate system, and will behave as if fixed to the viewer's head.
 * * {@link AmbientLight}s, {@link DirLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
var _state$1 = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var DirLight = /*#__PURE__*/function (_Component) {
  _inheritsLoose(DirLight, _Component);
  /**
   * @param view View that owns this DirLight. When destroyed, the View will destroy this DirLight as well.
   * @param options The DirLight configuration
   * @param [options.id] Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
   * @param [options.dir=[1.0, 1.0, 1.0]]  A unit vector indicating the direction that the light is shining,  given in either World or View space, depending on the value of the ````space```` parameter.
   * @param [options.color=[0.7, 0.7, 0.8 ]] The color of this DirLight.
   * @param [options.intensity=1.0] The intensity of this DirLight, as a factor in range ````[0..1]````.
   * @param [options.space="view"] The coordinate system the DirLight is defined in - ````"view"```` or ````"space"````.
   */
  function DirLight(view, options) {
    var _this;
    if (options === void 0) {
      options = {};
    }
    _this = _Component.call(this, view, options) || this;
    /**
     * The View to which this DirLight belongs.
     */
    _this.view = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state$1, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state$1)[_state$1] = {
      type: "dir",
      dir: new Float32Array(options.dir || [1.0, 1.0, 1.0]),
      color: new Float32Array(options.color || [0.7, 0.7, 0.8]),
      intensity: options.intensity !== undefined && options.intensity !== null ? options.intensity : 1.0,
      space: options.space || "view"
    };
    _this.view.registerLight(_assertThisInitialized(_this));
    return _this;
  }
  /**
   * Gets the direction in which the DirLight is shining.
   *
   * Default value is ````[1.0, 1.0, 1.0]````.
   *
   * @returns {Number[]} The direction vector.
   */
  var _proto = DirLight.prototype;
  /**
   * Destroys this DirLight.
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.view.deregisterLight(this);
    this.view.redraw();
  };
  _createClass(DirLight, [{
    key: "dir",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$1)[_state$1].dir;
    }
    /**
     * Sets the direction in which the DirLight is shining.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @param value The direction vector.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state$1)[_state$1].dir.set(value);
      this.view.redraw();
    }
    /**
     * Gets the RGB color of this DirLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @returns {Number[]} The DirLight's RGB color.
     */
  }, {
    key: "color",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$1)[_state$1].color;
    }
    /**
     * Sets the RGB color of this DirLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @param color The DirLight's RGB color.
     */,
    set: function set(color) {
      _classPrivateFieldLooseBase(this, _state$1)[_state$1].color.set(color);
      this.view.redraw();
    }
    /**
     * Gets the intensity of this DirLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The DirLight's intensity.
     */
  }, {
    key: "intensity",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state$1)[_state$1].intensity;
    }
    /**
     * Sets the intensity of this DirLight.
     *
     * Default intensity is ````1.0```` for maximum intensity.
     *
     * @param intensity The DirLight's intensity
     */,
    set: function set(intensity) {
      _classPrivateFieldLooseBase(this, _state$1)[_state$1].intensity = intensity;
      this.view.redraw();
    }
  }]);
  return DirLight;
}(core.Component);

/**
 * A positional light source within a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Originates from a single point and spreads outward in all directions, with optional attenuation over distance.
 * * Has a position in {@link PointLight.pos}, but no direction.
 * * Defined in either *World* or *View* coordinate space. When in World-space, {@link PointLight.pos} is relative to
 * the World coordinate system, and will appear to move as the {@link @xeokit/viewer!Camera}  moves. When in View-space,
 * {@link PointLight.pos} is relative to the View coordinate system, and will behave as if fixed to the viewer's head.
 * * Has {@link PointLight.constantAttenuation}, {@link PointLight.linearAttenuation} and {@link PointLight.quadraticAttenuation}
 * factors, which indicate how intensity attenuates over distance.
 * * {@link AmbientLight}s, {@link PointLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
var _state = /*#__PURE__*/_classPrivateFieldLooseKey("state");
var PointLight = /*#__PURE__*/function (_Component) {
  _inheritsLoose(PointLight, _Component);
  /**
   * @param view View that owns this PointLight. When destroyed, the View will destroy this PointLight as well.
   * @param cfg The PointLight configuration
   * @param [cfg.id] Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
   * @param [cfg.pos=[ 1.0, 1.0, 1.0 ]] Position, in either World or View space, depending on the value of the **space** parameter.
   * @param [cfg.color=[0.7, 0.7, 0.8 ]] Color of this PointLight.
   * @param [cfg.intensity=1.0] Intensity of this PointLight, as a factor in range ````[0..1]````.
   * @param [cfg.constantAttenuation=0] Constant attenuation factor.
   * @param [cfg.linearAttenuation=0] Linear attenuation factor.
   * @param [cfg.quadraticAttenuation=0] Quadratic attenuation factor.
   * @param [cfg.space="view"] The coordinate system this PointLight is defined in - "view" or "world".
   * @param [cfg.castsShadow=false] Flag which indicates if this PointLight casts a castsShadow.
   */
  function PointLight(view, cfg) {
    var _this;
    if (cfg === void 0) {
      cfg = {};
    }
    _this = _Component.call(this, view, cfg) || this;
    /**
     * The View to which this PointLight belongs.
     */
    _this.view = void 0;
    Object.defineProperty(_assertThisInitialized(_this), _state, {
      writable: true,
      value: void 0
    });
    _this.view = view;
    _classPrivateFieldLooseBase(_assertThisInitialized(_this), _state)[_state] = {
      type: "point",
      pos: new Float64Array(cfg.pos || [1.0, 1.0, 1.0]),
      color: new Float32Array(cfg.color || [0.7, 0.7, 0.8]),
      intensity: 1.0,
      // @ts-ignore
      attenuation: new Float32Array([cfg.constantAttenuation, cfg.linearAttenuation, cfg.quadraticAttenuation]),
      space: cfg.space || "view"
    };
    _this.view.registerLight(_assertThisInitialized(_this));
    return _this;
  }
  /**
   * Gets the position of this PointLight.
   *
   * This will be either World- or View-space, depending on the value of {@link PointLight.space}.
   *
   * Default value is ````[1.0, 1.0, 1.0]````.
   *
   * @returns {Number[]} The position.
   */
  var _proto = PointLight.prototype;
  /**
   * Destroys this PointLight.
   */
  _proto.destroy = function destroy() {
    _Component.prototype.destroy.call(this);
    this.view.deregisterLight(this);
    this.view.redraw();
  };
  _createClass(PointLight, [{
    key: "pos",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state)[_state].pos;
    }
    /**
     * Sets the position of this PointLight.
     *
     * This will be either World- or View-space, depending on the value of {@link PointLight.space}.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @param pos The position.
     */,
    set: function set(pos) {
      _classPrivateFieldLooseBase(this, _state)[_state].pos.set(pos || [1.0, 1.0, 1.0]);
      this.view.redraw();
    }
    /**
     * Gets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @returns {Number[]} The PointLight's RGB color.
     */
  }, {
    key: "color",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state)[_state].color;
    }
    /**
     * Sets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @param color The PointLight's RGB color.
     */,
    set: function set(color) {
      _classPrivateFieldLooseBase(this, _state)[_state].color.set(color || [0.7, 0.7, 0.8]);
      this.view.redraw();
    }
    /**
     * Gets the intensity of this PointLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The PointLight's intensity.
     */
  }, {
    key: "intensity",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state)[_state].intensity;
    }
    /**
     * Sets the intensity of this PointLight.
     *
     * Default intensity is ````1.0```` for maximum intensity.
     *
     * @param intensity The PointLight's intensity
     */,
    set: function set(intensity) {
      if (intensity === _classPrivateFieldLooseBase(this, _state)[_state].intensity) {
        return;
      }
      _classPrivateFieldLooseBase(this, _state)[_state].intensity = intensity;
      this.view.redraw();
    }
    /**
     * Gets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The constant attenuation factor.
     */
  }, {
    key: "constantAttenuation",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state)[_state].attenuation[0];
    }
    /**
     * Sets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The constant attenuation factor.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state)[_state].attenuation[0] = value;
      this.view.redraw();
    }
    /**
     * Gets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The linear attenuation factor.
     */
  }, {
    key: "linearAttenuation",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state)[_state].attenuation[1];
    }
    /**
     * Sets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The linear attenuation factor.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state)[_state].attenuation[1] = value;
      this.view.redraw();
    }
    /**
     * Gets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The quadratic attenuation factor.
     */
  }, {
    key: "quadraticAttenuation",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _state)[_state].attenuation[2];
    }
    /**
     * Sets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The quadratic attenuation factor.
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _state)[_state].attenuation[2] = value;
      this.view.redraw();
    }
  }]);
  return PointLight;
}(core.Component);

var _viewObject = /*#__PURE__*/_classPrivateFieldLooseKey("viewObject");
var _gotCanvasPos = /*#__PURE__*/_classPrivateFieldLooseKey("gotCanvasPos");
var _gotOrigin = /*#__PURE__*/_classPrivateFieldLooseKey("gotOrigin");
var _gotDirection = /*#__PURE__*/_classPrivateFieldLooseKey("gotDirection");
var _gotIndices = /*#__PURE__*/_classPrivateFieldLooseKey("gotIndices");
var _gotLocalPos = /*#__PURE__*/_classPrivateFieldLooseKey("gotLocalPos");
var _gotWorldPos = /*#__PURE__*/_classPrivateFieldLooseKey("gotWorldPos");
var _gotViewPos = /*#__PURE__*/_classPrivateFieldLooseKey("gotViewPos");
var _gotWorldNormal = /*#__PURE__*/_classPrivateFieldLooseKey("gotWorldNormal");
var _gotUV = /*#__PURE__*/_classPrivateFieldLooseKey("gotUV");
var _canvasPos = /*#__PURE__*/_classPrivateFieldLooseKey("canvasPos");
var _origin = /*#__PURE__*/_classPrivateFieldLooseKey("origin");
var _direction = /*#__PURE__*/_classPrivateFieldLooseKey("direction");
var _indices = /*#__PURE__*/_classPrivateFieldLooseKey("indices");
var _localPos = /*#__PURE__*/_classPrivateFieldLooseKey("localPos");
var _worldPos = /*#__PURE__*/_classPrivateFieldLooseKey("worldPos");
var _viewPos = /*#__PURE__*/_classPrivateFieldLooseKey("viewPos");
var _worldNormal = /*#__PURE__*/_classPrivateFieldLooseKey("worldNormal");
var _uv = /*#__PURE__*/_classPrivateFieldLooseKey("uv");
/**
 * Results of a pick attempted with {@link View.pick}.
 */
var PickResult = /*#__PURE__*/function () {
  function PickResult() {
    Object.defineProperty(this, _viewObject, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotCanvasPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotOrigin, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotDirection, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotIndices, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotLocalPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotWorldPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotViewPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotWorldNormal, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _gotUV, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _canvasPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _origin, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _direction, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _indices, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _localPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _worldPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _viewPos, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _worldNormal, {
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, _uv, {
      writable: true,
      value: void 0
    });
    _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] = null;
    _classPrivateFieldLooseBase(this, _canvasPos)[_canvasPos] = new Int16Array([0, 0]);
    _classPrivateFieldLooseBase(this, _origin)[_origin] = new Float64Array([0, 0, 0]);
    _classPrivateFieldLooseBase(this, _direction)[_direction] = new Float64Array([0, 0, 0]);
    _classPrivateFieldLooseBase(this, _indices)[_indices] = new Int32Array(3);
    _classPrivateFieldLooseBase(this, _localPos)[_localPos] = new Float64Array([0, 0, 0]);
    _classPrivateFieldLooseBase(this, _worldPos)[_worldPos] = new Float64Array([0, 0, 0]);
    _classPrivateFieldLooseBase(this, _viewPos)[_viewPos] = new Float64Array([0, 0, 0]);
    _classPrivateFieldLooseBase(this, _worldNormal)[_worldNormal] = new Float64Array([0, 0, 0]);
    _classPrivateFieldLooseBase(this, _uv)[_uv] = new Float64Array([0, 0]);
    _classPrivateFieldLooseBase(this, _gotOrigin)[_gotOrigin] = false;
    _classPrivateFieldLooseBase(this, _gotDirection)[_gotDirection] = false;
    _classPrivateFieldLooseBase(this, _gotIndices)[_gotIndices] = false;
    _classPrivateFieldLooseBase(this, _gotCanvasPos)[_gotCanvasPos] = false;
    _classPrivateFieldLooseBase(this, _gotLocalPos)[_gotLocalPos] = false;
    _classPrivateFieldLooseBase(this, _gotWorldPos)[_gotWorldPos] = false;
    _classPrivateFieldLooseBase(this, _gotViewPos)[_gotViewPos] = false;
    _classPrivateFieldLooseBase(this, _gotWorldNormal)[_gotWorldNormal] = false;
    _classPrivateFieldLooseBase(this, _gotUV)[_gotUV] = false;
    this.reset();
  }
  /**
   * The picked {@link ViewObject}.
   */
  var _proto = PickResult.prototype;
  /**
   * @private
   */
  _proto.reset = function reset() {
    _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] = null;
    _classPrivateFieldLooseBase(this, _gotCanvasPos)[_gotCanvasPos] = false;
    _classPrivateFieldLooseBase(this, _gotOrigin)[_gotOrigin] = false;
    _classPrivateFieldLooseBase(this, _gotDirection)[_gotDirection] = false;
    _classPrivateFieldLooseBase(this, _gotIndices)[_gotIndices] = false;
    _classPrivateFieldLooseBase(this, _gotLocalPos)[_gotLocalPos] = false;
    _classPrivateFieldLooseBase(this, _gotWorldPos)[_gotWorldPos] = false;
    _classPrivateFieldLooseBase(this, _gotViewPos)[_gotViewPos] = false;
    _classPrivateFieldLooseBase(this, _gotWorldNormal)[_gotWorldNormal] = false;
    _classPrivateFieldLooseBase(this, _gotUV)[_gotUV] = false;
  };
  _createClass(PickResult, [{
    key: "viewObject",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _viewObject)[_viewObject];
    }
    /**
     * @private
     */,
    set: function set(value) {
      _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] = value;
    }
    /**
     * Canvas coordinates when picking with a 2D pointer.
     */
  }, {
    key: "canvasPos",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _gotCanvasPos)[_gotCanvasPos] ? _classPrivateFieldLooseBase(this, _canvasPos)[_canvasPos] : undefined;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _canvasPos)[_canvasPos][0] = value[0];
        _classPrivateFieldLooseBase(this, _canvasPos)[_canvasPos][1] = value[1];
        _classPrivateFieldLooseBase(this, _gotCanvasPos)[_gotCanvasPos] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotCanvasPos)[_gotCanvasPos] = false;
      }
    }
    /**
     * World-space 3D ray origin when raypicked.
     */
  }, {
    key: "origin",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _gotOrigin)[_gotOrigin] ? _classPrivateFieldLooseBase(this, _origin)[_origin] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _origin)[_origin][0] = value[0];
        _classPrivateFieldLooseBase(this, _origin)[_origin][1] = value[1];
        _classPrivateFieldLooseBase(this, _origin)[_origin][2] = value[2];
        _classPrivateFieldLooseBase(this, _gotOrigin)[_gotOrigin] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotOrigin)[_gotOrigin] = false;
      }
    }
    /**
     * World-space 3D ray direction when raypicked.
     */
  }, {
    key: "direction",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _gotDirection)[_gotDirection] ? _classPrivateFieldLooseBase(this, _direction)[_direction] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _direction)[_direction][0] = value[0];
        _classPrivateFieldLooseBase(this, _direction)[_direction][1] = value[1];
        _classPrivateFieldLooseBase(this, _direction)[_direction][2] = value[2];
        _classPrivateFieldLooseBase(this, _gotDirection)[_gotDirection] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotDirection)[_gotDirection] = false;
      }
    }
    /**
     * Picked triangle's vertex indices.
     * Only defined when an object and triangle was picked.
     */
  }, {
    key: "indices",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] && _classPrivateFieldLooseBase(this, _gotIndices)[_gotIndices] ? _classPrivateFieldLooseBase(this, _indices)[_indices] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _indices)[_indices][0] = value[0];
        _classPrivateFieldLooseBase(this, _indices)[_indices][1] = value[1];
        _classPrivateFieldLooseBase(this, _indices)[_indices][2] = value[2];
        _classPrivateFieldLooseBase(this, _gotIndices)[_gotIndices] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotIndices)[_gotIndices] = false;
      }
    }
    /**
     * Picked Local-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
  }, {
    key: "localPos",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] && _classPrivateFieldLooseBase(this, _gotLocalPos)[_gotLocalPos] ? _classPrivateFieldLooseBase(this, _localPos)[_localPos] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _localPos)[_localPos][0] = value[0];
        _classPrivateFieldLooseBase(this, _localPos)[_localPos][1] = value[1];
        _classPrivateFieldLooseBase(this, _localPos)[_localPos][2] = value[2];
        _classPrivateFieldLooseBase(this, _gotLocalPos)[_gotLocalPos] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotLocalPos)[_gotLocalPos] = false;
      }
    }
    /**
     * Picked World-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
  }, {
    key: "worldPos",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] && _classPrivateFieldLooseBase(this, _gotWorldPos)[_gotWorldPos] ? _classPrivateFieldLooseBase(this, _worldPos)[_worldPos] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _worldPos)[_worldPos][0] = value[0];
        _classPrivateFieldLooseBase(this, _worldPos)[_worldPos][1] = value[1];
        _classPrivateFieldLooseBase(this, _worldPos)[_worldPos][2] = value[2];
        _classPrivateFieldLooseBase(this, _gotWorldPos)[_gotWorldPos] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotWorldPos)[_gotWorldPos] = false;
      }
    }
    /**
     * Picked View-space point on surface.
     * Only defined when an object and a point on its surface was picked.
     */
  }, {
    key: "viewPos",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] && _classPrivateFieldLooseBase(this, _gotViewPos)[_gotViewPos] ? _classPrivateFieldLooseBase(this, _viewPos)[_viewPos] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _viewPos)[_viewPos][0] = value[0];
        _classPrivateFieldLooseBase(this, _viewPos)[_viewPos][1] = value[1];
        _classPrivateFieldLooseBase(this, _viewPos)[_viewPos][2] = value[2];
        _classPrivateFieldLooseBase(this, _gotViewPos)[_gotViewPos] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotViewPos)[_gotViewPos] = false;
      }
    }
    /**
     * Normal vector at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
  }, {
    key: "worldNormal",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] && _classPrivateFieldLooseBase(this, _gotWorldNormal)[_gotWorldNormal] ? _classPrivateFieldLooseBase(this, _worldNormal)[_worldNormal] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _worldNormal)[_worldNormal][0] = value[0];
        _classPrivateFieldLooseBase(this, _worldNormal)[_worldNormal][1] = value[1];
        _classPrivateFieldLooseBase(this, _worldNormal)[_worldNormal][2] = value[2];
        _classPrivateFieldLooseBase(this, _gotWorldNormal)[_gotWorldNormal] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotWorldNormal)[_gotWorldNormal] = false;
      }
    }
    /**
     * UV coordinates at picked position on surface.
     * Only defined when an object and a point on its surface was picked.
     */
  }, {
    key: "uv",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _viewObject)[_viewObject] && _classPrivateFieldLooseBase(this, _gotUV)[_gotUV] ? _classPrivateFieldLooseBase(this, _uv)[_uv] : null;
    }
    /**
     * @private
     */,
    set: function set(value) {
      if (value) {
        _classPrivateFieldLooseBase(this, _uv)[_uv][0] = value[0];
        _classPrivateFieldLooseBase(this, _uv)[_uv][1] = value[1];
        _classPrivateFieldLooseBase(this, _gotUV)[_gotUV] = true;
      } else {
        _classPrivateFieldLooseBase(this, _gotUV)[_gotUV] = false;
      }
    }
  }]);
  return PickResult;
}();

exports.AmbientLight = AmbientLight;
exports.Camera = Camera;
exports.CameraFlightAnimation = CameraFlightAnimation;
exports.CustomProjection = CustomProjection;
exports.DirLight = DirLight;
exports.EdgeMaterial = EdgeMaterial;
exports.EmphasisMaterial = EmphasisMaterial;
exports.FrustumProjection = FrustumProjection;
exports.Metrics = Metrics;
exports.OrthoProjection = OrthoProjection;
exports.PerspectiveProjection = PerspectiveProjection;
exports.PickResult = PickResult;
exports.PointLight = PointLight;
exports.PointsMaterial = PointsMaterial;
exports.SAO = SAO;
exports.SectionPlane = SectionPlane;
exports.View = View;
exports.ViewLayer = ViewLayer;
exports.ViewObject = ViewObject;
exports.Viewer = Viewer;
//# sourceMappingURL=index.cjs.map
