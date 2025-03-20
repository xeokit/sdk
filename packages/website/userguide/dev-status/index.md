## Unfinished Features

The incomplete parts are mostly the functionalities of the doc:WebGLRenderer class, which is implemented within 
the doc:@xeokit/sdk/webglrenderer module. These incomplete functionalities include:

 - Picking
 - SAO 
 - Texture rendering
 - Edges rendering
 - Snapshots

The doc:CameraControl class, in doc:@xeokit/sdk/viewer, relies on picking for certain navigation 
functions. Once these are finalized, CameraControl will be fully functional.

## Finished Features

The remaining modules are more or less much complete, at least for a first beta release. The modules are 
listed below, but briefly they include this functionality:  

 - 3D scene representation (doc:@xeokit/sdk/scene)
 - Data model (doc:@xeokit/sdk/data)
 - Converter CLI tools
 - Loaders
 - Savers
 - API docs

The completed modules are:

---

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

---

#### Model Loaders

 - glTF
 - XGF
 - .BIM
 - XKT
 - CityJSON
 - IFC
 - JSON (native serialized format) 
 - LAS/LAZ

#### Model Savers

 -  XGF
 -  .BIM
 -  JSON (native serialized format)

#### File Conversion Support

##### From glTF

 -  glTF --> XGF 
 -  glTF --> .BIM 
 -  glTF --> JSON (native serialized format)

##### From IFC

 -  IFC --> XGF 
 -  IFC --> .BIM
 -  IFC --> JSON (native serialized format)

##### From CityJSON

 -  CityJSON --> XGF
 -  CityJSON --> .BIM
 -  CityJSON --> JSON (native serialized format)

##### From .BIM

 -  .BIM --> XGF
 -  .BIM --> .BIM
 -  .BIM --> JSON (native serialized format)

##### From XKT

 -  .XKT --> XGF
 -  .XKT --> .BIM
 -  .XKT --> JSON (native serialized format)

##### From XGF

 -  .XGF --> .BIM
 -  .XGF --> JSON (native serialized format)

##### From Native JSON

 -  JSON --> XGF
 -  JSON --> .BIM



