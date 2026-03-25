// Import the SDK from a bundle built for these examples.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const {scene, data} = demoHelper;

  // Arrange the View's Camera within our +Z "up" coordinate system

 demoHelper.createView({
    id: "demoView",
    camera: {
      projection: "perspective",
      eye: [1841990.2778388674, 5173295.7011186555, 16.25441882894172],
      look: [1842022.2883483584, 5173301.846981712, 10.494716146446603],
      up: [0.1708873388776124, 0.032809545530215846, 0.9847441551659135]
    }
  });

  demoHelper.createView({
    id: "demoView2",
    camera: {
      projection: "perspective",
      eye: [1841990.2778388674, 5173295.7011186555, 16.25441882894172],
      look: [1842022.2883483584, 5173301.846981712, 10.494716146446603],
      up: [0.1708873388776124, 0.032809545530215846, 0.9847441551659135]
    }
  });


  // Create a SceneModel to hold our model's geometry and materials

  const sceneModelResult = scene.createModel({
    id: "demoModel",
    coordinateSystem: { // Model's local Y-up coordinate system
      basis: [
        1, 0, 0, // Right +X
        0, 1, 0, // Up +Y
        0, 0, -1  // Forward -Z
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error(`Error creating SceneModel: ${sceneModelResult.error}`);
  }

  // Create a DataModel to hold semantic data for our model

  const dataModelResult = data.createModel({
    id: "demoModel"
  });

  if (dataModelResult.ok === false) {
    throw new Error(`Error creating SceneModel: ${dataModelResult.error}`);
  }

  const sceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  // Use GLTFLoader to load a glTF model into our SceneModel and DataModel

  const gltfLoader = new xeokit.formats.gltf.GLTFLoader();

  fetch("../../models/MAP/gltf/model.glb").then(response => {

    response
      .arrayBuffer()
      .then(fileData => {

        gltfLoader.load({
          fileData,
          sceneModel,
          dataModel
        }).then(() => {

          //
          // const transform = sceneModel.createTransform({
          //   id: "modelTransform",
          //   parent: null,
          //   position: [-1842009.4968455553, -9.685518291306686, 5173295.851503017]
          // }).value;
          //
          // // iterate over objects in sceneModel
          //
          // for (const sceneMeshId in sceneModel.meshes) {
          //   const sceneMesh = sceneModel.meshes[sceneMeshId];
          //   sceneMesh.setParentTransformId(transform.id);
          // }

          // The Scene and SceneModel will now contain a SceneObject for each displayable object in our model.

        //  demoHelper.viewFit();

         // demoHelper.orbit();

          demoHelper.finished();

          const exploder = new xeokit.demo.SceneModelExploder({
            scene,
            sceneModel,
            aabb3Index: demoHelper.aabb3Index
          });

          exploder.rebuild();
          //
          // const sphereResult = xeokit.procgen.buildSphereGeometry({
          //   center: [0, 0, 0],
          //   radius: 0.2,
          //   heightSegments: 12,
          //   widthSegments: 12
          // });
          //
          // if (!sphereResult.ok) {
          //   throw new Error(sphereResult.error);
          // }
          //
          // const sphere = sphereResult.value;
          //
          // sceneModel.fromParams({
          //   geometries: [{
          //     id: "sphereGeometry",
          //     primitive: xeokit.constants.TrianglesPrimitive,
          //     positions: sphere.positions,
          //     indices: sphere.indices
          //   }],
          //   meshes: [{
          //     id: "sphereMesh",
          //     geometryId: "sphereGeometry",
          //     color: [0, 0.5, 1],
          //     matrix: xeokit.scene.buildMat4({
          //       position: [0, 0, 0]
          //     })
          //   }],
          //   objects: [{
          //     id: "sphereObject",
          //     meshIds: ["sphereMesh"]
          //   }]
          // });
          //
          // const sphereViewObject = view.objects["sphereObject"];
          // sphereViewObject.pickable = false;
          // sphereViewObject.visible = false;
          // sphereViewObject.selected = true;
          //
          // const sphereMesh = sceneModel.meshes["sphereMesh"];
          //
          // // Attach a mouse click listener to the View's canvas, and log any object that is picked when the user clicks.
          //
          // view.htmlElement.addEventListener("mousemove", (e) => {
          //
          //   const result = renderer.pick(view, {
          //     canvasPos: [e.offsetX, e.offsetY],
          //     pickViewObject: true
          //   });
          //
          //   if (result.ok && result.value) {
          //
          //     const pickResult = result.value;
          //
          //     const {
          //       canvasPos,
          //       sceneMesh,
          //       sceneObject,
          //       viewObject,
          //       worldPos
          //     } = pickResult;
          //
          //     if (sceneMesh) {
          //
          //       sphereViewObject.visible = true;
          //
          //       if (worldPos) {
          //         sphereMesh.matrix = xeokit.scene.buildMat4({
          //           position: worldPos
          //         });
          //       }
          //     } else {
          //       sphereViewObject.visible = false;
          //     }
          //   } else {
          //     sphereViewObject.visible = false;
          //   }
          // });


        }).catch(message => {
          console.error(`Error loading glTF: ${message}`);
        });
      });
  });
});


