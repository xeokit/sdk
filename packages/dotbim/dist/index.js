var e=require("@xeokit/core");exports.loadDotBIM=function(d,o){if(d.sceneModel.destroyed)throw new Error("SceneModel already destroyed");if(d.sceneModel.built)throw new e.SDKError("SceneModel already built");if(d.dataModel){if(d.dataModel.destroyed)throw new e.SDKError("DataModel already destroyed");if(d.dataModel.built)throw new e.SDKError("DataModel already built")}return new Promise(function(e,o){!function(e){for(var d=e.data,o=d.meshes,r=0,t=o.length;r<t;r++){var a=o[r];e.sceneModel.createGeometry({id:a.mesh_id,positions:a.coordinates,indices:a.indices})}for(var l=d.elements,i=0,n=l.length;i<n;i++){var s=l[i],c=s.guid;if(e.sceneModel){var M=c+"-mesh-"+i;e.sceneModel.createMesh({id:M,geometryId:s.mesh_id,baseColor:s.color}),e.sceneModel.createObject({id:c,meshIds:[M]})}e.dataModel&&e.dataModel.createObject({id:s.guid,type:s.type})}}({data:d.data,sceneModel:d.sceneModel,dataModel:d.dataModel,nextId:0}),e()})};
//# sourceMappingURL=index.js.map