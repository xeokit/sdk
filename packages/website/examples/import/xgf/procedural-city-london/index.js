window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../../../models/ProceduralCityLondon/xgfstream/index.runtime.json",
  "metadataUrl": "../../../../models/ProceduralCityLondon/metadata.json",
  "reportUrl": "../../../../models/ProceduralCityLondon/report.json",
  "modelId": "ProceduralCityLondon",
  "viewId": "proceduralCityLondonView",
  "streamLabel": "London procedural city with the Thames",

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
