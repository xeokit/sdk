## Unfinished Features

The current version of the xeokit SDK is still in its **alpha** stage.

Most incomplete features are within the doc:WebGLRenderer class, which is part of the doc:@xeokit/sdk/webglrenderer module.

The following functionalities are yet to be completed:

- Picking
- Screen Space Ambient Occlusion (SAO)
- Texture rendering
- Edge rendering
- Snapshots

Among these, **picking** is the highest priority. While the picking functionality has been implemented, it is not yet operational and requires debugging.

Once picking is fully functional, the doc:CameraControl class should also work as expected, as it depends on picking for certain navigation capabilities.

## Completed Features

Most other modules in the SDK are nearly complete and generally functional.

Once doc:WebGLRenderer is finalized, additional issues may surface in some of these modules as their integration tests are expanded to leverage the new functionality.

Key features of the completed modules include:

- 3D scene representation (doc:@xeokit/sdk/scene)
- Data modeling (doc:@xeokit/sdk/data)
- Converter CLI tools
- Loaders
- Savers
- API documentation

The following modules are considered (mostly) complete:

- doc:@xeokit/sdk/basictypes
- doc:@xeokit/sdk/bcf
- doc:@xeokit/sdk/boundaries
- doc:@xeokit/sdk/cameracontrol
- doc:@xeokit/sdk/cameraflight
- doc:@xeokit/sdk/cityjson
- doc:@xeokit/sdk/cityjson2xgf
- doc:@xeokit/sdk/cityjsontypes_1_1_3
- doc:@xeokit/sdk/compression
- doc:@xeokit/sdk/constants
- doc:@xeokit/sdk/contextmenu
- doc:@xeokit/sdk/core
- doc:@xeokit/sdk/curves
- doc:@xeokit/sdk/data
- doc:@xeokit/sdk/dotbim
- doc:@xeokit/sdk/dotbim2xgf
- doc:@xeokit/sdk/gltf
- doc:@xeokit/sdk/gltf2xgf
- doc:@xeokit/sdk/ifc2gltf2xgf
- doc:@xeokit/sdk/ifctypes
- doc:@xeokit/sdk/kdtree2
- doc:@xeokit/sdk/kdtree3
- doc:@xeokit/sdk/ktx2
- doc:@xeokit/sdk/las
- doc:@xeokit/sdk/las2xgf
- doc:@xeokit/sdk/locale
- doc:@xeokit/sdk/math
- doc:@xeokit/sdk/matrix
- doc:@xeokit/sdk/metamodel
- doc:@xeokit/sdk/modelchunksloader
- doc:@xeokit/sdk/pick
- doc:@xeokit/sdk/procgen
- doc:@xeokit/sdk/rtc
- doc:@xeokit/sdk/scene
- doc:@xeokit/sdk/treeview
- doc:@xeokit/sdk/utils
- doc:@xeokit/sdk/viewer
- doc:@xeokit/sdk/webifc
- doc:@xeokit/sdk/xgf
- doc:@xeokit/sdk/xkt

As development progresses, refinements and additional testing will further improve the stability of these modules.
