
---

In the Viewer, only the essential components have been implemented to facilitate the completion of scene representation, along with loaders, savers, and converters. The scene and data representation, as well as the loaders, savers, and converters, are largely finished. However, the Viewer itself remains incomplete, and several plugins need to be migrated from xeokit V2.

Now is the time to revisit and implement the outstanding functionalities of the Viewer and the necessary plugins.
---

## Scene

* Complete

## Data

* Complete

## Viewer

* Incomplete

#### What's Done

* Basic Triangle rendering
* Lines rendering
* Points rendering

#### TODO

* Textures
* Section Planes
* Edges rendering
* SAO
* Dynamic canvas resolution scaling
* NavCube
* Picking
* CameraControl click-drag-pivot, distance-dependent movement rate

## Model Loaders

#### Done

* glTF
* XGF
* .BIM
* XKT
* CityJSON
* IFC
* JSON (native serialized format) 
* LAS/LAZ

## Model Savers

#### Done

*  XGF
*  .BIM
*  JSON (native serialized format)

## File Conversion Support

#### Done

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

## Plugins

* Incomplete

#### Done


#### TODO
