window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../../../models/ProceduralCityChicagoRiver/xgfstream/index.runtime.json",
  "metadataUrl": "../../../../models/ProceduralCityChicagoRiver/metadata.json",
  "reportUrl": "../../../../models/ProceduralCityChicagoRiver/report.json",
  "modelId": "ProceduralCityChicagoRiver",
  "viewId": "proceduralCityChicagoRiverView",
  "streamLabel": "Chicago river procedural city",

  "adaptiveQuality": false,
  "effects": {
    "sao": {
      "enabled": false
    },
    "bloom": {
      "enabled": false
    },
    "atmosphere": {
      "enabled": false
    },
    "depthOfField": {
      "enabled": false
    },
    "tonemap": {
      "enabled": false
    },
    "antiAliasing": {
      "enabled": false
    },
    "shadows": {
      "enabled": false
    },
    "edges": {
      "enabled": false
    },
    "sectionPlaneCaps": {
      "enabled": false
    },
    "bodyHatch": {
      "enabled": false
    }
  },
  "lights": {
    "ibl": {
      "enabled": false
    },
    "hemispheric": {
      "enabled": true
    }
  },
  "webGPU": {
    "renderConfigs": {
      "logDepth": true
    }
  }
};

import("../procedural-city/index.js");
