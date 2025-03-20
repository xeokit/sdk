
## Current Status

## Incomplete Features

The incomplete parts are mostly the functionalities of the doc: WebGLRenderer class, which is implemented within 
the doc:@xeokit/sdk/webglrenderer module. The functionalities include:

* Picking
* SAO 
* Texture rendering
* Edges rendering
* Snapshots

The doc:CameraControl class, in @xeokit/sdk/viewer, relies on picking for certain navigation 
functions. Once these are finalized, CameraControl will be fully functional.

## Completed Features

The remaining modules are more or less much complete, at least for a first beta release. The modules are 
listed below, but briefly they include this functionality:  

* 3D scene representation (doc:doc:@xeokit/sdk/scene)
* Data model (doc:doc:@xeokit/sdk/data)
* Converter CLI tools
* Loaders
* Savers
* API docs

* [ x ] doc:@xeokit/sdk/basictypes
* [ x ] doc:@xeokit/sdk/bcf
* [ x ] doc:@xeokit/sdk/boundaries
* [ x ] doc:@xeokit/sdk/cameracontrol
* [ x ] doc:@xeokit/sdk/cameraflight
* [ x ] doc:@xeokit/sdk/cityjson
* [ x ] doc:@xeokit/sdk/cityjson2xgf
* [ x ] doc:@xeokit/sdk/cityjsontypes_1_1_3
* [ x ] doc:@xeokit/sdk/compression
* [ x ] doc:@xeokit/sdk/constants
* [ x ] doc:@xeokit/sdk/contextmenu
* [ x ] doc:@xeokit/sdk/core
* [ x ] doc:@xeokit/sdk/curves
* [ x ] doc:@xeokit/sdk/data
* [ x ] doc:@xeokit/sdk/dotbim
* [ x ] doc:@xeokit/sdk/dotbim2xgf
* [ x ] doc:@xeokit/sdk/gltf
* [ x ] doc:@xeokit/sdk/gltf2xgf
* [ x ] doc:@xeokit/sdk/ifc2gltf2xgf
* [ x ] doc:@xeokit/sdk/ifctypes
* [ x ] doc:@xeokit/sdk/kdtree2
* [ x ] doc:@xeokit/sdk/kdtree3
* [ x ] doc:@xeokit/sdk/ktx2
* [ x ] doc:@xeokit/sdk/las
* [ x ] doc:@xeokit/sdk/las2xgf
* [ x ] doc:@xeokit/sdk/locale
* [ x ] doc:@xeokit/sdk/math
* [ x ] doc:@xeokit/sdk/matrix
* [ x ] doc:@xeokit/sdk/metamodel
* [ x ] doc:@xeokit/sdk/modelchunksloader
* [ x ] doc:@xeokit/sdk/pick
* [ x ] doc:@xeokit/sdk/procgen
* [ x ] doc:@xeokit/sdk/rtc
* [ x ] doc:@xeokit/sdk/scene
* [ x ] doc:@xeokit/sdk/treeview
* [ x ] doc:@xeokit/sdk/utils
* [ x ] doc:@xeokit/sdk/viewer
* [ x ] doc:@xeokit/sdk/webifc
* [ x ] doc:@xeokit/sdk/xgf
* [ x ] doc:@xeokit/sdk/xkt

#### Model Loaders

* glTF
* XGF
* .BIM
* XKT
* CityJSON
* IFC
* JSON (native serialized format) 
* LAS/LAZ

#### Model Savers

*  XGF
*  .BIM
*  JSON (native serialized format)

#### File Conversion Support

##### From glTF

*  glTF --> XGF 
*  glTF --> .BIM 
*  glTF --> JSON (native serialized format)

##### From IFC

*  IFC --> XGF 
*  IFC --> .BIM
*  IFC --> JSON (native serialized format)

##### From CityJSON

*  CityJSON --> XGF
*  CityJSON --> .BIM
*  CityJSON --> JSON (native serialized format)

##### From .BIM

*  .BIM --> XGF
*  .BIM --> .BIM
*  .BIM --> JSON (native serialized format)

##### From XKT

*  .XKT --> XGF
*  .XKT --> .BIM
*  .XKT --> JSON (native serialized format)

##### From XGF

*  .XGF --> .BIM
*  .XGF --> JSON (native serialized format)

##### From Native JSON

*  JSON --> XGF
*  JSON --> .BIM



