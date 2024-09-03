# Converts data sets into files that can be loaded into xeokit SceneModels and DataModels

# ./data/datasets/<Model Name>/model.ifc - Original IFC file
# ./data/datasets/<Model Name>/model.glb - glTF SceneModel file

# ./data/datasets/<Model Name>/scenemodel.ifc2gltf.glb - glTF SceneModel, via IFC -> ifc2gltf -> GLB
# ./data/datasets/<Model Name>/scenemodel.ifc2gltf.gltf2dtx.dtx - DTX SceneModel, via IFC -> ifc2gltf -> GLB -> gltf2dtx -> DTX
# ./data/datasets/<Model Name>/datamodel.ifc2gltf.gltf2dtx.json - JSON DataModel, via IFC -> ifc2gltf -> GLB -> gltf2dtx -> JSON

# ./data/datasets/<Model Name>/scenemodel.webifc.dtx - DTX SceneModel file converted from IFC using webifc2dtx
# ./data/datasets/<Model Name>/scenemodel.webifc.json - JSON DataeModel file converted from IFC using webifc2dtx

# ./data/datasets/<Model Name>/scenemodel.gltf2dtx.dtx - DTX SceneModel file converted from glTF using gltf2dtx
# ./data/datasets/<Model Name>/datamodel.gltf2dtx.json - JSON DataModel file converted from glTF using gltf2dtx


#-----------------------------------------------------------------------
# WebIFC -> DTX
#-----------------------------------------------------------------------

# Duplex

node ../webifc2dtx/webifc2dtx.js \
-i ./data/datasets/Duplex/Duplex.ifc \
-s ./data/datasets/Duplex/Duplex.webifc.SceneModel.dtx \
-d ./data/datasets/Duplex/Duplex.webifc.DataModel.json \
-l

# MAP

node ../webifc2dtx/webifc2dtx.js \
-i ./data/datasets/MAP/MAP.ifc \
-s ./data/datasets/MAP/MAP.webifc.SceneModel.dtx \
-d ./data/datasets/MAP/MAP.webifc.DataModel.json \
-l

# Archicad-Demoprojekt

node ../webifc2dtx/webifc2dtx.js \
-i ./data/datasets/Archicad-Demoprojekt/Archicad-Demoprojekt.ifc \
-s ./data/datasets/Archicad-Demoprojekt/Archicad-Demoprojekt.webifc.SceneModel.dtx \
-d ./data/datasets/Archicad-Demoprojekt/Archicad-Demoprojekt.webifc.DataModel.json \
-l

#-----------------------------------------------------------------------
# GLB -> DTX
#-----------------------------------------------------------------------

# Duplex

node ../gltf2dtx/gltf2dtx.js \
-i ./data/datasets/Duplex/Duplex.ifc2gltf.SceneModel.glb \
-s ./data/datasets/Duplex/Duplex.ifc2gltf.gltf2dtx.SceneModel.dtx \
-d ./data/datasets/Duplex/Duplex.ifc2gltf.gltf2dtx.DataModel.json \
-l

node ../gltf2dtx/gltf2dtx.js \
-i ./data/datasets/Archicad-Demoprojekt/Archicad-Demoprojekt.ifc2gltf.SceneModel.glb
-s ./data/datasets/Archicad-Demoprojekt/Archicad-Demoprojekt.ifc2gltf.gltf2dtx.SceneModel.dtx
-d ./data/datasets/Archicad-Demoprojekt/Archicad-Demoprojekt.ifc2gltf.gltf2dtx.DataModel.json
-l

node ../gltf2dtx/gltf2dtx.js \
-i ./data/datasets/MAP/MAP.ifc2gltf.SceneModel.glb \
-s ./data/datasets/MAP/MAP.ifc2gltf.gltf2dtx.SceneModel.dtx \
-d ./data/datasets/MAP/MAP.ifc2gltf.gltf2dtx.DataModel.json \
-l
