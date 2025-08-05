// Import the SDK from a bundle built for these examples

import * as xeokit from "../../js/xeokit-demo-bundle.js";

import {DemoHelper} from "../../js/DemoHelper.js";

// Create a Scene to hold geometry and materials

const scene = new xeokit.scene.Scene();

// Create a Data to hold semantic data

const data = new xeokit.data.Data();

// Create a WebGLRenderer to use the browser's WebGL API for 3D graphics

const renderer = new xeokit.webglrenderer.WebGLRenderer({});

// Create a Viewer that draws our Scene using the WebGLRenderer. Note that the
// Scene and WebGLRenderer can only be attached to one Viewer at a time.

const viewer = new xeokit.viewer.Viewer({
  id: "demoViewer",
  scene,
  renderer
});

// Give the Viewer a single View to render the Scene in our HTML canvas element

const view = viewer.createView({
  id: "demoView",
  elementId: "demoCanvas"
});

// Position the View's Camera

view.camera.eye = [10, -2, 15];
view.camera.look = [0, -6, 0];
view.camera.up = [0, 1, 0];

// Add a CameraControl to interactively control the View's Camera with keyboard,
// mouse and touch input

new xeokit.cameracontrol.CameraControl(view);

// Ignore this DemoHelper

const demoHelper = new DemoHelper({
  elementId: "info-container",
  viewer,
  data
});

demoHelper.init()
  .then(() => {

    // Create a DataModel to hold semantic information for the
    // objects in our table model

    const dataModel = data.createModel({
      id: "demoModel"
    });

    // Create some PropertySets in our DataModel

    dataModel.createPropertySet({ // PropertySet | SDKError
      id: "tablePropertySet",
      name: "Table properties",
      type: "",
      properties: [ // Property[]
        {
          name: "Weight",
          value: 5,
          type: "",
          valueType: "",
          description: "Weight of the thing"
        },
        {
          name: "Height",
          value: 12,
          type: "",
          valueType: "",
          description: "Height of the thing"
        }
      ]
    });

    dataModel.createPropertySet({ // PropertySet | SDKError
      id: "tableTopPropertySet",
      name: "Table Top properties",
      type: "",
      properties: [ // Property[]
        {
          name: "Weight",
          value: 10,
          type: "",
          valueType: "",
          description: "Weight of the thing"
        },
        {
          name: "Height",
          value: 3,
          type: "",
          valueType: "",
          description: "Height of the thing"
        }
      ]
    });

    dataModel.createPropertySet({
      id: "tableLegPropertySet",
      name: "Table leg properties",
      type: "",
      properties: [
        {
          name: "Weight",
          value: 5,
          type: "",
          valueType: "",
          description: "Weight of the thing"
        },
        {
          name: "Height",
          value: 12,
          type: "",
          valueType: "",
          description: "Height of the thing"
        }
      ]
    });

    dataModel.createObject({ // DataObject | SDKError
      id: "table",
      type: xeokit.basictypes.BasicEntity,
      name: "Table",
      propertySetIds: ["tablePropertySet"]
    });

    dataModel.createObject({
      id: "redLeg",
      name: "Red table Leg",
      type: xeokit.basictypes.BasicEntity,
      propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
      id: "greenLeg",
      name: "Green table leg",
      type: xeokit.basictypes.BasicEntity,
      propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
      id: "blueLeg",
      name: "Blue table leg",
      type: xeokit.basictypes.BasicEntity,
      propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
      id: "yellowLeg",
      name: "Yellow table leg",
      type: xeokit.basictypes.BasicEntity,
      propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
      id: "tableTop",
      name: "Purple table top",
      type: xeokit.basictypes.BasicEntity,
      propertySetIds: ["tableTopPropertySet"]
    });

    // Create Relationships to connect the DataObjects together
    // so that the DataObject that represents the table assembly aggregates
    // the other five DataObjects.

    const myRelationship = dataModel.createRelationship({
      type: xeokit.basictypes.BasicAggregation,
      relatingObjectId: "table",
      relatedObjectId: "tableTop"
    });

    if (myRelationship instanceof xeokit.core.SDKError) {
      console.error(myRelationship.message);
    }

    dataModel.createRelationship({
      type: xeokit.basictypes.BasicAggregation,
      relatingObjectId: "tableTop",
      relatedObjectId: "redLeg"
    });

    dataModel.createRelationship({
      type: xeokit.basictypes.BasicAggregation,
      relatingObjectId: "tableTop",
      relatedObjectId: "greenLeg"
    });

    dataModel.createRelationship({
      type: xeokit.basictypes.BasicAggregation,
      relatingObjectId: "tableTop",
      relatedObjectId: "blueLeg"
    });

    dataModel.createRelationship({
      type: xeokit.basictypes.BasicAggregation,
      relatingObjectId: "tableTop",
      relatedObjectId: "yellowLeg"
    });

    // Create a SceneModel to hold geometry and materials

    const sceneModel = scene.createModel({
      id: "demoModel"
    });

    // Create a box-shaped SceneGeometry, which we'll reuse for the tabletop and legs.

    sceneModel.createGeometry({
      id: "demoBoxGeometry",
      primitive: xeokit.constants.TrianglesPrimitive,
      positions: [
        1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
        -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
        -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
      ],
      indices: [
        0, 1, 2, 0, 2, 3,            // front
        4, 5, 6, 4, 6, 7,            // right
        8, 9, 10, 8, 10, 11,         // top
        12, 13, 14, 12, 14, 15,      // left
        16, 17, 18, 16, 18, 19,      // bottom
        20, 21, 22, 20, 22, 23
      ]
    });

    // Create SceneObjects to represent the tabletop and legs. Each SceneObject
    // gets a SceneMesh that instances the SceneGeometry, configured with a color
    // and a 4x4 modeling transform matrix to apply to the SceneGeometry's
    // vertex positons.

    sceneModel.createMesh({
      id: "redLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [-4, -6, -4],
        scale: [1, 3, 1]
      }),
      color: [1, 0.3, 0.3]
    });

    sceneModel.createObject({
      id: "redLeg",
      meshIds: ["redLegMesh"]
    });

    sceneModel.createMesh({
      id: "greenLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [4, -6, -4],
        scale: [1, 3, 1]
      }),
      color: [0.3, 1.0, 0.3]
    });

    sceneModel.createObject({
      id: "greenLeg",
      meshIds: ["greenLegMesh"]
    });

    sceneModel.createMesh({
      id: "blueLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [4, -6, 4],
        scale: [1, 3, 1]
      }),
      color: [0.3, 0.3, 1.0]
    });

    sceneModel.createObject({
      id: "blueLeg",
      meshIds: ["blueLegMesh"]
    });

    sceneModel.createMesh({
      id: "yellowLegMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [-4, -6, 4],
        scale: [1, 3, 1]
      }),
      color: [1.0, 1.0, 0.0]
    });

    sceneModel.createObject({
      id: "yellowLeg",
      meshIds: ["yellowLegMesh"]
    });

    sceneModel.createMesh({
      id: "purpleTableTopMesh",
      geometryId: "demoBoxGeometry",
      matrix: xeokit.scene.buildMat4({
        position: [0, -3, 0],
        scale: [6, 0.5, 6]
      }),
      color: [1.0, 0.3, 1.0]
    });

    sceneModel.createObject({
      id: "purpleTableTop",
      meshIds: ["purpleTableTopMesh"]
    });

    // At this point, the View will contain five ViewObjects that have the same
    // IDs as our SceneObjects. Through these ViewObjects, we can update the
    // appearance of our model elements in that View. We'll make the yellow leg
    // translucent, highlight the red leg and make the tabletop green.

    view.objects["yellowLeg"].opacity = 0.5;
    view.objects["redLeg"].highlighted = true;
    view.objects["purpleTableTop"].colorize = [0, 1, 0];

    // We can also apply these sorts of updates in batches, to multiple
    // ViewObjects at a time. The View remembers the IDs of whetever
    // ViewObjects we update, so we can use such batch updates to restore the
    // ViewObjects to their original states.

    view.setObjectsOpacity(view.opacityObjectIds, 1.0);
    view.setObjectsHighlighted(view.highlightedObjectIds, false);
    view.setObjectsSelected(view.selectedObjectIds, false);

    demoHelper.finished();
  });

