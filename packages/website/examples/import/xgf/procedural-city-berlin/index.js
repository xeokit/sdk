window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../../../models/ProceduralCityBerlin/xgfstream/index.runtime.json",
  "metadataUrl": "../../../../models/ProceduralCityBerlin/metadata.json",
  "reportUrl": "../../../../models/ProceduralCityBerlin/report.json",
  "modelId": "ProceduralCityBerlin",
  "viewId": "proceduralCityBerlinView",
  "streamLabel": "Berlin procedural city",
  "representationLOD": true,

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
  }
};

import("../import/xgf/procedural-city/index.js");
